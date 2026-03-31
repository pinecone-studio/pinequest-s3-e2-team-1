import { NextRequest } from "next/server";
import { getBookApiBaseUrl } from "@/lib/book-question-api";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    path?: string[];
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const segments = Array.isArray(context.params.path) ? context.params.path : [];
  const joined = segments.map((segment) => encodeURIComponent(segment)).join("/");
  const targetUrl = `${getBookApiBaseUrl()}/api/books/${joined}${request.nextUrl.search}`;

  const upstream = await fetch(targetUrl, {
    method: "GET",
    headers: {
      accept: request.headers.get("accept") || "*/*",
    },
    cache: "no-store",
  });

  const headers = new Headers(upstream.headers);
  headers.delete("content-encoding");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

