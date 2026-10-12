'use strict';
/**
 * 鉴权与密码工具 —— 仅使用 Node 内置 crypto，无任何第三方依赖。
 */
const crypto = require('crypto');

/**
 * 签名密钥。
 * 未显式配置 JWT_SECRET 时，每次启动随机生成一个——宁可重启后需要重新登录，
 * 也不能让公开仓库携带固定密钥（否则任何人都能伪造任意员工/管理员身份）。
 * 生产环境（尤其是多实例）必须通过 JWT_SECRET 显式配置，否则各实例签名不一致。
 */
const RANDOM_SECRET = !process.env.JWT_SECRET;
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

/** 密码哈希：scrypt + 随机盐，格式 salt:hash */
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plain), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const idx = stored.indexOf(':');
  if (idx < 0) return false;
  const salt = stored.slice(0, idx);
  const expect = stored.slice(idx + 1);
  const actual = crypto.scryptSync(String(plain), salt, 32).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expect, 'hex'), Buffer.from(actual, 'hex'));
  } catch (_) {
    return false;
  }
}

/** 轻量 JWT：base64url(payload).HMAC-SHA256 签名 */
function signToken(payload) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== expect.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch (_) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

const COOKIE_NAME = 'er_token';

/**
 * 从请求中提取业务 token。
 *
 * 重要：部分部署平台的网关会注入平台自身的 JWT 并覆盖 Authorization 头，
 * 导致业务 token 被顶掉。因此这里：
 *   1. 优先读取业务 Cookie（网关不会覆盖业务自定义 Cookie）；
 *   2. 若只有 Authorization 头，需先做形态校验——平台 JWT 为三段式，
 *      而我们自签的是两段式（body.sig），三段一律视为外来 token 丢弃。
 */
function tokenFromReq(req) {
  const fromCookie = cookieToken(req);
  if (fromCookie) return fromCookie;
  const raw = req.headers.authorization || req.headers.authtoken || '';
  if (!raw) return null;
  const t = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw.trim();
  if (!t) return null;
  // 三段式 JWT 不是本系统签发的，直接忽略
  if (t.split('.').length !== 2) return null;
  return t;
}

/** 从 Cookie 头中读取业务 token */
function cookieToken(req) {
  const raw = req.headers.cookie;
  if (!raw || typeof raw !== 'string') return null;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k === COOKIE_NAME) {
      const v = part.slice(idx + 1).trim();
      return v || null;
    }
  }
  return null;
}

/** 下发业务 token Cookie（非 HttpOnly，便于前端读取登录态；SameSite=Lax 防 CSRF） */
function setTokenCookie(res, token) {
  const prev = res.getHeader('Set-Cookie');
  const cookie = `${COOKIE_NAME}=${token}; Path=/; Max-Age=${Math.floor(TOKEN_TTL_MS / 1000)}; SameSite=Lax`;
  if (prev) {
    res.setHeader('Set-Cookie', Array.isArray(prev) ? [...prev, cookie] : [prev, cookie]);
  } else {
    res.setHeader('Set-Cookie', cookie);
  }
}

/** 清除业务 token Cookie */
function clearTokenCookie(res) {
  const prev = res.getHeader('Set-Cookie');
  const cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  if (prev) {
    res.setHeader('Set-Cookie', Array.isArray(prev) ? [...prev, cookie] : [prev, cookie]);
  } else {
    res.setHeader('Set-Cookie', cookie);
  }
}

/** 密钥指纹（仅用于多实例部署时排查签名不一致问题，不泄露密钥本身） */
function secretFingerprint() {
  return crypto.createHash('sha256').update(String(SECRET)).digest('hex').slice(0, 12);
}

/** 是否使用了未配置的随机密钥（供启动时打印安全提示） */
function usingRandomSecret() {
  return RANDOM_SECRET;
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  tokenFromReq,
  secretFingerprint,
  usingRandomSecret,
  setTokenCookie,
  clearTokenCookie,
  COOKIE_NAME,
};
