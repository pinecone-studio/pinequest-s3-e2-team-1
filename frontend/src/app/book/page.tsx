"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchBookHealth,
  fetchBooks,
  getBookApiBaseUrl,
  requestBookQuestions,
  uploadBookPdf,
  type BookHealthResponse,
  type BookListItem,
  type GenerateBookQuestionsResponse,
  type UploadBookResponse,
} from "@/lib/book-question-api";

function formatDifficulty(value: string) {
  if (value === "easy") return "Хялбар";
  if (value === "hard") return "Хэцүү";
  return "Дунд";
}

function formatType(value: string) {
  if (value === "conceptual") return "Ойлголт";
  if (value === "analytical") return "Задлан шинжлэх";
  return "Баримт";
}

function formatDate(value: string) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function formatChoice(value: string) {
  const matched = value.match(/^\s*([A-D])[\).\s:-]+(.*)$/i);
  if (!matched) return value;
  return `${matched[1].toUpperCase()}: ${matched[2]}`;
}

export default function BookQuestionPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedBook, setUploadedBook] = useState<UploadBookResponse | null>(null);
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [health, setHealth] = useState<BookHealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateBookQuestionsResponse | null>(null);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [questionCount, setQuestionCount] = useState(20);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingBooks, setIsRefreshingBooks] = useState(false);
  const [showPdfInline, setShowPdfInline] = useState(false);

  const sortedBooks = useMemo(
    () =>
      [...books].sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")),
    [books],
  );

  const selectedBook = useMemo(
    () => sortedBooks.find((book) => book.id === selectedBookId) ?? null,
    [selectedBookId, sortedBooks],
  );

  const pageOptions = useMemo(
    () => Array.from({ length: selectedBook?.pageCount ?? 0 }, (_, i) => i + 1),
    [selectedBook?.pageCount],
  );

  const previewPages = useMemo(() => {
    if (!uploadedBook || uploadedBook.bookId !== selectedBookId) return [];
    return uploadedBook.pages.slice(0, 4);
  }, [selectedBookId, uploadedBook]);

  const syncPageRange = useCallback((pageCount: number) => {
    if (pageCount <= 0) {
      setStartPage(1);
      setEndPage(1);
      return;
    }
    setStartPage((prev) => Math.min(Math.max(prev, 1), pageCount));
    setEndPage((prev) => Math.min(Math.max(prev, 1), pageCount));
  }, []);

  const refreshBooks = useCallback(
    async (preferredBookId?: string) => {
      setIsRefreshingBooks(true);
      try {
        const payload = await fetchBooks();
        setBooks(payload.books);

        if (payload.books.length === 0) {
          setSelectedBookId("");
          syncPageRange(0);
          return;
        }

        const firstBook = payload.books[0];
        const nextSelectedBookId =
          preferredBookId && payload.books.some((book) => book.id === preferredBookId)
            ? preferredBookId
            : selectedBookId && payload.books.some((book) => book.id === selectedBookId)
              ? selectedBookId
              : firstBook.id;

        setSelectedBookId(nextSelectedBookId);
        const matched = payload.books.find((book) => book.id === nextSelectedBookId);
        syncPageRange(matched?.pageCount || firstBook.pageCount);
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "Номын жагсаалт шинэчлэхэд алдаа гарлаа.",
        );
      } finally {
        setIsRefreshingBooks(false);
      }
    },
    [selectedBookId, syncPageRange],
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setIsBooting(true);
      setError(null);
      setStatusMessage(null);

      const [healthResult, booksResult] = await Promise.allSettled([
        fetchBookHealth(),
        fetchBooks(),
      ]);

      if (!mounted) return;

      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value);
        setHealthError(null);
      } else {
        setHealth(null);
        setHealthError(
          healthResult.reason instanceof Error
            ? healthResult.reason.message
            : "Backend health шалгаж чадсангүй.",
        );
      }

      if (booksResult.status === "fulfilled") {
        const items = booksResult.value.books;
        setBooks(items);
        if (items.length > 0) {
          setSelectedBookId(items[0].id);
          syncPageRange(items[0].pageCount);
        }
      } else {
        setError(
          booksResult.reason instanceof Error
            ? booksResult.reason.message
            : "Номын жагсаалт татахад алдаа гарлаа.",
        );
      }

      setIsBooting(false);
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [syncPageRange]);

  useEffect(() => {
    if (!selectedBook) return;
    setStartPage((prev) => Math.min(Math.max(prev, 1), selectedBook.pageCount));
    setEndPage((prev) => Math.min(Math.max(prev, 1), selectedBook.pageCount));
  }, [selectedBook]);

  useEffect(() => {
    setShowPdfInline(false);
  }, [selectedBookId]);

  useEffect(() => {
    if (startPage > endPage) {
      setEndPage(startPage);
    }
  }, [endPage, startPage]);

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("PDF файлаа эхлээд сонгоно уу.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setStatusMessage("PDF upload хийж байна...");
    setResult(null);

    try {
      const payload = await uploadBookPdf(selectedFile);
      setUploadedBook(payload);
      await refreshBooks(payload.bookId);
      setStartPage(1);
      setEndPage(payload.pageCount);
      setStatusMessage(
        `"${payload.title}" амжилттай upload хийгдлээ. Одоо асуулт үүсгэж болно.`,
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Ном upload хийхэд алдаа гарлаа.",
      );
      setStatusMessage(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedBookId) {
      setError("Номоо сонгоно уу.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStatusMessage("AI асуулт бэлдэж байна...");

    try {
      const payload = await requestBookQuestions({
        bookId: selectedBookId,
        endPage,
        questionCount,
        startPage,
      });
      setResult(payload);
      setStatusMessage(`Амжилттай: ${payload.questionCountGenerated} асуулт үүсгэлээ.`);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Асуулт бэлдэхэд алдаа гарлаа.",
      );
      setStatusMessage(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyJson = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.questions, null, 2));
      setStatusMessage("Question JSON clipboard руу хууллаа.");
    } catch {
      setError("Clipboard руу хуулж чадсангүй.");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fff8ed] px-4 py-8 text-[#1f2937] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="book-float absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[#ffb27d]/40 blur-3xl" />
        <div
          className="book-float absolute right-[-3rem] top-[30%] h-80 w-80 rounded-full bg-[#86d8cf]/35 blur-3xl"
          style={{ animationDelay: "1.4s" }}
        />
        <div
          className="book-float absolute bottom-[-5rem] left-[25%] h-96 w-96 rounded-full bg-[#f0d894]/30 blur-3xl"
          style={{ animationDelay: "2.2s" }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="book-reveal rounded-[28px] border border-[#d7b98d] bg-[#fffdf8]/90 p-6 shadow-[0_18px_60px_rgba(145,98,38,0.16)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#ab5a2c]">
                Book Question Studio
              </p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[#7a3e1e] sm:text-4xl">
                Backend-д холбоотой бүрэн Frontend
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5e5142]">
                Энэ хуудас зөвхөн чиний `book-question-backend` дээр ажиллана.
                `health`, `book list`, `upload`, `generate` бүгд backend endpoint-оос
                бодитоор авч харуулж байна.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/"
                className="rounded-xl border border-[#d4b08b] bg-white px-4 py-2 text-sm font-semibold text-[#7a3e1e] transition hover:-translate-y-0.5 hover:border-[#bf8755]"
              >
                Буцах
              </Link>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-[#d8c2a9] bg-white px-3 py-1 font-semibold text-[#74411f]">
              API: {getBookApiBaseUrl()}
            </span>
            <span
              className={`rounded-full px-3 py-1 font-semibold ${
                health?.ok
                  ? "border border-[#7cc8a7] bg-[#ecfff5] text-[#0f6f45]"
                  : "border border-[#efc39b] bg-[#fff4ec] text-[#9d4f1e]"
              }`}
            >
              {health?.ok ? "Backend online" : "Backend шалгаж байна"}
            </span>
            {health?.model && (
              <span className="rounded-full border border-[#a9ddd8] bg-[#effffd] px-3 py-1 font-semibold text-[#0e6e63]">
                Model: {health.model}
              </span>
            )}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article
            className="book-reveal rounded-[26px] border border-[#e5c8a5] bg-[#fffaf2]/95 p-5 shadow-[0_14px_45px_rgba(152,94,40,0.14)] sm:p-6"
            style={{ animationDelay: "90ms" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-[#7a3e1e]">1. Backend статус</h2>
              <button
                type="button"
                onClick={() => {
                  setHealthError(null);
                  void refreshBooks();
                  void fetchBookHealth()
                    .then((payload) => {
                      setHealth(payload);
                      setHealthError(null);
                    })
                    .catch((statusError) => {
                      setHealth(null);
                      setHealthError(
                        statusError instanceof Error
                          ? statusError.message
                          : "Health сэргээхэд алдаа гарлаа.",
                      );
                    });
                }}
                className="rounded-lg border border-[#d8b086] bg-white px-3 py-1.5 text-xs font-semibold text-[#8d4d22] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRefreshingBooks || isBooting}
              >
                {isRefreshingBooks ? "Шинэчилж байна..." : "Refresh"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#f0d3b4] bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#ab5a2c]">Service</p>
                <p className="mt-2 text-sm font-bold text-[#4f2d15]">
                  {health?.service || "Мэдээлэл алга"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#bee4d5] bg-[#f6fffb] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#0f6f45]">Model</p>
                <p className="mt-2 text-sm font-bold text-[#11553a]">
                  {health?.model || "Мэдээлэл алга"}
                </p>
              </div>
            </div>

            {healthError && (
              <p className="mt-4 rounded-xl border border-[#efc39b] bg-[#fff2e8] px-3 py-2 text-sm text-[#9d4f1e]">
                {healthError}
              </p>
            )}

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#7a3e1e]">Backend дэх номууд</h3>
                <span className="rounded-full border border-[#d7b98d] bg-white px-2 py-0.5 text-xs font-semibold text-[#74411f]">
                  {sortedBooks.length} ширхэг
                </span>
              </div>

              <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
                {sortedBooks.length === 0 && (
                  <p className="rounded-xl border border-dashed border-[#d8b086] bg-white px-3 py-4 text-sm text-[#876040]">
                    Одоогоор upload хийсэн ном алга.
                  </p>
                )}
                {sortedBooks.map((book) => (
                  <button
                    type="button"
                    key={book.id}
                    onClick={() => {
                      setSelectedBookId(book.id);
                      setResult(null);
                      setStatusMessage(null);
                    }}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedBookId === book.id
                        ? "border-[#d18545] bg-[#fff0de] shadow-[0_6px_18px_rgba(163,94,32,0.16)]"
                        : "border-[#ecd2b8] bg-white hover:-translate-y-0.5 hover:border-[#d6ae86]"
                    }`}
                  >
                    <p className="truncate text-sm font-bold text-[#5d3418]">{book.title}</p>
                    <p className="mt-1 text-xs text-[#846349]">
                      {book.pageCount} хуудас • {formatDate(book.createdAt)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </article>

          <article
            className="book-reveal rounded-[26px] border border-[#9fd9ce] bg-[#f7fffd]/95 p-5 shadow-[0_14px_42px_rgba(18,112,100,0.14)] sm:p-6"
            style={{ animationDelay: "180ms" }}
          >
            <h2 className="text-xl font-bold text-[#0f6f63]">2. PDF upload</h2>
            <p className="mt-2 text-sm text-[#355d58]">
              Шинэ PDF upload хийнэ, дараа нь backend дотор хадгалагдсан номоос page range
              сонгоод асуулт үүсгэнэ.
            </p>

            <div className="mt-4 space-y-3">
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border border-[#9fd9ce] bg-white px-3 py-3 text-sm text-[#0f6f63] file:mr-3 file:rounded-lg file:border-0 file:bg-[#0f6f63] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full rounded-xl bg-[#0f6f63] px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#0b5a50] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUploading ? "Upload хийж байна..." : "PDF Upload"}
              </button>
            </div>

            {uploadedBook && (
              <div className="mt-4 rounded-2xl border border-[#9fd9ce] bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#188170]">Сүүлийн Upload</p>
                <h3 className="mt-2 text-sm font-bold text-[#135b52]">{uploadedBook.title}</h3>
                <p className="mt-1 text-xs text-[#3d6a64]">{uploadedBook.pageCount} хуудас</p>
                {previewPages.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {previewPages.map((page) => (
                      <div
                        key={page.pageNumber}
                        className="rounded-xl border border-[#d0ebe6] bg-[#f8fffd] px-3 py-2"
                      >
                        <p className="text-xs font-bold text-[#147567]">Page {page.pageNumber}</p>
                        <p className="mt-1 text-xs leading-5 text-[#355d58]">{page.preview}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </article>
        </section>

        <section
          className="book-reveal rounded-[30px] border border-[#d7b98d] bg-[#fffdf8]/95 p-5 shadow-[0_16px_48px_rgba(113,74,34,0.14)] sm:p-6"
          style={{ animationDelay: "260ms" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#7a3e1e]">3. Асуулт үүсгэх</h2>
            {selectedBook && (
              <span className="rounded-full border border-[#d9bb96] bg-white px-3 py-1 text-xs font-semibold text-[#7a3e1e]">
                Сонгосон ном: {selectedBook.title}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={selectedBookId ? `/api/books/${selectedBookId}/file` : "#"}
              target="_blank"
              rel="noreferrer"
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                selectedBookId
                  ? "border-[#d4b08b] bg-white text-[#7a3e1e] hover:-translate-y-0.5 hover:border-[#bf8755]"
                  : "cursor-not-allowed border-[#e8d5c4] bg-white/60 text-[#b08a6a]"
              }`}
              onClick={(event) => {
                if (!selectedBookId) event.preventDefault();
              }}
            >
              PDF нээх
            </a>
            <a
              href={selectedBookId ? `/api/books/${selectedBookId}/file?download=1` : "#"}
              target="_blank"
              rel="noreferrer"
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                selectedBookId
                  ? "border-[#d4b08b] bg-white text-[#7a3e1e] hover:-translate-y-0.5 hover:border-[#bf8755]"
                  : "cursor-not-allowed border-[#e8d5c4] bg-white/60 text-[#b08a6a]"
              }`}
              onClick={(event) => {
                if (!selectedBookId) event.preventDefault();
              }}
            >
              PDF татах
            </a>
            <button
              type="button"
              onClick={() => setShowPdfInline((prev) => !prev)}
              disabled={!selectedBookId}
              className="rounded-xl border border-[#d4b08b] bg-white px-4 py-2 text-sm font-semibold text-[#7a3e1e] transition hover:-translate-y-0.5 hover:border-[#bf8755] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {showPdfInline ? "PDF нуух" : "PDF харах"}
            </button>
          </div>

          {showPdfInline && selectedBookId ? (
            <div className="mt-4 overflow-hidden rounded-[22px] border border-[#d9bb96] bg-white">
              <iframe
                title="PDF Viewer"
                src={`/api/books/${selectedBookId}/file`}
                className="h-[560px] w-full"
              />
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="text-sm font-semibold text-[#6f3a1d]">
              Ном сонгох
              <select
                value={selectedBookId}
                onChange={(event) => {
                  setSelectedBookId(event.target.value);
                  setResult(null);
                  setStatusMessage(null);
                }}
                className="mt-1 block w-full rounded-xl border border-[#dbbd99] bg-white px-3 py-2 text-sm text-[#5f3116]"
              >
                <option value="">Ном сонгох</option>
                {sortedBooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title} ({book.pageCount}p)
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-[#6f3a1d]">
              Start page
              <select
                value={startPage}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setStartPage(next);
                  if (next > endPage) setEndPage(next);
                }}
                disabled={!selectedBook}
                className="mt-1 block w-full rounded-xl border border-[#dbbd99] bg-white px-3 py-2 text-sm text-[#5f3116] disabled:opacity-50"
              >
                {pageOptions.map((page) => (
                  <option key={`start-${page}`} value={page}>
                    {page}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-[#6f3a1d]">
              End page
              <select
                value={endPage}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setEndPage(next);
                  if (next < startPage) setStartPage(next);
                }}
                disabled={!selectedBook}
                className="mt-1 block w-full rounded-xl border border-[#dbbd99] bg-white px-3 py-2 text-sm text-[#5f3116] disabled:opacity-50"
              >
                {pageOptions.map((page) => (
                  <option key={`end-${page}`} value={page}>
                    {page}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-[#6f3a1d]">
              Асуултын тоо
              <input
                type="number"
                min={1}
                max={30}
                value={questionCount}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  setQuestionCount(Math.min(30, Math.max(1, Math.trunc(next))));
                }}
                className="mt-1 block w-full rounded-xl border border-[#dbbd99] bg-white px-3 py-2 text-sm text-[#5f3116]"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!selectedBookId || isGenerating || isBooting}
              className="rounded-xl bg-[#bf5d2f] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#a94e24] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? "AI ажиллаж байна..." : "Асуулт үүсгэх"}
            </button>
            <button
              type="button"
              onClick={handleCopyJson}
              disabled={!result}
              className="rounded-xl border border-[#d9bb96] bg-white px-5 py-3 text-sm font-bold text-[#7a3e1e] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              JSON хуулах
            </button>
          </div>

          {statusMessage && (
            <p className="mt-4 rounded-xl border border-[#bee4d5] bg-[#f3fff9] px-3 py-2 text-sm text-[#0f6f45]">
              {statusMessage}
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-xl border border-[#efc39b] bg-[#fff2e8] px-3 py-2 text-sm text-[#9d4f1e]">
              {error}
            </p>
          )}
        </section>

        {result && (
          <section
            className="book-reveal rounded-[30px] border border-[#8bcabd] bg-[#f7fffe]/95 p-5 shadow-[0_16px_48px_rgba(15,112,98,0.14)] sm:p-6"
            style={{ animationDelay: "320ms" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[#0f6f63]">4. Үүсгэсэн асуултууд</h2>
              <span className="rounded-full border border-[#9fd9ce] bg-white px-3 py-1 text-xs font-semibold text-[#0f6f63]">
                {result.questionCountGenerated} / {result.questionCountRequested}
              </span>
              <span className="rounded-full border border-[#f0cc8f] bg-[#fff8e8] px-3 py-1 text-xs font-semibold text-[#955312]">
                Page {result.startPage} - {result.endPage}
              </span>
            </div>

            {result.warnings && result.warnings.length > 0 && (
              <div className="mt-4 space-y-2 rounded-2xl border border-[#f0cc8f] bg-[#fff8e8] p-3 text-sm text-[#955312]">
                {result.warnings.map((warning, idx) => (
                  <p key={`${warning}-${idx}`}>{warning}</p>
                ))}
              </div>
            )}

            <div className="mt-5 grid gap-4">
              {result.questions.map((item, idx) => (
                <article
                  key={`${item.question}-${idx}`}
                  className="rounded-2xl border border-[#d0ebe6] bg-white p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#0f6f63] px-2 text-xs font-bold text-white">
                      {idx + 1}
                    </span>
                    <span className="rounded-full bg-[#ecfff5] px-2 py-0.5 text-xs font-semibold text-[#0f6f45]">
                      {formatDifficulty(item.difficulty)}
                    </span>
                    <span className="rounded-full bg-[#fff1df] px-2 py-0.5 text-xs font-semibold text-[#a05a27]">
                      {formatType(item.type)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-[#23413d]">{item.question}</h3>
                  <ul className="mt-3 grid gap-2 text-sm text-[#355d58]">
                    {item.choices.map((choice, choiceIdx) => (
                      <li
                        key={`${choice}-${choiceIdx}`}
                        className={`rounded-xl border px-3 py-2 ${
                          choice.trim().toUpperCase().startsWith(item.correct_answer)
                            ? "border-[#89d1af] bg-[#edfff4] text-[#0f6f45]"
                            : "border-[#d0ebe6] bg-[#f9fffd]"
                        }`}
                      >
                        {formatChoice(choice)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm font-semibold text-[#0f6f45]">
                    Зөв хариу: {item.correct_answer}
                  </p>
                  <p className="mt-1 text-sm text-[#3f6a64]">
                    <span className="font-semibold">Тайлбар:</span>{" "}
                    {item.explanation || "Тайлбар өгөөгүй"}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
