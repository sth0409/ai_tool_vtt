interface Env {
  AI: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const EXTRACT_PAGE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>视频转 VTT 字幕</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0f172a;
        color: #e2e8f0;
      }
      .container { max-width: 900px; margin: 24px auto; padding: 16px; }
      .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
      .open-ass-btn {
        border: 1px solid #60a5fa;
        border-radius: 10px;
        padding: 10px 14px;
        background: #1d4ed8;
        color: #f8fafc;
        text-decoration: none;
        font-weight: 600;
        font-size: 14px;
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
      .dropzone.dragover { border-color: #38bdf8; background: #0b2538; }
      .hint { color: #94a3b8; }
      .actions-row { margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap; }
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
      .subtle-btn { background: #334155; }
      button:disabled { background: #334155; cursor: not-allowed; opacity: 0.7; }
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
      .result-card.full-row { grid-column: 1 / -1; }
      .result-title { margin: 0 0 10px; font-size: 14px; color: #93c5fd; }
      .result-tip { margin: 0 0 10px; font-size: 12px; color: #94a3b8; }
      pre { margin: 0; white-space: pre-wrap; word-break: break-word; line-height: 1.45; }
      .file-info { margin-top: 10px; color: #cbd5e1; font-size: 14px; }
      .error { color: #fca5a5; }
      @media (max-width: 820px) { .result { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="container">
      <div class="toolbar">
        <h1>视频转 VTT 字幕</h1>
        <a class="open-ass-btn" href="/ass" target="_blank" rel="noopener">打开关键词高亮（ASS）新标签页</a>
      </div>

      <section id="dropzone" class="dropzone">
        <div>
          <p><strong>拖拽视频到这里</strong>，或者点击“选择文件”</p>
          <p class="hint">支持常见视频格式（mp4 / mov / webm 等）</p>
          <div id="fileInfo" class="file-info">尚未选择文件</div>
        </div>
      </section>
      <input id="fileInput" type="file" accept="video/*,audio/*" hidden />

      <div class="actions-row">
        <button id="pickFileBtn" class="subtle-btn" type="button">选择文件</button>
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
      const pickFileBtn = document.getElementById("pickFileBtn");
      const extractBtn = document.getElementById("extractBtn");
      const outputVtt = document.getElementById("outputVtt");
      const outputText = document.getElementById("outputText");
      const outputSegments = document.getElementById("outputSegments");
      const fileInfo = document.getElementById("fileInfo");
      const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
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
          fileInfo.textContent = file.name + " (" + formatBytes(file.size) + ")，文件过大，请控制在 50MB 内";
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
        if (!Array.isArray(segments) || segments.length === 0) return "没有返回 Segments 内容";
        return segments.map((segment, index) => {
          const start = formatSeconds(segment?.start);
          const end = formatSeconds(segment?.end);
          const text = typeof segment?.text === "string" ? segment.text.trim() : "";
          return "[" + String(index + 1).padStart(3, "0") + "] " + start + " --> " + end + "\\n" + (text || "(空文本)");
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

      function openFilePicker() {
        fileInput.value = "";
        fileInput.click();
      }

      dropzone.addEventListener("click", openFilePicker);
      pickFileBtn.addEventListener("click", openFilePicker);

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
        const file = event.target?.files?.[0];
        if (file) setFile(file);
      });

      extractBtn.addEventListener("click", async () => {
        if (!selectedFile) return;
        if (selectedFile.size > MAX_UPLOAD_BYTES) {
          const message = "文件超过 50MB，建议先压缩视频或提取音频后再上传。";
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
          const response = await fetchWithRetry("/api/transcribe", { method: "POST", body: formData }, 3);
          const responseContentType = response.headers.get("content-type") || "(unknown)";
          const raw = await response.text();
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            const shortText = raw.slice(0, 200).replace(/\\s+/g, " ").trim() || "(empty body)";
            const hint = buildHttpErrorHint(response.status);
            throw new Error(hint + "\\ncontent-type: " + responseContentType + "\\n响应片段: " + shortText);
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
          const message = error?.message || "请求失败";
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

const ASS_PAGE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>关键词高亮（ASS）</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0f172a;
        color: #e2e8f0;
      }
      .container { max-width: 980px; margin: 24px auto; padding: 16px; }
      .back-link { color: #93c5fd; text-decoration: none; }
      .field { margin-top: 14px; }
      .field label { display: block; margin-bottom: 6px; color: #cbd5e1; font-size: 14px; }
      textarea, input[type="text"] {
        width: 100%;
        border: 1px solid #334155;
        border-radius: 10px;
        background: #020617;
        color: #e2e8f0;
        padding: 10px 12px;
        box-sizing: border-box;
        font-size: 14px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      textarea { min-height: 180px; resize: vertical; }
      .mini-grid { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
      .hint-line { margin-top: 8px; color: #94a3b8; font-size: 12px; line-height: 1.45; }
      .actions-row { margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap; }
      button {
        border: 0;
        border-radius: 10px;
        padding: 12px 24px;
        font-size: 15px;
        font-weight: 600;
        background: #2563eb;
        color: #f8fafc;
        cursor: pointer;
      }
      .subtle-btn { background: #475569; }
      button:disabled { background: #334155; cursor: not-allowed; opacity: 0.7; }
      .result {
        margin-top: 16px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }
      .result-card {
        border: 1px solid #334155;
        border-radius: 12px;
        background: #020617;
        padding: 16px;
        overflow: auto;
      }
      .result-title { margin: 0 0 10px; font-size: 14px; color: #93c5fd; }
      .result-tip { margin: 0 0 10px; font-size: 12px; color: #94a3b8; }
      pre { margin: 0; white-space: pre-wrap; word-break: break-word; line-height: 1.45; }
      .error { color: #fca5a5; }
      @media (max-width: 820px) { .mini-grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="container">
      <a class="back-link" href="/">← 返回提取字幕页</a>
      <h1>关键词高亮（ASS）</h1>
      <div class="field">
        <label for="subtitleInput">输入字幕分段（你当前格式）</label>
        <textarea id="subtitleInput" placeholder="[001] 00:00:00.000 --> 00:00:01.760
I just want to hook up with a guy who's hot.

[002] 00:00:01.900 --> 00:00:03.820
I just want a guy who's good-looking and fun."></textarea>
      </div>
      <div class="field">
        <label for="keywordRules">高亮规则（每行一条）</label>
        <textarea id="keywordRules" placeholder="hot
3|in shape"></textarea>
        <div class="hint-line">
          规则说明：<br />
          1) 仅写词（如 hot）= 全局高亮；<br />
          2) 行号+竖线（如 1|hot、3|in shape）= 按第几条字幕高亮；<br />
          3) 输入里的 [001] 仅是顺序标记，可有可无，不会写入字幕文本；<br />
          4) 支持词组，忽略大小写匹配。
        </div>
      </div>
      <div class="mini-grid">
        <div class="field">
          <label for="highlightColor">高亮色（BGR）</label>
          <input id="highlightColor" type="text" value="&H0000FFFF" />
        </div>
        <div class="field">
          <label for="defaultColor">默认色（BGR）</label>
          <input id="defaultColor" type="text" value="&H00FFFFFF" />
        </div>
        <div class="field">
          <label for="fontSize">字号</label>
          <input id="fontSize" type="text" value="48" />
        </div>
      </div>
      <div class="actions-row">
        <button id="generateAssBtn" type="button">生成 ASS + 命令</button>
        <button id="downloadAssBtn" type="button" class="subtle-btn" disabled>下载 subtitle.ass</button>
      </div>
      <section class="result">
        <div class="result-card">
          <h2 class="result-title">ASS 字幕内容</h2>
          <pre id="outputAss">这里会显示 ASS 内容...</pre>
        </div>
        <div class="result-card">
          <h2 class="result-title">ffmpeg 命令</h2>
          <p class="result-tip">将 ASS 内容保存为 subtitle.ass 后，在本地终端执行。</p>
          <pre id="outputCmd">这里会显示 ffmpeg 命令...</pre>
        </div>
      </section>
    </main>
    <script>
      const subtitleInput = document.getElementById("subtitleInput");
      const keywordRules = document.getElementById("keywordRules");
      const highlightColor = document.getElementById("highlightColor");
      const defaultColor = document.getElementById("defaultColor");
      const fontSize = document.getElementById("fontSize");
      const generateAssBtn = document.getElementById("generateAssBtn");
      const downloadAssBtn = document.getElementById("downloadAssBtn");
      const outputAss = document.getElementById("outputAss");
      const outputCmd = document.getElementById("outputCmd");
      let lastAssContent = "";

      function normalizeAssColor(input, fallback) {
        const value = String(input || "").trim().toUpperCase();
        if (/^&H[0-9A-F]{8}$/.test(value)) return value;
        return fallback;
      }

      function escapeRegExp(value) {
        return value.replace(/[.*+?^{}()|[\\]\\\\$]/g, "\\\\$&");
      }

      function escapeAssText(text) {
        return text.replace(/\\\\/g, "\\\\\\\\").replace(/\\{/g, "\\\\{").replace(/\\}/g, "\\\\}");
      }

      function parseCueBlocks(input) {
        const blocks = input.replace(/\\r\\n/g, "\\n").trim().split(/\\n{2,}/).map((block) => block.trim()).filter(Boolean);
        const cues = [];
        for (const block of blocks) {
          const lines = block.split("\\n").map((line) => line.trimEnd());
          if (lines.length < 2) continue;
          const match = lines[0].match(/^(?:\\[(\\d+)\\]\\s+)?(\\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s*-->\\s*(\\d{2}:\\d{2}:\\d{2}\\.\\d{3})$/);
          if (!match) continue;
          const cueNo = cues.length + 1;
          cues.push({
            order: cueNo,
            indexLabel: match[1] ? Number(match[1]) : cueNo,
            start: match[2],
            end: match[3],
            text: lines.slice(1).join("\\n").trim()
          });
        }
        return cues;
      }

      function parseRules(input) {
        return input.replace(/\\r\\n/g, "\\n").split("\\n").map((line) => line.trim()).filter(Boolean).map((line) => {
          const withLine = line.match(/^(\\d{1,4})\\s*\\|\\s*(.+)$/);
          if (withLine) return { line: Number(withLine[1]), word: withLine[2].trim() };
          return { line: null, word: line };
        }).filter((rule) => rule.word.length > 0);
      }

      function toAssTime(timeWithMs) {
        const m = timeWithMs.match(/^(\\d{2}):(\\d{2}):(\\d{2})\\.(\\d{3})$/);
        if (!m) return "0:00:00.00";
        const hour = Number(m[1]);
        const min = Number(m[2]);
        const sec = Number(m[3]);
        const cs = Math.floor(Number(m[4]) / 10);
        return String(hour) + ":" + String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0") + "." + String(cs).padStart(2, "0");
      }

      function applyHighlight(rawText, cueOrder, cueIndexLabel, rules, hitColor, normalColor) {
        const escaped = escapeAssText(rawText);
        const words = rules
          .filter((rule) => !rule.line || rule.line === cueOrder || rule.line === cueIndexLabel)
          .map((rule) => rule.word.trim())
          .filter(Boolean);
        if (words.length === 0) return escaped.replace(/\\n/g, "\\\\N");
        const uniqueWords = [...new Set(words)].sort((a, b) => b.length - a.length);
        let highlighted = escaped;
        for (const word of uniqueWords) {
          const escapedWord = escapeAssText(word);
          if (!escapedWord) continue;
          const pattern = new RegExp(escapeRegExp(escapedWord), "gi");
          highlighted = highlighted.replace(pattern, "{\\\\\\\\c" + hitColor + "}$&{\\\\\\\\c" + normalColor + "}");
        }
        return highlighted.replace(/\\n/g, "\\\\N");
      }

      function buildAssContent(cues, rules, hitColor, normalColor, fontSizeValue) {
        const sizeNum = Number(fontSizeValue);
        const safeSize = Number.isFinite(sizeNum) && sizeNum > 0 ? Math.round(sizeNum) : 48;
        const lines = [
          "[Script Info]",
          "ScriptType: v4.00+",
          "PlayResX: 1920",
          "PlayResY: 1080",
          "",
          "[V4+ Styles]",
          "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
          "Style: Default,Arial," + safeSize + "," + normalColor + ",&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,40,1",
          "",
          "[Events]",
          "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
        ];
        for (const cue of cues) {
          const text = applyHighlight(cue.text, cue.order, cue.indexLabel, rules, hitColor, normalColor);
          lines.push("Dialogue: 0," + toAssTime(cue.start) + "," + toAssTime(cue.end) + ",Default,,0,0,0,," + text);
        }
        return lines.join("\\n");
      }

      function showError(message) {
        outputAss.innerHTML = '<span class="error">' + message + "</span>";
        outputCmd.innerHTML = '<span class="error">' + message + "</span>";
        lastAssContent = "";
        downloadAssBtn.disabled = true;
      }

      generateAssBtn.addEventListener("click", () => {
        const cues = parseCueBlocks(subtitleInput.value || "");
        if (cues.length === 0) return showError("未识别到有效字幕块，请使用“时间轴 + 文本”格式；[001] 可选，仅作顺序标记。");
        const rules = parseRules(keywordRules.value || "");
        if (rules.length === 0) return showError("请至少填写一个高亮词规则。");

        const hitColor = normalizeAssColor(highlightColor.value, "&H0000FFFF");
        const normalColor = normalizeAssColor(defaultColor.value, "&H00FFFFFF");
        const ass = buildAssContent(cues, rules, hitColor, normalColor, fontSize.value);
        lastAssContent = ass;
        outputAss.textContent = ass;
        outputCmd.textContent = [
          "# 1) 使用下方按钮直接下载 subtitle.ass，或手动保存",
          "ffmpeg -i \\"input.mp4\\" -vf \\"ass=subtitle.ass\\" -c:a copy \\"output.mp4\\"",
          "",
          "# 如需兼容性更好（重编码视频）：",
          "ffmpeg -i \\"input.mp4\\" -vf \\"ass=subtitle.ass\\" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k \\"output.mp4\\""
        ].join("\\n");
        downloadAssBtn.disabled = false;
      });

      downloadAssBtn.addEventListener("click", () => {
        if (!lastAssContent) return;
        const blob = new Blob([lastAssContent], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "subtitle.ass";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
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
      return new Response(EXTRACT_PAGE, {
        headers: {
          "content-type": "text/html; charset=utf-8"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/ass") {
      return new Response(ASS_PAGE, {
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
        return json({ error: "文件超过 50MB，建议压缩后重试" }, 413);
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
