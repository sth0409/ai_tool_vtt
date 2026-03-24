import { ASS_PAGE, EXTRACT_PAGE } from "./pages";

interface Env {
  AI: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const AI_ASS_MODEL = "@cf/openai/gpt-oss-120b";
const AI_ASS_ANALYSIS_INSTRUCTIONS = `你是一位专业的雅思（IELTS）英语教师和词汇分析师。你将收到带序号的英语字幕句子，请输出严格 JSON（不要 markdown、不要注释）。

分析要求（严格遵守）：
1) 高价值词汇（HVC）：只提取“雅思口语可加分”的 B2-C1 词汇。必须排除 A1-B1 基础词（如 good, bad, big, small, nice, thing, people, very, really, get, make, do, go, want）。
   - 优先抽象表达、学术/半学术词、观点表达词、逻辑词（如 perspective, implications, substantial, controversial）。
   - HVC 尽量是单词，不要输出短语。
2) 固定搭配/短语动词（Collocations/Phrasal Verbs）：提取两个及以上单词组成、语义不完全字面化的搭配。
3) 地道表达/俚语（Idioms/Expressions）：提取提升口语流利度的表达。
4) 口语常用句型（Spoken Patterns）：提取适合口语复用的句型（如 "I'm hooked on ..."）。
5) 每句话都要给出自然、准确的中文翻译。

输出 JSON 结构（字段名必须一致）：
{
  "cues": [
    {
      "order": 1,
      "translation_zh": "中文翻译",
      "hvc": ["..."],
      "collocations": ["..."],
      "expressions": ["..."],
      "spoken_patterns": ["..."]
    }
  ]
}

规则：
- order 必须与输入序号一致。
- 所有数组可为空，但必须存在。
- 不要遗漏句子。
- 禁止使用省略号或占位符（如 "...", "N/A", "TBD"）。`;
const AI_ASS_ANALYSIS_INSTRUCTIONS_STRICT = `你是一位专业的雅思（IELTS）英语教师和词汇分析师。你将收到带序号的英语字幕句子，请输出严格 JSON（不要 markdown、不要注释）。

强制要求（必须遵守）：
1) 高价值词汇（HVC）：只保留“雅思口语加分词”（B2-C1），排除基础词与口语常见简单词。
2) 固定搭配/短语动词（Collocations/Phrasal Verbs）：提取两个及以上单词组成、语义不完全字面化的搭配。
3) 地道表达/俚语（Idioms/Expressions）：提取提升口语流利度的表达。
4) 口语常用句型（Spoken Patterns）：提取适合口语复用的句型（如 "I'm hooked on ..."）。
5) 每句话都要给出自然、准确的中文翻译。
6) 每一句必须给出自然、准确的中文翻译 translation_zh（不能为空）。
7) 不允许使用省略号、占位符、模板字样。
8) 所有字段必须存在，数组可为空，但 translation_zh 不能空。
9) order 必须与输入序号一致。

输出 JSON 结构（字段名必须一致）：
{
  "cues": [
    {
      "order": 1,
      "translation_zh": "中文翻译",
      "hvc": ["..."],
      "collocations": ["..."],
      "expressions": ["..."],
      "spoken_patterns": ["..."]
    }
  ]
}`;
const AI_ASS_ANALYSIS_INSTRUCTIONS_SINGLE = `你是一位专业的雅思（IELTS）英语教师和词汇分析师。你将收到 1 句英文字幕，必须输出严格 JSON（不要 markdown、不要注释）。

强制要求：
1) 高价值词汇（HVC）：只保留“雅思口语加分词”（B2-C1），排除基础词与口语常见简单词。
2) 固定搭配/短语动词（Collocations/Phrasal Verbs）：提取两个及以上单词组成、语义不完全字面化的搭配。
3) 地道表达/俚语（Idioms/Expressions）：提取提升口语流利度的表达。
4) 口语常用句型（Spoken Patterns）：提取适合口语复用的句型（如 "I'm hooked on ..."）。
5) 每句话都要给出自然、准确的中文翻译。
6) translation_zh 必须是自然、准确的中文翻译，不能为空。
7) 如果能判断高价值词/搭配/表达，请填写；否则留空数组。
8) 只输出 1 个 cues 元素，order 必须与输入序号一致。
9) 禁止使用省略号或占位符（如 "...", "N/A", "TBD"）。

输出 JSON 结构（字段名必须一致）：
{
  "cues": [
    {
      "order": 1,
      "translation_zh": "中文翻译",
      "hvc": [],
      "collocations": [],
      "expressions": [],
      "spoken_patterns": []
    }
  ]
}`;
const AI_ASS_TRANSLATION_ONLY_INSTRUCTIONS = `你是专业英译中翻译。你将收到 1 句英文字幕，请输出严格 JSON（不要 markdown、不要注释）。

强制要求：
1) 只输出 translation_zh 字段，不能为空。
2) 禁止使用省略号或占位符（如 "...", "N/A", "TBD"）。

输出 JSON 结构：
{
  "translation_zh": "中文翻译"
}`;
const AI_ASS_CLASSIFY_ONLY_INSTRUCTIONS = `你是一位专业的雅思（IELTS）英语教师和词汇分析师。你将收到带序号的英语字幕句子，请只做分类并输出严格 JSON（不要 markdown、不要注释）。

分类要求（严格）：
1) hvc：只保留“雅思口语可加分”的 B2-C1 单词，排除基础词（A1-B1）和过于简单词。
2) collocations：固定搭配/短语动词。
3) spoken_patterns：口语常用句型。
4) expressions 可以作为补充表达，但前端会按优先级并入口语句型。
5) 不输出中文翻译，translation_zh 固定为 ""。
6) order 必须与输入序号一致，不可遗漏。

输出 JSON 结构：
{
  "cues": [
    {
      "order": 1,
      "translation_zh": "",
      "hvc": [],
      "collocations": [],
      "expressions": [],
      "spoken_patterns": []
    }
  ]
}`;
const AI_ASS_TRANSLATE_BATCH_INSTRUCTIONS = `你是专业英译中翻译。你将收到带序号的英文字幕，请逐句翻译并输出严格 JSON（不要 markdown、不要注释）。

要求：
1) translation_zh 必须是自然、准确、完整的中文翻译，不能为空。
2) order 必须与输入序号一致，不能遗漏。
3) 不要输出多余解释。

输出 JSON 结构：
{
  "cues": [
    {
      "order": 1,
      "translation_zh": "中文翻译",
      "hvc": [],
      "collocations": [],
      "expressions": [],
      "spoken_patterns": []
    }
  ]
}`;

type AiAssCueAnalysis = {
  order: number;
  translation_zh: string;
  hvc: string[];
  collocations: string[];
  expressions: string[];
  spoken_patterns: string[];
};

const IELTS_BASIC_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "so", "because",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "them",
  "is", "am", "are", "was", "were", "be", "been", "being", "do", "does", "did",
  "have", "has", "had", "go", "goes", "went", "come", "came", "get", "got",
  "make", "made", "take", "took", "put", "say", "said", "tell", "told",
  "want", "need", "like", "love", "hate", "feel", "think", "know", "see", "look",
  "use", "used", "try", "find", "give", "work", "play", "help", "talk",
  "good", "bad", "nice", "great", "small", "big", "easy", "hard", "new", "old",
  "important", "interesting", "happy", "sad", "thing", "stuff", "people", "person",
  "man", "woman", "boy", "girl", "child", "children", "friend", "family", "home",
  "school", "job", "money", "time", "day", "year", "week", "today", "tomorrow",
  "really", "very", "just", "maybe", "also", "always", "often", "sometimes", "never"
]);

function isLikelyIeltsHvc(term: string): boolean {
  const raw = cleanTerm(term).toLowerCase();
  if (!raw || isPlaceholderText(raw)) return false;
  if (raw.includes(" ")) return false;

  const word = raw.replace(/[^a-z-]/g, "");
  if (!word) return false;
  if (IELTS_BASIC_WORDS.has(word)) return false;
  if (word.length <= 3) return false;
  if (word.length >= 8) return true;

  // Typical B2-C1 morphology markers.
  if (/(tion|sion|ment|ness|ship|ity|ence|ance|able|ible|ative|itive|ious|eous|ical|ology|ism|ist|ize|ise|ward|wise|scope|claim|plex|duct|gress|clude|voke|strain)$/i.test(word)) {
    return true;
  }
  if (/^(inter|trans|sub|super|under|over|anti|auto|multi|micro|macro|pre|post)/i.test(word) && word.length >= 6) {
    return true;
  }
  return word.length >= 6;
}

function filterIeltsHvcTerms(terms: string[]): string[] {
  return [...new Set(terms.map((item) => cleanTerm(item)).filter((item) => isLikelyIeltsHvc(item)))];
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectStringValues(item));
  if (!value || typeof value !== "object") return [];

  const obj = value as Record<string, unknown>;
  const keys = [
    "response",
    "text",
    "content",
    "output_text",
    "generated_text"
  ];
  const direct = keys.flatMap((key) => collectStringValues(obj[key]));
  const nested = Object.values(obj).flatMap((item) => collectStringValues(item));
  return [...direct, ...nested];
}

function extractJsonText(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);

  return null;
}

function extractBalancedJsonObjects(raw: string, maxCount = 8): string[] {
  const text = String(raw || "");
  if (!text) return [];
  const blocks: string[] = [];
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
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (ch === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        blocks.push(text.slice(start, i + 1));
        start = -1;
        if (blocks.length >= maxCount) break;
      }
    }
  }

  return blocks;
}

function collectJsonCandidatesFromText(raw: string): string[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  const out: string[] = [];

  const push = (value: string | null) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  };

  push(extractJsonText(text));
  for (const block of extractBalancedJsonObjects(text)) push(block);

  try {
    const maybeUnwrapped = JSON.parse(text) as unknown;
    if (typeof maybeUnwrapped === "string") {
      const decoded = maybeUnwrapped.trim();
      if (decoded && decoded !== text) {
        push(extractJsonText(decoded));
        for (const block of extractBalancedJsonObjects(decoded)) push(block);
      }
    }
  } catch {
    // ignore non-JSON text
  }

  return out;
}

function isPlaceholderText(value: string): boolean {
  const cleaned = String(value || "").replace(/\s+/g, "").toLowerCase();
  if (!cleaned) return true;
  if (cleaned === "..." || cleaned === "…") return true;
  if (cleaned === "n/a" || cleaned === "na" || cleaned === "tbd") return true;
  if (/^cmpl-[a-z0-9]{16,}$/i.test(cleaned)) return true;
  if (/^\.+$/.test(cleaned)) return true;
  return false;
}

function decodeJsonStringLiteral(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw;
  }
}

function extractTranslationFromText(rawText: string): string {
  const text = String(rawText || "").trim();
  if (!text) return "";

  const fullJson = extractJsonText(text);
  if (fullJson) {
    try {
      const parsed = JSON.parse(fullJson) as Record<string, unknown>;
      const direct = findTranslationField(parsed);
      if (direct && !isPlaceholderText(direct)) return direct;
    } catch {
      // ignore and continue
    }
  }

  const objectMatches = text.match(/\{[\s\S]*?\}/g) || [];
  for (const block of objectMatches) {
    try {
      const parsed = JSON.parse(block) as Record<string, unknown>;
      const direct = findTranslationField(parsed);
      if (direct && !isPlaceholderText(direct)) return direct;
    } catch {
      // ignore parse failure for this block
    }
  }

  const m = text.match(/"translation_zh"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (m?.[1]) {
    const decoded = decodeJsonStringLiteral(m[1]).trim();
    if (decoded && !isPlaceholderText(decoded)) return decoded;
  }

  return "";
}

function pickStringField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object") {
      const nested = collectStringValues(value).map((item) => item.trim()).filter(Boolean);
      if (nested.length > 0) return nested[0];
    }
  }
  return "";
}

function cleanTerm(raw: string): string {
  const trimmed = String(raw || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const stripped = trimmed
    .replace(/^[\s"'“”‘’()\\[\\]{}.,!?;:]+/, "")
    .replace(/[\s"'“”‘’()\\[\\]{}.,!?;:]+$/, "");
  return stripped.replace(/\s*[-–—:]\s*.+$/, "").trim();
}

function toStringList(value: unknown): string[] {
  if (typeof value === "string") {
    const cleaned = cleanTerm(value);
    return cleaned ? [cleaned] : [];
  }
  if (Array.isArray(value)) {
    const list = value
      .flatMap((item) => toStringList(item))
      .map((item) => cleanTerm(item))
      .filter(Boolean);
    return [...new Set(list)];
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = ["items", "values", "list", "words", "phrases", "terms"];
    for (const key of keys) {
      if (obj[key]) return toStringList(obj[key]);
    }
  }
  return [];
}

function normalizeAiAssCues(value: unknown): AiAssCueAnalysis[] {
  if (!Array.isArray(value)) return [];
  const cues: AiAssCueAnalysis[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const order = Number(row.order);
    if (!Number.isFinite(order)) continue;
    const translation = pickStringField(row, [
      "translation_zh",
      "translation",
      "translation_cn",
      "translation_zh_cn",
      "translationZh",
      "translationZH",
      "zh",
      "cn",
      "chinese"
    ]);
    const hvc = filterIeltsHvcTerms(toStringList(
      row.hvc
      ?? row.HVC
      ?? row.high_value_vocab
      ?? row.academic_vocab
      ?? row.academic_vocabulary
      ?? row.core_vocab
      ?? row.core_vocabulary
      ?? row.key_words
      ?? row.keywords
      ?? row.vocabulary
    ));
    const collocations = toStringList(
      row.collocations
      ?? row.collocation
      ?? row.phrasal_verbs
      ?? row.phrasalVerbs
      ?? row.phrases
      ?? row.collocations_phrasal_verbs
      ?? row.phrasal_verbs_collocations
    );
    const expressions = toStringList(
      row.expressions
      ?? row.expression
      ?? row.idioms
      ?? row.idiom
      ?? row.slang
      ?? row.idiom_expressions
      ?? row.expressions_idioms
    );
    const spokenPatterns = toStringList(
      row.spoken_patterns
      ?? row.spokenPatterns
      ?? row.patterns
      ?? row.sentence_patterns
      ?? row.sentencePatterns
      ?? row.oral_patterns
      ?? row.structures
    );
    cues.push({
      order: Math.round(order),
      translation_zh: translation,
      hvc,
      collocations,
      expressions,
      spoken_patterns: spokenPatterns
    });
  }
  return cues;
}

function parseAiAssAnalysis(result: Record<string, unknown>): AiAssCueAnalysis[] {
  const parseFromUnknown = (value: unknown, depth = 0): AiAssCueAnalysis[] => {
    if (depth > 4 || value == null) return [];

    if (Array.isArray(value)) {
      for (const item of value) {
        const hit = parseFromUnknown(item, depth + 1);
        if (hit.length > 0) return hit;
      }
      return [];
    }

    if (typeof value === "string") {
      const candidates = collectJsonCandidatesFromText(value);
      for (const candidate of candidates) {
        try {
          const parsed = JSON.parse(candidate) as unknown;
          const hit = parseFromUnknown(parsed, depth + 1);
          if (hit.length > 0) return hit;
        } catch {
          // ignore and continue
        }
      }
      return [];
    }

    if (typeof value !== "object") return [];
    const row = value as Record<string, unknown>;

    if (Array.isArray(row.cues)) {
      const normalized = normalizeAiAssCues(row.cues);
      if (normalized.length > 0) return normalized;
    }
    const nestedPayload = findCuesPayload(row);
    if (nestedPayload?.cues) {
      const normalized = normalizeAiAssCues(nestedPayload.cues);
      if (normalized.length > 0) return normalized;
    }

    const priorityKeys = ["response", "output_text", "text", "content", "generated_text", "choices"];
    for (const key of priorityKeys) {
      const hit = parseFromUnknown(row[key], depth + 1);
      if (hit.length > 0) return hit;
    }

    for (const child of Object.values(row)) {
      const hit = parseFromUnknown(child, depth + 1);
      if (hit.length > 0) return hit;
    }
    return [];
  };

  return parseFromUnknown(result);
}

function findCuesPayload(value: unknown): { cues: unknown[] } | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findCuesPayload(item);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj.cues)) return { cues: obj.cues };
  for (const child of Object.values(obj)) {
    const hit = findCuesPayload(child);
    if (hit) return hit;
  }
  return null;
}

function findTranslationField(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findTranslationField(item);
      if (hit) return hit;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  const obj = value as Record<string, unknown>;
  const direct = String(
    obj.translation_zh
    ?? obj.translation
    ?? obj.translation_cn
    ?? obj.translation_zh_cn
    ?? obj.zh
    ?? obj.cn
    ?? ""
  ).trim();
  if (direct && !isPlaceholderText(direct)) return direct;
  for (const child of Object.values(obj)) {
    const hit = findTranslationField(child);
    if (hit) return hit;
  }
  return "";
}

function extractTranslationText(result: Record<string, unknown>): string {
  const directField = findTranslationField(result);
  if (directField) return directField;

  const choices = Array.isArray(result.choices) ? result.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const text = String((choice as Record<string, unknown>).text ?? "").trim();
    const hit = extractTranslationFromText(text);
    if (hit) return hit;
  }

  const outputText = String(result.output_text ?? result.text ?? "").trim();
  if (outputText) {
    const hit = extractTranslationFromText(outputText);
    if (hit) return hit;
  }

  const direct = collectStringValues(result)
    .map((item) => String(item || "").trim())
    .filter((item) => item && !isPlaceholderText(item));
  for (const candidateText of direct) {
    const hit = extractTranslationFromText(candidateText);
    if (hit) return hit;
  }
  return "";
}

function cueHasAnyValue(cue: AiAssCueAnalysis): boolean {
  return Boolean(
    cue.translation_zh
    || cue.hvc.length > 0
    || cue.collocations.length > 0
    || cue.expressions.length > 0
    || cue.spoken_patterns.length > 0
  );
}

function isMostlyEmpty(cues: AiAssCueAnalysis[], threshold = 0.6): boolean {
  if (cues.length === 0) return true;
  const emptyCount = cues.filter((cue) => !cueHasAnyValue(cue)).length;
  return emptyCount / cues.length >= threshold;
}

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

function toDebugPreview(value: unknown, limit = 2400): string {
  let text = "";
  if (typeof value === "string") {
    text = value;
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return compact.slice(0, limit) + ` ... [truncated ${compact.length - limit} chars]`;
}

function compactAiRawForDebug(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return { type: typeof value, preview: toDebugPreview(value, 280) };
  }
  const row = value as Record<string, unknown>;
  const choices = Array.isArray(row.choices) ? row.choices : [];
  const compactChoices = choices.slice(0, 2).map((item) => {
    if (!item || typeof item !== "object") {
      return { preview: toDebugPreview(item, 220) };
    }
    const choice = item as Record<string, unknown>;
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

function parseAiAssRequestPayload(payload: unknown): {
  cues: Array<{ order: number; text: string }>;
  debugEnabled: boolean;
} {
  const rows = Array.isArray((payload as Record<string, unknown>)?.cues)
    ? ((payload as Record<string, unknown>).cues as unknown[])
    : [];
  const cues = rows
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const order = Number(row.order);
      const text = String(row.text ?? "").replace(/\s+/g, " ").trim();
      if (!Number.isFinite(order) || !text) return null;
      return { order: Math.round(order), text: text.slice(0, 400) };
    })
    .filter((item): item is { order: number; text: string } => Boolean(item))
    .slice(0, 300);
  const debugEnabled = Boolean((payload as Record<string, unknown>)?.debug);
  return { cues, debugEnabled };
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

    if (request.method === "POST" && url.pathname === "/api/ass/ai-classify") {
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return json({ error: "请求必须是 application/json" }, 400);
      }
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "JSON 解析失败" }, 400);
      }
      const { cues, debugEnabled } = parseAiAssRequestPayload(payload);
      if (cues.length === 0) return json({ error: "cues 不能为空" }, 400);

      try {
        const debugTrace: Array<Record<string, unknown>> = [];
        const merged: Array<{
          order: number;
          translation_zh: string;
          hvc: string[];
          collocations: string[];
          expressions: string[];
          spoken_patterns: string[];
        }> = [];
        const failedOrders: number[] = [];

        const hasAnyClass = (row: { hvc: unknown[]; collocations: unknown[]; expressions: unknown[]; spoken_patterns: unknown[] }) =>
          row.hvc.length > 0 || row.collocations.length > 0 || row.expressions.length > 0 || row.spoken_patterns.length > 0;

        for (const cue of cues) {
          const runSingleClassify = async (attempt: "first" | "retry") => {
            const singlePrompt = [
              AI_ASS_CLASSIFY_ONLY_INSTRUCTIONS,
              "",
              "输入：",
              "[" + String(cue.order).padStart(3, "0") + "] " + cue.text,
              "",
              "仅输出 JSON。"
            ].join("\n");
            const raw = await env.AI.run(AI_ASS_MODEL, {
              prompt: singlePrompt,
              response_format: { type: "json_object" },
              temperature: attempt === "first" ? 0.2 : 0,
              max_tokens: 512
            });
            const parsed = parseAiAssAnalysis(raw);
            if (debugEnabled) {
              debugTrace.push({
                stage: "single_classify_" + cue.order + "_" + attempt,
                parsed_count: parsed.length,
                classified_count: parsed.filter((row) => hasAnyClass(row)).length,
                raw_preview: toDebugPreview(compactAiRawForDebug(raw), 900)
              });
            }
            const hit = parsed.find((item) => Number(item?.order) === cue.order) ?? parsed[0] ?? null;
            if (!hit) return null;
            return {
              order: cue.order,
              translation_zh: "",
              hvc: hit.hvc ?? [],
              collocations: hit.collocations ?? [],
              expressions: hit.expressions ?? [],
              spoken_patterns: hit.spoken_patterns ?? []
            };
          };

          let row = await runSingleClassify("first");
          if (!row || !hasAnyClass(row)) {
            const retryRow = await runSingleClassify("retry");
            if (retryRow && (hasAnyClass(retryRow) || !row)) {
              row = retryRow;
            }
          }
          if (!row) {
            failedOrders.push(cue.order);
            row = {
              order: cue.order,
              translation_zh: "",
              hvc: [],
              collocations: [],
              expressions: [],
              spoken_patterns: []
            };
          } else if (!hasAnyClass(row)) {
            failedOrders.push(cue.order);
          }
          merged.push(row);
        }

        if (!merged.some((row) => hasAnyClass(row))) {
          return json({
            error: "AI 分类为空，请重试或先打开调试模式查看原始返回。",
            ...(debugEnabled ? { debug: { trace: debugTrace, merged_preview: toDebugPreview(merged, 1200) } } : {})
          }, 502);
        }

        return json({
          configs: [
            { key: "hvc", name: "高价值词汇（HVC）", color: "&H0000FFFF" },
            { key: "collocations", name: "固定搭配/短语动词", color: "&H0032CD32" },
            { key: "spoken_patterns", name: "口语常用句型", color: "&H00FF00AA" }
          ],
          cues: merged,
          ...(failedOrders.length > 0 ? { warning: "部分句子分类为空", failed_orders: failedOrders } : {}),
          ...(debugEnabled ? { debug: { trace: debugTrace, merged_preview: toDebugPreview(merged, 1200) } } : {})
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI 分类调用失败";
        return json({ error: message }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/ass/ai-translate") {
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return json({ error: "请求必须是 application/json" }, 400);
      }
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "JSON 解析失败" }, 400);
      }
      const { cues, debugEnabled } = parseAiAssRequestPayload(payload);
      if (cues.length === 0) return json({ error: "cues 不能为空" }, 400);

      try {
        const debugTrace: Array<Record<string, unknown>> = [];
        const merged: Array<{
          order: number;
          translation_zh: string;
          hvc: string[];
          collocations: string[];
          expressions: string[];
          spoken_patterns: string[];
        }> = [];
        const failedOrders: number[] = [];

        for (const cue of cues) {
          const runSingle = async (attempt: "first" | "retry"): Promise<string> => {
            const singlePrompt = [
              AI_ASS_TRANSLATION_ONLY_INSTRUCTIONS,
              "",
              "待翻译英文：",
              cue.text,
              "",
              "只输出 JSON，不要输出任何解释。"
            ].join("\n");
            const singleRaw = await env.AI.run(AI_ASS_MODEL, {
              prompt: singlePrompt,
              response_format: { type: "json_object" },
              temperature: attempt === "first" ? 0.2 : 0,
              max_tokens: 256
            });
            const zh = extractTranslationText(singleRaw);
            if (debugEnabled) {
              debugTrace.push({
                stage: "single_translation_" + cue.order + "_" + attempt,
                ok: Boolean(zh),
                raw_preview: toDebugPreview(compactAiRawForDebug(singleRaw), 900)
              });
            }
            return zh;
          };

          let zh = await runSingle("first");
          if (!zh || isPlaceholderText(zh)) {
            zh = await runSingle("retry");
          }
          if (!zh || isPlaceholderText(zh)) {
            failedOrders.push(cue.order);
            zh = "";
          }

          merged.push({
            order: cue.order,
            translation_zh: zh,
            hvc: [],
            collocations: [],
            expressions: [],
            spoken_patterns: []
          });
        }

        const hasTranslation = merged.some((cue) => cue.translation_zh);
        if (!hasTranslation) {
          return json({
            error: "AI 翻译为空，请重试",
            ...(debugEnabled ? { debug: { trace: debugTrace } } : {})
          }, 502);
        }

        return json({
          cues: merged,
          ...(failedOrders.length > 0 ? { warning: "部分句子翻译失败", failed_orders: failedOrders } : {}),
          ...(debugEnabled ? { debug: { trace: debugTrace, merged_preview: toDebugPreview(merged, 1200) } } : {})
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI 翻译调用失败";
        return json({ error: message }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/ass/ai-analyze") {
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return json({ error: "请求必须是 application/json" }, 400);
      }

      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "JSON 解析失败" }, 400);
      }

      const rows = Array.isArray((payload as Record<string, unknown>)?.cues)
        ? ((payload as Record<string, unknown>).cues as unknown[])
        : [];
      const cues = rows
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const order = Number(row.order);
          const text = String(row.text ?? "").replace(/\s+/g, " ").trim();
          if (!Number.isFinite(order) || !text) return null;
          return { order: Math.round(order), text: text.slice(0, 400) };
        })
        .filter((item): item is { order: number; text: string } => Boolean(item))
        .slice(0, 300);

      if (cues.length === 0) {
        return json({ error: "cues 不能为空" }, 400);
      }
      const debugEnabled = Boolean((payload as Record<string, unknown>)?.debug);
      const debugTrace: Array<Record<string, unknown>> = [];

      try {
        const buildInput = (subset: { order: number; text: string }[]) => ([
          "请按要求分析下面英语字幕，并返回严格 JSON：",
          "",
          ...subset.map((cue) => "[" + String(cue.order).padStart(3, "0") + "] " + cue.text)
        ].join("\n"));

        const buildPrompt = (instructions: string, inputText: string) => (
          instructions + "\n\n" + inputText + "\n\n仅输出 JSON。"
        );

        const runOnce = async (stage: string, instructions: string, inputText: string, maxTokens: number) => {
          const raw = await env.AI.run(AI_ASS_MODEL, {
            prompt: buildPrompt(instructions, inputText),
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: maxTokens
          });
          const parsed = parseAiAssAnalysis(raw);
          if (debugEnabled) {
            debugTrace.push({
              stage,
              parsed_count: parsed.length,
              non_empty_count: parsed.filter((cue) => cueHasAnyValue(cue)).length,
              raw_preview: toDebugPreview(compactAiRawForDebug(raw), 900)
            });
          }
          return parsed;
        };
        const runTranslation = async (stage: string, inputText: string, maxTokens: number) => {
          const raw = await env.AI.run(AI_ASS_MODEL, {
            prompt: buildPrompt(AI_ASS_TRANSLATION_ONLY_INSTRUCTIONS, inputText),
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: maxTokens
          });
          const translation = extractTranslationText(raw);
          if (debugEnabled) {
            debugTrace.push({
              stage,
              translation_ok: Boolean(translation),
              raw_preview: toDebugPreview(compactAiRawForDebug(raw), 900)
            });
          }
          return translation;
        };

        const input = buildInput(cues);
        let parsedCues = await runOnce("batch_initial", AI_ASS_ANALYSIS_INSTRUCTIONS, input, 4096);
        let parsedMap = new Map(parsedCues.map((cue) => [cue.order, cue]));
        let merged = cues.map((cue) => {
          const hit = parsedMap.get(cue.order);
          return {
            order: cue.order,
            translation_zh: hit?.translation_zh ?? "",
            hvc: hit?.hvc ?? [],
            collocations: hit?.collocations ?? [],
            expressions: hit?.expressions ?? [],
            spoken_patterns: hit?.spoken_patterns ?? []
          };
        });

        if (isMostlyEmpty(merged)) { 
          parsedCues = await runOnce("batch_strict", AI_ASS_ANALYSIS_INSTRUCTIONS_STRICT, input, 4096);
          parsedMap = new Map(parsedCues.map((cue) => [cue.order, cue]));
          merged = cues.map((cue) => {
            const hit = parsedMap.get(cue.order);
            return {
              order: cue.order,
              translation_zh: hit?.translation_zh ?? "",
              hvc: hit?.hvc ?? [],
              collocations: hit?.collocations ?? [],
              expressions: hit?.expressions ?? [],
              spoken_patterns: hit?.spoken_patterns ?? []
            };
          });
        }

        if (isMostlyEmpty(merged, 0.8)) {
          const mergedMap = new Map(merged.map((cue) => [cue.order, cue]));
          for (const cue of cues) {
            const current = mergedMap.get(cue.order);
            if (current && cueHasAnyValue(current)) continue;
            const singleInput = buildInput([cue]);
            const singleParsed = await runOnce("single_" + cue.order, AI_ASS_ANALYSIS_INSTRUCTIONS_SINGLE, singleInput, 512);
            const singleHit = singleParsed.find((item) => Number(item?.order) === cue.order) ?? singleParsed[0] ?? null;
            let updated = {
              order: cue.order,
              translation_zh: (singleHit?.translation_zh ?? current?.translation_zh ?? "") || "",
              hvc: (singleHit?.hvc && singleHit.hvc.length > 0) ? singleHit.hvc : (current?.hvc ?? []),
              collocations: (singleHit?.collocations && singleHit.collocations.length > 0) ? singleHit.collocations : (current?.collocations ?? []),
              expressions: (singleHit?.expressions && singleHit.expressions.length > 0) ? singleHit.expressions : (current?.expressions ?? []),
              spoken_patterns: (singleHit?.spoken_patterns && singleHit.spoken_patterns.length > 0) ? singleHit.spoken_patterns : (current?.spoken_patterns ?? [])
            };
            if (!updated.translation_zh || isPlaceholderText(updated.translation_zh)) {
              const translationOnly = await runTranslation("translation_only_" + cue.order, singleInput, 256);
              if (translationOnly) {
                updated = { ...updated, translation_zh: translationOnly };
              }
            }
            mergedMap.set(cue.order, updated);
          }
          merged = cues.map((cue) => mergedMap.get(cue.order) ?? {
            order: cue.order,
            translation_zh: "",
            hvc: [],
            collocations: [],
            expressions: [],
            spoken_patterns: []
          });
        }

        if (isMostlyEmpty(merged, 0.9)) {
          return json({
            error: "AI 返回为空或占位符过多，请重试",
            ...(debugEnabled ? { debug: { trace: debugTrace, merged_preview: toDebugPreview(merged, 1200) } } : {})
          }, 502);
        }

        return json({
          configs: [
            { key: "hvc", name: "高价值词汇（HVC）", color: "&H0000FFFF" },
            { key: "collocations", name: "固定搭配/短语动词", color: "&H0032CD32" },
            { key: "spoken_patterns", name: "口语常用句型", color: "&H00FF00AA" }
          ],
          cues: merged,
          ...(debugEnabled ? { debug: { trace: debugTrace, merged_preview: toDebugPreview(merged, 1200) } } : {})
        });
      } catch (error) {
        try {
          const fallbackCues: Array<{
            order: number;
            translation_zh: string;
            hvc: string[];
            collocations: string[];
            expressions: string[];
            spoken_patterns: string[];
          }> = [];
          for (const cue of cues) {
            const prompt = [
              AI_ASS_TRANSLATION_ONLY_INSTRUCTIONS,
              "",
              "输入：",
              "[" + String(cue.order).padStart(3, "0") + "] " + cue.text,
              "",
              "仅输出 JSON。"
            ].join("\n");
            const raw = await env.AI.run(AI_ASS_MODEL, {
              prompt,
              response_format: { type: "json_object" },
              temperature: 0.2,
              max_tokens: 256
            });
            const zh = extractTranslationText(raw);
            if (debugEnabled) {
              debugTrace.push({
                stage: "fallback_translation_" + cue.order,
                translation_ok: Boolean(zh),
                raw_preview: toDebugPreview(compactAiRawForDebug(raw), 900)
              });
            }
            fallbackCues.push({
              order: cue.order,
              translation_zh: zh,
              hvc: [],
              collocations: [],
              expressions: [],
              spoken_patterns: []
            });
          }

          const hasTranslation = fallbackCues.some((cue) => Boolean(cue.translation_zh));
          if (hasTranslation) {
            return json({
              configs: [
                { key: "hvc", name: "高价值词汇（HVC）", color: "&H0000FFFF" },
                { key: "collocations", name: "固定搭配/短语动词", color: "&H0032CD32" },
                { key: "spoken_patterns", name: "口语常用句型", color: "&H00FF00AA" }
              ],
              cues: fallbackCues,
              warning: "分析结果不稳定，已自动降级为逐句翻译兜底。",
              ...(debugEnabled ? { debug: { trace: debugTrace, merged_preview: toDebugPreview(fallbackCues, 1200) } } : {})
            });
          }
        } catch {
          // ignore fallback failure and return root error below
        }

        const message = error instanceof Error ? error.message : "AI 分析调用失败";
        return json({
          error: message,
          ...(debugEnabled ? { debug: { trace: debugTrace } } : {})
        }, 500);
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "Workers AI 调用失败";
        return json({ error: message }, 500);
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
