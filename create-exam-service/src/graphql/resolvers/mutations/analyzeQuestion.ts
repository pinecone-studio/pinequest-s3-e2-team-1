/**
 * `analyzeQuestion` mutation: Cloudflare **Workers AI** (`ctx.env.AI`, `wrangler.jsonc` → `ai.binding`).
 * Модель: `@cf/meta/llama-3-8b-instruct`. **Google Gemini / GEMINI_API_KEY энд ашиглагдахгүй**
 * — зөвхөн `generateExamQuestions` (`src/lib/ai.ts`) нь Gemini API руу явдаг.
 */
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../context";
import {
  Difficulty,
  QuestionAnalysisSuggestedType,
} from "../../generated/resolvers-types";

const MODEL = "@cf/meta/llama-3-8b-instruct" as const;

const SYSTEM_MESSAGE = `
Чи бол боловсролын эксперт. Энэ хүсэлт нь зөвхөн НЭГ төрлийн үр дүн шаардана:
олон сонголттой асуулт (MCQ) — яг ДӨРВӨН сонголт, НЭГ зөв хариулт.

Дүрмүүд:
- suggestedType үргэлж "MCQ" байна.
- options нь яг 4 элементтэй string массив; сонголтууд монгол/тоо/томьёо байж болно, утга нь өөр хоорондоо өөр байна.
- correctAnswer нь options доторх нэг сонголтын яг тэр тексттэй таарна (хуулж тавь).
- Асуулт нь математик, физик, ерөнхий мэдлэг — аль ч байсан дээрх MCQ хэлбэрээр зохио.

Монгол хэлээр: explanation, tags, source, skillLevel.

JSON бүтэц (skillLevel: Мэдлэг | Ойлгомж | Хэрэглээ | Шинжилгээ-ийн нэг):
{
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "points": number,
  "suggestedType": "MCQ",
  "options": ["сонголт1", "сонголт2", "сонголт3", "сонголт4"],
  "correctAnswer": "сонголтуудын нэгтэй яг ижил мөр",
  "explanation": "Монгол хэлээрх аргачлал",
  "tags": ["сэдэв"],
  "source": "Эх сурвалжийн таамаглал",
  "skillLevel": "Ойлгомж"
}
Зөвхөн цэвэр JSON буцаа.
`.trim();

function extractJsonText(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function parseDifficulty(v: unknown): Difficulty {
  const s = String(v ?? "").toUpperCase();
  if (s === Difficulty.Easy) return Difficulty.Easy;
  if (s === Difficulty.Hard) return Difficulty.Hard;
  return Difficulty.Medium;
}

const MCQ_OPTION_LABELS = ["А", "Б", "В", "Г"] as const;

/**
 * Энэ mutation зөвхөн MCQ — үргэлж яг 4 сонголт, зөв хариулт нь тэдний нэг.
 */
function ensureFourMcqOptions(
  options: string[] | null,
  correctAnswer: string,
): { options: string[]; correctAnswer: string } {
  const cleaned = (options ?? [])
    .map((x) => String(x).trim())
    .filter((s) => s.length > 0);
  const four: string[] = cleaned.slice(0, 4);
  while (four.length < 4) {
    const label = MCQ_OPTION_LABELS[four.length];
    four.push(`${label} хувилбар (засах)`);
  }

  let answer = correctAnswer.trim();
  if (answer && !four.includes(answer)) {
    const lower = answer.toLowerCase();
    const byCase = four.find((o) => o.toLowerCase() === lower);
    if (byCase) answer = byCase;
    else {
      const contains = four.find(
        (o) => o.includes(answer) || answer.includes(o),
      );
      answer = contains ?? four[0] ?? answer;
    }
  }
  if (!answer) answer = four[0] ?? "";

  return { options: four, correctAnswer: answer };
}

type Args = { prompt: string };

export const analyzeQuestionMutation = {
  analyzeQuestion: async (_: unknown, args: Args, ctx: GraphQLContext) => {
    const prompt = args.prompt?.trim();
    if (!prompt) {
      throw new GraphQLError("prompt хоосон байж болохгүй.");
    }

    const ai = ctx.env.AI;
    if (!ai) {
      throw new GraphQLError(
        "Workers AI binding (AI) идэвхгүй байна. wrangler.jsonc болон Cloudflare орчинд deploy хийнэ үү.",
      );
    }

    try {
      const response = await ai.run(MODEL, {
        messages: [
          { role: "system", content: SYSTEM_MESSAGE },
          { role: "user", content: prompt },
        ],
      });

      const text = response.response?.trim();
      if (!text) {
        throw new Error("AI хариу хоосон байна.");
      }

      const jsonText = extractJsonText(text);
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;

      const pointsRaw = parsed.points;
      const points =
        typeof pointsRaw === "number" && Number.isFinite(pointsRaw)
          ? Math.max(0, Math.floor(pointsRaw))
          : 1;

      const tagsRaw = parsed.tags;
      const tags = Array.isArray(tagsRaw) ? tagsRaw.map((x) => String(x)) : [];

      const optionsRaw = parsed.options;
      const optionsFromAi =
        optionsRaw === null || optionsRaw === undefined
          ? null
          : Array.isArray(optionsRaw)
            ? optionsRaw.map((x) => String(x))
            : null;

      const correctRaw = String(parsed.correctAnswer ?? "");
      const { options: optionsFour, correctAnswer: correctFixed } =
        ensureFourMcqOptions(optionsFromAi, correctRaw);

      return {
        difficulty: parseDifficulty(parsed.difficulty),
        points,
        tags,
        explanation: String(parsed.explanation ?? ""),
        options: optionsFour,
        correctAnswer: correctFixed,
        suggestedType: QuestionAnalysisSuggestedType.Mcq,
        source: String(parsed.source ?? "Тодорхойгүй").trim() || "Тодорхойгүй",
        skillLevel: String(parsed.skillLevel ?? "Ойлгомж").trim() || "Ойлгомж",
      };
    } catch (err) {
      console.error("AI Analysis Error:", err);
      const msg = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
      throw new GraphQLError(`AI асуултыг шинжлэхэд алдаа: ${msg}`);
    }
  },
};
