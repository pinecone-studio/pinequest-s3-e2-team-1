import { proxyServiceRequest } from "@/lib/service-proxy";

export async function POST(request: Request) {
	const body = await request.text();
	return proxyServiceRequest("generator", "/api/tests/save", {
		method: "POST",
		body,
	});
}
