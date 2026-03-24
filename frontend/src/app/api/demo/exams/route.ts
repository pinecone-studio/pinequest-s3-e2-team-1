import { proxyServiceRequest } from "@/lib/service-proxy";

export async function GET() {
    return proxyServiceRequest("exam", "/api/exams", {
        method: "GET",
    });
}
