import { handleGeminiExamPost } from "@/server/gemini-exam";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleGeminiExamPost(request, {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });
}
