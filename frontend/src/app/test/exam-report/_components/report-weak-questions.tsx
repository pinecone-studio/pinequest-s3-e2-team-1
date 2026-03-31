import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeakQuestion } from "../lib/report-adapters";

interface ReportWeakQuestionsProps {
  questions: WeakQuestion[];
}

export function ReportWeakQuestions({
  questions,
}: ReportWeakQuestionsProps) {
  const strongestRate = questions[0]?.errorRate ?? 0;

  return (
    <Card className="rounded-[26px] border-border/80 bg-card/95 py-0 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.35)]">
      <CardHeader className="border-b border-border/70 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Хамгийн их алдсан асуултууд</CardTitle>
            <p className="text-sm text-muted-foreground">
              Алдааны хувь хамгийн өндөр асуултууд
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 py-5">
        {questions.length > 0 ? (
          <div className="space-y-5">
            {questions.map((question) => (
              <div key={question.label} className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {question.label}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {question.prompt}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-danger">
                      {question.errorRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {question.missedCount}/{question.totalCount}
                    </p>
                  </div>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#9a3412_0%,#c2410c_100%)]"
                    style={{
                      width: `${
                        strongestRate > 0
                          ? Math.max(
                              Math.round(
                                (question.errorRate / strongestRate) * 100,
                              ),
                              12,
                            )
                          : 12
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 text-sm text-muted-foreground">
            Алдааны статистик хараахан бүрдээгүй байна.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
