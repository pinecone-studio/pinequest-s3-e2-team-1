import { proxyServiceRequest } from "@/lib/service-proxy";

type RouteContext = {
	params: Promise<{
		attemptId: string;
	}>;
};

export async function GET(_request: Request, context: RouteContext) {
	const { attemptId } = await context.params;
	return proxyServiceRequest("exam", `/api/exams/${attemptId}/progress`, {
		method: "GET",
	});
}
