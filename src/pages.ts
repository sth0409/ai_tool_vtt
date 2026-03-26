export const EXTRACT_PAGE = `<!doctype html>
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
      .compress-option {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: #cbd5e1;
      }
      .compress-option input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
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
      .segments-editor {
        border: 1px solid #1e293b;
        border-radius: 10px;
        padding: 10px;
        background: #000814;
        min-height: 170px;
      }
      .segment-row {
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 10px;
        margin-bottom: 10px;
        background: #020617;
      }
      .segment-row:last-child { margin-bottom: 0; }
      .segment-row.drag-over { border-color: #38bdf8; background: #062038; }
      .segment-meta {
        font-size: 12px;
        color: #93c5fd;
        margin-bottom: 8px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .segment-words {
        min-height: 34px;
        border: 1px dashed #334155;
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .segment-word {
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 4px 8px;
        background: #111827;
        color: #e2e8f0;
        cursor: grab;
        user-select: none;
        font-size: 13px;
      }
      .segment-word.dragging { opacity: 0.45; }
      .segment-word.drop-before { outline: 2px solid #22d3ee; }
      .segment-word.drop-after { outline: 2px solid #a78bfa; }
      .segments-empty {
        margin: 0;
        color: #94a3b8;
        font-size: 13px;
      }
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
        <label class="compress-option">
          <input id="transcodeBeforeUpload" type="checkbox" checked />
          上传前先转小音频（mp3，16kHz 单声道）
        </label>
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
          <h2 class="result-title">Segments（可拖拽词级纠错）</h2>
          <p class="result-tip">每个词可拖拽到其他句子，放开后自动重算该句时间戳与 VTT。</p>
          <div id="outputSegments" class="segments-editor">这里会显示 Segments 结果...</div>
        </div>
      </section>
    </main>
    <script src="/vendor/ffmpeg/ffmpeg.js"></script>
    <script src="/vendor/ffmpeg-util/index.js"></script>
    <script>
      const dropzone = document.getElementById("dropzone");
      const fileInput = document.getElementById("fileInput");
      const pickFileBtn = document.getElementById("pickFileBtn");
      const extractBtn = document.getElementById("extractBtn");
      const transcodeBeforeUpload = document.getElementById("transcodeBeforeUpload");
      const outputVtt = document.getElementById("outputVtt");
      const outputText = document.getElementById("outputText");
      const outputSegments = document.getElementById("outputSegments");
      const fileInfo = document.getElementById("fileInfo");
      const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
      let selectedFile = null;
      let ffmpegInstance = null;
      let ffmpegLoadPromise = null;
      let wordTimeline = [];
      let editableSegmentRows = [];
      let draggingWordId = "";

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

      function replaceExtension(filename, nextExt) {
        const dotIndex = filename.lastIndexOf(".");
        if (dotIndex <= 0) return filename + nextExt;
        return filename.slice(0, dotIndex) + nextExt;
      }

      function isCrossOriginWorkerError(error) {
        const message = (error && error.message ? String(error.message) : String(error || "")).toLowerCase();
        return message.includes("failed to construct 'worker'")
          || message.includes("cannot be accessed from origin")
          || message.includes("cross-origin")
          || message.includes("script at");
      }

      function buildLocalFfmpegCommand(fileName) {
        return "ffmpeg -i \\"" + fileName + "\\" -vn -ac 1 -ar 16000 -b:a 48k \\"output-16k-mono.mp3\\"";
      }

      function refreshFileState() {
        extractBtn.disabled = !selectedFile;
        if (!selectedFile) {
          fileInfo.textContent = "尚未选择文件";
          return;
        }
        if (selectedFile.size > MAX_UPLOAD_BYTES && !transcodeBeforeUpload.checked) {
          extractBtn.disabled = true;
          fileInfo.textContent = selectedFile.name + " (" + formatBytes(selectedFile.size) + ")，文件过大，请启用“上传前先转小音频”或先压缩到 50MB 内";
          return;
        }
        if (selectedFile.size > MAX_UPLOAD_BYTES && transcodeBeforeUpload.checked) {
          fileInfo.textContent = selectedFile.name + " (" + formatBytes(selectedFile.size) + ")，上传前会先转成小音频";
          return;
        }
        fileInfo.textContent = selectedFile.name + " (" + formatBytes(selectedFile.size) + ")";
      }

      function setFile(file) {
        selectedFile = file;
        refreshFileState();
      }

      async function ensureFfmpegReady() {
        if (ffmpegInstance) return ffmpegInstance;
        if (ffmpegLoadPromise) return ffmpegLoadPromise;

        ffmpegLoadPromise = (async () => {
          const ffmpegLib = window.FFmpegWASM;
          const ffmpegUtil = window.FFmpegUtil;
          if (!ffmpegLib || !ffmpegUtil) {
            throw new Error("浏览器端转码依赖加载失败，请检查网络后重试，或取消转码后直接上传。");
          }

          const FFmpeg = ffmpegLib.FFmpeg;
          if (typeof FFmpeg !== "function") {
            throw new Error("浏览器端转码环境不可用，请刷新页面后重试。");
          }

          const ffmpeg = new FFmpeg();
          const baseURL = window.location.origin + "/vendor/ffmpeg-core";
          const coreURL = baseURL + "/ffmpeg-core.js";
          const wasmURL = baseURL + "/ffmpeg-core.wasm";
          const workerURL = baseURL + "/ffmpeg-core.worker.js";
          await ffmpeg.load({ coreURL: coreURL, wasmURL: wasmURL, workerURL: workerURL });
          ffmpegInstance = ffmpeg;
          return ffmpeg;
        })();

        try {
          return await ffmpegLoadPromise;
        } catch (error) {
          ffmpegLoadPromise = null;
          throw error;
        }
      }

      async function transcodeToCompactAudio(file) {
        const ffmpeg = await ensureFfmpegReady();
        const fetchFile = window.FFmpegUtil && window.FFmpegUtil.fetchFile;
        if (typeof fetchFile !== "function") {
          throw new Error("浏览器端转码工具未就绪，请刷新页面后重试。");
        }

        const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase() : "bin";
        const inputName = "input-" + Date.now() + "." + ext;
        const outputName = "output-" + Date.now() + ".mp3";

        await ffmpeg.writeFile(inputName, await fetchFile(file));
        try {
          await ffmpeg.exec(["-i", inputName, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", outputName]);
          const data = await ffmpeg.readFile(outputName);
          if (!data || data.length === 0) {
            throw new Error("转码结果为空，请更换文件重试。");
          }
          const blob = new Blob([data.buffer], { type: "audio/mpeg" });
          return new File([blob], replaceExtension(file.name, "-16k-mono.mp3"), { type: "audio/mpeg" });
        } finally {
          try { await ffmpeg.deleteFile(inputName); } catch {}
          try { await ffmpeg.deleteFile(outputName); } catch {}
        }
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

      function parseVttTimestamp(raw) {
        const value = String(raw || "").trim();
        const parts = value.split(":");
        if (parts.length !== 2 && parts.length !== 3) return NaN;
        let hour = 0;
        let minute = 0;
        let secWithMs = "";
        if (parts.length === 3) {
          hour = Number(parts[0]);
          minute = Number(parts[1]);
          secWithMs = parts[2];
        } else {
          minute = Number(parts[0]);
          secWithMs = parts[1];
        }
        const secParts = secWithMs.split(".");
        const second = Number(secParts[0]);
        const ms = Number((secParts[1] || "0").padEnd(3, "0").slice(0, 3));
        if (![hour, minute, second, ms].every(Number.isFinite)) return NaN;
        return hour * 3600 + minute * 60 + second + ms / 1000;
      }

      function formatVttTimestamp(seconds) {
        const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
        const totalMs = Math.floor(safe * 1000);
        const hour = Math.floor(totalMs / 3600000);
        const minute = Math.floor((totalMs % 3600000) / 60000);
        const second = Math.floor((totalMs % 60000) / 1000);
        const ms = totalMs % 1000;
        return String(hour).padStart(2, "0")
          + ":" + String(minute).padStart(2, "0")
          + ":" + String(second).padStart(2, "0")
          + "." + String(ms).padStart(3, "0");
      }

      function escapeHtml(text) {
        return String(text || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function parseWordTimelineFromVtt(vttText) {
        const lines = String(vttText || "").replace(/\\r\\n/g, "\\n").split("\\n");
        const words = [];
        let index = 0;
        for (let i = 0; i < lines.length; i += 1) {
          const timeLine = lines[i].trim();
          if (!timeLine || !timeLine.includes("-->") || timeLine.startsWith("WEBVTT")) continue;
          const parts = timeLine.split("-->");
          const start = parseVttTimestamp(parts[0]);
          const end = parseVttTimestamp(parts[1]);
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
          const textLines = [];
          let j = i + 1;
          while (j < lines.length && lines[j].trim() !== "") {
            textLines.push(lines[j]);
            j += 1;
          }
          const token = textLines.join(" ").replace(/\\s+/g, " ").trim();
          if (token) {
            words.push({ id: "w-" + index, text: token, start, end });
            index += 1;
          }
          i = j;
        }
        return words;
      }

      function normalizeSegmentsHint(rawSegments) {
        if (!Array.isArray(rawSegments)) return [];
        return rawSegments
          .map((segment) => {
            const start = Number(segment?.start);
            const end = Number(segment?.end);
            const text = typeof segment?.text === "string" ? segment.text.trim() : "";
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
            return { start, end, text };
          })
          .filter(Boolean);
      }

      function buildRowsFromWords(words, rawSegments) {
        const segments = normalizeSegmentsHint(rawSegments);
        const rows = [];

        if (segments.length > 0) {
          const unused = new Set(words.map((word) => word.id));
          for (let i = 0; i < segments.length; i += 1) {
            const segment = segments[i];
            const ids = words
              .filter((word) => {
                if (!unused.has(word.id)) return false;
                const mid = (word.start + word.end) / 2;
                return mid >= segment.start - 0.02 && mid <= segment.end + 0.02;
              })
              .map((word) => word.id);
            ids.forEach((id) => unused.delete(id));
            if (ids.length > 0) rows.push({ id: "r-" + i, wordIds: ids });
          }
          const leftovers = words.filter((word) => unused.has(word.id));
          for (const word of leftovers) {
            if (rows.length === 0) rows.push({ id: "r-0", wordIds: [word.id] });
            else rows[rows.length - 1].wordIds.push(word.id);
          }
        }

        if (rows.length === 0) {
          let current = { id: "r-0", wordIds: [] };
          let rowIndex = 0;
          for (let i = 0; i < words.length; i += 1) {
            const word = words[i];
            const previous = i > 0 ? words[i - 1] : null;
            const gap = previous ? word.start - previous.end : 0;
            const shouldSplit = current.wordIds.length > 0 && (
              gap >= 0.42
              || /[.!?。！？]$/.test(previous?.text || "")
              || current.wordIds.length >= 12
            );
            if (shouldSplit) {
              rows.push(current);
              rowIndex += 1;
              current = { id: "r-" + rowIndex, wordIds: [] };
            }
            current.wordIds.push(word.id);
          }
          if (current.wordIds.length > 0) rows.push(current);
        }

        return rows.filter((row) => row.wordIds.length > 0);
      }

      function getWordById(wordId) {
        return wordTimeline.find((item) => item.id === wordId) || null;
      }

      function buildRowDataList() {
        const rows = [];
        for (let i = 0; i < editableSegmentRows.length; i += 1) {
          const row = editableSegmentRows[i];
          const words = row.wordIds
            .map((id) => getWordById(id))
            .filter(Boolean)
            .sort((a, b) => a.start - b.start);
          if (words.length === 0) continue;
          const start = words[0].start;
          const end = words[words.length - 1].end;
          const text = words.map((word) => word.text).join(" ").replace(/\\s+([,.!?;:])/g, "$1").trim();
          rows.push({ index: rows.length + 1, rowId: row.id, words, start, end, text });
        }
        return rows;
      }

      function buildVttFromRows(rows) {
        if (!Array.isArray(rows) || rows.length === 0) return "";
        const blocks = ["WEBVTT", ""];
        for (const row of rows) {
          blocks.push(formatVttTimestamp(row.start) + " --> " + formatVttTimestamp(row.end));
          blocks.push(row.text || "(空文本)");
          blocks.push("");
        }
        return blocks.join("\\n").trim() + "\\n";
      }

      function buildTextFromRows(rows) {
        if (!Array.isArray(rows) || rows.length === 0) return "";
        return rows.map((row) => row.text).filter(Boolean).join("\\n");
      }

      function clearSegmentDropStyles() {
        outputSegments.querySelectorAll(".segment-row.drag-over").forEach((el) => el.classList.remove("drag-over"));
        outputSegments.querySelectorAll(".segment-word.drop-before").forEach((el) => el.classList.remove("drop-before"));
        outputSegments.querySelectorAll(".segment-word.drop-after").forEach((el) => el.classList.remove("drop-after"));
      }

      function renderSegmentsEditor() {
        const rows = buildRowDataList();
        if (rows.length === 0) {
          outputSegments.innerHTML = '<p class="segments-empty">没有可编辑的词级时间轴数据。请检查识别结果里是否包含词级 VTT。</p>';
          return;
        }
        outputSegments.innerHTML = rows.map((row) => {
          const wordsHtml = row.words.map((word) => (
            '<span class="segment-word" draggable="true" data-word-id="' + word.id + '">' + escapeHtml(word.text) + '</span>'
          )).join("");
          return ''
            + '<div class="segment-row" data-row-id="' + row.rowId + '">'
            +   '<div class="segment-meta">[' + String(row.index).padStart(3, "0") + '] '
            +     formatSeconds(row.start) + ' --> ' + formatSeconds(row.end)
            +   '</div>'
            +   '<div class="segment-words" data-row-id="' + row.rowId + '">' + wordsHtml + '</div>'
            + '</div>';
        }).join("");
      }

      function syncOutputsFromRows() {
        const rows = buildRowDataList();
        if (rows.length === 0) return;
        outputVtt.textContent = buildVttFromRows(rows);
        outputText.textContent = buildTextFromRows(rows);
      }

      function initializeEditableSegments(vttText, rawSegments) {
        wordTimeline = parseWordTimelineFromVtt(vttText);
        if (wordTimeline.length === 0) {
          editableSegmentRows = [];
          outputSegments.textContent = Array.isArray(rawSegments) && rawSegments.length > 0
            ? rawSegments.map((segment, index) => {
                const start = formatSeconds(segment?.start);
                const end = formatSeconds(segment?.end);
                const text = typeof segment?.text === "string" ? segment.text.trim() : "";
                return "[" + String(index + 1).padStart(3, "0") + "] " + start + " --> " + end + "\\n" + (text || "(空文本)");
              }).join("\\n\\n")
            : "没有返回 Segments 内容";
          return;
        }
        editableSegmentRows = buildRowsFromWords(wordTimeline, rawSegments);
        renderSegmentsEditor();
        syncOutputsFromRows();
      }

      function getRowById(rowId) {
        return editableSegmentRows.find((row) => row.id === rowId) || null;
      }

      function moveWord(wordId, targetRowId, targetWordId, insertAfter) {
        if (!wordId || !targetRowId) return;
        const sourceRow = editableSegmentRows.find((row) => row.wordIds.includes(wordId));
        const targetRow = getRowById(targetRowId);
        if (!sourceRow || !targetRow) return;

        const sourceIndex = sourceRow.wordIds.indexOf(wordId);
        if (sourceIndex < 0) return;
        sourceRow.wordIds.splice(sourceIndex, 1);

        let insertIndex = targetRow.wordIds.length;
        if (targetWordId) {
          const hit = targetRow.wordIds.indexOf(targetWordId);
          if (hit >= 0) insertIndex = insertAfter ? hit + 1 : hit;
        }
        if (sourceRow === targetRow && sourceIndex < insertIndex) {
          insertIndex -= 1;
        }
        targetRow.wordIds.splice(Math.max(0, insertIndex), 0, wordId);
        editableSegmentRows = editableSegmentRows.filter((row) => row.wordIds.length > 0);
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

      transcodeBeforeUpload.addEventListener("change", refreshFileState);

      outputSegments.addEventListener("dragstart", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.classList.contains("segment-word")) return;
        draggingWordId = target.getAttribute("data-word-id") || "";
        target.classList.add("dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", draggingWordId);
        }
      });

      outputSegments.addEventListener("dragend", () => {
        clearSegmentDropStyles();
        outputSegments.querySelectorAll(".segment-word.dragging").forEach((el) => el.classList.remove("dragging"));
        draggingWordId = "";
      });

      outputSegments.addEventListener("dragover", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !draggingWordId) return;
        const row = target.closest("[data-row-id]");
        if (!row) return;
        event.preventDefault();
        clearSegmentDropStyles();
        row.classList.add("drag-over");
        const word = target.closest(".segment-word");
        if (word instanceof HTMLElement) {
          const rect = word.getBoundingClientRect();
          const after = event.clientX > rect.left + rect.width / 2;
          word.classList.add(after ? "drop-after" : "drop-before");
        }
      });

      outputSegments.addEventListener("dragleave", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest(".segment-row");
        if (row instanceof HTMLElement && !row.contains(event.relatedTarget)) {
          row.classList.remove("drag-over");
        }
      });

      outputSegments.addEventListener("drop", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const rowEl = target.closest(".segment-row");
        if (!(rowEl instanceof HTMLElement) || !draggingWordId) return;
        event.preventDefault();

        const targetRowId = rowEl.getAttribute("data-row-id") || "";
        const tokenEl = target.closest(".segment-word");
        let targetWordId = "";
        let insertAfter = true;
        if (tokenEl instanceof HTMLElement) {
          targetWordId = tokenEl.getAttribute("data-word-id") || "";
          const rect = tokenEl.getBoundingClientRect();
          insertAfter = event.clientX > rect.left + rect.width / 2;
        }

        moveWord(draggingWordId, targetRowId, targetWordId, insertAfter);
        clearSegmentDropStyles();
        draggingWordId = "";
        renderSegmentsEditor();
        syncOutputsFromRows();
      });

      extractBtn.addEventListener("click", async () => {
        if (!selectedFile) return;
        if (selectedFile.size > MAX_UPLOAD_BYTES && !transcodeBeforeUpload.checked) {
          const message = "文件超过 50MB，建议先压缩视频或提取音频后再上传。";
          outputVtt.innerHTML = '<span class="error">' + message + "</span>";
          outputText.innerHTML = '<span class="error">' + message + "</span>";
          outputSegments.innerHTML = '<span class="error">' + message + "</span>";
          return;
        }

        outputVtt.textContent = "正在提取字幕，请稍候...";
        outputText.textContent = "正在提取字幕，请稍候...";
        outputSegments.textContent = "正在提取字幕，请稍候...";
        wordTimeline = [];
        editableSegmentRows = [];
        extractBtn.disabled = true;
        pickFileBtn.disabled = true;

        try {
          let uploadFile = selectedFile;
          if (transcodeBeforeUpload.checked && (selectedFile.type.startsWith("video/") || selectedFile.type.startsWith("audio/"))) {
            outputVtt.textContent = "正在本地转音频（mp3, 16kHz 单声道），首次可能较慢...";
            outputText.textContent = "正在本地转音频，请勿关闭页面...";
            outputSegments.textContent = "正在本地转音频，请稍候...";
            try {
              uploadFile = await transcodeToCompactAudio(selectedFile);
              outputVtt.textContent = "本地转音频完成，正在上传并提取字幕...";
              outputText.textContent = "原文件 " + formatBytes(selectedFile.size) + "，转码后 " + formatBytes(uploadFile.size);
              outputSegments.textContent = "正在调用识别服务...";
            } catch (transcodeError) {
              if (selectedFile.size <= MAX_UPLOAD_BYTES) {
                uploadFile = selectedFile;
                const warning = isCrossOriginWorkerError(transcodeError)
                  ? "浏览器转码失败（当前站点不允许跨域 Worker），已自动回退为直接上传原文件。"
                  : "浏览器转码失败，已自动回退为直接上传原文件。";
                outputVtt.textContent = warning + " 正在提取字幕...";
                outputText.textContent = "回退原因：" + (transcodeError?.message || "未知错误");
                outputSegments.textContent = "正在调用识别服务...";
              } else {
                if (isCrossOriginWorkerError(transcodeError)) {
                  throw new Error(
                    "当前域名下浏览器转码被跨域 Worker 限制，且原文件超过 50MB 无法直传。\\n"
                    + "请先本地执行：\\n" + buildLocalFfmpegCommand(selectedFile.name)
                  );
                }
                throw transcodeError;
              }
            }
          }

          if (uploadFile.size > MAX_UPLOAD_BYTES) {
            throw new Error("转码后文件仍超过 50MB。建议把视频切成更短片段后再试。");
          }

          const formData = new FormData();
          formData.append("file", uploadFile);
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
          const vttText = typeof result.vtt === "string" ? result.vtt : "";
          outputVtt.textContent = vttText || "没有返回 VTT 内容";
          outputText.textContent = typeof result.text === "string" ? result.text : "没有返回 Text 内容";
          initializeEditableSegments(vttText, result.segments);
        } catch (error) {
          const message = error?.message || "请求失败";
          outputVtt.innerHTML = '<span class="error">' + message + "</span>";
          outputText.innerHTML = '<span class="error">' + message + "</span>";
          outputSegments.innerHTML = '<span class="error">' + message + "</span>";
        } finally {
          pickFileBtn.disabled = false;
          refreshFileState();
        }
      });
    </script>
  </body>
</html>`;

export const ASS_PAGE = `<!doctype html>
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
      .cue-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      .cue-main {
        min-width: 0;
        flex: 1;
      }
      .cue-actions {
        flex: 0 0 auto;
      }
      .line-retry-btn {
        padding: 6px 10px;
        font-size: 12px;
        background: #334155;
      }
      .line-edit-btn {
        padding: 6px 10px;
        font-size: 12px;
        background: #1d4ed8;
      }
      .line-edit-btn:hover { background: #2563eb; }
      .line-retry-btn.is-running { background: #475569; }
      .line-retry-btn.is-success { background: #166534; }
      .line-retry-btn.is-error { background: #991b1b; }
      .cue-meta {
        color: #94a3b8;
        font-size: 12px;
        margin-bottom: 6px;
      }
      .cue-text { font-size: 14px; user-select: text; white-space: pre-wrap; word-break: break-word; }
      .cue-translation {
        margin-top: 6px;
        font-size: 13px;
        color: #93c5fd;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .word-hit {
        border-radius: 4px;
        color: #0f172a;
        padding: 0 2px;
      }
      .ai-status {
        margin-top: 8px;
        min-height: 20px;
        color: #94a3b8;
        font-size: 12px;
      }
      .debug-box {
        margin-top: 8px;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 10px;
        background: #000814;
        max-height: 220px;
        overflow: auto;
      }
      .debug-box[hidden] { display: none; }
      .debug-box pre {
        margin: 0;
        font-size: 12px;
        line-height: 1.4;
        white-space: pre-wrap;
      }
      .ai-log-toolbar {
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .ai-log-meta {
        color: #94a3b8;
        font-size: 12px;
      }
      .ai-log-box {
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 10px;
        background: #000814;
        min-height: 120px;
        max-height: 280px;
        overflow: auto;
      }
      .ai-log-box pre {
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .checkbox-inline {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #cbd5e1;
      }
      .checkbox-inline input {
        width: auto;
      }
      .subtitle-zh {
        display: block;
        margin-top: 4px;
        font-size: 0.72em;
        color: #e2e8f0;
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
      .group-title-main { display: inline-flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
      .group-title-actions { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
      .group-action-btn {
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 4px 8px;
        background: #0f172a;
        color: #cbd5e1;
        font-size: 12px;
        cursor: pointer;
      }
      .group-action-btn.danger {
        border-color: #7f1d1d;
        background: #3f1010;
        color: #fecaca;
      }
      .group-action-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .group-batch-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 6px;
      }
      .group-batch-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        color: #cbd5e1;
        font-size: 13px;
        line-height: 1.4;
      }
      .group-batch-item input { margin-top: 2px; }
      .group-batch-empty {
        margin: 0;
        color: #94a3b8;
        font-size: 12px;
      }
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
        max-width: 760px;
        margin-left: auto;
        margin-right: auto;
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
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        padding: 0 16px 40px;
      }
      .subtitle-overlay-text {
        max-width: calc(100% - 20px);
        border-radius: 6px;
        padding: 4px 12px;
        font-size: 40px;
        font-family: Arial, "Segoe UI", sans-serif;
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
      .toolkit-grid { display: grid; gap: 10px; }
      .toolkit-inline {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .toolkit-note {
        margin: 6px 0 0;
        font-size: 12px;
        color: #94a3b8;
        line-height: 1.5;
      }
      .toolkit-status {
        min-height: 20px;
        margin-top: 8px;
        font-size: 13px;
        color: #94a3b8;
      }
      .toolkit-status.error { color: #fca5a5; }
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
        <button id="aiClassifyBtn" type="button">AI 智能选词+翻译</button>
        <button id="addConfigBtn" type="button" class="subtle-btn">增加高亮配置</button>
        <label class="checkbox-inline"><input id="aiDebugToggle" type="checkbox" /> 调试模式（显示AI原始返回摘要）</label>
      </div>
      <div id="aiStatus" class="ai-status"></div>
      <div id="aiDebugBox" class="debug-box" hidden><pre id="aiDebugOutput"></pre></div>

      <div class="field">
        <label>当前高亮配置</label>
        <div id="configList" class="config-list"></div>
        <div class="hint-line">先添加高亮配置，再在“高亮预处理文案”里选词进行绑定。</div>
      </div>

      <section class="result">
        <div class="result-card">
          <h2 class="result-title">高亮预处理文案</h2>
          <p class="result-tip">点击“高亮编辑操作”后按行显示字幕。鼠标选中单词/短语会弹出操作面板；每行右侧可单独重试 AI。</p>
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
          <label class="checkbox-inline"><input id="includeZhInAss" type="checkbox" /> ASS 双语（第二行中文）</label>
        </div>
        <div class="field">
          <label for="zhFontScale">中文字号比例（0.5-1.0）</label>
          <input id="zhFontScale" type="text" value="0.7" />
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
          <label for="subtitleOffset">Y 轴位置（距底部像素）</label>
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
        <button id="downloadToolkitBtn" type="button" class="subtle-btn" disabled>一键工具包配置</button>
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

      <section class="result">
        <div class="result-card">
          <h2 class="result-title">AI 处理日志</h2>
          <div class="ai-log-toolbar">
            <span id="aiLogMeta" class="ai-log-meta">尚无日志</span>
            <button id="clearAiLogBtn" type="button" class="subtle-btn">清空日志</button>
          </div>
          <div class="ai-log-box">
            <pre id="aiLogOutput">尚无日志</pre>
          </div>
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

    <div id="lineEditModal" class="modal" hidden>
      <div class="modal-card">
        <h2 class="modal-title">编辑本行</h2>
        <div class="field">
          <label for="lineEditTextInput">英文文本</label>
          <textarea id="lineEditTextInput" placeholder="输入本行英文"></textarea>
        </div>
        <div class="field">
          <label for="lineEditZhInput">中文翻译</label>
          <textarea id="lineEditZhInput" placeholder="输入本行中文翻译（可留空）"></textarea>
        </div>
        <div class="modal-actions">
          <button id="cancelLineEditBtn" type="button" class="subtle-btn">取消</button>
          <button id="saveLineEditBtn" type="button">保存</button>
        </div>
      </div>
    </div>

    <div id="toolkitModal" class="modal" hidden>
      <div class="modal-card">
        <h2 class="modal-title">一键工具包配置（Mac .command）</h2>
        <div class="toolkit-grid">
          <div class="field">
            <label for="toolkitFfmpegPathInput">1) ffmpeg 位置设置</label>
            <input id="toolkitFfmpegPathInput" type="text" placeholder="/usr/local/bin/ffmpeg" />
            <div class="toolkit-inline" style="margin-top:8px;">
              <button id="downloadFfmpegBtn" type="button" class="subtle-btn">下载 ffmpeg</button>
            </div>
            <p class="toolkit-note">可在终端执行 <code>which ffmpeg</code>（macOS/Linux）或 <code>where ffmpeg</code>（Windows）查路径。未安装请先下载并解压，再填写可执行文件路径。</p>
          </div>
          <div class="field">
            <label for="toolkitOutputNameInput">2) 合并后新文件名（同目录）</label>
            <input id="toolkitOutputNameInput" type="text" placeholder="留空则自动用 原文件名_merge_subtitle" />
            <p class="toolkit-note">脚本执行时会弹出文件选择器选视频；输出到源视频同一目录。</p>
          </div>
        </div>
        <div id="toolkitStatus" class="toolkit-status"></div>
        <div class="modal-actions">
          <button id="cancelToolkitBtn" type="button" class="subtle-btn">取消</button>
          <button id="confirmToolkitBtn" type="button">打包下载</button>
        </div>
      </div>
    </div>

    <script>
      const subtitleInput = document.getElementById("subtitleInput");
      const prepareHighlightBtn = document.getElementById("prepareHighlightBtn");
      const aiClassifyBtn = document.getElementById("aiClassifyBtn");
      const aiStatus = document.getElementById("aiStatus");
      const aiDebugToggle = document.getElementById("aiDebugToggle");
      const aiDebugBox = document.getElementById("aiDebugBox");
      const aiDebugOutput = document.getElementById("aiDebugOutput");
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
      const lineEditModal = document.getElementById("lineEditModal");
      const lineEditTextInput = document.getElementById("lineEditTextInput");
      const lineEditZhInput = document.getElementById("lineEditZhInput");
      const cancelLineEditBtn = document.getElementById("cancelLineEditBtn");
      const saveLineEditBtn = document.getElementById("saveLineEditBtn");

      const defaultColor = document.getElementById("defaultColor");
      const outlineColor = document.getElementById("outlineColor");
      const outlineOpacity = document.getElementById("outlineOpacity");
      const outlineOpacityValue = document.getElementById("outlineOpacityValue");
      const outlineWidth = document.getElementById("outlineWidth");
      const subtitleOffset = document.getElementById("subtitleOffset");
      const fontSize = document.getElementById("fontSize");
      const includeZhInAss = document.getElementById("includeZhInAss");
      const zhFontScale = document.getElementById("zhFontScale");
      const pickPreviewVideoBtn = document.getElementById("pickPreviewVideoBtn");
      const previewVideoInput = document.getElementById("previewVideoInput");
      const previewFileInfo = document.getElementById("previewFileInfo");
      const previewStage = document.getElementById("previewStage");
      const previewVideo = document.getElementById("previewVideo");
      const subtitleOverlay = document.getElementById("subtitleOverlay");
      const subtitleOverlayText = document.getElementById("subtitleOverlayText");
      const generateAssBtn = document.getElementById("generateAssBtn");
      const downloadAssBtn = document.getElementById("downloadAssBtn");
      const downloadToolkitBtn = document.getElementById("downloadToolkitBtn");
      const outputAss = document.getElementById("outputAss");
      const outputCmd = document.getElementById("outputCmd");
      const aiLogMeta = document.getElementById("aiLogMeta");
      const clearAiLogBtn = document.getElementById("clearAiLogBtn");
      const aiLogOutput = document.getElementById("aiLogOutput");
      const toolkitModal = document.getElementById("toolkitModal");
      const toolkitFfmpegPathInput = document.getElementById("toolkitFfmpegPathInput");
      const downloadFfmpegBtn = document.getElementById("downloadFfmpegBtn");
      const toolkitOutputNameInput = document.getElementById("toolkitOutputNameInput");
      const toolkitStatus = document.getElementById("toolkitStatus");
      const cancelToolkitBtn = document.getElementById("cancelToolkitBtn");
      const confirmToolkitBtn = document.getElementById("confirmToolkitBtn");

      let lastAssContent = "";
      let previewVideoUrl = "";
      let dragState = null;
      let previewVideoMeta = null;
      let cuesCache = [];
      let cueAiRowsByOrder = {};
      let cueRetryStatusByOrder = {};
      let cueTranslations = {};
      let highlightConfigs = [
        { id: "cfg-default", name: "默认高亮", color: "&H0000FFFF" }
      ];
      let assignments = [];
      let batchManageGroupId = "";
      let batchManageSelectedKeys = new Set();
      let selectedContext = null;
      let editingCueOrder = null;
      let aiAnalyzing = false;
      let aiLogs = [];
      const AI_HVC_LOW_VALUE_WORDS = new Set([
        "a", "an", "the", "this", "that", "these", "those", "it", "its", "i", "you", "he", "she", "we", "they",
        "me", "him", "her", "us", "them", "my", "your", "his", "our", "their",
        "is", "am", "are", "was", "were", "be", "been", "being", "do", "does", "did", "have", "has", "had",
        "go", "goes", "went", "gone", "come", "comes", "came", "get", "gets", "got", "make", "makes", "made",
        "take", "takes", "took", "see", "saw", "seen", "look", "looks", "looked", "want", "need", "use", "used",
        "people", "person", "thing", "things", "time", "day", "year", "man", "woman", "friend", "family",
        "good", "bad", "nice", "great", "easy", "hard", "simple", "small", "big", "new", "old",
        "very", "really", "just", "also", "maybe", "always", "often", "usually", "sometimes"
      ]);

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

      function setToolkitStatus(message, isError) {
        if (!toolkitStatus) return;
        toolkitStatus.textContent = String(message || "");
        toolkitStatus.classList.toggle("error", Boolean(isError));
      }

      function shellEscapeDoubleQuoted(value) {
        return String(value || "")
          .replace(/\\/g, "\\\\")
          .replace(/"/g, "\\\"")
          .replace(/\$/g, "\\$");
      }

      function getPathLeaf(pathValue) {
        const cleaned = String(pathValue || "").trim().replace(/[\\\\/]+$/g, "");
        if (!cleaned) return "";
        const parts = cleaned.split(/[\\\\/]/).filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1] : "";
      }

      function splitNameExt(filename) {
        const name = String(filename || "").trim();
        if (!name) return { base: "", ext: "" };
        const dot = name.lastIndexOf(".");
        if (dot <= 0 || dot === name.length - 1) return { base: name, ext: "" };
        return { base: name.slice(0, dot), ext: name.slice(dot) };
      }

      function buildMergedOutputName(videoName) {
        const leaf = getPathLeaf(videoName) || "input.mp4";
        const parsed = splitNameExt(leaf);
        return parsed.base + "_merge_subtitle" + (parsed.ext || ".mp4");
      }

      function ensureOutputNameExtension(outputName, fallbackVideoName) {
        const trimmed = String(outputName || "").trim();
        if (!trimmed) return buildMergedOutputName(fallbackVideoName);
        if (trimmed.includes(".")) return trimmed;
        const ext = splitNameExt(getPathLeaf(fallbackVideoName)).ext || ".mp4";
        return trimmed + ext;
      }

      function openToolkitModal() {
        if (!toolkitModal) return;
        if (toolkitOutputNameInput && !toolkitOutputNameInput.value.trim()) {
          const previewName = String(previewVideo?.dataset?.fileName || "").trim();
          toolkitOutputNameInput.value = buildMergedOutputName(previewName || "input.mp4");
        }
        setToolkitStatus("", false);
        toolkitModal.hidden = false;
      }

      function closeToolkitModal() {
        if (!toolkitModal) return;
        toolkitModal.hidden = true;
        setToolkitStatus("", false);
      }

      function buildToolkitCommandScript(ffmpegPath, outputName) {
        const safeFfmpegPath = shellEscapeDoubleQuoted(ffmpegPath);
        const safeOutputName = shellEscapeDoubleQuoted(outputName);
        return [
          "#!/bin/zsh",
          "set -e",
          "",
          "SCRIPT_DIR=\\"$(cd \\"$(dirname \\"$0\\")\\" && pwd)\\"",
          "ASS_FILE=\\"$SCRIPT_DIR/subtitle.ass\\"",
          "FFMPEG_BIN=\\"" + safeFfmpegPath + "\\"",
          "OUTPUT_NAME=\\"" + safeOutputName + "\\"",
          "INPUT_VIDEO=$(osascript -e 'try' -e 'POSIX path of (choose file with prompt \"请选择要合并字幕的视频文件\")' -e 'on error number -128' -e 'return \"\"' -e 'end try')",
          "INPUT_VIDEO=\\"$(printf \\"%s\\" \\"$INPUT_VIDEO\\" | tr -d \\"\\\\r\\" | sed -e \\"s/[[:space:]]*$//\\")\\"",
          "if [ -z \\"$INPUT_VIDEO\\" ]; then",
          "  echo \\"已取消选择视频。\\"",
          "  exit 1",
          "fi",
          "INPUT_FILE=\\"$(basename \\"$INPUT_VIDEO\\")\\"",
          "if [[ \\"$INPUT_FILE\\" == *.* ]]; then",
          "  INPUT_STEM=\\"$(printf \\"%s\\" \\"$INPUT_FILE\\" | sed -e \\"s/\\\\.[^.]*$//\\")\\"",
          "  INPUT_EXT=\\"$(printf \\"%s\\" \\"$INPUT_FILE\\" | sed -e \\"s/^.*\\\\.//\\")\\"",
          "else",
          "  INPUT_STEM=\\"$INPUT_FILE\\"",
          "  INPUT_EXT=\\"mp4\\"",
          "fi",
          "if [ -z \\"$OUTPUT_NAME\\" ]; then",
          "  OUTPUT_NAME=\\"$INPUT_STEM\\"_merge_subtitle.\\"$INPUT_EXT\\"",
          "elif [[ \\"$OUTPUT_NAME\\" != *.* ]]; then",
          "  OUTPUT_NAME=\\"$OUTPUT_NAME.\\"$INPUT_EXT\\"",
          "fi",
          "OUTPUT_VIDEO=\\"$(dirname \\"$INPUT_VIDEO\\")/$OUTPUT_NAME\\"",
          "",
          "if [ ! -f \\"$ASS_FILE\\" ]; then",
          "  echo \\"subtitle.ass 不存在：$ASS_FILE\\"",
          "  exit 1",
          "fi",
          "",
          "if [ ! -f \\"$INPUT_VIDEO\\" ]; then",
          "  echo \\"选择的视频不存在：$INPUT_VIDEO\\"",
          "  exit 1",
          "fi",
          "",
          "if [ -x \\"$FFMPEG_BIN\\" ]; then",
          "  FFMPEG_CMD=\\"$FFMPEG_BIN\\"",
          "elif command -v \\"$FFMPEG_BIN\\" >/dev/null 2>&1; then",
          "  FFMPEG_CMD=\\"$(command -v \\"$FFMPEG_BIN\\")\\"",
          "elif command -v ffmpeg >/dev/null 2>&1; then",
          "  FFMPEG_CMD=\\"$(command -v ffmpeg)\\"",
          "else",
          "  echo \\"未找到 ffmpeg：$FFMPEG_BIN\\"",
          "  echo \\"请先安装并在弹窗第1项填写 ffmpeg 完整路径。\\"",
          "  exit 1",
          "fi",
          "",
          "echo \\"使用 ffmpeg: $FFMPEG_CMD\\"",
          "echo \\"输入视频: $INPUT_VIDEO\\"",
          "echo \\"输出文件: $OUTPUT_VIDEO\\"",
          "echo \\"开始合并字幕...\\"",
          "if \\"$FFMPEG_CMD\\" -y -i \\"$INPUT_VIDEO\\" -vf \\"ass=$ASS_FILE\\" -c:a copy \\"$OUTPUT_VIDEO\\"; then",
          "  echo \\"完成：$OUTPUT_VIDEO\\"",
          "  exit 0",
          "fi",
          "",
          "echo \\"音频复制失败，尝试兼容模式重编码...\\"",
          "\\"$FFMPEG_CMD\\" -y -i \\"$INPUT_VIDEO\\" -vf \\"ass=$ASS_FILE\\" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k \\"$OUTPUT_VIDEO\\"",
          "echo \\"完成：$OUTPUT_VIDEO\\""
        ].join("\\n");
      }

      function buildToolkitReadme(ffmpegPath, outputName) {
        return [
          "使用步骤（macOS）：",
          "1) 双击 merge_subtitle.command。",
          "2) 系统会弹出文件选择器，选择要合并字幕的视频。",
          "3) 脚本自动执行 ffmpeg，输出文件在源视频同目录。",
          "",
          "当前配置：",
          "- ffmpeg 路径: " + ffmpegPath,
          "- 输出文件名: " + (outputName || "自动：原文件名_merge_subtitle"),
          "",
          "提示：如果双击后被拦截，请在系统设置放行终端执行，或右键脚本选择“打开”。"
        ].join("\\n");
      }

      function createCrc32Table() {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i += 1) {
          let c = i;
          for (let j = 0; j < 8; j += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
          table[i] = c >>> 0;
        }
        return table;
      }

      const ZIP_CRC32_TABLE = createCrc32Table();

      function crc32(bytes) {
        let crc = 0xffffffff;
        for (let i = 0; i < bytes.length; i += 1) {
          crc = ZIP_CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
      }

      function toDosDateTime(date) {
        const d = date instanceof Date ? date : new Date();
        const year = Math.max(1980, d.getFullYear());
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const hours = d.getHours();
        const minutes = d.getMinutes();
        const seconds = Math.floor(d.getSeconds() / 2);
        const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
        const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
        return { dosTime, dosDate };
      }

      function makeZipBlob(files) {
        const encoder = new TextEncoder();
        const chunks = [];
        const centralChunks = [];
        let offset = 0;
        const now = toDosDateTime(new Date());

        for (const file of files) {
          const nameBytes = encoder.encode(file.name);
          const dataBytes = encoder.encode(file.content);
          const checksum = crc32(dataBytes);
          const mode = file.executable ? 0o100755 : 0o100644;

          const local = new Uint8Array(30 + nameBytes.length);
          const ld = new DataView(local.buffer);
          ld.setUint32(0, 0x04034b50, true);
          ld.setUint16(4, 20, true);
          ld.setUint16(6, 0, true);
          ld.setUint16(8, 0, true);
          ld.setUint16(10, now.dosTime, true);
          ld.setUint16(12, now.dosDate, true);
          ld.setUint32(14, checksum, true);
          ld.setUint32(18, dataBytes.length, true);
          ld.setUint32(22, dataBytes.length, true);
          ld.setUint16(26, nameBytes.length, true);
          ld.setUint16(28, 0, true);
          local.set(nameBytes, 30);
          chunks.push(local, dataBytes);

          const central = new Uint8Array(46 + nameBytes.length);
          const cd = new DataView(central.buffer);
          cd.setUint32(0, 0x02014b50, true);
          cd.setUint16(4, (3 << 8) | 20, true);
          cd.setUint16(6, 20, true);
          cd.setUint16(8, 0, true);
          cd.setUint16(10, 0, true);
          cd.setUint16(12, now.dosTime, true);
          cd.setUint16(14, now.dosDate, true);
          cd.setUint32(16, checksum, true);
          cd.setUint32(20, dataBytes.length, true);
          cd.setUint32(24, dataBytes.length, true);
          cd.setUint16(28, nameBytes.length, true);
          cd.setUint16(30, 0, true);
          cd.setUint16(32, 0, true);
          cd.setUint16(34, 0, true);
          cd.setUint16(36, 0, true);
          cd.setUint32(38, mode << 16, true);
          cd.setUint32(42, offset, true);
          central.set(nameBytes, 46);
          centralChunks.push(central);

          offset += local.length + dataBytes.length;
        }

        const centralStart = offset;
        for (const entry of centralChunks) {
          chunks.push(entry);
          offset += entry.length;
        }
        const centralSize = offset - centralStart;

        const eocd = new Uint8Array(22);
        const ed = new DataView(eocd.buffer);
        ed.setUint32(0, 0x06054b50, true);
        ed.setUint16(4, 0, true);
        ed.setUint16(6, 0, true);
        ed.setUint16(8, centralChunks.length, true);
        ed.setUint16(10, centralChunks.length, true);
        ed.setUint32(12, centralSize, true);
        ed.setUint32(16, centralStart, true);
        ed.setUint16(20, 0, true);
        chunks.push(eocd);

        return new Blob(chunks, { type: "application/zip" });
      }

      function setAiStatus(message, isError) {
        aiStatus.textContent = message || "";
        aiStatus.style.color = isError ? "#fca5a5" : "#94a3b8";
      }

      function formatLogTime(date) {
        const d = date instanceof Date ? date : new Date();
        return String(d.getHours()).padStart(2, "0")
          + ":" + String(d.getMinutes()).padStart(2, "0")
          + ":" + String(d.getSeconds()).padStart(2, "0");
      }

      function renderAiLogs() {
        if (!aiLogOutput || !aiLogMeta) return;
        if (!Array.isArray(aiLogs) || aiLogs.length === 0) {
          aiLogMeta.textContent = "尚无日志";
          aiLogOutput.textContent = "尚无日志";
          return;
        }
        aiLogMeta.textContent = "共 " + aiLogs.length + " 条";
        aiLogOutput.textContent = aiLogs.join("\\n");
      }

      function clearAiLogs() {
        aiLogs = [];
        renderAiLogs();
      }

      function pushAiLog(level, message) {
        const tag = level === "error" ? "ERROR" : (level === "warn" ? "WARN" : "INFO");
        const line = "[" + formatLogTime(new Date()) + "][" + tag + "] " + String(message || "").trim();
        aiLogs.push(line);
        if (aiLogs.length > 500) aiLogs = aiLogs.slice(aiLogs.length - 500);
        renderAiLogs();
      }

      function setAiAnalyzingState(active) {
        aiAnalyzing = active;
        if (aiClassifyBtn) aiClassifyBtn.disabled = active;
        preprocessBody.querySelectorAll(".line-retry-btn").forEach((btn) => {
          if (btn instanceof HTMLButtonElement) btn.disabled = active;
        });
        renderPreprocess();
      }

      function renderAiDebug(payload) {
        if (!aiDebugBox || !aiDebugOutput) return;
        if (!payload) {
          aiDebugBox.hidden = true;
          aiDebugOutput.textContent = "";
          return;
        }
        let text = "";
        try {
          text = JSON.stringify(payload, null, 2);
        } catch {
          text = String(payload);
        }
        aiDebugOutput.textContent = text;
        aiDebugBox.hidden = false;
      }

      function toUniqueTerms(list) {
        if (!Array.isArray(list)) return [];
        const cleaned = list
          .map((item) => cleanAiTerm(String(item || "")))
          .filter(Boolean);
        return [...new Set(cleaned)];
      }

      function cleanAiTerm(raw) {
        const trimmed = String(raw || "").replace(/\\s+/g, " ").trim();
        if (!trimmed) return "";
        const stripped = trimmed
          .replace(/^[\\s"'“”‘’()\\[\\]{}.,!?;:]+/, "")
          .replace(/[\\s"'“”‘’()\\[\\]{}.,!?;:]+$/, "");
        return stripped.replace(/\\s*[-–—:]\\s*.+$/, "").trim();
      }

      function canVisuallyHighlightTerm(term, cueText) {
        const candidate = cleanAiTerm(term);
        const source = String(cueText || "");
        if (!candidate || !source) return false;
        try {
          return new RegExp(escapeRegExp(candidate), "i").test(source);
        } catch {
          return false;
        }
      }

      function isHighValueHvcTerm(term) {
        const cleaned = cleanAiTerm(term);
        if (!cleaned) return false;
        if (!/[a-zA-Z]/.test(cleaned)) return false;
        if (/[^a-zA-Z\\s'/-]/.test(cleaned)) return false;
        const words = (cleaned.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []).filter(Boolean);
        if (words.length === 0) return false;
        if (words.length === 1) {
          const w = words[0];
          if (w.length <= 3) return false;
          if (AI_HVC_LOW_VALUE_WORDS.has(w)) return false;
          return true;
        }
        const lowValueCount = words.filter((w) => AI_HVC_LOW_VALUE_WORDS.has(w)).length;
        return lowValueCount < words.length - 1;
      }

      function createAiConfigs() {
        return [
          { id: "cfg-ai-hvc", key: "hvc", name: "高价值词汇（HVC）", color: "&H0000FFFF" },
          { id: "cfg-ai-collocations", key: "collocations", name: "固定搭配/短语动词", color: "&H0032CD32" },
          { id: "cfg-ai-spoken-patterns", key: "spoken_patterns", name: "口语常用句型", color: "&H00FF00AA" }
        ];
      }

      function resetAiAssignments() {
        assignments = [];
      }

      function applyAiAnalysis(cues, aiCues) {
        const cueByOrder = new Map(cues.map((cue) => [cue.order, cue]));
        const aiConfigs = createAiConfigs();
        highlightConfigs = aiConfigs.map((cfg) => ({ id: cfg.id, name: cfg.name, color: cfg.color }));
        resetAiAssignments();
        const keyByConfig = {
          hvc: "cfg-ai-hvc",
          collocations: "cfg-ai-collocations",
          spoken_patterns: "cfg-ai-spoken-patterns"
        };
        const priorityByKey = {
          hvc: 3,
          collocations: 2,
          spoken_patterns: 1
        };
        const bestByCueNorm = new Map();

        for (const row of aiCues) {
          const order = Number(row?.order);
          if (!Number.isFinite(order)) continue;
          const cue = cueByOrder.get(order);
          if (!cue) continue;

          const bucketList = [
            { key: "hvc", terms: toUniqueTerms(row?.hvc) },
            { key: "collocations", terms: toUniqueTerms(row?.collocations) },
            { key: "spoken_patterns", terms: [...toUniqueTerms(row?.spoken_patterns), ...toUniqueTerms(row?.expressions)] }
          ];

          for (const bucket of bucketList) {
            const configId = keyByConfig[bucket.key];
            if (!configId) continue;
            const priority = priorityByKey[bucket.key] || 0;
            for (const term of bucket.terms) {
              if (!canVisuallyHighlightTerm(term, cue.text)) continue;
              const norm = normalizeWord(term);
              if (!norm) continue;
              const dedupeKey = String(order) + "::" + norm;
              const previous = bestByCueNorm.get(dedupeKey);
              if (previous && previous.priority >= priority) continue;
              bestByCueNorm.set(dedupeKey, {
                priority,
                cueOrder: order,
                cueIndexLabel: cue.indexLabel,
                word: term,
                norm,
                configId
              });
            }
          }
        }

        assignments = Array.from(bestByCueNorm.values())
          .sort((a, b) => (a.cueOrder - b.cueOrder) || (b.priority - a.priority))
          .map((item) => ({
            cueOrder: item.cueOrder,
            cueIndexLabel: item.cueIndexLabel,
            word: item.word,
            norm: item.norm,
            configId: item.configId
          }));
      }

      function applyAiTranslations(cues, aiCues) {
        const validOrders = new Set(cues.map((cue) => cue.order));
        const nextTranslations = { ...cueTranslations };
        for (const row of aiCues) {
          const order = Number(row?.order);
          if (!Number.isFinite(order) || !validOrders.has(order)) continue;
          const zh = String(row?.translation_zh || "").trim();
          if (zh) nextTranslations[String(order)] = zh;
        }
        cueTranslations = nextTranslations;
      }

      function normalizeAiLineRow(rawRow, cueText) {
        if (!rawRow || typeof rawRow !== "object") return null;
        const row = rawRow;
        const lineNumber = Number(row.lineNumber);
        if (!Number.isFinite(lineNumber) || lineNumber < 0) return null;
        const toList = (value) => {
          if (!Array.isArray(value)) return [];
          return value.map((item) => cleanAiTerm(String(item || ""))).filter(Boolean);
        };
        return {
          order: Math.round(lineNumber) + 1,
          translation_zh: String(row.zh || "").trim(),
          hvc: toList(row.hvc).filter((term) => isHighValueHvcTerm(term) && canVisuallyHighlightTerm(term, cueText)),
          collocations: toList(row.collocations).filter((term) => canVisuallyHighlightTerm(term, cueText)),
          expressions: [],
          spoken_patterns: toList(row.sentence_patterns).filter((term) => canVisuallyHighlightTerm(term, cueText))
        };
      }

      function sanitizeAiRowByCueText(row, cueText) {
        if (!row || typeof row !== "object") return null;
        const text = String(cueText || "");
        const filterTerms = (list) => toUniqueTerms(list).filter((term) => canVisuallyHighlightTerm(term, text));
        return {
          ...row,
          hvc: filterTerms(row.hvc).filter((term) => isHighValueHvcTerm(term)),
          collocations: filterTerms(row.collocations),
          spoken_patterns: filterTerms(row.spoken_patterns),
          expressions: filterTerms(row.expressions)
        };
      }

      function getVisibleCuesForRender() {
        if (!Array.isArray(cuesCache) || cuesCache.length === 0) return [];
        if (!aiAnalyzing) return cuesCache;
        return cuesCache.filter((cue) => {
          const status = getCueRetryStatus(cue.order);
          return status === "running" || status === "success" || status === "error";
        });
      }

      async function callAiAnalyzeByLine(cue, debug) {
        const response = await fetch("/api/ass/ai-analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            texts: [{ lineNumber: cue.order - 1, text: cue.text }],
            debug
          })
        });
        const raw = await response.text();
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error("AI 接口返回了不可解析的数据。");
        }
        if (!response.ok) {
          if (data?.debug) renderAiDebug(data.debug);
          throw new Error(String(data?.error || "AI 分析失败"));
        }
        if (data?.debug) renderAiDebug(data.debug);
        const row = Array.isArray(data?.result) ? normalizeAiLineRow(data.result[0], cue.text) : null;
        if (!row) throw new Error("AI 没有返回有效 JSON result。");
        return row;
      }

      function rebuildAiViewFromCache(cues) {
        const aiRows = cues
          .map((cue) => cueAiRowsByOrder[String(cue.order)] || null)
          .filter(Boolean);
        applyAiAnalysis(cues, aiRows);
        applyAiTranslations(cues, aiRows);
      }

      function setCueRetryStatus(cueOrder, status) {
        cueRetryStatusByOrder[String(cueOrder)] = status;
      }

      function getCueRetryStatus(cueOrder) {
        return cueRetryStatusByOrder[String(cueOrder)] || "idle";
      }

      function getRetryButtonLabel(cueOrder) {
        const status = getCueRetryStatus(cueOrder);
        if (status === "running") return "处理中";
        if (status === "success") return "已更新";
        if (status === "error") return "重试失败";
        return "重试";
      }

      function getRetryButtonClass(cueOrder) {
        const status = getCueRetryStatus(cueOrder);
        if (status === "running") return "line-retry-btn is-running";
        if (status === "success") return "line-retry-btn is-success";
        if (status === "error") return "line-retry-btn is-error";
        return "line-retry-btn";
      }

      function isEditLineDisabled(cueOrder) {
        return getCueRetryStatus(cueOrder) === "running";
      }

      async function retrySingleCueAi(cueOrder) {
        if (aiAnalyzing) return;
        const cues = parseCueBlocks(subtitleInput.value || "");
        if (cues.length === 0) {
          setAiStatus("请先输入有效字幕分段，再执行 AI。", true);
          return;
        }
        const cue = cues.find((item) => item.order === cueOrder);
        if (!cue) {
          setAiStatus("未找到该行字幕，请先重新点击“高亮编辑操作”。", true);
          return;
        }
        setAiAnalyzingState(true);
        setCueRetryStatus(cue.order, "running");
        renderPreprocess();
        pushAiLog("info", "开始重试第 " + String(cue.order).padStart(3, "0") + " 行");
        setAiStatus("正在重试第 " + String(cue.order).padStart(3, "0") + " 行...", false);
        try {
          const debug = Boolean(aiDebugToggle && aiDebugToggle.checked);
          const row = await callAiAnalyzeByLine(cue, debug);
          cueAiRowsByOrder[String(cue.order)] = row;
          setCueRetryStatus(cue.order, "success");
          cuesCache = cues;
          rebuildAiViewFromCache(cues);
          pruneAssignmentsByCues();
          renderConfigList();
          renderPreprocess();
          renderGroupedHighlights();
          refreshPreviewText();
          hideWordMenu();
          pushAiLog("info", "第 " + String(cue.order).padStart(3, "0") + " 行重试成功");
          setAiStatus("第 " + String(cue.order).padStart(3, "0") + " 行重试完成。", false);
        } catch (error) {
          setCueRetryStatus(cue.order, "error");
          renderPreprocess();
          pushAiLog("error", "第 " + String(cue.order).padStart(3, "0") + " 行重试失败: " + String(error?.message || "未知错误"));
          setAiStatus(error?.message || "单行重试失败", true);
        } finally {
          setAiAnalyzingState(false);
        }
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

      function serializeCueBlocks(cues) {
        if (!Array.isArray(cues) || cues.length === 0) return "";
        return cues.map((cue, idx) => {
          const indexNum = Number(cue?.indexLabel);
          const label = Number.isFinite(indexNum) ? Math.round(indexNum) : (idx + 1);
          const header = "[" + String(label).padStart(3, "0") + "] " + cue.start + " --> " + cue.end;
          return header + "\\n" + String(cue.text || "").trim();
        }).join("\\n\\n");
      }

      function syncAssignmentsForCueText(cueOrder, cueText) {
        const nextText = String(cueText || "");
        assignments = assignments.filter((item) => {
          if (item.cueOrder !== cueOrder) return true;
          return canVisuallyHighlightTerm(item.word, nextText);
        });
      }

      function closeLineEditModal() {
        editingCueOrder = null;
        if (lineEditModal) lineEditModal.hidden = true;
      }

      function openLineEditModal(cueOrder) {
        if (!(lineEditModal instanceof HTMLElement)) return;
        const cue = cuesCache.find((item) => item.order === cueOrder) || null;
        if (!cue) return;
        editingCueOrder = cueOrder;
        if (lineEditTextInput) lineEditTextInput.value = String(cue.text || "");
        if (lineEditZhInput) lineEditZhInput.value = String(cueTranslations[String(cueOrder)] || "");
        lineEditModal.hidden = false;
        if (lineEditTextInput) lineEditTextInput.focus();
      }

      function saveEditedCue() {
        if (!Number.isFinite(editingCueOrder)) return;
        const cueOrder = Math.round(Number(editingCueOrder));
        const cue = cuesCache.find((item) => item.order === cueOrder) || null;
        if (!cue) return closeLineEditModal();
        const nextText = String(lineEditTextInput ? lineEditTextInput.value : cue.text).trim();
        const nextZh = String(lineEditZhInput ? lineEditZhInput.value : "").trim();
        cue.text = nextText;
        if (nextZh) cueTranslations[String(cueOrder)] = nextZh;
        else delete cueTranslations[String(cueOrder)];
        if (cueAiRowsByOrder[String(cueOrder)]) {
          const nextRow = sanitizeAiRowByCueText(cueAiRowsByOrder[String(cueOrder)], nextText);
          if (nextRow) {
            nextRow.translation_zh = nextZh;
            cueAiRowsByOrder[String(cueOrder)] = nextRow;
          }
        }
        syncAssignmentsForCueText(cueOrder, nextText);
        subtitleInput.value = serializeCueBlocks(cuesCache);
        renderPreprocess();
        renderGroupedHighlights();
        refreshPreviewText();
        hideWordMenu();
        setAiStatus("第 " + String(cueOrder).padStart(3, "0") + " 行已手动更新并同步分词高亮。", false);
        closeLineEditModal();
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

      function getConfigPriority(configId) {
        if (configId === "cfg-ai-hvc") return 30;
        if (configId === "cfg-ai-collocations") return 20;
        if (configId === "cfg-ai-spoken-patterns") return 10;
        return 0;
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
              name: entry.name,
              priority: Number(entry.priority || 0)
            });
          }
        }
        // Resolve overlap by config priority first (HVC > collocations > spoken patterns),
        // then prefer longer match at same priority.
        all.sort((a, b) => (b.priority - a.priority) || ((b.end - b.start) - (a.end - a.start)) || (a.start - b.start));

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

      function getAssignmentKey(item) {
        return String(item.cueOrder) + "::" + String(item.norm || "");
      }

      function buildHighlightedHtml(text, cueOrder) {
        const current = getCueAssignments(cueOrder).map((item) => {
          const cfg = getConfigById(item.configId);
          if (!cfg) return null;
          return {
            word: item.word,
            configId: item.configId,
            color: cfg.color,
            name: cfg.name,
            priority: getConfigPriority(item.configId)
          };
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
        const visibleCues = getVisibleCuesForRender();
        if (visibleCues.length === 0) {
          preprocessBody.innerHTML = aiAnalyzing
            ? '<p class="preprocess-placeholder">AI 正在逐行处理中，等待首行返回后展示...</p>'
            : '<p class="preprocess-placeholder">暂无可展示内容</p>';
          return;
        }
        preprocessBody.innerHTML = visibleCues.map((cue) => {
          const meta = "[" + String(cue.order).padStart(3, "0") + "] " + cue.start + " --> " + cue.end;
          const textHtml = buildHighlightedHtml(cue.text, cue.order);
          const zh = String(cueTranslations[String(cue.order)] || "").trim();
          const zhHtml = zh ? '<div class="cue-translation">' + escapeHtml(zh) + "</div>" : "";
          const retryBtnClass = getRetryButtonClass(cue.order);
          const retryBtnLabel = getRetryButtonLabel(cue.order);
          const editDisabledAttr = isEditLineDisabled(cue.order) ? " disabled" : "";
          return ''
            + '<div class="cue-line" data-cue-order="' + cue.order + '" data-cue-index="' + cue.indexLabel + '">'
            +   '<div class="cue-row">'
            +     '<div class="cue-main">'
            +       '<div class="cue-meta">' + escapeHtml(meta) + '</div>'
            +       '<div class="cue-text">' + textHtml + "</div>"
            +       zhHtml
            +     '</div>'
            +     '<div class="cue-actions">'
            +       '<button type="button" class="line-edit-btn" data-action="edit-line" data-cue-order="' + cue.order + '"' + editDisabledAttr + '>编辑</button>'
            +       '<button type="button" class="' + retryBtnClass + '" data-action="retry-line" data-cue-order="' + cue.order + '">' + retryBtnLabel + '</button>'
            +     '</div>'
            +   '</div>'
            + '</div>';
        }).join("");
      }

      function renderGroupedHighlights() {
        if (highlightConfigs.length === 0) {
          batchManageGroupId = "";
          batchManageSelectedKeys = new Set();
          groupedHighlights.innerHTML = '<p class="menu-empty">暂无高亮配置。</p>';
          return;
        }
        if (batchManageGroupId && !highlightConfigs.some((cfg) => cfg.id === batchManageGroupId)) {
          batchManageGroupId = "";
          batchManageSelectedKeys = new Set();
        }
        const html = [];
        for (const cfg of highlightConfigs) {
          const groupAssignments = assignments
            .filter((item) => item.configId === cfg.id)
            .sort((a, b) => {
              if (a.cueOrder !== b.cueOrder) return a.cueOrder - b.cueOrder;
              return String(a.word || "").localeCompare(String(b.word || ""), "en");
            });
          const deduped = [...new Set(groupAssignments.map((item) => "[" + String(item.cueOrder).padStart(3, "0") + "] " + item.word))];
          const isBatchManaging = batchManageGroupId === cfg.id;
          const selectedCount = isBatchManaging ? groupAssignments.filter((item) => batchManageSelectedKeys.has(getAssignmentKey(item))).length : 0;
          const actionHtml = isBatchManaging
            ? (
              '<button type="button" class="group-action-btn" data-action="group-select-all" data-config-id="' + cfg.id + '"' + (groupAssignments.length === 0 ? " disabled" : "") + '>全选</button>'
              + '<button type="button" class="group-action-btn" data-action="group-cancel-manage" data-config-id="' + cfg.id + '">取消</button>'
              + '<button type="button" class="group-action-btn danger" data-action="group-batch-delete" data-config-id="' + cfg.id + '"' + (selectedCount === 0 ? " disabled" : "") + '>删除所选(' + selectedCount + ')</button>'
            )
            : '<button type="button" class="group-action-btn" data-action="group-start-manage" data-config-id="' + cfg.id + '"' + (groupAssignments.length === 0 ? " disabled" : "") + '>批量管理</button>';
          const batchListHtml = groupAssignments.length > 0
            ? (
              '<ul class="group-batch-list">'
              + groupAssignments.map((item) => {
                const key = getAssignmentKey(item);
                const checked = batchManageSelectedKeys.has(key) ? " checked" : "";
                return ''
                  + '<li class="group-batch-item">'
                  +   '<label>'
                  +     '<input type="checkbox" data-action="group-toggle-item" data-config-id="' + cfg.id + '" data-assignment-key="' + encodeURIComponent(key) + '"' + checked + " /> "
                  +     escapeHtml("[" + String(item.cueOrder).padStart(3, "0") + "] " + item.word)
                  +   "</label>"
                  + "</li>";
              }).join("")
              + "</ul>"
            )
            : '<p class="group-batch-empty">暂无词</p>';
          html.push(
            '<div class="group-card">'
            + '<h3 class="group-title">'
            +   '<span class="group-title-main"><span class="dot" style="background:' + assColorToCssHex(cfg.color) + ';"></span>' + escapeHtml(cfg.name) + " <code>" + escapeHtml(cfg.color) + "</code></span>"
            +   '<span class="group-title-actions">' + actionHtml + "</span>"
            + "</h3>"
            + (isBatchManaging ? batchListHtml : ('<p class="group-items">' + (deduped.length > 0 ? escapeHtml(deduped.join("\\n")) : "暂无词") + "</p>"))
            + "</div>"
          );
        }
        groupedHighlights.innerHTML = html.join("");
      }

      function startGroupBatchManage(configId) {
        const id = String(configId || "");
        if (!id) return;
        batchManageGroupId = id;
        batchManageSelectedKeys = new Set();
        renderGroupedHighlights();
      }

      function cancelGroupBatchManage(configId) {
        if (!configId || batchManageGroupId !== configId) return;
        batchManageGroupId = "";
        batchManageSelectedKeys = new Set();
        renderGroupedHighlights();
      }

      function selectAllGroupItems(configId) {
        if (!configId || batchManageGroupId !== configId) return;
        const keys = assignments
          .filter((item) => item.configId === configId)
          .map((item) => getAssignmentKey(item));
        batchManageSelectedKeys = new Set(keys);
        renderGroupedHighlights();
      }

      function toggleGroupBatchItem(configId, encodedKey, checked) {
        if (!configId || batchManageGroupId !== configId) return;
        const key = decodeURIComponent(String(encodedKey || ""));
        if (!key) return;
        if (checked) batchManageSelectedKeys.add(key);
        else batchManageSelectedKeys.delete(key);
        renderGroupedHighlights();
      }

      function deleteSelectedGroupItems(configId) {
        if (!configId || batchManageGroupId !== configId) return;
        const selected = new Set(batchManageSelectedKeys);
        if (selected.size === 0) return;
        if (!window.confirm("确认删除当前分组内选中的 " + selected.size + " 个词（词组）吗？")) return;
        assignments = assignments.filter((item) => {
          if (item.configId !== configId) return true;
          return !selected.has(getAssignmentKey(item));
        });
        batchManageGroupId = "";
        batchManageSelectedKeys = new Set();
        renderPreprocess();
        renderGroupedHighlights();
        refreshPreviewText();
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
        const nextAiRows = {};
        for (const cue of cuesCache) {
          const key = String(cue.order);
          if (cueAiRowsByOrder[key]) nextAiRows[key] = cueAiRowsByOrder[key];
        }
        cueAiRowsByOrder = nextAiRows;
        const nextRetryStatus = {};
        for (const cue of cuesCache) {
          const key = String(cue.order);
          if (cueRetryStatusByOrder[key]) nextRetryStatus[key] = cueRetryStatusByOrder[key];
        }
        cueRetryStatusByOrder = nextRetryStatus;
        const nextTranslations = {};
        for (const cue of cuesCache) {
          const key = String(cue.order);
          if (cueTranslations[key]) nextTranslations[key] = cueTranslations[key];
        }
        cueTranslations = nextTranslations;
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

      function sanitizeOffset(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 40;
        if (n < 0) return 40;
        const stageHeight = Math.max(1, subtitleOverlay.clientHeight || previewStage.clientHeight || 1080);
        const dynamicMax = Math.max(120, Math.round(stageHeight * 0.9));
        return Math.min(dynamicMax, Math.round(n));
      }

      function sanitizeZhScale(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0.7;
        return Math.max(0.5, Math.min(1, n));
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

      function getPreviewScaleY() {
        const stageHeight = Math.max(1, subtitleOverlay.clientHeight || previewStage.clientHeight || 1080);
        const playResY = Math.max(1, Math.round(Number(previewVideoMeta?.height) || 1080));
        return stageHeight / playResY;
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
        const zh = String(cueTranslations[String(cueOrder)] || "").trim();
        const zhEnabled = includeZhInAss && includeZhInAss.checked && zh;

        if (matches.length === 0) {
          const base = escapeHtml(rawText).replace(/\\n/g, "<br />");
          if (!zhEnabled) return base;
          const scale = sanitizeZhScale(zhFontScale ? zhFontScale.value : 0.7);
          const zhHtml = '<span class="subtitle-zh" style="font-size:' + scale + 'em;">' + escapeHtml(zh) + "</span>";
          return base + "<br />" + zhHtml;
        }

        let cursor = 0;
        const parts = [];
        for (const match of matches) {
          parts.push(escapeHtml(rawText.slice(cursor, match.start)));
          parts.push('<span class="subtitle-hit" style="color:' + assColorToCssHex(match.color) + ';">' + escapeHtml(rawText.slice(match.start, match.end)) + "</span>");
          cursor = match.end;
        }
        parts.push(escapeHtml(rawText.slice(cursor)));
        const base = parts.join("").replace(/\\n/g, "<br />");
        if (!zhEnabled) return base;
        const scale = sanitizeZhScale(zhFontScale ? zhFontScale.value : 0.7);
        const zhHtml = '<span class="subtitle-zh" style="font-size:' + scale + 'em;">' + escapeHtml(zh) + "</span>";
        return base + "<br />" + zhHtml;
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
        const scaleY = getPreviewScaleY();
        const previewFontPx = Math.max(8, Math.round(safeSize * scaleY));
        const previewBorderPx = Math.max(1, Math.round(safeBorder * scaleY));
        const offset = sanitizeOffset(subtitleOffset.value);

        subtitleOverlay.style.justifyContent = "flex-end";
        subtitleOverlay.style.paddingTop = "0";
        subtitleOverlay.style.paddingBottom = String(offset) + "px";
        subtitleOverlayText.style.transform = "translateY(0)";
        subtitleOverlayText.style.fontSize = String(previewFontPx) + "px";
        subtitleOverlayText.style.color = assColorToCssHex(normal);
        subtitleOverlayText.style.background = assColorToCssRgba(back, "rgba(0,0,0,0.82)");
        subtitleOverlayText.style.padding = String(Math.max(2, previewBorderPx * 2)) + "px " + String(Math.max(8, previewBorderPx * 4)) + "px";
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
        let offset = Math.round(stageRect.height - (clampedY + half));
        offset = sanitizeOffset(offset);
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

      function getExportPosY(offsetValue, playResY) {
        const stageHeight = Math.max(1, subtitleOverlay.clientHeight || 1080);
        const offset = sanitizeOffset(offsetValue);
        const safePlayResY = Math.max(1, Math.round(Number(playResY) || 1080));
        const scaled = Math.round(offset * (safePlayResY / stageHeight));
        return Math.max(0, Math.min(safePlayResY, safePlayResY - scaled));
      }

      function buildAssContent(cues, normalColor, borderColor, borderWidthValue, fontSizeValue, offsetValue, playResXValue, playResYValue, includeZh, zhScaleValue, translations) {
        const sizeNum = Number(fontSizeValue);
        const safeSize = Number.isFinite(sizeNum) && sizeNum > 0 ? Math.round(sizeNum) : 48;
        const borderNum = Number(borderWidthValue);
        const safeBorder = Number.isFinite(borderNum) && borderNum >= 0 ? Math.min(12, Math.round(borderNum)) : 2;
        const alignCode = 2;
        const playResX = Math.max(1, Math.round(Number(playResXValue) || 1920));
        const playResY = Math.max(1, Math.round(Number(playResYValue) || 1080));
        const exportY = getExportPosY(offsetValue, playResY);
        const exportX = Math.round(playResX / 2);
        const lines = [
          "[Script Info]",
          "ScriptType: v4.00+",
          "PlayResX: " + playResX,
          "PlayResY: " + playResY,
          "",
          "[V4+ Styles]",
          "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
          "Style: Default,Arial," + safeSize + "," + normalColor + ",&H000000FF,&H00000000," + borderColor + ",-1,0,0,0,100,100,0,0,3," + safeBorder + ",0," + alignCode + ",10,10,0,1",
          "",
          "[Events]",
          "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
        ];
        for (const cue of cues) {
          let text = applyMultiHighlight(cue.text, cue.order, normalColor);
          if (includeZh) {
            const zh = String(translations[String(cue.order)] || "").trim();
            if (zh) {
              const scale = sanitizeZhScale(zhScaleValue);
              const zhSize = Math.max(10, Math.round(safeSize * scale));
              const zhText = escapeAssText(zh).replace(/\\r?\\n/g, "\\\\N");
              text = text + "\\\\N{\\\\fs" + String(zhSize) + "}" + zhText + "{\\\\fs" + String(safeSize) + "}";
            }
          }
          const decorated = "{\\\\an" + String(alignCode) + "\\\\pos(" + String(exportX) + "," + String(exportY) + ")}" + text;
          lines.push("Dialogue: 0," + toAssTime(cue.start) + "," + toAssTime(cue.end) + ",Default,,0,0,0,," + decorated);
        }
        return lines.join("\\n");
      }

      function showError(message) {
        outputAss.innerHTML = '<span class="error">' + message + "</span>";
        outputCmd.innerHTML = '<span class="error">' + message + "</span>";
        lastAssContent = "";
        downloadAssBtn.disabled = true;
        if (downloadToolkitBtn) downloadToolkitBtn.disabled = true;
      }

      if (prepareHighlightBtn) prepareHighlightBtn.addEventListener("click", () => {
        cuesCache = parseCueBlocks(subtitleInput.value || "");
        if (cuesCache.length === 0) {
          preprocessBody.innerHTML = '<p class="preprocess-placeholder">未识别到有效字幕块，请确认格式为“时间轴 + 文本”。</p>';
          assignments = [];
          cueTranslations = {};
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

      if (aiClassifyBtn) aiClassifyBtn.addEventListener("click", async () => {
        if (aiAnalyzing) return;
        const cues = parseCueBlocks(subtitleInput.value || "");
        if (cues.length === 0) {
          setAiStatus("请先输入有效字幕分段，再执行 AI 分析。", true);
          return;
        }
        setAiAnalyzingState(true);
        clearAiLogs();
        pushAiLog("info", "开始逐行分析，总计 " + cues.length + " 行");
        setAiStatus("正在调用 AI：逐行智能选词+翻译...", false);
        renderAiDebug(null);
        try {
          const debug = Boolean(aiDebugToggle && aiDebugToggle.checked);
          cueAiRowsByOrder = {};
          cueRetryStatusByOrder = {};
          cuesCache = cues;
          renderPreprocess();
          const failedOrders = [];
          const requestCues = cues.slice(0, 300);
          for (let i = 0; i < requestCues.length; i += 1) {
            const cue = requestCues[i];
            setCueRetryStatus(cue.order, "running");
            renderPreprocess();
            const visibleCount = getVisibleCuesForRender().length;
            setAiStatus("正在分析第 " + String(i + 1) + "/" + String(requestCues.length) + " 行（当前已展示 " + visibleCount + " 行）...", false);
            pushAiLog("info", "开始分析第 " + String(cue.order).padStart(3, "0") + " 行");
            try {
              const row = await callAiAnalyzeByLine(cue, debug);
              cueAiRowsByOrder[String(cue.order)] = row;
              setCueRetryStatus(cue.order, "success");
              rebuildAiViewFromCache(cues);
              pruneAssignmentsByCues();
              renderConfigList();
              renderPreprocess();
              renderGroupedHighlights();
              refreshPreviewText();
              const visibleAfter = getVisibleCuesForRender().length;
              pushAiLog("info", "第 " + String(cue.order).padStart(3, "0") + " 行成功；已展示 " + visibleAfter + " 行");
            } catch (error) {
              failedOrders.push(cue.order);
              setCueRetryStatus(cue.order, "error");
              renderPreprocess();
              pushAiLog("error", "第 " + String(cue.order).padStart(3, "0") + " 行失败: " + String(error?.message || "未知错误"));
            }
          }
          const aiRows = Object.values(cueAiRowsByOrder);
          if (aiRows.length === 0) {
            throw new Error("AI 没有返回有效结果，请重试。");
          }
          hideWordMenu();
          if (failedOrders.length > 0) {
            setAiStatus("AI 完成：成功 " + aiRows.length + " 行，失败 " + failedOrders.length + " 行（可点击对应行右侧重试）。", false);
            pushAiLog("warn", "分析完成：成功 " + aiRows.length + " 行，失败 " + failedOrders.length + " 行");
          } else {
            setAiStatus("AI 完成：已更新逐行选词与翻译。", false);
            pushAiLog("info", "分析完成：全部成功，共 " + aiRows.length + " 行");
          }
        } catch (error) {
          pushAiLog("error", "分析中断: " + String(error?.message || "未知错误"));
          setAiStatus(error?.message || "AI 分析失败", true);
        } finally {
          setAiAnalyzingState(false);
        }
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

      preprocessBody.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.getAttribute("data-action");
        const cueOrder = Number(target.getAttribute("data-cue-order"));
        if (!Number.isFinite(cueOrder)) return;
        if (action === "edit-line") {
          openLineEditModal(Math.round(cueOrder));
          return;
        }
        if (action === "retry-line") retrySingleCueAi(Math.round(cueOrder));
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

      groupedHighlights.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.getAttribute("data-action");
        const configId = target.getAttribute("data-config-id");
        if (!action || !configId) return;
        if (action === "group-start-manage") {
          startGroupBatchManage(configId);
          return;
        }
        if (action === "group-cancel-manage") {
          cancelGroupBatchManage(configId);
          return;
        }
        if (action === "group-select-all") {
          selectAllGroupItems(configId);
          return;
        }
        if (action === "group-batch-delete") {
          deleteSelectedGroupItems(configId);
        }
      });

      groupedHighlights.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const action = target.getAttribute("data-action");
        if (action !== "group-toggle-item") return;
        const configId = target.getAttribute("data-config-id");
        const encodedKey = target.getAttribute("data-assignment-key");
        if (!configId || !encodedKey) return;
        toggleGroupBatchItem(configId, encodedKey, target.checked);
      });

      document.addEventListener("mousedown", (event) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (wordMenu.hidden) return;
        if (wordMenu.contains(target)) return;
        hideWordMenu();
      });

      if (addConfigBtn) addConfigBtn.addEventListener("click", () => {
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

      cancelLineEditBtn.addEventListener("click", closeLineEditModal);
      saveLineEditBtn.addEventListener("click", saveEditedCue);
      lineEditModal.addEventListener("mousedown", (event) => {
        if (event.target === lineEditModal) closeLineEditModal();
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
      subtitleOffset.addEventListener("input", updatePreviewOverlayAndText);
      if (includeZhInAss) includeZhInAss.addEventListener("change", updatePreviewOverlayAndText);
      if (zhFontScale) zhFontScale.addEventListener("input", updatePreviewOverlayAndText);
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
        const playResX = previewVideoMeta?.width || 1920;
        const playResY = previewVideoMeta?.height || 1080;
        const includeZh = includeZhInAss ? includeZhInAss.checked : false;
        const ass = buildAssContent(
          cues,
          normalColor,
          borderColor,
          outlineWidth.value,
          fontSize.value,
          subtitleOffset.value,
          playResX,
          playResY,
          includeZh,
          zhFontScale ? zhFontScale.value : 0.7,
          cueTranslations
        );
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
        if (downloadToolkitBtn) downloadToolkitBtn.disabled = false;
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

      if (downloadToolkitBtn) downloadToolkitBtn.addEventListener("click", () => {
        if (!lastAssContent) {
          showError("请先点击“生成 ASS + 命令”，再配置并下载工具包。");
          return;
        }
        openToolkitModal();
      });

      if (downloadFfmpegBtn) downloadFfmpegBtn.addEventListener("click", () => {
        window.open("https://deolaha.ca/pub/ffmpeg/ffmpeg-8.1.zip", "_blank", "noopener");
      });

      if (cancelToolkitBtn) cancelToolkitBtn.addEventListener("click", closeToolkitModal);
      if (toolkitModal) toolkitModal.addEventListener("mousedown", (event) => {
        if (event.target === toolkitModal) closeToolkitModal();
      });

      if (confirmToolkitBtn) confirmToolkitBtn.addEventListener("click", async () => {
        if (!lastAssContent) {
          setToolkitStatus("请先生成 ASS 内容。", true);
          return;
        }
        const ffmpegPath = String(toolkitFfmpegPathInput?.value || "").trim();
        const fallbackVideoName = String(previewVideo?.dataset?.fileName || "input.mp4");
        const outputName = ensureOutputNameExtension(String(toolkitOutputNameInput?.value || "").trim(), fallbackVideoName);
        if (!ffmpegPath) {
          setToolkitStatus("请填写 ffmpeg 可执行文件路径。", true);
          return;
        }
        if (toolkitOutputNameInput) toolkitOutputNameInput.value = outputName;

        try {
          setToolkitStatus("正在打包下载...", false);
          const commandScript = buildToolkitCommandScript(ffmpegPath, outputName);
          const readme = buildToolkitReadme(ffmpegPath, outputName);
          const zipBlob = makeZipBlob([
            { name: "subtitle.ass", content: lastAssContent, executable: false },
            { name: "merge_subtitle.command", content: commandScript + "\\n", executable: true },
            { name: "README.txt", content: readme + "\\n", executable: false }
          ]);

          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "ass_toolkit.zip";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setToolkitStatus("已下载 ass_toolkit.zip", false);
          closeToolkitModal();
        } catch (error) {
          setToolkitStatus("打包失败: " + String(error?.message || "未知错误"), true);
        }
      });

      if (clearAiLogBtn) clearAiLogBtn.addEventListener("click", clearAiLogs);

      renderConfigList();
      renderGroupedHighlights();
      renderAiLogs();
      syncOpacitySliderFromOutlineColor();
      updatePreviewStageAspect();
      updatePreviewOverlayAndText();
    </script>
  </body>
</html>`;
