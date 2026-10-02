---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 54638d97fd86a763069513b06a8fbb6a_1e441a63be5a11f18019525400248c00
    ReservedCode1: KKAgf1WTyjuardXXBlBIrBkkVLBO0tY7p+oOY0YA/6bRFSzfySgVi+x+yaYiL3JnNENB4tW7S+1XvD7Ffc9zhE1W823oa/MAZr5ngSLrEfHc1l6zpSmh9b/z6nQayRaJlz1ysLdiSzUJsiE155QG20cRlXQjEej/Zd8bi/8EH+xCa6OPdb2zKFMs0AA=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 54638d97fd86a763069513b06a8fbb6a_1e441a63be5a11f18019525400248c00
    ReservedCode2: KKAgf1WTyjuardXXBlBIrBkkVLBO0tY7p+oOY0YA/6bRFSzfySgVi+x+yaYiL3JnNENB4tW7S+1XvD7Ffc9zhE1W823oa/MAZr5ngSLrEfHc1l6zpSmh9b/z6nQayRaJlz1ysLdiSzUJsiE155QG20cRlXQjEej/Zd8bi/8EH+xCa6OPdb2zKFMs0AA=
---



# Mora Aurora Astro — 前端部分

> 本仓库仅包含 **Mora Aurora Astro** 占星站点的**前端静态文件**（public 目录），不含后端代码、数据库与任何敏感配置。
> 后端 Node 服务（server/）、数据库（data/）、node_modules、.git 及密钥文件均**不在此仓库**。

## 项目简介

Mora Aurora Astro 是一个全功能占星网站前端，提供欢迎门面、用户注册/登录、本命盘、合盘、个人运势、客户库、个人中心、站长后台与充值等页面，黑白极简风格，原生 JavaScript + SVG 星盘渲染。

## 目录结构

```
Mora-Aurora-Astro-frontend/
├── public/                 # 前端静态文件（可直接用浏览器打开）
│   ├── *.html              # 13 个页面
│   ├── css/style.css       # 全站样式（黑白灰阶、CSS 变量 --ink/--panel）
│   └── js/                 # 前端脚本
│       ├── config.js       # 全站集中配置（站名等）
│       ├── api.js          # 前端统一 API 客户端（同源 /api/*，不硬编码后端地址）
│       ├── auth.js         # 登录态管理
│       ├── astro.js        # 星盘计算核心（行星/宫位/相位）
│       ├── chart.js        # SVG 星盘渲染
│       ├── app.js          # 本命盘页面逻辑
│       ├── synastry.js     # 合盘页面逻辑
│       ├── personal.js     # 个人运势页面逻辑
│       ├── horoscope.js    # 通用运势页面逻辑
│       ├── customers-lib.js / customers.js  # 客户库
│       ├── admin.js        # 站长后台
│       ├── billing.js / recharge 相关      # 充值计费
│       ├── interpret.js    # 占星解读文本
│       ├── cities-cn.js / cities-henan.js  # 城市经纬度数据
│       └── theme.js / notify.js / beta-key.js  # 辅助功能
├── package.json            # 依赖声明（仅列出；启动/集成测试脚本需结合完整后端）
├── test-astro.js           # 星盘计算核心测试（纯前端，node test-astro.js 可运行）
├── test-customers.js       # 客户库页面回归测试（jsdom 自建静态服务器，端口为测试桩）
└── README.md
```

## 页面功能

| 页面 | 说明 |
|---|---|
| welcome.html | 欢迎门面页（店名 + 标语 + 欢迎进入，默认落地页） |
| login.html / register.html | 登录 / 注册（成功后落地本命盘） |
| index.html | Logo 回链内容首页 |
| natal.html | 本命盘（行星落座、宫位、相位、AI 解读） |
| synastry.html | 合盘（组合盘 / 比较盘 / 马克思盘等） |
| personal.html | 个人运势（太阳弧 / 日返 / 月返 / 行运等） |
| horoscope.html | 通用运势页 |
| customers.html | 客户库（客户档案、出生地联想选择） |
| account.html | 个人中心（资料、AI Key、充值） |
| recharge.html | 充值页面 |
| admin.html | 站长后台（用户管理、AI 配置、计费） |
| beta-key.html | 体验码兑换 |

## 主要技术

- 原生 JavaScript（无前端框架）
- SVG 星盘渲染（chart.js / synastry.js 自绘）
- 黑白极简 CSS（CSS 变量 --ink / --panel）
- CDN 引入 astronomy-engine（星历计算，见各页面 `<script>` 标签）
- Open-Meteo 地理编码 API（出生地城市搜索，公网服务）
- AI 能力统一走服务端代理（`API.ai.chat` / `API.ai.proReport`），**客户端不持有任何 AI 密钥**

## 关于后端

- 本仓库为纯静态前端，接口调用全部使用**同源相对路径** `/api/*`，不硬编码后端地址。
- 后端 Node 服务（server/）、SQLite 数据库（data/）、node_modules 与 .git **不在本仓库**。
- AI 密钥由服务端 AES-GCM 托管，前端不透传明文。
- `package.json` 中的 `start` / `dev` / `test` / `test:e2e` 脚本依赖完整后端，单独克隆本仓库无法直接运行服务；如需联调，请结合完整项目。

## GitHub Pages 发布

本仓库已配置为可直接发布到 GitHub Pages，两种方式任选其一：

**方式 a：根目录发布（推荐，仓库根即入口）**
1. 推送本仓库到 GitHub；
2. 仓库 Settings → Pages → Source 选择 **Deploy from a branch**，分支选 `main`（或默认分支），目录选 **/(root)**；
3. 启用后访问 `https://<用户名>.github.io/<仓库名>/`，根目录 `index.html` 会自动跳转到 `public/welcome.html`。
4. 仓库根目录已包含 `.nojekyll` 空文件，可阻止 Jekyll 处理，避免特殊文件名（如下划线前缀文件）被吞。

**方式 b：直接发布 public 目录**
1. 仓库 Settings → Pages → Source 选择 **Deploy from a branch**，分支选 `main`（或默认分支），目录选 **/public**；
2. 启用后访问 `https://<用户名>.github.io/<仓库名>/` 即直接打开 `welcome.html`（此方式无需根 index.html 跳转）。

> ⚠️ 注意：Pages 发布后可预览静态页面（界面、星盘渲染、导航跳转均可用），但**登录 / 星盘计算 / AI 解读 / 充值等所有 `/api/*` 功能需要部署完整后端服务后才可用**；本仓库为纯前端，不含后端。

## 本地打开

静态页面可直接用浏览器打开 `public/welcome.html` 浏览界面与交互；涉及 `/api/*` 的接口调用需后端服务支撑。

## 测试说明

- `test-astro.js`：星盘计算核心测试，不依赖后端：`node test-astro.js`。
- `test-customers.js`：客户库页面 jsdom 回归测试，使用本地静态测试桩端口（localhost:3178），不依赖真实后端。
- 后端集成测试（test-api.js / test-e2e.js）因依赖真实后端服务与数据库，已排除在本仓库之外。
*（内容由AI生成，仅供参考）*
*（内容由AI生成，仅供参考）*
