const MUTATION = /* GraphQL */ `
	mutation GenerateExamQuestions($input: ExamGenerationInput!) {
		generateExamQuestions(input: $input) {
			questions {
				id
				text
				format
				difficulty
				options
				correctAnswer
				explanation
			}
		}
	}
`;

export type QuestionFormatId =
	| "SINGLE_CHOICE"
	| "MULTIPLE_CHOICE"
	| "MATCHING"
	| "FILL_IN"
	| "WRITTEN";

export type ExamGenerationInput = {
	gradeClass: string;
	subject: string;
	examType:
		| "PERIODIC_1"
		| "PERIODIC_2"
		| "MIDTERM"
		| "TOPIC";
	topicScope: string;
	examDate: string;
	examTime: string;
	durationMinutes: number;
	totalQuestionCount: number;
	difficultyDistribution: {
		easy: number;
		medium: number;
		hard: number;
	};
	difficultyPoints?: {
		easyPoints?: number | null;
		mediumPoints?: number | null;
		hardPoints?: number | null;
	} | null;
	difficultyFormats: {
		easy: QuestionFormatId;
		medium: QuestionFormatId;
		hard: QuestionFormatId;
	};
};

export type GeneratedQuestion = {
	id: string;
	text: string;
	format: string;
	difficulty: string;
	options: string[] | null;
	correctAnswer: string | null;
	explanation: string | null;
};

export function getCreateExamGraphqlUrl(): string {
	return (
		process.env.NEXT_PUBLIC_CREATE_EXAM_GRAPHQL_URL ??
		"http://localhost:3001/api/graphql"
	);
}

export async function requestGenerateExamQuestions(
	input: ExamGenerationInput,
): Promise<GeneratedQuestion[]> {
	const res = await fetch(getCreateExamGraphqlUrl(), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			query: MUTATION,
			variables: { input },
		}),
	});

	const json: {
		data?: { generateExamQuestions?: { questions: GeneratedQuestion[] } };
		errors?: { message: string }[];
	} = await res.json();

	if (!res.ok) {
		throw new Error(`Сүлжээний алдаа: ${res.status}`);
	}
	if (json.errors?.length) {
		throw new Error(json.errors[0]?.message ?? "GraphQL алдаа");
	}
	const questions = json.data?.generateExamQuestions?.questions;
	if (!questions) {
		throw new Error("Хариу хоосон байна");
	}
	return questions;
}
