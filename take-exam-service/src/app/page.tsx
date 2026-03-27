"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TakeExam } from "@/app/_component/take-exam";
import {
  resumeExamRequest,
  startExamRequest,
  submitAnswersRequest,
} from "@/app/_pagecomponents/student-page-api";
import {
  type NavigationSection,
  StudentPageShell,
} from "@/app/_pagecomponents/student-page-shell";
import { SebAccessGate } from "@/app/_pagecomponents/seb-access-gate";
import type {
  GetProgressResponse,
  StartExamResponse,
  SubmitAnswersResponse,
} from "@/lib/exam-service/types";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useAnimatedDocumentTitle } from "@/app/_pagecomponents/use-animated-document-title";
import {
  formatTimeLeft,
  getSebFriendlyWarning,
} from "@/app/_pagecomponents/student-page-utils";
import { useExamMonitoring } from "@/app/_pagecomponents/use-exam-monitoring";
import { usePersistedExamAnswers } from "@/app/_pagecomponents/use-persisted-exam-answers";
import { useSebAccess } from "@/app/_pagecomponents/use-seb-access";
import { useStudentDashboardData } from "@/app/_pagecomponents/use-student-dashboard-data";

export default function StudentAppPage() {
  const ACTIVE_ATTEMPT_STORAGE_KEY = "active_exam_attempt";
  const [activeAttempt, setActiveAttempt] = useState<StartExamResponse | null>(
    null,
  );
  const [latestProgress, setLatestProgress] = useState<
    GetProgressResponse | SubmitAnswersResponse | null
  >(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState<
    Record<string, boolean>
  >({});
  const [activeSection, setActiveSection] =
    useState<NavigationSection>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const autosaveInFlightRef = useRef(false);
  const autoResumeAttemptIdRef = useRef<string | null>(null);
  const { isSebChecking, verifySebAccess } = useSebAccess();
  const {
    activeTestsCount,
    approvedAttempts,
    availableStudents,
    averageScore,
    completedAttempts,
    completedByTestId,
    completionRate,
    filteredTests,
    inProgressByTestId,
    isInitialLoading,
    loadDashboardData,
    passRate,
    passedAttemptsCount,
    resultRows,
    selectedStudent,
    selectedStudentId,
    setSelectedStudentId,
  } = useStudentDashboardData({ setError });
  const { resetActivityTracking, timeLeftMs } = useExamMonitoring(activeAttempt);
  const { answers, clearAnswers, setAnswers } = usePersistedExamAnswers(
    activeAttempt?.attemptId ?? null,
    activeAttempt?.existingAnswers ?? null,
  );

  useAnimatedDocumentTitle("Сурагч Портал");

  const openAttempt = useCallback(
    (attempt: StartExamResponse) => {
      setActiveAttempt(attempt);
      setLatestProgress(null);
      setFlaggedQuestions({});
      resetActivityTracking();
      sessionStorage.setItem(
        ACTIVE_ATTEMPT_STORAGE_KEY,
        JSON.stringify({
          attemptId: attempt.attemptId,
          studentId: attempt.studentId,
        }),
      );
    },
    [ACTIVE_ATTEMPT_STORAGE_KEY, resetActivityTracking],
  );

  const showSebFriendlyWarning = useCallback((message?: string) => {
    const warning = getSebFriendlyWarning(message);
    setError(warning.description);
    toast.warning(warning.title, {
      description: warning.description,
    });
  }, []);

  const handleStartExam = async (testId: string) => {
    if (!selectedStudent) {
      setError("Эхлээд сурагчаа сонгоно уу.");
      return;
    }

    setError(null);
    setIsMutating(true);

    try {
      const sebCheck = await verifySebAccess();
      if (!sebCheck.ok) {
        showSebFriendlyWarning(sebCheck.message);
        return;
      }

      const startedAttempt = await startExamRequest({
        testId,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
      });

      openAttempt(startedAttempt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Шалгалт эхлүүлэхэд алдаа гарлаа.",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleResumeExam = async (attemptId: string) => {
    setError(null);
    setIsMutating(true);

    try {
      const sebCheck = await verifySebAccess();
      if (!sebCheck.ok) {
        showSebFriendlyWarning(sebCheck.message);
        return;
      }

      const resumedAttempt = await resumeExamRequest(attemptId);
      openAttempt(resumedAttempt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Шалгалтыг сэргээж чадсангүй.",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleSelectAnswer = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleToggleFlag = (questionId: string) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleSubmit = async (finalize: boolean) => {
    if (!activeAttempt) return;

    setError(null);
    setIsMutating(true);

    try {
      const payloadAnswers = activeAttempt.exam.questions.map((question) => ({
        questionId: question.questionId,
        selectedOptionId: answers[question.questionId] ?? null,
      }));

      const submittedProgress = await submitAnswersRequest({
        attemptId: activeAttempt.attemptId,
        answers: payloadAnswers,
        finalize,
      });

      setLatestProgress(submittedProgress);

      if (finalize) {
        clearAnswers(activeAttempt.attemptId);
        setActiveAttempt(null);
        setFlaggedQuestions({});
        resetActivityTracking();
        sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
        setActiveSection("results");
        await loadDashboardData();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Хариулт илгээх үед алдаа гарлаа.",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const pageTitle = activeAttempt
    ? "Шалгалт өгч байна"
    : activeSection === "dashboard"
      ? "Хяналтын самбар"
      : activeSection === "tests"
        ? "Идэвхтэй шалгалтууд"
        : "Шалгалтын дүн";

  useEffect(() => {
    if (activeAttempt || isInitialLoading || availableStudents.length === 0) {
      return;
    }

    const savedAttempt = sessionStorage.getItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    if (!savedAttempt) {
      return;
    }

    try {
      const parsed = JSON.parse(savedAttempt) as {
        attemptId?: string;
        studentId?: string;
      };

      if (
        parsed.studentId &&
        parsed.studentId !== selectedStudentId &&
        availableStudents.some((student) => student.id === parsed.studentId)
      ) {
        setSelectedStudentId(parsed.studentId);
      }
    } catch {
      sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    }
  }, [
    activeAttempt,
    availableStudents,
    isInitialLoading,
    selectedStudentId,
    setSelectedStudentId,
  ]);

  useEffect(() => {
    if (
      isInitialLoading ||
      isSebChecking ||
      isMutating ||
      activeAttempt ||
      !selectedStudent
    ) {
      return;
    }

    const savedAttempt = sessionStorage.getItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    if (!savedAttempt) {
      return;
    }

    try {
      const parsed = JSON.parse(savedAttempt) as {
        attemptId?: string;
        studentId?: string;
      };

      if (!parsed.attemptId || !parsed.studentId) {
        sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
        return;
      }

      if (parsed.studentId !== selectedStudent.id) {
        return;
      }

      if (autoResumeAttemptIdRef.current === parsed.attemptId) {
        return;
      }

      const attemptId = parsed.attemptId;
      if (!attemptId) {
        sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
        return;
      }

      autoResumeAttemptIdRef.current = attemptId;

      void (async () => {
        setError(null);
        setIsMutating(true);

        try {
          const sebCheck = await verifySebAccess();
          if (!sebCheck.ok) {
            showSebFriendlyWarning(sebCheck.message);
            return;
          }

          const resumedAttempt = await resumeExamRequest(attemptId);
          openAttempt(resumedAttempt);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Шалгалтыг сэргээж чадсангүй.",
          );
        } finally {
          setIsMutating(false);
        }
      })();
    } catch {
      sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    }
  }, [
    activeAttempt,
    isInitialLoading,
    isMutating,
    isSebChecking,
    openAttempt,
    selectedStudent,
    showSebFriendlyWarning,
    verifySebAccess,
  ]);

  useEffect(() => {
    if (!activeAttempt || isMutating || autosaveInFlightRef.current) {
      return;
    }

    const hasAnswers = Object.values(answers).some(
      (value) => value !== null && value !== "",
    );
    if (!hasAnswers) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      autosaveInFlightRef.current = true;

      try {
        await submitAnswersRequest({
          attemptId: activeAttempt.attemptId,
          answers: activeAttempt.exam.questions.map((question) => ({
            questionId: question.questionId,
            selectedOptionId: answers[question.questionId] ?? null,
          })),
          finalize: false,
        });
      } catch (err) {
        console.error("Failed to autosave exam answers:", err);
      } finally {
        autosaveInFlightRef.current = false;
      }
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [activeAttempt, answers, isMutating]);

  if (activeAttempt) {
    return (
      <>
        <Toaster richColors position="top-center" />
        <TakeExam
          attempt={activeAttempt}
          answers={answers}
          error={error}
          flaggedQuestions={flaggedQuestions}
          isMutating={isMutating}
          timeLeftLabel={formatTimeLeft(timeLeftMs)}
          onSelectAnswer={handleSelectAnswer}
          onSubmit={handleSubmit}
          onToggleFlag={handleToggleFlag}
        />
      </>
    );
  }

  return (
    <>
      <Toaster richColors position="top-center" />
      {isSebChecking ? (
        <SebAccessGate isChecking={true} message={null} onRetry={() => {}} />
      ) : (
        <StudentPageShell
          activeSection={activeSection}
          activeTestsCount={activeTestsCount}
          approvedAttemptsCount={approvedAttempts.length}
          averageScore={averageScore}
          availableStudents={availableStudents}
          completedAttemptsLength={completedAttempts.length}
          completedByTestId={completedByTestId}
          completionRate={completionRate}
          error={error}
          filteredTests={filteredTests}
          inProgressByTestId={inProgressByTestId}
          isInitialLoading={isInitialLoading}
          isMutating={isMutating}
          latestProgress={latestProgress}
          pageTitle={pageTitle}
          passRate={passRate}
          passedAttemptsCount={passedAttemptsCount}
          resultRows={resultRows}
          selectedStudent={selectedStudent}
          selectedStudentId={selectedStudentId}
          onResumeExam={handleResumeExam}
          onSectionChange={setActiveSection}
          onSelectStudent={setSelectedStudentId}
          onStartExam={handleStartExam}
        />
      )}
    </>
  );
}
