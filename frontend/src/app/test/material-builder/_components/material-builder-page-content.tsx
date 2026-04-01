"use client";

import { useLazyQuery, useMutation } from "@apollo/client/react";
import { Check, Eye, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import MathPreviewText from "@/components/math-preview-text";
import { Textarea } from "@/components/ui/textarea";
import {
  GetExamVariantJobDocument,
  SaveNewMathExamDocument,
  RequestExamVariantsDocument,
} from "@/gql/create-exam-documents";
import { MathExamQuestionType } from "@/gql/graphql";
import { TestShell } from "../../_components/test-shell";
import {
  GeneralInfoSection,
  type GeneralInfoValues,
} from "./general-info-section";
import {
  MaterialBuilderWorkspaceSection,
  type PreviewQuestion,
} from "./material-builder-workspace-section";
import {
  sharedLibraryMaterials,
  type MaterialSourceId,
} from "./material-builder-config";

type GeneratedVariant = {
  id: string;
  variantNumber: number;
  title: string;
  questions: Array<{
    id: string;
    position: number;
    type: string;
    prompt: string;
    options?: string[] | null;
    correctAnswer?: string | null;
    explanation?: string | null;
  }>;
};

const defaultGeneralInfo: GeneralInfoValues = {
  subject: "math",
  grade: "10",
  examType: "progress",
  examName: "Явц-1 Алгебр",
  durationMinutes: "30",
};

function normalizeVariantQuestions(
  questions: GeneratedVariant["questions"],
): GeneratedVariant["questions"] {
  return questions.map((question, index) => ({
    ...question,
    position: index + 1,
    options: question.options ?? [],
  }));
}

function mapVariantToPreviewQuestions(
  variant: GeneratedVariant,
): PreviewQuestion[] {
  return normalizeVariantQuestions(variant.questions).map((question, index) => {
    const options = question.options ?? [];
    const matchedCorrectIndex = options.findIndex(
      (option) => option.trim() === (question.correctAnswer ?? "").trim(),
    );

    return {
      id: `variant-${variant.id}-${question.id}-${index + 1}`,
      index: index + 1,
      question: question.prompt,
      answers: options,
      correct: matchedCorrectIndex >= 0 ? matchedCorrectIndex : 0,
      source: `AI хувилбар ${variant.variantNumber}`,
    };
  });
}

export default function MaterialBuilderPageContent() {
  const [source, setSource] = useState<MaterialSourceId>("question-bank");
  const [selectedSharedMaterialId, setSelectedSharedMaterialId] =
    useState<string>(sharedLibraryMaterials[0]?.id ?? "");
  const [generalInfo, setGeneralInfo] =
    useState<GeneralInfoValues>(defaultGeneralInfo);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantViewerOpen, setVariantViewerOpen] = useState(false);
  const [variantCount, setVariantCount] = useState("2");
  const [previewQuestions, setPreviewQuestions] = useState<PreviewQuestion[]>([]);
  const [variantJobId, setVariantJobId] = useState<string | null>(null);
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [confirmedVariantId, setConfirmedVariantId] = useState<string | null>(null);
  const [savingExam, setSavingExam] = useState(false);
  const [savedExamId, setSavedExamId] = useState<string | null>(null);

  const [requestExamVariants, { loading: requestingVariants }] = useMutation(
    RequestExamVariantsDocument,
  );
  const [saveNewMathExam] = useMutation(SaveNewMathExamDocument);
  const [fetchVariantJob] = useLazyQuery(GetExamVariantJobDocument, {
    fetchPolicy: "no-cache",
  });

  const canGenerateVariants = useMemo(
    () => previewQuestions.length > 0 && Number(variantCount) > 0,
    [previewQuestions.length, variantCount],
  );
  const selectedVariant = useMemo(
    () =>
      generatedVariants.find((variant) => variant.id === selectedVariantId) ?? null,
    [generatedVariants, selectedVariantId],
  );
  const isGeneratingVariants = requestingVariants || Boolean(variantJobId);
  const hasGeneratedVariants = generatedVariants.length > 0;

  useEffect(() => {
    if (!variantJobId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      const result = await fetchVariantJob({ variables: { jobId: variantJobId } });
      const job = (
        result.data as
          | {
              getExamVariantJob?: {
                status?: string;
                errorMessage?: string | null;
                variants?: GeneratedVariant[] | null;
              } | null;
            }
          | undefined
      )?.getExamVariantJob;

      if (!job || cancelled) return;

      if (job.status === "completed") {
        const nextVariants = (job.variants ?? []).map((variant) => ({
          ...variant,
          questions: normalizeVariantQuestions(variant.questions),
        }));
        setGeneratedVariants(nextVariants);
        setSelectedVariantId(nextVariants[0]?.id ?? null);
        setVariantJobId(null);
        setVariantViewerOpen(true);
        toast.success("AI хувилбарууд бэлэн боллоо.");
        return;
      }

      if (job.status === "failed") {
        setVariantJobId(null);
        toast.error(job.errorMessage || "AI хувилбар үүсгэхэд алдаа гарлаа.");
        return;
      }

      timer = setTimeout(() => {
        void poll();
      }, 2000);
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchVariantJob, variantJobId]);

  async function handleRequestVariants() {
    if (!canGenerateVariants) {
      toast.error("Эхлээд шалгалтын асуултуудаа бүрдүүлнэ үү.");
      return;
    }

    try {
      const result = await requestExamVariants({
        variables: {
          input: {
            variantCount: Number(variantCount),
            questions: previewQuestions.map((question) => ({
              order: question.index,
              prompt: question.question,
              type: "single-choice",
              options: question.answers,
              correctAnswer: question.answers[question.correct] ?? null,
              explanation: null,
            })),
          },
        },
      });

      const payload = (
        result.data as
          | {
              requestExamVariants?: {
                success?: boolean;
                message?: string;
                jobId?: string | null;
              };
            }
          | undefined
      )?.requestExamVariants;

      if (!payload?.success || !payload.jobId) {
        toast.error(payload?.message || "AI хувилбар үүсгэх хүсэлт амжилтгүй боллоо.");
        return;
      }

      setVariantJobId(payload.jobId);
      setGeneratedVariants([]);
      setSelectedVariantId(null);
      setConfirmedVariantId(null);
      setVariantDialogOpen(false);
      toast.success(payload.message || "AI хувилбар үүсгэх хүсэлт явлаа.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "AI хувилбар үүсгэх хүсэлт амжилтгүй боллоо.",
      );
    }
  }

  function updateVariantQuestion(
    variantId: string,
    questionId: string,
    updater: (
      question: GeneratedVariant["questions"][number],
    ) => GeneratedVariant["questions"][number],
  ) {
    setGeneratedVariants((prev) =>
      prev.map((variant) =>
        variant.id !== variantId
          ? variant
          : {
              ...variant,
              questions: normalizeVariantQuestions(
                variant.questions.map((question) =>
                  question.id === questionId ? updater(question) : question,
                ),
              ),
            },
      ),
    );
  }

  function deleteVariantQuestion(variantId: string, questionId: string) {
    setGeneratedVariants((prev) =>
      prev.map((variant) =>
        variant.id !== variantId
          ? variant
          : {
              ...variant,
              questions: normalizeVariantQuestions(
                variant.questions.filter((question) => question.id !== questionId),
              ),
            },
      ),
    );
  }

  function handleDeleteVariant(variantId: string) {
    setGeneratedVariants((prev) => {
      const next = prev.filter((variant) => variant.id !== variantId);
      if (selectedVariantId === variantId) {
        setSelectedVariantId(next[0]?.id ?? null);
      }
      if (confirmedVariantId === variantId) {
        setConfirmedVariantId(null);
      }
      if (!next.length) {
        setVariantViewerOpen(false);
      }
      return next;
    });
  }

  function handleConfirmVariant() {
    if (!selectedVariant) {
      toast.error("Батлах хувилбар олдсонгүй.");
      return;
    }

    setPreviewQuestions(mapVariantToPreviewQuestions(selectedVariant));
    setConfirmedVariantId(selectedVariant.id);
    setVariantViewerOpen(false);
    toast.success("Сонгосон AI хувилбарыг шалгалтад орууллаа.");
  }

  async function handleSaveExam() {
    if (previewQuestions.length === 0) {
      toast.error("Хадгалахаас өмнө дор хаяж нэг асуулт нэмнэ үү.");
      return;
    }

    const title = generalInfo.examName.trim();
    if (!title) {
      toast.error("Шалгалтын нэрээ оруулна уу.");
      return;
    }

    try {
      setSavingExam(true);

      const input = {
        examId: savedExamId ?? undefined,
        title,
        mcqCount: previewQuestions.length,
        mathCount: 0,
        totalPoints: previewQuestions.length,
        sessionMeta: {
          grade: Number(generalInfo.grade),
          examType: generalInfo.examType,
          subject: generalInfo.subject,
          durationMinutes: Number(generalInfo.durationMinutes),
          withVariants: hasGeneratedVariants,
          variantCount: hasGeneratedVariants ? generatedVariants.length : 0,
        },
        questions: previewQuestions.map((question) => ({
          type: MathExamQuestionType.Mcq,
          prompt: question.question,
          points: 1,
          options: question.answers,
          correctOption: question.correct,
        })),
      };

      const result = await saveNewMathExam({ variables: { input } });
      const examId = (
        result.data as
          | {
              saveNewMathExam?: {
                examId?: string | null;
              } | null;
            }
          | undefined
      )?.saveNewMathExam?.examId;

      if (!examId) {
        throw new Error("Хариу дээр examId ирсэнгүй.");
      }

      setSavedExamId(examId);
      toast.success("Шалгалт үндсэн санд амжилттай хадгалагдлаа.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Шалгалт хадгалах үед алдаа гарлаа.",
      );
    } finally {
      setSavingExam(false);
    }
  }

  return (
    <TestShell
      title="Шалгалтын материал үүсгэх"
      description="Шалгалтын ерөнхий мэдээлэл, материалын эх сурвалж, хугацааг эндээс тохируулна."
      contentClassName="bg-[#eef3ff] px-6 py-0 sm:px-8 lg:px-10"
    >
      <div className="min-h-[calc(100vh-3rem)] w-full pb-10 pt-1">
        <GeneralInfoSection values={generalInfo} onChange={setGeneralInfo} />
        <MaterialBuilderWorkspaceSection
          source={source}
          onSourceChange={setSource}
          selectedSharedMaterialId={selectedSharedMaterialId}
          onSelectMaterialId={setSelectedSharedMaterialId}
          previewQuestions={previewQuestions}
          onPreviewQuestionsChange={setPreviewQuestions}
        />

        {hasGeneratedVariants ? (
          <section className="mt-5 rounded-[18px] border border-[#e3e9f4] bg-white px-5 py-5 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                  <Sparkles className="h-4 w-4 text-[#0b5cab]" />
                  AI үүсгэсэн хувилбарууд
                </div>
                <p className="text-[14px] text-slate-500">
                  {generatedVariants.length} хувилбар бэлэн байна.
                  {confirmedVariantId
                    ? " Нэг хувилбар сонгогдсон."
                    : " Одоо хараад нэгийг батална уу."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVariantViewerOpen(true)}
                className="rounded-[12px] border-[#cfe0fb] bg-white text-[#0b5cab] hover:bg-[#f7faff]"
              >
                <Eye className="h-4 w-4" />
                AI хувилбар харах
              </Button>
            </div>
          </section>
        ) : null}

        <div className="flex items-center justify-end gap-3 pt-10">
          <Button
            variant="outline"
            onClick={() =>
              hasGeneratedVariants
                ? setVariantViewerOpen(true)
                : setVariantDialogOpen(true)
            }
            disabled={isGeneratingVariants}
            className="h-[42px] min-w-[148px] rounded-[10px] border-[#cfe0fb] bg-white px-6 text-[15px] font-semibold text-[#0b5cab] shadow-[0_6px_14px_rgba(148,163,184,0.12)] hover:border-[#b7cff8] hover:bg-[#f7faff]"
          >
            {isGeneratingVariants ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Хувилбар нэмж байна...
              </>
            ) : hasGeneratedVariants ? (
              <>
                <Eye className="h-4 w-4" />
                AI хувилбар харах
              </>
            ) : (
              "Хувилбар нэмэх"
            )}
          </Button>
          <Button
            onClick={() => void handleSaveExam()}
            disabled={isGeneratingVariants || savingExam}
            className="h-[42px] min-w-[128px] rounded-[10px] bg-[#0b5cab] px-7 text-[15px] font-semibold shadow-[0_8px_18px_rgba(11,92,171,0.25)] hover:bg-[#0a4f96]"
          >
            {isGeneratingVariants ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Хувилбар нэмж байна...
              </>
            ) : savingExam ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Хадгалж байна...
              </>
            ) : source === "shared-library" ? (
              "Сонгосон материалыг ашиглах"
            ) : (
              "Хадгалах"
            )}
          </Button>
        </div>

        <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
          <DialogContent className="max-w-[min(100vw-2rem,28rem)] gap-0 overflow-hidden rounded-[24px] border border-[#dfe7f3] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]">
            <DialogHeader className="border-b border-[#e9eef6] px-5 py-4">
              <DialogTitle className="text-[18px] font-semibold text-slate-900">
                Хувилбарын тоо
              </DialogTitle>
              <DialogDescription className="text-[14px] text-slate-500">
                Нэмэх хувилбарын тоог оруулна уу.
              </DialogDescription>
            </DialogHeader>

            <div className="px-5 py-6">
              <Input
                type="number"
                min="1"
                step="1"
                value={variantCount}
                onChange={(event) => setVariantCount(event.target.value)}
                placeholder="Жишээ нь: 2"
                className="h-[48px] rounded-[14px] border-[#d7e3f5] bg-[#f8fbff] px-4 text-[15px] shadow-none"
              />
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-b-[24px] border-t border-[#e9eef6] bg-white px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVariantDialogOpen(false)}
                className="rounded-[12px] border-[#d7e3f5] bg-white px-5 hover:bg-slate-50"
              >
                Болих
              </Button>
              <Button
                type="button"
                onClick={() => void handleRequestVariants()}
                disabled={!canGenerateVariants || requestingVariants || Boolean(variantJobId)}
                className="rounded-[12px] bg-[#0b5cab] px-5 hover:bg-[#0a4f96]"
              >
                {requestingVariants || variantJobId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI ажиллаж байна...
                  </>
                ) : (
                  "AI хувилбар үүсгэх"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={variantViewerOpen} onOpenChange={setVariantViewerOpen}>
          <DialogContent className="max-h-[90vh] max-w-[min(100vw-2rem,78rem)] gap-0 overflow-hidden rounded-[24px] border border-[#dfe7f3] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]">
            <DialogHeader className="border-b border-[#e9eef6] px-5 py-4">
              <DialogTitle className="text-[18px] font-semibold text-slate-900">
                AI үүсгэсэн хувилбарууд
              </DialogTitle>
              <DialogDescription className="text-[14px] text-slate-500">
                Нэг хувилбар сонгож, шаардлагатай бол асуултуудыг засаад батална.
              </DialogDescription>
            </DialogHeader>

            <div className="grid max-h-[calc(90vh-8.5rem)] min-h-112 gap-0 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="overflow-y-auto border-b border-[#e9eef6] bg-[#f8fbff] p-4 lg:border-b-0 lg:border-r">
                <div className="space-y-3">
                  {generatedVariants.map((variant) => {
                    const isActive = variant.id === selectedVariantId;
                    const isConfirmed = variant.id === confirmedVariantId;

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`w-full rounded-[16px] border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-[#0b5cab] bg-white shadow-[0_10px_20px_rgba(11,92,171,0.12)]"
                            : "border-[#dbe4f3] bg-white hover:border-[#bfd4f5]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[14px] font-semibold text-slate-900">
                              {variant.title}
                            </p>
                            <p className="mt-1 text-[12px] text-slate-500">
                              {variant.questions.length} асуулт
                            </p>
                          </div>
                          {isConfirmed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f7ee] px-2.5 py-1 text-[11px] font-semibold text-[#167e61]">
                              <Check className="h-3.5 w-3.5" />
                              Баталсан
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-y-auto px-5 py-5">
                {selectedVariant ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[16px] font-semibold text-slate-900">
                          {selectedVariant.title}
                        </p>
                        <p className="mt-1 text-[13px] text-slate-500">
                          Асуултуудыг эндээс засаж, шаардлагагүйг устгаж болно.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDeleteVariant(selectedVariant.id)}
                        className="rounded-[12px] border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Хувилбар устгах
                      </Button>
                    </div>

                    {selectedVariant.questions.map((question) => (
                      <div
                        key={question.id}
                        className="rounded-[16px] border border-[#dbe4f3] bg-[#fcfdff] p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-[14px] font-semibold text-slate-900">
                            Асуулт {question.position}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              deleteVariantQuestion(selectedVariant.id, question.id)
                            }
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" />
                            Устгах
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <Textarea
                            value={question.prompt}
                            onChange={(event) =>
                              updateVariantQuestion(
                                selectedVariant.id,
                                question.id,
                                (current) => ({
                                  ...current,
                                  prompt: event.target.value,
                                }),
                              )
                            }
                            className="min-h-[96px] rounded-[14px] border-[#d7e3f5] bg-white"
                          />

                          {(question.options ?? []).length > 0 ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              {(question.options ?? []).map((option, index) => (
                                <Input
                                  key={`${question.id}-${index}`}
                                  value={option}
                                  onChange={(event) =>
                                    updateVariantQuestion(
                                      selectedVariant.id,
                                      question.id,
                                      (current) => {
                                        const nextOptions = [
                                          ...(current.options ?? []),
                                        ];
                                        nextOptions[index] = event.target.value;
                                        const nextCorrectAnswer =
                                          (current.correctAnswer ?? "").trim() ===
                                          option.trim()
                                            ? event.target.value
                                            : current.correctAnswer;

                                        return {
                                          ...current,
                                          options: nextOptions,
                                          correctAnswer: nextCorrectAnswer,
                                        };
                                      },
                                    )
                                  }
                                  className="rounded-[12px] border-[#d7e3f5] bg-white"
                                />
                              ))}
                            </div>
                          ) : null}

                          <div className="rounded-[14px] border border-[#e5ecf7] bg-white p-3">
                            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Зөв хариу
                            </p>
                            <Input
                              value={question.correctAnswer ?? ""}
                              onChange={(event) =>
                                updateVariantQuestion(
                                  selectedVariant.id,
                                  question.id,
                                  (current) => ({
                                    ...current,
                                    correctAnswer: event.target.value,
                                  }),
                                )
                              }
                              className="rounded-[12px] border-[#d7e3f5] bg-white"
                            />
                          </div>

                          <div className="rounded-[14px] bg-[#f5f8fc] p-3">
                            <MathPreviewText
                              content={question.prompt}
                              contentSource="preview"
                              className="text-[14px] leading-relaxed text-slate-700"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full min-h-80 items-center justify-center rounded-[18px] border border-dashed border-[#d7e3f5] bg-[#fbfdff] text-center text-[14px] text-slate-500">
                    Харах AI хувилбар үлдсэнгүй.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-b-[24px] border-t border-[#e9eef6] bg-white px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVariantViewerOpen(false)}
                className="rounded-[12px] border-[#d7e3f5] bg-white px-5 hover:bg-slate-50"
              >
                Дараа үзье
              </Button>
              <Button
                type="button"
                onClick={handleConfirmVariant}
                disabled={!selectedVariant || selectedVariant.questions.length === 0}
                className="rounded-[12px] bg-[#0b5cab] px-5 hover:bg-[#0a4f96]"
              >
                Хувилбар батлах
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TestShell>
  );
}
