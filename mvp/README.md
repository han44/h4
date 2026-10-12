# 员工认可激励平台 · 最小可部署版本（MVP）

一个**零第三方依赖**的员工认可 / 积分激励系统。只用 Node.js 内置模块（`http` / `fs` / `path` / `crypto`），
**无需 `npm install`、无需数据库**，克隆即可运行，可直接部署到任意支持 Node 18+ 的环境。

> 代码参考 Apache-2.0 开源项目思路自研实现，未直接复用第三方源码。

---

## 一、快速启动

```bash
cd employee-recognition/mvp
node server.js
```

打开 <http://localhost:3010>

**演示账号**（密码统一 `123456`）

| 角色 | 工号 | 姓名 | 部门 | 说明 |
|------|------|------|------|------|
| 员工 | `1002` | 王磊 | 产品部 | 主演示账号，含收发记录、投票、生日数据 |
| 员工 | `1003` | 陈晓雯 | 技术部 | 可用于验证多人投票计票 |
| 管理员 | `1001` | 李静 | 人力资源部 | 可见「管理后台」入口 |

其他常用命令：

```bash
node server.js --reset     # 重置为种子数据
node smoke-test.js         # 进程内自检（不需要网络）
node smoke-test.js --http http://localhost:3010   # 部署后远程自检
PORT=8080 node server.js   # 指定端口
```

---

## 二、功能清单

| 模块 | 能力 | 状态 |
|------|------|------|
| 认证 | 工号 + 密码登录、JWT（HMAC-SHA256）、scrypt 加盐哈希、角色区分 | ✅ |
| 仪表盘 | 可兑换/可发放积分、排名、本月收发统计、近 6 月趋势、最新认可 | ✅ |
| 给予认可 | 同事检索、价值观标签、积分档位（10–200）、理由校验、额度校验 | ✅ |
| 收到认可 | 消息流、未读指示条、单条/全部已读 | ✅ |
| 我的记录 | 收到 / 发出 / 兑换 三视图 | ✅ |
| 排行榜 | 全员 / 本部门切换、三甲领奖台、我的排名高亮 | ✅ |
| 积分商城 | 6 类权益、库存扣减、积分校验、兑换记录 | ✅ |
| 月度之星 | 候选人、投票 / 改票、实时票数与百分比 | ✅ |
| 生日祝福 | 本月寿星、今日高亮、倒计时、送祝福（防重复） | ✅ |
| 管理后台 | 数据概览、部门/价值观分布、员工列表、积分发放（RBAC） | ✅ |

**业务规则**

- 每月可发放额度 `1000` 分，单次认可 `10 ~ 200` 分；发放扣减发放方额度，计入接收方可兑换余额。
- 不能给自己发认可 / 送祝福；改票覆盖原票，不重复计票。
- 管理员（role=admin）才可见并调用 `/api/admin/*`。

---

## 三、目录结构

```
mvp/
├── server.js          # HTTP 服务 + 全部 API + 静态托管（零依赖）
├── smoke-test.js      # 自检脚本（进程内 / HTTP 双模式）
├── package.json       # 无 dependencies，仅声明启动脚本
├── Dockerfile         # 容器化部署
├── lib/
│   ├── auth.js        # scrypt 密码哈希 + HMAC-SHA256 令牌
│   ├── store.js       # JSON 文件持久化（带写入合并）
│   └── seed.js        # 种子数据（按当前日期动态生成）
├── public/            # 前端（原生 JS，无构建）
│   ├── index.html     # 页面骨架 + 内联 SVG 图标（完全离线）
│   ├── styles.css     # 设计系统（沿用宣传原型 token）
│   └── app.js         # 路由 / 视图 / 交互
└── data/db.json       # 运行时自动生成（首次启动播种）
```

---

## 四、API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 token 并下发 `er_token` Cookie |
| POST | `/api/auth/logout` | 登出，清除会话 Cookie |
| GET | `/api/me` | 当前登录员工、全局设置、价值观标签（可用于探测登录态） |
| GET | `/api/health` | 健康检查（另含 pid / node / 密钥指纹，便于排查多实例） |
| GET | `/api/me` | 当前用户 + 配置 |
| GET | `/api/dashboard` | 仪表盘聚合数据 |
| GET | `/api/employees` | 同事列表（不含自己） |
| POST | `/api/recognitions` | 发放认可 |
| GET | `/api/recognitions/received` | 收到的认可 |
| GET | `/api/recognitions/sent` | 发出的认可 |
| POST | `/api/recognitions/:id/read` | 标记已读 |
| POST | `/api/recognitions/read-all` | 全部已读 |
| GET | `/api/leaderboard?scope=all\|dept` | 排行榜 |
| GET | `/api/rewards` | 商品列表 |
| POST | `/api/rewards/:id/redeem` | 兑换 |
| GET | `/api/redemptions/mine` | 我的兑换 |
| GET | `/api/vote/current` | 当前投票 |
| POST | `/api/vote/:id/vote` | 投票 / 改票 |
| GET | `/api/birthdays` | 本月寿星 |
| POST | `/api/birthdays/:employeeId/bless` | 送祝福 |
| GET | `/api/admin/overview` | 管理概览（admin） |
| GET | `/api/admin/employees` | 员工管理列表（admin） |
| POST | `/api/admin/grant` | 发放积分（admin） |
| GET | `/api/health` | 健康检查 |

鉴权：登录成功后服务端会下发会话 Cookie `er_token`（**推荐**，浏览器自动携带），同时响应体也返回 `token` 字段。

> ⚠️ 部署注意：部分平台网关会注入自己的 JWT 并覆盖 `Authorization` 头，导致业务 token 被顶掉（表现为登录后所有接口 401、页面空白）。
> 因此本项目**以 Cookie 为准**：服务端优先读取 `er_token` Cookie；若仅有 `Authorization` 头，会先校验形态——三段式 JWT 一律视为外来 token 丢弃（本项目自签为两段式 `body.sig`）。
> 若你的环境确认不会覆盖该请求头，仍可使用 `Authorization: Bearer <token>`。

---

## 五、部署

### Docker

```bash
docker build -t recognition-mvp .
docker run -d --name recognition -p 3010:3010 \
  -e JWT_SECRET=请替换为随机长字符串 \
  -v $(pwd)/data:/app/data \
  recognition-mvp
```

### 直接部署（systemd 示例）

```ini
[Unit]
Description=Employee Recognition MVP
After=network.target

[Service]
WorkingDirectory=/opt/recognition-mvp
ExecStart=/usr/bin/node server.js
Restart=always
Environment=PORT=3010
Environment=JWT_SECRET=请替换为随机长字符串
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3010` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `JWT_SECRET` | 未配置则**每次启动随机生成** | **生产必须固定配置**（见下方说明） |
| `DB_FILE` | `./data/db.json` | 数据文件路径 |

> 关于 `JWT_SECRET`：代码中不含任何固定密钥。未配置时每次启动随机生成，
> 代价是重启后登录态失效、且多实例之间会互相鉴权失败。
> 因此**生产与多实例部署必须通过环境变量显式固定**，启动时若检测到未配置会打印警告。

---

## 六、生产化改造建议

当前实现以「最小可运行、易读易改」为目标，上生产前建议按优先级处理：

1. **必须**：替换 `JWT_SECRET`；修改演示密码；加 HTTPS（Nginx 反代）。
2. **强烈建议**：`lib/store.js` 替换为 MongoDB / PostgreSQL。该文件只暴露 `load()` / `save()`，
   接口不变即可平滑迁移，业务代码零改动。
3. **建议**：令牌加入刷新机制与吊销；敏感操作（积分发放）补审计日志落库。
4. **建议**：并发写入场景替换 JSON 落盘（当前为单进程内存态 + 异步合并写，多实例部署不适用）。
5. **可选**：头像改为真实上传；积分兑换对接福利商城与统一开票能力。

---

## 七、自检

```bash
node smoke-test.js
```

覆盖 49 项断言：认证与鉴权、Cookie 凭证与外来 JWT 容错、参数校验、积分扣减、库存扣减、
投票计票与改票、祝福去重、RBAC 越权拦截、密码哈希不外泄、静态资源挂载点。

```
结果：通过 49 项，失败 0 项
```

部署后可用 HTTP 模式远程复检：

```bash
node smoke-test.js --http https://your-domain.com
```

### 线上验收（可选，需要 Playwright）

```bash
pip install playwright && playwright install chromium
python3 verify_live.py        # 默认访问 https://employee-recognition.app.workbuddy.host
BASE=https://your-domain.com python3 verify_live.py
```

脚本会真实走一遍登录，逐个校验受保护接口是否 200、逐页确认无空态、并验证刷新后保持登录。
