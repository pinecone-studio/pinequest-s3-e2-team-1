const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { findExistingBookPdfPath, pdfExists } = require("./book-files");
const { buildBookStructure } = require("./book-structure");

const books = new Map();
const STORE_BACKEND_AUTO = "auto";
const STORE_BACKEND_LOCAL = "local";
const STORE_BACKEND_R2 = "r2";
const STORE_BACKEND_SET = new Set([STORE_BACKEND_AUTO, STORE_BACKEND_LOCAL, STORE_BACKEND_R2]);

let initialized = false;
let initializationPromise = null;
let activeStoreBackend = STORE_BACKEND_LOCAL;
let r2StoreState = null;
let r2PersistQueue = Promise.resolve();

function createBookId() {
  return crypto.randomUUID();
}

function getBookStorePath() {
  const configured = String(process.env.BOOK_STORE_PATH || "").trim();
  if (configured) return path.resolve(configured);
  return path.resolve(__dirname, "..", "..", "data", "books.json");
}

function ensureStoreDir() {
  const storePath = getBookStorePath();
  const dir = path.dirname(storePath);
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeStoreBackend(value) {
  const normalized = String(value || STORE_BACKEND_AUTO)
    .trim()
    .toLowerCase();
  return STORE_BACKEND_SET.has(normalized) ? normalized : STORE_BACKEND_AUTO;
}

function getRequestedStoreBackend() {
  return normalizeStoreBackend(process.env.BOOK_STORE_BACKEND);
}

function getR2StoreConfig() {
  const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
  const endpointFromEnv = String(process.env.R2_ENDPOINT || "").trim();
  const endpoint =
    endpointFromEnv || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const bucket = String(process.env.R2_BUCKET || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const objectKey = String(process.env.R2_BOOK_STORE_KEY || "").trim() || "books/books.json";

  return {
    accessKeyId,
    bucket,
    endpoint,
    objectKey,
    secretAccessKey,
  };
}

function hasR2StoreConfig(config = getR2StoreConfig()) {
  return Boolean(config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey);
}

function resolveStoreBackend() {
  const requested = getRequestedStoreBackend();
  if (requested === STORE_BACKEND_LOCAL || requested === STORE_BACKEND_R2) {
    return requested;
  }

  return hasR2StoreConfig() ? STORE_BACKEND_R2 : STORE_BACKEND_LOCAL;
}

function getS3ClientApi() {
  try {
    return require("@aws-sdk/client-s3");
  } catch (error) {
    throw new Error(
      "Cloudflare R2 store ашиглахын тулд @aws-sdk/client-s3 package шаардлагатай. " +
        "`cd backend && npm install` ажиллуулна уу.",
    );
  }
}

function getR2StoreState() {
  if (r2StoreState) {
    return r2StoreState;
  }

  const config = getR2StoreConfig();
  if (!hasR2StoreConfig(config)) {
    throw new Error(
      "Cloudflare R2 тохиргоо дутуу байна. R2_ACCOUNT_ID, R2_BUCKET, " +
        "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (эсвэл R2_ENDPOINT)-ийг тохируулна уу.",
    );
  }

  const { S3Client, GetObjectCommand, PutObjectCommand } = getS3ClientApi();
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  r2StoreState = {
    bucket: config.bucket,
    client,
    getCommand: GetObjectCommand,
    key: config.objectKey,
    putCommand: PutObjectCommand,
  };
  return r2StoreState;
}

async function readStreamAsUtf8(body) {
  if (!body) return "";
  if (typeof body.transformToString === "function") {
    return body.transformToString("utf-8");
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parsePersistedStore(raw) {
  if (!raw || typeof raw !== "object") return [];
  const payload = raw;
  const items = Array.isArray(payload.books) ? payload.books : [];
  return items.filter((item) => item && typeof item === "object");
}

function normalizePage(rawPage) {
  const pageNumber = Number(rawPage?.pageNumber);
  const text = typeof rawPage?.text === "string" ? rawPage.text : "";
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return null;
  return {
    pageNumber: Math.trunc(pageNumber),
    text,
  };
}

function normalizeBook(rawBook) {
  const id = typeof rawBook?.id === "string" ? rawBook.id : "";
  if (!id) return null;

  const fileName = typeof rawBook?.fileName === "string" ? rawBook.fileName : "uploaded.pdf";
  const title = typeof rawBook?.title === "string" ? rawBook.title : fileName || "Untitled book";
  const createdAt =
    typeof rawBook?.createdAt === "string" && rawBook.createdAt
      ? rawBook.createdAt
      : new Date().toISOString();

  const rawPages = Array.isArray(rawBook?.pages) ? rawBook.pages : [];
  const pages = rawPages.map(normalizePage).filter(Boolean);
  if (pages.length === 0) return null;

  const rawStructured = rawBook?.structuredContent;
  const structuredContent =
    rawStructured && Array.isArray(rawStructured?.chapters)
      ? rawStructured
      : buildBookStructure(pages);

  const rawPdfPath = typeof rawBook?.pdfPath === "string" ? rawBook.pdfPath : "";
  const resolvedPdfPath =
    rawPdfPath && pdfExists(rawPdfPath)
      ? rawPdfPath
      : findExistingBookPdfPath(id);

  return {
    id,
    title,
    fileName,
    pdfPath: resolvedPdfPath || "",
    pages,
    structuredContent,
    createdAt,
  };
}

function buildPersistedPayload() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    books: Array.from(books.values()),
  };
}

function loadPersistedBooksFromLocalDisk() {
  const storePath = getBookStorePath();
  if (!fs.existsSync(storePath)) return null;

  const content = fs.readFileSync(storePath, "utf8");
  return JSON.parse(content);
}

function safeLoadPersistedBooksFromLocalDisk() {
  try {
    return loadPersistedBooksFromLocalDisk();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `Failed to load persisted book store (${getBookStorePath()}). Using in-memory only.`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function loadPersistedBooksFromR2() {
  const state = getR2StoreState();
  try {
    const response = await state.client.send(
      new state.getCommand({
        Bucket: state.bucket,
        Key: state.key,
      }),
    );
    const content = await readStreamAsUtf8(response?.Body);
    if (!String(content || "").trim()) return null;
    return JSON.parse(content);
  } catch (error) {
    const errorName = String(error?.name || error?.Code || "");
    const status = Number(error?.$metadata?.httpStatusCode);
    if (errorName === "NoSuchKey" || errorName === "NotFound" || status === 404) {
      return null;
    }
    throw error;
  }
}

function persistBooksToLocalDisk() {
  ensureStoreDir();
  const storePath = getBookStorePath();
  const tmpPath = `${storePath}.tmp`;
  const payload = buildPersistedPayload();
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
  try {
    fs.renameSync(tmpPath, storePath);
  } catch (error) {
    try {
      fs.rmSync(storePath, { force: true });
      fs.renameSync(tmpPath, storePath);
    } catch {
      throw error;
    }
  }
}

async function persistBooksToR2() {
  const state = getR2StoreState();
  const payload = buildPersistedPayload();
  await state.client.send(
    new state.putCommand({
      Bucket: state.bucket,
      Key: state.key,
      Body: JSON.stringify(payload, null, 2),
      ContentType: "application/json; charset=utf-8",
    }),
  );
}

function hydrateBooksFromPayload(parsedPayload) {
  books.clear();
  const items = parsePersistedStore(parsedPayload);
  for (const rawBook of items) {
    const book = normalizeBook(rawBook);
    if (!book) continue;
    books.set(book.id, book);
  }
}

function queuePersistToR2() {
  r2PersistQueue = r2PersistQueue
    .then(() => persistBooksToR2())
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.warn(
        "Cloudflare R2 дээр book store хадгалж чадсангүй. " +
          "Өөрчлөлт restart дараа алдагдаж магадгүй.",
        error instanceof Error ? error.message : error,
      );
    });
}

function persistBooks() {
  if (activeStoreBackend === STORE_BACKEND_R2) {
    queuePersistToR2();
    return;
  }

  try {
    persistBooksToLocalDisk();
  } catch (error) {
    // Ignore disk write failures; keep in-memory store working.
    // eslint-disable-next-line no-console
    console.warn(
      `Failed to persist book store (${getBookStorePath()}). Changes will not survive restart.`,
      error instanceof Error ? error.message : error,
    );
  }
}

async function initBookStore() {
  if (initialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const requested = getRequestedStoreBackend();
    activeStoreBackend = resolveStoreBackend();

    try {
      const payload =
        activeStoreBackend === STORE_BACKEND_R2
          ? await loadPersistedBooksFromR2()
          : safeLoadPersistedBooksFromLocalDisk();
      hydrateBooksFromPayload(payload);
    } catch (error) {
      if (activeStoreBackend === STORE_BACKEND_R2 && requested === STORE_BACKEND_AUTO) {
        // eslint-disable-next-line no-console
        console.warn(
          "Cloudflare R2 store ачаалж чадсангүй. Local books.json руу fallback хийж байна.",
          error instanceof Error ? error.message : error,
        );
        activeStoreBackend = STORE_BACKEND_LOCAL;
        const payload = safeLoadPersistedBooksFromLocalDisk();
        hydrateBooksFromPayload(payload);
      } else {
        throw error;
      }
    }

    initialized = true;
  })().catch((error) => {
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
}

function createBookRecord({ createdAt, fileName, id, pages, pdfPath, title }) {
  const structuredContent = buildBookStructure(pages);
  return {
    id: id || createBookId(),
    title: title || fileName || "Untitled book",
    fileName: fileName || "uploaded.pdf",
    pdfPath: pdfPath || "",
    pages,
    structuredContent,
    createdAt: createdAt || new Date().toISOString(),
  };
}

function saveBook(input) {
  const book = createBookRecord(input);
  books.set(book.id, book);
  persistBooks();
  return book;
}

function updateBook(bookId, patch) {
  const existing = books.get(bookId);
  if (!existing) return null;

  const next = {
    ...existing,
    ...(patch && typeof patch === "object" ? patch : {}),
    id: existing.id,
    createdAt: existing.createdAt,
  };

  if (!Array.isArray(next.pages) || next.pages.length === 0) {
    return null;
  }

  books.set(bookId, next);
  persistBooks();
  return next;
}

function getBookById(bookId) {
  return books.get(bookId) || null;
}

function listBooks() {
  return Array.from(books.values()).map((book) => ({
    id: book.id,
    title: book.title,
    fileName: book.fileName,
    pageCount: book.pages.length,
    chapterCount: Array.isArray(book.structuredContent?.chapters)
      ? book.structuredContent.chapters.length
      : 0,
    hasPdf: Boolean(book.pdfPath && pdfExists(book.pdfPath)),
    createdAt: book.createdAt,
  }));
}

function getBookStoreBackend() {
  return activeStoreBackend;
}

module.exports = {
  createBookId,
  getBookStoreBackend,
  getBookById,
  initBookStore,
  listBooks,
  saveBook,
  updateBook,
};
