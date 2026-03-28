import { NextResponse } from "next/server";
import { print } from "graphql";
import { getTakeExamGraphqlUrl } from "@/lib/take-exam-graphql";
import {
  FrontendTakeExamDashboardDocument,
  FrontendTakeExamDashboardWithMaterialDocument,
  type FrontendTakeExamDashboardQuery,
  type FrontendTakeExamDashboardWithMaterialQuery,
} from "@/take-exam-gql/operations";

const DASHBOARD_QUERY = print(FrontendTakeExamDashboardDocument);
const DASHBOARD_WITH_MATERIAL_QUERY = print(
  FrontendTakeExamDashboardWithMaterialDocument,
);

type DashboardQueryData =
  | FrontendTakeExamDashboardQuery
  | FrontendTakeExamDashboardWithMaterialQuery;

type GraphQlPayload<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") ?? "12");
  const testId = searchParams.get("testId");
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 40)
    : 12;

  try {
    const response = await fetch(getTakeExamGraphqlUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        query: testId ? DASHBOARD_WITH_MATERIAL_QUERY : DASHBOARD_QUERY,
        variables: testId ? { limit, testId } : { limit },
      }),
    });

    const payload = (await response.json()) as GraphQlPayload<DashboardQueryData>;

    if (!response.ok || payload.errors?.length || !payload.data) {
      return NextResponse.json(
        {
          message:
            payload.errors?.[0]?.message ??
            "Take exam service-ээс dashboard өгөгдөл авч чадсангүй.",
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    return NextResponse.json(payload.data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Dashboard route дуудах үед алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
