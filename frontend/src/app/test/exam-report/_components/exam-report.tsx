import { Badge } from "@/components/ui/badge";
import type { ExamReportData } from "../lib/report-adapters";
import { ReportResultsTable } from "./report-results-table";
import { ReportScoreChart } from "./report-score-chart";
import { ReportSummaryCards } from "./report-summary-cards";
import { ReportWeakQuestions } from "./report-weak-questions";

interface ExamReportProps {
  report: ExamReportData;
}

export function ExamReport({ report }: ExamReportProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-border/80 bg-card/90 p-6 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.35)] lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Шалгалтын дараах гүйцэтгэлийн шинжилгээ
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {report.exam.subject} • {report.exam.topic} • {report.exam.class}
          </p>
        </div>
        <Badge
          variant="secondary"
          className="w-fit rounded-2xl bg-primary/10 px-4 py-2 text-primary"
        >
          {report.exam.class}
        </Badge>
      </div>

      <ReportSummaryCards
        averageScore={report.summaryAverage}
        failingCount={report.failingCount}
        highestScore={report.highestScore}
        lowestScore={report.lowestScore}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ReportWeakQuestions questions={report.weakQuestions} />
        <ReportScoreChart data={report.scoreDistribution} />
      </div>

      <ReportResultsTable rows={report.students} />
    </div>
  );
}
