import { NextResponse } from "next/server";
import type {
	DeleteTestResponse,
	GetTestByIdResponse,
	UpdateTestRequest,
	UpdateTestResponse,
} from "@shared/contracts/mock-exam";
import { deleteTest, getTestById, updateTest } from "@/lib/mock-exams/store";

type RouteContext = {
	params: Promise<{
		testId: string;
	}>;
};

export async function GET(_request: Request, context: RouteContext) {
	const { testId } = await context.params;
	const test = getTestById(testId);

	if (!test) {
		return NextResponse.json({ message: "Mock exam not found." }, { status: 404 });
	}

	const response: GetTestByIdResponse = { test };
	return NextResponse.json(response);
}

export async function PUT(request: Request, context: RouteContext) {
	try {
		const { testId } = await context.params;
		const body = (await request.json()) as UpdateTestRequest;
		const response: UpdateTestResponse = {
			test: updateTest(testId, body.draft),
		};

		return NextResponse.json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to update mock exam.";
		const status = message === "Requested test was not found." ? 404 : 400;

		return NextResponse.json({ message }, { status });
	}
}

export async function DELETE(_request: Request, context: RouteContext) {
	try {
		const { testId } = await context.params;
		const response: DeleteTestResponse = {
			deletedTestId: deleteTest(testId),
		};

		return NextResponse.json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to delete mock exam.";
		const status = message === "Requested test was not found." ? 404 : 400;

		return NextResponse.json({ message }, { status });
	}
}
