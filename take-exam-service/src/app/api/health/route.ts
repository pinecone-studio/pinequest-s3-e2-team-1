import { NextResponse } from "next/server";
import { getExamServiceStats } from "@/lib/exam-service/store";

export function GET() {
	return NextResponse.json({
		service: "take-exam-service",
		status: "ok",
		timestamp: new Date().toISOString(),
		stats: getExamServiceStats(),
		endpoints: {
			startExam: "POST /api/exams/start",
			submitAnswers: "POST /api/exams/submit",
			getProgress: "GET /api/exams/:attemptId/progress",
		},
	});
}
