import { proxyServiceRequest } from "@/lib/service-proxy";

export async function POST(request: Request) {
    const { attemptId } = await request.json();
    const query = `
        mutation Approve($aid: String!) {
            approveAttempt(attemptId: $aid)
        }
    `;

    return proxyServiceRequest("exam", "/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { aid: attemptId } }),
    });
}
