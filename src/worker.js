import { ASS_PAGE, EXTRACT_PAGE } from "./pages";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ASSET_PROXY_ROUTES = [
    { prefix: "/vendor/ffmpeg/", upstreamBase: "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/" },
    { prefix: "/vendor/ffmpeg-util/", upstreamBase: "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/" },
    { prefix: "/vendor/ffmpeg-core/", upstreamBase: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/" }
];
const AI_ASS_MODEL = "@cf/openai/gpt-oss-120b";
const AI_ASS_LINE_SYSTEM_PROMPT = `You are an IELTS English coach and subtitle analyzer.
You must return STRICT JSON only (no markdown, no explanation, no code fences).

Input format:
{"texts":[{"lineNumber":0,"text":"this is demo text"}]}

Output format (field names must match exactly):
{
  "result": [
    {
      "lineNumber": 0,
      "ori_text": "this is demo text",
      "zh": "Chinese translation",
      "hvc": ["..."],
      "collocations": ["..."],
      "sentence_patterns": ["..."]
    }
  ]
}

Rules:
1) Keep lineNumber exactly the same as input.
2) Keep ori_text exactly the same as input text.
3) zh must be non-empty natural Chinese translation.
4) Arrays must always exist. Use [] when no item.
5) hvc must contain only high-value IELTS speaking vocabulary (B2-C1 / academic-leaning). Do not include low-value basic words.
6) collocations should be meaningful multi-word collocations/phrasal verbs.
7) sentence_patterns should be reusable spoken sentence patterns.
8) Do not use placeholders like "...", "N/A", "TBD".`;
function extractJsonText(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1])
        return fenced[1].trim();
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first)
        return trimmed.slice(first, last + 1);
    return null;
}
function extractBalancedJsonObjects(raw, maxCount = 8) {
    const text = String(raw || "");
    if (!text)
        return [];
    const blocks = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === "\"") {
                inString = false;
            }
            continue;
        }
        if (ch === "\"") {
            inString = true;
            continue;
        }
        if (ch === "{") {
            if (depth === 0)
                start = i;
            depth += 1;
            continue;
        }
        if (ch === "}" && depth > 0) {
            depth -= 1;
            if (depth === 0 && start >= 0) {
                blocks.push(text.slice(start, i + 1));
                start = -1;
                if (blocks.length >= maxCount)
                    break;
            }
        }
    }
    return blocks;
}
function collectJsonCandidatesFromText(raw) {
    const text = String(raw || "").trim();
    if (!text)
        return [];
    const out = [];
    const push = (value) => {
        const normalized = String(value || "").trim();
        if (!normalized)
            return;
        if (!out.includes(normalized))
            out.push(normalized);
    };
    push(extractJsonText(text));
    for (const block of extractBalancedJsonObjects(text))
        push(block);
    try {
        const maybeUnwrapped = JSON.parse(text);
        if (typeof maybeUnwrapped === "string") {
            const decoded = maybeUnwrapped.trim();
            if (decoded && decoded !== text) {
                push(extractJsonText(decoded));
                for (const block of extractBalancedJsonObjects(decoded))
                    push(block);
            }
        }
    }
    catch {
        // ignore non-JSON text
    }
    return out;
}
function isPlaceholderText(value) {
    const cleaned = String(value || "").replace(/\s+/g, "").toLowerCase();
    if (!cleaned)
        return true;
    if (cleaned === "..." || cleaned === "…")
        return true;
    if (cleaned === "n/a" || cleaned === "na" || cleaned === "tbd")
        return true;
    if (/^cmpl-[a-z0-9]{16,}$/i.test(cleaned))
        return true;
    if (/^\.+$/.test(cleaned))
        return true;
    return false;
}
function cleanTerm(raw) {
    const trimmed = String(raw || "").replace(/\s+/g, " ").trim();
    if (!trimmed)
        return "";
    const stripped = trimmed
        .replace(/^[\s"'“”‘’()\\[\\]{}.,!?;:]+/, "")
        .replace(/[\s"'“”‘’()\\[\\]{}.,!?;:]+$/, "");
    return stripped.replace(/\s*[-–—:]\s*.+$/, "").trim();
}
function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}
function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8"
        }
    });
}
function toDebugPreview(value, limit = 2400) {
    let text = "";
    if (typeof value === "string") {
        text = value;
    }
    else {
        try {
            text = JSON.stringify(value);
        }
        catch {
            text = String(value);
        }
    }
    const compact = text.replace(/\s+/g, " ").trim();
    if (compact.length <= limit)
        return compact;
    return compact.slice(0, limit) + ` ... [truncated ${compact.length - limit} chars]`;
}
function compactAiRawForDebug(value) {
    if (!value || typeof value !== "object") {
        return { type: typeof value, preview: toDebugPreview(value, 280) };
    }
    const row = value;
    const choices = Array.isArray(row.choices) ? row.choices : [];
    const compactChoices = choices.slice(0, 2).map((item) => {
        if (!item || typeof item !== "object") {
            return { preview: toDebugPreview(item, 220) };
        }
        const choice = item;
        return {
            index: Number(choice.index ?? 0),
            finish_reason: String(choice.finish_reason ?? choice.stop_reason ?? ""),
            text_preview: toDebugPreview(choice.text ?? choice.output_text ?? "", 280)
        };
    });
    return {
        id: String(row.id ?? ""),
        object: String(row.object ?? ""),
        model: String(row.model ?? ""),
        response_preview: toDebugPreview(row.response ?? row.output_text ?? row.text ?? "", 280),
        choices: compactChoices
    };
}
function parseAiAnalyzePayload(payload) {
    const rows = Array.isArray(payload?.texts)
        ? payload.texts
        : [];
    const texts = rows
        .map((item) => {
        if (!item || typeof item !== "object")
            return null;
        const row = item;
        const lineNumber = Number(row.lineNumber);
        const text = String(row.text ?? "").replace(/\s+/g, " ").trim();
        if (!Number.isFinite(lineNumber) || lineNumber < 0 || !text)
            return null;
        return { lineNumber: Math.round(lineNumber), text: text.slice(0, 600) };
    })
        .filter((item) => Boolean(item))
        .slice(0, 300);
    const debugEnabled = Boolean(payload?.debug);
    return { texts, debugEnabled };
}
function toAiResultStringList(value) {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value.map((item) => cleanTerm(String(item || ""))).filter((item) => item && !isPlaceholderText(item)))];
}
function normalizeAiAnalyzeResult(row, input) {
    if (!row || typeof row !== "object")
        return null;
    const item = row;
    const lineNumber = Number(item.lineNumber);
    if (!Number.isFinite(lineNumber) || Math.round(lineNumber) !== input.lineNumber)
        return null;
    const oriText = String(item.ori_text ?? "").trim();
    const zh = String(item.zh ?? item.translation_zh ?? "").trim();
    return {
        lineNumber: input.lineNumber,
        ori_text: oriText || input.text,
        zh: !isPlaceholderText(zh) ? zh : "",
        hvc: toAiResultStringList(item.hvc),
        collocations: toAiResultStringList(item.collocations),
        sentence_patterns: toAiResultStringList(item.sentence_patterns ?? item.spoken_patterns)
    };
}
function parseAiAnalyzeResponse(raw, input) {
    const parseFromUnknown = (value, depth = 0) => {
        if (depth > 4 || value == null)
            return null;
        if (Array.isArray(value)) {
            for (const item of value) {
                const hit = parseFromUnknown(item, depth + 1);
                if (hit)
                    return hit;
            }
            return null;
        }
        if (typeof value === "string") {
            const candidates = collectJsonCandidatesFromText(value);
            for (const candidate of candidates) {
                try {
                    const parsed = JSON.parse(candidate);
                    const hit = parseFromUnknown(parsed, depth + 1);
                    if (hit)
                        return hit;
                }
                catch {
                    // ignore and continue
                }
            }
            return null;
        }
        if (typeof value !== "object")
            return null;
        const row = value;
        if (Array.isArray(row.result)) {
            for (const item of row.result) {
                const normalized = normalizeAiAnalyzeResult(item, input);
                if (normalized)
                    return normalized;
            }
        }
        const direct = normalizeAiAnalyzeResult(row, input);
        if (direct)
            return direct;
        const priorityKeys = ["response", "output_text", "text", "content", "generated_text", "choices"];
        for (const key of priorityKeys) {
            const hit = parseFromUnknown(row[key], depth + 1);
            if (hit)
                return hit;
        }
        for (const child of Object.values(row)) {
            const hit = parseFromUnknown(child, depth + 1);
            if (hit)
                return hit;
        }
        return null;
    };
    return parseFromUnknown(raw);
}
function buildAiAnalyzePrompt(input) {
    return [
        AI_ASS_LINE_SYSTEM_PROMPT,
        "",
        "Input JSON:",
        JSON.stringify({ texts: [{ lineNumber: input.lineNumber, text: input.text }] }),
        "",
        "Return only valid JSON."
    ].join("\n");
}
function resolveAssetProxyPath(pathname) {
    for (const route of ASSET_PROXY_ROUTES) {
        if (!pathname.startsWith(route.prefix))
            continue;
        const rest = pathname.slice(route.prefix.length);
        if (!rest || rest.includes("..") || !/^[a-zA-Z0-9._/-]+$/.test(rest))
            return null;
        return { upstreamUrl: route.upstreamBase + rest };
    }
    return null;
}
async function proxyStaticAsset(request, pathname) {
    const target = resolveAssetProxyPath(pathname);
    if (!target)
        return null;
    if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
    }
    const upstreamResp = await fetch(target.upstreamUrl, {
        headers: { accept: request.headers.get("accept") ?? "*/*" },
        cf: { cacheEverything: true, cacheTtl: 86400 }
    });
    if (!upstreamResp.ok) {
        return new Response("Upstream asset fetch failed", { status: 502 });
    }
    const headers = new Headers(upstreamResp.headers);
    headers.set("cache-control", "public, max-age=86400, s-maxage=86400");
    headers.set("x-asset-proxy", "ffmpeg");
    return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        headers
    });
}
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/vendor/ffmpeg/") || url.pathname.startsWith("/vendor/ffmpeg-util/") || url.pathname.startsWith("/vendor/ffmpeg-core/")) {
            const assetResp = await proxyStaticAsset(request, url.pathname);
            if (assetResp)
                return assetResp;
            return new Response("Bad Request", { status: 400 });
        }
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
        if (request.method === "POST" && url.pathname === "/api/ass/ai-analyze") {
            const contentType = request.headers.get("content-type") ?? "";
            if (!contentType.includes("application/json")) {
                return json({ error: "请求必须是 application/json" }, 400);
            }
            let payload;
            try {
                payload = await request.json();
            }
            catch {
                return json({ error: "JSON 解析失败" }, 400);
            }
            const { texts, debugEnabled } = parseAiAnalyzePayload(payload);
            if (texts.length === 0)
                return json({ error: "texts 不能为空" }, 400);
            try {
                const debugTrace = [];
                const result = [];
                const failedLineNumbers = [];
                for (const item of texts) {
                    const runOnce = async (attempt) => {
                        const raw = await env.AI.run(AI_ASS_MODEL, {
                            prompt: buildAiAnalyzePrompt(item),
                            response_format: { type: "json_object" },
                            temperature: attempt === "first" ? 0.2 : 0,
                            max_tokens: 768
                        });
                        const parsed = parseAiAnalyzeResponse(raw, item);
                        if (debugEnabled) {
                            debugTrace.push({
                                stage: "line_" + item.lineNumber + "_" + attempt,
                                ok: Boolean(parsed),
                                parsed_preview: parsed ? toDebugPreview(parsed, 300) : "",
                                raw_preview: toDebugPreview(compactAiRawForDebug(raw), 900)
                            });
                        }
                        return parsed;
                    };
                    let row = await runOnce("first");
                    if (!row || !row.zh)
                        row = await runOnce("retry");
                    if (!row || !row.zh) {
                        failedLineNumbers.push(item.lineNumber);
                        row = {
                            lineNumber: item.lineNumber,
                            ori_text: item.text,
                            zh: "",
                            hvc: [],
                            collocations: [],
                            sentence_patterns: []
                        };
                    }
                    result.push(row);
                }
                const successCount = result.filter((item) => Boolean(item.zh)).length;
                if (successCount === 0) {
                    return json({
                        error: "AI 返回为空，请重试。",
                        ...(debugEnabled ? { debug: { trace: debugTrace, merged_preview: toDebugPreview(result, 1200) } } : {})
                    }, 502);
                }
                return json({
                    result,
                    ...(failedLineNumbers.length > 0 ? { warning: "部分行分析失败", failedLineNumbers } : {}),
                    ...(debugEnabled ? { debug: { trace: debugTrace, merged_preview: toDebugPreview(result, 1200) } } : {})
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "AI 分析调用失败";
                return json({ error: message }, 500);
            }
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
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Workers AI 调用失败";
                return json({ error: message }, 500);
            }
        }
        return new Response("Not Found", { status: 404 });
    }
};
