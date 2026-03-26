"use client";

import { useState } from "react";

import { MathExamControls } from "@/components/exam/math-exam-controls";
import { EditorSection } from "@/components/exam/math-exam-editor-section";

import {
  createDefaultGeneratorSettings,
  createDefaultSectionState,
  createQuestion,
  getQuestionCollections,
  normalizeGeneratedQuestions,
  normalizeImportedQuestions,
  type ExamQuestion,
} from "@/lib/math-exam-model";
import {
  requestExtractedExam,
  requestGeneratedExam,
} from "@/lib/math-exam-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PreviewSection } from "./math-exam-student";

export default function MathExam() {
  const [examTitle, setExamTitle] = useState("Жишиг шалгалт");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [previewSections, setPreviewSections] = useState(
    createDefaultSectionState,
  );
  const [editorSections, setEditorSections] = useState(
    createDefaultSectionState,
  );
  const [generatorSettings, setGeneratorSettings] = useState(
    createDefaultGeneratorSettings,
  );
  const [generatorError, setGeneratorError] = useState("");
  const [isExtractingSource, setIsExtractingSource] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);

  const {
    totalPoints,
    mathCount,
    mathEditorQuestions,
    mathQuestions,
    mcqCount,
    mcqEditorQuestions,
    mcqQuestions,
  } = getQuestionCollections(questions);
  const requestedQuestionCount =
    generatorSettings.mcqCount + generatorSettings.mathCount;

  function resetSectionState() {
    setEditorSections(createDefaultSectionState());
    setPreviewSections(createDefaultSectionState());
  }

  function updateQuestion(
    questionId: string,
    updater: (question: ExamQuestion) => ExamQuestion,
  ) {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question) =>
        question.id === questionId ? updater(question) : question,
      ),
    );
  }

  function addQuestion(type: "mcq" | "math") {
    setQuestions((currentQuestions) => [
      ...currentQuestions,
      createQuestion(type),
    ]);
  }

  function removeQuestion(questionId: string) {
    setQuestions((currentQuestions) =>
      currentQuestions.filter((question) => question.id !== questionId),
    );
  }

  function addOption(questionId: string) {
    updateQuestion(questionId, (question) => {
      if (question.type !== "mcq") {
        return question;
      }

      const nextLabel = String.fromCharCode(65 + question.options.length);

      return {
        ...question,
        options: [...question.options, `Сонголт ${nextLabel}`],
      };
    });
  }

  async function handleGenerateExam() {
    setGeneratorError("");
    setIsGenerating(true);

    try {
      const exam = await requestGeneratedExam({
        ...generatorSettings,
        files: sourceFiles,
      });
      const nextQuestions = normalizeGeneratedQuestions(exam, {
        mathCount: generatorSettings.mathCount,
        mcqCount: generatorSettings.mcqCount,
        totalPoints: generatorSettings.totalPoints,
      });

      setQuestions(nextQuestions);
      setExamTitle(exam.title?.trim() || "AI үүсгэсэн жишиг шалгалт");
      resetSectionState();
      setIsGeneratorOpen(false);
    } catch (error) {
      setGeneratorError(
        error instanceof Error
          ? error.message
          : "AI шалгалт үүсгэхэд алдаа гарлаа.",
      );
      setIsGeneratorOpen(true);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSourceFilesSelected(files: File[]) {
    setSourceFiles(files);
    setIsGeneratorOpen(false);

    if (files.length === 0) {
      setGeneratorSettings((current) => ({
        ...current,
        sourceContext: "",
      }));
      return;
    }

    setGeneratorError("");
    setIsExtractingSource(true);

    try {
      const exam = await requestExtractedExam(files);
      const normalizedImportedQuestions = normalizeImportedQuestions(exam);

      if (normalizedImportedQuestions.length === 0) {
        throw new Error("Файлаас танигдсан асуулт олдсонгүй.");
      }

      setQuestions(normalizedImportedQuestions);
      setExamTitle(exam.title?.trim() || "Docs-оос импортолсон шалгалт");
      resetSectionState();
    } catch (error) {
      setGeneratorError(
        error instanceof Error
          ? error.message
          : "Файлаас асуултуудыг таньж чадсангүй.",
      );
    } finally {
      setIsExtractingSource(false);
    }
  }

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_32%),linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(241,245,249,0.98))] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <MathExamControls
            examTitle={examTitle}
            generatorError={generatorError}
            generatorSettings={generatorSettings}
            isExtractingSource={isExtractingSource}
            isGenerating={isGenerating}
            isGeneratorOpen={isGeneratorOpen}
            onAddQuestion={addQuestion}
            onExamTitleChange={setExamTitle}
            onGenerateExam={handleGenerateExam}
            onGeneratorOpenChange={setIsGeneratorOpen}
            onSourceFilesSelected={handleSourceFilesSelected}
            requestedQuestionCount={requestedQuestionCount}
            setGeneratorSettings={setGeneratorSettings}
            sourceFiles={sourceFiles}
            stats={{
              mathCount,
              mcqCount,
              totalPoints,
            }}
          />

          <div className="space-y-4">
            <EditorSection
              title="Тест"
              questions={mcqEditorQuestions}
              open={editorSections.mcq}
              onOpenChange={(open) =>
                setEditorSections((current) => ({
                  ...current,
                  mcq: open,
                }))
              }
              onUpdate={updateQuestion}
              onRemove={removeQuestion}
              onAddOption={addOption}
              emptyText="Тест хэсэгт хараахан асуулт алга."
            />
            <EditorSection
              title="Задгай даалгавар"
              questions={mathEditorQuestions}
              open={editorSections.math}
              onOpenChange={(open) =>
                setEditorSections((current) => ({
                  ...current,
                  math: open,
                }))
              }
              onUpdate={updateQuestion}
              onRemove={removeQuestion}
              onAddOption={addOption}
              emptyText="Задгай даалгаврын хэсэгт хараахан асуулт алга."
            />
          </div>
        </div>

        <Card className="h-fit border border-border/70 bg-card/90 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] xl:sticky xl:top-8">
          <CardHeader className="gap-3">
            <div>
              <CardTitle className="text-xl">
                {examTitle.trim() || "Нэргүй шалгалт"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{questions.length} асуулт</span>
              <span>•</span>
              <span>{totalPoints} нийт оноо</span>
            </div>
            <Separator />
            <div className="space-y-4">
              <PreviewSection
                title="Тест"
                questions={mcqQuestions}
                open={previewSections.mcq}
                onOpenChange={(open) =>
                  setPreviewSections((current) => ({
                    ...current,
                    mcq: open,
                  }))
                }
                emptyText="Тест хэсэгт хараахан асуулт алга."
              />
              <PreviewSection
                title="Задгай даалгавар"
                questions={mathQuestions}
                open={previewSections.math}
                onOpenChange={(open) =>
                  setPreviewSections((current) => ({
                    ...current,
                    math: open,
                  }))
                }
                emptyText="Задгай даалгаврын хэсэгт хараахан асуулт алга."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
