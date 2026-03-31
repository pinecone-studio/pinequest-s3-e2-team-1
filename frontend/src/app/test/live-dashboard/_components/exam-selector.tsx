"use client";

import { Input } from "@/components/ui/input";
import { useState } from "react";
import { BookOpen, CheckCircle2, Radio, Search } from "lucide-react";
import { Exam } from "../lib/types";
import { ExamCard } from "./exam-card";

interface ExamSelectorProps {
  exams: Exam[];
  onSelectExam: (exam: Exam) => void;
}

export function ExamSelector({ exams, onSelectExam }: ExamSelectorProps) {
  const [search, setSearch] = useState("");

  const filteredExams = exams.filter(
    (exam) =>
      exam.title.toLowerCase().includes(search.toLowerCase()) ||
      exam.subject.toLowerCase().includes(search.toLowerCase()) ||
      exam.class.toLowerCase().includes(search.toLowerCase()),
  );

  const liveExams = filteredExams.filter(
    (e) => e.liveStudentCount > 0 && !e.endTime,
  );
  const completedExams = filteredExams.filter(
    (e) => e.liveStudentCount === 0 || e.endTime,
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          description="Одоо хянагдаж байгаа"
          icon={Radio}
          title="Идэвхтэй шалгалт"
          value={liveExams.length}
        />
        <SummaryCard
          description="Хяналт дууссан"
          icon={CheckCircle2}
          title="Дууссан шалгалт"
          value={completedExams.length}
        />
        <SummaryCard
          description="Таны нийт сонголт"
          icon={BookOpen}
          title="Нийт шалгалт"
          value={filteredExams.length}
        />
      </div>

      <div className="rounded-[28px] border border-border/80 bg-card/95 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              Таны шалгалтууд
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Оюутнуудын үйл ажиллагааг шууд хянахын тулд шалгалтыг сонгоно уу
            </p>
          </div>

          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Шалгалт хайх..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl border-border/80 bg-background pl-10"
            />
          </div>
        </div>

        {liveExams.length > 0 && (
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Одоо явагдаж байна ({liveExams.length})
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  onClick={() => onSelectExam(exam)}
                />
              ))}
            </div>
          </div>
        )}

        {completedExams.length > 0 && (
          <div>
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Дууссан ({completedExams.length})
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completedExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  onClick={() => onSelectExam(exam)}
                />
              ))}
            </div>
          </div>
        )}

        {filteredExams.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              Таны хайлттай тохирох шалгалт олдсонгүй.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  description: string;
  icon: typeof Radio;
  title: string;
  value: number;
}

function SummaryCard({
  description,
  icon: Icon,
  title,
  value,
}: SummaryCardProps) {
  return (
    <div className="rounded-3xl border border-border/80 bg-card/90 p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.5)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-6 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}
