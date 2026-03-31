const axios = require("axios");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const pdf = require("pdf-parse");

function normalizeText(value) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDisplayText(value) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function uniqueCharCount(value) {
  return new Set(Array.from(String(value || "").toLowerCase())).size;
}

function isLikelyOcrNoiseToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return false;
  if (/^[.·•\-_=+~]{3,}$/.test(raw)) return true;

  const lettersOnly = raw.replace(/[^\p{L}]/gu, "");
  if (!lettersOnly) return false;

  const len = lettersOnly.length;
  const uniq = uniqueCharCount(lettersOnly);
  const uniqRatio = uniq / Math.max(1, len);
  const hasLongCharRun = /(.)\1{3,}/u.test(lettersOnly);
  const hasRepeatingChunk = /(.{2,4})\1{3,}/u.test(lettersOnly);
  const lower = lettersOnly.toLowerCase();
  const vowels = (lower.match(/[aeiouyаэиоуөүыёюяе]/gu) || []).length;
  const vowelRatio = vowels / Math.max(1, len);

  let bigramRatio = 1;
  if (len >= 8) {
    const totalBigrams = len - 1;
    const uniqBigrams = new Set();
    for (let i = 0; i < len - 1; i += 1) {
      uniqBigrams.add(lower.slice(i, i + 2));
    }
    bigramRatio = uniqBigrams.size / Math.max(1, totalBigrams);
  }

  if (len >= 8 && uniq <= 2) return true;
  if (len >= 10 && uniq <= 3) return true;
  if (len >= 14 && uniqRatio <= 0.32) return true;
  if (len >= 12 && hasLongCharRun && uniq <= 5) return true;
  if (len >= 12 && hasRepeatingChunk && uniq <= 6) return true;
  if (len >= 11 && vowelRatio <= 0.12 && uniq <= 7) return true;
  if (len >= 12 && bigramRatio <= 0.28) return true;
  return false;
}

function removeOcrNoiseTokens(value) {
  const tokens = String(value || "").split(/\s+/).filter(Boolean);
  const filtered = tokens.filter((token) => !isLikelyOcrNoiseToken(token));
  return filtered.join(" ");
}

function normalizeTocLeaders(value) {
  return String(value || "")
    .replace(/\+\s*(\d{1,3})(?=\s|$)/g, "$1")
    .replace(/[.·•\-_=~]{3,}\s*(\d{1,3})(?=\s|$)/g, " $1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function looksLikeTableOfContentsText(value) {
  const text = String(value || "");
  if (!text) return false;

  const hasMarker = /(ГАРЧИГ|TABLE OF CONTENTS|CONTENTS)/iu.test(text);
  const sectionCount = (text.match(/\b\d+\.\d+(?:\.\d+)?\b/g) || []).length;
  const chapterCount = (text.match(/Б[ҮУ]?ЛЭГ/giu) || []).length;
  const leaderCount = (text.match(/[.·•\-_=~]{3,}/g) || []).length;
  const pageNumberCount = (text.match(/(?:^|\s)[+\-]?\d{1,3}(?=\s|$)/g) || []).length;

  if (hasMarker) return true;
  if (sectionCount >= 4 && (leaderCount >= 2 || pageNumberCount >= 6)) return true;
  if (chapterCount >= 2 && sectionCount >= 2 && pageNumberCount >= 4) return true;
  return false;
}

function cleanLikelyTableOfContentsText(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (!looksLikeTableOfContentsText(source)) return source;

  let text = source
    .replace(/([IVX]{1,4}\s*)?Б[ҮУ]?ЛЭГ/giu, "\n$&")
    .replace(/(?:^|\s)(\d+\.\d+(?:\.\d+)?)/g, "\n$1")
    .replace(/\b(Бүлгийн\s+нэмэлт\s+даалгавар)\b/giu, "\n$1")
    .replace(/[ \t]{2,}/g, " ");

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const cleanedLines = [];
  for (let line of lines) {
    line = line
      .replace(/([.·•\-_=~]{3,})\s*([^\d]{5,}?)\s*([+\-]?\d{1,3})(?=\s|$)/gu, "$1 $3")
      .replace(/\+\s*(\d{1,3})(?=\s|$)/g, "$1")
      .replace(/[.·•\-_=~]{3,}\s*(\d{1,3})(?=\s|$)/g, " ... $1")
      .replace(/\s+/g, " ")
      .trim();

    if (!line) continue;

    const tokens = line.split(/\s+/).filter(Boolean);
    const filteredTokens = tokens.filter((token) => {
      if (/^[+\-]?\d{1,3}$/.test(token)) return true;
      if (/^(?:[IVX]{1,4}|[A-ZА-ЯЁӨҮҢӘ])$/u.test(token)) return true;
      if (/^[A-Za-z]{3,}$/u.test(token)) {
        const keepLatin = new Set(["sin", "cos", "tan", "log", "ln", "sqrt"]);
        if (!keepLatin.has(String(token || "").toLowerCase())) return false;
      }
      if (isLikelyOcrNoiseToken(token)) return false;
      if (/^[\p{L}]{8,}$/u.test(token)) {
        const letters = token.toLowerCase();
        const uniq = uniqueCharCount(letters);
        const hasDoubleRun = /(.)\1{1,}/u.test(letters);
        const hasTripleRun = /(.)\1{2,}/u.test(letters);
        if (uniq <= 4) return false;
        if (hasTripleRun && uniq <= 8) return false;
        if (hasDoubleRun && uniq <= 6) return false;
      }
      return true;
    });

    const cleaned = filteredTokens.join(" ").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    if (cleaned.length < 3) continue;
    if (!/[\p{L}\p{N}]/u.test(cleaned)) continue;
    cleanedLines.push(cleaned);
  }

  if (cleanedLines.length < 3) {
    return source;
  }

  return cleanedLines.join("\n");
}

function sanitizeHumanText(value) {
  const normalized = normalizeDisplayText(value)
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(
    /[^\p{L}\p{N}\s.,;:!?()[\]{}\-+*/=<>%'"`~@#$^&_\\|°√π∞≤≥≈×÷±∫∑∏]/gu,
    " ",
    );
  const cleanedNoise = removeOcrNoiseTokens(normalized);
  const tocNormalized = normalizeTocLeaders(cleanedNoise);
  const tocCleaned = cleanLikelyTableOfContentsText(tocNormalized);
  if (looksLikeTableOfContentsText(tocCleaned)) {
    return String(tocCleaned || "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }
  return String(tocCleaned || "").replace(/\s+/g, " ").trim();
}

function noiseTokenRatio(value) {
  const tokens = normalizeText(value).split(/\s+/).filter(Boolean);
  if (!tokens.length) return 1;
  const noisy = tokens.filter((token) => isLikelyOcrNoiseToken(token)).length;
  return noisy / tokens.length;
}

function createAppError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function chooseOcrLanguage() {
  const configured = String(process.env.LOCAL_OCR_LANG || "auto").trim().toLowerCase();
  if (configured && configured !== "auto") {
    return configured;
  }

  try {
    const listed = await execFileAsync("tesseract", ["--list-langs"], { timeout: 12000 });
    const rawLines = String(listed.stdout || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const langs = new Set(
      rawLines.filter((line) => !/^list of available languages/i.test(line)),
    );

    const hasMon = langs.has("mon");
    const hasEng = langs.has("eng");

    if (hasMon && hasEng) return "mon+eng";
    if (hasMon) return "mon";
    if (hasEng) return "eng";
  } catch {
    // ignore and use fallback
  }

  return "eng";
}

function buildPsmCandidates(defaultPsm) {
  const configured = String(defaultPsm || "6").trim() || "6";
  return Array.from(new Set([configured, "4", "11", "3"]));
}

async function runTesseractBestEffort({
  imagePath,
  lang,
  pageTimeoutMs,
  psm,
}) {
  const candidates = buildPsmCandidates(psm);
  const perAttemptTimeout = Math.max(12000, Math.trunc(pageTimeoutMs / Math.max(1, candidates.length)));
  let bestText = "";
  let bestScore = -1;

  for (const candidatePsm of candidates) {
    try {
      const result = await execFileAsync(
        "tesseract",
        [imagePath, "stdout", "-l", lang, "--psm", candidatePsm],
        { timeout: perAttemptTimeout },
      );
      const displayText = normalizeDisplayText(result.stdout);
      const text = sanitizeHumanText(displayText);
      if (!text || isLikelyPdfMetadataNoise(text)) continue;

      const score = Math.max(0, readabilityScore(text) - noiseTokenRatio(text) * 0.8);
      if (score > bestScore) {
        bestScore = score;
        bestText = displayText;
      }

      if (score >= 0.62 && text.length >= 80) {
        break;
      }
    } catch {
      // try next psm
    }
  }

  return bestText;
}

function cleanJsonBlock(value) {
  const text = String(value || "").trim();
  if (!text.startsWith("```")) return text;
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseJsonArray(value) {
  const cleaned = cleanJsonBlock(value);
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.pages)) return parsed.pages;
  } catch {
    // Try substring strategy below.
  }

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return [];

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readabilityScore(value) {
  const text = normalizeText(value);
  if (!text) return 0;

  const total = text.length;
  const letters = (text.match(/[\p{L}\p{N}]/gu) || []).length;
  const spaces = (text.match(/\s/g) || []).length;
  const noisy = (text.match(/[^\p{L}\p{N}\s.,;:!?()[\]{}\-+*/=<>%'"`~@#$^&_\\|]/gu) || []).length;

  const letterRatio = letters / total;
  const spaceRatio = spaces / total;
  const noiseRatio = noisy / total;
  const junk = junkRatio(text);

  return Math.max(
    0,
    Math.min(
      1,
      letterRatio * 0.7 + Math.min(spaceRatio, 0.2) * 1.2 - noiseRatio * 0.8 - junk * 0.9,
    ),
  );
}

function junkRatio(value) {
  const text = normalizeText(value);
  if (!text) return 1;

  const total = text.length;
  const latin1 = (text.match(/[\u0080-\u00FF]/g) || []).length;
  const replacement = (text.match(/�/g) || []).length;
  const controls = (text.match(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g) || []).length;

  return (latin1 + replacement * 2 + controls * 2) / total;
}

function isReadableEnough(value, minScore = 0.38, maxJunk = 0.12) {
  return readabilityScore(value) >= minScore && junkRatio(value) <= maxJunk;
}

function isLikelyPdfMetadataNoise(value) {
  const text = sanitizeHumanText(value);
  if (!text) return true;

  const lower = text.toLowerCase();
  const markers = [
    "quartz pdfcontext",
    "macos version",
    "build ",
    "d:",
    "producer",
    "creator",
  ];
  const markerHits = markers.filter((marker) => lower.includes(marker)).length;
  return markerHits >= 2 && text.length < 500;
}

function hasMeaningfulPageContent(pages) {
  if (!Array.isArray(pages) || !pages.length) return false;
  const meaningful = pages.filter((page) => {
    const text = sanitizeHumanText(page?.text);
    if (text.length < 40) return false;
    if (isLikelyPdfMetadataNoise(text)) return false;
    const words = text.split(/\s+/).filter(Boolean);
    return words.length >= 8;
  });
  return meaningful.length > 0;
}

function decodePdfEscapes(value) {
  return String(value || "")
    .replace(/\\([nrtbf()\\])/g, (_m, ch) => {
      if (ch === "n") return "\n";
      if (ch === "r") return "\r";
      if (ch === "t") return "\t";
      if (ch === "b") return "\b";
      if (ch === "f") return "\f";
      return ch;
    })
    .replace(/\\([0-7]{1,3})/g, (_m, octal) => {
      const code = Number.parseInt(octal, 8);
      if (!Number.isFinite(code)) return " ";
      return String.fromCharCode(code);
    });
}

function buildPageLikeChunks(text) {
  const cleaned = normalizeDisplayText(text);
  if (!cleaned) return [];

  const pageChunkSize = Math.max(800, Number(process.env.RAW_PDF_CHUNK_CHARS || 3500));
  const pages = [];
  for (let i = 0; i < cleaned.length; i += pageChunkSize) {
    const chunk = cleaned.slice(i, i + pageChunkSize).trim();
    if (!chunk) continue;
    pages.push({
      pageNumber: pages.length + 1,
      text: chunk,
    });
  }

  return pages;
}

function normalizePageObjects(items) {
  if (!Array.isArray(items)) return [];

  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const text = normalizeDisplayText(item?.text);
    if (!text) continue;
    const parsedNumber = Number(item?.pageNumber);
    out.push({
      pageNumber: Number.isFinite(parsedNumber) && parsedNumber > 0 ? Math.trunc(parsedNumber) : out.length + 1,
      text,
    });
  }

  return out;
}

function extractGeminiTextResponse(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  if (!candidates.length) return "";

  const first = candidates[0];
  const parts = Array.isArray(first?.content?.parts) ? first.content.parts : [];
  const joined = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();

  return joined;
}

function compactErrorMessage(message, max = 240) {
  const firstLine = String(message || "")
    .replace(/https?:\/\/\S+/g, "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "Тодорхойгүй алдаа";
  const cleaned = firstLine.replace(/\s+/g, " ").trim();

  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 3)}...`;
}

function mapGeminiOcrReason(message) {
  const raw = String(message || "");
  const lower = raw.toLowerCase();

  if (lower.includes("quota") || lower.includes("rate limit")) {
    return "Gemini OCR quota хүрэлцэхгүй байна. Billing/usage limit-ээ шалгана уу.";
  }
  if (lower.includes("api key") || lower.includes("permission denied")) {
    return "Gemini OCR API key буруу эсвэл зөвшөөрөл хүрэлцэхгүй байна.";
  }
  if (
    lower.includes("payload") ||
    lower.includes("request too large") ||
    lower.includes("content length") ||
    lower.includes("size limit")
  ) {
    return "PDF файл хэт том хэвээр байна. `GEMINI_OCR_USE_FILE_API=1` эсэхээ шалгаад дахин оролдоно уу.";
  }

  return compactErrorMessage(raw);
}

function normalizeGeminiAxiosError(error, fallbackMessage) {
  if (!axios.isAxiosError(error)) {
    return fallbackMessage;
  }

  if (error.code === "ECONNABORTED") {
    return "Gemini OCR timeout болсон.";
  }

  if (error.response && typeof error.response.data === "object") {
    const message =
      typeof error.response.data?.error?.message === "string"
        ? error.response.data.error.message
        : fallbackMessage;
    return `Gemini OCR алдаа: ${mapGeminiOcrReason(message)}`;
  }

  return fallbackMessage;
}

function isGeminiTimeoutError(error) {
  if (!axios.isAxiosError(error)) return false;
  if (error.code === "ECONNABORTED") return true;
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("timeout") || msg.includes("deadline");
}

async function requestGeminiGenerateContent({
  apiKey,
  baseUrl,
  model,
  maxOutputTokens,
  parts,
  timeoutMs,
}) {
  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await axios.post(
    `${url}?key=${encodeURIComponent(apiKey)}`,
    {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        ...(Number.isFinite(maxOutputTokens) ? { maxOutputTokens } : {}),
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: timeoutMs,
    },
  );

  return extractGeminiTextResponse(response?.data);
}

async function tryGeminiOcrPrompts({
  apiKey,
  baseUrl,
  fastModePrompt,
  inputPart,
  model,
  normalPrompt,
  timeoutMs,
}) {
  const retryCount = Math.max(1, Number(process.env.PDF_OCR_RETRY_COUNT || 2));
  const attempts = [
    { maxOutputTokens: 12288, name: "full", prompt: normalPrompt, timeoutFactor: 1.0 },
    { maxOutputTokens: 6144, name: "fast", prompt: fastModePrompt, timeoutFactor: 0.7 },
  ];

  let lastError = null;
  for (const mode of attempts) {
    for (let attempt = 1; attempt <= retryCount; attempt += 1) {
      try {
        const raw = await requestGeminiGenerateContent({
          apiKey,
          baseUrl,
          model,
          maxOutputTokens: mode.maxOutputTokens,
          parts: [{ text: mode.prompt }, inputPart],
          timeoutMs: Math.max(30000, Math.trunc(timeoutMs * mode.timeoutFactor * attempt)),
        });
        const parsedPages = normalizePageObjects(parseJsonArray(raw));
        if (parsedPages.length > 0) {
          return {
            mode: mode.name,
            pages: parsedPages,
          };
        }
      } catch (error) {
        lastError = error;
        if (!isGeminiTimeoutError(error)) {
          break;
        }
      }
    }
  }

  throw lastError || createAppError("Gemini OCR-аас текст авч чадсангүй.", 502);
}

async function uploadPdfToGeminiFiles({
  apiKey,
  baseUrl,
  buffer,
  timeoutMs,
}) {
  const startUrl = `${baseUrl}/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`;
  const startResponse = await axios.post(
    startUrl,
    {
      file: {
        displayName: `ocr-${Date.now()}.pdf`,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(buffer.length),
        "X-Goog-Upload-Header-Content-Type": "application/pdf",
      },
      timeout: timeoutMs,
    },
  );

  const uploadUrl = startResponse.headers?.["x-goog-upload-url"];
  if (!uploadUrl) {
    throw createAppError("Gemini file upload URL олдсонгүй.", 502);
  }

  const finalizeResponse = await axios.post(uploadUrl, buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    timeout: timeoutMs,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const fileObj =
    (finalizeResponse?.data && finalizeResponse.data.file)
    || finalizeResponse?.data
    || {};
  const fileUri = String(fileObj?.uri || "").trim();
  const fileName = String(fileObj?.name || "").trim();

  if (!fileUri || !fileName) {
    throw createAppError("Gemini file upload амжилтгүй боллоо.", 502);
  }

  return {
    fileName,
    fileUri,
  };
}

async function tryDeleteGeminiFile({ apiKey, baseUrl, fileName, timeoutMs }) {
  const cleanName = String(fileName || "").replace(/^\/+/, "").trim();
  if (!cleanName) return;

  try {
    await axios.delete(
      `${baseUrl}/v1beta/${cleanName}?key=${encodeURIComponent(apiKey)}`,
      { timeout: timeoutMs },
    );
  } catch {
    // Best-effort cleanup only.
  }
}

function parsePdfInfoPageCount(stdout) {
  const match = String(stdout || "").match(/Pages:\s*(\d+)/i);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function localOcrErrorReason(error) {
  const text = `${String(error?.message || "")}\n${String(error?.stderr || "")}\n${String(error?.stdout || "")}`
    .toLowerCase();

  if (text.includes("enoent") || text.includes("not found")) {
    return "Local OCR хэрэгсэл дутуу байна (`pdftoppm` эсвэл `tesseract`).";
  }
  if (text.includes("incorrect password") || text.includes("encrypted")) {
    return "PDF нууц үгтэй тул Local OCR уншиж чадсангүй.";
  }
  if (
    text.includes("syntax error")
    || text.includes("invalid pdf")
    || text.includes("xref")
    || text.includes("unable to find trailer")
    || text.includes("damaged file")
    || text.includes("can't find startxref")
  ) {
    return "PDF бүтэц эвдэрсэн тул Local OCR уншиж чадсангүй.";
  }
  if (text.includes("timed out") || text.includes("timeout")) {
    return "Local OCR timeout болсон.";
  }

  return `Local OCR ажиллах үед алдаа гарлаа: ${compactErrorMessage(String(error?.message || "Тодорхойгүй алдаа"))}`;
}

async function renderPdfPageToPng({
  convertTimeoutMs,
  dpi,
  imageBasePath,
  pageNumber,
  pdfPath,
}) {
  const imagePath = `${imageBasePath}.png`;
  try {
    await execFileAsync(
      "pdftoppm",
      [
        "-f",
        String(pageNumber),
        "-l",
        String(pageNumber),
        "-singlefile",
        "-r",
        String(dpi),
        "-png",
        pdfPath,
        imageBasePath,
      ],
      { timeout: convertTimeoutMs },
    );
    return;
  } catch (error1) {
    try {
      await execFileAsync(
        "pdftocairo",
        [
          "-f",
          String(pageNumber),
          "-l",
          String(pageNumber),
          "-singlefile",
          "-r",
          String(dpi),
        "-png",
        pdfPath,
        imageBasePath,
      ],
        { timeout: convertTimeoutMs },
      );
      return;
    } catch (error2) {
      try {
        await execFileAsync(
          "mutool",
          [
            "draw",
            "-q",
            "-F",
            "png",
            "-r",
            String(dpi),
            "-o",
            imagePath,
            pdfPath,
            String(pageNumber),
          ],
          { timeout: convertTimeoutMs },
        );
        return;
      } catch (error3) {
        error3.previous = error2;
        error2.previous = error1;
        throw error3;
      }
    }
  }
}

async function renderPdfPageImageBuffer({
  pdfPath,
  pageNumber,
  dpi = 170,
}) {
  const safePageNumber = Math.max(1, Math.trunc(Number(pageNumber) || 1));
  const safeDpi = Math.min(260, Math.max(100, Math.trunc(Number(dpi) || 170)));
  const convertTimeoutMs = Math.max(15000, Number(process.env.LOCAL_OCR_CONVERT_TIMEOUT_MS || 90000));

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-preview-"));
  const imageBasePath = path.join(tempDir, "page");
  const imagePath = `${imageBasePath}.png`;

  try {
    await renderPdfPageToPng({
      convertTimeoutMs,
      dpi: safeDpi,
      imageBasePath,
      pageNumber: safePageNumber,
      pdfPath,
    });
    const buffer = await fs.readFile(imagePath);
    if (!buffer || !buffer.length) {
      throw createAppError("PDF хуудасны зураг үүссэнгүй.", 500);
    }
    return buffer;
  } catch (error) {
    const reason = localOcrErrorReason(error);
    throw createAppError(reason || "PDF хуудасны зураг үүсгэж чадсангүй.", 500);
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

async function tryRepairPdf({ inputPdfPath, repairedPdfPath }) {
  const repairTimeoutMs = Math.max(15000, Number(process.env.LOCAL_OCR_REPAIR_TIMEOUT_MS || 120000));
  try {
    await execFileAsync(
      "qpdf",
      ["--warning-exit-0", "--no-warn", inputPdfPath, repairedPdfPath],
      { timeout: repairTimeoutMs },
    );
    await fs.stat(repairedPdfPath);
    return { ok: true, reason: "" };
  } catch (error) {
    const msg = `${String(error?.message || "")}\n${String(error?.stderr || "")}`.toLowerCase();
    if (msg.includes("enoent") || msg.includes("not found")) {
      return { ok: false, reason: "" };
    }
    return { ok: false, reason: `PDF repair алдаа: ${localOcrErrorReason(error)}` };
  }
}

async function extractViaLocalOcr(buffer) {
  if (String(process.env.LOCAL_OCR_ENABLED || "1").trim() === "0") {
    return {
      errorReason: "LOCAL_OCR_ENABLED=0 тул local OCR алгаслаа.",
      pages: [],
    };
  }

  const dpi = Math.max(120, Number(process.env.LOCAL_OCR_DPI || 220));
  const lang = await chooseOcrLanguage();
  const psm = String(process.env.LOCAL_OCR_PSM || "6").trim() || "6";
  const timeoutMs = Math.max(60000, Number(process.env.LOCAL_OCR_TIMEOUT_MS || 900000));
  const convertTimeoutMs = Math.max(15000, Number(process.env.LOCAL_OCR_CONVERT_TIMEOUT_MS || 90000));
  const pageTimeoutMs = Math.max(30000, Number(process.env.LOCAL_OCR_PAGE_TIMEOUT_MS || 120000));
  const maxPages = Math.max(0, Number(process.env.LOCAL_OCR_MAX_PAGES || 0));
  const failFastNoSuccessPages = Math.max(20, Number(process.env.LOCAL_OCR_FAIL_FAST_PAGES || 80));

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-ocr-"));
  const inputPdfPath = path.join(tempDir, "input.pdf");
  const repairedPdfPath = path.join(tempDir, "repaired.pdf");
  const imageBasePath = path.join(tempDir, "page");

  try {
    await fs.writeFile(inputPdfPath, buffer);

    let pageCount = 0;
    try {
      const info = await execFileAsync("pdfinfo", [inputPdfPath], { timeout: 20000 });
      pageCount = parsePdfInfoPageCount(info.stdout);
    } catch {
      // continue without page count
    }

    const endPage = maxPages > 0
      ? Math.max(1, maxPages)
      : pageCount > 0
        ? pageCount
        : 300;

    const startedAt = Date.now();
    const candidates = [{ label: "original", path: inputPdfPath }];
    let repairReason = "";
    const repair = await tryRepairPdf({ inputPdfPath, repairedPdfPath });
    if (repair.ok) {
      candidates.unshift({ label: "repaired", path: repairedPdfPath });
    } else if (repair.reason) {
      repairReason = repair.reason;
    }

    let lastError = null;
    for (const candidate of candidates) {
      const pages = [];

      for (let pageNumber = 1; pageNumber <= endPage; pageNumber += 1) {
        const imagePath = `${imageBasePath}.png`;

        try {
          await renderPdfPageToPng({
            convertTimeoutMs,
            dpi,
            imageBasePath,
            pageNumber,
            pdfPath: candidate.path,
          });

          const text = await runTesseractBestEffort({
            imagePath,
            lang,
            pageTimeoutMs,
            psm,
          });
          if (!text || isLikelyPdfMetadataNoise(text)) {
            continue;
          }

          pages.push({
            pageNumber,
            text,
          });
        } catch (error) {
          lastError = error;
        } finally {
          await fs.rm(imagePath, { force: true });
        }

        if (Date.now() - startedAt > timeoutMs) {
          break;
        }

        if (pages.length === 0 && pageNumber >= failFastNoSuccessPages) {
          break;
        }
      }

      if (pages.length > 0) {
        return {
          errorReason: candidate.label === "repaired"
            ? "PDF эвдэрсэн бүтэцтэй байсан тул repair хийж Local OCR ашиглалаа."
            : "",
          pages,
        };
      }
    }

    if (lastError) {
      const reasons = [localOcrErrorReason(lastError), repairReason].filter(Boolean);
      return {
        errorReason: reasons.join(" ; "),
        pages: [],
      };
    }

    return {
      errorReason: repairReason || "Local OCR-оор уншигдах текст олдсонгүй.",
      pages: [],
    };
  } catch (error) {
    return {
      errorReason: localOcrErrorReason(error),
      pages: [],
    };
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

function carveJpegImagesFromBuffer(buffer, { minBytes, maxImages }) {
  const images = [];
  const startSig = Buffer.from([0xff, 0xd8]);
  const endSig = Buffer.from([0xff, 0xd9]);

  let cursor = 0;
  while (cursor < buffer.length - 2 && images.length < maxImages) {
    const start = buffer.indexOf(startSig, cursor);
    if (start < 0) break;

    const end = buffer.indexOf(endSig, start + 2);
    if (end < 0) break;

    const chunk = buffer.slice(start, end + 2);
    if (chunk.length >= minBytes) {
      images.push(chunk);
    }

    cursor = end + 2;
  }

  return images;
}

async function extractViaCarvedJpegOcr(buffer) {
  if (String(process.env.LOCAL_OCR_JPEG_CARVE_ENABLED || "1").trim() === "0") {
    return {
      errorReason: "LOCAL_OCR_JPEG_CARVE_ENABLED=0 тул JPEG carve OCR алгаслаа.",
      pages: [],
    };
  }

  const minBytes = Math.max(2000, Number(process.env.LOCAL_OCR_JPEG_MIN_BYTES || 20000));
  const maxImages = Math.max(1, Number(process.env.LOCAL_OCR_JPEG_MAX_IMAGES || 120));
  const pageTimeoutMs = Math.max(30000, Number(process.env.LOCAL_OCR_PAGE_TIMEOUT_MS || 120000));
  const lang = await chooseOcrLanguage();
  const psm = String(process.env.LOCAL_OCR_PSM || "6").trim() || "6";

  const images = carveJpegImagesFromBuffer(buffer, { maxImages, minBytes });
  if (!images.length) {
    return {
      errorReason: "Эвдэрсэн PDF дотроос OCR хийх JPEG зураг олдсонгүй.",
      pages: [],
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-jpeg-ocr-"));
  try {
    const pages = [];
    for (let i = 0; i < images.length; i += 1) {
      const imagePath = path.join(tempDir, `img-${i + 1}.jpg`);
      try {
        await fs.writeFile(imagePath, images[i]);
        const text = await runTesseractBestEffort({
          imagePath,
          lang,
          pageTimeoutMs,
          psm,
        });
        if (!text || isLikelyPdfMetadataNoise(text)) continue;

        pages.push({
          pageNumber: i + 1,
          text,
        });
      } catch {
        // Skip bad carved image and continue.
      } finally {
        await fs.rm(imagePath, { force: true });
      }
    }

    if (!pages.length) {
      return {
        errorReason: "JPEG carve OCR-аас уншигдах текст олдсонгүй.",
        pages: [],
      };
    }

    return {
      errorReason: "",
      pages,
    };
  } catch {
    return {
      errorReason: "JPEG carve OCR ажиллах үед алдаа гарлаа.",
      pages: [],
    };
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

async function extractViaGeminiOcr(buffer) {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return {
      errorReason: "GEMINI_API_KEY байхгүй тул OCR fallback алгаслаа.",
      pages: [],
    };
  }

  const inlineMaxBytes = Math.max(
    1024 * 1024,
    Number(process.env.MAX_GEMINI_OCR_BYTES || 10 * 1024 * 1024),
  );
  const useFileApi = String(process.env.GEMINI_OCR_USE_FILE_API || "1").trim() !== "0";

  const baseUrl = String(process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com")
    .replace(/\/+$/, "");
  const model = String(process.env.GEMINI_OCR_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
  const timeoutMs = Math.max(30000, Number(process.env.PDF_OCR_TIMEOUT_MS || 180000));

  const prompt = `
Extract all readable text from this PDF.
Return JSON only.
Format:
[
  {"pageNumber": 1, "text": "..."}
]
Rules:
- Keep page order.
- No markdown, no explanation.
- If a page has no readable text, skip it.
- Preserve math and formulas as faithfully as possible.
  - If you can, wrap formulas in LaTeX using $...$ (inline) or $$...$$ (block).
  - Use standard LaTeX commands when appropriate (\\frac, \\sqrt, \\sin, \\cos, \\tan, \\log, \\pi, ^ for powers).
  - Do NOT solve/simplify; transcribe only.
  - If unsure, keep the original characters rather than inventing.
`.trim();
  const fastPrompt = `
Extract readable text quickly from this PDF.
Return JSON only:
[
  {"pageNumber": 1, "text": "..."}
]
Rules:
- Keep page order.
- Each page text max 500 chars.
- Prefer speed: skip hard-to-read pages.
- Preserve formulas if easy (you may use $...$ LaTeX).
- No markdown, no explanation.
`.trim();

  let uploadedFileName = "";
  try {
    let raw = "";

    if (buffer.length <= inlineMaxBytes) {
      const result = await tryGeminiOcrPrompts({
        apiKey,
        baseUrl,
        fastModePrompt: fastPrompt,
        inputPart: {
          inlineData: {
            mimeType: "application/pdf",
            data: buffer.toString("base64"),
          },
        },
        model,
        normalPrompt: prompt,
        timeoutMs,
      });
      raw = JSON.stringify(result.pages);
    } else if (useFileApi) {
      const uploaded = await uploadPdfToGeminiFiles({
        apiKey,
        baseUrl,
        buffer,
        timeoutMs,
      });
      uploadedFileName = uploaded.fileName;

      const result = await tryGeminiOcrPrompts({
        apiKey,
        baseUrl,
        fastModePrompt: fastPrompt,
        inputPart: {
          fileData: {
            mimeType: "application/pdf",
            fileUri: uploaded.fileUri,
          },
        },
        model,
        normalPrompt: prompt,
        timeoutMs,
      });
      raw = JSON.stringify(result.pages);
    } else {
      return {
        errorReason: `PDF файл хэт том байна (${Math.ceil(buffer.length / (1024 * 1024))}MB). Gemini file API-г асаана уу (GEMINI_OCR_USE_FILE_API=1).`,
        pages: [],
      };
    }

    const parsedPages = normalizePageObjects(parseJsonArray(raw));
    return {
      errorReason: "",
      pages: parsedPages,
    };
  } catch (error) {
    return {
      errorReason: normalizeGeminiAxiosError(error, "Gemini OCR ажиллах үед алдаа гарлаа."),
      pages: [],
    };
  } finally {
    if (uploadedFileName) {
      await tryDeleteGeminiFile({
        apiKey,
        baseUrl,
        fileName: uploadedFileName,
        timeoutMs,
      });
    }
  }
}

function extractRawTextFallback(buffer) {
  const maxRawBytes = Math.max(
    1024 * 1024,
    Number(process.env.MAX_RAW_FALLBACK_BYTES || 20 * 1024 * 1024),
  );
  const rawSlice = buffer.slice(0, Math.min(buffer.length, maxRawBytes));
  const raw = rawSlice.toString("latin1");

  const texts = [];
  const re = /\((?:\\.|[^\\()]){8,}\)/g;
  let match = re.exec(raw);
  while (match) {
    const token = match[0].slice(1, -1);
    const decoded = normalizeText(decodePdfEscapes(token));
    if (decoded.length >= 12 && isReadableEnough(decoded, 0.48, 0.08)) {
      texts.push(decoded);
    }
    match = re.exec(raw);
  }

  const combined = normalizeText(texts.join(" "));
  return buildPageLikeChunks(combined);
}

async function parseWithVersion(buffer, version) {
  const pageTexts = [];

  await pdf(buffer, {
    max: 0,
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent({
        disableCombineTextItems: false,
        normalizeWhitespace: true,
      });
      const rawText = normalizeDisplayText(textContent.items.map((item) => item.str || "").join(" "));
      const text = normalizeDisplayText(rawText);
      pageTexts.push({
        rawText,
        text,
      });
      return text;
    },
    version,
  });

  return pageTexts.map((page, idx) => ({
    pageNumber: idx + 1,
    rawText: page.rawText,
    text: page.text,
  }));
}

function evaluatePages(pages) {
  const analyzed = (Array.isArray(pages) ? pages : []).map((item) => ({
    text: sanitizeHumanText(item?.text || ""),
    rawText: normalizeDisplayText(item?.rawText || item?.text || ""),
  }));
  const merged = analyzed.map((item) => item.text || "").join(" ");
  const rawMerged = analyzed.map((item) => item.rawText || "").join(" ");
  const compactLen = merged.replace(/\s+/g, "").length;
  const readableCount = analyzed.filter((item) => isReadableEnough(item.text, 0.4, 0.12)).length;
  const nonEmptyCount = analyzed.filter((item) => normalizeText(item.text).length > 0).length;
  return {
    compactLen,
    junk: junkRatio(merged),
    ocrNoise: noiseTokenRatio(rawMerged),
    nonEmptyCount,
    readableCount,
    score: readabilityScore(merged),
  };
}

async function parsePdfPages(buffer, options = {}) {
  const versions = ["default", "v2.0.550", "v1.10.100", "v1.10.88", "v1.9.426"];
  let bestPages = [];
  let bestScore = -1;
  let bestNonEmpty = 0;
  const preferredFromOptions = String(options?.preferred || "").trim().toLowerCase();
  const preferredFromEnv = String(process.env.PDF_OCR_PREFERRED || "auto").trim().toLowerCase();
  const preferred = preferredFromOptions || preferredFromEnv || "auto";
  const strictOcrMode =
    Boolean(options?.forceOcr)
    || String(process.env.PDF_OCR_STRICT_MODE || "1").trim() === "1";
  const allowEarlyParserReturn = !strictOcrMode;

  for (const version of versions) {
    try {
      const pages = await parseWithVersion(buffer, version);
      const normalizedPages = pages.map((item, idx) => ({
        pageNumber: idx + 1,
        rawText: normalizeDisplayText(item.rawText || item.text),
        text: normalizeDisplayText(item.text || item.rawText),
      }));
      const { ocrNoise, score, junk, readableCount, nonEmptyCount } = evaluatePages(normalizedPages);

      const betterCoverage =
        normalizedPages.length > bestPages.length ||
        (normalizedPages.length === bestPages.length && nonEmptyCount > bestNonEmpty) ||
        (normalizedPages.length === bestPages.length && nonEmptyCount === bestNonEmpty && score > bestScore);

      if (normalizedPages.length > 0 && betterCoverage) {
        bestPages = normalizedPages;
        bestScore = score;
        bestNonEmpty = nonEmptyCount;
      }

      if (
        allowEarlyParserReturn &&
        normalizedPages.length > 0 &&
        nonEmptyCount > 0 &&
        readableCount > 0 &&
        score >= 0.42 &&
        junk <= 0.12 &&
        ocrNoise <= 0.22 &&
        hasMeaningfulPageContent(normalizedPages)
      ) {
        return normalizedPages;
      }
    } catch {
      // Try next parser version.
    }
  }

  // Keep parser output if we have any non-empty pages after sanitization.
  const bestQuality = evaluatePages(bestPages);
  if (
    allowEarlyParserReturn &&
    bestPages.length > 0 &&
    bestNonEmpty > 0 &&
    bestQuality.compactLen >= 200 &&
    bestQuality.score >= 0.2 &&
    hasMeaningfulPageContent(bestPages)
  ) {
    return bestPages;
  }

  const fallbackPages = extractRawTextFallback(buffer);
  const fallbackQuality = evaluatePages(fallbackPages);
  if (
    allowEarlyParserReturn &&
    fallbackPages.length > 0 &&
    fallbackQuality.compactLen > 0 &&
    fallbackQuality.score >= 0.55 &&
    fallbackQuality.junk <= 0.06 &&
    fallbackQuality.ocrNoise <= 0.2 &&
    hasMeaningfulPageContent(fallbackPages)
  ) {
    return fallbackPages;
  }

  const hasGeminiKey = Boolean(String(process.env.GEMINI_API_KEY || "").trim());
  const preferGemini =
    preferred === "gemini" ||
    preferred === "gemini-only" ||
    (preferred === "auto" && hasGeminiKey);
  const localOnly = preferred === "local-only";
  const geminiOnly = preferred === "gemini-only";

  let localOcr = { errorReason: "", pages: [] };
  let carvedOcr = { errorReason: "", pages: [] };
  let ocr = { errorReason: "", pages: [] };
  let triedGemini = false;

  const tryLocal = async () => {
    localOcr = await extractViaLocalOcr(buffer);
    const quality = evaluatePages(localOcr.pages);
    if (localOcr.pages.length > 0 && quality.compactLen > 0) {
      return localOcr.pages;
    }
    return [];
  };

  const tryCarved = async () => {
    carvedOcr = await extractViaCarvedJpegOcr(buffer);
    const quality = evaluatePages(carvedOcr.pages);
    if (carvedOcr.pages.length > 0 && quality.compactLen > 0) {
      return carvedOcr.pages;
    }
    return [];
  };

  const tryGemini = async () => {
    triedGemini = true;
    ocr = await extractViaGeminiOcr(buffer);
    const quality = evaluatePages(ocr.pages);
    if (ocr.pages.length > 0 && quality.compactLen > 0) {
      return ocr.pages;
    }
    return [];
  };

  // Preference order:
  // - auto: try Gemini first if key exists, then local OCR, then carved OCR.
  // - local-only: local -> carved (skip Gemini).
  // - gemini-only: Gemini only.
  if (geminiOnly) {
    const pages = await tryGemini();
    if (pages.length > 0) return pages;
  } else if (localOnly) {
    const pages = await tryLocal();
    if (pages.length > 0) return pages;
    const carved = await tryCarved();
    if (carved.length > 0) return carved;
  } else if (preferGemini) {
    const pages = await tryGemini();
    if (pages.length > 0) return pages;
    const local = await tryLocal();
    if (local.length > 0) return local;
    const carved = await tryCarved();
    if (carved.length > 0) return carved;
  } else {
    const local = await tryLocal();
    if (local.length > 0) return local;
    const carved = await tryCarved();
    if (carved.length > 0) return carved;
    const pages = await tryGemini();
    if (pages.length > 0) return pages;
  }

  // Hard fallback: if OCR flow failed and Gemini key exists, force one final Gemini attempt.
  if (hasGeminiKey && !triedGemini) {
    const pages = await tryGemini();
    if (pages.length > 0) return pages;
  }

  if (bestPages.length > 0 && bestNonEmpty > 0) {
    return bestPages;
  }
  if (fallbackPages.length > 0 && fallbackQuality.compactLen > 0) {
    return fallbackPages;
  }

  const localCorrupted = /pdf бүтэц эвдэрсэн/i.test(String(localOcr.errorReason || ""));
  const carvedMissingImages = /jpeg зураг олдсонгүй/i.test(String(carvedOcr.errorReason || ""));
  if (localCorrupted && carvedMissingImages) {
    const detailParts = [localOcr.errorReason, carvedOcr.errorReason].filter(Boolean);
    const details = detailParts.length ? ` (${detailParts.join(" ; ")})` : "";
    throw createAppError(
      `PDF-ээс текст уншиж чадсангүй. Файл эвдэрсэн эсвэл дутуу байна${details}`,
      400,
    );
  }

  const detailParts = [localOcr.errorReason, carvedOcr.errorReason, ocr.errorReason].filter(Boolean);
  const details = detailParts.length ? ` (${detailParts.join(" ; ")})` : "";
  throw createAppError(
    `PDF-ээс текст уншиж чадсангүй. Файл скан зурагтай бол OCR хэрэгтэй байна${details}`,
    400,
  );
}

module.exports = {
  parsePdfPages,
  renderPdfPageImageBuffer,
  sanitizeHumanText,
};
