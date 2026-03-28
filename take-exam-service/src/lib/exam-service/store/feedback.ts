import type {
	AttemptFeedback,
	ExamProgress,
	ExamResultSummary,
} from "@/lib/exam-service/types";
import type { DbClient } from "@/lib/db";
import { getAttemptMonitoringSummaries } from "./activity";

type AiBinding = {
	run: (
		model: string,
		input: {
			messages: Array<{ role: "system" | "user"; content: string }>;
			response_format?: { type: "json_object" };
		},
	) => Promise<{ response?: string }>;
};

type AttemptFeedbackContext = {
	attemptId: string;
	progress: ExamProgress;
	result?: ExamResultSummary;
};

const FALLBACK_MODEL = "@cf/openai/gpt-oss-20b";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE_URL =
	"https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_OLLAMA_MODEL = "llama3.1";

type FeedbackOptions = {
	ai?: AiBinding;
	geminiApiKey?: string;
	geminiModel?: string;
	ollamaApiKey?: string;
	ollamaBaseUrl?: string;
	ollamaModel?: string;
};

const safeJsonParse = (value: string): AttemptFeedback | null => {
	try {
		const parsed = JSON.parse(value) as Partial<AttemptFeedback>;
		if (
			typeof parsed.headline !== "string" ||
			typeof parsed.summary !== "string" ||
			!Array.isArray(parsed.strengths) ||
			!Array.isArray(parsed.improvements)
		) {
			return null;
		}

		return {
			headline: parsed.headline.trim(),
			summary: parsed.summary.trim(),
			strengths: parsed.strengths
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
				.slice(0, 3),
			improvements: parsed.improvements
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
				.slice(0, 3),
		};
	} catch {
		return null;
	}
};

export const parseAttemptFeedback = (
	value?: string | null,
): AttemptFeedback | undefined => {
	if (!value) return undefined;
	return safeJsonParse(value) ?? undefined;
};

export const stringifyAttemptFeedback = (
	feedback?: AttemptFeedback,
): string | null => (feedback ? JSON.stringify(feedback) : null);

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const buildSystemPrompt = () =>
	"Та шалгалтын дараах богино, дэмжсэн өнгө аястай монгол хэлний feedback JSON үүсгэнэ. headline, summary, strengths, improvements гэсэн 4 key ашигла. strengths болон improvements нь тус бүр 1-3 мөртэй массив байна.";

const buildUserPayload = (
	progress: ExamProgress,
	result: ExamResultSummary | undefined,
	monitoringSummary: Awaited<
		ReturnType<typeof getAttemptMonitoringSummaries>
	> extends Map<string, infer TValue>
		? TValue | undefined
		: undefined,
	fallback: AttemptFeedback,
) =>
	JSON.stringify({
		progress,
		result: result ?? null,
		monitoring: monitoringSummary ?? null,
		fallback,
	});

const generateGeminiFeedback = async (
	systemPrompt: string,
	userPayload: string,
	options: FeedbackOptions,
) => {
	if (!options.geminiApiKey) {
		return null;
	}

	const response = await fetch(
		`${GEMINI_API_BASE_URL}/models/${options.geminiModel ?? DEFAULT_GEMINI_MODEL}:generateContent?key=${options.geminiApiKey}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				systemInstruction: {
					parts: [{ text: systemPrompt }],
				},
				contents: [
					{
						role: "user",
						parts: [{ text: userPayload }],
					},
				],
				generationConfig: {
					responseMimeType: "application/json",
					temperature: 0.4,
				},
			}),
		},
	);

	if (!response.ok) {
		throw new Error(`Gemini feedback failed with status ${response.status}`);
	}

	const payload = (await response.json()) as {
		candidates?: Array<{
			content?: {
				parts?: Array<{
					text?: string;
				}>;
			};
		}>;
	};
	const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
	return text ? safeJsonParse(text) : null;
};

const generateOllamaFeedback = async (
	systemPrompt: string,
	userPayload: string,
	options: FeedbackOptions,
) => {
	if (!options.ollamaBaseUrl) {
		return null;
	}

	const response = await fetch(`${normalizeBaseUrl(options.ollamaBaseUrl)}/api/chat`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(options.ollamaApiKey
				? { Authorization: `Bearer ${options.ollamaApiKey}` }
				: {}),
		},
		body: JSON.stringify({
			model: options.ollamaModel ?? DEFAULT_OLLAMA_MODEL,
			stream: false,
			format: "json",
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPayload },
			],
		}),
	});

	if (!response.ok) {
		throw new Error(`Ollama feedback failed with status ${response.status}`);
	}

	const payload = (await response.json()) as {
		error?: string;
		message?: {
			content?: string;
		};
		response?: string;
	};

	if (payload.error) {
		throw new Error(payload.error);
	}

	const content = payload.message?.content ?? payload.response;
	return content ? safeJsonParse(content) : null;
};

const buildFallbackFeedback = (
	progress: ExamProgress,
	result: ExamResultSummary | undefined,
	monitoringSummary: Awaited<
		ReturnType<typeof getAttemptMonitoringSummaries>
	> extends Map<string, infer TValue>
		? TValue | undefined
		: undefined,
): AttemptFeedback => {
	const strengths: string[] = [];
	const improvements: string[] = [];

	if (progress.completionRate >= 100) {
		strengths.push("Бүх асуултад хариулахыг оролдсон байна.");
	} else if (progress.completionRate >= 75) {
		strengths.push("Ихэнх асуултаа бүрэн бөглөсөн байна.");
	} else {
		improvements.push("Хариулаагүй үлдсэн асуултуудаа дахин шалгаж хэвшээрэй.");
	}

	if (result) {
		if (result.percentage >= 80) {
			strengths.push("Ойлголт сайн, үндсэн агуулгаа зөв барьжээ.");
		} else if (result.percentage >= 60) {
			strengths.push("Суурь ойлголт байгаа ч зарим асуултад нягтлах хэрэгтэй байна.");
		} else {
			improvements.push("Сэдвийн суурь ухагдахуунаа дахин давтаж баталгаажуулаарай.");
		}

		if (result.unansweredCount > 0) {
			improvements.push("Хугацааны менежментээ сайжруулбал дутуу асуулт багасна.");
		}
	}

	if ((monitoringSummary?.dangerCount ?? 0) === 0) {
		strengths.push("Шалгалтын явцад анхаарлаа харьцангуй тогтвортой хадгалжээ.");
	} else {
		improvements.push("Tab солих, fullscreen гарах зэрэг үйлдлээ багасгаарай.");
	}

	if (strengths.length === 0) {
		strengths.push("Шалгалтаа дуусгаж, хариултаа амжилттай илгээлээ.");
	}

	if (improvements.length === 0) {
		improvements.push("Дараагийн удаа шийдлээ дахин нэг нягталж хэвшээрэй.");
	}

	return {
		headline: result
			? "Шалгалтын дараах зөвлөмж"
			: "Хариулт амжилттай илгээгдлээ",
		summary: result
			? `Та ${result.maxScore} онооноос ${result.score} авч, ${result.percentage}% гүйцэтгэл үзүүллээ.`
			: "Таны хариулт багшийн систем рүү илгээгдсэн. Дүн батлагдахаас өмнө ерөнхий зөвлөмжийг хүргэж байна.",
		strengths: strengths.slice(0, 3),
		improvements: improvements.slice(0, 3),
	};
};

export const generateAttemptFeedback = async (
	db: DbClient,
	context: AttemptFeedbackContext,
	options: FeedbackOptions = {},
): Promise<AttemptFeedback> => {
	const monitoringSummary = (
		await getAttemptMonitoringSummaries(db, [context.attemptId])
	).get(context.attemptId);

	const fallback = buildFallbackFeedback(
		context.progress,
		context.result,
		monitoringSummary,
	);

	try {
		const systemPrompt = buildSystemPrompt();
		const userPayload = buildUserPayload(
			context.progress,
			context.result,
			monitoringSummary,
			fallback,
		);

		try {
			const geminiFeedback = await generateGeminiFeedback(
				systemPrompt,
				userPayload,
				options,
			);
			if (geminiFeedback) {
				return geminiFeedback;
			}
		} catch {
			// Try the next provider.
		}

		try {
			const ollamaFeedback = await generateOllamaFeedback(
				systemPrompt,
				userPayload,
				options,
			);
			if (ollamaFeedback) {
				return ollamaFeedback;
			}
		} catch {
			// Fall through to the next provider.
		}

		if (!options.ai) {
			return fallback;
		}

		const response = await options.ai.run(FALLBACK_MODEL, {
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPayload },
			],
			response_format: { type: "json_object" },
		});

		const parsed = response.response ? safeJsonParse(response.response) : null;
		return parsed ?? fallback;
	} catch {
		return fallback;
	}
};
