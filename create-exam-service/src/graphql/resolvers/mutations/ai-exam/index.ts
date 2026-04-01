import { analyzeQuestionMutation } from "./analyzeQuestion";
import { createAiExamTemplateMutation } from "./createAiExamTemplate";
import { generateQuestionAnswerMutation } from "./generateQuestionAnswer";
import { generateExamQuestionsMutation } from "./generateExamQuestions";
import { regenerateQuestionAnswerMutation } from "./regenerateQuestionAnswer";
import { requestExamVariantsMutation } from "./requestExamVariants";

/** AI шалгалт үүсгэх / загвар / асуулт шинжлэх */
export const aiExamMutationResolvers = {
	...analyzeQuestionMutation,
	...createAiExamTemplateMutation,
	...generateQuestionAnswerMutation,
	...generateExamQuestionsMutation,
	...regenerateQuestionAnswerMutation,
	...requestExamVariantsMutation,
};
