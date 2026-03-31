const fs = require("node:fs");
const path = require("node:path");

function getUploadDir() {
  const configured = String(process.env.BOOK_UPLOAD_DIR || "").trim();
  if (configured) return path.resolve(configured);
  return path.resolve(__dirname, "..", "..", "uploads");
}

function getLegacyUploadDir() {
  return path.resolve(__dirname, "..", "..", "..", "uploads");
}

function candidateUploadDirs() {
  const out = [];
  out.push(getUploadDir());
  out.push(getLegacyUploadDir());
  return Array.from(new Set(out));
}

function getBookPdfPath(bookId) {
  return path.join(getUploadDir(), `${bookId}.pdf`);
}

async function ensureUploadDir() {
  await fs.promises.mkdir(getUploadDir(), { recursive: true });
}

async function saveBookPdf({ bookId, buffer }) {
  await ensureUploadDir();
  const pdfPath = getBookPdfPath(bookId);
  await fs.promises.writeFile(pdfPath, buffer);
  return pdfPath;
}

function findExistingBookPdfPath(bookId) {
  for (const dir of candidateUploadDirs()) {
    const candidate = path.join(dir, `${bookId}.pdf`);
    if (pdfExists(candidate)) return candidate;
  }
  return "";
}

function pdfExists(pdfPath) {
  if (!pdfPath) return false;
  try {
    return fs.existsSync(pdfPath);
  } catch {
    return false;
  }
}

module.exports = {
  candidateUploadDirs,
  findExistingBookPdfPath,
  getBookPdfPath,
  getUploadDir,
  getLegacyUploadDir,
  pdfExists,
  saveBookPdf,
};
