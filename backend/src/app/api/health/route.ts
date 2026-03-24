import { NextResponse } from "next/server";
import { getGeneratorStats } from "@/lib/mock-exams/store";

export function GET() {
	return NextResponse.json({
		service: "create-exam-service",
		status: "ok",
		timestamp: new Date().toISOString(),
		stats: getGeneratorStats(),
		endpoints: {
			generateTest: "POST /api/tests/generate",
			getTestById: "GET /api/tests/:testId",
			editTest: "PUT /api/tests/:testId",
			deleteTest: "DELETE /api/tests/:testId",
			saveTest: "POST /api/tests/save",
		},
		notes: [
			"Test Generator owns its own schema and stores correct answers internally.",
			"Exam service consumes tests through the shared TypeScript contract only.",
		],
	});
}
