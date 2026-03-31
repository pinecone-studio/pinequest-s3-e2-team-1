import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function resolveApiBase() {
  const configured = String(import.meta.env.VITE_BOOK_API_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (import.meta.env.DEV) return "";
  return "";
}

function toApiUrl(path, apiBase = "") {
  const base = String(apiBase || "").trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}

function buildPdfFileUrl({ bookId, apiBase = "" }) {
  const safeBookId = encodeURIComponent(String(bookId || "").trim());
  return toApiUrl(`/api/books/${safeBookId}/file`, apiBase);
}

function buildPdfPageImageUrl({ bookId, pageNumber, apiBase = "" }) {
  const safeBookId = encodeURIComponent(String(bookId || "").trim());
  const safePage = Math.max(1, Math.trunc(Number(pageNumber) || 1));
  return toApiUrl(`/api/books/${safeBookId}/pages/${safePage}/image`, apiBase);
}

function buildPdfPagePreviewUrl({ fileUrl, pageNumber }) {
  const safeFileUrl = String(fileUrl || "").trim();
  if (!safeFileUrl) return "";
  const page = Math.max(1, Math.trunc(Number(pageNumber) || 1));
  return `${safeFileUrl}#page=${page}&view=FitH&toolbar=0&navpanes=0&scrollbar=0`;
}

function defaultLocalBackendBase() {
  if (typeof window === "undefined") return "http://127.0.0.1:4000";
  const host = window.location.hostname || "127.0.0.1";
  const proto = window.location.protocol || "http:";
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const resolvedProto = proto === "https:" && isLocalHost ? "http:" : proto;
  return `${resolvedProto}//${host}:4000`;
}

function candidateBackendBases() {
  const out = [];
  for (let port = 4000; port <= 4010; port += 1) {
    out.push(`http://127.0.0.1:${port}`);
    out.push(`http://localhost:${port}`);
  }
  return ["", defaultLocalBackendBase(), ...out]
    .map((item) => String(item || "").trim().replace(/\/+$/, ""))
    .filter((item, idx, arr) => item !== "" ? arr.indexOf(item) === idx : idx === 0);
}

async function requestJson(path, options = {}) {
  const apiBase = typeof options?.apiBase === "string" ? options.apiBase : "";
  const url = toApiUrl(path, apiBase);
  const { apiBase: _ignore, ...fetchOptions } = options || {};

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || "");
    throw new Error(`Backend рүү холбогдож чадсангүй. (URL: ${url}) ${detail}`.trim(), { cause: error });
  }

  if (!response.ok) {
    let bodyText = "";
    let bodyError = "";
    try {
      bodyText = await response.text();
      try {
        const parsed = JSON.parse(bodyText);
        bodyError = String(parsed?.error || "").trim();
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
    const message = bodyError || bodyText || `HTTP ${response.status}`;
    throw new Error(`${message} (URL: ${response.url || url})`);
  }

  return response.json();
}

function clampQuestionCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 10;
  return Math.min(30, Math.max(10, Math.trunc(n)));
}

function clampNonNegativeInt(value, fallback = 0, max = 200) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(n)));
}

function extractChoiceToken(choiceText, fallbackIdx) {
  const raw = String(choiceText || "").trim();
  const matched = raw.match(/^([A-D])[\).:\-\s]+(.+)$/i);
  if (matched) {
    return {
      label: String(matched[1] || "").toUpperCase(),
      body: String(matched[2] || "").trim(),
    };
  }
  const labels = ["A", "B", "C", "D"];
  return {
    label: labels[fallbackIdx] || "A",
    body: raw,
  };
}

function normalizeMathExpression(value) {
  return String(value || "")
    .replace(/×/g, "\\times ")
    .replace(/[·∙•]/g, "\\cdot ")
    .replace(/÷/g, "\\div ")
    .replace(/:/g, "\\colon ")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ")
    .replace(/≈/g, "\\approx ")
    .replace(/π/g, "\\pi ")
    .replace(/∞/g, "\\infty ")
    .trim();
}

function normalizeFractions(value) {
  return String(value || "").replace(
    /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/g,
    (_m, a, b) => `\\frac{${String(a).replace(",", ".")}}{${String(b).replace(",", ".")}}`,
  );
}

function normalizeSqrt(value) {
  return String(value || "")
    .replace(/sqrt\s*\(\s*([^)]+?)\s*\)/gi, "\\sqrt{$1}")
    .replace(/√\s*\(\s*([^)]+?)\s*\)/g, "\\sqrt{$1}")
    .replace(/√\s*([A-Za-z0-9]+(?:[.,]\d+)?)/g, "\\sqrt{$1}");
}

function tryRenderKatex(mathText, displayMode = false) {
  const normalized = normalizeSqrt(normalizeFractions(normalizeMathExpression(mathText)));
  if (!normalized) return "";
  try {
    return katex.renderToString(normalized, {
      displayMode,
      strict: "ignore",
      throwOnError: false,
      trust: false,
    });
  } catch {
    return "";
  }
}

function renderLatex(latex, displayMode = false) {
  const source = String(latex || "").trim();
  if (!source) return "";
  try {
    return katex.renderToString(source, {
      displayMode,
      strict: "ignore",
      throwOnError: false,
      trust: false,
    });
  } catch {
    return "";
  }
}

function parseMathSegments(value) {
  const source = String(value || "");
  const out = [];
  const regex =
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+)\$|\\\(([\s\S]+?)\\\)/g;
  let lastIndex = 0;
  let matched = regex.exec(source);
  while (matched) {
    if (matched.index > lastIndex) {
      out.push({
        type: "text",
        value: source.slice(lastIndex, matched.index),
      });
    }
    out.push({
      type: "math",
      display: Boolean(matched[1] || matched[2]),
      value: matched[1] || matched[2] || matched[3] || matched[4] || "",
    });
    lastIndex = regex.lastIndex;
    matched = regex.exec(source);
  }
  if (lastIndex < source.length) {
    out.push({
      type: "text",
      value: source.slice(lastIndex),
    });
  }
  return out;
}

const SUPERSCRIPT_TO_DIGIT = {
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
};

function superscriptToDigits(value) {
  return String(value || "")
    .split("")
    .map((char) => SUPERSCRIPT_TO_DIGIT[char] || "")
    .join("");
}

function splitExerciseLabel(value) {
  const raw = String(value || "").trim();
  const matched = raw.match(/^((?:\d{1,3}|[A-Za-zА-Яа-яЁёӨөҮүҢңӘә]))\)\s*(.+)$/u);
  if (!matched) {
    return {
      label: "",
      body: raw,
    };
  }
  return {
    label: `${matched[1]})`,
    body: String(matched[2] || "").trim(),
  };
}

function convertAbsoluteBars(value) {
  const src = String(value || "");
  const totalBars = (src.match(/\|/g) || []).length;
  if (totalBars < 2 || totalBars % 2 !== 0) return src;

  let opened = false;
  let out = "";
  for (const ch of src) {
    if (ch === "|") {
      out += opened ? "\\right|" : "\\left|";
      opened = !opened;
    } else {
      out += ch;
    }
  }
  return opened ? src : out;
}

function normalizePlainProblemToLatex(value) {
  let text = String(value || "").trim();
  if (!text) return "";

  text = text
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/×/g, "\\times ")
    .replace(/[·∙•]/g, "\\cdot ")
    .replace(/÷/g, "\\div ")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ")
    .replace(/≈/g, "\\approx ")
    .replace(/π/g, "\\pi ")
    .replace(/∞/g, "\\infty ")
    .replace(/([0-9])\s*°/g, "$1^{\\circ}")
    .replace(
      /([²³⁴⁵⁶⁷⁸⁹])\s*√\s*([A-Za-z0-9().,+\-]+)/g,
      (_match, degree, radicand) => `\\sqrt[${superscriptToDigits(degree)}]{${radicand}}`,
    )
    .replace(/√\s*\(\s*([^)]+)\s*\)/g, "\\sqrt{$1}")
    .replace(/√\s*([A-Za-z0-9().,+\-]+)/g, "\\sqrt{$1}")
    .replace(/(?<!\\)\bsin\b/gi, "\\sin")
    .replace(/(?<!\\)\bcos\b/gi, "\\cos")
    .replace(/(?<!\\)\btan\b/gi, "\\tan")
    .replace(/(?<!\\)\blog\b/gi, "\\log")
    .replace(/(?<!\\)\bln\b/gi, "\\ln");

  text = text.replace(/([A-Za-z0-9\])}])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_match, base, exponent) => {
    const exp = superscriptToDigits(exponent);
    return exp ? `${base}^{${exp}}` : _match;
  });

  text = convertAbsoluteBars(text);
  return normalizeSqrt(normalizeFractions(text)).replace(/\s+/g, " ").trim();
}

function looksMathyProblemText(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 220) return false;
  if (/[?？]$/.test(text) && text.length > 120) return false;

  const hasStrongMath = /[=+\-*/^|√≤≥≈×÷]|(sin|cos|tan|log|ln)|[²³⁴⁵⁶⁷⁸⁹]/i.test(text);
  if (!hasStrongMath) return false;

  const hasLongMongolianPhrase = /[А-Яа-яЁёӨөҮүҢңӘә]{3,}\s+[А-Яа-яЁёӨөҮүҢңӘә]{3,}/u.test(text);
  if (hasLongMongolianPhrase && text.length > 60) return false;

  const longWordCount = (text.match(/[\p{L}]{2,}/gu) || []).length;
  if (longWordCount >= 10 && text.length > 80) return false;

  return true;
}

function tryRenderProblemAsKatex(text) {
  const raw = String(text || "").trim();
  if (!raw || !looksMathyProblemText(raw)) return null;

  const { label, body } = splitExerciseLabel(raw);
  const source = body || raw;
  const latex = normalizePlainProblemToLatex(source);
  if (!latex) return null;
  if (!/[=+\-*/^]|\\(sqrt|sin|cos|tan|log|ln|left\||frac|times|div|le|ge|ne|approx)/.test(latex)) {
    return null;
  }
  const html = renderLatex(latex, false);
  if (!html) return null;
  return {
    html,
    label,
  };
}

function MathText({ text }) {
  const segments = parseMathSegments(text);
  if (!segments.some((segment) => segment.type === "math")) {
    const auto = tryRenderProblemAsKatex(text);
    if (auto) {
      return (
        <span>
          {auto.label ? <span>{auto.label} </span> : null}
          <span className="math-inline" dangerouslySetInnerHTML={{ __html: auto.html }} />
        </span>
      );
    }
    return <span>{String(text || "")}</span>;
  }

  return (
    <span>
      {segments.map((segment, idx) => {
        if (segment.type === "text") {
          return <span key={`t-${idx}`}>{segment.value}</span>;
        }
        const html = tryRenderKatex(segment.value, segment.display);
        if (!html) {
          return <span key={`m-${idx}`}>{segment.value}</span>;
        }
        return (
          <span
            key={`m-${idx}`}
            className={segment.display ? "math-block" : "math-inline"}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}

function formatDate(value) {
  const time = Date.parse(value || "");
  if (Number.isNaN(time)) return "-";
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function pickPreferredSectionId(sections) {
  const list = Array.isArray(sections) ? sections : [];
  if (!list.length) return "";

  const keywords = /(дасгал|жишээ|бодлого|модул|тэгшитгэл|тэнцэтгэл|логарифм|функц)/iu;
  const candidate = list.find((section) => {
    const title = String(section?.title || "");
    const startPage = Number(section?.startPage || 0);
    return keywords.test(title) && startPage >= 5;
  });
  if (candidate?.id) return candidate.id;

  const nonCover = list.find((section) => Number(section?.startPage || 0) >= 5);
  if (nonCover?.id) return nonCover.id;

  return String(list[0]?.id || "");
}

function makeChapterKey(chapter, chapterIdx) {
  const title = String(chapter?.title || "").trim() || `Chapter ${chapterIdx + 1}`;
  return `${chapterIdx}:${title}`;
}

function normalizeLineText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[|]/g, " ")
    .trim();
}

function cleanTocHeading(raw) {
  const source = normalizeLineText(raw)
    .replace(/\s+\d{1,3}\s*$/g, "")
    .replace(/\s*[+_=\\/]{2,}\s*/g, " ")
    .split(/\.{3,}/)[0]
    .trim();

  const tokens = source
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => {
      const letters = token.replace(/[^\p{L}]/gu, "");
      if (!letters) return true;
      if (/^([A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\1{3,}$/u.test(letters)) return false;
      if (/^[иИөӨүҮнН]{4,}$/u.test(letters)) return false;
      return true;
    });

  return tokens.slice(0, 12).join(" ").trim();
}

function extractSectionNumber(rawTitle) {
  const source = normalizeLineText(rawTitle);
  const matched = source.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{1,2}))?\s*[).:\-–—]?\s*(.+)?/u);
  if (!matched) return null;
  const major = Math.max(1, Math.trunc(Number(matched[1] || 0)));
  const minor = Math.max(1, Math.trunc(Number(matched[2] || 0)));
  const sub = matched[3] ? Math.max(1, Math.trunc(Number(matched[3]))) : null;
  const tail = cleanTocHeading(matched[4] || "");
  return {
    major,
    minor,
    sub,
    key: `${major}.${minor}`,
    label: sub ? `${major}.${minor}.${sub}` : `${major}.${minor}`,
    tail,
  };
}

function extractChapterName(rawTitle) {
  const source = normalizeLineText(rawTitle);
  const matched = source.match(/(?:^|[\s.,;:])(?:[IVXА-ЯЁӨҮҮУШТЛП]{1,4}\s+)?Б[ҮУ]?ЛЭГ[.,]?\s*(.+)$/iu);
  const suffix = matched ? matched[1] : source;
  const trimmed = suffix
    .replace(/Энэ\s+б[үу]?лэг[\s\S]*$/iu, "")
    .replace(/\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s*[).:\-–—]?.*$/u, "")
    .replace(/^[\s,.;:]+/g, "")
    .trim();
  return cleanTocHeading(trimmed);
}

function extractTocTitlesFromPages(pages) {
  const sourcePages = Array.isArray(pages) ? pages : [];
  const tocTexts = sourcePages
    .map((page) => normalizeLineText(page?.text || ""))
    .filter((text) => {
      if (!text) return false;
      if (/ГАРЧИГ/iu.test(text)) return true;
      const sectionCount = (text.match(/\d{1,2}\.\d{1,2}\./g) || []).length;
      const chapterCount = (text.match(/Б[ҮУ]?ЛЭГ/giu) || []).length;
      return sectionCount >= 4 && chapterCount >= 1;
    });

  if (!tocTexts.length) {
    return {
      chapterByMajor: {},
      sectionByKey: {},
      sectionTitlesByMajor: {},
    };
  }

  const joined = tocTexts.join("\n");
  const sectionEntries = [];
  const sectionRe =
    /(\d{1,2})\.(\d{1,2})\.\s*([\s\S]*?)(?=(?:\d{1,2}\.\d{1,2}\.\s*)|(?:[IVXА-ЯЁӨҮҮУШТЛП]{1,4}\s+Б[ҮУ]?ЛЭГ)|$)/giu;
  let sectionMatch = sectionRe.exec(joined);
  while (sectionMatch) {
    const major = Math.max(1, Math.trunc(Number(sectionMatch[1] || 0)));
    const minor = Math.max(1, Math.trunc(Number(sectionMatch[2] || 0)));
    const key = `${major}.${minor}`;
    const cleanedTitle = cleanTocHeading(sectionMatch[3] || "");
    if (cleanedTitle) {
      sectionEntries.push({
        index: sectionMatch.index,
        major,
        minor,
        key,
        title: cleanedTitle,
      });
    }
    sectionMatch = sectionRe.exec(joined);
  }

  const chapterByMajor = {};
  const chapterRe =
    /([IVXА-ЯЁӨҮҮУШТЛП]{1,4})\s+Б[ҮУ]?ЛЭГ[.,]?\s*([\s\S]*?)(?=(?:\d{1,2}\.\d{1,2}\.\s*)|$)/giu;
  let chapterMatch = chapterRe.exec(joined);
  while (chapterMatch) {
    const chapterName = cleanTocHeading(chapterMatch[2] || "");
    if (chapterName) {
      const nextSection = sectionEntries.find((entry) => entry.index > chapterMatch.index);
      if (nextSection && !chapterByMajor[nextSection.major]) {
        chapterByMajor[nextSection.major] = chapterName;
      }
    }
    chapterMatch = chapterRe.exec(joined);
  }

  const sectionByKey = {};
  const sectionTitlesByMajor = {};
  for (const sectionEntry of sectionEntries) {
    if (!sectionByKey[sectionEntry.key]) {
      sectionByKey[sectionEntry.key] = sectionEntry.title;
    }
    if (!sectionTitlesByMajor[sectionEntry.major]) {
      sectionTitlesByMajor[sectionEntry.major] = [];
    }
    const hasMinor = sectionTitlesByMajor[sectionEntry.major].some(
      (item) => item.minor === Number(sectionEntry.minor || 0),
    );
    if (!hasMinor) {
      sectionTitlesByMajor[sectionEntry.major].push({
        minor: Number(sectionEntry.minor || 0),
        title: sectionEntry.title,
      });
    }
  }

  for (const key of Object.keys(sectionTitlesByMajor)) {
    sectionTitlesByMajor[key].sort((a, b) => Number(a?.minor || 0) - Number(b?.minor || 0));
  }

  return { chapterByMajor, sectionByKey, sectionTitlesByMajor };
}

function getChapterNumber(chapter, chapterIdx) {
  const sections = Array.isArray(chapter?.sections) ? chapter.sections : [];
  const votes = new Map();
  for (const section of sections) {
    const parsed = extractSectionNumber(section?.title || "");
    if (!parsed) continue;
    const major = Number(parsed.major || 0);
    const minor = Number(parsed.minor || 0);
    if (major < 1 || major > 15) continue;
    if (minor < 1 || minor > 20) continue;
    votes.set(major, Number(votes.get(major) || 0) + 1);
  }
  let bestMajor = 0;
  let bestScore = 0;
  for (const [major, score] of votes.entries()) {
    if (score > bestScore) {
      bestMajor = major;
      bestScore = score;
    }
  }
  if (bestMajor > 0) {
    return bestMajor;
  }
  return chapterIdx + 1;
}

function shortenTitle(value, maxLength = 84) {
  const cleaned = normalizeLineText(value);
  if (!cleaned) return "";
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3).trimEnd()}...`;
}

function getChapterDisplayTitle(chapter, chapterIdx, tocLabels) {
  const chapterNumber = getChapterNumber(chapter, chapterIdx);
  const chapterByMajor = tocLabels && typeof tocLabels === "object" ? tocLabels.chapterByMajor || {} : {};
  const tocTitle = chapterByMajor[chapterNumber];
  const rawTitle = extractChapterName(chapter?.title || "");
  const title = shortenTitle(tocTitle || rawTitle || "БҮЛЭГ", 96);
  return `${chapterNumber}. ${title}`;
}

function getSectionDisplayTitle(section, sectionIdx, chapterNumber, tocLabels) {
  const parsed = extractSectionNumber(section?.title || "");
  const sectionTitlesByMajor =
    tocLabels && typeof tocLabels === "object" ? tocLabels.sectionTitlesByMajor || {} : {};
  const sectionByKey = tocLabels && typeof tocLabels === "object" ? tocLabels.sectionByKey || {} : {};
  const tocOrdered = Array.isArray(sectionTitlesByMajor[chapterNumber])
    ? sectionTitlesByMajor[chapterNumber]
    : [];
  const tocByIndex = tocOrdered[sectionIdx] || null;

  const parsedMajor = Number(parsed?.major || 0);
  const parsedMinor = Number(parsed?.minor || 0);
  const isPlausibleParsed =
    parsed && parsedMajor === chapterNumber && parsedMinor >= 1 && parsedMinor <= 40;

  const numberLabel = tocByIndex?.minor
    ? `${chapterNumber}.${tocByIndex.minor}`
    : isPlausibleParsed
      ? parsed.label
      : `${chapterNumber}.${sectionIdx + 1}`;
  const tocTitle = tocByIndex?.title || (isPlausibleParsed && parsed?.key ? sectionByKey[parsed.key] : "");
  const rawTitle = isPlausibleParsed && parsed?.tail ? parsed.tail : cleanTocHeading(section?.title || "");
  const title = shortenTitle(tocTitle || rawTitle || "Сэдэв", 98);
  return `${numberLabel} ${title}`.trim();
}

export default function App() {
  const [apiBaseOverride, setApiBaseOverride] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem("book_api_base") || "";
    } catch {
      return "";
    }
  });
  const apiBase = useMemo(() => {
    const override = String(apiBaseOverride || "").trim();
    if (override) {
      const lowered = override.toLowerCase();
      if (lowered === "same-origin" || lowered === "proxy") return "";
      return override.replace(/\/+$/, "");
    }
    return resolveApiBase();
  }, [apiBaseOverride]);

  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [structure, setStructure] = useState({ chapters: [], sections: [] });
  const [tocLabels, setTocLabels] = useState({
    chapterByMajor: {},
    sectionByKey: {},
    sectionTitlesByMajor: {},
  });
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [allTopicsMode, setAllTopicsMode] = useState(false);
  const [expandedChapterKeys, setExpandedChapterKeys] = useState([]);
  const windowSize = 3;
  const [sectionWindow, setSectionWindow] = useState(null);
  const [loadingSection, setLoadingSection] = useState(false);
  const [failedPageImages, setFailedPageImages] = useState({});

  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [difficultyCounts, setDifficultyCounts] = useState({
    easy: 0,
    medium: 0,
    hard: 0,
  });
  const [openQuestionCount, setOpenQuestionCount] = useState(0);
  const [totalScore, setTotalScore] = useState(100);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showExplanations, setShowExplanations] = useState(true);

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) || null,
    [books, selectedBookId],
  );
  const selectedSection = useMemo(
    () => structure.sections.find((section) => section.id === selectedSectionId) || null,
    [structure.sections, selectedSectionId],
  );
  const selectedChapterInfo = useMemo(() => {
    const chapters = Array.isArray(structure.chapters) ? structure.chapters : [];
    for (let chapterIdx = 0; chapterIdx < chapters.length; chapterIdx += 1) {
      const chapter = chapters[chapterIdx];
      const chapterSections = Array.isArray(chapter?.sections) ? chapter.sections : [];
      if (chapterSections.some((section) => section.id === selectedSectionId)) {
        return {
          chapter,
          chapterIdx,
          key: makeChapterKey(chapter, chapterIdx),
        };
      }
    }
    return null;
  }, [structure.chapters, selectedSectionId]);
  const selectedChapter = selectedChapterInfo?.chapter || structure.chapters[0] || null;
  const selectedChapterSections = useMemo(
    () => (Array.isArray(selectedChapter?.sections) ? selectedChapter.sections : []),
    [selectedChapter],
  );
  const chapterKeys = useMemo(
    () =>
      (Array.isArray(structure.chapters) ? structure.chapters : []).map((chapter, chapterIdx) =>
        makeChapterKey(chapter, chapterIdx),
      ),
    [structure.chapters],
  );
  const selectedChapterNumber = useMemo(
    () =>
      selectedChapterInfo
        ? getChapterNumber(selectedChapterInfo.chapter, selectedChapterInfo.chapterIdx)
        : getChapterNumber(structure.chapters[0] || null, 0),
    [selectedChapterInfo, structure.chapters],
  );
  const selectedSectionIndexInChapter = useMemo(() => {
    if (!selectedSectionId) return -1;
    return selectedChapterSections.findIndex((section) => String(section?.id || "") === selectedSectionId);
  }, [selectedChapterSections, selectedSectionId]);
  const selectedSectionDisplayTitle = useMemo(() => {
    if (!selectedSection) return "";
    return getSectionDisplayTitle(
      selectedSection,
      selectedSectionIndexInChapter >= 0 ? selectedSectionIndexInChapter : 0,
      selectedChapterNumber,
      tocLabels,
    );
  }, [selectedSection, selectedSectionIndexInChapter, selectedChapterNumber, tocLabels]);
  const selectedSectionIdSet = useMemo(
    () => new Set((Array.isArray(selectedSectionIds) ? selectedSectionIds : []).filter(Boolean)),
    [selectedSectionIds],
  );
  const difficultyTotalRequested = useMemo(
    () =>
      clampNonNegativeInt(difficultyCounts.easy)
      + clampNonNegativeInt(difficultyCounts.medium)
      + clampNonNegativeInt(difficultyCounts.hard),
    [difficultyCounts.easy, difficultyCounts.medium, difficultyCounts.hard],
  );
  const resolvedQuestionCount = useMemo(
    () => (difficultyTotalRequested > 0 ? difficultyTotalRequested : clampQuestionCount(questionCount)),
    [difficultyTotalRequested, questionCount],
  );

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("book_api_base", String(apiBaseOverride || ""));
      }
    } catch {
      // ignore
    }
  }, [apiBaseOverride]);

  async function requestWithFallback(path, options = {}) {
    try {
      return await requestJson(path, { ...options, apiBase });
    } catch (error) {
      if (apiBase !== "") throw error;
      const candidates = candidateBackendBases().filter(Boolean);
      for (const candidate of candidates) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await requestJson("/health", { apiBase: candidate });
          setApiBaseOverride(candidate);
          // eslint-disable-next-line no-await-in-loop
          return await requestJson(path, { ...options, apiBase: candidate });
        } catch {
          // try next
        }
      }
      throw error;
    }
  }

  async function loadHealth() {
    try {
      const payload = await requestWithFallback("/health");
      setHealth(payload);
      setHealthError("");
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : "Health check алдаа");
    }
  }

  async function loadBooks(preferredBookId = "") {
    setIsRefreshing(true);
    try {
      const payload = await requestWithFallback("/api/books");
      const items = Array.isArray(payload?.books) ? payload.books : [];
      setBooks(items);
      if (!items.length) {
        setSelectedBookId("");
        setStructure({ chapters: [], sections: [] });
        setTocLabels({ chapterByMajor: {}, sectionByKey: {}, sectionTitlesByMajor: {} });
        setAllTopicsMode(false);
        setSelectedSectionId("");
        setSelectedSectionIds([]);
        setSectionWindow(null);
        return;
      }

      const nextBookId =
        preferredBookId && items.some((book) => book.id === preferredBookId)
          ? preferredBookId
          : selectedBookId && items.some((book) => book.id === selectedBookId)
            ? selectedBookId
            : items[0].id;
      setSelectedBookId(nextBookId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Номын жагсаалт уншиж чадсангүй.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function loadStructure(bookId) {
    if (!bookId) return;
    try {
      const payload = await requestWithFallback(`/api/books/${bookId}/structure`);
      const chapters = Array.isArray(payload?.chapters) ? payload.chapters : [];
      const sections = Array.isArray(payload?.sections) ? payload.sections : [];
      setStructure({ chapters, sections });
      if (sections.length > 0) {
        const nextSectionId =
          selectedSectionId && sections.some((section) => section.id === selectedSectionId)
            ? selectedSectionId
            : pickPreferredSectionId(sections);
        setSelectedSectionId(nextSectionId);
        setSelectedSectionIds(nextSectionId ? [nextSectionId] : []);
      } else {
        setAllTopicsMode(false);
        setSelectedSectionId("");
        setSelectedSectionIds([]);
        setSectionWindow(null);
      }
    } catch (error) {
      setStructure({ chapters: [], sections: [] });
      setErrorMessage(error instanceof Error ? error.message : "Structure уншиж чадсангүй.");
    }
  }

  async function loadTocLabels(bookId) {
    if (!bookId) {
      setTocLabels({ chapterByMajor: {}, sectionByKey: {}, sectionTitlesByMajor: {} });
      return;
    }
    try {
      const payload = await requestWithFallback(`/api/books/${bookId}?includeText=1`);
      const pages = Array.isArray(payload?.pages) ? payload.pages : [];
      setTocLabels(extractTocTitlesFromPages(pages));
    } catch {
      setTocLabels({ chapterByMajor: {}, sectionByKey: {}, sectionTitlesByMajor: {} });
    }
  }

  async function loadSectionWindow({ bookId, sectionId, offset = 0, nextWindowSize = windowSize }) {
    if (!bookId || !sectionId) return;
    setLoadingSection(true);
    setErrorMessage("");
    try {
      const payload = await requestWithFallback(
        `/api/books/${bookId}/sections/${sectionId}?offset=${offset}&windowSize=${nextWindowSize}`,
      );
      setSectionWindow(payload);
      setStatusMessage(
        `Section content ачааллаа: ${payload.visiblePageNumbers?.join(", ") || "-"}`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Section content уншиж чадсангүй.");
    } finally {
      setLoadingSection(false);
    }
  }

  useEffect(() => {
    void loadHealth();
    void loadBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  useEffect(() => {
    if (!selectedBookId) {
      setTocLabels({ chapterByMajor: {}, sectionByKey: {}, sectionTitlesByMajor: {} });
      return;
    }
    void loadStructure(selectedBookId);
    void loadTocLabels(selectedBookId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookId]);

  useEffect(() => {
    if (!selectedBookId || !selectedSectionId) return;
    void loadSectionWindow({ bookId: selectedBookId, sectionId: selectedSectionId, offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookId, selectedSectionId, windowSize]);

  useEffect(() => {
    setFailedPageImages({});
  }, [selectedBookId, selectedSectionId, sectionWindow?.offset]);

  useEffect(() => {
    const availableIds = new Set(
      (Array.isArray(structure.sections) ? structure.sections : [])
        .map((section) => String(section?.id || ""))
        .filter(Boolean),
    );
    setSelectedSectionIds((prev) => {
      const filtered = (Array.isArray(prev) ? prev : []).filter((id) => availableIds.has(id));
      if (filtered.length) return filtered;
      return selectedSectionId && availableIds.has(selectedSectionId) ? [selectedSectionId] : [];
    });
  }, [structure.sections, selectedSectionId]);

  useEffect(() => {
    const chapters = Array.isArray(structure.chapters) ? structure.chapters : [];
    if (!chapters.length) {
      setExpandedChapterKeys([]);
      return;
    }

    const selectedKey = String(selectedChapterInfo?.key || "");
    setExpandedChapterKeys((prev) => {
      const availableKeys = chapters.map((chapter, chapterIdx) => makeChapterKey(chapter, chapterIdx));
      const filtered = (Array.isArray(prev) ? prev : []).filter((key) => availableKeys.includes(key));
      if (selectedKey) {
        return filtered.includes(selectedKey) ? filtered : [...filtered, selectedKey];
      }
      if (filtered.length > 0) return filtered;
      return [makeChapterKey(chapters[0], 0)];
    });
  }, [structure.chapters, selectedChapterInfo?.key]);

  async function handleUpload(event) {
    event.preventDefault();
    if (!selectedFile) {
      setErrorMessage("PDF файлаа сонгоно уу.");
      return;
    }
    setIsUploading(true);
    setErrorMessage("");
    setStatusMessage("PDF upload + OCR хийж байна...");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const payload = await requestWithFallback("/api/books/upload", {
        method: "POST",
        body: form,
      });
      await loadBooks(payload.bookId);
      setSelectedFile(null);
      setStatusMessage(`Амжилттай upload: ${payload.title}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload алдаа.");
      setStatusMessage("");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleGenerateTest() {
    const activeSectionIds = Array.from(selectedSectionIdSet);
    const useVisiblePages =
      activeSectionIds.length <= 1 && Array.isArray(sectionWindow?.visiblePageNumbers) && sectionWindow.visiblePageNumbers.length > 0;
    if (!selectedBookId || (!activeSectionIds.length && !selectedSectionId)) {
      setErrorMessage("Эхлээд дор хаяж нэг сэдэв сонгоно уу.");
      return;
    }

    setIsGeneratingTest(true);
    setErrorMessage("");
    setStatusMessage("Сонгосон сэдвүүд дээр тулгуурлан шалгалтын материал үүсгэж байна...");

    try {
      const payload = await requestWithFallback(`/api/books/${selectedBookId}/generate-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sectionId: selectedSectionId || activeSectionIds[0] || "",
          sectionIds: activeSectionIds,
          visiblePageNumbers: useVisiblePages ? sectionWindow.visiblePageNumbers : undefined,
          questionCount: resolvedQuestionCount,
          difficulty,
          difficultyCounts: {
            easy: clampNonNegativeInt(difficultyCounts.easy),
            medium: clampNonNegativeInt(difficultyCounts.medium),
            hard: clampNonNegativeInt(difficultyCounts.hard),
          },
          openQuestionCount: clampNonNegativeInt(openQuestionCount),
          totalScore: clampNonNegativeInt(totalScore, 100),
        }),
      });

      setTestResult(payload);
      setSelectedAnswers({});
      setSubmitted(false);
      setShowExplanations(true);
      setTestModalOpen(true);
      setStatusMessage(
        `Шалгалт бэлэн: ${payload.questionCountGenerated || 0} сонгох + ${payload.openQuestionCountGenerated || 0} задгай`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Тест үүсгэх үед алдаа гарлаа.");
      setStatusMessage("");
    } finally {
      setIsGeneratingTest(false);
    }
  }

  function handleSubmitTest() {
    setSubmitted(true);
  }

  function handleSelectAllTopics() {
    setAllTopicsMode(true);
    setExpandedChapterKeys(chapterKeys);
    const allIds = (Array.isArray(structure.sections) ? structure.sections : [])
      .map((section) => String(section?.id || ""))
      .filter(Boolean);
    setSelectedSectionIds(allIds);
    if (allIds.length > 0) {
      setSelectedSectionId((current) => (current && allIds.includes(current) ? current : allIds[0]));
    }
  }

  function handleSelectChapterTopics(chapter, chapterIdx) {
    const chapterKey = makeChapterKey(chapter, chapterIdx);
    const chapterSections = Array.isArray(chapter?.sections) ? chapter.sections : [];
    setAllTopicsMode(false);
    setExpandedChapterKeys((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.includes(chapterKey) ? list : [...list, chapterKey];
    });

    const firstSectionId = String(chapterSections[0]?.id || "");
    if (firstSectionId) {
      setSelectedSectionId(firstSectionId);
    }
    const ids = chapterSections.map((section) => String(section?.id || "")).filter(Boolean);
    setSelectedSectionIds((prev) => {
      const set = new Set(Array.isArray(prev) ? prev : []);
      ids.forEach((id) => set.add(id));
      return Array.from(set);
    });
  }

  function handleSelectSection(sectionId) {
    setAllTopicsMode(false);
    const id = String(sectionId || "");
    setSelectedSectionId(id);
    setSelectedSectionIds((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return id && !list.includes(id) ? [...list, id] : list;
    });
  }

  function handleToggleSectionSelection(sectionId) {
    const id = String(sectionId || "");
    if (!id) return;
    setAllTopicsMode(false);
    setSelectedSectionIds((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.includes(id);
      const next = exists ? list.filter((item) => item !== id) : [...list, id];
      setSelectedSectionId((current) => {
        if (!exists) return id;
        if (current !== id) return current;
        return String(next[0] || "");
      });
      return next;
    });
  }

  function handleToggleChapterSelection(chapter) {
    const chapterSections = Array.isArray(chapter?.sections) ? chapter.sections : [];
    const chapterSectionIds = chapterSections.map((section) => String(section?.id || "")).filter(Boolean);
    if (!chapterSectionIds.length) return;
    const allSelected = chapterSectionIds.every((id) => selectedSectionIdSet.has(id));

    setSelectedSectionIds((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      let next = [];
      if (allSelected) {
        const chapterSet = new Set(chapterSectionIds);
        next = list.filter((id) => !chapterSet.has(id));
      } else {
        const set = new Set(list);
        chapterSectionIds.forEach((id) => set.add(id));
        next = Array.from(set);
      }
      setSelectedSectionId((current) => {
        if (!allSelected) return current && next.includes(current) ? current : chapterSectionIds[0];
        if (current && !chapterSectionIds.includes(current)) return current;
        return String(next[0] || "");
      });
      return next;
    });
  }

  function handleDifficultyCountChange(level, value) {
    const safeLevel = String(level || "");
    if (!["easy", "medium", "hard"].includes(safeLevel)) return;
    const next = clampNonNegativeInt(value);
    setDifficultyCounts((prev) => ({
      ...prev,
      [safeLevel]: next,
    }));
  }

  function handleChapterToggle(chapter, chapterIdx) {
    const chapterKey = makeChapterKey(chapter, chapterIdx);
    const chapterSections = Array.isArray(chapter?.sections) ? chapter.sections : [];
    const opening = !expandedChapterKeys.includes(chapterKey);
    setExpandedChapterKeys((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return opening ? [...list, chapterKey] : list.filter((item) => item !== chapterKey);
    });

    if (!opening || !chapterSections.length) return;
    if (!chapterSections.some((section) => section.id === selectedSectionId)) {
      const nextSectionId = String(chapterSections[0]?.id || "");
      if (nextSectionId) {
        handleSelectSection(nextSectionId);
      }
    }
  }

  function handlePrevPageWindow() {
    if (!selectedBookId || !selectedSectionId || !sectionWindow?.hasPrev) return;
    const offset = Math.max(0, Number(sectionWindow?.offset || 0) - windowSize);
    void loadSectionWindow({
      bookId: selectedBookId,
      sectionId: selectedSectionId,
      offset,
    });
  }

  function handleNextPageWindow() {
    if (!selectedBookId || !selectedSectionId || !sectionWindow?.hasNext) return;
    const offset = Math.max(0, Number(sectionWindow?.offset || 0) + windowSize);
    void loadSectionWindow({
      bookId: selectedBookId,
      sectionId: selectedSectionId,
      offset,
    });
  }

  const score = useMemo(() => {
    const questions = Array.isArray(testResult?.questions) ? testResult.questions : [];
    if (!questions.length) return { correct: 0, total: 0 };

    let correct = 0;
    questions.forEach((question, idx) => {
      const selected = selectedAnswers[idx];
      if (selected && selected === question.correctAnswer) {
        correct += 1;
      }
    });

    return {
      correct,
      total: questions.length,
    };
  }, [selectedAnswers, testResult?.questions]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Textbook Reader + Test Generator</p>
          <h1>PDF OCR Reader</h1>
          <p className="subtext">
            OCR-оор уншсан номыг бүлэг → сэдвээр нь нээж, зөвхөн сэдвийн гарчигийг харуулна.
          </p>
        </div>
        <div className="status-pills">
          <span className="pill">API: {apiBase || "(same-origin)"}</span>
          <span className={`pill ${health?.ok ? "ok" : "warn"}`}>
            {health?.ok ? "Backend online" : "Backend offline"}
          </span>
          <span className="pill">Model: {health?.model || "-"}</span>
        </div>
      </header>

      <section className="toolbar">
        <form onSubmit={handleUpload} className="upload-form">
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            required
          />
          <button type="submit" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload PDF"}
          </button>
        </form>

        <div className="controls">
          <label>
            Backend URL
            <input
              value={apiBaseOverride}
              onChange={(event) => setApiBaseOverride(event.target.value)}
              placeholder='auto эсвэл "same-origin"'
            />
          </label>

          <label>
            Ном
            <select
              value={selectedBookId}
              onChange={(event) => setSelectedBookId(event.target.value)}
            >
              <option value="">Ном сонгох</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title} ({book.pageCount})
                </option>
              ))}
            </select>
          </label>

          <button className="ghost" type="button" onClick={() => void loadBooks()} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {selectedBook ? (
        <p className="book-meta">
          {selectedBook.title} • {selectedBook.pageCount} page • {formatDate(selectedBook.createdAt)}
        </p>
      ) : null}

      <main className="workspace">
        <aside className="sidebar exam-sidebar">
          <p className="sidebar-kicker">Сурах бичиг</p>
          <div className="builder-card">
            <div className="sidebar-head">
              <h2 className="builder-book-title">{selectedBook?.title || "Математик-12"}</h2>
              <div className="sidebar-actions">
                <button
                  type="button"
                  className="ghost mini-ghost"
                  onClick={handleSelectAllTopics}
                  disabled={!chapterKeys.length}
                >
                  Бүгдийг сонгох
                </button>
              </div>
            </div>

            <input
              className="topic-search-input"
              value={topicSearch}
              onChange={(event) => setTopicSearch(event.target.value)}
              placeholder="Хичээлийн сэдвээр хайх"
            />

            {!structure.chapters.length ? (
              <p className="empty">Chapter/section бүтэц хараахан алга байна.</p>
            ) : (
              <div className="chapter-list exam-chapter-list">
                {structure.chapters.map((chapter, chapterIdx) => {
                  const chapterSections = Array.isArray(chapter?.sections) ? chapter.sections : [];
                  const chapterKey = makeChapterKey(chapter, chapterIdx);
                  const isOpen = expandedChapterKeys.includes(chapterKey);
                  const chapterNumber = getChapterNumber(chapter, chapterIdx);
                  const chapterDisplayTitle = getChapterDisplayTitle(chapter, chapterIdx, tocLabels);
                  const searchLower = String(topicSearch || "").trim().toLowerCase();
                  const sectionEntries = chapterSections
                    .map((section, sectionIdx) => ({
                      section,
                      sectionIdx,
                      displayTitle: getSectionDisplayTitle(section, sectionIdx, chapterNumber, tocLabels),
                    }))
                    .filter((entry) => {
                      if (!searchLower) return true;
                      return String(entry.displayTitle || "").toLowerCase().includes(searchLower);
                    });
                  const chapterMatches = !searchLower
                    || String(chapterDisplayTitle || "").toLowerCase().includes(searchLower)
                    || sectionEntries.length > 0;
                  if (!chapterMatches) return null;

                  const visibleSectionIds = sectionEntries
                    .map((entry) => String(entry.section?.id || ""))
                    .filter(Boolean);
                  const allChapterVisibleSelected =
                    visibleSectionIds.length > 0 && visibleSectionIds.every((id) => selectedSectionIdSet.has(id));

                  return (
                    <div key={`chapter-${chapterIdx}`} className={`chapter-block ${isOpen ? "open" : ""}`}>
                      <div className="chapter-select-row">
                        <label className="check-row chapter-check-row">
                          <input
                            type="checkbox"
                            checked={allChapterVisibleSelected}
                            onChange={() => handleToggleChapterSelection(chapter)}
                          />
                          <span className="chapter-title">{chapterDisplayTitle}</span>
                        </label>
                        <button
                          type="button"
                          className={`chapter-toggle ${isOpen ? "open" : ""}`}
                          onClick={() => handleChapterToggle(chapter, chapterIdx)}
                          aria-expanded={isOpen}
                        >
                          <span className={`chapter-chevron ${isOpen ? "open" : ""}`} aria-hidden="true">
                            ⌄
                          </span>
                        </button>
                      </div>
                      {isOpen ? (
                        <div className="chapter-dropdown">
                          <button
                            type="button"
                            className="chapter-select-all-btn"
                            onClick={() => handleSelectChapterTopics(chapter, chapterIdx)}
                            disabled={!chapterSections.length}
                          >
                            Энэ бүлгийн бүх сэдэв
                          </button>
                          {sectionEntries.length ? (
                            sectionEntries.map((entry) => {
                              const sectionId = String(entry.section?.id || "");
                              const isChecked = selectedSectionIdSet.has(sectionId);
                              return (
                                <div
                                  key={sectionId || `${chapterKey}-sec-${entry.sectionIdx}`}
                                  className={`section-check-row ${selectedSectionId === sectionId ? "active" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleSectionSelection(sectionId)}
                                  />
                                  <button
                                    type="button"
                                    className="section-inline-btn"
                                    onClick={() => handleSelectSection(sectionId)}
                                  >
                                    {entry.displayTitle}
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <p className="empty">Энэ бүлэгт сэдэв олдсонгүй.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <label className="builder-field">
              <span>Тестийн тоо</span>
              <input
                type="number"
                min={0}
                value={questionCount}
                onChange={(event) => setQuestionCount(clampQuestionCount(event.target.value))}
                placeholder="Тестийн тоо оруулна уу"
              />
            </label>

            <label className="builder-field">
              <span>Задгай даалгаврын тоо</span>
              <input
                type="number"
                min={0}
                value={openQuestionCount}
                onChange={(event) => setOpenQuestionCount(clampNonNegativeInt(event.target.value))}
                placeholder="Задгай даалгаврын тоо оруулна уу"
              />
            </label>

            <label className="builder-field">
              <span>Нийт оноо</span>
              <input
                type="number"
                min={0}
                value={totalScore}
                onChange={(event) => setTotalScore(clampNonNegativeInt(event.target.value, 100))}
                placeholder="Нийт оноо оруулна уу"
              />
            </label>

            <div className="difficulty-stack">
              <p>Хүндрэлийн зэрэг</p>
              <label className="difficulty-row">
                <span>Энгийн</span>
                <input
                  type="number"
                  min={0}
                  value={difficultyCounts.easy}
                  onChange={(event) => handleDifficultyCountChange("easy", event.target.value)}
                />
              </label>
              <label className="difficulty-row">
                <span>Дунд</span>
                <input
                  type="number"
                  min={0}
                  value={difficultyCounts.medium}
                  onChange={(event) => handleDifficultyCountChange("medium", event.target.value)}
                />
              </label>
              <label className="difficulty-row">
                <span>Хүнд</span>
                <input
                  type="number"
                  min={0}
                  value={difficultyCounts.hard}
                  onChange={(event) => handleDifficultyCountChange("hard", event.target.value)}
                />
              </label>
            </div>

            <button
              type="button"
              className="create-exam-btn"
              onClick={() => void handleGenerateTest()}
              disabled={isGeneratingTest || !selectedBookId || selectedSectionIdSet.size === 0}
            >
              {isGeneratingTest ? "Үүсгэж байна..." : "Шалгалт үүсгэх"}
            </button>
          </div>
        </aside>

        <section className="reader">
          <div className="reader-head">
            <div>
              <h2 className="reader-main-title">Номын PDF зураг</h2>
              <p className="subtext">Сонгосон сэдвийн хуудсууд энд зураг хэлбэрээр харагдана.</p>
            </div>
          </div>

          {selectedSectionId ? (
            <div className="visual-panel">
              <div className="window-nav">
                <p>
                  {selectedSection
                    ? `PDF зураг: ${selectedSectionDisplayTitle}`
                    : "Сонгосон сэдвийн PDF зураг"}
                </p>
                <div className="window-nav-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={handlePrevPageWindow}
                    disabled={loadingSection || !sectionWindow?.hasPrev}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={handleNextPageWindow}
                    disabled={loadingSection || !sectionWindow?.hasNext}
                  >
                    Next
                  </button>
                </div>
              </div>

              {Array.isArray(sectionWindow?.visiblePages) && sectionWindow.visiblePages.length ? (
                <div className="page-cards">
                  {sectionWindow.visiblePages.map((page, idx) => {
                    const pageNumber = Math.max(1, Math.trunc(Number(page?.pageNumber || idx + 1)));
                    const pageImageKey = `page-${pageNumber}-${idx}`;
                    const directPdfUrl = buildPdfFileUrl({
                      bookId: selectedBookId,
                      apiBase,
                    });
                    const pageImageUrl = buildPdfPageImageUrl({
                      bookId: selectedBookId,
                      pageNumber,
                      apiBase,
                    });
                    const pagePreviewUrl = buildPdfPagePreviewUrl({
                      fileUrl: directPdfUrl,
                      pageNumber,
                    });

                    return (
                      <article className="page-card" key={pageImageKey}>
                        <h4>Хуудас {pageNumber}</h4>
                        <div className="page-preview-wrap">
                          {failedPageImages[pageImageKey] ? (
                            <p className="empty">
                              Хуудасны зураг ачаалж чадсангүй.{" "}
                              <a href={pagePreviewUrl} target="_blank" rel="noreferrer">
                                PDF-ээ шууд нээх
                              </a>
                            </p>
                          ) : (
                            <img
                              src={pageImageUrl}
                              alt={`Хуудас ${pageNumber}`}
                              className="page-preview-image"
                              loading="lazy"
                              onError={() =>
                                setFailedPageImages((prev) => ({
                                  ...prev,
                                  [pageImageKey]: true,
                                }))
                              }
                            />
                          )}
                        </div>
                        <a
                          className="page-preview-open"
                          href={pagePreviewUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Томоор нээх
                        </a>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="empty">
                  {loadingSection ? "PDF зураг ачаалж байна..." : "Энэ сэдэвт харуулах PDF зураг олдсонгүй."}
                </p>
              )}
            </div>
          ) : null}
        </section>
      </main>

      {testModalOpen && testResult ? (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <h2>Generated Test</h2>
              <button className="ghost" type="button" onClick={() => setTestModalOpen(false)}>
                Close
              </button>
            </div>

            <p className="subtext">
              Difficulty: {testResult.difficulty} • {testResult.questionCountGenerated} асуулт • Pages:{" "}
              {Array.isArray(testResult.visiblePageNumbers) ? testResult.visiblePageNumbers.join(", ") : "-"}
            </p>
            <p className="subtext">
              Задгай даалгавар: {testResult.openQuestionCountGenerated || 0}
            </p>

            {submitted ? (
              <p className="score">
                Score: {score.correct} / {score.total}
              </p>
            ) : null}

            <div className="modal-actions">
              <button type="button" onClick={handleSubmitTest}>
                Submit
              </button>
              <button className="ghost" type="button" onClick={() => setShowExplanations((prev) => !prev)}>
                {showExplanations ? "Hide explanations" : "Show explanations"}
              </button>
            </div>

            {Array.isArray(testResult.warnings) && testResult.warnings.length ? (
              <div className="warning-box">
                {testResult.warnings.map((warning, idx) => (
                  <p key={`warn-${idx}`}>{warning}</p>
                ))}
              </div>
            ) : null}

            <div className="question-list">
              {(Array.isArray(testResult.questions) ? testResult.questions : []).map((question, qIdx) => (
                <article key={`q-${qIdx}`} className="question-item">
                  {String(question.bookProblem || question.sourceExcerpt || "").trim() ? (
                    <p className="problem-line">
                      <strong>Номын бодлого:</strong>{" "}
                      <MathText text={String(question.bookProblem || question.sourceExcerpt || "").trim()} />
                    </p>
                  ) : null}

                  <h3>
                    {qIdx + 1}. <MathText text={question.question} />
                  </h3>

                  <div className="choice-list">
                    {(Array.isArray(question.choices) ? question.choices : []).map((choice, choiceIdx) => {
                      const parsed = extractChoiceToken(choice, choiceIdx);
                      const selected = selectedAnswers[qIdx] === parsed.label;
                      const isCorrect = parsed.label === question.correctAnswer;
                      const classNames = [
                        "choice-item",
                        selected ? "selected" : "",
                        isCorrect ? "correct" : "",
                        submitted && selected && !isCorrect ? "incorrect" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <label key={`q-${qIdx}-c-${choiceIdx}`} className={classNames}>
                          <input
                            type="radio"
                            name={`q-${qIdx}`}
                            value={parsed.label}
                            checked={selected}
                            onChange={() =>
                              setSelectedAnswers((prev) => ({
                                ...prev,
                                [qIdx]: parsed.label,
                              }))
                            }
                          />
                          <span className="choice-label">{parsed.label}.</span>
                          <span><MathText text={parsed.body} /></span>
                        </label>
                      );
                    })}
                  </div>

                  <p className="answer-line">Correct answer: {question.correctAnswer}</p>

                  {Array.isArray(question.sourcePages) && question.sourcePages.length ? (
                    <p className="source-line">Source pages: {question.sourcePages.join(", ")}</p>
                  ) : null}

                  {showExplanations ? (
                    <p className="explain-line">
                      <MathText text={question.explanation || ""} />
                    </p>
                  ) : null}
                </article>
              ))}
            </div>

            {Array.isArray(testResult.openQuestions) && testResult.openQuestions.length ? (
              <div className="question-list">
                {testResult.openQuestions.map((task, idx) => (
                  <article key={`open-${idx}`} className="question-item open-item">
                    <h3>
                      Задгай {idx + 1}. <MathText text={task.prompt || task.question || ""} />
                    </h3>
                    {Number.isFinite(Number(task.score)) ? (
                      <p className="source-line">Оноо: {Number(task.score)}</p>
                    ) : null}
                    {task.difficulty ? (
                      <p className="source-line">Түвшин: {task.difficulty}</p>
                    ) : null}
                    {Array.isArray(task.sourcePages) && task.sourcePages.length ? (
                      <p className="source-line">Source pages: {task.sourcePages.join(", ")}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {(statusMessage || errorMessage || healthError) ? (
        <footer className="footer-status">
          {statusMessage ? <p className="status ok">{statusMessage}</p> : null}
          {errorMessage ? <p className="status err">{errorMessage}</p> : null}
          {healthError ? <p className="status err">{healthError}</p> : null}
        </footer>
      ) : null}
    </div>
  );
}
