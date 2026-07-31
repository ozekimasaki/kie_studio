# KIE STUDIO

[English](./README.md) | [日本語](./README.ja.md) | **中文**

基于 kie.ai Market API 和专用 workflow 的 **IMAGE / VIDEO / AUDIO** 创作工作室。既可在浏览器中运行（Vite + React），也可作为 **Electrobun 打包的单一桌面应用**（Win/mac/Linux）使用。

> **免责声明**：KIE STUDIO 是 100% 非官方的粉丝工具，与 kie.ai 无任何隶属、认可或赞助关系。所有产品名称、标志和品牌均为其各自所有者的财产。使用风险自负。

- Vite + React 19 + Tailwind CSS v4
- Hono API（Bun 运行时启动；API 密钥仅存于服务端）
- Electrobun 桌面版（原生 webview + Bun 主进程，增量自动更新）
- 集成 docs OpenAPI 与专用 workflow 的模型目录
- 参考文件上传 / 数值 / 复选框的动态表单
- Market / Suno / Veo / Runway 生成与状态的统一管理
- 历史画廊（多媒体、同步歌词、固定、复用、重试、JSON 导入/导出）
- 对话与旁白编辑，以及跨界面持久音频播放器
- 提示词优化（Grok CLI）与代码片段
- `@引用` 插入 & Kling Elements 支持

> 代理工作指南请参阅 [AGENTS.md](./AGENTS.md)；UI/设计方针请参阅 [DESIGN.md](./DESIGN.md)。

## 环境要求

- [Bun](https://bun.sh)（`dev:server` 启动和 Electrobun 构建必需）
- Node.js（支持 Vite 8 / React 19 的近期 LTS，建议 20.19+ 或 22.12+）及 npm
- kie.ai API 密钥（<https://kie.ai/api-key>）。桌面版也可在应用内设置面板保存。
- 可选：[Grok CLI](https://docs.x.ai/build/overview)（用于提示词优化，通过 `grok login` 或 `XAI_API_KEY` 认证）

## 快速开始

```bash
cp .env.example .env
# 在 .env 中设置从 https://kie.ai/api-key 获取的密钥
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://127.0.0.1:8787（Vite 代理 `/api`）

如需使用提示词优化，请安装 [Grok CLI](https://docs.x.ai/build/overview) 并执行 `grok login`，或在 `.env` 中设置 `XAI_API_KEY`。

## 桌面应用（Electrobun）

需要 Bun。在原生 webview 中加载已构建的 UI，并在 Bun 主进程内启动 Hono API。

```bash
npm run desktop:dev            # 开发模式（electrobun run --env=dev）
npm run desktop:build:canary   # Canary 构建（vite build + electrobun build）
npm run desktop:build:stable   # Stable 构建
```

- **API 密钥**：首次启动无需 `.env`。通过右上角设置图标保存，持久化至 SQLite（存储密钥优先于环境变量）。
- **数据存储**：DB 创建在应用用户数据目录（`Utils.paths.userData` 下的 `studio.db`）。开发模式使用 `data/studio.db`。
- **分发形式**：
  - **Windows**：Inno Setup 安装包 `canary-win-x64-KIESTUDIO-Setup.exe`（首选渠道）。通过 `npm run desktop:installer:win` 生成。在"添加或删除程序"中注册图标、版本和发布者信息；附带卸载程序及开始菜单/桌面快捷方式。Per-user 安装（`%LocalAppData%\ai.kie.studio\<channel>\app`），无需管理员权限。卸载时不会删除用户 DB（`studio.db`）。
  - **Linux**：仅 tar.gz 自解压归档（`canary-linux-x64-KIESTUDIO-canary-Setup.tar.gz`）。Electrobun 原生不支持 `.deb`。
  - 自动更新产物（`tar.zst` + `update.json` + patch）照常从 `RELEASE_BASE_URL` 分发（不依赖 Inno Setup）。
- **应用图标**：`assets/icon-master.svg`（K 字母组合图案）通过 `npm run icons` 转换为 `icon.ico`（Windows，多尺寸）/ `icon.png`（Linux，512px）/ `icon.iconset`（macOS，用 iconutil 转 .icns），并在 `electrobun.config.ts` 中引用。Windows 上由 `scripts/embed-win-icon.mjs` 在构建后将图标嵌入 launcher.exe，以规避 Electrobun 的 rcedit 路径解析 bug（安装包构建时同样重新嵌入）。
- **支持架构**：
  - Windows：仅 x64。ARM Windows 通过 OS 级模拟运行 x64 版本，无需单独构建。
  - Linux：仅分发 x64。arm64 受 Electrobun 支持但无法交叉构建；待 arm64 构建环境/CI 就绪后另行处理。
- **未签名分发的系统警告**：未进行代码签名或公证。
  - macOS：首次右键 → "打开"，或在"系统设置 > 隐私与安全性"中允许。
  - Windows：SmartScreen → "更多信息" → "仍要运行"。
  - Linux：授予执行权限。
- **自动更新**：将 `RELEASE_BASE_URL` 设为静态托管地址即可启用启动时增量更新（bsdiff + zstd）。未设置时静默跳过。日常测试用 `canary`，正式发布用 `stable` 频道。
- 各 OS 构建须在对应 OS 上执行（不支持交叉构建）。CI 示例：`.github/workflows/release.yml`（tag push 触发 3 OS 矩阵构建，发布至 GitHub Releases）。

## 模型目录同步

`npm run dev` 启动时，若目录过期（默认：超过 12 小时）则自动从 docs 同步。

- 目录新鲜则跳过（`tsx watch` 重启不会每次全量同步）
- 强制同步：`SYNC_MODELS_FORCE=1 npm run dev` 或 `npm run sync:models -- --force`
- 禁用启动同步：`SYNC_MODELS_ON_START=0`

手动同步：

```bash
npm run sync:models
npm run sync:models -- --force
```

从 [llms.txt](https://docs.kie.ai/llms.txt) 和各模型页面的 OpenAPI 重新生成 `src/data/catalog.json`。

## 主要功能

| 功能 | 说明 |
|------|------|
| 动态表单 | 根据目录 OpenAPI schema 生成字段 |
| 参考文件 | 图片/视频/音频上传；单个 `image_url` 也使用文件附加 UI |
| `@引用` | 在提示词中插入参考提及（Seedance / Kling 等） |
| Provider 统一任务 | Market / Suno / Veo / Runway 的生成、轮询和错误标准化 |
| AUDIO workflow | Suno 歌曲、延长、翻唱、歌词、旁白、对话、音频处理 |
| 音频播放 | 持久迷你播放器、波形、同步歌词、Persona 与外部音频素材架 |
| 历史记录 | SQLite 存储；多媒体、父子关系、固定、输入恢复、重试、ZIP/JSON 导出 |
| 提示词优化 | 通过 Grok CLI 进行 optimize / generate，支持按模型配置 |
| 代码片段 | 一键插入常用短语 |
| 批量生成 | 以相同输入提交多个任务 |

## 本地 API 端点

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/health` | 健康检查 & API 密钥状态 |
| GET | `/api/models?category=image\|video\|audio` | Market 目录 + 专用 workflow |
| POST | `/api/upload` | 转发至 File Upload API；音频注册到素材架 |
| GET | `/api/audio-assets` | 列出外部音频素材 |
| DELETE | `/api/audio-assets/:id` | 删除外部音频素材 |
| POST | `/api/generate` | 通过 provider / operation adapter 创建任务 |
| GET | `/api/task?provider=&operation=&taskId=` | 将各 provider 状态标准化为通用格式 |
| GET | `/api/credits` | 剩余积分 |
| POST | `/api/download-url` | 临时下载 URL（20 分钟） |
| POST | `/api/archive` | 将多媒体 + 歌词导出为 ZIP |
| POST | `/api/suno/timestamped-lyrics` | 获取同步歌词 & 波形数据 |
| POST | `/api/suno/style` | 辅助 Suno 音乐风格 |
| POST | `/api/suno/persona` | 创建 & 保存 Persona |
| GET | `/api/personas` | 列出 Persona 素材架 |
| DELETE | `/api/personas/:id` | 删除 Persona |
| GET | `/api/grok/status` | Grok CLI 可用性 |
| GET | `/api/optimize-profile?modelId=` | 按模型的优化配置 |
| POST | `/api/optimize-prompt` | 提示词优化 / 生成 |
| GET | `/api/history` | 历史列表（SQLite） |
| PUT | `/api/history` | 批量替换历史 |
| POST | `/api/history/import` | 从 JSON 导入历史 |
| POST | `/api/history/migrate` | 迁移旧 localStorage 历史 |
| GET | `/api/settings` | API 密钥保存状态 & 脱敏显示 |
| PUT | `/api/settings/api-key` | 保存 API 密钥（持久化至 SQLite） |
| DELETE | `/api/settings/api-key` | 删除已保存的 API 密钥 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `KIE_API_KEY` | 可选。kie.ai API 密钥（桌面版可通过设置保存；存储密钥优先） |
| `PORT` | API 端口（默认 `8787`） |
| `STUDIO_DB_PATH` | 可选。覆盖 SQLite 路径（桌面版自动设置；开发用 `data/studio.db`） |
| `RELEASE_BASE_URL` | 可选。Electrobun 自动更新的静态托管 URL（留空禁用） |
| `XAI_API_KEY` | 可选。Grok CLI 未登录时的认证 |
| `SYNC_MODELS_ON_START` | `0` 禁用启动同步（默认开启） |
| `SYNC_MODELS_FORCE` | `1` 启动时强制全量同步 |
| `SYNC_CONCURRENCY` | 模型页面抓取并发数（默认 `12`，最大 32） |

## 脚本命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动 API + Web（`dev:server` + `dev:web`） |
| `npm run dev:server` | 仅 Hono API（`bun --watch server/index.ts`） |
| `npm run dev:web` | 仅 Vite 开发服务器 |
| `npm run desktop:dev` | 开发模式启动 Electrobun 桌面（`electrobun run --env=dev`） |
| `npm run desktop:build:canary` | Canary 桌面构建（`vite build` + `electrobun build`） |
| `npm run desktop:build:stable` | Stable 桌面构建 |
| `npm run desktop:package:canary` | 重新打包 canary（跳过 `vite build`；图标生成 + `electrobun build` + `release/` 收集） |
| `npm run desktop:package:stable` | 重新打包 stable |
| `npm run desktop:installer:win` | 生成 Windows Inno Setup 安装包（需要 Inno Setup 6，输出至 `release/`） |
| `npm run icons` | 从 `assets/icon-master.svg` 生成 `icon.ico` / `icon.png` / `icon.iconset` |
| `npm run build` | 类型检查（`tsc -b`）+ 生产构建 |
| `npm run preview` | 预览构建产物 |
| `npm run lint` | oxlint |
| `npm test` | 运行一次 Vitest |
| `npm run test:watch` | Vitest watch 模式 |
| `npm run sync:models` | 手动目录同步 |

仅类型检查：`npx tsc -b`（包含在 `npm run build` 中）。

## 项目结构

```text
src/            # 前端（Vite + React 19 + Tailwind v4）
  App.tsx       # 编排表单、队列、历史、轮询、Quick Action
  components/   # UI（audio/ · shell/ · motion/，SettingsSheet 等）
  lib/          # API、历史、队列、校验、媒体、models
  bun/          # Electrobun 主进程（index.ts: Bun.serve + BrowserWindow）
  data/catalog.json  # 同步重新生成的模型目录
server/         # Hono API（Bun 运行时，127.0.0.1:8787）
  app.ts        # createApp（CORS、onError、路由注册）
  index.ts      # 开发入口（Bun.serve 启动、启动时目录同步）
  routes/       # HTTP 边界（generate / task / Suno / archive / history / settings 等）
  kie/adapters/ # Market / Suno / Veo / Runway 标准化
  settings/     # API 密钥获取（持久存储 → 环境变量回退）
  db/           # bun:sqlite（历史、Persona、音频素材、app_settings）
  grok/         # Grok CLI 集成（提示词优化）
  catalog/      # docs OpenAPI + 专用 workflow 集成
electrobun.config.ts    # Electrobun 构建与分发配置（含 win/linux 图标路径）
assets/icon-master.svg  # 应用图标矢量母版（→ icon.ico / icon.png）
installer/win/kie-studio.iss   # Inno Setup 安装包定义（ARP、卸载程序、快捷方式）
scripts/build-icons.mjs        # icon-master.svg → icon.ico / icon.png（sharp + png-to-ico）
scripts/embed-win-icon.mjs     # 构建后图标嵌入 launcher.exe + tar.zst 重新打包
scripts/build-win-installer.mjs # tar.zst 解压 → 图标嵌入 → Inno Setup 编译
scripts/collect-release.mjs    # 将构建产物收集到持久 release/ 目录
scripts/sync-models.ts  # 目录同步 CLI
.github/workflows/release.yml  # 3 OS 矩阵构建 + Releases 发布
.indexion/wiki/         # 项目知识库（indexion wiki）
```

## 注意事项

- 上传文件为临时存储（根据文档，短期内删除）
- 生成的媒体约 14 天后删除（画廊中显示剩余天数）。如需保留请尽早下载。
- 支持的 provider / operation 仅限目录中定义的 workflow
- 代理工作备注请参阅 [AGENTS.md](./AGENTS.md)

## 许可证

**All Rights Reserved.** © 2025 KIE STUDIO contributors.

本项目为非官方私人粉丝工具。未经作者事先书面许可，禁止复制、修改、再分发本仓库的代码及资源，或将其用于商业用途。详见 [LICENSE](./LICENSE)。`package.json` 设为 `private: true`，npm publish 已禁用。
