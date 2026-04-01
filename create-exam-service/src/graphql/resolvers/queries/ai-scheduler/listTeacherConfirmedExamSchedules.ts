import { and, asc, eq, gte, lte } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import { examSchedules, newExams } from "../../../../db/schema";
import { examScheduleRowToGql } from "../../../../lib/exam-schedule-variants";

type Args = {
  teacherId: string;
  startDate: string;
  endDate: string;
};

export const listTeacherConfirmedExamSchedulesQuery = {
  listTeacherConfirmedExamSchedules: async (
    _: unknown,
    args: Args,
    ctx: GraphQLContext,
  ) => {
    if (!ctx.db) {
      throw new GraphQLError("D1 DB холбогдоогүй байна.");
    }

    const teacherId = String(args.teacherId ?? "").trim();
    const startDate = String(args.startDate ?? "").trim();
    const endDate = String(args.endDate ?? "").trim();

    if (!teacherId || !startDate || !endDate) {
      throw new GraphQLError("teacherId, startDate, endDate шаардлагатай.");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new GraphQLError("startDate, endDate нь ISO 8601 форматтай байна.");
    }

    const rows = await ctx.db
      .select({
        id: examSchedules.id,
        testId: examSchedules.testId,
        classId: examSchedules.classId,
        startTime: examSchedules.startTime,
        endTime: examSchedules.endTime,
        roomId: examSchedules.roomId,
        status: examSchedules.status,
        aiVariantsJson: examSchedules.aiVariantsJson,
        aiReasoning: examSchedules.aiReasoning,
        createdAt: examSchedules.createdAt,
        updatedAt: examSchedules.updatedAt,
      })
      .from(examSchedules)
      .innerJoin(newExams, eq(examSchedules.testId, newExams.id))
      .where(
        and(
          eq(newExams.teacherId, teacherId),
          eq(examSchedules.status, "confirmed"),
          gte(examSchedules.startTime, start),
          lte(examSchedules.startTime, end),
        ),
      )
      .orderBy(asc(examSchedules.startTime));

    return rows.map((row) => examScheduleRowToGql(row));
  },
};
