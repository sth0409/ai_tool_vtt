# AI Tool VTT (Cloudflare Workers)

一个基于 Cloudflare Workers 的字幕工具站，提供两条核心能力：

- 视频/音频转录为 `VTT`（含时间戳、可词级拖拽纠错）
- 字幕高亮编辑并导出 `ASS`（支持 AI 选词+翻译、预览调参、一键工具包）

---

## 项目架构

项目采用**单 Worker + 内嵌双页面字符串**的结构：

- `src/worker.ts`
  - HTTP 路由分发（页面路由 + API 路由 + 静态代理）
  - Cloudflare Workers AI 调用（Whisper 转录、GPT 分析）
  - 请求校验、错误处理、结果归一化
- `src/pages.ts`
  - `EXTRACT_PAGE`：转录页（`/`）
  - `ASS_PAGE`：ASS 高亮页（`/ass`）
  - 页面脚本全部内联，直接调用 Worker API
- `wrangler.toml`
  - Worker 入口、兼容日期、AI 绑定配置

### 逻辑分层

1. **UI 层（浏览器）**
   - 文件选择/拖拽、字幕编辑、样式预览、下载
2. **Worker API 层**
   - 参数校验、模型调用、返回标准 JSON
3. **AI 能力层（Cloudflare AI Binding）**
   - 转录模型：`@cf/openai/whisper-large-v3-turbo`
   - 文本分析模型：`@cf/openai/gpt-oss-120b`

---

## 路由与接口

### 页面路由

- `GET /`：VTT 转录与分段纠错页面
- `GET /ass`：ASS 高亮制作页面

### API 路由

- `POST /api/transcribe`
  - 入参：`multipart/form-data`，字段 `file`（视频或音频）
  - 限制：最大 `50MB`
  - 调用：`env.AI.run("@cf/openai/whisper-large-v3-turbo", { audio, task: "transcribe" })`
  - 出参：`vtt`、`text`、`segments`、`transcription_info`

- `POST /api/ass/ai-analyze`
  - 入参：`application/json`
  - 结构：`{ texts: [{ lineNumber, text }], debug }`
  - 调用：`@cf/openai/gpt-oss-120b`，按行做“翻译 + 选词 + 句式”分析
  - 出参：`result[]`（含 `zh/hvc/collocations/sentence_patterns`）与可选调试信息

### 静态代理路由

- `/vendor/ffmpeg/*`
- `/vendor/ffmpeg-util/*`
- `/vendor/ffmpeg-core/*`

Worker 会代理到 jsDelivr，对 ffmpeg 相关资源加缓存头，供前端 wasm 转码使用。

---

## 业务流程

### 1) VTT 转录流程（`/`）

1. 用户上传视频/音频（可选“上传前先转小音频”）
2. 前端必要时使用 ffmpeg.wasm 转成小体积 mp3（16kHz 单声道）
3. 前端请求 `POST /api/transcribe`
4. Worker 校验文件类型/大小并调用 Whisper
5. 返回 `VTT/Text/Segments` 到页面展示
6. 用户可在 Segments 中拖拽词，前端重算句子时间并同步输出

### 2) ASS 高亮流程（`/ass`）

1. 用户粘贴字幕块（时间轴 + 文本）
2. 点击“高亮编辑操作”生成可交互预处理文案
3. （可选）点击“AI 智能选词+翻译”逐行调用 `POST /api/ass/ai-analyze`
4. 用户按配置绑定高亮词（支持多配置、冲突优先级）
5. 在视频预览区调整字号、边框、透明度、Y 轴位置、双语显示
6. 生成 `ASS` 与 ffmpeg 命令，支持下载 `.ass` 与一键工具包 zip

---

## 核心功能清单

### 转录页（VTT）

- 拖拽上传视频/音频，自动文件状态提示
- 超大文件前端转码压缩（ffmpeg.wasm）
- 转录失败重试（带指数退避逻辑）
- 输出 `VTT`、`Text`
- `Segments` 词级拖拽纠错并回写 VTT

### ASS 页（高亮）

- 解析字幕块格式（`[编号] 可选 + 时间轴 + 文本`）
- 高亮配置管理（颜色、名称）
- AI 逐行选词与翻译，支持单行重试与日志
- 多高亮词冲突消解（优先级 + 长词优先）
- 视频覆盖层实时预览（可拖拽字幕位置）
- 导出 ASS、ffmpeg 命令、`ass_toolkit.zip`

---

## 本地开发

```bash
npm install
npm run dev
```

打开 Wrangler 输出的本地地址：

- `http://127.0.0.1:8787/`（VTT 页面）
- `http://127.0.0.1:8787/ass`（ASS 页面）

---

## 部署到 Cloudflare

1. 登录 Cloudflare

```bash
npx wrangler login
```

2. 部署

```bash
npm run deploy
```

---

## 运行与配置说明

`wrangler.toml` 已包含 AI 绑定：

```toml
[ai]
binding = "AI"
```

Worker 通过 `env.AI.run(...)` 调用模型；无需额外后端服务或数据库。

---

## 已知限制

- 单次上传限制为 `50MB`
- 当前页面脚本集中在 `src/pages.ts`（后续可按模块拆分）
- AI 结果受模型输出波动影响，已做 JSON 解析与兜底，但仍建议人工复核
