interface Env {
  AI: Ai;
}

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
        border: 1px solid #334155;
        border-radius: 12px;
        min-height: 320px;
        background: #020617;
        padding: 16px;
        overflow: auto;
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
        <pre id="output">这里会显示 VTT 结果...</pre>
      </section>
    </main>

    <script>
      const dropzone = document.getElementById("dropzone");
      const fileInput = document.getElementById("fileInput");
      const extractBtn = document.getElementById("extractBtn");
      const output = document.getElementById("output");
      const fileInfo = document.getElementById("fileInfo");

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
        fileInfo.textContent = file.name + " (" + formatBytes(file.size) + ")";
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

        const formData = new FormData();
        formData.append("file", selectedFile);

        output.textContent = "正在提取字幕，请稍候...";
        extractBtn.disabled = true;

        try {
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "字幕提取失败");
          }

          output.textContent = data.vtt || data.text || "没有返回字幕内容";
        } catch (error) {
          output.innerHTML = '<span class="error">' + (error.message || "请求失败") + "</span>";
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
