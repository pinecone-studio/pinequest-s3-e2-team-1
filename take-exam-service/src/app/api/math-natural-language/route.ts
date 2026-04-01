import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { chatWithOllama, DEFAULT_OLLAMA_MODEL } from "@/lib/ollama";

type RouteEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
};

type ConvertResponse = {
  explanation: string;
  expression: string;
  source: "fallback" | "gemini" | "ollama";
};

type PreferredProvider = "auto" | "gemini" | "ollama";

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

const getEnv = () =>
  (getCloudflareContext() as unknown as { env: RouteEnv }).env;

const getGeminiApiKey = (env: RouteEnv) =>
  env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

const getGeminiModel = (env: RouteEnv) =>
  env.GEMINI_MODEL ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

const getOllamaApiKey = (env: RouteEnv) =>
  env.OLLAMA_API_KEY ?? process.env.OLLAMA_API_KEY;

const getOllamaBaseUrl = (env: RouteEnv) =>
  env.OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL;

const getOllamaModel = (env: RouteEnv) =>
  env.OLLAMA_MODEL ?? process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;

const sanitizeExpression = (value: string) =>
  value
    .replace(/\$/g, "")
    .replace(/\\,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseAiResponse = (
  raw: string | undefined,
  source: "gemini" | "ollama",
): ConvertResponse | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ConvertResponse>;
    if (
      typeof parsed.expression !== "string" ||
      typeof parsed.explanation !== "string"
    ) {
      return null;
    }

    const expression = sanitizeExpression(parsed.expression);
    if (!expression) {
      return null;
    }

    return {
      expression,
      explanation: parsed.explanation.trim() || "AI хөрвүүлэлт хийлээ.",
      source,
    };
  } catch {
    return null;
  }
};

const buildPrompt = (text: string) => ({
  system:
    'Та сурагчийн энгийн хэлээр бичсэн математикийн өгүүлбэрийг MathQuill-д оруулахад бэлэн latex/text илэрхийлэл болгон хөрвүүлнэ. Зөвхөн JSON буцаа: {"expression":"...","explanation":"..."} . expression нь $ тэмдэггүй, товч, зөв математикийн бичлэг байна. explanation нь монголоор 1 өгүүлбэр байна.',
  user: `Энэ өгүүлбэрийг томьёо болго: ${text}`,
});

async function convertWithOllama(
  text: string,
  env: RouteEnv,
): Promise<ConvertResponse | null> {
  const baseUrl = getOllamaBaseUrl(env);
  if (!baseUrl) {
    return null;
  }

  const ollama = await chatWithOllama({
    apiKey: getOllamaApiKey(env),
    baseUrl,
    context: "Math natural language",
    messages: [
      { role: "system", content: buildPrompt(text).system },
      { role: "user", content: buildPrompt(text).user },
    ],
    model: getOllamaModel(env),
  });
  return parseAiResponse(ollama.content, "ollama");
}

async function convertWithGemini(
  text: string,
  env: RouteEnv,
): Promise<ConvertResponse | null> {
  const apiKey = getGeminiApiKey(env);
  if (!apiKey) {
    return null;
  }

  const response = await fetch(
    `${GEMINI_API_BASE_URL}/models/${getGeminiModel(env)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${buildPrompt(text).system}\n\n${buildPrompt(text).user}`,
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const textPart = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("");

  return parseAiResponse(textPart, "gemini");
}

function convertWithFallback(text: string): ConvertResponse {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/квадрат|квадрат дээр|kavdrat|kvadrat/g, " квадрат ")
    .replace(/нэмэх нь|nemeh ni/g, " + ")
    .replace(/хасах нь|hasah ni/g, " - ")
    .replace(/үржих нь|urjih ni/g, " * ")
    .replace(/тэнцүү|tentsuu/g, " = ");

  let expression = normalized
    .replace(/([a-zа-я])\s*квадрат/gi, "$1^{2}")
    .replace(/([a-zа-я])\s*куб/gi, "$1^{3}")
    .replace(/\s+/g, " ")
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*=\s*/g, "=")
    .replace(/\s*\*\s*/g, "\\times ")
    .trim();

  expression = expression
    .replace(/([0-9])\s*([a-z])/gi, "$1$2")
    .replace(/([a-z])\s+([0-9])/gi, "$1$2");

  if (!expression) {
    expression = sanitizeExpression(text);
  }

  return {
    expression,
    explanation:
      "AI холболтгүй үед дүрэмд тулгуурлан ойролцоогоор томьёо болголоо. Илэрхийллийг шалгаад засварлана уу.",
    source: "fallback",
  };
}

export async function POST(request: Request) {
  try {
    const env = getEnv();
    const body = (await request.json()) as {
      preferredProvider?: PreferredProvider;
      text?: string;
    };
    const text = body.text?.trim() ?? "";
    const preferredProvider = body.preferredProvider ?? "auto";

    if (!text) {
      return NextResponse.json(
        { message: "Хөрвүүлэх текстээ оруулна уу." },
        { status: 400 },
      );
    }

    if (preferredProvider === "gemini") {
      const gemini = await convertWithGemini(text, env).catch(() => null);
      if (gemini) {
        return NextResponse.json(gemini, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    } else if (preferredProvider === "ollama") {
      const ollama = await convertWithOllama(text, env).catch(() => null);
      if (ollama) {
        return NextResponse.json(ollama, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    } else {
      const ollama = await convertWithOllama(text, env).catch(() => null);
      if (ollama) {
        return NextResponse.json(ollama, {
          headers: { "Cache-Control": "no-store" },
        });
      }

      const gemini = await convertWithGemini(text, env).catch(() => null);
      if (gemini) {
        return NextResponse.json(gemini, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    }

    if (preferredProvider !== "gemini") {
      const gemini = await convertWithGemini(text, env).catch(() => null);
      if (gemini) {
        return NextResponse.json(gemini, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    }

    if (preferredProvider !== "ollama") {
      const ollama = await convertWithOllama(text, env).catch(() => null);
      if (ollama) {
        return NextResponse.json(ollama, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    }

    return NextResponse.json(convertWithFallback(text), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Текстийг томьёо болгож чадсангүй.",
      },
      { status: 400 },
    );
  }
}
