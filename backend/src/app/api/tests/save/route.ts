import { NextResponse } from "next/server";
import type { SaveTestRequest, SaveTestResponse } from "@shared/contracts/mock-exam";
import { saveTest } from "@/lib/mock-exams/store";

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as SaveTestRequest;
		const test = saveTest(body.testId);

		// Push to Student Portal via GraphQL
		const examServiceUrl = process.env.EXAM_SERVICE_URL || "http://localhost:3002";
		try {
			const query = `
                mutation Save($t: String!) {
                    saveTest(test: $t)
                }
            `;
			await fetch(`${examServiceUrl.replace(/\/$/, "")}/api/graphql`, {
				method: "POST",
				body: JSON.stringify({ query, variables: { t: JSON.stringify(test) } }),
				headers: { "Content-Type": "application/json" },
			});
		} catch (e) {
			console.error("Failed to push test to GraphQL API", e);
		}

		const response: SaveTestResponse = {
			test,
		};

		return NextResponse.json(response);
	} catch (error) {
		return NextResponse.json(
			{ message: error instanceof Error ? error.message : "Unable to save mock exam." },
			{ status: 400 },
		);
	}
}
