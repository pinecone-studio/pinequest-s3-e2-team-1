"use client";

import { useState, useTransition } from "react";
import type {
  EditableQuestion,
  ExamAnswerInput,
  GenerateTestRequest,
  GenerateTestResponse,
  GetProgressResponse,
  MockTest,
  MockTestDraft,
  QuestionOption,
  DeleteTestResponse,
  SaveTestResponse,
  StartExamResponse,
  SubmitAnswersResponse,
  UpdateTestResponse,
} from "@shared/contracts/mock-exam";

type Notice = {
  tone: "success" | "error" | "neutral";
  message: string;
};

const defaultCriteria: GenerateTestRequest = {
  gradeLevel: 10,
  subject: "Математик",
  topic: "Алгоритм",
  difficulty: "easy",
  questionCount: 6,
  className: "",
};

const defaultStudent = {
  studentId: "student-001",
  studentName: "Ану",
};

const createClientId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
};

const createOption = (label: string): QuestionOption => ({
  id: createClientId("option"),
  text: label,
});

const createBlankQuestion = (): EditableQuestion => {
  const firstOption = createOption("А сонголт");
  const secondOption = createOption("Б сонголт");

  return {
    id: createClientId("question"),
    type: "single-choice",
    prompt: "Шинэ асуултын агуулга",
    options: [firstOption, secondOption],
    correctOptionId: firstOption.id,
    explanation: "Яагаад энэ хариулт зөв вэ?",
    points: 1,
    competency: "Ерөнхий сэтгэлгээ",
  };
};

const toDraftPayload = (test: MockTest): MockTestDraft => ({
  title: test.title,
  description: test.description,
  criteria: test.criteria,
  timeLimitMinutes: test.timeLimitMinutes,
  questions: test.questions,
});

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
    },
  });
  const payload = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new Error(payload.message || "Хүсэлт амжилтгүй боллоо.");
  }

  return payload;
}

export function MockExamDashboard() {
  const [criteria, setCriteria] = useState(defaultCriteria);
  const [draftTest, setDraftTest] = useState<MockTest | null>(null);
  const [student, setStudent] = useState(defaultStudent);
  const [attempt, setAttempt] = useState<StartExamResponse | null>(null);
  const [progress, setProgress] = useState<GetProgressResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>({
    tone: "neutral",
    message:
      "Тест үүсгэж, засварлаж, нийтэлж, дараа нь оюутны оролдлогыг эхлүүлнэ үү.",
  });
  const [, startTransition] = useTransition();

  const setSuccess = (message: string) =>
    setNotice({ tone: "success", message });
  const setError = (message: string) => setNotice({ tone: "error", message });

  const updateQuestion = (
    questionId: string,
    updater: (question: EditableQuestion) => EditableQuestion,
  ) => {
    setDraftTest((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        questions: current.questions.map((question) =>
          question.id === questionId ? updater(question) : question,
        ),
      };
    });
  };

  const runRequest = async <T,>(
    label: string,
    task: () => Promise<T>,
    onSuccess: (result: T) => void,
    successMessage: string,
  ) => {
    setBusyAction(label);

    try {
      const result = await task();
      startTransition(() => {
        onSuccess(result);
        setSuccess(successMessage);
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ямар нэгэн алдаа гарлаа.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerate = async () => {
    await runRequest<GenerateTestResponse>(
      "Тест үүсгэж байна",
      () =>
        jsonRequest("/api/demo/generate", {
          method: "POST",
          body: JSON.stringify(criteria),
        }),
      (result) => {
        setDraftTest(result.test);
        setAttempt(null);
        setProgress(null);
        setAnswers({});
      },
      "Тестийн загвараас mock шалгалт үүсгэлээ.",
    );
  };

  const handleSaveDraft = async () => {
    if (!draftTest) {
      setError("Хадгалахын өмнө mock шалгалт үүсгэнэ үү.");
      return;
    }

    await runRequest<UpdateTestResponse>(
      "Ноорог хадгалж байна",
      () =>
        jsonRequest(`/api/demo/tests/${draftTest.id}`, {
          method: "PUT",
          body: JSON.stringify({
            draft: toDraftPayload(draftTest),
          }),
        }),
      (result) => setDraftTest(result.test),
      "Ноорогийн засварыг Тест үүсгэгчид хадгаллаа.",
    );
  };

  const handlePublish = async () => {
    if (!draftTest) {
      setError("Нийтлэхийн өмнө mock шалгалт үүсгэнэ үү.");
      return;
    }

    await runRequest<SaveTestResponse>(
      "Тест нийтэлж байна",
      async () => {
        const edited = await jsonRequest<UpdateTestResponse>(
          `/api/demo/tests/${draftTest.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              draft: toDraftPayload(draftTest),
            }),
          },
        );

        return jsonRequest<SaveTestResponse>("/api/demo/tests/save", {
          method: "POST",
          body: JSON.stringify({
            testId: edited.test.id,
          }),
        });
      },
      (result) => setDraftTest(result.test),
      "Тест нийтлэгдэж, оюутны оролдлогод бэлэн боллоо.",
    );
  };

  const handleDeleteTest = async () => {
    if (!draftTest) {
      setError("Устгах үүсгэсэн тест байхгүй байна.");
      return;
    }

    await runRequest<DeleteTestResponse>(
      "Тест устгаж байна",
      () =>
        jsonRequest(`/api/demo/tests/${draftTest.id}`, {
          method: "DELETE",
        }),
      () => {
        setDraftTest(null);
        setAttempt(null);
        setProgress(null);
        setAnswers({});
      },
      "Mock шалгалтыг Тест үүсгэгчийн сангаас устгалаа.",
    );
  };

  const handleStartExam = async () => {
    if (!draftTest) {
      setError("Шалгалт эхлүүлэхийн өмнө тест үүсгэж нийтэлнэ үү.");
      return;
    }

    if (draftTest.status !== "published") {
      setError(
        "Оюутнууд зөвхөн эцсийн хувилбарыг хүлээн авахын тулд тестийг эхлээ нийтэлнэ үү.",
      );
      return;
    }

    await runRequest<StartExamResponse>(
      "Шалгалт эхлүүлж байна",
      () =>
        jsonRequest("/api/demo/exams/start", {
          method: "POST",
          body: JSON.stringify({
            testId: draftTest.id,
            studentId: student.studentId,
            studentName: student.studentName,
          }),
        }),
      (result) => {
        setAttempt(result);
        setProgress({
          attemptId: result.attemptId,
          testId: result.exam.testId,
          status: result.status,
          studentId: result.studentId,
          studentName: result.studentName,
          startedAt: result.startedAt,
          expiresAt: result.expiresAt,
          progress: result.progress,
          answers: result.exam.questions.map((question) => ({
            questionId: question.questionId,
            selectedOptionId: null,
          })),
        });
        setAnswers(
          Object.fromEntries(
            result.exam.questions.map(
              (question) => [question.questionId, null] as const,
            ),
          ),
        );
      },
      "Асуулт, сонголтын дараалал холилдсон оюутны шалгалт эхэллээ.",
    );
  };

  const syncProgressState = (
    result: GetProgressResponse | SubmitAnswersResponse,
  ) => {
    setProgress((current) => {
      if ("testId" in result) {
        return result;
      }

      if (!current) {
        if (!attempt) {
          return current;
        }

        return {
          attemptId: attempt.attemptId,
          testId: attempt.exam.testId,
          status: result.status,
          studentId: attempt.studentId,
          studentName: attempt.studentName,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
          progress: result.progress,
          answers: buildAnswerPayload(),
          result: result.result,
          submittedAt:
            result.status === "submitted"
              ? new Date().toISOString()
              : undefined,
        };
      }

      return {
        ...current,
        status: result.status,
        progress: result.progress,
        result: result.result,
        submittedAt:
          result.status === "submitted"
            ? new Date().toISOString()
            : current.submittedAt,
      };
    });
  };

  const buildAnswerPayload = (): ExamAnswerInput[] => {
    if (!attempt) {
      return [];
    }

    return attempt.exam.questions.map((question) => ({
      questionId: question.questionId,
      selectedOptionId: answers[question.questionId] ?? null,
    }));
  };

  const handleSubmit = async (finalize: boolean) => {
    if (!attempt) {
      setError("Эхлээд оюутны оролдлогыг эхлүүлнэ үү.");
      return;
    }

    await runRequest<SubmitAnswersResponse>(
      finalize ? "Шалгалт дуусгаж байна" : "Явцыг хадгалж байна",
      () =>
        jsonRequest("/api/demo/exams/submit", {
          method: "POST",
          body: JSON.stringify({
            attemptId: attempt.attemptId,
            answers: buildAnswerPayload(),
            finalize,
          }),
        }),
      (result) => {
        syncProgressState(result);
      },
      finalize
        ? "Шалгалт илгээгдэж, оноологдлоо."
        : "Хариултуудыг шалгалтын үйлчилгээнд хадгаллаа.",
    );
  };

  const handleRefreshProgress = async () => {
    if (!attempt) {
      setError("Шинэчлэх идэвхтэй оролдлого байхгүй байна.");
      return;
    }

    await runRequest<GetProgressResponse>(
      "Явцыг шинэчилж байна",
      () => jsonRequest(`/api/demo/exams/${attempt.attemptId}/progress`),
      (result) => {
        setProgress(result);
        setAnswers(
          Object.fromEntries(
            result.answers.map((answer) => [
              answer.questionId,
              answer.selectedOptionId,
            ]),
          ),
        );
      },
      "Шалгалтын үйлчилгээнээс хамгийн сүүлийн явцыг уншлаа.",
    );
  };

  const resultSummary = progress?.result;
  const published = draftTest?.status === "published";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,161,22,0.28),transparent_28%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.22),transparent_24%),linear-gradient(135deg,#130f0b_0%,#1d150f_38%,#08131b_100%)] text-stone-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8 lg:px-10">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="absolute" />
          <p className="text-xs uppercase tracking-[0.45em] text-cyan-300">
            Mock Шалгалтын Удирдлагын Өрөө
          </p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-stone-50 sm:text-6xl">
                Багш нэг удаа зохиодог.
                <br />
                Оюутнууд хувийн оролдлого хүлээн авдаг.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
                Тест үүсгэгч нь зохиогдсон шалгалт болон зөв хариултуудыг
                өмчилдэг. Шалгалтын үйлчилгээ нь оюутны явц болон үр дүнг
                өмчилдэг. Хуваалцсан TypeScript гэрээ хоёр үйлчилгээг схем
                нэгтгэлгүйгээр синхроноор байлгадаг.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-200/10 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                  Шалгуур
                </p>
                <p className="mt-2 text-lg font-medium">
                  {criteria.gradeLevel}-р анги {criteria.subject}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/10 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
                  Ноорог
                </p>
                <p className="mt-2 text-lg font-medium">
                  {draftTest?.status ?? "одоохондоо байхгүй"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-lime-300/20 bg-lime-300/10 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.3em] text-lime-200">
                  Оролдлого
                </p>
                <p className="mt-2 text-lg font-medium">
                  {attempt ? attempt.attemptId : "эхлээгүй"}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div
          className={`rounded-[1.5rem] border px-5 py-4 text-sm shadow-lg backdrop-blur ${
            notice.tone === "success"
              ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100"
              : notice.tone === "error"
                ? "border-rose-300/25 bg-rose-300/12 text-rose-100"
                : "border-white/10 bg-white/6 text-stone-200"
          }`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{notice.message}</p>
            {busyAction ? (
              <span className="text-xs uppercase tracking-[0.3em]">
                {busyAction}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.95fr]">
          <section className="space-y-6 rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-amber-200">
                  Багшийн Урсгал
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Mock шалгалт үүсгэх, засварлах, нийтлэх
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={busyAction !== null}
                className="rounded-full bg-amber-300 px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Тест Үүсгэх
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                  Анги
                </span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none ring-0"
                  type="number"
                  value={criteria.gradeLevel}
                  onChange={(event) =>
                    setCriteria((current) => ({
                      ...current,
                      gradeLevel: Number(event.target.value) || 10,
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                  Хичээл
                </span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none ring-0"
                  value={criteria.subject}
                  onChange={(event) =>
                    setCriteria((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                  Сэдэв
                </span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none ring-0"
                  value={criteria.topic}
                  onChange={(event) =>
                    setCriteria((current) => ({
                      ...current,
                      topic: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                  Хүндрэл
                </span>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                  value={criteria.difficulty}
                  onChange={(event) =>
                    setCriteria((current) => ({
                      ...current,
                      difficulty: event.target
                        .value as GenerateTestRequest["difficulty"],
                    }))
                  }
                >
                  <option value="easy">хялбар</option>
                  <option value="medium">дунд</option>
                  <option value="hard">хэцүү</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                  Асуултын тоо
                </span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none ring-0"
                  type="number"
                  min={1}
                  value={criteria.questionCount ?? 6}
                  onChange={(event) =>
                    setCriteria((current) => ({
                      ...current,
                      questionCount: Number(event.target.value) || 6,
                    }))
                  }
                />
              </label>
            </div>

            {draftTest ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-[1.35fr_0.65fr]">
                  <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                        Тестийн гарчиг
                      </span>
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                        value={draftTest.title}
                        onChange={(event) =>
                          setDraftTest((current) =>
                            current
                              ? {
                                  ...current,
                                  title: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                        Тайлбар
                      </span>
                      <textarea
                        className="min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                        value={draftTest.description}
                        onChange={(event) =>
                          setDraftTest((current) =>
                            current
                              ? {
                                  ...current,
                                  description: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                        Тестийн ID
                      </p>
                      <p className="mt-2 break-all font-mono text-sm text-stone-200">
                        {draftTest.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                        Төлөв
                      </p>
                      <p className="mt-2 text-lg font-medium">
                        {draftTest.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                        Хувилбар
                      </p>
                      <p className="mt-2 text-lg font-medium">
                        {draftTest.version}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                        Хугацааны хязгаар
                      </p>
                      <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                        type="number"
                        min={5}
                        value={draftTest.timeLimitMinutes}
                        onChange={(event) =>
                          setDraftTest((current) =>
                            current
                              ? {
                                  ...current,
                                  timeLimitMinutes:
                                    Number(event.target.value) || 5,
                                }
                              : current,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveDraft()}
                    disabled={busyAction !== null}
                    className="rounded-full border border-white/15 bg-white/8 px-5 py-3 text-sm font-medium transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Ноорог Хадгалах
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={busyAction !== null}
                    className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Тест Нийтлэх
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteTest()}
                    disabled={busyAction !== null}
                    className="rounded-full border border-rose-300/25 bg-rose-300/10 px-5 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Тест Устгах
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftTest((current) =>
                        current
                          ? {
                              ...current,
                              questions: [
                                ...current.questions,
                                createBlankQuestion(),
                              ],
                              criteria: {
                                ...current.criteria,
                                questionCount: current.questions.length + 1,
                              },
                            }
                          : current,
                      )
                    }
                    className="rounded-full border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-300/15"
                  >
                    Асуулт Нэмэх
                  </button>
                </div>

                <div className="space-y-4">
                  {draftTest.questions.map((question, questionIndex) => (
                    <div
                      key={question.id}
                      className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)]"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-lg font-medium">
                          {questionIndex + 1}-р асуулт
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftTest((current) =>
                              current
                                ? {
                                    ...current,
                                    questions: current.questions.filter(
                                      (item) => item.id !== question.id,
                                    ),
                                    criteria: {
                                      ...current.criteria,
                                      questionCount: Math.max(
                                        0,
                                        current.questions.length - 1,
                                      ),
                                    },
                                  }
                                : current,
                            )
                          }
                          className="rounded-full border border-rose-300/25 bg-rose-300/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-rose-100"
                        >
                          Устгах
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[1fr_200px_220px]">
                        <label className="space-y-2">
                          <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                            Асуулт
                          </span>
                          <textarea
                            className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                            value={question.prompt}
                            onChange={(event) =>
                              updateQuestion(question.id, (current) => ({
                                ...current,
                                prompt: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                            Оноо
                          </span>
                          <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                            type="number"
                            min={1}
                            value={question.points}
                            onChange={(event) =>
                              updateQuestion(question.id, (current) => ({
                                ...current,
                                points: Number(event.target.value) || 1,
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                            Чадамж
                          </span>
                          <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                            value={question.competency}
                            onChange={(event) =>
                              updateQuestion(question.id, (current) => ({
                                ...current,
                                competency: event.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>

                      <label className="mt-4 block space-y-2">
                        <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                          Тайлбар
                        </span>
                        <textarea
                          className="min-h-24 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                          value={question.explanation}
                          onChange={(event) =>
                            updateQuestion(question.id, (current) => ({
                              ...current,
                              explanation: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <div className="mt-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm uppercase tracking-[0.28em] text-stone-400">
                            Хариултын сонголтууд
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuestion(question.id, (current) => ({
                                ...current,
                                options: [
                                  ...current.options,
                                  createOption(
                                    `${String.fromCharCode(1040 + current.options.length)} сонголт`,
                                  ),
                                ],
                              }))
                            }
                            className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-cyan-100"
                          >
                            Сонголт Нэмэх
                          </button>
                        </div>

                        <div className="grid gap-3">
                          {question.options.map((option, optionIndex) => (
                            <div
                              key={option.id}
                              className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[auto_1fr_auto]"
                            >
                              <label className="flex items-center gap-3 text-sm text-stone-200">
                                <input
                                  type="radio"
                                  checked={
                                    question.correctOptionId === option.id
                                  }
                                  onChange={() =>
                                    updateQuestion(question.id, (current) => ({
                                      ...current,
                                      correctOptionId: option.id,
                                    }))
                                  }
                                />
                                Зөв
                              </label>
                              <input
                                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                                value={option.text}
                                onChange={(event) =>
                                  updateQuestion(question.id, (current) => ({
                                    ...current,
                                    options: current.options.map((item) =>
                                      item.id === option.id
                                        ? {
                                            ...item,
                                            text: event.target.value,
                                          }
                                        : item,
                                    ),
                                  }))
                                }
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuestion(question.id, (current) => {
                                    if (current.options.length <= 2) {
                                      return current;
                                    }

                                    const nextOptions = current.options.filter(
                                      (item) => item.id !== option.id,
                                    );

                                    return {
                                      ...current,
                                      options: nextOptions,
                                      correctOptionId:
                                        current.correctOptionId === option.id
                                          ? (nextOptions[0]?.id ??
                                            current.correctOptionId)
                                          : current.correctOptionId,
                                    };
                                  })
                                }
                                className="rounded-full border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-rose-100"
                              >
                                Хасах
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-white/4 p-8 text-sm leading-7 text-stone-300">
                Ноорог байхгүй байна. Анхдагч тохиргоо нь 10-р анги, Математик,
                Алгоритм, Хялбар гэж аль хэдийн тохируулагдсан тул mock
                шалгалтыг шууд үүсгэж болно.
              </div>
            )}
          </section>

          <section className="space-y-6 rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
                Оюутны Урсгал
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Эхлүүлэх, хариулах, явц хадгалах, оноолох
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                  Оюутны ID
                </span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                  value={student.studentId}
                  onChange={(event) =>
                    setStudent((current) => ({
                      ...current,
                      studentId: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.28em] text-stone-400">
                  Оюутны нэр
                </span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                  value={student.studentName}
                  onChange={(event) =>
                    setStudent((current) => ({
                      ...current,
                      studentName: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                Сонгосон тест
              </p>
              <p className="mt-2 text-lg font-medium">
                {draftTest?.title ?? "Эхлээд багшийн тестийг нийтэлнэ үү"}
              </p>
              <p className="mt-2 text-sm text-stone-400">
                {published
                  ? `Нийтлэгдсэн ${draftTest?.id} тест оюутанд хүргэхэд бэлэн байна.`
                  : "Зөвхөн нийтлэгдсэн тестийг Шалгалтын үйлчилгээнээс эхлүүлж болно."}
              </p>
              <button
                type="button"
                onClick={() => void handleStartExam()}
                disabled={!published || busyAction !== null}
                className="mt-4 rounded-full bg-lime-300 px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Шалгалт Эхлүүлэх
              </button>
            </div>

            {attempt ? (
              <div className="space-y-5">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-stone-400">Оролдлогын ID</p>
                      <p className="mt-1 break-all font-mono text-sm text-stone-100">
                        {attempt.attemptId}
                      </p>
                    </div>
                    <div className="rounded-full border border-lime-300/25 bg-lime-300/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-lime-100">
                      {progress?.status ?? attempt.status}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                        Хариулсан
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {progress?.progress.answeredQuestions ??
                          attempt.progress.answeredQuestions}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                        Үлдсэн
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {progress?.progress.remainingQuestions ??
                          attempt.progress.remainingQuestions}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                        Гүйцэтгэл
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {progress?.progress.completionRate ??
                          attempt.progress.completionRate}
                        %
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSubmit(false)}
                      disabled={busyAction !== null}
                      className="rounded-full border border-white/15 bg-white/8 px-5 py-3 text-sm font-medium transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Явц Хадгалах
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmit(true)}
                      disabled={busyAction !== null}
                      className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Шалгалт Дуусгах
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRefreshProgress()}
                      disabled={busyAction !== null}
                      className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Явц Шинэчлэх
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {attempt.exam.questions.map((question, questionIndex) => (
                    <div
                      key={question.questionId}
                      className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                            {questionIndex + 1}-р асуулт
                          </p>
                          <h3 className="mt-2 text-lg font-medium">
                            {question.prompt}
                          </h3>
                        </div>
                        <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs uppercase tracking-[0.28em] text-amber-100">
                          {question.points} оноо
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-stone-400">
                        {question.competency}
                      </p>
                      <div className="mt-4 grid gap-3">
                        {question.options.map((option) => (
                          <label
                            key={option.id}
                            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
                          >
                            <input
                              type="radio"
                              name={question.questionId}
                              checked={
                                answers[question.questionId] === option.id
                              }
                              onChange={() =>
                                setAnswers((current) => ({
                                  ...current,
                                  [question.questionId]: option.id,
                                }))
                              }
                            />
                            <span>{option.text}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {resultSummary ? (
                  <div className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                      Үр Дүнгийн Хураангуй
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-sm text-emerald-100/80">Оноо</p>
                        <p className="mt-1 text-3xl font-semibold">
                          {resultSummary.score}/{resultSummary.maxScore}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-emerald-100/80">Хувь</p>
                        <p className="mt-1 text-3xl font-semibold">
                          {resultSummary.percentage}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-emerald-100/80">Зөв</p>
                        <p className="mt-1 text-3xl font-semibold">
                          {resultSummary.correctCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-emerald-100/80">Буруу</p>
                        <p className="mt-1 text-3xl font-semibold">
                          {resultSummary.incorrectCount}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-3">
                      {resultSummary.questionResults.map((result) => (
                        <div
                          key={result.questionId}
                          className="rounded-2xl border border-emerald-100/10 bg-black/20 p-4"
                        >
                          <p className="text-sm font-medium">
                            {result.questionId}:{" "}
                            {result.isCorrect
                              ? "Зөв"
                              : "Давтан үзэх шаардлагатай"}
                          </p>
                          <p className="mt-1 text-sm text-emerald-50/80">
                            {result.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-white/4 p-8 text-sm leading-7 text-stone-300">
                Тест нийтлэгдсэний дараа оюутны оролдлого нь Тест үүсгэгчээс
                зохиогдсон шалгалтыг татаж, дарааллыг холиод, явцыг энд хянаж
                эхэлнэ.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
