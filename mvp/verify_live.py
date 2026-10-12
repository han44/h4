import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "https://employee-recognition.app.workbuddy.host")
OUT = "screenshots"

APIS = [
    "/api/me", "/api/dashboard", "/api/employees",
    "/api/recognitions/received", "/api/recognitions/sent",
    "/api/leaderboard?scope=all", "/api/rewards", "/api/redemptions/mine",
    "/api/vote/current", "/api/birthdays",
]

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 420, "height": 900})
    pg = ctx.new_page()
    errs, bad = [], []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("response", lambda r: bad.append((r.status, r.request.method, r.url)) if "/api/" in r.url and r.status >= 400 else None)

    pg.goto(BASE, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(1500)
    pg.fill("#loginNo", "1002")
    pg.fill("#loginPwd", "123456")
    pg.click("button[data-action='login']")
    pg.wait_for_timeout(2500)

    print("cookie 存在:", pg.evaluate("document.cookie.includes('er_token')"))
    print("仍在登录页:", pg.query_selector(".login-card") is not None)

    print("\n=== 登录后逐个接口校验（应全 200）===")
    for a in APIS:
        code = pg.evaluate("""async (u) => {
            const r = await fetch(u, {credentials:'same-origin'});
            let len = 0;
            try { const j = await r.json(); len = JSON.stringify(j.data||{}).length; } catch(e){}
            return [r.status, len];
        }""", a)
        flag = "OK " if code[0] == 200 else "!! "
        print(f"  {flag}{code[0]}  dataLen={code[1]:<6} {a}")

    print("\n=== 逐页渲染确认 ===")
    os.makedirs(OUT, exist_ok=True)
    # 底部导航
    navs = pg.evaluate("Array.from(document.querySelectorAll('.tab-item')).map(e=>e.dataset.screen)")
    print("  底部导航:", navs)
    for s in navs:
        pg.click(f".tab-item[data-screen='{s}']")
        pg.wait_for_timeout(2000)
        t = pg.inner_text("#app").replace("\n", " ")[:90]
        print(f"  [{s}] empty={pg.query_selector('.empty') is not None} | {t}")
        pg.screenshot(path=f"{OUT}/live-{s}.png", full_page=True)

    # 首页快捷入口：投票 / 生日
    for s in ["vote", "birthday"]:
        pg.click(".tab-item[data-screen='home']")
        pg.wait_for_timeout(1800)
        el = pg.query_selector(f".quick-item[data-screen='{s}']")
        if el:
            el.click()
            pg.wait_for_timeout(2000)
            t = pg.inner_text("#app").replace("\n", " ")[:90]
            print(f"  [{s}] empty={pg.query_selector('.empty') is not None} | {t}")
            pg.screenshot(path=f"{OUT}/live-{s}.png", full_page=True)
        else:
            print(f"  [{s}] 未找到快捷入口")

    # 刷新后是否保持登录（Cookie 持久性）
    pg.reload(wait_until="domcontentloaded")
    pg.wait_for_timeout(2500)
    print("\n刷新后仍在登录页:", pg.query_selector(".login-card") is not None)

    print("\n=== 4xx/5xx 接口 ===")
    print("  无" if not bad else "")
    for s, m, u in bad:
        print(f"  {s} {m} {u.replace(BASE,'')}")
    print("=== JS 错误 ===", "无" if not errs else "")
    for e in errs:
        print("  ", e)
    b.close()
