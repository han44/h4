# 员工认可 / 激励平台 — GitHub 开源竞品分析报告

> 分析对象：基于 GitHub 上可检索到的「员工认可 / 同行激励（Peer Recognition）」方向开源项目
> 分析目的：为 FSG 福利一体化 C 端生态（绘幸福）的员工认可激励移动端产品定位、技术选型与许可证合规提供参考
> 数据时间：2026-10-12，所有许可证与 Star 数均**直接通过 GitHub 官方 API（api.github.com）核验**；Star 数为实时值
> 关联资产：`employee-recognition/` 下的 6 屏高保真移动端原型（仪表盘 / 收到认可 / 排行榜 / 我的记录 / 投票 / 生日祝福）

---

## 〇、数据核验说明（重要）

- 本报告所有许可证字段均取自 GitHub 官方 API 返回的 `license.spdx_id`；若该字段为 `null`，表示**仓库未包含 LICENSE 文件**，即"未声明许可证"。
- ⚠️ **第三方开源镜像/榜单（如 kaiyuanbang、reporank）不可全信**：其将 Canyon Kudos 标注为 GPL-3.0，但 GitHub 官方 API 实测该仓库 `license = null`。本报告以 GitHub 原站为准。
- 个别项目（如 ECS、nunof98）在 README 中口头声明了许可证，但仓库根目录**没有标准 LICENSE 文件**，GitHub 不认定为有效开源授权，需谨慎对待。

---

## 一、结论先行（TL;DR）

1. **GitHub 上确有同类开源产品，但"移动端高保真 App"是明显空白**。Star 最高的 Meeds（291★）、Praise（42★）均为 Web / 机器人 / DAO 社区优先，原生移动端体验稀缺——这正是我们原型的方向性差异。
2. **许可证以"未声明"为主，真正宽松可商用的极少**：
   - 经 GitHub API 核验，**9 个项目中仅 4 个有明确许可证**：Meeds（LGPL-3.0）、Praise（GPL-3.0）、Open Kudos（MIT）、SosiSis（Apache-2.0）。
   - **5 个为"未声明"（license=null）**：HighFive、recognition-platform、ECS、Canyon Kudos、nunof98（后者 README 写 MIT 但无 LICENSE 文件）。
   - 即**只有 Open Kudos（MIT）与 SosiSis（Apache-2.0）可自由用于闭源商业产品**；Meeds/Praise 为 Copyleft 需谨慎；其余 5 个不可直接取用代码。
3. **我们的增量模块有辨识度**：投票、生日祝福在通用认可平台中罕见，可作为产品特色；同时"企业合规（统一开票 / 积分 / 福利一体化）"是开源项目普遍缺失、却是 FSG 核心诉求的能力。
4. **合规建议**：借鉴代码优先选 MIT / Apache-2.0 项目；GPL/LGPL 项目只参考架构与交互思路，避免并入闭源产品引发许可证传染；未声明许可证项目一律不可复用代码。

---

## 二、竞品全景（GitHub API 实测，按许可证分组）

### 2.1 宽松许可证组（可自由用于闭源商业产品）

| # | 项目 | 仓库 | Star | 技术栈 | 形态 | 许可证 |
|---|------|------|------|--------|------|--------|
| 1 | **Open Kudos** | Pagepro/open-kudos | 18 | Express + TypeScript + MongoDB | Slack 机器人 + Web 看板 | **MIT** |
| 2 | **Employee-recognition-system** | SosiSis/Employee-recognition-system | 0 | MERN (React/Node/MongoDB) | 全栈 Web | **Apache-2.0** |

### 2.2 强 / 弱 Copyleft 组（GPL / LGPL，商业分发需谨慎）

| # | 项目 | 仓库 | Star | 技术栈 | 形态 | 许可证 |
|---|------|------|------|--------|------|--------|
| 3 | **Meeds** | Meeds-io/meeds | 291 | Java + Vue/Vuetify | Web + PWA 移动集成 | **LGPL-3.0** |
| 4 | **Praise** | givepraise/praise | 42 | TypeScript | Discord 机器人 + Web | **GPL-3.0** |

### 2.3 未声明许可证组（license=null，默认保留所有权利，**不可直接复用代码**）

| # | 项目 | 仓库 | Star | 技术栈 | 形态 | 许可证 |
|---|------|------|------|--------|------|--------|
| 5 | **HighFive** | binduprakash/HighFive-Employee-Recognition-App | 5 | React + Ruby on Rails | Web + Slack | **未声明 (null)** |
| 6 | **recognition-platform** | jlee0425/recognition-platform | 0 | NestJS + Next.js + MySQL | 全栈 POC | **未声明 (null)** |
| 7 | **ECS Employee Recognition Program** | MahmoudAbdelkhaleq/ECS_Employee_Recognition_Program | —（API 异常） | Django | Web 后台 | **未声明 (null)** |
| 8 | **Canyon Kudos** | canyon-labs-tools/canyon-kudos | 0 | 静态 HTML | 浏览器 / 大屏 | **未声明 (null)** |
| 9 | **high-five-recognition-system** | nunof98/high-five-recognition-system | 0 | Python / Streamlit | QR 码 Web | **README 标 MIT，但无 LICENSE 文件 (null)** |

> ⚠️ **"未声明许可证" ≠ 开源**。GitHub 上未附 LICENSE 文件的仓库，默认适用版权法"保留所有权利"，无权复制、修改或再分发其代码，仅可作"产品思路 / 交互借鉴"的参考。
> 注：Canyon Kudos 第三方镜像误标 GPL-3.0，GitHub 官方 API 实测为 null；nunof98 在 README 自称 MIT，但仓库无 LICENSE 文件，GitHub 不认定为有效授权。

---

## 三、各项目详解与许可证说明（GitHub 原站核验）

### 1. Meeds — LGPL-3.0（弱 Copyleft）
- **仓库**：github.com/Meeds-io/meeds ｜ Star 291 ｜ 语言 Java ｜ 主页 meeds.io ｜ 活跃（近 1 日有提交）
- **定位**：模块化开源平台，激励、协调、奖励 Web3 社区贡献者；由 Meeds Association 维护，ERC-20 代币经济驱动。
- **核心能力**：游戏化积分、Kudos 同行认可、代币引擎、钱包、Perk 积分商城、活动流、Spaces 权限、移动端集成、API 嵌入。
- **许可证含义**：允许以"动态库调用"方式将 Meeds 用于闭源/商业产品而**不必开源自有代码**；但**对 Meeds 本身的修改必须回馈开源**。适合作为参考架构与可嵌入组件。

### 2. Praise — GPL-3.0（强 Copyleft）
- **仓库**：github.com/givepraise/praise ｜ Star 42 ｜ 语言 TypeScript ｜ 主页 givepraise.xyz
- **定位**：社区情报系统，通过同行认可与奖励促进在线社区（DAO / 加密社区）协作；Discord 机器人接入。
- **核心能力**：声誉分、奖励分发、社区情报报告、Farcaster 集成、reputation 图谱。
- **许可证含义**：任何**分发**的衍生作品（含修改后分发）必须整体以 GPL-3.0 开源；纯 SaaS/内部网络使用不触发分发义务，但若将修改后的 Praise 作为产品交付客户则会传染。借鉴其"同行认可 + 声誉"交互模型可行，直接复用代码风险高。

### 3. Open Kudos — MIT（宽松，推荐借鉴）
- **仓库**：github.com/Pagepro/open-kudos ｜ Star 18 ｜ 语言 TypeScript
- **定位**：为数字团队打造的 Slack 认可机器人，Kudos 可兑换奖品。
- **核心能力**：Slack `/kudos` 指令、余额查询、奖品列表、兑换、最高分排行榜（Web 看板路线图中）。
- **许可证含义**：可自由用于商业/闭源产品，仅需保留版权声明。**最易安全借鉴**的实现范例（尤其 Slack 集成 + 积分兑换流）。

### 4. Employee-recognition-system (SosiSis) — Apache-2.0（宽松，推荐借鉴）
- **仓库**：github.com/SosiSis/Employee-recognition-system ｜ Star 0 ｜ 语言 JavaScript
- **定位**：MERN 全栈 Web 应用，组织内奖励员工、激励绩效。
- **核心能力**：JWT 登录、给予/接收认可、积分与奖励兑换、管理员看板、参与度和趋势分析。
- **许可证含义**：比 MIT 多出显式专利授权与署名要求，对企业更友好。**可作为完整全栈架构参考**。

### 5. HighFive — 未声明 (null)
- **仓库**：github.com/binduprakash/HighFive-Employee-Recognition-App ｜ Star 5 ｜ 语言 JavaScript
- **定位**：员工认可 Web 应用，1–5 级积分 + 经理审批流 + 礼品卡/课程/慈善兑换 + Slack 集成。
- **许可证**：GitHub API `license = null`，**仓库无 LICENSE 文件，不可复用代码**。

### 6. recognition-platform — 未声明 (null)
- **仓库**：github.com/jlee0425/recognition-platform ｜ Star 0 ｜ 语言 TypeScript
- **定位**：企业级认可 POC，JWT + 8 项价值观认可 + 经理视图 + React Query 实时。
- **许可证**：GitHub API `license = null`，**仓库无 LICENSE 文件，不可复用代码**（仅作架构参考）。

### 7. ECS Employee Recognition Program — 未声明 (null)
- **仓库**：github.com/MahmoudAbdelkhaleq/ECS_Employee_Recognition_Program（注意：README 内 clone 地址有笔误 `MahmoudAbdelkhalek5o5o`，真实所有者为 `MahmoudAbdelkhaleq`）｜ 语言 Python/Django
- **定位**：Web 后台，认证 + RBAC、认可提报、实时 feed、勋章/奖励、邮件通知、报表分析、排行榜。
- **许可证**：GitHub API `license` 与 `/contents/LICENSE` 均返回 404，**仓库无 LICENSE 文件，不可复用代码**。

### 8. Canyon Kudos — 未声明 (null)【校正：第三方镜像误标 GPL-3.0】
- **仓库**：github.com/canyon-labs-tools/canyon-kudos ｜ Star 0 ｜ 语言 HTML
- **定位**：浏览器端轻量员工认可中心，将 Kudos 关联核心价值，支持 TV 大屏展示与季度抽奖。
- **许可证**：GitHub 官方 API 实测 `license = null`（第三方开源榜误标为 GPL-3.0，以原站为准）。**无 LICENSE 文件，不可复用代码**。

### 9. high-five-recognition-system (nunof98) — README 标 MIT 但无 LICENSE 文件 (null)
- **仓库**：github.com/nunof98/high-five-recognition-system ｜ Star 0 ｜ 语言 Python
- **定位**：基于 QR 码的认可系统，扫描即提交认可留言；CSV 存储、密码保护管理员看板、移动端响应式。
- **许可证**：README 自称 "MIT License"，但 GitHub API `license = null`、仓库根目录**无标准 LICENSE 文件**。法律上**不构成有效开源授权**，使用前需向作者确认或要求其补充 LICENSE 文件。

---

## 四、功能对比矩阵

评级说明：Strong（领先）/ Adequate（够用）/ Weak（有限）/ Absent（缺失）

| 能力域 | 我们的原型（FSG） | Meeds | Praise | Open Kudos | SosiSis ERS | HighFive | recognition-platform | ECS | Canyon Kudos | nunof98 |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 同行认可 | Strong | Strong | Strong | Strong | Adequate | Strong | Adequate | Adequate | Weak | Weak |
| 收到的认可 / 消息流 | Strong | Adequate | Adequate | Weak | Weak | Weak | Weak | Adequate | Weak | Weak |
| 排行榜 | Strong | Strong | Weak | Adequate | Absent | Absent | Absent | Adequate | Weak | Absent |
| 积分 / 奖励兑换 | Absent* | Strong | Weak | Adequate | Adequate | Strong | Absent | Weak | Weak | Absent |
| **移动端优先（高保真）** | **Strong** | Adequate | Absent | Weak | Weak | Absent | Weak | Absent | Weak | Weak |
| 角色权限（RBAC） | Absent* | Strong | Absent | Absent | Absent | Adequate | Adequate | Strong | Absent | Absent |
| **投票** | **Strong** | Absent | Absent | Absent | Absent | Absent | Absent | Absent | Absent | Absent |
| **生日 / 生活事件** | **Strong** | Absent | Absent | Absent | Absent | Absent | Absent | Absent | Absent | Absent |
| 数据看板 / 分析 | Strong | Strong | Adequate | Weak | Adequate | Weak | Absent | Adequate | Weak | Weak |
| 通知 | Adequate | Strong | Weak | Weak | Weak | Strong | Weak | Strong | Absent | Weak |
| 第三方集成（Slack/HR） | Absent* | Strong | Strong | Strong | Absent | Strong | Absent | Absent | Absent | Absent |

> * 标注 Absent 的模块属于本原型当前为"宣传演示稿"定位，尚未接入后端/业务系统（积分兑换、RBAC、Slack/HR 集成属后续 SP1 范围）。
> 我们的强项集中在**移动端体验、收到的认可消息流、投票、生日祝福、看板可视化**；通用平台强在**游戏化积分、Web3 代币、Slack/Discord 集成、RBAC**。

---

## 五、定位与差异化分析

### 5.1 现有开源项目的共同缺口
- **移动端体验稀缺**：仅 Meeds 提供"移动集成/PWA"，其余以 Web 后台、机器人、静态页为主。
- **企业合规能力缺失**：统一开票、积分清算、与 HR/福利系统打通、数据合规——开源项目普遍不涉及（Meeds 走 Web3 代币，与国内合规要求相悖）。
- **本土化与中文企业场景弱**：项目多为海外社区/DAO 导向，缺少中文企业组织形态（企业→部门→员工两层）、福利一体化等适配。
- **投票 / 生日等"软性认可"模块罕见**：通用平台聚焦 Kudos + 排行榜，生活事件与互动投票几乎空白。

### 5.2 我们的差异化主线
| 维度 | 我们的定位 | 与开源项目的差异 |
|------|-----------|------------------|
| 终端 | 移动优先、高保真 C 端体验 | 开源多为 Web/机器人优先 |
| 业务 | 福利一体化（积分+团险+体检+礼遇），含统一开票 | 开源无合规/开票能力 |
| 特色模块 | 投票、生日祝福、收到的认可消息流 | 通用平台罕见 |
| 组织适配 | 企业→部门→员工两层，对标 SOW | 开源偏扁平/社区 |

---

## 六、许可证合规要点（面向 FSG 产品化）

| 许可证 | 类型 | 商业闭源产品可用？ | 关键约束 |
|--------|------|:---:|----------|
| **MIT** | 宽松 | ✅ 可用 | 保留版权与许可声明 |
| **Apache-2.0** | 宽松 | ✅ 可用 | 保留声明 + 显式专利授权 + 修改说明 |
| **LGPL-3.0** | 弱 Copyleft | ⚠️ 有条件 | 可"调用/链接"用于闭源；**修改库本身须开源** |
| **GPL-3.0** | 强 Copyleft | ❌ 谨慎 | 分发衍生作品须整体 GPL 开源；SaaS 内用不触发但分发即传染 |
| **未声明 (null)** | 保留所有权利 | ❌ 不可用 | 无权复制/修改/分发，仅可借鉴思路 |
| **README 标 MIT 但无 LICENSE 文件** | 无效授权 | ❌ 不可用 | 不构成法律授权，须向作者确认或补文件 |

**行动建议**
1. 代码借鉴**仅限** MIT / Apache-2.0 项目（Open Kudos、SosiSis）。
2. GPL/LGPL 项目（Meeds、Praise）只做**架构与交互参考**，不并入闭源代码库。
3. 未声明许可证项目（HighFive、recognition-platform、ECS、Canyon Kudos）及"README 标 MIT 但无 LICENSE"（nunof98）**禁止取用代码**。
4. 若未来将本原型后端开源对外，需先明确自选型许可证（推荐 MIT 或 Apache-2.0 以吸引企业贡献）。
5. **依赖第三方开源榜单/镜像时务必回 GitHub 原站核验许可证**——本次 Canyon Kudos 即为一例误标。

---

## 七、战略启示与下一步

1. **移动端是蓝海**：以"高保真移动体验 + 中文企业福利一体化"切入，避开与 Web3/社区型开源项目的正面重叠。
2. **合规即壁垒**：把"统一开票、积分清算、组织层级、HR 同步"做成标准能力，构成开源项目难以补齐的护城河。
3. **特色模块做亮点**：投票、生日祝福、收到的认可消息流可作为宣传视频与 PRD 的差异化卖点。
4. **对标商业 SaaS**：Bonusly、Nectar、Kudos、Workhuman、Achievers 等占领企业市场（约 $2–4/人/月），开源自托管选项少且偏轻量——本原型可作为对标商业体验的演示资产。
5. **参考而非复用**：建立"开源参考库"时，按上述许可证分类归档，避免合规风险。

---

## 附：GitHub 官方 API 核验记录（2026-10-12）

| 仓库 | API 路径 | license.spdx_id | stargazers_count |
|------|----------|-----------------|------------------|
| Meeds-io/meeds | /repos/Meeds-io/meeds | LGPL-3.0 | 291 |
| givepraise/praise | /repos/givepraise/praise | GPL-3.0 | 42 |
| Pagepro/open-kudos | /repos/Pagepro/open-kudos | MIT | 18 |
| SosiSis/Employee-recognition-system | /repos/SosiSis/Employee-recognition-system | Apache-2.0 | 0 |
| binduprakash/HighFive-Employee-Recognition-App | /repos/binduprakash/HighFive-Employee-Recognition-App | null | 5 |
| jlee0425/recognition-platform | /repos/jlee0425/recognition-platform | null | 0 |
| MahmoudAbdelkhaleq/ECS_Employee_Recognition_Program | /repos/MahmoudAbdelkhaleq/ECS_Employee_Recognition_Program | null（LICENSE 404） | 未读取（API 异常） |
| canyon-labs-tools/canyon-kudos | /repos/canyon-labs-tools/canyon-kudos | null | 0 |
| nunof98/high-five-recognition-system | /repos/nunof98/high-five-recognition-system | null（README 标 MIT） | 0 |

> Star 数、许可证状态会随时间变化，产品化决策前建议二次核验仓库实时状态与 LICENSE 文件原文。
