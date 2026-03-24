import { NextResponse } from "next/server";
import type { GenerateTestRequest, GenerateTestResponse } from "@shared/contracts/mock-exam";
import { generateTest } from "@/lib/mock-exams/store";

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as GenerateTestRequest;
		const response: GenerateTestResponse = generateTest(body);
		return NextResponse.json(response);
	} catch (error) {
		return NextResponse.json(
			{ message: error instanceof Error ? error.message : "Unable to generate mock exam." },
			{ status: 400 },
		);
	}
}
