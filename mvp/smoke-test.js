'use strict';
/**
 * 自检脚本
 *   进程内模式（默认，不需要网络）：node smoke-test.js
 *   HTTP 模式（部署后远程验证）  ：node smoke-test.js --http http://localhost:3010
 *
 * 覆盖：认证、仪表盘、认可收发、排行榜、积分商城、投票、生日祝福、管理后台、静态资源。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const HTTP_MODE = process.argv.includes('--http');
const BASE = HTTP_MODE ? process.argv[process.argv.indexOf('--http') + 1] : null;

if (!HTTP_MODE && !process.env.DB_FILE) {
  // 进程内模式使用独立临时库，避免污染开发数据
  const tmp = path.join(os.tmpdir(), 'mvp-selfcheck-db.json');
  try {
    fs.unlinkSync(tmp);
  } catch (_) {}
  process.env.DB_FILE = tmp;
}

let dispatch = null;
if (!HTTP_MODE) {
  ({ dispatch } = require('./server'));
}

let pass = 0;
let fail = 0;

/* ------------------------- 请求适配层 ------------------------- */

async function httpCall(method, urlPath, { token, body } = {}) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json();
  return { status: res.status, ...j };
}

async function inProcessCall(method, urlPath, { token, body, query, cookie, authHeader } = {}) {
  const matched = dispatch(method, urlPath.split('?')[0]);
  if (!matched) return { status: 404, ok: false, message: `无匹配路由 ${method} ${urlPath}` };
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (authHeader !== undefined) headers.authorization = authHeader; // 用于模拟被网关覆盖的头
  if (cookie) headers.cookie = cookie;
  const req = {
    method,
    params: matched.params,
    query: query || {},
    body: body || {},
    headers,
  };
  let out = null;
  let status = 200;
  const headers_out = {};
  const res = {
    writeHead(s) {
      if (typeof s === 'number') status = s;
    },
    setHeader(k, v) {
      headers_out[k] = v;
    },
    getHeader(k) {
      return headers_out[k];
    },
    end(buf) {
      const s = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf);
      try {
        out = JSON.parse(s);
      } catch (_) {
        out = { raw: s };
      }
    },
  };
  try {
    await matched.fn(req, res);
  } catch (e) {
    return { status: 500, ok: false, message: e.message, setCookie: headers_out['Set-Cookie'] };
  }
  return { status, ...(out || {}), setCookie: headers_out['Set-Cookie'] };
}

const api = HTTP_MODE ? httpCall : inProcessCall;

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''}`);
  }
}

/* ------------------------- 测试用例 ------------------------- */

(async () => {
  console.log(`\n自检模式：${HTTP_MODE ? 'HTTP ' + BASE : '进程内（无网络）'}\n`);

  console.log('[1] 健康检查');
  const health = await api('GET', '/api/health');
  check('服务可用且已载入员工', health.ok && health.data.employees > 0, health.data);

  console.log('[2] 认证');
  const bad = await api('POST', '/api/auth/login', { body: { no: '1002', password: 'wrong' } });
  check('错误密码被拒绝(401)', bad.status === 401, bad.message);

  const emp = await api('POST', '/api/auth/login', { body: { no: '1002', password: '123456' } });
  check('员工登录成功并返回 token', emp.ok && !!emp.data.token, emp.message || '');
  const T = emp.data && emp.data.token;

  const adm = await api('POST', '/api/auth/login', { body: { no: '1001', password: '123456' } });
  check('管理员登录成功', adm.ok && adm.data.employee.role === 'admin');
  const TA = adm.data && adm.data.token;

  const noAuth = await api('GET', '/api/dashboard');
  check('无 token 访问受保护接口被拒绝(401)', noAuth.status === 401);

  // —— 部署环境专项：网关可能覆盖 Authorization 头，业务凭证须靠 Cookie 兜底 ——
  check('登录响应下发会话 Cookie', !!emp.setCookie && String(emp.setCookie).includes('er_token='), emp.setCookie);
  const cookieToken = String(emp.setCookie || '').match(/er_token=([^;]+)/);
  const C = cookieToken ? cookieToken[1] : '';
  const byCookie = await api('GET', '/api/dashboard', { cookie: `er_token=${C}` });
  check('仅凭 Cookie 即可访问受保护接口', byCookie.ok && byCookie.status === 200, byCookie.message);

  const fakeJwt = 'aaa.bbb.ccc'; // 三段式，模拟网关注入的平台 JWT
  const hijacked = await api('GET', '/api/dashboard', { authHeader: `Bearer ${fakeJwt}` });
  check('三段式外来 JWT 被忽略(401)', hijacked.status === 401, hijacked.message);

  const mixed = await api('GET', '/api/dashboard', { cookie: `er_token=${C}`, authHeader: `Bearer ${fakeJwt}` });
  check('Authorization 被覆盖时仍以 Cookie 为准', mixed.ok && mixed.status === 200, mixed.message);

  const loggedOut = await api('POST', '/api/auth/logout');
  check('登出会清除会话 Cookie', !!loggedOut.setCookie && /er_token=;/.test(String(loggedOut.setCookie)), loggedOut.setCookie);

  console.log('[3] 仪表盘');
  const dash = await api('GET', '/api/dashboard', { token: T });
  check('返回积分与排名', dash.ok && typeof dash.data.stats.points === 'number' && dash.data.stats.rank > 0, dash.data && dash.data.stats);
  check('近 6 个月趋势含 6 个点', dash.ok && dash.data.trend.length === 6);

  console.log('[4] 员工列表');
  const emps = await api('GET', '/api/employees', { token: T });
  check('同事列表不含自己', emps.ok && emps.data.employees.length > 0 && !emps.data.employees.some((e) => e.id === 'e002'));

  console.log('[5] 发放认可');
  const selfRec = await api('POST', '/api/recognitions', { token: T, body: { toId: 'e002', tag: '团队协作', message: '给自己的测试', points: 50 } });
  check('不能给自己发认可(400)', selfRec.status === 400, selfRec.message);

  const overMax = await api('POST', '/api/recognitions', { token: T, body: { toId: 'e004', tag: '团队协作', message: '超出上限的测试', points: 9999 } });
  check('超出单次上限被拒绝(400)', overMax.status === 400, overMax.message);

  const shortMsg = await api('POST', '/api/recognitions', { token: T, body: { toId: 'e004', tag: '团队协作', message: '短', points: 50 } });
  check('理由过短被拒绝(400)', shortMsg.status === 400, shortMsg.message);

  const before = dash.data.stats.giveable;
  const created = await api('POST', '/api/recognitions', { token: T, body: { toId: 'e004', tag: '专业敬业', message: '自检脚本发放的一笔认可', points: 80 } });
  check('发放认可成功', created.ok && !!created.data.recognition.id, created.message);
  check('可发放积分正确扣减', created.ok && created.data.giveable === before - 80, { before, after: created.data && created.data.giveable });

  console.log('[6] 收到 / 发出认可');
  const inbox = await api('GET', '/api/recognitions/received', { token: T });
  check('收件箱非空', inbox.ok && inbox.data.list.length > 0);
  const readAll = await api('POST', '/api/recognitions/read-all', { token: T });
  check('全部标记已读', readAll.ok);
  const inbox2 = await api('GET', '/api/recognitions/received', { token: T });
  check('已读后未读数为 0', inbox2.ok && inbox2.data.unread === 0, inbox2.data && inbox2.data.unread);
  const sent = await api('GET', '/api/recognitions/sent', { token: T });
  check('发出的认可含新建记录', sent.ok && sent.data.list.some((r) => r.id === created.data.recognition.id));

  console.log('[7] 排行榜');
  const board = await api('GET', '/api/leaderboard', { token: T, query: { scope: 'all' } });
  check('全员榜有序且含我', board.ok && board.data.board.length > 0 && !!board.data.me);
  check('榜首积分不低于榜尾', board.ok && board.data.board[0].receivedPoints >= board.data.board[board.data.board.length - 1].receivedPoints);
  const dept = await api('GET', '/api/leaderboard', { token: T, query: { scope: 'dept' } });
  check('部门榜仅含本部门', dept.ok && dept.data.board.every((e) => e.dept === '产品部'), dept.data && dept.data.board.map((e) => e.dept));

  console.log('[8] 积分商城');
  const rewards = await api('GET', '/api/rewards', { token: T });
  check('商品列表非空', rewards.ok && rewards.data.rewards.length > 0);
  const cheap = rewards.data.rewards.find((r) => r.cost <= rewards.data.points);
  check('存在可兑换商品（积分充足）', !!cheap, { points: rewards.data.points });
  if (cheap) {
    const ptsBefore = rewards.data.points;
    const rd = await api('POST', `/api/rewards/${cheap.id}/redeem`, { token: T });
    check(`兑换「${cheap.name}」成功`, rd.ok && !!rd.data.redemption.id, rd.message);
    check('兑换后积分扣减正确', rd.ok && rd.data.points === ptsBefore - cheap.cost, { ptsBefore, cost: cheap.cost, after: rd.data && rd.data.points });
    const stockAfter = await api('GET', '/api/rewards', { token: T });
    const s2 = stockAfter.data.rewards.find((r) => r.id === cheap.id);
    check('库存已扣减', s2.stock === cheap.stock - 1, { before: cheap.stock, after: s2.stock });
  }
  const myRd = await api('GET', '/api/redemptions/mine', { token: T });
  check('兑换记录可查询', myRd.ok && myRd.data.list.length > 0);

  console.log('[9] 月度之星投票');
  const vote = await api('GET', '/api/vote/current', { token: T });
  check('返回进行中的投票', vote.ok && vote.data.vote && vote.data.vote.candidates.length > 0);
  const c0 = vote.data.vote.candidates[0];
  const v1 = await api('POST', `/api/vote/${vote.data.vote.id}/vote`, { token: T, body: { candidateId: c0.id } });
  check('投票成功', v1.ok, v1.message);
  const vote2 = await api('GET', '/api/vote/current', { token: T });
  check('我的投票被记录', vote2.ok && vote2.data.vote.myCandidateId === c0.id);

  // 换一个员工投票，验证多用户计票
  const other = await api('POST', '/api/auth/login', { body: { no: '1003', password: '123456' } });
  await api('POST', `/api/vote/${vote.data.vote.id}/vote`, { token: other.data.token, body: { candidateId: c0.id } });
  const vote3 = await api('GET', '/api/vote/current', { token: T });
  check('多人投票正确累加', vote3.ok && vote3.data.vote.totalVotes === 2, vote3.data && vote3.data.vote.totalVotes);

  const c1 = vote.data.vote.candidates[1];
  await api('POST', `/api/vote/${vote.data.vote.id}/vote`, { token: T, body: { candidateId: c1.id } });
  const vote4 = await api('GET', '/api/vote/current', { token: T });
  check('改票后总票数不重复累加', vote4.ok && vote4.data.vote.totalVotes === 2, vote4.data && vote4.data.vote.totalVotes);
  check('改票后我的选择已更新', vote4.ok && vote4.data.vote.myCandidateId === c1.id);

  console.log('[10] 生日祝福');
  const bd = await api('GET', '/api/birthdays', { token: T });
  check('返回本月寿星列表', bd.ok && Array.isArray(bd.data.list));
  check('本月寿星都有生日字段', bd.ok && bd.data.list.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.birthday)));
  if (bd.data.list.length) {
    const target = bd.data.list.find((b) => !b.isMe);
    if (target) {
      const b1 = await api('POST', `/api/birthdays/${target.id}/bless`, { token: T, body: { message: '生日快乐！' } });
      check(`向 ${target.name} 送祝福成功`, b1.ok, b1.message);
      const bd2 = await api('GET', '/api/birthdays', { token: T });
      const t2 = bd2.data.list.find((b) => b.id === target.id);
      check('祝福已标记且不重复计数', t2 && t2.blessedByMe && t2.blessingCount === target.blessingCount + 1, t2);
    } else {
      check('存在可祝福的同事', false);
    }
  }

  console.log('[11] 管理后台');
  const noPerm = await api('GET', '/api/admin/overview', { token: T });
  check('普通员工访问后台被拒绝(403)', noPerm.status === 403);
  const ov = await api('GET', '/api/admin/overview', { token: TA });
  check('管理员可查看概览', ov.ok && ov.data.headcount > 0 && ov.data.deptStats.length > 0, ov.message);
  check('概览含价值观分布', ov.ok && ov.data.tagStats.length > 0);
  const adEmp = await api('GET', '/api/admin/employees', { token: TA });
  check('管理员可查看员工列表', adEmp.ok && adEmp.data.employees.length > 0);
  check('员工列表不含密码哈希', adEmp.ok && adEmp.data.employees.every((e) => e.passwordHash === undefined));
  const before4 = adEmp.data.employees.find((e) => e.id === 'e004');
  const grant = await api('POST', '/api/admin/grant', { token: TA, body: { employeeId: 'e004', points: 500, reason: '自检发放' } });
  check('管理员发放积分成功', grant.ok && grant.data.employee.giveable === before4.giveable + 500, grant.data && grant.data.employee.giveable);
  const grantBad = await api('POST', '/api/admin/grant', { token: TA, body: { employeeId: 'e004', points: -10 } });
  check('负数积分被拒绝(400)', grantBad.status === 400);

  console.log('[12] 静态资源');
  if (HTTP_MODE) {
    const r = await fetch(BASE + '/');
    const html = await r.text();
    check('首页可访问且含挂载点', r.status === 200 && html.includes('id="app"'), r.status);
  } else {
    const p = path.join(__dirname, 'public', 'index.html');
    const exists = fs.existsSync(p);
    let hasMount = false;
    if (exists) hasMount = fs.readFileSync(p, 'utf8').includes('id="app"');
    check('public/index.html 存在且含挂载点', exists && hasMount, { exists, hasMount });
  }

  console.log(`\n结果：通过 ${pass} 项，失败 ${fail} 项\n`);
  process.exit(fail ? 1 : 0);
})().catch((err) => {
  console.error('\n自检执行异常：', err);
  process.exit(1);
});
