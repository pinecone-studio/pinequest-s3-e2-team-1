function normalizeText(value) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function normalizeFormula(value) {
  return normalizeSqrt(normalizeFractions(normalizeMathExpression(value)))
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyMathChunk(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/[\\{}^_]/.test(raw)) return true;
  const hasDigit = /\d/.test(raw);
  const hasOp = /[=+\-*/<>|≤≥≠≈×÷]/.test(raw) || raw.includes("√");
  const mostlyMath = /^[\dA-Za-z\s=+\-*/^_().,|<>?:°%≤≥≠≈×÷√π∞]+$/.test(raw);
  return hasDigit && hasOp && mostlyMath;
}

function extractFormulas(text) {
  const source = String(text || "");
  const out = [];
  const seen = new Set();

  const add = (candidate) => {
    const normalized = normalizeFormula(candidate);
    if (!normalized) return;
    if (normalized.length < 3 || normalized.length > 180) return;
    if (!isLikelyMathChunk(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const taggedRe = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+)\$|\\\(([\s\S]+?)\\\)/g;
  let match = taggedRe.exec(source);
  while (match && out.length < 12) {
    add(match[1] || match[2] || match[3] || match[4] || "");
    match = taggedRe.exec(source);
  }

  const inlineMathRe =
    /(\|\s*\d+(?:[.,]\d+)?\s*\||\b(?:sin|cos|tan|log|ln)\s*\([^)]*\)|\d+(?:[.,]\d+)?\s*[+\-*/=]\s*\d+(?:[.,]\d+)?|[A-Za-z]+\^\d+|√\s*\([^)]+\)|√\s*[A-Za-z0-9]+)/gi;
  match = inlineMathRe.exec(source);
  while (match && out.length < 12) {
    add(match[0]);
    match = inlineMathRe.exec(source);
  }

  return out;
}

function extractExamples(text) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) return [];
  const chunks = source.split(/(?<=[.!?])\s+/);
  const out = [];
  const seen = new Set();
  for (const chunk of chunks) {
    const line = String(chunk || "").trim();
    if (!line) continue;
    if (!/(Жишээ|Бодлого|Дасгал|Example|Exercise|Problem)/iu.test(line)) continue;
    if (line.length < 8 || line.length > 260) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= 10) break;
  }
  return out;
}

function splitParagraphs(text) {
  const source = String(text || "").trim();
  if (!source) return [];
  const blocks = source
    .split(/(?<=[.!?])\s{2,}|\n{2,}/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!blocks.length) return [];
  return blocks.slice(0, 30);
}

function cleanHeading(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[.·•]+$/g, "")
    .replace(/\s+\d{1,3}$/g, "")
    .trim();
}

function normalizeChapterTitle(rawTitle, chapterIndex) {
  const cleaned = cleanHeading(rawTitle);
  if (cleaned) return cleaned;
  return `БҮЛЭГ ${chapterIndex}`;
}

function normalizeSectionTitle(rawTitle, sectionIndex) {
  const cleaned = cleanHeading(rawTitle);
  if (cleaned) return cleaned;
  return `Section ${sectionIndex}`;
}

function detectChapterTitle(text) {
  const source = String(text || "");
  const chapterRe = /((?:[IVX]{1,4}\s+)?Б[ҮУ]?ЛЭГ[\s.\-–—]*[IVX0-9A-ZА-ЯЁ]{0,8}(?:[\s,.:;\-–—]+[^\n]{0,80})?)/iu;
  const matched = source.match(chapterRe);
  if (!matched) return "";
  return cleanHeading(matched[1]);
}

function detectSectionTitles(text) {
  const source = String(text || "");
  const out = [];
  const seen = new Set();
  const sectionRe = /(\d+\.\d+(?:\.\d+)?)\s*[\])\.:\-–—]?\s*([^\n]{2,120})/g;
  let match = sectionRe.exec(source);
  while (match && out.length < 8) {
    const number = String(match[1] || "").trim();
    const tail = cleanHeading(match[2] || "");
    const full = cleanHeading(`${number} ${tail}`);
    if (!full || seen.has(full)) {
      match = sectionRe.exec(source);
      continue;
    }
    seen.add(full);
    out.push(full);
    match = sectionRe.exec(source);
  }
  return out;
}

function detectSubsectionTitles(text) {
  const source = String(text || "");
  const out = [];
  const seen = new Set();
  const subsectionRe = /(\d+\.\d+\.\d+(?:\.\d+)?)\s*[\])\.:\-–—]?\s*([^\n]{2,120})/g;
  let match = subsectionRe.exec(source);
  while (match && out.length < 12) {
    const number = String(match[1] || "").trim();
    const tail = cleanHeading(match[2] || "");
    const full = cleanHeading(`${number} ${tail}`);
    if (!full || seen.has(full)) {
      match = subsectionRe.exec(source);
      continue;
    }
    seen.add(full);
    out.push(full);
    match = subsectionRe.exec(source);
  }
  return out;
}

function isLikelyTableOfContents(text) {
  const src = String(text || "");
  if (!src) return false;
  const hasContentsMarker = /(ГАРЧИГ|TABLE OF CONTENTS|CONTENTS)/iu.test(src);
  const sectionCount = (src.match(/\d+\.\d+/g) || []).length;
  const chapterCount = (src.match(/Б[ҮУ]?ЛЭГ/giu) || []).length;
  const dotCount = (src.match(/[.]{3,}/g) || []).length;
  const pageCount = (src.match(/(?:^|\s)\d{1,3}(?=\s|$)/g) || []).length;

  if (hasContentsMarker && (sectionCount >= 2 || dotCount >= 2 || pageCount >= 6)) return true;
  if (sectionCount >= 5 && dotCount >= 3) return true;
  if (chapterCount >= 2 && sectionCount >= 3 && pageCount >= 4) return true;
  return false;
}

function ensureChapter(chapters, chapterTitle) {
  const title = normalizeChapterTitle(chapterTitle, chapters.length + 1);
  const existing = chapters.find((chapter) => chapter.title === title);
  if (existing) return existing;
  const chapter = {
    title,
    sections: [],
  };
  chapters.push(chapter);
  return chapter;
}

function ensureSection(chapter, sectionTitle) {
  const title = normalizeSectionTitle(sectionTitle, chapter.sections.length + 1);
  const existing = chapter.sections.find((section) => section.title === title);
  if (existing) return existing;
  const section = {
    id: "",
    title,
    subsections: [],
    pages: [],
  };
  chapter.sections.push(section);
  return section;
}

function addUniqueString(array, value) {
  const raw = cleanHeading(value);
  if (!raw) return;
  if (array.includes(raw)) return;
  array.push(raw);
}

function buildBookStructure(pages) {
  const normalizedPages = Array.isArray(pages)
    ? pages
      .map((page) => ({
        pageNumber: Math.max(1, Math.trunc(Number(page?.pageNumber || 0))),
        text: normalizeText(page?.text),
      }))
      .filter((page) => page.text)
    : [];

  const chapters = [];
  let currentChapter = null;
  let currentSection = null;

  for (const page of normalizedPages) {
    const text = String(page.text || "");
    const toc = isLikelyTableOfContents(text);
    if (toc) {
      continue;
    }

    const chapterTitle = detectChapterTitle(text);
    const sectionTitles = detectSectionTitles(text);
    const subsectionTitles = detectSubsectionTitles(text);

    if (chapterTitle) {
      currentChapter = ensureChapter(chapters, chapterTitle);
      currentSection = null;
    }

    if (!currentChapter) {
      currentChapter = ensureChapter(chapters, "БҮЛЭГ I");
    }

    if (sectionTitles.length > 0) {
      currentSection = ensureSection(currentChapter, sectionTitles[0]);
      for (const subsection of subsectionTitles) {
        addUniqueString(currentSection.subsections, subsection);
      }
    }

    if (!currentSection) {
      const fallbackTitle = sectionTitles[0] || `Section ${page.pageNumber}`;
      currentSection = ensureSection(currentChapter, fallbackTitle);
    }

    const formulas = extractFormulas(text);
    const examples = extractExamples(text);
    const paragraphs = splitParagraphs(text);
    const content = paragraphs.length ? paragraphs.join("\n\n") : text;

    currentSection.pages.push({
      pageNumber: page.pageNumber,
      content,
      paragraphs,
      formulas,
      examples,
    });
  }

  let sectionCounter = 1;
  for (const chapter of chapters) {
    for (const section of chapter.sections) {
      section.id = `sec-${sectionCounter}`;
      sectionCounter += 1;
    }
  }

  return {
    chapters,
  };
}

function flattenSections(chapters) {
  const out = [];
  const source = Array.isArray(chapters) ? chapters : [];

  for (const chapter of source) {
    const chapterTitle = String(chapter?.title || "").trim();
    const sections = Array.isArray(chapter?.sections) ? chapter.sections : [];
    for (const section of sections) {
      const pages = Array.isArray(section?.pages) ? section.pages : [];
      const pageNumbers = pages
        .map((page) => Math.trunc(Number(page?.pageNumber)))
        .filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber >= 1);
      const sortedPages = [...new Set(pageNumbers)].sort((a, b) => a - b);
      out.push({
        id: String(section?.id || "").trim(),
        title: String(section?.title || "").trim(),
        chapterTitle,
        subsections: Array.isArray(section?.subsections) ? section.subsections : [],
        pageNumbers: sortedPages,
        startPage: sortedPages[0] || null,
        endPage: sortedPages[sortedPages.length - 1] || null,
        pageCount: sortedPages.length,
      });
    }
  }

  return out;
}

function findSectionById(chapters, sectionId) {
  const wanted = String(sectionId || "").trim();
  if (!wanted) return null;

  const source = Array.isArray(chapters) ? chapters : [];
  for (const chapter of source) {
    const chapterTitle = String(chapter?.title || "").trim();
    const sections = Array.isArray(chapter?.sections) ? chapter.sections : [];
    for (const section of sections) {
      if (String(section?.id || "").trim() !== wanted) continue;
      return {
        chapterTitle,
        section,
      };
    }
  }
  return null;
}

module.exports = {
  buildBookStructure,
  findSectionById,
  flattenSections,
};
