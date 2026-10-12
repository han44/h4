'use strict';
/**
 * 员工认可激励平台 · 最小可部署版本
 * 零第三方依赖：仅使用 Node 内置 http / fs / path / crypto。
 * 启动：node server.js        （默认 http://localhost:3010）
 * 重置：node server.js --reset
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store');
const auth = require('./lib/auth');

const PORT = Number(process.env.PORT || 3010);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ---------------------------------------------------------------- 工具 */

function json(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
  });
  res.end(buf);
}
const ok = (res, data) => json(res, 200, { ok: true, data });
const fail = (res, status, message, extra) =>
  json(res, status, { ok: false, message, ...(extra || {}) });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) reject(new Error('请求体过大'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function pub(e) {
  if (!e) return null;
  const { passwordHash, ...rest } = e;
  return rest;
}

function computeStats(db) {
  const stat = {};
  db.employees.forEach((e) => {
    stat[e.id] = { receivedPoints: 0, receivedCount: 0, sentPoints: 0, sentCount: 0 };
  });
  db.recognitions.forEach((r) => {
    if (stat[r.toId]) {
      stat[r.toId].receivedPoints += r.points;
      stat[r.toId].receivedCount += 1;
    }
    if (stat[r.fromId]) {
      stat[r.fromId].sentPoints += r.points;
      stat[r.fromId].sentCount += 1;
    }
  });
  return stat;
}

function enrich(db, r) {
  const from = db.employees.find((e) => e.id === r.fromId);
  const to = db.employees.find((e) => e.id === r.toId);
  return {
    ...r,
    fromName: from ? from.name : '未知',
    fromDept: from ? from.dept : '',
    fromColor: from ? from.avatarColor : '#94A3B8',
    toName: to ? to.name : '未知',
    toDept: to ? to.dept : '',
    toColor: to ? to.avatarColor : '#94A3B8',
  };
}

function currentEmployee(req, db) {
  const payload = auth.verifyToken(auth.tokenFromReq(req));
  if (!payload || !payload.id) return null;
  return db.employees.find((e) => e.id === payload.id && e.active) || null;
}

function requireAuth(req, db, res) {
  const me = currentEmployee(req, db);
  if (!me) {
    fail(res, 401, '登录已失效，请重新登录');
    return null;
  }
  return me;
}

function requireAdmin(req, db, res) {
  const me = requireAuth(req, db, res);
  if (!me) return null;
  if (me.role !== 'admin') {
    fail(res, 403, '需要管理员权限');
    return null;
  }
  return me;
}

/* ---------------------------------------------------------------- 路由表 */

const ROUTES = [];
const get = (p, fn) => ROUTES.push(['GET', p, fn]);
const post = (p, fn) => ROUTES.push(['POST', p, fn]);

function toRegex(pattern) {
  const keys = [];
  const src = pattern.replace(/:([A-Za-z0-9_]+)/g, (_, k) => {
    keys.push(k);
    return '([^/]+)';
  });
  return { re: new RegExp(`^${src}$`), keys };
}
const compiled = [];
function register(method, pattern, fn) {
  compiled.push({ method, fn, ...toRegex(pattern) });
}
function dispatch(method, pathname) {
  for (const r of compiled) {
    if (r.method !== method) continue;
    const m = r.re.exec(pathname);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    return { fn: r.fn, params };
  }
  return null;
}

/* ---------------------------- 认证 ---------------------------- */

post('/api/auth/login', async (req, res) => {
  const db = store.load();
  const { no, password } = req.body;
  if (!no || !password) return fail(res, 400, '请输入工号与密码');
  const emp = db.employees.find((e) => e.no === String(no).trim());
  if (!emp || !emp.active) return fail(res, 401, '工号不存在或已停用');
  if (!auth.verifyPassword(password, emp.passwordHash)) return fail(res, 401, '工号或密码不正确');
  const token = auth.signToken({ id: emp.id, role: emp.role });
  // 同时下发 Cookie：部署网关可能覆盖 Authorization 头，Cookie 更可靠
  auth.setTokenCookie(res, token);
  ok(res, { token: token, employee: pub(emp) });
});

post('/api/auth/logout', (req, res) => {
  auth.clearTokenCookie(res);
  ok(res, { loggedOut: true });
});

get('/api/me', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  ok(res, { employee: pub(me), settings: db.settings, valueTags: db.valueTags });
});

/* ---------------------------- 仪表盘 ---------------------------- */

get('/api/dashboard', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;

  const stat = computeStats(db);
  const mine = stat[me.id] || { receivedPoints: 0, receivedCount: 0, sentPoints: 0, sentCount: 0 };
  const thisMonth = monthKey(new Date());

  const receivedThisMonth = db.recognitions.filter(
    (r) => r.toId === me.id && monthKey(r.createdAt) === thisMonth
  );
  const sentThisMonth = db.recognitions.filter(
    (r) => r.fromId === me.id && monthKey(r.createdAt) === thisMonth
  );
  const unread = db.recognitions.filter((r) => r.toId === me.id && !r.read).length;

  // 排名：按累计获得积分
  const board = db.employees
    .map((e) => ({ id: e.id, name: e.name, dept: e.dept, color: e.avatarColor, receivedPoints: (stat[e.id] || {}).receivedPoints || 0 }))
    .sort((a, b) => b.receivedPoints - a.receivedPoints);
  const myRank = board.findIndex((e) => e.id === me.id) + 1;

  // 近 6 个月趋势
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = monthKey(d);
    const rs = db.recognitions.filter((r) => r.toId === me.id && monthKey(r.createdAt) === key);
    trend.push({
      month: `${d.getMonth() + 1}月`,
      key,
      count: rs.length,
      points: rs.reduce((s, r) => s + r.points, 0),
    });
  }

  // 本月寿星
  const mm = String(new Date().getMonth() + 1).padStart(2, '0');
  const birthdays = db.employees.filter((e) => e.birthday.slice(5, 7) === mm).length;

  // 进行中的投票
  const vote = db.votes.find((v) => v.active);

  ok(res, {
    employee: pub(me),
    stats: {
      points: me.points,
      giveable: me.giveable,
      receivedPoints: mine.receivedPoints,
      receivedCount: mine.receivedCount,
      sentCount: mine.sentCount,
      receivedThisMonth: receivedThisMonth.length,
      sentThisMonth: sentThisMonth.length,
      pointsThisMonth: receivedThisMonth.reduce((s, r) => s + r.points, 0),
      unread,
      rank: myRank,
      total: board.length,
    },
    trend,
    topThree: board.slice(0, 3),
    birthdayCount: birthdays,
    vote: vote
      ? { id: vote.id, title: vote.title, deadline: vote.deadline, voted: vote.records.some((r) => r.voterId === me.id) }
      : null,
  });
});

/* ---------------------------- 员工列表 ---------------------------- */

get('/api/employees', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const stat = computeStats(db);
  const list = db.employees
    .filter((e) => e.active && e.id !== me.id)
    .map((e) => ({
      id: e.id,
      no: e.no,
      name: e.name,
      dept: e.dept,
      title: e.title,
      avatarColor: e.avatarColor,
      birthday: e.birthday,
      receivedPoints: (stat[e.id] || {}).receivedPoints || 0,
    }))
    .sort((a, b) => b.receivedPoints - a.receivedPoints);
  ok(res, { employees: list, valueTags: db.valueTags, settings: db.settings });
});

/* ---------------------------- 认可 ---------------------------- */

post('/api/recognitions', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;

  const { toId, tag, message, points } = req.body;
  const p = Number(points);
  const { minPointsPerRecognition: min, maxPointsPerRecognition: max } = db.settings;

  if (!toId) return fail(res, 400, '请选择被认可的同事');
  if (toId === me.id) return fail(res, 400, '不能给自己发放认可');
  const target = db.employees.find((e) => e.id === toId && e.active);
  if (!target) return fail(res, 404, '该同事不存在或已停用');
  if (!tag) return fail(res, 400, '请选择价值观标签');
  if (!message || String(message).trim().length < 5) return fail(res, 400, '认可理由至少 5 个字');
  if (!Number.isFinite(p) || p < min || p > max) return fail(res, 400, `积分需在 ${min} ~ ${max} 之间`);
  if (me.giveable < p) return fail(res, 400, `本月可发放积分不足，剩余 ${me.giveable}`);

  const rec = {
    id: `rc${String(db.seq.recognition++).padStart(3, '0')}`,
    fromId: me.id,
    toId,
    tag,
    message: String(message).trim(),
    points: p,
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.recognitions.push(rec);
  me.giveable -= p;
  target.points += p;
  store.save();

  ok(res, { recognition: enrich(db, rec), giveable: me.giveable });
});

get('/api/recognitions/received', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const list = db.recognitions
    .filter((r) => r.toId === me.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => enrich(db, r));
  ok(res, { list, unread: list.filter((r) => !r.read).length });
});

get('/api/recognitions/sent', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const list = db.recognitions
    .filter((r) => r.fromId === me.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => enrich(db, r));
  ok(res, { list });
});

post('/api/recognitions/:id/read', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const rec = db.recognitions.find((r) => r.id === req.params.id && r.toId === me.id);
  if (!rec) return fail(res, 404, '记录不存在');
  rec.read = true;
  store.save();
  ok(res, { id: rec.id });
});

post('/api/recognitions/read-all', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  let n = 0;
  db.recognitions.forEach((r) => {
    if (r.toId === me.id && !r.read) {
      r.read = true;
      n++;
    }
  });
  store.save();
  ok(res, { updated: n });
});

/* ---------------------------- 排行榜 ---------------------------- */

get('/api/leaderboard', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const scope = (req.query.scope || 'all').toString();
  const stat = computeStats(db);

  let pool = db.employees.filter((e) => e.active);
  if (scope === 'dept') pool = pool.filter((e) => e.dept === me.dept);

  const board = pool
    .map((e) => ({
      id: e.id,
      name: e.name,
      dept: e.dept,
      title: e.title,
      avatarColor: e.avatarColor,
      receivedPoints: (stat[e.id] || {}).receivedPoints || 0,
      receivedCount: (stat[e.id] || {}).receivedCount || 0,
      sentCount: (stat[e.id] || {}).sentCount || 0,
      isMe: e.id === me.id,
    }))
    .sort((a, b) => b.receivedPoints - a.receivedPoints)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const myRow = board.find((e) => e.isMe);
  ok(res, {
    scope,
    dept: me.dept,
    board,
    me: myRow || null,
    topThree: board.slice(0, 3),
  });
});

/* ---------------------------- 积分商城 ---------------------------- */

get('/api/rewards', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const myRedeem = db.redemptions.filter((r) => r.employeeId === me.id);
  const list = db.rewards
    .filter((r) => r.active)
    .map((r) => ({
      ...r,
      affordable: me.points >= r.cost,
      redeemedCount: myRedeem.filter((x) => x.rewardId === r.id).length,
    }));
  ok(res, { rewards: list, points: me.points });
});

post('/api/rewards/:id/redeem', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const reward = db.rewards.find((r) => r.id === req.params.id && r.active);
  if (!reward) return fail(res, 404, '商品不存在或已下架');
  if (reward.stock <= 0) return fail(res, 400, '库存不足');
  if (me.points < reward.cost) return fail(res, 400, `积分不足，还差 ${reward.cost - me.points} 分`);

  me.points -= reward.cost;
  reward.stock -= 1;
  const rd = {
    id: `rd${String(db.seq.redemption++).padStart(3, '0')}`,
    employeeId: me.id,
    rewardId: reward.id,
    name: reward.name,
    emoji: reward.emoji,
    cost: reward.cost,
    status: '已完成',
    createdAt: new Date().toISOString(),
  };
  db.redemptions.push(rd);
  store.save();
  ok(res, { redemption: rd, points: me.points });
});

get('/api/redemptions/mine', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const list = db.redemptions
    .filter((r) => r.employeeId === me.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  ok(res, { list });
});

/* ---------------------------- 投票 ---------------------------- */

get('/api/vote/current', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const vote = db.votes.find((v) => v.active);
  if (!vote) return ok(res, { vote: null });

  const total = vote.records.length;
  const candidates = vote.candidates.map((c) => {
    const emp = db.employees.find((e) => e.id === c.employeeId);
    const count = vote.records.filter((r) => r.candidateId === c.id).length;
    return {
      ...c,
      avatarColor: emp ? emp.avatarColor : '#94A3B8',
      title: emp ? emp.title : '',
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
      isMe: c.employeeId === me.id,
    };
  });
  const myVote = vote.records.find((r) => r.voterId === me.id);
  ok(res, {
    vote: {
      id: vote.id,
      title: vote.title,
      monthKey: vote.monthKey,
      deadline: vote.deadline,
      totalVotes: total,
      candidates: candidates.sort((a, b) => b.count - a.count),
      myCandidateId: myVote ? myVote.candidateId : null,
    },
  });
});

post('/api/vote/:id/vote', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const vote = db.votes.find((v) => v.id === req.params.id && v.active);
  if (!vote) return fail(res, 404, '投票不存在或已结束');
  const candidate = vote.candidates.find((c) => c.id === req.body.candidateId);
  if (!candidate) return fail(res, 400, '候选人不存在');
  if (new Date(vote.deadline) < new Date()) return fail(res, 400, '投票已截止');

  const existing = vote.records.find((r) => r.voterId === me.id);
  if (existing) {
    existing.candidateId = candidate.id;
    existing.at = new Date().toISOString();
  } else {
    vote.records.push({ voterId: me.id, candidateId: candidate.id, at: new Date().toISOString() });
  }
  store.save();
  ok(res, { candidateId: candidate.id });
});

/* ---------------------------- 生日祝福 ---------------------------- */

get('/api/birthdays', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  const list = db.employees
    .filter((e) => e.active && e.birthday.slice(5, 7) === mm)
    .map((e) => {
      const day = Number(e.birthday.slice(8, 10));
      const blessings = db.blessings.filter((b) => b.toId === e.id);
      return {
        id: e.id,
        name: e.name,
        dept: e.dept,
        title: e.title,
        avatarColor: e.avatarColor,
        birthday: e.birthday,
        day,
        isToday: e.birthday.slice(5, 10) === `${mm}-${dd}`,
        daysLeft: day - Number(dd),
        blessingCount: blessings.length,
        blessedByMe: blessings.some((b) => b.fromId === me.id),
        isMe: e.id === me.id,
        age: today.getFullYear() - Number(e.birthday.slice(0, 4)),
      };
    })
    .sort((a, b) => a.day - b.day);

  ok(res, { month: Number(mm), list, myBirthday: (db.employees.find((e) => e.id === me.id) || {}).birthday });
});

post('/api/birthdays/:employeeId/bless', (req, res) => {
  const db = store.load();
  const me = requireAuth(req, db, res);
  if (!me) return;
  const target = db.employees.find((e) => e.id === req.params.employeeId && e.active);
  if (!target) return fail(res, 404, '同事不存在');
  if (target.id === me.id) return fail(res, 400, '不能给自己送祝福');

  const message = (req.body.message || '').toString().trim() || '生日快乐，愿你一切顺利！';
  const existing = db.blessings.find((b) => b.toId === target.id && b.fromId === me.id);
  if (existing) {
    existing.message = message;
    existing.createdAt = new Date().toISOString();
  } else {
    db.blessings.push({
      id: `b${String(db.seq.blessing++).padStart(3, '0')}`,
      fromId: me.id,
      toId: target.id,
      message,
      createdAt: new Date().toISOString(),
    });
  }
  store.save();
  ok(res, { blessed: true, count: db.blessings.filter((b) => b.toId === target.id).length });
});

/* ---------------------------- 管理后台 ---------------------------- */

get('/api/admin/overview', (req, res) => {
  const db = store.load();
  if (!requireAdmin(req, db, res)) return;
  const stat = computeStats(db);
  const thisMonth = monthKey(new Date());
  const monthRecs = db.recognitions.filter((r) => monthKey(r.createdAt) === thisMonth);

  const byDept = {};
  db.employees.forEach((e) => {
    byDept[e.dept] = byDept[e.dept] || { dept: e.dept, headcount: 0, points: 0, count: 0 };
    byDept[e.dept].headcount += 1;
    byDept[e.dept].points += (stat[e.id] || {}).receivedPoints || 0;
    byDept[e.dept].count += (stat[e.id] || {}).receivedCount || 0;
  });

  const tagStat = {};
  db.recognitions.forEach((r) => {
    tagStat[r.tag] = (tagStat[r.tag] || 0) + 1;
  });

  ok(res, {
    headcount: db.employees.filter((e) => e.active).length,
    recognitionTotal: db.recognitions.length,
    recognitionThisMonth: monthRecs.length,
    pointsThisMonth: monthRecs.reduce((s, r) => s + r.points, 0),
    redeemedTotal: db.redemptions.length,
    deptStats: Object.values(byDept).sort((a, b) => b.points - a.points),
    tagStats: Object.entries(tagStat)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
    pendingGiveable: db.employees.reduce((s, e) => s + e.giveable, 0),
  });
});

get('/api/admin/employees', (req, res) => {
  const db = store.load();
  if (!requireAdmin(req, db, res)) return;
  const stat = computeStats(db);
  const list = db.employees.map((e) => ({
    ...pub(e),
    receivedPoints: (stat[e.id] || {}).receivedPoints || 0,
    receivedCount: (stat[e.id] || {}).receivedCount || 0,
    sentCount: (stat[e.id] || {}).sentCount || 0,
  }));
  ok(res, { employees: list });
});

post('/api/admin/grant', (req, res) => {
  const db = store.load();
  const admin = requireAdmin(req, db, res);
  if (!admin) return;
  const { employeeId, points, reason } = req.body;
  const p = Number(points);
  const target = db.employees.find((e) => e.id === employeeId && e.active);
  if (!target) return fail(res, 404, '员工不存在');
  if (!Number.isFinite(p) || p <= 0) return fail(res, 400, '发放积分必须为正数');

  target.giveable += p;
  target.points += p;
  store.save();
  console.log(`[admin] ${admin.name} 向 ${target.name} 发放 ${p} 积分：${reason || '未填写'}`);
  ok(res, { employee: pub(target) });
});

/* ---------------------------- 健康检查 ---------------------------- */

const STARTED_AT = Date.now();
const SECRET_FP = auth.secretFingerprint();

get('/api/health', (req, res) => {
  const db = store.load();
  ok(res, {
    status: 'up',
    employees: db.employees.length,
    recognitions: db.recognitions.length,
    time: new Date().toISOString(),
    pid: process.pid,
    node: process.version,
    secretFp: SECRET_FP,
    startedAt: new Date(STARTED_AT).toISOString(),
  });
});

/** 诊断端点：帮助定位线上鉴权失败原因（不含任何密钥明文） */
get('/api/_diag', (req, res) => {
  const db = store.load();
  const raw = auth.tokenFromReq(req);
  const payload = auth.verifyToken(raw);
  const me = payload && payload.id ? db.employees.find((e) => e.id === payload.id) : null;
  ok(res, {
    pid: process.pid,
    node: process.version,
    secretFp: SECRET_FP,
    startedAt: new Date(STARTED_AT).toISOString(),
    hasAuthHeader: !!req.headers.authorization,
    authHeaderLen: raw ? raw.length : 0,
    tokenParts: raw ? raw.split('.').length : 0,
    verifyOk: !!payload,
    payloadId: payload ? payload.id : null,
    employeeFound: !!me,
    employeeActive: me ? !!me.active : null,
    employeesCount: db.employees.length,
    sampleIds: db.employees.slice(0, 3).map((e) => e.id),
  });
});

/* ---------------------------------------------------------------- 静态资源 */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) return fail(res, 403, '禁止访问');

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // SPA 兜底
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, buf) => {
        if (e2) return fail(res, 404, '页面不存在');
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(buf);
      });
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ---------------------------------------------------------------- 服务启动 */

const server = http.createServer(async (req, res) => {
  // CORS（便于本地联调与前端独立部署）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, authToken');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = parsed;

  try {
    if (pathname.startsWith('/api/')) {
      const match = dispatch(req.method, pathname);
      if (!match) return fail(res, 404, `接口不存在：${req.method} ${pathname}`);
      req.params = match.params;
      req.query = Object.fromEntries(parsed.searchParams.entries());
      if (req.method === 'POST') {
        try {
          req.body = await readBody(req);
        } catch (e) {
          return fail(res, 400, e.message);
        }
      }
      return match.fn(req, res);
    }
    return serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[error]', err);
    return fail(res, 500, '服务端异常：' + err.message);
  }
});

// 注册路由
ROUTES.forEach(([m, p, fn]) => register(m, p, fn));

// 以模块方式引入时不自动监听，便于进程内测试
module.exports = { dispatch, compiled, store, server, ROUTES };

if (require.main === module) {
  if (process.argv.includes('--reset')) {
    store.reset();
    console.log('数据库已重置为种子数据');
    process.exit(0);
  }

  server.listen(PORT, HOST, () => {
    const db = store.load();
    console.log('');
    console.log('  ┌───────────────────────────────────────────────┐');
    console.log('  │   员工认可激励平台 · MVP 已启动               │');
    console.log('  └───────────────────────────────────────────────┘');
    console.log(`  地址      http://localhost:${PORT}`);
    console.log(`  数据文件  ${store.DB_FILE}`);
    console.log(`  员工数    ${db.employees.length}   认可记录 ${db.recognitions.length}`);
    console.log('');
    console.log('  演示账号（密码统一 123456）');
    console.log('    员工   工号 1002  王磊（产品部）');
    console.log('    管理员 工号 1001  李静（人力资源部）');
    console.log('');
    if (auth.usingRandomSecret()) {
      console.log('  ⚠️  未设置 JWT_SECRET，本次启动使用了随机密钥：');
      console.log('      · 服务重启后所有登录态会失效（需重新登录）');
      console.log('      · 多实例部署会因各实例密钥不同而互相鉴权失败');
      console.log('      · 生产环境请务必通过环境变量 JWT_SECRET 固定配置');
      console.log('');
    }
  });
}
