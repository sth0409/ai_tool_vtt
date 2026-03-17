interface Env {
  AI: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const HTML_PAGE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>视频转 VTT 字幕</title>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0f172a;
        color: #e2e8f0;
      }
      .container {
        max-width: 900px;
        margin: 24px auto;
        padding: 16px;
      }
      .dropzone {
        border: 2px dashed #64748b;
        border-radius: 14px;
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        background: #111827;
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease;
        padding: 24px;
      }
      .dropzone.dragover {
        border-color: #38bdf8;
        background: #0b2538;
      }
      .hint {
        color: #94a3b8;
      }
      .actions {
        margin-top: 16px;
      }
      button {
        border: 0;
        border-radius: 10px;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 600;
        background: #2563eb;
        color: #f8fafc;
        cursor: pointer;
      }
      button:disabled {
        background: #334155;
        cursor: not-allowed;
      }
      .result {
        margin-top: 16px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .result-card {
        border: 1px solid #334155;
        border-radius: 12px;
        min-height: 320px;
        background: #020617;
        padding: 16px;
        overflow: auto;
      }
      .result-card.full-row {
        grid-column: 1 / -1;
      }
      .result-title {
        margin: 0 0 10px;
        font-size: 14px;
        color: #93c5fd;
      }
      .result-tip {
        margin: 0 0 10px;
        font-size: 12px;
        color: #94a3b8;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.45;
      }
      .file-info {
        margin-top: 10px;
        color: #cbd5e1;
        font-size: 14px;
      }
      .error {
        color: #fca5a5;
      }
    </style>
  </head>
  <body>
    <main class="container">
      <h1>视频转 VTT 字幕</h1>

      <section id="dropzone" class="dropzone">
        <div>
          <p><strong>拖拽视频到这里</strong>，或者点击选择文件</p>
          <p class="hint">支持常见视频格式（mp4 / mov / webm 等）</p>
          <div id="fileInfo" class="file-info">尚未选择文件</div>
        </div>
      </section>
      <input id="fileInput" type="file" accept="video/*,audio/*" hidden />

      <div class="actions">
        <button id="extractBtn" disabled>提取字幕</button>
      </div>

      <section class="result">
        <div class="result-card">
          <h2 class="result-title">VTT（带时间戳）</h2>
          <pre id="outputVtt">这里会显示 VTT 结果...</pre>
        </div>
        <div class="result-card">
          <h2 class="result-title">Text（纯文本）</h2>
          <p class="result-tip">通常不带时间戳，便于快速阅读整段内容。</p>
          <pre id="outputText">这里会显示 Text 结果...</pre>
        </div>
        <div class="result-card full-row">
          <h2 class="result-title">Segments（分段时间轴）</h2>
          <p class="result-tip">每段包含开始/结束时间，适合检查切分质量。</p>
          <pre id="outputSegments">这里会显示 Segments 结果...</pre>
        </div>
      </section>
    </main>

    <script>
      const dropzone = document.getElementById("dropzone");
      const fileInput = document.getElementById("fileInput");
      const extractBtn = document.getElementById("extractBtn");
      const outputVtt = document.getElementById("outputVtt");
      const outputText = document.getElementById("outputText");
      const outputSegments = document.getElementById("outputSegments");
      const fileInfo = document.getElementById("fileInfo");
      const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

      let selectedFile = null;

      function formatBytes(bytes) {
        if (!bytes) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        let value = bytes;
        let unit = 0;
        while (value >= 1024 && unit < units.length - 1) {
          value /= 1024;
          unit++;
        }
        return value.toFixed(2) + " " + units[unit];
      }

      function setFile(file) {
        selectedFile = file;
        extractBtn.disabled = !file;
        if (!file) {
          fileInfo.textContent = "尚未选择文件";
          return;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          extractBtn.disabled = true;
          fileInfo.textContent = file.name + " (" + formatBytes(file.size) + ")，文件过大，请控制在 25MB 内";
          return;
        }
        fileInfo.textContent = file.name + " (" + formatBytes(file.size) + ")";
      }

      function formatSeconds(seconds) {
        if (typeof seconds !== "number" || Number.isNaN(seconds)) return "00:00:00.000";
        const totalMs = Math.max(0, Math.floor(seconds * 1000));
        const ms = totalMs % 1000;
        const totalSec = Math.floor(totalMs / 1000);
        const sec = totalSec % 60;
        const totalMin = Math.floor(totalSec / 60);
        const min = totalMin % 60;
        const hour = Math.floor(totalMin / 60);
        return String(hour).padStart(2, "0")
          + ":" + String(min).padStart(2, "0")
          + ":" + String(sec).padStart(2, "0")
          + "." + String(ms).padStart(3, "0");
      }

      function renderSegments(segments) {
        if (!Array.isArray(segments) || segments.length === 0) {
          return "没有返回 Segments 内容";
        }

        return segments.map((segment, index) => {
          const start = formatSeconds(segment?.start);
          const end = formatSeconds(segment?.end);
          const text = typeof segment?.text === "string" ? segment.text.trim() : "";
          return "[" + String(index + 1).padStart(3, "0") + "] "
            + start + " --> " + end + "\\n"
            + (text || "(空文本)");
        }).join("\\n\\n");
      }

      function buildHttpErrorHint(status) {
        if (status === 413) return "上传文件太大（HTTP 413）。建议先压缩视频或只上传音频。";
        if (status === 429) return "请求过于频繁（HTTP 429）。请稍后重试。";
        if (status === 401 || status === 403) return "Cloudflare 鉴权失败（HTTP " + status + "）。请检查 Wrangler 登录/API Token。";
        if (status >= 500) return "服务端错误（HTTP " + status + "），请稍后重试。";
        return "请求失败（HTTP " + status + "）。";
      }

      function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      async function fetchWithRetry(url, options, maxAttempts) {
        let lastResponse = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const response = await fetch(url, options);
            if (response.status === 503 || response.status === 429) {
              lastResponse = response;
              if (attempt < maxAttempts) {
                await sleep(attempt * 1200);
                continue;
              }
            }
            return response;
          } catch (error) {
            if (attempt >= maxAttempts) throw error;
            await sleep(attempt * 1200);
          }
        }
        return lastResponse;
      }

      dropzone.addEventListener("click", () => fileInput.click());

      dropzone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropzone.classList.add("dragover");
      });

      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
      });

      dropzone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropzone.classList.remove("dragover");
        const file = event.dataTransfer?.files?.[0];
        if (file) setFile(file);
      });

      fileInput.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (file) setFile(file);
      });

      extractBtn.addEventListener("click", async () => {
        if (!selectedFile) return;
        if (selectedFile.size > MAX_UPLOAD_BYTES) {
          const message = "文件超过 25MB，建议先压缩视频或提取音频后再上传。";
          outputVtt.innerHTML = '<span class="error">' + message + "</span>";
          outputText.innerHTML = '<span class="error">' + message + "</span>";
          outputSegments.innerHTML = '<span class="error">' + message + "</span>";
          return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);

        outputVtt.textContent = "正在提取字幕，请稍候...";
        outputText.textContent = "正在提取字幕，请稍候...";
        outputSegments.textContent = "正在提取字幕，请稍候...";
        extractBtn.disabled = true;

        try {
          const response = await fetchWithRetry("/api/transcribe", {
            method: "POST",
            body: formData
          }, 3);

          const responseContentType = response.headers.get("content-type") || "(unknown)";
          const raw = await response.text();
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            const shortText = raw.slice(0, 200).replace(/\\s+/g, " ").trim() || "(empty body)";
            const hint = buildHttpErrorHint(response.status);
            throw new Error(
              hint
              + "\\ncontent-type: " + responseContentType
              + "\\n响应片段: " + shortText
            );
          }

          if (!response.ok) {
            const backendError = data && typeof data.error === "string" ? data.error : null;
            throw new Error(backendError || buildHttpErrorHint(response.status));
          }

          const result = data && typeof data === "object" ? data : {};
          outputVtt.textContent = typeof result.vtt === "string" ? result.vtt : "没有返回 VTT 内容";
          outputText.textContent = typeof result.text === "string" ? result.text : "没有返回 Text 内容";
          outputSegments.textContent = renderSegments(result.segments);
        } catch (error) {
          const message = error.message || "请求失败";
          outputVtt.innerHTML = '<span class="error">' + message + "</span>";
          outputText.innerHTML = '<span class="error">' + message + "</span>";
          outputSegments.innerHTML = '<span class="error">' + message + "</span>";
        } finally {
          extractBtn.disabled = false;
        }
      });
    </script>
  </body>
</html>`;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(HTML_PAGE, {
        headers: {
          "content-type": "text/html; charset=utf-8"
        }
      });
    }

    if (request.method === "POST" && url.pathname === "/api/transcribe") {
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.includes("multipart/form-data")) {
        return json({ error: "请求必须是 multipart/form-data" }, 400);
      }

      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return json({ error: "请上传视频文件" }, 400);
      }

      if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
        return json({ error: "仅支持视频或音频文件" }, 400);
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return json({ error: "文件超过 25MB，建议压缩后重试" }, 413);
      }

      const audioBuffer = await file.arrayBuffer();
      if (audioBuffer.byteLength === 0) {
        return json({ error: "上传文件为空" }, 400);
      }

      try {
        const result = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
          audio: toBase64(audioBuffer),
          task: "transcribe"
        });

        return json({
          vtt: typeof result?.vtt === "string" ? result.vtt : "",
          text: typeof result?.text === "string" ? result.text : "",
          segments: Array.isArray(result?.segments) ? result.segments : [],
          transcription_info: result?.transcription_info ?? null
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Workers AI 调用失败";
        return json({ error: message }, 500);
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
