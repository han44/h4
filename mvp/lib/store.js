'use strict';
/**
 * JSON 文件持久化层。
 * 说明：MVP 阶段用单文件写入保证"零依赖、开箱即用"；
 * 生产环境建议替换为 MongoDB / PostgreSQL，接口保持不变即可平滑迁移。
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'db.json');

let cache = null;
let writeTimer = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  if (cache) return cache;
  ensureDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
      console.error('[store] 数据库读取失败，已重置为种子数据：', err.message);
      cache = null;
    }
  }
  if (!cache) {
    cache = require('./seed')();
    // 部署环境可能只允许内存态（只读文件系统），此时降级为内存存储而非启动失败
    try {
      saveNow();
    } catch (err) {
      console.warn('[store] 数据文件不可写，已降级为内存态存储：', err.message);
    }
  }
  return cache;
}

/** 同步落盘 */
function saveNow() {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

/** 异步合并落盘，避免高频写入放大 IO */
function save() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      saveNow();
    } catch (err) {
      console.error('[store] 写入失败：', err.message);
    }
  }, 120);
}

function reset() {
  cache = require('./seed')();
  saveNow();
  return cache;
}

module.exports = { load, save, saveNow, reset, DB_FILE, DATA_DIR };
