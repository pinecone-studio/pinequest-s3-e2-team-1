import { proxyServiceRequest } from "@/lib/service-proxy";

type RouteContext = {
	params: Promise<{
		testId: string;
	}>;
};

export async function GET(_request: Request, context: RouteContext) {
	const { testId } = await context.params;
	return proxyServiceRequest("generator", `/api/tests/${testId}`, {
		method: "GET",
	});
}

export async function PUT(request: Request, context: RouteContext) {
	const { testId } = await context.params;
	const body = await request.text();

	return proxyServiceRequest("generator", `/api/tests/${testId}`, {
		method: "PUT",
		body,
	});
}

export async function DELETE(_request: Request, context: RouteContext) {
	const { testId } = await context.params;

	return proxyServiceRequest("generator", `/api/tests/${testId}`, {
		method: "DELETE",
	});
}
