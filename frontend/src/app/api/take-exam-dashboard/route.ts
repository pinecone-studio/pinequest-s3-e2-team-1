import { NextResponse } from "next/server";
import { getTakeExamGraphqlUrl } from "@/lib/take-exam-graphql";

const DASHBOARD_QUERY = /* GraphQL */ `
  query FrontendTakeExamDashboard($limit: Int!) {
    availableTests {
      id
      title
      description
      answerKeySource
      updatedAt
      criteria {
        gradeLevel
        className
        subject
        topic
        difficulty
        questionCount
      }
    }
    attempts {
      attemptId
      testId
      title
      studentId
      studentName
      status
      answerKeySource
      criteria {
        gradeLevel
        className
        subject
        topic
        difficulty
        questionCount
      }
      progress {
        totalQuestions
        answeredQuestions
        remainingQuestions
        completionRate
      }
      score
      maxScore
      percentage
      startedAt
      submittedAt
      monitoring {
        totalEvents
        infoCount
        warningCount
        dangerCount
        lastEventAt
        recentEvents {
          id
          code
          severity
          title
          detail
          occurredAt
        }
      }
      result {
        score
        maxScore
        percentage
        correctCount
        incorrectCount
        unansweredCount
        questionResults {
          questionId
          prompt
          competency
          questionType
          selectedOptionId
          correctOptionId
          isCorrect
          pointsAwarded
          maxPoints
          explanation
          dwellMs
          answerChangeCount
        }
      }
      feedback {
        headline
        summary
        strengths
        improvements
      }
      teacherSync {
        status
        targetService
        lastError
        sentAt
      }
      answerReview {
        questionId
        prompt
        competency
        questionType
        selectedOptionId
        selectedAnswerText
        points
        responseGuide
        dwellMs
        answerChangeCount
      }
    }
    liveMonitoringFeed(limit: $limit) {
      attemptId
      testId
      title
      studentId
      studentName
      status
      startedAt
      submittedAt
      monitoring {
        totalEvents
        infoCount
        warningCount
        dangerCount
        lastEventAt
      }
      latestEvent {
        id
        code
        severity
        title
        detail
        occurredAt
      }
    }
  }
`;

const DASHBOARD_WITH_MATERIAL_QUERY = /* GraphQL */ `
  query FrontendTakeExamDashboardWithMaterial($limit: Int!, $testId: ID!) {
    availableTests {
      id
      title
      description
      answerKeySource
      updatedAt
      criteria {
        gradeLevel
        className
        subject
        topic
        difficulty
        questionCount
      }
    }
    attempts {
      attemptId
      testId
      title
      studentId
      studentName
      status
      answerKeySource
      criteria {
        gradeLevel
        className
        subject
        topic
        difficulty
        questionCount
      }
      progress {
        totalQuestions
        answeredQuestions
        remainingQuestions
        completionRate
      }
      score
      maxScore
      percentage
      startedAt
      submittedAt
      monitoring {
        totalEvents
        infoCount
        warningCount
        dangerCount
        lastEventAt
        recentEvents {
          id
          code
          severity
          title
          detail
          occurredAt
        }
      }
      result {
        score
        maxScore
        percentage
        correctCount
        incorrectCount
        unansweredCount
        questionResults {
          questionId
          prompt
          competency
          questionType
          selectedOptionId
          correctOptionId
          isCorrect
          pointsAwarded
          maxPoints
          explanation
          dwellMs
          answerChangeCount
        }
      }
      feedback {
        headline
        summary
        strengths
        improvements
      }
      teacherSync {
        status
        targetService
        lastError
        sentAt
      }
      answerReview {
        questionId
        prompt
        competency
        questionType
        selectedOptionId
        selectedAnswerText
        points
        responseGuide
        dwellMs
        answerChangeCount
      }
    }
    liveMonitoringFeed(limit: $limit) {
      attemptId
      testId
      title
      studentId
      studentName
      status
      startedAt
      submittedAt
      monitoring {
        totalEvents
        infoCount
        warningCount
        dangerCount
        lastEventAt
      }
      latestEvent {
        id
        code
        severity
        title
        detail
        occurredAt
      }
    }
    testMaterial(testId: $testId) {
      testId
      title
      description
      timeLimitMinutes
      criteria {
        gradeLevel
        className
        subject
        topic
        difficulty
        questionCount
      }
      questions {
        questionId
        type
        prompt
        points
        competency
        imageUrl
        audioUrl
        videoUrl
        responseGuide
        options {
          id
          text
        }
      }
    }
  }
`;

type GraphQlPayload<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") ?? "12");
  const testId = searchParams.get("testId");
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 40)
    : 12;

  try {
    const response = await fetch(getTakeExamGraphqlUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        query: testId ? DASHBOARD_WITH_MATERIAL_QUERY : DASHBOARD_QUERY,
        variables: testId ? { limit, testId } : { limit },
      }),
    });

    const payload = (await response.json()) as GraphQlPayload<unknown>;

    if (!response.ok || payload.errors?.length || !payload.data) {
      return NextResponse.json(
        {
          message:
            payload.errors?.[0]?.message ??
            "Take exam service-ээс dashboard өгөгдөл авч чадсангүй.",
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    return NextResponse.json(payload.data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Dashboard route дуудах үед алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
