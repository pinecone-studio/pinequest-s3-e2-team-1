import { createSchema } from "graphql-yoga";
import { resolvers } from "./resolvers";

export const typeDefs = /* GraphQL */ `
  type Student {
    id: ID!
    name: String!
    className: String!
  }

  type TestCriteria {
    gradeLevel: Int!
    className: String!
    subject: String!
    topic: String!
    difficulty: String!
    questionCount: Int!
  }

  type Test {
    id: ID!
    title: String!
    description: String!
    criteria: TestCriteria!
    updatedAt: String!
  }

  type ExternalExamSummary {
    examId: ID!
    title: String!
    updatedAt: String!
  }

  type ExternalExamImportResult {
    examId: ID!
    importedTestId: ID!
    title: String!
  }

  type ExamOption {
    id: ID!
    text: String!
  }

  type ExistingAnswer {
    questionId: ID!
    selectedOptionId: String
  }

  type StudentExamQuestion {
    questionId: ID!
    type: String!
    prompt: String!
    options: [ExamOption!]!
    points: Int!
    competency: String
    imageUrl: String
    audioUrl: String
    videoUrl: String
    responseGuide: String
  }

  type ExamSession {
    testId: ID!
    title: String!
    description: String!
    criteria: TestCriteria!
    timeLimitMinutes: Int!
    questions: [StudentExamQuestion!]!
  }

  type ExamProgress {
    totalQuestions: Int!
    answeredQuestions: Int!
    remainingQuestions: Int!
    completionRate: Int!
  }

  type AttemptMonitoringEvent {
    id: ID!
    code: String!
    severity: String!
    title: String!
    detail: String!
    occurredAt: String!
  }

  type AttemptMonitoringSummary {
    totalEvents: Int!
    warningCount: Int!
    dangerCount: Int!
    lastEventAt: String
    recentEvents: [AttemptMonitoringEvent!]!
  }

  type AttemptFeedback {
    headline: String!
    summary: String!
    strengths: [String!]!
    improvements: [String!]!
  }

  type QuestionResult {
    questionId: ID!
    selectedOptionId: String
    correctOptionId: String!
    isCorrect: Boolean!
    pointsAwarded: Int!
    maxPoints: Int!
    explanation: String
  }

  type AttemptResultSummary {
    score: Int!
    maxScore: Int!
    percentage: Int!
    correctCount: Int!
    incorrectCount: Int!
    unansweredCount: Int!
    questionResults: [QuestionResult!]!
  }

  type AttemptSummary {
    attemptId: ID!
    testId: ID!
    title: String!
    studentId: String!
    studentName: String!
    status: String!
    score: Int
    maxScore: Int
    percentage: Int
    startedAt: String!
    submittedAt: String
    result: AttemptResultSummary
    monitoring: AttemptMonitoringSummary
    feedback: AttemptFeedback
  }

  type AttemptLiveFeedItem {
    attemptId: ID!
    testId: ID!
    title: String!
    studentId: String!
    studentName: String!
    status: String!
    startedAt: String!
    submittedAt: String
    monitoring: AttemptMonitoringSummary
    latestEvent: AttemptMonitoringEvent
  }

  type StartExamPayload {
    attemptId: ID!
    status: String!
    studentId: String!
    studentName: String!
    startedAt: String!
    expiresAt: String!
    existingAnswers: [ExistingAnswer!]
    exam: ExamSession!
    progress: ExamProgress!
  }

  type SubmitAnswersPayload {
    attemptId: ID!
    status: String!
    progress: ExamProgress!
    result: AttemptResultSummary
    feedback: AttemptFeedback
  }

  type Query {
    students: [Student!]!
    availableTests: [Test!]!
    attempts: [AttemptSummary!]!
    liveMonitoringFeed(limit: Int): [AttemptLiveFeedItem!]!
    externalNewMathExams(limit: Int): [ExternalExamSummary!]!
  }

  type Mutation {
    saveTest(test: String!): Boolean!
    importNewMathExam(examId: ID!): ExternalExamImportResult!
    syncExternalNewMathExams(limit: Int): [ExternalExamImportResult!]!
    startExam(testId: String!, studentId: String!, studentName: String!): StartExamPayload!
    resumeExam(attemptId: String!): StartExamPayload!
    submitAnswers(attemptId: String!, answers: [AnswerInput!]!, finalize: Boolean!): SubmitAnswersPayload!
    approveAttempt(attemptId: String!): Boolean!
    logAttemptActivity(attemptId: String!, input: AttemptActivityInput!): Boolean!
  }

  input AnswerInput {
    questionId: ID!
    selectedOptionId: String
  }

  input AttemptActivityInput {
    code: String!
    severity: String!
    title: String!
    detail: String!
    occurredAt: String
  }
`;

export const schema = createSchema({
  typeDefs,
  resolvers,
});
