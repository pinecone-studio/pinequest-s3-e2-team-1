export const difficultyLevels = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof difficultyLevels)[number];

export const testStatuses = ["draft", "published"] as const;
export type TestStatus = (typeof testStatuses)[number];

export type QuestionType = "single-choice";

export type QuestionOption = {
	id: string;
	text: string;
};

export type EditableQuestion = {
	id: string;
	type: QuestionType;
	prompt: string;
	options: QuestionOption[];
	correctOptionId: string;
	explanation: string;
	points: number;
	competency: string;
};

export type TestCriteria = {
	gradeLevel: number;
	className: string;
	subject: string;
	topic: string;
	difficulty: Difficulty;
	questionCount: number;
};

export type StudentInfo = {
	id: string;
	name: string;
	className: string;
};

export type MockTestDraft = {
	title: string;
	description: string;
	criteria: TestCriteria;
	timeLimitMinutes: number;
	questions: EditableQuestion[];
};

export type MockTest = MockTestDraft & {
	id: string;
	status: TestStatus;
	version: number;
	createdAt: string;
	updatedAt: string;
	sourceTemplateId: string;
};

export type TeacherTestSummary = {
	id: string;
	title: string;
	status: TestStatus;
	criteria: TestCriteria;
	questionCount: number;
	updatedAt: string;
};

export type GenerateTestRequest = {
	gradeLevel: number;
	className: string;
	subject: string;
	topic: string;
	difficulty: Difficulty;
	questionCount?: number;
};

export type GenerateTestResponse = {
	test: MockTest;
	matchedTemplateId: string;
	availableTemplates: TestCriteria[];
};

export type UpdateTestRequest = {
	draft: MockTestDraft;
};

export type UpdateTestResponse = {
	test: MockTest;
};

export type SaveTestRequest = {
	testId: string;
};

export type SaveTestResponse = {
	test: MockTest;
};

export type DeleteTestResponse = {
	deletedTestId: string;
};

export type GetTestByIdResponse = {
	test: MockTest;
};

export type ListTestsResponse = {
	tests: TeacherTestSummary[];
};

export type StudentQuestion = {
	questionId: string;
	type: QuestionType;
	prompt: string;
	options: QuestionOption[];
	points: number;
	competency: string;
};

export type PersonalizedExam = {
	testId: string;
	title: string;
	description: string;
	criteria: TestCriteria;
	timeLimitMinutes: number;
	questions: StudentQuestion[];
};

export type StartExamRequest = {
	testId: string;
	studentId: string;
	studentName: string;
};

export type ExamProgress = {
	totalQuestions: number;
	answeredQuestions: number;
	remainingQuestions: number;
	completionRate: number;
};

export type ExamAnswerInput = {
	questionId: string;
	selectedOptionId: string | null;
};

export type ExamQuestionResult = {
	questionId: string;
	selectedOptionId: string | null;
	correctOptionId: string;
	isCorrect: boolean;
	pointsAwarded: number;
	maxPoints: number;
	explanation: string;
};

export type ExamResultSummary = {
	score: number;
	maxScore: number;
	percentage: number;
	correctCount: number;
	incorrectCount: number;
	unansweredCount: number;
	questionResults: ExamQuestionResult[];
};

export type StartExamResponse = {
	attemptId: string;
	status: "in_progress";
	studentId: string;
	studentName: string;
	startedAt: string;
	expiresAt: string;
	exam: PersonalizedExam;
	progress: ExamProgress;
};

export type SubmitAnswersRequest = {
	attemptId: string;
	answers: ExamAnswerInput[];
	finalize?: boolean;
};

export type SubmitAnswersResponse = {
	attemptId: string;
	status: "in_progress" | "submitted" | "approved";
	progress: ExamProgress;
	result?: ExamResultSummary;
};

export type GetProgressResponse = {
	attemptId: string;
	testId: string;
	status: "in_progress" | "submitted" | "approved";
	studentId: string;
	studentName: string;
	startedAt: string;
	expiresAt: string;
	submittedAt?: string;
	progress: ExamProgress;
	answers: ExamAnswerInput[];
	result?: ExamResultSummary;
};

export type AttemptSummary = {
	attemptId: string;
	testId: string;
	title: string;
	studentId: string;
	studentName: string;
	status: "in_progress" | "submitted" | "approved";
	score?: number;
	maxScore?: number;
	percentage?: number;
	startedAt: string;
	submittedAt?: string;
	result?: ExamResultSummary;
};

export type ListAttemptsResponse = {
	attempts: AttemptSummary[];
};
