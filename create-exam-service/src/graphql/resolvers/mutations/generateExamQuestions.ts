import type { GraphQLContext } from "../../context";
import type { ExamGenerationInput } from "../../types";
import { generateExamQuestionsWithAI } from "../../../lib/ai";

export const generateExamQuestionsMutation = {
	generateExamQuestions: async (
		_: unknown,
		args: { input: ExamGenerationInput },
		ctx: GraphQLContext,
	) => {
		const apiKey = ctx.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
		const questions = await generateExamQuestionsWithAI(apiKey, args.input);
		return { questions };
	},
};
