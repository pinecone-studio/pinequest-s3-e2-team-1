import { GoogleGenerativeAI } from "@google/generative-ai";
import { asc, eq } from "drizzle-orm";

import { getDb } from "../../../src/db";
import {
  examVariantJobs,
  examVariantQuestions,
  examVariants,
  newExamQuestions,
  newExams,
} from "../../../src/db/schema";

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GOOGLE_AI_API_KEY?: string;
  GEMINI_MODEL: string;
}

type ExamVariantMessageBody = {
  jobId: string;
  examId?: string | null;
  variantCount: number;
  requestedBy?: string;
};

function extractJsonText(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function parseGeminiJson(raw: string): Record<string, unknown> {
  const extracted = extractJsonText(raw)
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(extracted) as Record<string, unknown>;
}

function uuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildVariantPrompt(args: {
  examTitle: string;
  variantCount: number;
  questions: Array<{
    order: number;
    prompt: string;
    type: string;
    options?: string[] | null;
    correctAnswer?: string | null;
    explanation?: string | null;
  }>;
}) {
  return `
Чи Монгол хэл дээр шалгалтын ижил бүтэцтэй шинэ хувилбар үүсгэдэг AI.
ЗӨВХӨН нэг JSON object буцаа. Markdown, code fence, нэмэлт тайлбар бүү бич.

Даалгавар:
- Өгөгдсөн асуултуудын бүтцийг хадгал.
- Асуултын дараалал, төрөл, ерөнхий загвар, хүндрэлийн түвшинг хадгал.
- Томьёоны бүтэц, хувьсагчийн логик, бодлогын хэлбэрийг өөрчлөхгүй.
- Зөвхөн доторх тоонууд, тогтмолууд, шаардлагатай бол сонголтын утгуудыг өөрчил.
- Нэг variant дотор асуултын order, type-ийг яг хэвээр хадгал.
- Хариуг монголоор өг.

 SINGLE_CHOICE дүрэм:
- options-ийн тоо эх асуулттай ижил байна.
- options-ийг шинэ тоонд тааруулж шинэчил.
- duplicate option бүү гарга.
- яг нэг зөв хариулттай байна.
- correctAnswer нь options доторх нэг string-тэй яг ижил таарч байна.

 WRITTEN дүрэм:
- options хоосон массив [] байна.
- correctAnswer-ийг шинээр бодож ол.
- explanation нь богино боловч шалгах боломжтой байна.

 Ерөнхий дүрэм:
- Хэрэв эх асуултын prompt-д LaTeX/томьёо байвал түүнийг хадгал.
- Боломжгүй, буруу, шийдгүй утга бүү сонго.
- JSON-оос гадуур юу ч бүү нэм.

JSON бүтэц:
{
  "variants": [
    {
      "variantNumber": 1,
      "title": "Хувилбар 1",
      "questions": [
        {
          "order": 1,
          "prompt": "...",
          "type": "single-choice" | "written",
          "options": ["...", "..."],
          "correctAnswer": "...",
          "explanation": "..."
        }
      ]
    }
  ]
}

Шалгалтын нэр: ${args.examTitle}
Үүсгэх хувилбарын тоо: ${args.variantCount}

Анхаар:
- Хэрэв нэг асуулт байсан ч variants массивд ${args.variantCount} ширхэг бүрэн variant буцаа.
- Асуулт бүр дээр шинэ тоон утга сонгосны дараа зөв хариуг дахин бод.
- Хэрэв type нь "written" бол options=[] буцаа.

Эх асуултууд:
${JSON.stringify(args.questions, null, 2)}
`.trim();
}

async function runVariantGeneration(
  env: Env,
  body: ExamVariantMessageBody,
): Promise<void> {
  const db = getDb(env.DB);
  const jobId = String(body.jobId ?? "").trim();
  const variantCount = Number(body.variantCount ?? 0);

  if (!jobId) {
    throw new Error("jobId хоосон байна.");
  }

  if (!Number.isFinite(variantCount) || variantCount < 1) {
    throw new Error("variantCount 1-ээс их байх ёстой.");
  }

  const [job] = await db
    .select()
    .from(examVariantJobs)
    .where(eq(examVariantJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw new Error(`exam_variant_jobs дээр job олдсонгүй: ${jobId}`);
  }

  const examId = String(job.examId ?? body.examId ?? "").trim();
  const now = new Date().toISOString();

  await db
    .update(examVariantJobs)
    .set({
      status: "processing",
      startedAt: job.startedAt ?? now,
      updatedAt: now,
      errorMessage: null,
    })
    .where(eq(examVariantJobs.id, jobId));

  const [exam] = examId
    ? await db
        .select({
          id: newExams.id,
          title: newExams.title,
          payloadJson: newExams.payloadJson,
          withVariants: newExams.withVariants,
          variantCount: newExams.variantCount,
        })
        .from(newExams)
        .where(eq(newExams.id, examId))
        .limit(1)
    : [];

  const questions = await db
    .select({
      id: newExamQuestions.id,
      position: newExamQuestions.position,
      type: newExamQuestions.type,
      prompt: newExamQuestions.prompt,
      points: newExamQuestions.points,
      optionsJson: newExamQuestions.optionsJson,
      correctOption: newExamQuestions.correctOption,
      correctAnswer: newExamQuestions.correctAnswer,
      responseGuide: newExamQuestions.responseGuide,
      answerLatex: newExamQuestions.answerLatex,
    })
    .from(newExamQuestions)
    .where(eq(newExamQuestions.examId, examId))
    .orderBy(asc(newExamQuestions.position));

  const apiKey = env.GOOGLE_AI_API_KEY?.trim() || env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY эсвэл GEMINI_API_KEY тохируулаагүй.");
  }

  const modelName = env.GEMINI_MODEL?.trim() || "gemini-flash-latest";

  const sourceQuestions =
    questions.length > 0
      ? questions.map((question) => ({
          order: question.position,
          prompt: question.prompt,
          type: question.type === "math" ? "written" : "single-choice",
          options: question.optionsJson
            ? (JSON.parse(question.optionsJson) as string[])
            : null,
          correctAnswer:
            question.correctAnswer ??
            (typeof question.answerLatex === "string" && question.answerLatex.trim()
              ? question.answerLatex
              : null),
          explanation: question.responseGuide ?? null,
        }))
      : (() => {
          try {
            const parsed = JSON.parse(job.sourceQuestionsJson) as {
              order: number;
              prompt: string;
              type: string;
              options?: string[] | null;
              correctAnswer?: string | null;
              explanation?: string | null;
            }[];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();

  if (!sourceQuestions.length) {
    throw new Error("Variant үүсгэх эх асуулт олдсонгүй.");
  }

  console.log(
    JSON.stringify({
      worker: "exam-variant-consumer",
      stage: "processing",
      jobId,
      examId,
      examTitle: exam?.title ?? "Шалгалтын AI хувилбар",
      questionCount: sourceQuestions.length,
      variantCount,
      requestedBy: body.requestedBy ?? job.requestedBy ?? null,
      modelName,
    }),
  );

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const prompt = buildVariantPrompt({
    examTitle: exam?.title ?? "Шалгалтын AI хувилбар",
    variantCount,
    questions: sourceQuestions,
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text()?.trim();
  if (!text) {
    throw new Error("Gemini хариу хоосон байна.");
  }

  const parsed = parseGeminiJson(text);
  const completedAt = new Date().toISOString();

  const variants = Array.isArray(parsed.variants) ? parsed.variants : [];

  await db.delete(examVariants).where(eq(examVariants.jobId, jobId));

  for (const [variantIndex, variant] of variants.entries()) {
    const variantId = uuid();
    const rawQuestions =
      variant && typeof variant === "object" && Array.isArray((variant as { questions?: unknown[] }).questions)
        ? ((variant as { questions: unknown[] }).questions ?? [])
        : [];

    await db.insert(examVariants).values({
      id: variantId,
      jobId,
      examId: exam?.id ?? null,
      variantNumber:
        typeof (variant as { variantNumber?: unknown })?.variantNumber === "number"
          ? Math.floor((variant as { variantNumber: number }).variantNumber)
          : variantIndex + 1,
      title:
        String((variant as { title?: unknown })?.title ?? "").trim() ||
        `Хувилбар ${variantIndex + 1}`,
      createdAt: completedAt,
      updatedAt: completedAt,
    });

    if (rawQuestions.length > 0) {
      await db.insert(examVariantQuestions).values(
        rawQuestions.map((question, questionIndex) => ({
          id: uuid(),
          variantId,
          position:
            typeof (question as { order?: unknown })?.order === "number"
              ? Math.floor((question as { order: number }).order)
              : questionIndex + 1,
          type: String((question as { type?: unknown })?.type ?? "single-choice"),
          prompt: String((question as { prompt?: unknown })?.prompt ?? "").trim(),
          optionsJson: Array.isArray((question as { options?: unknown[] })?.options)
            ? JSON.stringify((question as { options: unknown[] }).options.map(String))
            : null,
          correctAnswer:
            String((question as { correctAnswer?: unknown })?.correctAnswer ?? "").trim() ||
            null,
          explanation:
            String((question as { explanation?: unknown })?.explanation ?? "").trim() ||
            null,
          createdAt: completedAt,
          updatedAt: completedAt,
        })),
      );
    }
  }

  await db
    .update(examVariantJobs)
    .set({
      status: "completed",
      resultJson: JSON.stringify(parsed),
      completedAt,
      updatedAt: completedAt,
      errorMessage: null,
    })
    .where(eq(examVariantJobs.id, jobId));

  if (exam?.id) {
    await db
      .update(newExams)
      .set({
        withVariants: 1,
        variantCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(newExams.id, exam.id));
  }
}

export default {
  async queue(batch: MessageBatch<ExamVariantMessageBody>, env: Env) {
    for (const message of batch.messages) {
      try {
        await runVariantGeneration(env, message.body);
        message.ack();
      } catch (error) {
        console.error("exam-variant-consumer error", error);
        const db = getDb(env.DB);
        const jobId = String(message.body.jobId ?? "").trim();
        if (jobId) {
          await db
            .update(examVariantJobs)
            .set({
              status: "failed",
              errorMessage: error instanceof Error ? error.message : String(error),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(examVariantJobs.id, jobId));
        }
        message.ack();
      }
    }
  },
};
