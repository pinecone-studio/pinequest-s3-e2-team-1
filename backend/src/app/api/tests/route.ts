import { NextResponse } from "next/server";
import type { ListTestsResponse } from "@shared/contracts/mock-exam";
import { listTests } from "@/lib/mock-exams/store";

export function GET() {
	const response: ListTestsResponse = {
		tests: listTests(),
	};

	return NextResponse.json(response);
}
