# AI Tool VTT (Cloudflare Workers)

上传视频文件，调用 Cloudflare Workers AI 的 `@cf/openai/whisper-large-v3-turbo`，返回并展示带时间戳的 VTT 字幕。

## 本地开发

```bash
npm install
npm run dev
```

打开 Wrangler 输出的本地地址即可使用页面。

## 部署到 Cloudflare

1. 登录 Cloudflare：
   ```bash
   npx wrangler login
   ```
2. 部署：
   ```bash
   npm run deploy
   ```

## 绑定说明

`wrangler.toml` 里已配置：

```toml
[[ai]]
binding = "AI"
```

Worker 内通过 `env.AI.run("@cf/openai/whisper-large-v3-turbo", ...)` 调用模型。
