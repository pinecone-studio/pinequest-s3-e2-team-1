import { proxyServiceRequest } from "@/lib/service-proxy";

export async function POST(request: Request) {
	const body = await request.text();
	return proxyServiceRequest("exam", "/api/exams/submit", {
		method: "POST",
		body,
	});
}
