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
      .container { max-width: 1080px; margin: 24px auto; padding: 16px; }
      .back-link { color: #93c5fd; text-decoration: none; }
      .field { margin-top: 14px; }
      .field label { display: block; margin-bottom: 6px; color: #cbd5e1; font-size: 14px; }
      textarea, input[type="text"], input[type="color"], select {
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
      button {
        border: 0;
        border-radius: 10px;
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 600;
        background: #2563eb;
        color: #f8fafc;
        cursor: pointer;
      }
      .subtle-btn { background: #475569; }
      button:disabled { background: #334155; cursor: not-allowed; opacity: 0.7; }
      .actions-row { margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      .hint-line { margin-top: 8px; color: #94a3b8; font-size: 12px; line-height: 1.45; }
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
      .config-list { display: flex; gap: 8px; flex-wrap: wrap; }
      .config-tag {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid #334155;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        color: #e2e8f0;
        background: #111827;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.28);
        display: inline-block;
      }
      .preprocess-panel {
        border: 1px solid #334155;
        border-radius: 10px;
        min-height: 180px;
        max-height: 420px;
        overflow: auto;
        background: #000b1d;
      }
      .preprocess-placeholder {
        margin: 0;
        padding: 12px;
        color: #94a3b8;
        font-size: 13px;
      }
      .cue-line {
        border-bottom: 1px solid #1f2937;
        padding: 10px 12px;
        line-height: 1.5;
      }
      .cue-line:last-child { border-bottom: 0; }
      .cue-meta {
        color: #94a3b8;
        font-size: 12px;
        margin-bottom: 6px;
      }
      .cue-text { font-size: 14px; user-select: text; white-space: pre-wrap; word-break: break-word; }
      .word-hit {
        border-radius: 4px;
        color: #0f172a;
        padding: 0 2px;
      }
      .group-list { display: grid; grid-template-columns: 1fr; gap: 10px; }
      .group-card {
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 10px;
        background: #0b1220;
      }
      .group-title { margin: 0 0 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
      .group-items { margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
      .word-menu {
        position: fixed;
        z-index: 70;
        min-width: 220px;
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 10px;
        background: #020617;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
      }
      .word-menu[hidden] { display: none; }
      .word-menu-title {
        margin: 0 0 8px;
        color: #bfdbfe;
        font-size: 12px;
        line-height: 1.45;
      }
      .menu-actions { display: flex; flex-direction: column; gap: 6px; }
      .menu-actions button {
        text-align: left;
        padding: 8px 10px;
        font-size: 13px;
      }
      .menu-empty { margin: 0; color: #94a3b8; font-size: 12px; }
      .mini-grid { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
      .preview-toolbar {
        margin-top: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .file-pill {
        border: 1px solid #334155;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        color: #cbd5e1;
        background: #020617;
      }
      .preview-stage {
        margin-top: 10px;
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        border: 1px solid #334155;
        border-radius: 10px;
        background: #000;
        overflow: hidden;
      }
      .preview-video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: fill;
        background: #000;
      }
      .subtitle-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        padding: 0 16px 40px;
      }
      .subtitle-overlay-text {
        max-width: min(92%, 1100px);
        border-radius: 6px;
        padding: 4px 12px;
        font-size: 40px;
        line-height: 1.32;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.82);
        text-align: center;
        white-space: pre-wrap;
        word-break: break-word;
        pointer-events: auto;
        cursor: grab;
        user-select: none;
      }
      .subtitle-overlay-text.dragging { cursor: grabbing; }
      .subtitle-hit { font-weight: 700; }
      pre { margin: 0; white-space: pre-wrap; word-break: break-word; line-height: 1.45; }
      .error { color: #fca5a5; }
      .modal {
        position: fixed;
        inset: 0;
        z-index: 80;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(2, 6, 23, 0.72);
      }
      .modal[hidden] { display: none; }
      .modal-card {
        width: min(520px, calc(100vw - 32px));
        border: 1px solid #334155;
        border-radius: 12px;
        background: #020617;
        padding: 16px;
      }
      .modal-title { margin: 0 0 12px; font-size: 16px; color: #dbeafe; }
      .modal-actions { margin-top: 12px; display: flex; gap: 10px; justify-content: flex-end; }
      @media (max-width: 820px) {
        .mini-grid { grid-template-columns: 1fr; }
      }
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

      <div class="actions-row">
        <button id="prepareHighlightBtn" type="button">高亮编辑操作</button>
        <button id="addConfigBtn" type="button" class="subtle-btn">增加高亮配置</button>
      </div>

      <div class="field">
        <label>当前高亮配置</label>
        <div id="configList" class="config-list"></div>
        <div class="hint-line">先添加高亮配置，再在“高亮预处理文案”里选词进行绑定。</div>
      </div>

      <section class="result">
        <div class="result-card">
          <h2 class="result-title">高亮预处理文案</h2>
          <p class="result-tip">点击“高亮编辑操作”后按行显示字幕。鼠标选中单词/短语，会弹出高亮操作面板。</p>
          <div id="preprocessBody" class="preprocess-panel">
            <p class="preprocess-placeholder">尚未生成高亮预处理文案</p>
          </div>
        </div>

        <div class="result-card">
          <h2 class="result-title">已设置高亮词（按配置分组）</h2>
          <div id="groupedHighlights" class="group-list"></div>
        </div>
      </section>

      <div class="mini-grid">
        <div class="field">
          <label for="defaultColor">默认色（BGR）</label>
          <input id="defaultColor" type="text" value="&H00FFFFFF" />
        </div>
        <div class="field">
          <label for="fontSize">字号</label>
          <input id="fontSize" type="text" value="48" />
        </div>
        <div class="field">
          <label for="outlineColor">黑框色（BGR）</label>
          <input id="outlineColor" type="text" value="&H00000000" />
        </div>
        <div class="field">
          <label for="outlineOpacity">黑框透明度（0-100） <span id="outlineOpacityValue">100%</span></label>
          <input id="outlineOpacity" type="range" min="0" max="100" step="1" value="100" />
        </div>
        <div class="field">
          <label for="outlineWidth">黑框厚度</label>
          <input id="outlineWidth" type="text" value="2" />
        </div>
        <div class="field">
          <label for="subtitleAlign">垂直对齐</label>
          <select id="subtitleAlign">
            <option value="bottom" selected>底部</option>
            <option value="middle">中间</option>
            <option value="top">顶部</option>
          </select>
        </div>
        <div class="field">
          <label for="lockMiddleDrag"><input id="lockMiddleDrag" type="checkbox" /> 锁定中间模式（拖拽时保持中线）</label>
        </div>
        <div class="field">
          <label for="subtitleOffset">距边缘（像素）</label>
          <input id="subtitleOffset" type="text" value="40" />
        </div>
      </div>

      <div class="field">
        <label>视频预览调参</label>
        <div class="preview-toolbar">
          <button id="pickPreviewVideoBtn" type="button" class="subtle-btn">上传预览视频</button>
          <span id="previewFileInfo" class="file-pill">未选择视频（可先调样式）</span>
        </div>
        <input id="previewVideoInput" type="file" accept="video/*" hidden />
        <div id="previewStage" class="preview-stage">
          <video id="previewVideo" class="preview-video" controls playsinline></video>
          <div id="subtitleOverlay" class="subtitle-overlay">
            <div id="subtitleOverlayText" class="subtitle-overlay-text">预览区：上传视频后会随时间显示对应字幕</div>
          </div>
        </div>
        <div class="hint-line">可视化调整字号、黑框和位置；可直接拖拽预览字幕上下移动；生成 ASS 时会使用同一组参数。</div>
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

    <div id="wordMenu" class="word-menu" hidden>
      <p id="wordMenuTitle" class="word-menu-title"></p>
      <div id="wordMenuActions" class="menu-actions"></div>
    </div>

    <div id="configModal" class="modal" hidden>
      <div class="modal-card">
        <h2 class="modal-title">新增高亮配置</h2>
        <div class="field">
          <label for="configNameInput">配置名称</label>
          <input id="configNameInput" type="text" placeholder="例如：人名 / 重点词 / 品牌词" />
        </div>
        <div class="mini-grid">
          <div class="field">
            <label for="configColorInput">颜色（BGR）</label>
            <input id="configColorInput" type="text" value="&H0000FFFF" />
          </div>
          <div class="field">
            <label for="configColorPicker">颜色预选</label>
            <input id="configColorPicker" type="color" value="#FFFF00" />
          </div>
        </div>
        <div class="modal-actions">
          <button id="cancelConfigBtn" type="button" class="subtle-btn">取消</button>
          <button id="saveConfigBtn" type="button">保存配置</button>
        </div>
      </div>
    </div>

    <script>
      const subtitleInput = document.getElementById("subtitleInput");
      const prepareHighlightBtn = document.getElementById("prepareHighlightBtn");
      const addConfigBtn = document.getElementById("addConfigBtn");
      const configList = document.getElementById("configList");
      const preprocessBody = document.getElementById("preprocessBody");
      const groupedHighlights = document.getElementById("groupedHighlights");
      const wordMenu = document.getElementById("wordMenu");
      const wordMenuTitle = document.getElementById("wordMenuTitle");
      const wordMenuActions = document.getElementById("wordMenuActions");
      const configModal = document.getElementById("configModal");
      const configNameInput = document.getElementById("configNameInput");
      const configColorInput = document.getElementById("configColorInput");
      const configColorPicker = document.getElementById("configColorPicker");
      const cancelConfigBtn = document.getElementById("cancelConfigBtn");
      const saveConfigBtn = document.getElementById("saveConfigBtn");

      const defaultColor = document.getElementById("defaultColor");
      const outlineColor = document.getElementById("outlineColor");
      const outlineOpacity = document.getElementById("outlineOpacity");
      const outlineOpacityValue = document.getElementById("outlineOpacityValue");
      const outlineWidth = document.getElementById("outlineWidth");
      const subtitleAlign = document.getElementById("subtitleAlign");
      const lockMiddleDrag = document.getElementById("lockMiddleDrag");
      const subtitleOffset = document.getElementById("subtitleOffset");
      const fontSize = document.getElementById("fontSize");
      const pickPreviewVideoBtn = document.getElementById("pickPreviewVideoBtn");
      const previewVideoInput = document.getElementById("previewVideoInput");
      const previewFileInfo = document.getElementById("previewFileInfo");
      const previewStage = document.getElementById("previewStage");
      const previewVideo = document.getElementById("previewVideo");
      const subtitleOverlay = document.getElementById("subtitleOverlay");
      const subtitleOverlayText = document.getElementById("subtitleOverlayText");
      const generateAssBtn = document.getElementById("generateAssBtn");
      const downloadAssBtn = document.getElementById("downloadAssBtn");
      const outputAss = document.getElementById("outputAss");
      const outputCmd = document.getElementById("outputCmd");

      let lastAssContent = "";
      let previewVideoUrl = "";
      let dragState = null;
      let previewVideoMeta = null;
      let cuesCache = [];
      let highlightConfigs = [
        { id: "cfg-default", name: "默认高亮", color: "&H0000FFFF" }
      ];
      let assignments = [];
      let selectedContext = null;

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

      function escapeHtml(text) {
        return String(text || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function normalizeWord(value) {
        return String(value || "").replace(/\\s+/g, " ").trim().toLowerCase();
      }

      function parseTimeToSeconds(timeWithMs) {
        const m = String(timeWithMs || "").match(/^(\\d{2}):(\\d{2}):(\\d{2})\\.(\\d{3})$/);
        if (!m) return 0;
        return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
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
          const startSec = parseTimeToSeconds(match[2]);
          const endSec = parseTimeToSeconds(match[3]);
          cues.push({
            order: cueNo,
            indexLabel: match[1] ? Number(match[1]) : cueNo,
            start: match[2],
            end: match[3],
            startSec,
            endSec,
            text: lines.slice(1).join("\\n").trim()
          });
        }
        return cues;
      }

      function assColorToCssHex(assColor) {
        const value = normalizeAssColor(assColor, "&H00FFFFFF");
        const raw = value.slice(2);
        const bb = raw.slice(2, 4);
        const gg = raw.slice(4, 6);
        const rr = raw.slice(6, 8);
        return "#" + rr + gg + bb;
      }

      function assColorToCssRgba(assColor, fallback) {
        const value = normalizeAssColor(assColor, "");
        if (!value) return fallback;
        const raw = value.slice(2);
        if (raw.length !== 8) return fallback;
        const aa = raw.slice(0, 2);
        const bb = raw.slice(2, 4);
        const gg = raw.slice(4, 6);
        const rr = raw.slice(6, 8);
        const alpha = 1 - (parseInt(aa, 16) / 255);
        return "rgba(" + parseInt(rr, 16) + "," + parseInt(gg, 16) + "," + parseInt(bb, 16) + "," + alpha.toFixed(3) + ")";
      }

      function setAssColorOpacity(assColor, opacityPercent) {
        const value = normalizeAssColor(assColor, "&H00000000");
        const raw = value.slice(2);
        const rgb = raw.slice(2);
        const safeOpacity = Math.max(0, Math.min(100, Math.round(Number(opacityPercent) || 0)));
        const alpha = Math.round((100 - safeOpacity) * 255 / 100);
        const aa = alpha.toString(16).toUpperCase().padStart(2, "0");
        return "&H" + aa + rgb;
      }

      function getAssColorOpacity(assColor) {
        const value = normalizeAssColor(assColor, "&H00000000");
        const aa = value.slice(2, 4);
        const alpha = parseInt(aa, 16);
        const opacity = 100 - Math.round(alpha * 100 / 255);
        return Math.max(0, Math.min(100, opacity));
      }

      function cssHexToAssColor(hex) {
        const safe = /^#[0-9A-Fa-f]{6}$/.test(String(hex || "").trim()) ? String(hex).trim() : "#FFFF00";
        const rr = safe.slice(1, 3).toUpperCase();
        const gg = safe.slice(3, 5).toUpperCase();
        const bb = safe.slice(5, 7).toUpperCase();
        return "&H00" + bb + gg + rr;
      }

      function getConfigById(id) {
        return highlightConfigs.find((item) => item.id === id) || null;
      }

      function collectMatches(text, entries) {
        const source = String(text || "");
        const all = [];
        for (const entry of entries) {
          const word = String(entry.word || "").trim();
          if (!word) continue;
          const re = new RegExp(escapeRegExp(word), "gi");
          let m = null;
          while ((m = re.exec(source)) !== null) {
            if (!m[0]) break;
            all.push({
              start: m.index,
              end: m.index + m[0].length,
              hitText: m[0],
              configId: entry.configId,
              color: entry.color,
              name: entry.name
            });
          }
        }
        all.sort((a, b) => (a.start - b.start) || ((b.end - b.start) - (a.end - a.start)));

        const accepted = [];
        const occupied = new Array(source.length).fill(false);
        for (const item of all) {
          if (item.end <= item.start) continue;
          let conflict = false;
          for (let i = item.start; i < item.end; i++) {
            if (occupied[i]) {
              conflict = true;
              break;
            }
          }
          if (conflict) continue;
          for (let i = item.start; i < item.end; i++) occupied[i] = true;
          accepted.push(item);
        }
        accepted.sort((a, b) => a.start - b.start);
        return accepted;
      }

      function getCueAssignments(cueOrder) {
        return assignments.filter((item) => item.cueOrder === cueOrder);
      }

      function buildHighlightedHtml(text, cueOrder) {
        const current = getCueAssignments(cueOrder).map((item) => {
          const cfg = getConfigById(item.configId);
          if (!cfg) return null;
          return { word: item.word, configId: item.configId, color: cfg.color, name: cfg.name };
        }).filter(Boolean);

        const matches = collectMatches(text, current);
        if (matches.length === 0) return escapeHtml(text).replace(/\\n/g, "<br />");

        let cursor = 0;
        const parts = [];
        for (const match of matches) {
          parts.push(escapeHtml(text.slice(cursor, match.start)));
          const style = "background:" + assColorToCssHex(match.color) + ";";
          parts.push('<span class="word-hit" style="' + style + '" title="' + escapeHtml(match.name) + '">' + escapeHtml(text.slice(match.start, match.end)) + "</span>");
          cursor = match.end;
        }
        parts.push(escapeHtml(text.slice(cursor)));
        return parts.join("").replace(/\\n/g, "<br />");
      }

      function renderConfigList() {
        if (highlightConfigs.length === 0) {
          configList.innerHTML = '<p class="menu-empty">暂无配置，请先新增高亮配置。</p>';
          return;
        }
        configList.innerHTML = highlightConfigs.map((cfg) => {
          return '<span class="config-tag"><span class="dot" style="background:' + assColorToCssHex(cfg.color) + ';"></span>' + escapeHtml(cfg.name) + ' <code>' + escapeHtml(cfg.color) + "</code></span>";
        }).join("");
      }

      function renderPreprocess() {
        if (!Array.isArray(cuesCache) || cuesCache.length === 0) {
          preprocessBody.innerHTML = '<p class="preprocess-placeholder">尚未生成高亮预处理文案</p>';
          return;
        }
        preprocessBody.innerHTML = cuesCache.map((cue) => {
          const meta = "[" + String(cue.order).padStart(3, "0") + "] " + cue.start + " --> " + cue.end;
          const textHtml = buildHighlightedHtml(cue.text, cue.order);
          return '<div class="cue-line" data-cue-order="' + cue.order + '" data-cue-index="' + cue.indexLabel + '"><div class="cue-meta">' + escapeHtml(meta) + '</div><div class="cue-text">' + textHtml + "</div></div>";
        }).join("");
      }

      function renderGroupedHighlights() {
        if (highlightConfigs.length === 0) {
          groupedHighlights.innerHTML = '<p class="menu-empty">暂无高亮配置。</p>';
          return;
        }
        const html = [];
        for (const cfg of highlightConfigs) {
          const items = assignments
            .filter((item) => item.configId === cfg.id)
            .map((item) => "[" + String(item.cueOrder).padStart(3, "0") + "] " + item.word);
          const deduped = [...new Set(items)];
          html.push(
            '<div class="group-card">'
            + '<h3 class="group-title"><span class="dot" style="background:' + assColorToCssHex(cfg.color) + ';"></span>' + escapeHtml(cfg.name) + " <code>" + escapeHtml(cfg.color) + "</code></h3>"
            + '<p class="group-items">' + (deduped.length > 0 ? escapeHtml(deduped.join("\\n")) : "暂无词") + "</p>"
            + "</div>"
          );
        }
        groupedHighlights.innerHTML = html.join("");
      }

      function hideWordMenu() {
        wordMenu.hidden = true;
        selectedContext = null;
      }

      function nodeToCue(node) {
        if (!node) return null;
        if (node.nodeType === Node.ELEMENT_NODE) return node.closest(".cue-line");
        return node.parentElement ? node.parentElement.closest(".cue-line") : null;
      }

      function buildWordMenuActions(context, existing) {
        if (!context) return;
        const actions = [];

        if (!existing) {
          if (highlightConfigs.length === 0) {
            wordMenuActions.innerHTML = '<p class="menu-empty">还没有配置，请先新增高亮配置。</p>';
            return;
          }
          for (const cfg of highlightConfigs) {
            actions.push('<button type="button" data-action="apply" data-config-id="' + cfg.id + '">插入到「' + escapeHtml(cfg.name) + '」</button>');
          }
        } else {
          const cfg = getConfigById(existing.configId);
          const title = cfg ? "已绑定配置：" + cfg.name : "已绑定配置";
          actions.push('<p class="menu-empty">' + escapeHtml(title) + "</p>");
          actions.push('<button type="button" class="subtle-btn" data-action="clear">清除高亮配置</button>');
          for (const candidate of highlightConfigs) {
            if (existing.configId === candidate.id) continue;
            actions.push('<button type="button" data-action="apply" data-config-id="' + candidate.id + '">改为「' + escapeHtml(candidate.name) + '」</button>');
          }
        }
        wordMenuActions.innerHTML = '<div class="menu-actions">' + actions.join("") + "</div>";
      }

      function showWordMenu(rangeRect, context) {
        const existing = assignments.find((item) => item.cueOrder === context.cueOrder && item.norm === context.norm) || null;
        wordMenuTitle.textContent = "词: " + context.word + "  |  行: " + String(context.cueOrder).padStart(3, "0");
        buildWordMenuActions(context, existing);

        const viewportPadding = 10;
        const top = Math.min(window.innerHeight - 120, Math.max(viewportPadding, rangeRect.bottom + 8));
        const left = Math.min(window.innerWidth - 250, Math.max(viewportPadding, rangeRect.left));
        wordMenu.style.top = top + "px";
        wordMenu.style.left = left + "px";
        wordMenu.hidden = false;
      }

      function clearBrowserSelection() {
        const selection = window.getSelection();
        if (selection) selection.removeAllRanges();
      }

      function applyAssignment(configId) {
        if (!selectedContext) return;
        const hit = assignments.find((item) => item.cueOrder === selectedContext.cueOrder && item.norm === selectedContext.norm);
        if (hit) {
          hit.configId = configId;
          hit.word = selectedContext.word;
        } else {
          assignments.push({
            cueOrder: selectedContext.cueOrder,
            cueIndexLabel: selectedContext.cueIndexLabel,
            word: selectedContext.word,
            norm: selectedContext.norm,
            configId
          });
        }
        renderPreprocess();
        renderGroupedHighlights();
        refreshPreviewText();
        hideWordMenu();
        clearBrowserSelection();
      }

      function clearAssignment() {
        if (!selectedContext) return;
        assignments = assignments.filter((item) => !(item.cueOrder === selectedContext.cueOrder && item.norm === selectedContext.norm));
        renderPreprocess();
        renderGroupedHighlights();
        refreshPreviewText();
        hideWordMenu();
        clearBrowserSelection();
      }

      function syncPickerFromAssInput() {
        configColorInput.value = normalizeAssColor(configColorInput.value, "&H0000FFFF");
        configColorPicker.value = assColorToCssHex(configColorInput.value);
      }

      function pruneAssignmentsByCues() {
        const valid = new Set(cuesCache.map((cue) => cue.order));
        assignments = assignments.filter((item) => valid.has(item.cueOrder));
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

      function applyMultiHighlight(rawText, cueOrder, normalColor) {
        const cueEntries = assignments
          .filter((item) => item.cueOrder === cueOrder)
          .map((item) => {
            const cfg = getConfigById(item.configId);
            if (!cfg) return null;
            return { word: item.word, configId: item.configId, color: cfg.color, name: cfg.name };
          })
          .filter(Boolean);

        const matches = collectMatches(rawText, cueEntries);
        if (matches.length === 0) return escapeAssText(rawText).replace(/\\n/g, "\\\\N");

        let cursor = 0;
        const parts = [];
        for (const match of matches) {
          parts.push(escapeAssText(rawText.slice(cursor, match.start)));
          parts.push("{\\\\c" + match.color + "}" + escapeAssText(rawText.slice(match.start, match.end)) + "{\\\\c" + normalColor + "}");
          cursor = match.end;
        }
        parts.push(escapeAssText(rawText.slice(cursor)));
        return parts.join("").replace(/\\n/g, "\\\\N");
      }

      function getAlignmentCode(value) {
        if (value === "top") return 8;
        if (value === "middle") return 5;
        return 2;
      }

      function getOverlayJustify(value) {
        if (value === "top") return "flex-start";
        if (value === "middle") return "center";
        return "flex-end";
      }

      function sanitizeOffset(value, alignValue) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 40;
        if (alignValue === "middle") {
          return Math.max(-300, Math.min(300, Math.round(n)));
        }
        if (n < 0) return 40;
        return Math.min(300, Math.round(n));
      }

      function syncOpacitySliderFromOutlineColor() {
        const opacity = getAssColorOpacity(outlineColor.value);
        outlineOpacity.value = String(opacity);
        outlineOpacityValue.textContent = String(opacity) + "%";
      }

      function applyOpacitySliderToOutlineColor() {
        const opacity = Math.max(0, Math.min(100, Number(outlineOpacity.value) || 0));
        outlineOpacityValue.textContent = String(Math.round(opacity)) + "%";
        outlineColor.value = setAssColorOpacity(outlineColor.value, opacity);
      }

      function updatePreviewMetaDisplay(fileName) {
        if (!previewVideoMeta) {
          previewFileInfo.textContent = fileName || "未选择视频（可先调样式）";
          return;
        }
        const duration = Number.isFinite(previewVideoMeta.duration)
          ? Math.round(previewVideoMeta.duration * 10) / 10
          : 0;
        previewFileInfo.textContent = (fileName || "已加载视频")
          + " | " + previewVideoMeta.width + "x" + previewVideoMeta.height
          + " | " + duration + "s";
      }

      function updatePreviewStageAspect() {
        if (!previewVideoMeta || previewVideoMeta.width <= 0 || previewVideoMeta.height <= 0) {
          previewStage.style.aspectRatio = "16 / 9";
          return;
        }
        previewStage.style.aspectRatio = String(previewVideoMeta.width) + " / " + String(previewVideoMeta.height);
      }

      function buildPreviewCueHtml(rawText, cueOrder) {
        const cueEntries = assignments
          .filter((item) => item.cueOrder === cueOrder)
          .map((item) => {
            const cfg = getConfigById(item.configId);
            if (!cfg) return null;
            return { word: item.word, color: cfg.color };
          })
          .filter(Boolean);
        const matches = collectMatches(rawText, cueEntries);
        if (matches.length === 0) return escapeHtml(rawText).replace(/\\n/g, "<br />");

        let cursor = 0;
        const parts = [];
        for (const match of matches) {
          parts.push(escapeHtml(rawText.slice(cursor, match.start)));
          parts.push('<span class="subtitle-hit" style="color:' + assColorToCssHex(match.color) + ';">' + escapeHtml(rawText.slice(match.start, match.end)) + "</span>");
          cursor = match.end;
        }
        parts.push(escapeHtml(rawText.slice(cursor)));
        return parts.join("").replace(/\\n/g, "<br />");
      }

      function getCueAtTime(cues, currentTimeSec) {
        for (const cue of cues) {
          if (currentTimeSec >= cue.startSec && currentTimeSec <= cue.endSec + 0.04) return cue;
        }
        return null;
      }

      function updatePreviewOverlay() {
        const normal = normalizeAssColor(defaultColor.value, "&H00FFFFFF");
        const back = normalizeAssColor(outlineColor.value, "&H00000000");
        const borderNum = Number(outlineWidth.value);
        const safeBorder = Number.isFinite(borderNum) && borderNum >= 0 ? Math.min(12, Math.round(borderNum)) : 2;
        const sizeNum = Number(fontSize.value);
        const safeSize = Number.isFinite(sizeNum) && sizeNum > 0 ? Math.round(sizeNum) : 48;
        const align = String(subtitleAlign.value || "bottom");
        const offset = sanitizeOffset(subtitleOffset.value, align);

        subtitleOverlay.style.justifyContent = getOverlayJustify(align);
        subtitleOverlay.style.paddingTop = align === "top" ? String(offset) + "px" : "0";
        subtitleOverlay.style.paddingBottom = align === "bottom" ? String(offset) + "px" : "0";
        subtitleOverlayText.style.transform = align === "middle" ? "translateY(" + String(offset) + "px)" : "translateY(0)";
        subtitleOverlayText.style.fontSize = String(safeSize) + "px";
        subtitleOverlayText.style.color = assColorToCssHex(normal);
        subtitleOverlayText.style.background = assColorToCssRgba(back, "rgba(0,0,0,0.82)");
        subtitleOverlayText.style.padding = String(Math.max(2, safeBorder * 2)) + "px " + String(Math.max(8, safeBorder * 4)) + "px";
      }

      function refreshPreviewText() {
        const cues = parseCueBlocks(subtitleInput.value || "");
        if (cues.length === 0) {
          subtitleOverlayText.textContent = "预览区：请先输入有效字幕分段";
          return;
        }
        const current = previewVideo && Number.isFinite(previewVideo.currentTime) ? previewVideo.currentTime : 0;
        const cue = getCueAtTime(cues, current) || cues[0];
        subtitleOverlayText.innerHTML = buildPreviewCueHtml(cue.text, cue.order);
      }

      function updatePreviewOverlayAndText() {
        updatePreviewOverlay();
        refreshPreviewText();
      }

      function handleSubtitleDragMove(clientY) {
        const stageRect = subtitleOverlay.getBoundingClientRect();
        if (stageRect.height <= 0) return;
        const textRect = subtitleOverlayText.getBoundingClientRect();
        const half = Math.max(10, textRect.height / 2);
        const yInStage = clientY - stageRect.top;
        const clampedY = Math.max(half, Math.min(stageRect.height - half, yInStage));
        const forceMiddle = !!lockMiddleDrag.checked;
        const align = forceMiddle ? "middle" : (clampedY < stageRect.height / 2 ? "top" : "bottom");
        let offset = 0;
        if (align === "middle") {
          offset = Math.round(clampedY - stageRect.height / 2);
        } else if (align === "top") {
          offset = Math.round(clampedY - half);
        } else {
          offset = Math.round(stageRect.height - (clampedY + half));
        }
        offset = sanitizeOffset(offset, align);
        subtitleAlign.value = align;
        subtitleOffset.value = String(offset);
        updatePreviewOverlay();
      }

      function onSubtitlePointerMove(event) {
        if (!dragState) return;
        const deltaY = Math.abs(event.clientY - dragState.startY);
        if (!dragState.moved && deltaY < 3) return;
        dragState.moved = true;
        handleSubtitleDragMove(event.clientY);
      }

      function endSubtitleDrag() {
        if (!dragState) return;
        dragState = null;
        subtitleOverlayText.classList.remove("dragging");
        window.removeEventListener("pointermove", onSubtitlePointerMove);
        window.removeEventListener("pointerup", endSubtitleDrag);
        window.removeEventListener("pointercancel", endSubtitleDrag);
      }

      function getMiddlePosY(offsetValue) {
        const stageHeight = Math.max(1, subtitleOverlay.clientHeight || 1080);
        const offset = sanitizeOffset(offsetValue, "middle");
        const y = 540 + Math.round(offset * (1080 / stageHeight));
        return Math.max(0, Math.min(1080, y));
      }

      function buildAssContent(cues, normalColor, borderColor, borderWidthValue, fontSizeValue, alignValue, offsetValue) {
        const sizeNum = Number(fontSizeValue);
        const safeSize = Number.isFinite(sizeNum) && sizeNum > 0 ? Math.round(sizeNum) : 48;
        const borderNum = Number(borderWidthValue);
        const safeBorder = Number.isFinite(borderNum) && borderNum >= 0 ? Math.min(12, Math.round(borderNum)) : 2;
        const alignCode = getAlignmentCode(String(alignValue || "bottom"));
        const safeOffset = sanitizeOffset(offsetValue, String(alignValue || "bottom"));
        const middlePosY = alignCode === 5 ? getMiddlePosY(offsetValue) : null;
        const lines = [
          "[Script Info]",
          "ScriptType: v4.00+",
          "PlayResX: 1920",
          "PlayResY: 1080",
          "",
          "[V4+ Styles]",
          "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
          "Style: Default,Arial," + safeSize + "," + normalColor + ",&H000000FF,&H00000000," + borderColor + ",-1,0,0,0,100,100,0,0,3," + safeBorder + ",0," + alignCode + ",10,10," + safeOffset + ",1",
          "",
          "[Events]",
          "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
        ];
        for (const cue of cues) {
          const text = applyMultiHighlight(cue.text, cue.order, normalColor);
          const decorated = alignCode === 5 ? "{\\\\an5\\\\pos(960," + String(middlePosY) + ")}" + text : text;
          lines.push("Dialogue: 0," + toAssTime(cue.start) + "," + toAssTime(cue.end) + ",Default,,0,0,0,," + decorated);
        }
        return lines.join("\\n");
      }

      function showError(message) {
        outputAss.innerHTML = '<span class="error">' + message + "</span>";
        outputCmd.innerHTML = '<span class="error">' + message + "</span>";
        lastAssContent = "";
        downloadAssBtn.disabled = true;
      }

      prepareHighlightBtn.addEventListener("click", () => {
        cuesCache = parseCueBlocks(subtitleInput.value || "");
        if (cuesCache.length === 0) {
          preprocessBody.innerHTML = '<p class="preprocess-placeholder">未识别到有效字幕块，请确认格式为“时间轴 + 文本”。</p>';
          assignments = [];
          renderGroupedHighlights();
          refreshPreviewText();
          hideWordMenu();
          return;
        }
        pruneAssignmentsByCues();
        renderPreprocess();
        renderGroupedHighlights();
        refreshPreviewText();
      });

      preprocessBody.addEventListener("mouseup", () => {
        setTimeout(() => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            hideWordMenu();
            return;
          }
          const text = selection.toString().replace(/\\s+/g, " ").trim();
          if (!text) {
            hideWordMenu();
            return;
          }
          const range = selection.getRangeAt(0);
          if (!preprocessBody.contains(range.commonAncestorContainer)) {
            hideWordMenu();
            return;
          }
          const startCue = nodeToCue(range.startContainer);
          const endCue = nodeToCue(range.endContainer);
          if (!startCue || !endCue || startCue !== endCue) {
            hideWordMenu();
            return;
          }
          const cueOrder = Number(startCue.getAttribute("data-cue-order"));
          const cueIndexLabel = Number(startCue.getAttribute("data-cue-index"));
          if (!Number.isFinite(cueOrder) || !text) {
            hideWordMenu();
            return;
          }
          selectedContext = {
            cueOrder,
            cueIndexLabel,
            word: text,
            norm: normalizeWord(text)
          };
          const rect = range.getBoundingClientRect();
          showWordMenu(rect, selectedContext);
        }, 0);
      });

      wordMenuActions.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.getAttribute("data-action");
        if (action === "clear") return clearAssignment();
        if (action === "apply") {
          const configId = target.getAttribute("data-config-id");
          if (configId) applyAssignment(configId);
        }
      });

      document.addEventListener("mousedown", (event) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (wordMenu.hidden) return;
        if (wordMenu.contains(target)) return;
        hideWordMenu();
      });

      addConfigBtn.addEventListener("click", () => {
        configNameInput.value = "";
        configColorInput.value = "&H0000FFFF";
        syncPickerFromAssInput();
        configModal.hidden = false;
        configNameInput.focus();
      });

      cancelConfigBtn.addEventListener("click", () => {
        configModal.hidden = true;
      });

      configColorInput.addEventListener("input", syncPickerFromAssInput);
      configColorPicker.addEventListener("input", () => {
        configColorInput.value = cssHexToAssColor(configColorPicker.value);
      });

      saveConfigBtn.addEventListener("click", () => {
        const name = String(configNameInput.value || "").trim();
        if (!name) return;
        const color = normalizeAssColor(configColorInput.value, "&H0000FFFF");
        const id = "cfg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        highlightConfigs.push({ id, name, color });
        configModal.hidden = true;
        renderConfigList();
        renderGroupedHighlights();
      });

      configModal.addEventListener("mousedown", (event) => {
        if (event.target === configModal) configModal.hidden = true;
      });

      pickPreviewVideoBtn.addEventListener("click", () => {
        previewVideoInput.value = "";
        previewVideoInput.click();
      });

      previewVideoInput.addEventListener("change", (event) => {
        const file = event.target?.files?.[0];
        if (!file) return;
        if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
        previewVideoUrl = URL.createObjectURL(file);
        previewVideo.src = previewVideoUrl;
        previewVideoMeta = null;
        updatePreviewMetaDisplay(file.name);
        previewVideo.dataset.fileName = file.name;
        previewVideo.load();
        updatePreviewOverlayAndText();
      });

      previewVideo.addEventListener("loadedmetadata", () => {
        previewVideoMeta = {
          width: previewVideo.videoWidth || 0,
          height: previewVideo.videoHeight || 0,
          duration: previewVideo.duration || 0
        };
        updatePreviewStageAspect();
        updatePreviewMetaDisplay(previewVideo.dataset.fileName || "");
        updatePreviewOverlayAndText();
      });

      previewVideo.addEventListener("timeupdate", refreshPreviewText);
      previewVideo.addEventListener("seeked", refreshPreviewText);

      subtitleInput.addEventListener("input", refreshPreviewText);
      defaultColor.addEventListener("input", updatePreviewOverlayAndText);
      outlineColor.addEventListener("input", () => {
        syncOpacitySliderFromOutlineColor();
        updatePreviewOverlayAndText();
      });
      outlineOpacity.addEventListener("input", () => {
        applyOpacitySliderToOutlineColor();
        updatePreviewOverlayAndText();
      });
      outlineWidth.addEventListener("input", updatePreviewOverlayAndText);
      fontSize.addEventListener("input", updatePreviewOverlayAndText);
      subtitleAlign.addEventListener("change", updatePreviewOverlayAndText);
      subtitleOffset.addEventListener("input", updatePreviewOverlayAndText);
      lockMiddleDrag.addEventListener("change", () => {
        if (lockMiddleDrag.checked) subtitleAlign.value = "middle";
        updatePreviewOverlayAndText();
      });
      subtitleOverlayText.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        dragState = { startY: event.clientY, moved: false };
        subtitleOverlayText.classList.add("dragging");
        window.addEventListener("pointermove", onSubtitlePointerMove);
        window.addEventListener("pointerup", endSubtitleDrag);
        window.addEventListener("pointercancel", endSubtitleDrag);
      });

      generateAssBtn.addEventListener("click", () => {
        const cues = parseCueBlocks(subtitleInput.value || "");
        if (cues.length === 0) return showError("未识别到有效字幕块，请使用“时间轴 + 文本”格式；[001] 可选，仅作顺序标记。");
        if (assignments.length === 0) return showError("请先在“高亮预处理文案”里选词并设置至少一条高亮配置。");

        const normalColor = normalizeAssColor(defaultColor.value, "&H00FFFFFF");
        const borderColor = normalizeAssColor(outlineColor.value, "&H00000000");
        const ass = buildAssContent(cues, normalColor, borderColor, outlineWidth.value, fontSize.value, subtitleAlign.value, subtitleOffset.value);
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

      renderConfigList();
      renderGroupedHighlights();
      syncOpacitySliderFromOutlineColor();
      updatePreviewStageAspect();
      updatePreviewOverlayAndText();
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
