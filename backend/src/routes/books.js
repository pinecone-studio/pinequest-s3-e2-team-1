const express = require("express");
const multer = require("multer");
const { generateBookQuestions } = require("../lib/book-questions");
const { parsePdfPages, renderPdfPageImageBuffer, sanitizeHumanText } = require("../lib/pdf");
const { createBookId, getBookById, listBooks, saveBook, updateBook } = require("../lib/book-store");
const { findExistingBookPdfPath, pdfExists, saveBookPdf } = require("../lib/book-files");
const { buildBookStructure, findSectionById, flattenSections } = require("../lib/book-structure");
const fs = require("node:fs/promises");

const router = express.Router();

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 150);
const SOLVE_QUESTION_TEXT = "Энэ бодлогыг бодоод зөв хариуг сонго.";
const upload = multer({
  limits: {
    fileSize: maxUploadMb * 1024 * 1024,
  },
  storage: multer.memoryStorage(),
});

function uploadSinglePdf(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: `Файл хэт том байна. ${maxUploadMb}MB-с бага PDF оруулна уу эсвэл PDF-ээ 2 хувааж upload хийнэ үү.`,
      });
    }

    return next(error);
  });
}

function parsePageNumber(rawValue, fallback) {
  const num = Number(rawValue);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.trunc(num));
}

function parsePageNumbers(rawValue, maxPageNumber) {
  if (!Array.isArray(rawValue)) return [];

  const maxPage = Number.isFinite(Number(maxPageNumber)) ? Math.trunc(Number(maxPageNumber)) : 0;
  const out = [];
  const seen = new Set();

  for (const item of rawValue) {
    const num = Math.trunc(Number(item));
    if (!Number.isFinite(num) || num < 1) continue;
    if (maxPage > 0 && num > maxPage) continue;
    if (seen.has(num)) continue;
    seen.add(num);
    out.push(num);
  }

  return out.sort((a, b) => a - b);
}

function parseQuestionCount(rawValue, fallback = 10) {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(30, Math.max(10, Math.trunc(n)));
}

function parseWindowSize(rawValue, fallback = 3) {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(3, Math.max(2, Math.trunc(n)));
}

function clampOffset(rawValue) {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function compactTextPreview(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 180)}...`;
}

function cleanDisplayPageText(value) {
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

function cleanAnalysisPageText(value) {
  return sanitizeHumanText(cleanDisplayPageText(value));
}

function providerLabel(provider) {
  if (provider === "gemini") return "Gemini";
  if (provider === "local") return "Local fallback";
  return "Ollama";
}

function toAbsoluteUrl(req, relativePath) {
  const path = String(relativePath || "");
  if (!path.startsWith("/")) return path;
  const host = req.get("host");
  if (!host) return path;
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "http";
  return `${proto}://${host}${path}`;
}

function pageLooksLikeAnswerKey(text) {
  const src = String(text || "");
  if (!src.trim()) return false;
  if (/(хариу(?:\s*түлхүүр)?|answers?|answer\s*key)/i.test(src)) return true;
  const pairRe = /(?:^|\s)\d{1,3}\s*(?:[).:\-–]\s*|\s+)\s*[A-DАБВГ1-4](?=\s|$|[).,;])/giu;
  const pairs = src.match(pairRe) || [];
  return pairs.length >= 10;
}

function buildAnswerKeyText({ book, startPage, endPage, maxPages = 90 }) {
  if (!book || !Array.isArray(book.pages) || book.pages.length === 0) return "";

  const wanted = new Set();
  for (let p = startPage; p <= endPage; p += 1) wanted.add(p);

  const selected = book.pages.filter((p) => wanted.has(p.pageNumber));
  const candidates = [];

  // Include pages that look like answer key across the whole book.
  for (const page of book.pages) {
    if (wanted.has(page.pageNumber)) continue;
    if (pageLooksLikeAnswerKey(cleanAnalysisPageText(page.text))) {
      candidates.push(page);
    }
  }

  // Also include last pages as many books have answers at the end.
  const tailCount = Math.min(40, book.pages.length);
  const tail = book.pages.slice(Math.max(0, book.pages.length - tailCount));
  for (const page of tail) {
    if (wanted.has(page.pageNumber)) continue;
    candidates.push(page);
  }

  // Deduplicate by pageNumber and cap.
  const unique = new Map();
  for (const page of [...selected, ...candidates]) {
    if (!page || !Number.isFinite(Number(page.pageNumber))) continue;
    unique.set(page.pageNumber, page);
    if (unique.size >= maxPages) break;
  }

  return Array.from(unique.values())
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => `[Page ${page.pageNumber}] ${cleanAnalysisPageText(page.text)}`)
    .join("\n\n");
}

function buildAnswerKeyTextFromSelection({ book, pageNumbers, maxPages = 90 }) {
  if (!book || !Array.isArray(book.pages) || book.pages.length === 0) return "";

  const wanted = new Set(
    (Array.isArray(pageNumbers) ? pageNumbers : [])
      .map((value) => Math.trunc(Number(value)))
      .filter((value) => Number.isFinite(value) && value >= 1),
  );

  const selected = book.pages.filter((p) => wanted.has(p.pageNumber));
  const candidates = [];

  // Include pages that look like answer key across the whole book.
  for (const page of book.pages) {
    if (wanted.has(page.pageNumber)) continue;
    if (pageLooksLikeAnswerKey(cleanAnalysisPageText(page.text))) {
      candidates.push(page);
    }
  }

  // Also include last pages as many books have answers at the end.
  const tailCount = Math.min(40, book.pages.length);
  const tail = book.pages.slice(Math.max(0, book.pages.length - tailCount));
  for (const page of tail) {
    if (wanted.has(page.pageNumber)) continue;
    candidates.push(page);
  }

  // Deduplicate by pageNumber and cap.
  const unique = new Map();
  for (const page of [...selected, ...candidates]) {
    if (!page || !Number.isFinite(Number(page.pageNumber))) continue;
    unique.set(page.pageNumber, page);
    if (unique.size >= maxPages) break;
  }

  return Array.from(unique.values())
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => `[Page ${page.pageNumber}] ${cleanAnalysisPageText(page.text)}`)
    .join("\n\n");
}

function stripChoicePrefix(value) {
  return String(value || "")
    .replace(/^(?:[A-D]|[АБВГ]|[1-4])(?:\s*[\).:\-–]|\s+)\s*/iu, "")
    .trim();
}

function withCorrectChoiceText(question) {
  if (!question || typeof question !== "object") return question;
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const letter = String(question.correct_answer || "").trim().toUpperCase();
  if (!/^[A-D]$/.test(letter)) return question;

  const normalizeToken = (token) => {
    const raw = String(token || "").trim().toUpperCase();
    if (!raw) return "";
    if (raw === "1" || raw === "А") return "A";
    if (raw === "2" || raw === "Б") return "B";
    if (raw === "3" || raw === "В") return "C";
    if (raw === "4" || raw === "Г") return "D";
    if (/^[A-D]$/.test(raw)) return raw;
    return "";
  };

  const idx = ["A", "B", "C", "D"].indexOf(letter);
  const byIndex = idx >= 0 ? String(choices[idx] || "").trim() : "";
  const byPrefix = choices.find((choice) => {
    const matched = String(choice || "").trim().match(/^([A-DАБВГ1-4])\s*[\).:\-–]/iu);
    if (!matched) return false;
    return normalizeToken(matched[1]) === letter;
  });

  const raw = String(byPrefix || byIndex || "").trim();
  if (!raw) return question;

  return {
    ...question,
    correct_choice: raw,
    correct_choice_text: stripChoicePrefix(raw),
  };
}

function ensureStructuredContent(book) {
  if (!book || typeof book !== "object") return { chapters: [] };
  const pages = Array.isArray(book.pages)
    ? book.pages.map((page) => ({
      pageNumber: Math.max(1, Math.trunc(Number(page?.pageNumber || 0))),
      text: sanitizeHumanText(page?.text || ""),
    }))
    : [];
  return buildBookStructure(pages);
}

function normalizeDifficulty(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return "medium";
}

function parseNonNegativeInt(rawValue, fallback = 0, max = 200) {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(n)));
}

function normalizeDifficultyCounts(rawValue) {
  const src = rawValue && typeof rawValue === "object" ? rawValue : {};
  const easy = parseNonNegativeInt(src.easy, 0, 80);
  const medium = parseNonNegativeInt(src.medium, 0, 80);
  const hard = parseNonNegativeInt(src.hard, 0, 80);
  return {
    easy,
    medium,
    hard,
    total: easy + medium + hard,
  };
}

function buildDifficultyPlan({ counts, fallbackDifficulty, needed }) {
  const target = Math.max(0, Math.trunc(Number(needed) || 0));
  const items = [];
  const safeCounts = counts && typeof counts === "object" ? counts : { easy: 0, medium: 0, hard: 0 };

  const pushMany = (label, amount) => {
    const count = Math.max(0, Math.trunc(Number(amount) || 0));
    for (let i = 0; i < count && items.length < target; i += 1) {
      items.push(label);
    }
  };

  pushMany("easy", safeCounts.easy);
  pushMany("medium", safeCounts.medium);
  pushMany("hard", safeCounts.hard);

  while (items.length < target) {
    items.push(normalizeDifficulty(fallbackDifficulty));
  }

  return items.slice(0, target);
}

function assignDifficultyToQuestions({ questions, counts, fallbackDifficulty }) {
  const list = Array.isArray(questions) ? questions : [];
  if (!list.length) return [];
  const plan = buildDifficultyPlan({
    counts,
    fallbackDifficulty,
    needed: list.length,
  });
  return list.map((question, idx) => ({
    ...question,
    difficulty: normalizeDifficulty(plan[idx] || fallbackDifficulty),
  }));
}

function buildOpenEndedTasks({ exerciseProblems, openQuestionCount, difficultyCounts, fallbackDifficulty, totalScore }) {
  const needed = parseNonNegativeInt(openQuestionCount, 0, 80);
  if (needed <= 0) return [];

  const items = Array.isArray(exerciseProblems) ? exerciseProblems : [];
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    const text = String(item?.text || "").trim();
    const key = normalizeProblemKey(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= needed) break;
  }

  const plan = buildDifficultyPlan({
    counts: difficultyCounts,
    fallbackDifficulty,
    needed,
  });
  const effectiveTotalScore = parseNonNegativeInt(totalScore, 0, 500);
  const baseScore = needed > 0 ? Math.trunc(effectiveTotalScore / needed) : 0;
  const remainder = needed > 0 ? effectiveTotalScore % needed : 0;

  const tasks = [];
  for (let i = 0; i < needed; i += 1) {
    const source = unique[i];
    const sourceText = String(source?.text || "").trim();
    const prompt = sourceText
      ? `Дараах бодлогыг дэлгэрэнгүй бодоод, аргачлалаа тайлбарлан бич.\n${sourceText}`
      : "Сонгосон сэдвийн хүрээнд ижил төрлийн бодлого зохиож, бодолтын алхмуудаа тайлбарла.";
    tasks.push({
      prompt,
      difficulty: normalizeDifficulty(plan[i] || fallbackDifficulty),
      score: effectiveTotalScore > 0 ? baseScore + (i < remainder ? 1 : 0) : 0,
      sourcePages: Number.isFinite(Number(source?.pageNumber))
        ? [Math.trunc(Number(source.pageNumber))]
        : [],
      sourceExcerpt: sourceText,
    });
  }

  return tasks;
}

function buildTestPromptPrefix(difficulty) {
  const common =
    "Use only EXERCISE_PROBLEMS from the textbook text. " +
    "Never use title page/authors/contents. " +
    "Each item must show one original book problem and 4 choices (1 correct + 3 wrong).";
  if (difficulty === "easy") {
    return `Difficulty preference: easy. ${common}`;
  }
  if (difficulty === "hard") {
    return `Difficulty preference: hard. ${common} Focus on analytical items.`;
  }
  return `Difficulty preference: medium. ${common}`;
}

function normalizeChoiceBody(choice) {
  return String(choice || "")
    .replace(/^(?:[A-D]|[АБВГ]|[1-4])(?:\s*[\).:\-–]|\s+)\s*/iu, "")
    .trim();
}

function looksMathLikeText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/\d/.test(text) && /[=+\-*/<>≤≥≈×÷]/.test(text)) return true;
  if (/\b(sin|cos|tan|log|ln|sqrt)\b/i.test(text)) return true;
  if (/(модул|тэгшитгэл|тэнцэтгэл|функц|интеграл|уламжлал|логарифм)/iu.test(text)) return true;
  return false;
}

function hasEquationLikePattern(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/\|[^|]{1,40}\|/.test(text)) return true;
  if (/[=+\-*/<>≤≥≈×÷]/.test(text) && /\d/.test(text)) return true;
  if (/\b(?:sin|cos|tan|log|ln)\b/i.test(text)) return true;
  if (/[a-zа-я]\)\s*[^)\n]{1,40}/iu.test(text) && /[бвг]\)\s*[^)\n]{1,40}/iu.test(text)) return true;
  return false;
}

function hasTaskMarker(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return /(дасгал|жишээ|бодлого|тэгшитгэл\s*бод|тэнцэтгэл\s*биш\s*бод|шийдийг\s*ол|утгыг\s*ол|тэгшитгэл\s*шийд)/iu.test(text);
}

function looksProblemLikeText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return hasTaskMarker(text) && hasEquationLikePattern(text);
}

function normalizeExerciseLine(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanExerciseProblemText(value) {
  const text = normalizeExerciseLine(value)
    .replace(/\beos\b/giu, "cos")
    .replace(/\bv(?=\d)/giu, "√");
  if (!text) return "";

  const cutMarkers = [
    /\bЖишээ\b/iu,
    /\bБодолт\b/iu,
    /\bДүгнэлт\b/iu,
    /\bТодорхойлолт\b/iu,
    /\bЗураг\b/iu,
    /\bИймд\b/iu,
  ];

  let cutAt = text.length;
  for (const marker of cutMarkers) {
    const matched = marker.exec(text);
    if (!matched || !Number.isFinite(matched.index)) continue;
    cutAt = Math.min(cutAt, matched.index);
  }

  const trimmed = normalizeExerciseLine(text.slice(0, cutAt));
  return trimmed.replace(/[;,:\-–—]+$/g, "").trim();
}

function splitCompoundExerciseLine(value) {
  const text = normalizeExerciseLine(value);
  if (!text) return [];

  const markerMatches = Array.from(
    text.matchAll(/(?:^|\s)(?:\d{1,3}[).]|[\p{L}]\))/gu),
  );
  if (markerMatches.length <= 1) {
    return [text];
  }

  const out = [];
  for (let i = 0; i < markerMatches.length; i += 1) {
    const current = markerMatches[i];
    const next = markerMatches[i + 1];
    const startsWithSpace = /^\s/.test(current[0] || "");
    const start = (current.index || 0) + (startsWithSpace ? 1 : 0);
    const end = next ? (next.index || text.length) : text.length;
    if (end <= start) continue;
    const chunk = normalizeExerciseLine(text.slice(start, end));
    if (!chunk) continue;
    out.push(chunk);
  }

  return out.length ? out : [text];
}

function looksExerciseProblemCandidate(line, { inExerciseBlock = false } = {}) {
  const text = cleanExerciseProblemText(line);
  if (!text || text.length < 4 || text.length > 260) return false;
  if (/^([IVX]+|[A-ZА-Я])\s*БҮЛЭГ/iu.test(text)) return false;
  if (/\.{4,}/.test(text)) return false;
  if (/([а-яөүa-z])\1{6,}/iu.test(text)) return false;
  if (/^\d+\.\d+(?:\.\d+)?\s*[А-Яа-яЁёӨөҮүҢңӘә]/u.test(text)) return false;
  if (
    /(жишээ|бодолт|дүгнэлт|тодорхойлолт|зураг|бүлгийн\s+нэмэлт)/iu.test(text)
    && !/^[\p{L}]\)/u.test(text)
  ) {
    return false;
  }

  const hasLetterLabel = /^[\p{L}]\)\s*/u.test(text);
  const hasNumberLabel = /^\d{1,3}[).]\s*/u.test(text);
  const hasLabel = hasLetterLabel || hasNumberLabel;
  const hasMath = hasEquationLikePattern(text) || looksMathLikeText(text);
  const hasTaskWord = hasTaskMarker(text) || /(бод|утгыг\s*ол|шийд)/iu.test(text);
  const hasStrongMathSignal =
    hasEquationLikePattern(text) || /[|√=+\-*/<>≤≥≈×÷]/.test(text);
  const hasManyWords = (text.match(/[\p{L}]{2,}/gu) || []).length >= 8;
  const hasNarrativeSignal =
    /(хэрэв|иймд|эндээс|нөхцөл|шийд\s+болно|тэнцүү\s+чанартай|болох\s+ба)/iu.test(text);
  if (hasNarrativeSignal && text.length > 42) return false;
  if (hasNumberLabel && hasManyWords && !hasLetterLabel) return false;

  if (!hasMath) return false;
  if (hasLabel && hasStrongMathSignal) return true;
  if (inExerciseBlock && hasStrongMathSignal) return true;
  if (hasTaskWord && hasStrongMathSignal) return true;
  return false;
}

function extractExerciseProblemsFromPages(pages, { limit = 200 } = {}) {
  const items = Array.isArray(pages) ? pages : [];
  const out = [];
  const seen = new Set();
  let inExerciseBlock = false;

  for (const page of items) {
    const rawText = String(page?.content || page?.text || "");
    if (!rawText.trim()) continue;

    const prepared = rawText
      .replace(/\r/g, "\n")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/([A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\)/gu, "\n$1)")
      .replace(/(^|[\s,;:])(\d{1,3}[).])/gu, "$1\n$2")
      .replace(/\n{2,}/g, "\n");

    const lines = prepared
      .split(/\n+/g)
      .map((line) => normalizeExerciseLine(line))
      .filter(Boolean);

    for (const line of lines) {
      if (/(дасгал|даалгавар|бүлгийн\s+нэмэлт\s+даалгавар|exercise)/iu.test(line)) {
        inExerciseBlock = true;
        continue;
      }

      const chunks = splitCompoundExerciseLine(line);
      for (const chunk of chunks) {
        const cleanedChunk = cleanExerciseProblemText(chunk);
        if (!looksExerciseProblemCandidate(cleanedChunk, { inExerciseBlock })) continue;
        const key = cleanedChunk.toLowerCase().replace(/\s+/g, " ").trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({
          pageNumber: page.pageNumber,
          text: cleanedChunk,
        });
        if (out.length >= limit) return out;
      }
    }
  }

  return out;
}

function isLetterLabeledExerciseProblem(value) {
  return /^[\p{L}]\)\s*/u.test(normalizeExerciseLine(value));
}

function isStrictExerciseProblem(value) {
  const text = normalizeExerciseLine(value);
  if (!isLetterLabeledExerciseProblem(text)) return false;
  if (text.length < 4 || text.length > 95) return false;
  if (
    /(хэрэв|иймд|эндээс|нөхцөл|болно|бодолт|жишээ|дүгнэлт|зураг|тодорхойлолт|хэлбэрийн|тэгшитгэлийн|олонлог)/iu.test(
      text,
    )
  ) {
    return false;
  }

  const hasMathSignal =
    /[|=<>≤≥√+\-*/^]/.test(text)
    || /\b(sin|cos|tan|log|ln)\b/i.test(text)
    || /\d/.test(text);
  if (!hasMathSignal) return false;

  const tokenCount = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
  if (tokenCount > 16) return false;
  return true;
}

function isCleanExerciseProblem(value) {
  const text = normalizeExerciseLine(value);
  if (!text) return false;
  const body = stripExerciseLabel(text);
  if (!body || body.length < 2 || body.length > 72) return false;
  if (/([A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\1{4,}/u.test(body)) return false;
  if (/^[<>≤≥]/.test(body)) return false;
  if (/[\p{L}]\)\s*/u.test(body)) return false;

  const symbolCount = (body.match(/[|=<>≤≥√+\-*/^()°]/g) || []).length;
  const digitCount = (body.match(/\d/g) || []).length;
  const cyrCount = (body.match(/[А-Яа-яЁёӨөҮүҢңӘә]/gu) || []).length;
  const latinCount = (body.match(/[A-Za-z]/g) || []).length;

  if (symbolCount === 0) return false;
  if (cyrCount >= 6 && symbolCount < 2 && digitCount < 2) return false;
  if (cyrCount > 0 && latinCount === 0 && symbolCount < 2 && digitCount < 2) return false;
  if (/[А-Яа-яЁёӨөҮүҢңӘә]{2,}/u.test(body)) return false;

  const latinWords = body.match(/[A-Za-z]+/g) || [];
  const allowedLatin = new Set(["x", "y", "z", "sin", "cos", "tan", "log", "ln", "sqrt", "pi", "e"]);
  if (latinWords.some((word) => !allowedLatin.has(String(word || "").toLowerCase()))) return false;

  return true;
}

function scoreExerciseProblemQuality(value) {
  const text = normalizeExerciseLine(value);
  if (!text) return -999;
  let score = 0;
  if (isCleanExerciseProblem(text)) score += 10;
  if (isStrictExerciseProblem(text)) score += 12;
  if (isLetterLabeledExerciseProblem(text)) score += 8;
  if (/[|√=+\-*/<>≤≥≈×÷]/.test(text)) score += 6;
  if (/\b(sin|cos|tan|log|ln)\b/i.test(text)) score += 4;
  if (/(жишээ|бодолт|дүгнэлт|тодорхойлолт|зураг)/iu.test(text)) score -= 8;
  if (/(хэрэв|иймд|эндээс|шийд\s+болно|нөхцөл)/iu.test(text)) score -= 6;
  if (text.length > 120) score -= 5;
  if (text.length > 70 && text.length <= 120) score -= 1;
  return score;
}

function findProblemPageHints(book, limit = 12) {
  if (!book || !Array.isArray(book.pages)) return [];
  const hints = extractExerciseProblemsFromPages(
    book.pages.map((page) => ({ pageNumber: page.pageNumber, content: cleanAnalysisPageText(page.text) })),
    { limit: Math.max(limit * 3, 24) },
  );
  const out = [];
  const seen = new Set();
  for (const item of hints) {
    const p = Math.trunc(Number(item?.pageNumber));
    if (!Number.isFinite(p) || p < 1 || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

function collectWordPoolFromTexts(texts) {
  const out = [];
  const seen = new Set();
  const text = (Array.isArray(texts) ? texts : [])
    .map((value) => String(value || ""))
    .join(" ");
  const words = text.match(/[\p{L}]{4,}/gu) || [];
  for (const word of words) {
    const trimmed = String(word || "").trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= 1000) break;
  }
  return out;
}

const SUPERSCRIPT_DIGIT_MAP = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
};

function toSuperscriptDigit(char) {
  return SUPERSCRIPT_DIGIT_MAP[char] || "";
}

function stripExerciseLabel(text) {
  return String(text || "")
    .replace(/^\s*(?:\d{1,3}|[A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\s*[\).:\-–]\s*/u, "")
    .trim();
}

function normalizeProblemKey(value) {
  const base = stripExerciseLabel(normalizeExerciseLine(value));
  return base.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatNumberForChoice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  const rounded = Math.abs(num) < 1e-10 ? 0 : num;
  const fixed = Number(rounded.toFixed(6));
  if (!Number.isFinite(fixed)) return "";
  return Number.isInteger(fixed) ? String(fixed) : String(fixed);
}

function parseNumericChoiceValue(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!/^[+\-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function mathValuesEqual(left, right, tolerance = 1e-6) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(Number(left) - Number(right)) <= tolerance;
}

function normalizeQuestionProblemKey(question) {
  const source = String(question?.source_excerpt || question?.sourceExcerpt || "").trim();
  if (source) return normalizeProblemKey(source);
  const fallback = String(question?.bookProblem || question?.question || "").trim();
  return normalizeProblemKey(fallback);
}

function dedupeQuestionsByProblem(questions, limit = 30) {
  const out = [];
  const seen = new Set();
  const items = Array.isArray(questions) ? questions : [];
  for (const question of items) {
    const key = normalizeQuestionProblemKey(question);
    const fallbackKey = String(question?.question || "").toLowerCase().replace(/\s+/g, " ").trim();
    const mergedKey = key || fallbackKey;
    if (!mergedKey || seen.has(mergedKey)) continue;
    seen.add(mergedKey);
    out.push(question);
    if (out.length >= limit) break;
  }
  return out;
}

function verifyQuestionAnswerAccuracy(question) {
  if (!question || typeof question !== "object") return null;
  const choices = Array.isArray(question.choices) ? question.choices : [];
  if (choices.length !== 4) return null;
  const questionText = String(question.question || "").trim();
  if (/(яг\s+адил|мөрийг\s*сонго|илэрхийллийг\s*сонго)/iu.test(questionText)) {
    return question;
  }

  const labels = ["A", "B", "C", "D"];
  const sourceProblem = String(question.source_excerpt || question.sourceExcerpt || "").trim();
  if (!sourceProblem) return question;

  const choiceBodies = choices.map((choice) => normalizeChoiceBody(choice));
  const body = stripExerciseLabel(sourceProblem);

  if (/[xXхХ]/.test(body) && (body.match(/=/g) || []).length === 1 && !/[<>≤≥]/.test(body)) {
    const [left, right] = body.split("=");
    const validIndexes = [];
    for (let idx = 0; idx < choiceBodies.length; idx += 1) {
      const xValue = parseNumericChoiceValue(choiceBodies[idx]);
      if (!Number.isFinite(xValue)) continue;
      const leftValue = evaluateMathExpression(left, { x: xValue });
      const rightValue = evaluateMathExpression(right, { x: xValue });
      if (mathValuesEqual(leftValue, rightValue, 1e-6)) {
        validIndexes.push(idx);
      }
    }
    if (validIndexes.length === 1) {
      return {
        ...question,
        correctAnswer: labels[validIndexes[0]],
      };
    }
    if (validIndexes.length > 1) {
      return null;
    }
  }

  const solved = evaluateSimpleExercise(sourceProblem);
  if (Number.isFinite(solved)) {
    const correctValue = Number(solved);
    let matchingIndex = -1;
    for (let idx = 0; idx < choiceBodies.length; idx += 1) {
      const choiceValue = parseNumericChoiceValue(choiceBodies[idx]);
      if (!Number.isFinite(choiceValue)) continue;
      if (mathValuesEqual(choiceValue, correctValue, 1e-5)) {
        if (matchingIndex >= 0) {
          return null;
        }
        matchingIndex = idx;
      }
    }

    if (matchingIndex >= 0) {
      return {
        ...question,
        correctAnswer: labels[matchingIndex],
      };
    }

    const rightChoice = formatNumberForChoice(correctValue);
    const wrongChoices = buildWrongNumericChoicesWithSalt(correctValue, 0);
    if (!rightChoice || wrongChoices.length < 3) return null;

    const rebuilt = [rightChoice, ...wrongChoices.slice(0, 3)];
    for (let i = rebuilt.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [rebuilt[i], rebuilt[j]] = [rebuilt[j], rebuilt[i]];
    }
    const correctIdx = rebuilt.findIndex((item) =>
      mathValuesEqual(parseNumericChoiceValue(item), correctValue, 1e-6));

    return {
      ...question,
      choices: rebuilt.map((choice, idx) => `${labels[idx]}. ${choice}`),
      correctAnswer: labels[correctIdx >= 0 ? correctIdx : 0],
      explanation:
        String(question.explanation || "").trim()
        || `${stripExerciseLabel(sourceProblem)} = ${formatNumberForChoice(correctValue)}`,
    };
  }

  const numericChoiceCount = choiceBodies.filter((choice) =>
    Number.isFinite(parseNumericChoiceValue(choice))).length;
  if (
    looksMathLikeText(sourceProblem)
    && (numericChoiceCount >= 2 || /[xXхХ=|√+\-*/]/.test(body))
  ) {
    return null;
  }

  return question;
}

function buildWrongNumericChoices(correctValue) {
  const correct = Number(correctValue);
  if (!Number.isFinite(correct)) return [];

  const out = [];
  const seen = new Set([formatNumberForChoice(correct)]);
  const baseStep = Number.isInteger(correct) ? 1 : 0.5;
  const candidates = [
    correct + baseStep,
    correct - baseStep,
    correct + 2 * baseStep,
    correct - 2 * baseStep,
    -correct,
    correct + 5 * baseStep,
    correct - 5 * baseStep,
  ];

  for (const candidate of candidates) {
    const text = formatNumberForChoice(candidate);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= 3) break;
  }

  while (out.length < 3) {
    const fallback = formatNumberForChoice(correct + (Math.random() * 8 - 4));
    if (!fallback || seen.has(fallback)) continue;
    seen.add(fallback);
    out.push(fallback);
  }
  return out.slice(0, 3);
}

function buildWrongNumericChoicesWithSalt(correctValue, salt = 0) {
  const base = buildWrongNumericChoices(correctValue);
  if (base.length >= 3) return base.slice(0, 3);

  const correct = Number(correctValue);
  if (!Number.isFinite(correct)) return base;
  const out = [...base];
  const seen = new Set(out.map((item) => String(item)));
  seen.add(formatNumberForChoice(correct));

  let tries = 0;
  while (out.length < 3 && tries < 20) {
    tries += 1;
    const delta = ((salt + tries) % 7) + 1;
    const candidate = formatNumberForChoice(correct + delta);
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
  }

  return out.slice(0, 3);
}

function evaluateSimpleExercise(problemText) {
  let expression = stripExerciseLabel(problemText);
  if (!expression) return null;

  expression = expression
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/,/g, ".")
    .replace(/:/g, "/")
    .replace(/\s+/g, "")
    .replace(/([²³⁴⁵⁶⁷⁸⁹])√([+\-]?\d+(?:\.\d+)?)/g, (_match, degree, radicand) => {
      const deg = toSuperscriptDigit(degree);
      if (!deg) return _match;
      return `Math.pow(${radicand},1/${deg})`;
    })
    .replace(/(\d)√([+\-]?\d+(?:\.\d+)?)/g, (_match, degree, radicand) => `Math.pow(${radicand},1/${degree})`)
    .replace(/√([+\-]?\d+(?:\.\d+)?)/g, (_match, radicand) => `Math.sqrt(${radicand})`)
    .replace(/\b(sin|cos|tan)\(?([+\-]?\d+(?:\.\d+)?)°\)?/gi, (_match, fnName, degree) => {
      const fn = String(fnName || "").toLowerCase();
      return `Math.${fn}((${degree})*Math.PI/180)`;
    })
    .replace(/\beos\b/gi, "cos")
    .replace(/\bv(?=\d)/gi, "√");

  for (const [symbol, digit] of Object.entries(SUPERSCRIPT_DIGIT_MAP)) {
    if (symbol === "⁻") continue;
    expression = expression.replace(new RegExp(`(\\d)${symbol}`, "g"), `$1^${digit}`);
  }
  expression = expression.replace(/⁻/g, "-");

  let safeExpression = expression;
  const barCount = (safeExpression.match(/\|/g) || []).length;
  if (barCount % 2 === 1) {
    if (safeExpression.trim().endsWith("|")) {
      safeExpression = `|${safeExpression}`;
    } else if (safeExpression.trim().startsWith("|")) {
      safeExpression = `${safeExpression}|`;
    } else {
      safeExpression = safeExpression.replace(/\|/g, "");
    }
  }
  while (/\|[^|]+\|/.test(safeExpression)) {
    safeExpression = safeExpression.replace(/\|([^|]+)\|/g, "Math.abs($1)");
  }
  safeExpression = safeExpression.replace(/\^/g, "**");

  const alphaCheck = safeExpression.replace(/Math\.(abs|sin|cos|tan|sqrt|pow|PI|E)/g, "");
  if (/[A-Za-zА-Яа-яЁёӨөҮүҢңӘә]/u.test(alphaCheck)) return null;
  const syntaxCheck = safeExpression.replace(/Math\.(abs|sin|cos|tan|sqrt|pow|PI|E)/g, "1");
  if (!/^[0-9+\-*/().\s*]+$/.test(syntaxCheck)) return null;

  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${safeExpression});`)();
    if (!Number.isFinite(value)) return null;
    return Number(value);
  } catch {
    return null;
  }
}

function scoreExpressionComplexity(value) {
  const text = String(value || "");
  if (!text) return 0;
  let score = 0;
  score += (text.match(/[+\-*/]/g) || []).length;
  if (/\|/.test(text)) score += 2;
  if (/√/.test(text)) score += 2;
  if (/\b(sin|cos|tan|log|ln)\b/i.test(text)) score += 3;
  if (/[xXхХ]/.test(text)) score += 3;
  if (/=/.test(text)) score += 2;
  return score;
}

function toSafeMathExpression(rawExpression, { allowVariable = false } = {}) {
  let expression = stripExerciseLabel(rawExpression);
  if (!expression) return null;

  expression = expression
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/,/g, ".")
    .replace(/:/g, "/")
    .replace(/\s+/g, "")
    .replace(/\beos\b/gi, "cos")
    .replace(/\bv(?=\d)/gi, "√")
    .replace(/([²³⁴⁵⁶⁷⁸⁹])√([+\-]?\d+(?:\.\d+)?)/g, (_match, degree, radicand) => {
      const deg = toSuperscriptDigit(degree);
      if (!deg) return _match;
      return `Math.pow(${radicand},1/${deg})`;
    })
    .replace(/(\d)√([+\-]?\d+(?:\.\d+)?)/g, (_match, degree, radicand) => `Math.pow(${radicand},1/${degree})`)
    .replace(/√([+\-]?\d+(?:\.\d+)?)/g, (_match, radicand) => `Math.sqrt(${radicand})`)
    .replace(/\b(sin|cos|tan)\(?([+\-]?\d+(?:\.\d+)?)°\)?/gi, (_match, fnName, degree) => {
      const fn = String(fnName || "").toLowerCase();
      return `Math.${fn}((${degree})*Math.PI/180)`;
    });

  for (const [symbol, digit] of Object.entries(SUPERSCRIPT_DIGIT_MAP)) {
    if (symbol === "⁻") continue;
    expression = expression.replace(new RegExp(`(\\d)${symbol}`, "g"), `$1^${digit}`);
  }
  expression = expression.replace(/⁻/g, "-");

  let safeExpression = expression;
  const barCount = (safeExpression.match(/\|/g) || []).length;
  if (barCount % 2 === 1) {
    if (safeExpression.trim().endsWith("|")) {
      safeExpression = `|${safeExpression}`;
    } else if (safeExpression.trim().startsWith("|")) {
      safeExpression = `${safeExpression}|`;
    } else {
      safeExpression = safeExpression.replace(/\|/g, "");
    }
  }
  while (/\|[^|]+\|/.test(safeExpression)) {
    safeExpression = safeExpression.replace(/\|([^|]+)\|/g, "Math.abs($1)");
  }
  safeExpression = safeExpression.replace(/\^/g, "**");
  if (allowVariable) {
    safeExpression = safeExpression.replace(/[xXхХ]/g, "x");
  }

  let alphaCheck = safeExpression.replace(/Math\.(abs|sin|cos|tan|sqrt|pow|PI|E)/g, "");
  if (allowVariable) {
    alphaCheck = alphaCheck.replace(/x/g, "");
  }
  if (/[A-Za-zА-Яа-яЁёӨөҮүҢңӘә]/u.test(alphaCheck)) return null;

  let syntaxCheck = safeExpression.replace(/Math\.(abs|sin|cos|tan|sqrt|pow|PI|E)/g, "1");
  if (allowVariable) {
    syntaxCheck = syntaxCheck.replace(/x/g, "1");
  }
  if (!/^[0-9+\-*/().\s*]+$/.test(syntaxCheck)) return null;
  return safeExpression;
}

function evaluateMathExpression(rawExpression, { x = null } = {}) {
  const allowVariable = Number.isFinite(Number(x));
  const safeExpression = toSafeMathExpression(rawExpression, { allowVariable });
  if (!safeExpression) return null;

  try {
    if (allowVariable) {
      // eslint-disable-next-line no-new-func
      const value = Function("x", `"use strict"; return (${safeExpression});`)(Number(x));
      return Number.isFinite(value) ? Number(value) : null;
    }
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${safeExpression});`)();
    return Number.isFinite(value) ? Number(value) : null;
  } catch {
    return null;
  }
}

function buildEquationChoiceQuestionsFromExercises({ exerciseProblems, needed }) {
  const items = Array.isArray(exerciseProblems) ? exerciseProblems : [];
  if (!items.length || needed <= 0) return [];

  const labels = ["A", "B", "C", "D"];
  const out = [];
  const seen = new Set();

  for (const rawItem of items) {
    if (out.length >= needed) break;
    const sourceProblem = normalizeExerciseLine(rawItem?.text || "");
    if (!sourceProblem) continue;
    const dedupeKey = normalizeProblemKey(sourceProblem);
    if (!dedupeKey || seen.has(dedupeKey)) continue;

    const body = stripExerciseLabel(sourceProblem);
    if (!/[xXхХ]/.test(body)) continue;
    if ((body.match(/=/g) || []).length !== 1) continue;
    if (/[<>≤≥]/.test(body)) continue;

    const [left, right] = body.split("=");
    const satisfies = [];
    for (let x = -30; x <= 30; x += 1) {
      const leftValue = evaluateMathExpression(left, { x });
      const rightValue = evaluateMathExpression(right, { x });
      if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) continue;
      if (mathValuesEqual(leftValue, rightValue, 1e-6)) {
        satisfies.push(x);
      }
    }
    if (!satisfies.length) continue;

    const correct = satisfies[Math.floor(satisfies.length / 2)];
    const wrong = [];
    const candidateWrongs = [
      correct - 1,
      correct + 1,
      correct - 2,
      correct + 2,
      -correct,
      0,
      1,
      -1,
    ];
    for (const candidate of candidateWrongs) {
      if (wrong.length >= 3) break;
      if (candidate === correct) continue;
      if (satisfies.includes(candidate)) continue;
      if (wrong.includes(candidate)) continue;
      wrong.push(candidate);
    }
    while (wrong.length < 3) {
      const candidate = correct + Math.floor(Math.random() * 14) - 7;
      if (candidate === correct) continue;
      if (satisfies.includes(candidate)) continue;
      if (wrong.includes(candidate)) continue;
      wrong.push(candidate);
    }

    const values = [correct, ...wrong.slice(0, 3)];
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    const correctIndex = values.indexOf(correct);

    out.push({
      question: SOLVE_QUESTION_TEXT,
      choices: values.map((value, idx) => `${labels[idx]}. ${value}`),
      correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0],
      explanation: `x=${correct} үед тэгшитгэл биелнэ.`,
      source_pages: Number.isFinite(Number(rawItem?.pageNumber)) ? [Math.trunc(Number(rawItem.pageNumber))] : [],
      source_excerpt: sourceProblem,
    });
    seen.add(dedupeKey);
  }

  return out.slice(0, needed);
}

function buildSolvedQuestionsFromExerciseProblems({ exerciseProblems, needed }) {
  const items = Array.isArray(exerciseProblems) ? exerciseProblems : [];
  if (!items.length || needed <= 0) return [];

  const equationQuestions = buildEquationChoiceQuestionsFromExercises({ exerciseProblems: items, needed });
  const remainingNeeded = Math.max(0, needed - equationQuestions.length);
  if (remainingNeeded === 0) return equationQuestions.slice(0, needed);

  const solvedPool = [];
  const extractCandidateExpressions = (rawProblem) => {
    const source = String(rawProblem || "").trim();
    if (!source) return [];
    const body = stripExerciseLabel(source);
    const out = [];
    const seen = new Set();

    const pushCandidate = (candidate) => {
      const value = normalizeExerciseLine(candidate);
      if (!value) return;
      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(value);
    };

    const absMatches = body.match(/\|[^|]{1,48}\|/g) || [];
    for (const abs of absMatches) pushCandidate(abs);

    const oddAbsMatches = body.match(/[^\s|]{0,12}\|[^|]{1,40}\||\|[^|]{1,40}[^\s|]{0,12}/g) || [];
    for (const oddAbs of oddAbsMatches) pushCandidate(oddAbs);

    const shortSplit = body
      .split(/[;,]/g)
      .map((item) => normalizeExerciseLine(item))
      .filter((item) => item.length >= 3 && item.length <= 56);
    for (const part of shortSplit) pushCandidate(part);

    pushCandidate(body);
    return out;
  };
  for (const item of items) {
    const sourceProblem = normalizeExerciseLine(item?.text || "");
    if (!sourceProblem) continue;
    const candidates = extractCandidateExpressions(sourceProblem);
    let bestSolved = null;
    for (const candidate of candidates) {
      const solved = evaluateSimpleExercise(candidate);
      if (!Number.isFinite(solved)) continue;
      const correctValue = formatNumberForChoice(solved);
      if (!correctValue) continue;
      const complexity = scoreExpressionComplexity(candidate);
      if (!bestSolved || complexity > bestSolved.complexity) {
        bestSolved = {
          pageNumber: Math.trunc(Number(item?.pageNumber)),
          problemRoot: sourceProblem,
          sourceProblem: candidate,
          solved,
          correctValue,
          complexity,
        };
      }
    }
    if (bestSolved) solvedPool.push(bestSolved);
  }

  if (!solvedPool.length) return equationQuestions.slice(0, needed);

  const labels = ["A", "B", "C", "D"];
  const out = [];
  const seen = new Set();

  solvedPool.sort((left, right) => right.complexity - left.complexity);

  for (let index = 0; out.length < remainingNeeded && index < solvedPool.length; index += 1) {
    const item = solvedPool[index];
    const dedupeKey = normalizeProblemKey(item.problemRoot || item.sourceProblem);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const wrongValues = buildWrongNumericChoicesWithSalt(item.solved, index);
    if (wrongValues.length < 3) continue;

    const rawChoices = [item.correctValue, ...wrongValues.slice(0, 3)];
    for (let i = rawChoices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [rawChoices[i], rawChoices[j]] = [rawChoices[j], rawChoices[i]];
    }

    const correctIndex = rawChoices.indexOf(item.correctValue);
    out.push({
      question: "Энэ бодлогыг бодоод зөв хариуг сонго.",
      choices: rawChoices.map((choice, idx) => `${labels[idx]}. ${choice}`),
      correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0],
      explanation: `${stripExerciseLabel(item.sourceProblem)} = ${item.correctValue}`,
      source_pages: Number.isFinite(item.pageNumber) ? [item.pageNumber] : [],
      source_excerpt: item.problemRoot || item.sourceProblem,
    });
  }

  return [...equationQuestions, ...out].slice(0, needed);
}

function buildLocalQuestionsFromExerciseProblems({ exerciseProblems, needed }) {
  const candidates = Array.isArray(exerciseProblems) ? exerciseProblems : [];
  const out = [];
  const seenQuestions = new Set();
  const labels = ["A", "B", "C", "D"];

  for (const candidate of candidates) {
    if (out.length >= needed) break;
    const sourceProblem = normalizeExerciseLine(candidate?.text || "");
    if (!sourceProblem) continue;

    const solved = evaluateSimpleExercise(sourceProblem);
    if (Number.isFinite(solved)) {
      const correctValue = formatNumberForChoice(solved);
      if (!correctValue) continue;
      const wrongValues = buildWrongNumericChoices(solved);
      if (wrongValues.length < 3) continue;

      const rawChoices = [correctValue, ...wrongValues.slice(0, 3)];
      for (let i = rawChoices.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [rawChoices[i], rawChoices[j]] = [rawChoices[j], rawChoices[i]];
      }

      const correctIndex = rawChoices.indexOf(correctValue);
      const dedupeKey = `numeric::${sourceProblem.toLowerCase()}`;
      if (seenQuestions.has(dedupeKey)) continue;
      seenQuestions.add(dedupeKey);

      out.push({
        question: SOLVE_QUESTION_TEXT,
        choices: rawChoices.map((choice, idx) => `${labels[idx]}. ${choice}`),
        correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0],
        explanation: `${stripExerciseLabel(sourceProblem)} = ${correctValue}`,
        source_pages: [candidate.pageNumber],
        source_excerpt: sourceProblem,
      });
    }
  }

  return out;
}

function compactProblemChoice(value, maxLen = 72) {
  const text = normalizeExerciseLine(value);
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(24, maxLen - 3)).trim()}...`;
}

function buildProblemIdentityQuestions({ exerciseProblems, needed, excludedProblemTexts = [] }) {
  const items = Array.isArray(exerciseProblems) ? exerciseProblems : [];
  if (!items.length || needed <= 0) return [];

  const excluded = new Set(
    (Array.isArray(excludedProblemTexts) ? excludedProblemTexts : [])
      .map((value) => normalizeExerciseLine(value).toLowerCase())
      .filter(Boolean),
  );
  const pool = items
    .map((item) => ({
      pageNumber: Math.trunc(Number(item?.pageNumber)),
      text: normalizeExerciseLine(item?.text),
    }))
    .filter((item) => item.text && !excluded.has(item.text.toLowerCase()));

  const out = [];
  const labels = ["A", "B", "C", "D"];
  for (let i = 0; i < pool.length && out.length < needed; i += 1) {
    const current = pool[i];
    const distractors = [];
    for (let j = 0; j < pool.length && distractors.length < 3; j += 1) {
      if (j === i) continue;
      const candidate = pool[j];
      if (!candidate?.text) continue;
      if (distractors.some((item) => item.text.toLowerCase() === candidate.text.toLowerCase())) continue;
      distractors.push(candidate);
    }
    if (distractors.length < 3) continue;

    const choicesRaw = [current, ...distractors.slice(0, 3)];
    for (let k = choicesRaw.length - 1; k > 0; k -= 1) {
      const j = Math.floor(Math.random() * (k + 1));
      [choicesRaw[k], choicesRaw[j]] = [choicesRaw[j], choicesRaw[k]];
    }
    const correctIndex = choicesRaw.findIndex((item) => item.text === current.text);

    out.push({
      question: "Номын бодлоготой яг адил мөрийг сонго.",
      choices: choicesRaw.map((item, idx) => `${labels[idx]}. ${compactProblemChoice(item.text)}`),
      correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0],
      explanation: "Зөв хариу нь номын бодлогын мөртэй үг, тэмдэгтээрээ таарна.",
      source_pages: Number.isFinite(current.pageNumber) ? [current.pageNumber] : [],
      source_excerpt: current.text,
    });
  }

  return out;
}

function collectLooseMathProblemsFromPages(pages, { limit = 80 } = {}) {
  const items = Array.isArray(pages) ? pages : [];
  const out = [];
  const seen = new Set();

  for (const page of items) {
    const raw = String(page?.content || page?.text || "");
    if (!raw.trim()) continue;

    const prepared = raw
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/([A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\)/gu, "\n$1)")
      .replace(/(^|[\s,;:])(\d{1,3}[).])/gu, "$1\n$2")
      .replace(/\n{2,}/g, "\n");

    const lines = prepared
      .split(/\n+/g)
      .map((line) => cleanExerciseProblemText(line))
      .filter(Boolean);

    for (const line of lines) {
      if (line.length < 3 || line.length > 100) continue;
      if (!/[0-9|=<>≤≥√+\-*/^]/.test(line)) continue;
      if (/(жишээ|бодолт|дүгнэлт|тодорхойлолт|зураг)/iu.test(line)) continue;
      const key = line.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        pageNumber: Math.trunc(Number(page?.pageNumber)),
        text: line,
      });
      if (out.length >= limit) return out;
    }
  }

  return out;
}

function buildGuaranteedExerciseQuestions({ exerciseProblems, needed }) {
  const items = Array.isArray(exerciseProblems) ? exerciseProblems : [];
  if (!items.length || needed <= 0) return [];

  const labels = ["A", "B", "C", "D"];
  const out = [];
  const used = new Set();

  const mutateNumber = (text) => String(text || "").replace(/\d+/, (num) => String(Math.max(0, Number(num) + 1)));
  const flipSign = (text) => {
    const source = String(text || "");
    if (source.includes("+")) return source.replace("+", "-");
    if (source.includes("-")) return source.replace("-", "+");
    return `${source} + 1`;
  };
  const dropAbs = (text) => String(text || "").replace(/\|/g, "");

  for (const item of items) {
    if (out.length >= needed) break;
    const problem = normalizeExerciseLine(item?.text || "");
    if (!problem) continue;
    const key = problem.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);

    const wrongRaw = [
      mutateNumber(problem),
      flipSign(problem),
      dropAbs(problem) || `${problem} + 0`,
      `${problem} + 0`,
    ];
    const wrong = [];
    for (const candidate of wrongRaw) {
      const normalized = normalizeExerciseLine(candidate);
      if (!normalized || normalized.toLowerCase() === key) continue;
      if (wrong.some((itemValue) => itemValue.toLowerCase() === normalized.toLowerCase())) continue;
      wrong.push(normalized);
      if (wrong.length >= 3) break;
    }
    while (wrong.length < 3) {
      wrong.push(`${problem}${wrong.length + 1}`);
    }

    const choiceValues = [problem, ...wrong.slice(0, 3)];
    for (let i = choiceValues.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [choiceValues[i], choiceValues[j]] = [choiceValues[j], choiceValues[i]];
    }
    const correctIndex = choiceValues.findIndex((value) => value === problem);

    out.push({
      question: "Номын дасгалын бодлоготой яг адил илэрхийллийг сонго.",
      choices: choiceValues.map((value, idx) => `${labels[idx]}. ${compactProblemChoice(value)}`),
      correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0],
      explanation: "Зөв сонголт нь номон дээрх бодлогын мөртэй бүрэн таарна.",
      source_pages: Number.isFinite(Number(item?.pageNumber)) ? [Math.trunc(Number(item.pageNumber))] : [],
      source_excerpt: problem,
    });
  }

  return out.slice(0, needed);
}

router.get("/", (req, res) => {
  const books = listBooks().map((book) => ({
    ...book,
    fileUrl: toAbsoluteUrl(req, `/api/books/${book.id}/file`),
  }));
  res.json({ books });
});

function sanitizeDownloadName(name) {
  const raw = String(name || "uploaded.pdf").trim() || "uploaded.pdf";
  return raw.replace(/[/\\?%*:|"<>]/g, "_");
}

router.get("/:bookId", (req, res) => {
  const bookId = String(req.params.bookId || "");
  const book = getBookById(bookId);
  if (!book) {
    return res.status(404).json({ error: "Ном олдсонгүй. Дахин upload хийнэ үү." });
  }

  const includeText = String(req.query.includeText || "").trim() === "1";
  const structured = ensureStructuredContent(book);
  const sections = flattenSections(structured.chapters);
  return res.json({
    bookId: book.id,
    title: book.title,
    fileName: book.fileName,
    pageCount: book.pages.length,
    createdAt: book.createdAt,
    hasPdf: Boolean(book.pdfPath && pdfExists(book.pdfPath)),
    fileUrl: toAbsoluteUrl(req, `/api/books/${book.id}/file`),
    chapters: structured.chapters,
    sections,
    pages: book.pages.map((page) => ({
      pageNumber: page.pageNumber,
      ...(includeText
        ? { text: cleanDisplayPageText(page.text) }
        : { preview: compactTextPreview(cleanDisplayPageText(page.text)) }),
    })),
  });
});

router.get("/:bookId/structure", (req, res) => {
  const bookId = String(req.params.bookId || "");
  const book = getBookById(bookId);
  if (!book) {
    return res.status(404).json({ error: "Ном олдсонгүй. Дахин upload хийнэ үү." });
  }

  const structured = ensureStructuredContent(book);
  const sections = flattenSections(structured.chapters);

  return res.json({
    bookId: book.id,
    title: book.title,
    chapters: structured.chapters,
    sections,
  });
});

router.get("/:bookId/sections/:sectionId", (req, res) => {
  const bookId = String(req.params.bookId || "");
  const sectionId = String(req.params.sectionId || "");
  const book = getBookById(bookId);
  if (!book) {
    return res.status(404).json({ error: "Ном олдсонгүй. Дахин upload хийнэ үү." });
  }

  const structured = ensureStructuredContent(book);
  const located = findSectionById(structured.chapters, sectionId);
  if (!located) {
    return res.status(404).json({ error: "Section олдсонгүй." });
  }

  const offset = clampOffset(req.query.offset);
  const windowSize = parseWindowSize(req.query.windowSize, 3);
  const pages = Array.isArray(located.section?.pages) ? located.section.pages : [];
  const bookPageMap = new Map(
    (Array.isArray(book.pages) ? book.pages : []).map((page) => [page.pageNumber, page]),
  );
  const visiblePages = pages.slice(offset, offset + windowSize).map((page) => {
    const rawPage = bookPageMap.get(page.pageNumber);
    return {
      ...page,
      content: cleanDisplayPageText(rawPage?.text || page?.content || ""),
    };
  });

  return res.json({
    bookId: book.id,
    title: book.title,
    section: {
      id: located.section.id,
      title: located.section.title,
      chapterTitle: located.chapterTitle,
      subsections: Array.isArray(located.section.subsections) ? located.section.subsections : [],
    },
    offset,
    windowSize,
    totalPagesInSection: pages.length,
    hasPrev: offset > 0,
    hasNext: offset + windowSize < pages.length,
    visiblePageNumbers: visiblePages.map((page) => page.pageNumber),
    visiblePages,
  });
});

router.get("/:bookId/pages/:pageNumber/image", async (req, res, next) => {
  try {
    const bookId = String(req.params.bookId || "");
    const book = getBookById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Ном олдсонгүй. Дахин upload хийнэ үү." });
    }

    const pdfPathFromStore = book?.pdfPath && pdfExists(book.pdfPath) ? book.pdfPath : "";
    const pdfPath = pdfPathFromStore || findExistingBookPdfPath(bookId);
    if (!pdfPath) {
      return res.status(404).json({
        error:
          "PDF олдсонгүй. Хэрвээ backend restart хийсэн бол номын мэдээлэл устдаг тул дахин upload хийх шаардлагатай байж магадгүй.",
      });
    }

    const pageNumber = parsePageNumber(req.params.pageNumber, 1);
    const maxPage = Math.max(1, Number(book.pages?.length || 0));
    if (pageNumber < 1 || pageNumber > maxPage) {
      return res.status(400).json({
        error: `Хуудасны дугаар буруу байна. Энэ ном ${maxPage} хуудастай.`,
      });
    }

    const dpiRaw = Number(req.query.dpi);
    const dpi = Number.isFinite(dpiRaw) ? Math.min(260, Math.max(100, Math.trunc(dpiRaw))) : 170;

    const pngBuffer = await renderPdfPageImageBuffer({
      pdfPath,
      pageNumber,
      dpi,
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=180");
    return res.send(pngBuffer);
  } catch (error) {
    return next(error);
  }
});

router.get("/:bookId/pages", (req, res) => {
  const bookId = String(req.params.bookId || "");
  const book = getBookById(bookId);
  if (!book) {
    return res.status(404).json({ error: "Ном олдсонгүй. Дахин upload хийнэ үү." });
  }

  const startPage = parsePageNumber(req.query.startPage, 1);
  const endPage = parsePageNumber(req.query.endPage, book.pages.length);
  if (startPage > endPage) {
    return res.status(400).json({ error: "`startPage` нь `endPage`-аас бага байх ёстой." });
  }

  const maxPages = 50;
  const count = endPage - startPage + 1;
  if (count > maxPages) {
    return res.status(400).json({
      error: `Нэг удаад хамгийн ихдээ ${maxPages} page авч болно. (Одоо ${count} байна)`,
    });
  }

  if (startPage < 1 || endPage > book.pages.length) {
    return res.status(400).json({
      error: `Хуудасны сонголт буруу байна. Энэ ном ${book.pages.length} хуудастай.`,
    });
  }

  const pages = book.pages.slice(startPage - 1, endPage).map((page) => ({
    pageNumber: page.pageNumber,
    text: cleanDisplayPageText(page.text),
  }));

  return res.json({
    bookId: book.id,
    title: book.title,
    startPage,
    endPage,
    pages,
  });
});

router.get("/:bookId/file", (req, res) => {
  const bookId = String(req.params.bookId || "");
  const book = getBookById(bookId);

  const pdfPathFromStore = book?.pdfPath && pdfExists(book.pdfPath) ? book.pdfPath : "";
  const pdfPath = pdfPathFromStore || findExistingBookPdfPath(bookId);
  if (!pdfPath) {
    return res.status(404).json({
      error:
        "PDF олдсонгүй. Хэрвээ backend restart хийсэн бол номын мэдээлэл устдаг тул дахин upload хийх шаардлагатай байж магадгүй.",
    });
  }

  const download = String(req.query.download || "").trim() === "1";
  const fileName = sanitizeDownloadName(book?.fileName || `${bookId}.pdf`);
  res.setHeader("Content-Type", "application/pdf");

  if (download) {
    return res.download(pdfPath, fileName);
  }

  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  return res.sendFile(pdfPath);
});

router.post("/:bookId/reparse", async (req, res, next) => {
  try {
    const bookId = String(req.params.bookId || "");
    const book = getBookById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Ном олдсонгүй. Дахин upload хийнэ үү." });
    }

    const pdfPathFromStore = book?.pdfPath && pdfExists(book.pdfPath) ? book.pdfPath : "";
    const pdfPath = pdfPathFromStore || findExistingBookPdfPath(bookId);
    if (!pdfPath) {
      return res.status(404).json({
        error:
          "PDF олдсонгүй. Хэрвээ backend restart хийсэн бол номын мэдээлэл устдаг тул дахин upload хийх шаардлагатай байж магадгүй.",
      });
    }

    const buffer = await fs.readFile(pdfPath);
    const forceOcr =
      String(req.query.forceOcr || req.body?.forceOcr || "").trim() === "1";
    const parsedPages = await parsePdfPages(buffer, { forceOcr });
    const structuredContent = buildBookStructure(parsedPages);
    if (!parsedPages.length) {
      return res.status(400).json({ error: "PDF-ээс текст уншиж чадсангүй." });
    }

    const updated = updateBook(bookId, {
      pages: parsedPages,
      structuredContent,
      pdfPath,
      title: book.title,
      fileName: book.fileName,
    });
    if (!updated) {
      return res.status(500).json({ error: "Номын мэдээлэл шинэчлэх үед алдаа гарлаа." });
    }

    return res.json({
      bookId: updated.id,
      title: updated.title,
      fileName: updated.fileName,
      pageCount: updated.pages.length,
      hasPdf: Boolean(updated.pdfPath && pdfExists(updated.pdfPath)),
      fileUrl: toAbsoluteUrl(req, `/api/books/${updated.id}/file`),
      chapters: updated.structuredContent?.chapters || [],
      sections: flattenSections(updated.structuredContent?.chapters || []),
      pages: updated.pages.map((page) => ({
        pageNumber: page.pageNumber,
        preview: compactTextPreview(cleanDisplayPageText(page.text)),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/upload", uploadSinglePdf, async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "PDF файл илгээнэ үү." });
    }

    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfName = /\.pdf$/i.test(file.originalname || "");
    if (!isPdfMime && !isPdfName) {
      return res.status(400).json({ error: "Зөвхөн PDF файл дэмжинэ." });
    }

    const forceOcr =
      String(req.query.forceOcr || req.body?.forceOcr || "").trim() === "1";
    const parsedPages = await parsePdfPages(file.buffer, { forceOcr });
    const structuredContent = buildBookStructure(parsedPages);
    if (!parsedPages.length) {
      return res.status(400).json({ error: "PDF-ээс текст уншиж чадсангүй." });
    }

    const bookId = createBookId();
    const pdfPath = await saveBookPdf({ bookId, buffer: file.buffer });

    const book = saveBook({
      id: bookId,
      fileName: file.originalname || "uploaded.pdf",
      pages: parsedPages,
      structuredContent,
      pdfPath,
      title: (file.originalname || "uploaded.pdf").replace(/\.pdf$/i, ""),
    });

    return res.json({
      bookId: book.id,
      title: book.title,
      fileName: book.fileName,
      pageCount: book.pages.length,
      fileUrl: toAbsoluteUrl(req, `/api/books/${book.id}/file`),
      chapters: structuredContent.chapters,
      sections: flattenSections(structuredContent.chapters),
      pages: book.pages.map((page) => ({
        pageNumber: page.pageNumber,
        preview: compactTextPreview(cleanDisplayPageText(page.text)),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:bookId/generate-test", async (req, res, next) => {
  try {
    const bookId = String(req.params.bookId || "");
    const book = getBookById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Ном олдсонгүй. Дахин upload хийнэ үү." });
    }

    const {
      difficulty: difficultyRaw,
      difficultyCounts: difficultyCountsRaw,
      openQuestionCount: openQuestionCountRaw,
      questionCount: questionCountRaw,
      sectionId: sectionIdRaw,
      sectionIds: sectionIdsRaw,
      totalScore: totalScoreRaw,
      visiblePageNumbers: visiblePageNumbersRaw,
    } = req.body || {};

    const difficulty = normalizeDifficulty(difficultyRaw);
    const difficultyCounts = normalizeDifficultyCounts(difficultyCountsRaw);
    const requestedByDifficulty = difficultyCounts.total;
    const parsedQuestionCount = parseQuestionCount(questionCountRaw, 10);
    const questionCount = requestedByDifficulty > 0 ? requestedByDifficulty : parsedQuestionCount;
    const openQuestionCount = parseNonNegativeInt(openQuestionCountRaw, 0, 80);
    const totalScore = parseNonNegativeInt(totalScoreRaw, 0, 500);
    const structured = ensureStructuredContent(book);
    const sectionId = String(sectionIdRaw || "").trim();
    const sectionIds = Array.from(
      new Set(
        (Array.isArray(sectionIdsRaw) ? sectionIdsRaw : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    );
    const visiblePageNumbers = parsePageNumbers(visiblePageNumbersRaw, book.pages.length);

    let visiblePages = [];
    let sourceLabel = "";

    if (visiblePageNumbers.length > 0) {
      const wanted = new Set(visiblePageNumbers);
      visiblePages = book.pages
        .filter((page) => wanted.has(page.pageNumber))
        .map((page) => ({
          pageNumber: page.pageNumber,
          content: cleanAnalysisPageText(page.text),
          formulas: [],
          examples: [],
        }));
      sourceLabel = "visible-pageNumbers";
    } else if (sectionIds.length > 0) {
      const pageMap = new Map();
      for (const id of sectionIds) {
        const located = findSectionById(structured.chapters, id);
        if (!located) continue;
        const pages = Array.isArray(located.section?.pages) ? located.section.pages.slice(0, 3) : [];
        for (const page of pages) {
          const pageNumber = Math.trunc(Number(page?.pageNumber));
          if (!Number.isFinite(pageNumber) || pageNumber < 1 || pageMap.has(pageNumber)) continue;
          const rawPage = (Array.isArray(book.pages) ? book.pages : []).find((item) => item.pageNumber === pageNumber);
          pageMap.set(pageNumber, {
            pageNumber,
            content: cleanAnalysisPageText(rawPage?.text || page?.content || ""),
            formulas: [],
            examples: [],
          });
        }
      }
      visiblePages = Array.from(pageMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
      sourceLabel = `sections:${sectionIds.join(",")}`;
    } else if (sectionId) {
      const located = findSectionById(structured.chapters, sectionId);
      if (!located) {
        return res.status(404).json({ error: "Section олдсонгүй." });
      }
      visiblePages = Array.isArray(located.section?.pages) ? located.section.pages.slice(0, 3) : [];
      sourceLabel = `section:${sectionId}`;
    }

    if (!visiblePages.length) {
      return res.status(400).json({
        error: "`visiblePageNumbers` (2-3 visible pages) эсвэл `sectionId` шаардлагатай.",
      });
    }

    const extractedExerciseProblems = extractExerciseProblemsFromPages(visiblePages, {
      limit: Math.max(200, questionCount * 15),
    });
    const letterLabeledProblems = extractedExerciseProblems.filter((item) =>
      isLetterLabeledExerciseProblem(item?.text),
    );
    const strictExerciseProblems = letterLabeledProblems.filter((item) =>
      isStrictExerciseProblem(item?.text),
    );
    const preferredExerciseProblems =
      strictExerciseProblems.length > 0
        ? strictExerciseProblems
        : (
          letterLabeledProblems.length >= Math.max(5, Math.ceil(questionCount / 2))
            ? letterLabeledProblems
            : extractedExerciseProblems
        );
    const exerciseOnlyProblems = preferredExerciseProblems.filter((item) =>
      isStrictExerciseProblem(item?.text) || isLetterLabeledExerciseProblem(item?.text),
    );
    const candidateExerciseProblems = exerciseOnlyProblems.length
      ? exerciseOnlyProblems
      : preferredExerciseProblems;
    const rankedExerciseProblems = [...candidateExerciseProblems]
      .sort((left, right) => scoreExerciseProblemQuality(right?.text) - scoreExerciseProblemQuality(left?.text))
      .slice(0, Math.max(40, questionCount * 8));
    const topStrictRanked = rankedExerciseProblems.filter((item) => isStrictExerciseProblem(item?.text));
    const topCleanStrict = topStrictRanked.filter((item) => isCleanExerciseProblem(item?.text));
    const topCleanRanked = rankedExerciseProblems.filter((item) => isCleanExerciseProblem(item?.text));
    const sourceExerciseProblems =
      topCleanStrict.length > 0
        ? topCleanStrict
        : topCleanRanked.length > 0
          ? topCleanRanked
          : topStrictRanked.length > 0
            ? topStrictRanked
            : rankedExerciseProblems;
    let selectedExerciseProblems = sourceExerciseProblems.slice(0, Math.max(questionCount * 4, 16));
    if (!selectedExerciseProblems.length) {
      selectedExerciseProblems = collectLooseMathProblemsFromPages(visiblePages, {
        limit: Math.max(questionCount * 4, 16),
      });
    } else if (selectedExerciseProblems.length < questionCount) {
      const looseCandidates = collectLooseMathProblemsFromPages(visiblePages, {
        limit: Math.max(questionCount * 6, 24),
      });
      const merged = [...selectedExerciseProblems];
      const seen = new Set(
        selectedExerciseProblems
          .map((item) => normalizeProblemKey(item?.text || ""))
          .filter(Boolean),
      );
      for (const item of looseCandidates) {
        const key = normalizeProblemKey(item?.text || "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
        if (merged.length >= Math.max(questionCount * 4, 16)) break;
      }
      selectedExerciseProblems = merged;
    }

    const sourceText = [
      "EXERCISE_PROBLEMS:",
      ...selectedExerciseProblems.map(
        (item, index) => `${index + 1}. [Page ${item.pageNumber}] ${String(item.text || "").trim()}`,
      ),
    ].join("\n");
    const visibleNumbers = visiblePages.map((page) => page.pageNumber);
    const answerKeyText = buildAnswerKeyTextFromSelection({
      book,
      pageNumbers: visibleNumbers,
      maxPages: 90,
    });

    if (sourceText.replace(/\s+/g, "").length < 40) {
      return res.status(400).json({
        error: "Visible content дээр хангалттай текст алга байна. Илүү тодорхой 2-3 хуудас сонгоно уу.",
      });
    }

    if (!selectedExerciseProblems.length) {
      const hintPages = findProblemPageHints(book, 12);
      const hintText = hintPages.length
        ? `Бодлого ихтэй магадлалтай page: ${hintPages.join(", ")}`
        : "Номоос бодлоготой page автоматаар илрүүлж чадсангүй.";
      return res.status(400).json({
        error: `Сонгосон visible pages дээр "ДАСГАЛ/ДААЛГАВАР" хэсгийн бодлого олдсонгүй. ${hintText}`,
      });
    }

    const generateTimeoutMs = Number(
      process.env.TEST_GENERATE_TIMEOUT_MS
      || process.env.OLLAMA_TIMEOUT_MS
      || 300000,
    );
    let generation = null;
    let generationTopUp = null;
    let generationError = null;
    let generationTopUpError = null;
    let generationModeUsed = "extract";

    try {
      generation = await generateBookQuestions({
        baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
        answerKeyText,
        fillMode: "strict",
        geminiApiKey: process.env.GEMINI_API_KEY,
        geminiBaseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com",
        geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        model: process.env.OLLAMA_MODEL || "qwen2.5:0.5b",
        mode: "extract",
        pageText: sourceText,
        provider: process.env.LLM_PROVIDER || "auto",
        questionCount,
        timeoutMs: generateTimeoutMs,
      });
    } catch (error) {
      generationError = error;
    }

    let generatedQuestions = Array.isArray(generation?.questions) ? [...generation.questions] : [];
    if (!generationError && generatedQuestions.length < questionCount) {
      try {
        generationTopUp = await generateBookQuestions({
          baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
          geminiApiKey: process.env.GEMINI_API_KEY,
          geminiBaseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com",
          geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
          model: process.env.OLLAMA_MODEL || "qwen2.5:0.5b",
          mode: "generate",
          pageText: `${buildTestPromptPrefix(difficulty)}\n\n${sourceText}`,
          provider: process.env.LLM_PROVIDER || "auto",
          questionCount: questionCount - generatedQuestions.length,
          timeoutMs: generateTimeoutMs,
        });
        generatedQuestions = generatedQuestions.concat(
          Array.isArray(generationTopUp?.questions) ? generationTopUp.questions : [],
        );
        generationModeUsed = "extract+generate";
      } catch (error) {
        generationTopUpError = error;
      }
    }

    const exerciseProblemFallbacks = selectedExerciseProblems.map((item) => ({
      pageNumber: Math.trunc(Number(item?.pageNumber)),
      text: String(item?.text || "").trim(),
    }));

    const mappedAll = generatedQuestions
      .filter((question) => Array.isArray(question?.choices) && question.choices.length === 4)
      .map((question, index) => {
        const fallbackExercise =
          exerciseProblemFallbacks.length > 0
            ? exerciseProblemFallbacks[index % exerciseProblemFallbacks.length]
            : null;
        const correct = String(question.correct_answer || question.correctAnswer || "").trim().toUpperCase();
        const safeCorrect = /^[A-D]$/.test(correct) ? correct : "A";
        const sourceExcerpt = String(
          question.source_excerpt || question.sourceExcerpt || "",
        ).trim();
        const fallbackProblemFromQuestion =
          !sourceExcerpt && looksMathLikeText(question?.question)
            ? String(question.question || "").trim()
            : "";
        const fallbackProblemFromExercise = String(fallbackExercise?.text || "").trim();
        const bookProblem = sourceExcerpt || fallbackProblemFromQuestion || fallbackProblemFromExercise;
        const sourcePages = Array.isArray(question.source_pages)
          ? question.source_pages
          : Array.isArray(question.sourcePages)
            ? question.sourcePages
            : [];
        const normalizedSourcePages = sourcePages.length
          ? sourcePages
          : Number.isFinite(Number(fallbackExercise?.pageNumber))
            ? [Math.trunc(Number(fallbackExercise.pageNumber))]
            : [];
        const normalizedQuestionText = bookProblem
          ? SOLVE_QUESTION_TEXT
          : String(question.question || "").trim();

        return {
          question: normalizedQuestionText,
          choices: question.choices.map((choice, idx) => {
            const letter = ["A", "B", "C", "D"][idx];
            const body = normalizeChoiceBody(choice) || String(choice || "").trim();
            return `${letter}. ${body}`;
          }),
          correctAnswer: safeCorrect,
          explanation: String(question.explanation || "").trim() || "Эх текст дээр тулгуурлан гаргав.",
          source_pages: normalizedSourcePages,
          source_excerpt: bookProblem,
        };
      })
      .filter((question) => question.question && question.choices.length === 4);

    const mapped = mappedAll
      .sort((left, right) => {
        const leftMath = looksMathLikeText(left.question) || looksMathLikeText(left.source_excerpt);
        const rightMath = looksMathLikeText(right.question) || looksMathLikeText(right.source_excerpt);
        return Number(rightMath) - Number(leftMath);
      })
      .slice(0, questionCount);

    const needed = Math.max(0, questionCount - mapped.length);
    const solvedTopUp = needed > 0
      ? buildSolvedQuestionsFromExerciseProblems({ needed, exerciseProblems: selectedExerciseProblems })
      : [];
    const localNeeded = Math.max(0, needed - solvedTopUp.length);
    const localTopUp = localNeeded > 0
      ? buildLocalQuestionsFromExerciseProblems({ needed: localNeeded, exerciseProblems: selectedExerciseProblems })
      : [];
    let questions = [...mapped, ...solvedTopUp, ...localTopUp].slice(0, questionCount);
    const initialQuestionCount = questions.length;
    questions = dedupeQuestionsByProblem(questions, questionCount);
    const droppedByDuplicate = Math.max(0, initialQuestionCount - questions.length);

    let droppedByAccuracy = 0;
    const verifiedQuestions = [];
    for (const question of questions) {
      const verified = verifyQuestionAnswerAccuracy(question);
      if (!verified) {
        droppedByAccuracy += 1;
        continue;
      }
      verifiedQuestions.push(verified);
    }
    questions = dedupeQuestionsByProblem(verifiedQuestions, questionCount);

    if (questions.length < questionCount) {
      const usedProblemKeys = new Set(
        questions
          .map((question) => normalizeQuestionProblemKey(question))
          .filter(Boolean),
      );
      const remainingProblems = selectedExerciseProblems.filter((item) => {
        const key = normalizeProblemKey(item?.text || "");
        return key && !usedProblemKeys.has(key);
      });
      const extraSolved = buildSolvedQuestionsFromExerciseProblems({
        needed: questionCount - questions.length,
        exerciseProblems: remainingProblems,
      });
      questions = dedupeQuestionsByProblem([...questions, ...extraSolved], questionCount);
    }

    if (questions.length < questionCount) {
      const extraFromLoose = buildSolvedQuestionsFromExerciseProblems({
        needed: questionCount - questions.length,
        exerciseProblems: collectLooseMathProblemsFromPages(visiblePages, {
          limit: Math.max(questionCount * 8, 40),
        }),
      });
      questions = dedupeQuestionsByProblem([...questions, ...extraFromLoose], questionCount);
    }

    if (questions.length === 0) {
      return res.status(400).json({
        error: "Сонгосон хуудсуудаас бодлого дээр суурилсан асуулт үүсгэж чадсангүй. Бодлоготой хуудсаа сонгоод дахин оролдоно уу.",
      });
    }

    const finalVerifiedQuestions = [];
    for (const question of questions) {
      const verified = verifyQuestionAnswerAccuracy(question);
      if (verified) {
        finalVerifiedQuestions.push(verified);
      }
    }
    questions = dedupeQuestionsByProblem(finalVerifiedQuestions, questionCount);

    if (questions.length < questionCount) {
      const usedProblemKeys = new Set(
        questions
          .map((question) => normalizeQuestionProblemKey(question))
          .filter(Boolean),
      );
      const remainingProblems = selectedExerciseProblems.filter((item) => {
        const key = normalizeProblemKey(item?.text || "");
        return key && !usedProblemKeys.has(key);
      });
      const lateSolved = buildSolvedQuestionsFromExerciseProblems({
        needed: questionCount - questions.length,
        exerciseProblems: remainingProblems,
      });
      questions = dedupeQuestionsByProblem([...questions, ...lateSolved], questionCount);
    }

    questions = questions
      .filter((question) => String(question?.question || "").trim() === SOLVE_QUESTION_TEXT)
      .slice(0, questionCount);
    questions = assignDifficultyToQuestions({
      questions,
      counts: difficultyCounts,
      fallbackDifficulty: difficulty,
    });
    const openQuestions = buildOpenEndedTasks({
      exerciseProblems: selectedExerciseProblems,
      openQuestionCount,
      difficultyCounts,
      fallbackDifficulty: difficulty,
      totalScore,
    });

    if (questions.length === 0) {
      return res.status(400).json({
        error: "Бодлогуудын зөв/буруу хариуг баталгаажуулж чадсангүй. Илүү цэвэр бодлоготой хуудсаа сонгоно уу.",
      });
    }
    const warnings = [];
    if (topCleanStrict.length < Math.min(questionCount, 6)) {
      warnings.push(
        "OCR чанар бага тул зарим бодлогын мөр бүрэн цэвэр биш байж болно. Илүү цэвэр харагдуулахын тулд өөр visible pages сонгоно уу.",
      );
    }
    if (strictExerciseProblems.length === 0) {
      warnings.push(
        "Сонгосон хуудсанд цэвэр (a), б), в) хэлбэрийн дасгалын мөр цөөн тул ойролцоо бодлогын мөрүүдээр нөхөв.",
      );
    }
    if (openQuestionCount > openQuestions.length) {
      warnings.push(
        `Хүссэн ${openQuestionCount} задгай даалгавраас ${openQuestions.length}-ийг л бэлтгэж чадлаа.`,
      );
    }

    if (generation?.fallbackReason) warnings.push(generation.fallbackReason);
    if (generationTopUp?.fallbackReason) warnings.push(generationTopUp.fallbackReason);
    if (generation?.groundingDropped) {
      warnings.push(
        `AI эх текст дээр баталгаажихгүй ${generation.groundingDropped} асуултыг хассан.`,
      );
    }
    if (generationError) {
      const detail =
        generationError instanceof Error ? generationError.message : String(generationError || "");
      warnings.push(
        `AI service ажиллахгүй тул local fallback-р тест гаргалаа: ${detail}`,
      );
    }
    if (generationTopUpError) {
      const detail =
        generationTopUpError instanceof Error
          ? generationTopUpError.message
          : String(generationTopUpError || "");
      warnings.push(`Нэмэлт AI топ-ап ажиллахгүй тул үлдсэнийг local fallback-р нөхлөө: ${detail}`);
    }
    if (solvedTopUp.length > 0) {
      warnings.push(
        `Сонгосон дасгалын ${solvedTopUp.length} бодлогыг backend өөрөө бодож зөв хариутай асуулт болголоо.`,
      );
    }
    if (localTopUp.length > 0) {
      warnings.push(
        `AI-аас дутуу ирсэн ${localTopUp.length} асуултыг дасгалын бодлогоос local fallback-р нөхлөө.`,
      );
    }
    if (droppedByDuplicate > 0) {
      warnings.push(
        `Давхардсан ${droppedByDuplicate} бодлогын асуултыг автоматаар хаслаа.`,
      );
    }
    if (droppedByAccuracy > 0) {
      warnings.push(
        `Зөв хариуг баталгаажуулах боломжгүй ${droppedByAccuracy} асуултыг хасч, бодож баталгаажсан бодлогоор сольсон.`,
      );
    }
    if (
      mapped.length === 0
      && solvedTopUp.length === 0
      && localTopUp.length === 0
      && questions.length > 0
    ) {
      warnings.push(
        "AI болон стандарт fallback асуулт гаргаж чадаагүй тул бодож баталгаажсан бодлогоор fallback тест үүсгэлээ.",
      );
    }

    return res.json({
      bookId: book.id,
      source: sourceLabel,
      difficulty,
      difficultyCountsRequested: {
        easy: difficultyCounts.easy,
        medium: difficultyCounts.medium,
        hard: difficultyCounts.hard,
      },
      questionCountRequested: questionCount,
      questionCountGenerated: questions.length,
      openQuestionCountRequested: openQuestionCount,
      openQuestionCountGenerated: openQuestions.length,
      visiblePageNumbers: visibleNumbers,
      exerciseProblemCount: selectedExerciseProblems.length,
      questions: questions.map((question) => ({
        question: question.question,
        choices: question.choices,
        correctAnswer: question.correctAnswer,
        difficulty: normalizeDifficulty(question.difficulty || difficulty),
        explanation: question.explanation,
        sourcePages: Array.isArray(question.source_pages) ? question.source_pages : [],
        sourceExcerpt: String(question.source_excerpt || "").trim(),
        bookProblem: String(question.source_excerpt || question.question || "").trim(),
      })),
      openQuestions: openQuestions.map((item) => ({
        prompt: String(item.prompt || "").trim(),
        difficulty: normalizeDifficulty(item.difficulty || difficulty),
        score: parseNonNegativeInt(item.score, 0, 200),
        sourcePages: Array.isArray(item.sourcePages) ? item.sourcePages : [],
        sourceExcerpt: String(item.sourceExcerpt || "").trim(),
      })),
      warnings,
      meta: {
        providerRequested: generation?.providerRequested || process.env.LLM_PROVIDER || "auto",
        providerUsed: generation?.providerUsed || "local",
        modelRequested: generation?.modelRequested || process.env.OLLAMA_MODEL || "qwen2.5:0.5b",
        modelUsed: generation?.modelUsed || "local-fallback",
        modeUsed: generationModeUsed,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/generate-questions", async (req, res, next) => {
  try {
    const {
      answerKeyText: answerKeyTextRaw,
      bookId,
      endPage: endPageRaw,
      extraText: extraTextRaw,
      fillMode: fillModeRaw,
      mode: modeRaw,
      pageNumbers: pageNumbersRaw,
      pageText: pageTextRaw,
      questionCount: questionCountRaw,
      startPage: startPageRaw,
    } = req.body || {};

    const hasPageText = typeof pageTextRaw === "string" && pageTextRaw.trim();
    const safeBookId = typeof bookId === "string" ? bookId : "";

    if (!safeBookId && !hasPageText) {
      return res.status(400).json({
        error: "`bookId` эсвэл `pageText` (сонгосон текст) шаардлагатай.",
      });
    }

    const book = safeBookId ? getBookById(safeBookId) : null;
    if (safeBookId && !book) {
      return res.status(404).json({ error: "Ном олдсонгүй. Дахин upload хийнэ үү." });
    }

    const totalPages = book?.pages?.length || 0;
    const pageNumbersProvided = Array.isArray(pageNumbersRaw);
    const parsedPageNumbers = parsePageNumbers(pageNumbersRaw, totalPages);

    const startPage = parsePageNumber(startPageRaw, 1);
    const endPage = parsePageNumber(endPageRaw, totalPages || startPage);
    const questionCount = Math.min(
      30,
      Math.max(1, Math.trunc(Number(questionCountRaw || 20))),
    );

    if (book) {
      if (pageNumbersProvided && parsedPageNumbers.length === 0) {
        return res.status(400).json({
          error:
            "`pageNumbers` массив хоосон байна эсвэл буруу байна. Жишээ: [1,2,5] (номын pageCount дотор байх ёстой).",
        });
      }
      if (parsedPageNumbers.length === 0) {
        if (startPage > endPage) {
          return res.status(400).json({ error: "`startPage` нь `endPage`-аас бага байх ёстой." });
        }

        if (startPage < 1 || endPage > book.pages.length) {
          return res.status(400).json({
            error: `Хуудасны сонголт буруу байна. Энэ ном ${book.pages.length} хуудастай.`,
          });
        }
      } else if (parsedPageNumbers.some((p) => p < 1 || p > book.pages.length)) {
        return res.status(400).json({
          error: `pageNumbers буруу байна. Энэ ном ${book.pages.length} хуудастай.`,
        });
      }
    }

    const sourceParts = [];

    if (book) {
      const selectedPages =
        parsedPageNumbers.length > 0
          ? book.pages.filter((page) => parsedPageNumbers.includes(page.pageNumber))
          : book.pages.slice(startPage - 1, endPage);
      sourceParts.push(
        selectedPages.map((page) => `[Page ${page.pageNumber}] ${cleanAnalysisPageText(page.text)}`).join("\n\n"),
      );
    }

    if (hasPageText) {
      sourceParts.push(String(pageTextRaw || "").trim());
    }

    if (typeof extraTextRaw === "string" && extraTextRaw.trim()) {
      sourceParts.push(String(extraTextRaw || "").trim());
    }

    const sourceText = sourceParts
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join("\n\n");

    const answerKeyTextExplicit = typeof answerKeyTextRaw === "string" ? answerKeyTextRaw.trim() : "";
    const answerKeyText =
      answerKeyTextExplicit
      || (book
        ? parsedPageNumbers.length > 0
          ? buildAnswerKeyTextFromSelection({ book, pageNumbers: parsedPageNumbers, maxPages: 90 })
          : buildAnswerKeyText({ book, startPage, endPage, maxPages: 90 })
        : "");

    if (sourceText.replace(/\s+/g, "").length < 120) {
      return res.status(400).json({
        error:
          "Сонгосон page range дээр хангалттай текст алга байна. Илүү олон хуудас сонгоно уу.",
      });
    }

    const requestedMode = String(modeRaw || "").trim().toLowerCase();
    if (requestedMode && requestedMode !== "extract") {
      return res.status(400).json({
        error:
          "AI-аар шинэ асуулт үүсгэх горим (generate) идэвхгүй. Зөвхөн номын текстээс шууд авах (extract) горим ашиглана уу.",
      });
    }

    const generationMode = "extract";
    const fillMode = String(fillModeRaw || "").trim().toLowerCase();
    const allowedFillModes = new Set(["", "strict", "off", "cloze"]);
    const normalizedFillMode = allowedFillModes.has(fillMode) ? fillMode : "";

    const generation = await generateBookQuestions({
      baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
      answerKeyText,
      fillMode: normalizedFillMode || undefined,
      geminiApiKey: process.env.GEMINI_API_KEY,
      geminiBaseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com",
      geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      model: process.env.OLLAMA_MODEL || "qwen2.5:0.5b",
      mode: generationMode,
      pageText: sourceText,
      provider: process.env.LLM_PROVIDER || "auto",
      questionCount,
      timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 180000),
    });
    const questions = (generation.questions || []).map(withCorrectChoiceText);

    const warnings = [];
    if (generation.fallbackReason) {
      warnings.push(generation.fallbackReason);
    } else if (
      generation.providerUsed !== "local"
      && generation.modelUsed !== generation.modelRequested
    ) {
      warnings.push(
        `${providerLabel(generation.providerUsed)} дээр "${generation.modelRequested}" model олдсонгүй. "${generation.modelUsed}" model ашиглаж асуулт үүсгэлээ.`,
      );
    }

    if (generation.segmentsUsed > 1) {
      warnings.push("Сонгосон текст хэт урт байсан тул 2 хэсэгт хувааж асуулт үүсгэлээ.");
    }

    if (generation.groundingDropped) {
      warnings.push(
        `AI эх текстээсээ яг ишлэл (source_excerpt) авалгүй асуулт өгсөн ${generation.groundingDropped} хувилбарыг хаслаа.`,
      );
    }

    if (questions.length < questionCount) {
      warnings.push(
        `AI ${questionCount}-аас ${questions.length} асуулт л гаргалаа. (Текст хангалтгүй эсвэл давхардал ихтэй байж болно.)`,
      );
    }

    return res.json({
      ...(book ? { bookId: book.id } : {}),
      ...(book
        ? parsedPageNumbers.length > 0
          ? { pageNumbers: parsedPageNumbers, startPage: parsedPageNumbers[0], endPage: parsedPageNumbers[parsedPageNumbers.length - 1] }
          : { startPage, endPage }
        : {}),
      mode: generationMode,
      fillModeUsed: generation.fillModeUsed || "strict",
      answerKeyPagesFound: Array.isArray(generation.answerKeyPagesFound)
        ? generation.answerKeyPagesFound
        : [],
      providerRequested: generation.providerRequested,
      providerUsed: generation.providerUsed,
      modelRequested: generation.modelRequested,
      modelUsed: generation.modelUsed,
      questionCountRequested: questionCount,
      questionCountGenerated: questions.length,
      groundingDropped: generation.groundingDropped || 0,
      questions,
      rawMatches: Array.isArray(generation.rawMatches) ? generation.rawMatches : [],
      warnings,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = {
  booksRouter: router,
};
