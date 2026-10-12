"""MVP 界面截图脚本。
因沙箱拦截 HTTP POST，登录流程无法走网络；这里改为把有效 token 预注入 localStorage，
直接以已登录状态截图各个页面（页面内导航均为前端路由，不触发 POST）。

用法: python shots.py [base_url]
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3010"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
os.makedirs(OUT, exist_ok=True)

EMP_TOKEN = os.environ.get("EMP_TOKEN", "")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")


def shoot(page, name, wait=1400):
    page.wait_for_timeout(wait)
    page.screenshot(path=os.path.join(OUT, name + ".png"), full_page=True)
    print("  shot:", name)


def click(page, selector, wait=1200):
    page.click(selector)
    page.wait_for_timeout(wait)


def run(pw, token, prefix, screens):
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 430, "height": 900}, device_scale_factor=2)
    ctx.add_init_script(f"localStorage.setItem('er_token', {token!r})")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type == "error" else None)

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1500)

    for name, steps in screens:
        try:
            for sel in steps:
                click(page, sel)
            shoot(page, prefix + name)
        except Exception as e:
            print(f"  FAIL {name}: {e}")
        # 回到导航起点
        try:
            click(page, '.tab-item[data-screen="home"]', 900)
        except Exception:
            pass

    browser.close()
    return errors


SCREENS_EMP = [
    ("01-首页", []),
    ("02-收到认可", ['.tab-item[data-screen="recognize"]']),
    ("03-给予认可", ['.tab-item[data-screen="recognize"]', '.tab[data-tab="give"]']),
    ("04-排行榜", ['.tab-item[data-screen="rank"]']),
    ("05-积分商城", ['.tab-item[data-screen="mall"]']),
    ("06-我的", ['.tab-item[data-screen="me"]']),
    ("07-我的记录", ['.tab-item[data-screen="me"]', '.entry[data-screen="records"]']),
    ("08-月度之星", ['.tab-item[data-screen="me"]', '.entry[data-screen="vote"]']),
    ("09-生日祝福", ['.tab-item[data-screen="me"]', '.entry[data-screen="birthday"]']),
]

SCREENS_ADMIN = [
    ("10-管理后台", ['.tab-item[data-screen="me"]', '.entry[data-screen="admin"]']),
]


def main():
    if not EMP_TOKEN:
        print("缺少 EMP_TOKEN 环境变量")
        return 1
    with sync_playwright() as pw:
        errs = run(pw, EMP_TOKEN, "", SCREENS_EMP)
        if ADMIN_TOKEN:
            errs += run(pw, ADMIN_TOKEN, "", SCREENS_ADMIN)
        if errs:
            print("\n页面错误：")
            for e in errs[:20]:
                print("  -", e)
        else:
            print("\n无 JS 运行时错误")
    print("\n输出目录：", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
