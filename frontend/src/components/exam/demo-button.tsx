"use client";

import { Button } from "@/components/ui/button";

import type { ExamQuestion, GeneratorSettings } from "@/lib/math-exam-model";
import { createMathQuestion, createMcqQuestion } from "@/lib/math-exam-model";
import type { Dispatch, SetStateAction } from "react";

type DemoButtonProps = {
  onDemo: () => void;
  className?: string;
  disabled?: boolean;
};

export function DemoButton({ onDemo, ...props }: DemoButtonProps) {
  return (
    <Button type="button" variant="outline" onClick={onDemo} {...props}>
      Demo
    </Button>
  );
}

type RunMathExamDemoArgs = {
  setGeneratorError: Dispatch<SetStateAction<string>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
  setSavedExamId: Dispatch<SetStateAction<string | null>>;
  setIsGeneratorOpen: Dispatch<SetStateAction<boolean>>;
  setSourceFiles: Dispatch<SetStateAction<File[]>>;
  setExamTitle: Dispatch<SetStateAction<string>>;
  setGeneratorSettings: Dispatch<SetStateAction<GeneratorSettings>>;
  setQuestions: Dispatch<SetStateAction<ExamQuestion[]>>;
  resetSectionState: () => void;
};

export function runMathExamDemo({
  setGeneratorError,
  setSaveError,
  setSavedExamId,
  setIsGeneratorOpen,
  setSourceFiles,
  setExamTitle,
  setGeneratorSettings,
  setQuestions,
  resetSectionState,
}: RunMathExamDemoArgs) {
  setGeneratorError("");
  setSaveError(null);
  setSavedExamId(null);
  setIsGeneratorOpen(false);
  setSourceFiles([]);

  setExamTitle("9-р анги — Математик (5 тест + 1 задгай)");
  setGeneratorSettings((current) => ({
    ...current,
    difficulty: "medium",
    mcqCount: 5,
    mathCount: 1,
    totalPoints: 6,
    topics: "Квадрат тэгшитгэл, Пифагорын теорем, квадрат язгуур",
    sourceContext: "",
  }));

  setQuestions([
    ...Array.from({ length: 5 }, (_, idx): ExamQuestion => {
      const n = idx + 1;
      return createMcqQuestion({
        prompt:
          n === 1
            ? "Дараах тэгшитгэлийг бод. $x^2 - 5x + 6 = 0$"
            : n === 2
              ? "Пифагорын теоремоор $a=3$, $b=4$ бол гипотенуз $c$ хэд вэ?"
              : n === 3
                ? "Илэрхийллийг хялбарчил. $\\sqrt{50}$"
                : n === 4
                  ? "Функц $y=2x+1$ үед $x=3$ бол $y$ хэд вэ?"
                  : "Квадрат тэгшитгэлийн дискриминант $D=b^2-4ac$. $x^2-4x+1=0$ үед $D$ хэд вэ?",
        points: 1,
        options:
          n === 1
            ? ["$x=2,3$", "$x=1,6$", "$x=-2,-3$", "$x=0,6$"]
            : n === 2
              ? ["$c=5$", "$c=6$", "$c=7$", "$c=8$"]
              : n === 3
                ? ["$5\\sqrt{2}$", "$10\\sqrt{5}$", "$25\\sqrt{2}$", "$5\\sqrt{5}$"]
                : n === 4
                  ? ["5", "6", "7", "8"]
                  : ["$12$", "$16$", "$-12$", "$-16$"],
        correctOption: n === 1 ? 0 : n === 2 ? 0 : n === 3 ? 0 : n === 4 ? 2 : 0,
      });
    }),
    createMathQuestion({
      prompt:
        "Задгай: Дараах тэгшитгэлийг бодож, хариуг хялбарчил. $x^2-2x-3=0$",
      points: 1,
      responseGuide:
        "Бодолтын алхмуудаа бичээд, эцсийн хариуг $...$ хэлбэрээр өг.",
      answerLatex: "x = 3,\\,-1",
    }),
  ]);

  resetSectionState();
}

