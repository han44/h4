from playwright.sync_api import sync_playwright

BASE = "https://employee-recognition.app.workbuddy.host"

JS = """
async () => {
  const out = {};
  // 1. 多次 health，看 pid / secretFp 是否变化（判断多实例）
  const healths = [];
  for (let i = 0; i < 8; i++) {
    const r = await fetch('/api/health?i=' + i);
    const j = await r.json();
    healths.push({pid: j.data.pid, fp: j.data.secretFp, node: j.data.node, started: j.data.startedAt});
  }
  out.healths = healths;
  out.uniquePids = [...new Set(healths.map(h => h.pid))];
  out.uniqueFps  = [...new Set(healths.map(h => h.fp))];
  out.uniqueStarted = [...new Set(healths.map(h => h.started))];

  // 2. 登录拿 token
  const lr = await fetch('/api/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({no:'1002',password:'123456'})});
  const lj = await lr.json();
  const t = lj.data && lj.data.token;
  out.loginOk = lj.ok;

  // 3. 带 token 请求诊断端点
  const dr = await fetch('/api/_diag', {headers:{Authorization:'Bearer '+t}});
  out.diagStatus = dr.status;
  out.diag = (await dr.json()).data;

  // 4. 连续 10 次 dashboard，统计成功率
  let succ = 0, codes = [];
  for (let i = 0; i < 10; i++) {
    const r = await fetch('/api/dashboard', {headers:{Authorization:'Bearer '+t}});
    codes.push(r.status);
    if (r.status === 200) succ++;
  }
  out.dashCodes = codes;
  out.dashSuccess = succ;
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto(BASE, wait_until="domcontentloaded", timeout=60000)
    r = pg.evaluate(JS)
    for k, v in r.items():
        print(f"{k}: {v}")
    b.close()
