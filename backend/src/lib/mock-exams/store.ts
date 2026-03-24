import type {
  EditableQuestion,
  GenerateTestRequest,
  MockTest,
  MockTestDraft,
  TeacherTestSummary,
  TestCriteria,
} from "@shared/contracts/mock-exam";
import { mockExamTemplates } from "@/lib/mock-exams/seed";
import type {
  GeneratorTemplate,
  GeneratorTestRecord,
} from "@/lib/mock-exams/schema";

const tests = new Map<string, GeneratorTestRecord>();

const normalizeText = (value: string) => value.trim().toLowerCase();

const nowIso = () => new Date().toISOString();

const createId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

const deepClone = <T>(value: T): T => structuredClone(value);

const shuffle = <T>(items: T[]) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const cloneQuestion = (question: EditableQuestion): EditableQuestion => {
  const optionIdMap = new Map<string, string>();
  const clonedOptions = question.options.map((option) => {
    const newId = createId("option");
    optionIdMap.set(option.id, newId);

    return {
      id: newId,
      text: option.text,
    };
  });

  return {
    ...question,
    id: createId("question"),
    options: clonedOptions,
    correctOptionId:
      optionIdMap.get(question.correctOptionId) ??
      clonedOptions[0]?.id ??
      createId("option"),
  };
};

const normalizeDraft = (draft: MockTestDraft): MockTestDraft => {
  if (!draft.title.trim()) {
    throw new Error("Test title is required.");
  }

  if (!draft.description.trim()) {
    throw new Error("Test description is required.");
  }

  if (draft.questions.length === 0) {
    throw new Error("At least one question is required.");
  }

  const normalizedQuestions = draft.questions.map((question, index) => {
    if (!question.prompt.trim()) {
      throw new Error(`Question ${index + 1} must have a prompt.`);
    }

    if (question.options.length < 2) {
      throw new Error(
        `Question ${index + 1} must have at least two answer options.`,
      );
    }

    const normalizedOptions = question.options.map((option, optionIndex) => {
      if (!option.text.trim()) {
        throw new Error(
          `Question ${index + 1}, option ${optionIndex + 1} cannot be empty.`,
        );
      }

      return {
        id: option.id || createId("option"),
        text: option.text.trim(),
      };
    });

    const optionIds = new Set(normalizedOptions.map((option) => option.id));

    if (!optionIds.has(question.correctOptionId)) {
      throw new Error(`Question ${index + 1} has an invalid correct answer.`);
    }

    return {
      ...question,
      id: question.id || createId("question"),
      prompt: question.prompt.trim(),
      explanation: question.explanation.trim(),
      competency: question.competency.trim() || "General reasoning",
      points: Math.max(1, Math.round(question.points || 1)),
      options: normalizedOptions,
    };
  });

  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    timeLimitMinutes: Math.max(5, Math.round(draft.timeLimitMinutes || 30)),
    criteria: {
      ...draft.criteria,
      className: (draft.criteria.className || "").trim(),
      subject: draft.criteria.subject.trim(),
      topic: draft.criteria.topic.trim(),
      questionCount: normalizedQuestions.length,
    },
    questions: normalizedQuestions,
  };
};

const toMockTest = (record: GeneratorTestRecord): MockTest => {
  const { publishedAt: _publishedAt, ...test } = record;
  return deepClone(test);
};

const toSummary = (record: GeneratorTestRecord): TeacherTestSummary => ({
  id: record.id,
  title: record.title,
  status: record.status,
  criteria: deepClone(record.criteria),
  questionCount: record.questions.length,
  updatedAt: record.updatedAt,
});

const findTemplate = (
  criteria: GenerateTestRequest,
): GeneratorTemplate | undefined =>
  mockExamTemplates.find((template) => {
    const templateCriteria = template.draft.criteria;

    return (
      templateCriteria.gradeLevel === criteria.gradeLevel &&
      normalizeText(templateCriteria.subject) ===
      normalizeText(criteria.subject) && // "math" !== "математик"
      normalizeText(templateCriteria.topic) === normalizeText(criteria.topic) && // "algorithm" !== "алгоритм"
      templateCriteria.difficulty === criteria.difficulty
    );
  });

const cloneDraftFromTemplate = (
  template: GeneratorTemplate,
  requestedQuestionCount?: number,
): MockTestDraft => {
  const maxQuestions = template.draft.questions.length;
  const safeQuestionCount = Math.min(
    Math.max(
      1,
      Math.round(
        requestedQuestionCount ?? template.draft.criteria.questionCount,
      ),
    ),
    maxQuestions,
  );
  const sampledQuestions = shuffle(template.draft.questions)
    .slice(0, safeQuestionCount)
    .map(cloneQuestion);

  return {
    title: template.draft.title,
    description: template.draft.description,
    timeLimitMinutes: template.draft.timeLimitMinutes,
    criteria: {
      ...template.draft.criteria,
      questionCount: sampledQuestions.length,
    },
    questions: sampledQuestions,
  };
};

const createRecord = (
  draft: MockTestDraft,
  status: "draft" | "published",
  sourceTemplateId: string,
): GeneratorTestRecord => {
  const timestamp = nowIso();

  return {
    id: createId("test"),
    ...normalizeDraft(draft),
    status,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceTemplateId,
    publishedAt: status === "published" ? timestamp : null,
  };
};

const requireRecord = (testId: string) => {
  const record = tests.get(testId);

  if (!record) {
    throw new Error("Requested test was not found.");
  }

  return record;
};

const ensureSeedData = () => {
  if (tests.size > 0) {
    return;
  }

  const template = mockExamTemplates[0];

  if (!template) {
    return;
  }

  const seededRecord = createRecord(
    cloneDraftFromTemplate(template, 6),
    "published",
    template.templateId,
  );
  tests.set(seededRecord.id, seededRecord);
};

ensureSeedData();

export const listAvailableTemplates = (): TestCriteria[] =>
  mockExamTemplates.map((template) => deepClone(template.draft.criteria));

export const generateTest = (criteria: GenerateTestRequest) => {
  const template = findTemplate(criteria);

  if (!template) {
    throw new Error(
      "No mock template is available for that grade, subject, topic, and difficulty yet.",
    );
  }

  const record = createRecord(
    cloneDraftFromTemplate(template, criteria.questionCount),
    "draft",
    template.templateId,
  );
  tests.set(record.id, record);

  return {
    test: toMockTest(record),
    matchedTemplateId: template.templateId,
    availableTemplates: listAvailableTemplates(),
  };
};

export const updateTest = (testId: string, draft: MockTestDraft) => {
  const current = requireRecord(testId);
  const normalizedDraft = normalizeDraft(draft);
  const updated: GeneratorTestRecord = {
    ...current,
    ...normalizedDraft,
    version: current.version + 1,
    updatedAt: nowIso(),
  };

  tests.set(testId, updated);

  return toMockTest(updated);
};

export const saveTest = (testId: string) => {
  const current = requireRecord(testId);
  const timestamp = nowIso();
  const saved: GeneratorTestRecord = {
    ...current,
    status: "published",
    version: current.version + 1,
    updatedAt: timestamp,
    publishedAt: current.publishedAt ?? timestamp,
  };

  tests.set(testId, saved);

  return toMockTest(saved);
};

export const getTestById = (testId: string) => {
  const record = tests.get(testId);
  return record ? toMockTest(record) : null;
};

export const deleteTest = (testId: string) => {
  const existing = tests.get(testId);

  if (!existing) {
    throw new Error("Requested test was not found.");
  }

  tests.delete(testId);

  return testId;
};

export const listTests = () =>
  Array.from(tests.values())
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(toSummary);

export const getGeneratorStats = () => {
  const records = Array.from(tests.values());

  return {
    totalTests: records.length,
    publishedTests: records.filter((record) => record.status === "published")
      .length,
    draftTests: records.filter((record) => record.status === "draft").length,
    templateCount: mockExamTemplates.length,
  };
};
