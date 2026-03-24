import { NextResponse } from "next/server";

type ServiceKind = "generator" | "exam";

const defaultServiceBases: Record<ServiceKind, string> = {
	generator: "http://localhost:3001",
	exam: "http://localhost:3002",
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const resolveServiceBase = (service: ServiceKind) => {
	const configuredBase =
		service === "generator" ? process.env.TEST_GENERATOR_BASE_URL?.trim() : process.env.EXAM_SERVICE_BASE_URL?.trim();

	return normalizeBaseUrl(configuredBase || defaultServiceBases[service]);
};

export async function proxyServiceRequest(
	service: ServiceKind,
	path: string,
	init: {
		method: "GET" | "POST" | "PUT" | "DELETE";
		body?: string;
	},
) {
	try {
		const headers: Record<string, string> = {
			Accept: "application/json",
		};

		if (init.body) {
			headers["Content-Type"] = "application/json";
		}

		const response = await fetch(`${resolveServiceBase(service)}${path}`, {
			method: init.method,
			headers,
			body: init.body,
			cache: "no-store",
		});
		const payload = await response.text();

		return new Response(payload || "{}", {
			status: response.status,
			headers: {
				"content-type": response.headers.get("content-type") ?? "application/json",
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				message:
					error instanceof Error
						? error.message
						: `Unable to reach the ${service === "generator" ? "Test Generator" : "Exam Service"}.`,
			},
			{ status: 502 },
		);
	}
}
