import { createYoga } from "graphql-yoga";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { schema } from "@/lib/graphql/schema";

const yoga = createYoga({
	schema,
	graphqlEndpoint: "/api/graphql",
	fetchAPI: { Response, Request },
	maskedErrors: false,
});

async function handleYogaRequest(request: Request) {
	try {
		return await yoga.handleRequest(request, {});
	} catch (error) {
		const body = JSON.stringify({
			errors: [
				{
					message:
						error instanceof Error ? error.message : "Internal server error",
				},
			],
		});

		return new Response(body, {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

export async function GET(request: NextRequest) {
	const hasQuery =
		request.nextUrl.searchParams.has("query") ||
		request.nextUrl.searchParams.has("operationName") ||
		request.nextUrl.searchParams.has("variables") ||
		request.nextUrl.searchParams.has("extensions");

	if (hasQuery) {
		return handleYogaRequest(request);
	}

	const explorer = new URL("https://studio.apollographql.com/sandbox/explorer");
	explorer.searchParams.set("endpoint", `${request.nextUrl.origin}/api/graphql`);
	return NextResponse.redirect(explorer, 302);
}

export async function POST(request: Request) {
	return handleYogaRequest(request);
}

export async function OPTIONS() {
	return new Response(null, { status: 204 });
}
