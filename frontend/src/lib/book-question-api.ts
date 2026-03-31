export type UploadedBookPagePreview = {
  pageNumber: number;
  preview: string;
};

export type BookHealthResponse = {
  ok: boolean;
  service: string;
  model: string;
};

export type BookListItem = {
  id: string;
  title: string;
  fileName: string;
  pageCount: number;
  createdAt: string;
};

export type BookListResponse = {
  books: BookListItem[];
};

export type UploadBookResponse = {
  bookId: string;
  title: string;
  fileName: string;
  pageCount: number;
  pages: UploadedBookPagePreview[];
};

export type GeneratedBookQuestion = {
  question: string;
  choices: string[];
  correct_answer: "A" | "B" | "C" | "D";
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  type: "factual" | "conceptual" | "analytical";
};

export type GenerateBookQuestionsRequest = {
  bookId: string;
  startPage: number;
  endPage: number;
  questionCount?: number;
};

export type GenerateBookQuestionsResponse = {
  bookId: string;
  startPage: number;
  endPage: number;
  questionCountRequested: number;
  questionCountGenerated: number;
  questions: GeneratedBookQuestion[];
  warnings?: string[];
};

export function getBookApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_BOOK_API_URL || "http://localhost:4000").replace(
    /\/+$/,
    "",
  );
}

async function parseApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function uploadBookPdf(file: File): Promise<UploadBookResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getBookApiBaseUrl()}/api/books/upload`, {
    body: formData,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as UploadBookResponse;
}

export async function requestBookQuestions(
  input: GenerateBookQuestionsRequest,
): Promise<GenerateBookQuestionsResponse> {
  const response = await fetch(
    `${getBookApiBaseUrl()}/api/books/generate-questions`,
    {
      body: JSON.stringify({
        ...input,
        questionCount: input.questionCount ?? 20,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as GenerateBookQuestionsResponse;
}

export async function fetchBookHealth(): Promise<BookHealthResponse> {
  const response = await fetch(`${getBookApiBaseUrl()}/health`);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as BookHealthResponse;
}

export async function fetchBooks(): Promise<BookListResponse> {
  const response = await fetch(`${getBookApiBaseUrl()}/api/books`);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as BookListResponse;
}
