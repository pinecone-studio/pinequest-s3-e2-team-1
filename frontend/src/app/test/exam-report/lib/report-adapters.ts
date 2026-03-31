import {
  buildExamDashboardData,
  buildExamList,
  type DashboardApiPayload,
} from "../../live-dashboard/lib/dashboard-adapters";
import type {
  AnalyticsScoreBucket,
  Exam,
  ExamAnalytics,
  RiskLevel,
  StudentStatus,
} from "../../live-dashboard/lib/types";

const FAILING_SCORE_THRESHOLD = 60;

export interface ReportStudentRow {
  dangerCount: number;
  id: string;
  lastActivity: Date;
  name: string;
  riskLevel: RiskLevel;
  score: number | null;
  status: StudentStatus;
  studentCode: string;
  submittedAt: Date | null;
  warningCount: number;
}

export interface WeakQuestion {
  errorRate: number;
  label: string;
  missedCount: number;
  prompt: string;
  totalCount: number;
}

export interface ExamReportData {
  analytics: ExamAnalytics;
  exam: Exam;
  failingCount: number;
  highestScore: number | null;
  lowestScore: number | null;
  scoreDistribution: AnalyticsScoreBucket[];
  students: ReportStudentRow[];
  summaryAverage: number | null;
  weakQuestions: WeakQuestion[];
}

export function pickDefaultReportExamId(
  payload: DashboardApiPayload | null,
): string | null {
  if (!payload) {
    return null;
  }

  const exams = buildExamList(payload).filter((exam) => exam.totalStudentCount > 0);
  const completedExam =
    exams
      .filter((exam) => Boolean(exam.endTime))
      .sort((left, right) => {
        return (
          (right.endTime?.getTime() ?? right.startTime.getTime()) -
          (left.endTime?.getTime() ?? left.startTime.getTime())
        );
      })[0] ?? null;

  return completedExam?.id ?? exams[0]?.id ?? null;
}

export function buildExamReportData(
  payload: DashboardApiPayload,
  examId: string,
): ExamReportData | null {
  const dashboardData = buildExamDashboardData(payload, examId);
  if (!dashboardData.exam) {
    return null;
  }

  const reportStudents = payload.attempts
    .filter((attempt) => attempt.testId === examId)
    .map((attempt) => {
      const student = dashboardData.students.find(
        (item) => item.id === attempt.studentId,
      );

      return {
        dangerCount: student?.dangerCount ?? 0,
        id: attempt.studentId,
        lastActivity:
          student?.lastActivity ??
          new Date(attempt.submittedAt ?? attempt.startedAt),
        name: attempt.studentName,
        riskLevel: student?.riskLevel ?? "low",
        score:
          student?.score ??
          attempt.result?.percentage ??
          attempt.percentage ??
          attempt.score ??
          null,
        status: student?.status ?? toStudentStatus(attempt.status),
        studentCode: attempt.studentId,
        submittedAt: attempt.submittedAt ? new Date(attempt.submittedAt) : null,
        warningCount: student?.warningCount ?? 0,
      };
    })
    .sort((left, right) => {
      const rightScore = right.score ?? -1;
      const leftScore = left.score ?? -1;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return right.name.localeCompare(left.name);
    });

  const scoredStudents = reportStudents.filter(
    (student) => typeof student.score === "number",
  );
  const scores = scoredStudents.map((student) => student.score ?? 0);
  const summaryAverage =
    scores.length > 0
      ? Number(
          (
            scores.reduce((sum, score) => sum + score, 0) / scores.length
          ).toFixed(1),
        )
      : null;

  const highestScore = scores.length > 0 ? Math.max(...scores) : null;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : null;
  const failingCount = scoredStudents.filter(
    (student) => (student.score ?? 0) < FAILING_SCORE_THRESHOLD,
  ).length;

  return {
    analytics: dashboardData.analytics,
    exam: dashboardData.exam,
    failingCount,
    highestScore,
    lowestScore,
    scoreDistribution: dashboardData.analytics.scoreDistribution,
    students: reportStudents,
    summaryAverage,
    weakQuestions: buildWeakQuestions(payload, examId),
  };
}

function buildWeakQuestions(
  payload: DashboardApiPayload,
  examId: string,
): WeakQuestion[] {
  const materialQuestions =
    payload.testMaterial?.testId === examId ? payload.testMaterial.questions : [];
  const questionOrder = new Map(
    materialQuestions.map((question, index) => [question.questionId, index] as const),
  );
  const questionPrompt = new Map(
    materialQuestions.map((question) => [question.questionId, question.prompt] as const),
  );

  const questionStats = new Map<
    string,
    { missedCount: number; order: number; prompt: string; totalCount: number }
  >();

  for (const attempt of payload.attempts.filter((item) => item.testId === examId)) {
    for (const result of attempt.result?.questionResults ?? []) {
      const current = questionStats.get(result.questionId) ?? {
        missedCount: 0,
        order: questionOrder.get(result.questionId) ?? Number.MAX_SAFE_INTEGER,
        prompt:
          questionPrompt.get(result.questionId) ??
          result.prompt ??
          `Асуулт ${result.questionId}`,
        totalCount: 0,
      };

      current.totalCount += 1;
      if (!result.isCorrect || result.pointsAwarded < result.maxPoints) {
        current.missedCount += 1;
      }

      questionStats.set(result.questionId, current);
    }
  }

  return [...questionStats.entries()]
    .map(([questionId, stat]) => ({
      errorRate:
        stat.totalCount > 0
          ? Math.round((stat.missedCount / stat.totalCount) * 100)
          : 0,
      label: formatQuestionLabel(stat.order, questionId),
      missedCount: stat.missedCount,
      prompt: stat.prompt,
      totalCount: stat.totalCount,
    }))
    .sort((left, right) => {
      if (right.errorRate !== left.errorRate) {
        return right.errorRate - left.errorRate;
      }

      return right.missedCount - left.missedCount;
    })
    .slice(0, 4);
}

function formatQuestionLabel(order: number, questionId: string): string {
  if (Number.isFinite(order) && order !== Number.MAX_SAFE_INTEGER) {
    return `A${String(order + 1).padStart(2, "0")}`;
  }

  return questionId;
}

function toStudentStatus(status: DashboardApiPayload["attempts"][number]["status"]): StudentStatus {
  switch (status) {
    case "in_progress":
      return "in-progress";
    case "processing":
      return "processing";
    case "submitted":
      return "submitted";
    case "approved":
      return "approved";
    default:
      return "processing";
  }
}
