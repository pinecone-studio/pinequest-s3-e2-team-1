import { and, asc, gt, lt } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../context";
import {
	SchoolCalendarEventCategory,
	SchoolCalendarEventVisibility,
	SchoolEventLayerKind,
} from "../../generated/resolvers-types";
import { schoolCalendarEvents } from "../../../db/schema";

type Args = {
	rangeStart: string;
	rangeEnd: string;
};

const CATEGORY_MAP: Record<string, SchoolCalendarEventCategory> = {
	ACADEMIC: SchoolCalendarEventCategory.Academic,
	ADMIN: SchoolCalendarEventCategory.Admin,
	CAMPUS_LIFE: SchoolCalendarEventCategory.CampusLife,
	RESOURCE_CONSTRAINT: SchoolCalendarEventCategory.ResourceConstraint,
};

const VIS_MAP: Record<string, SchoolCalendarEventVisibility> = {
	SCHOOL_WIDE: SchoolCalendarEventVisibility.SchoolWide,
	TEACHERS: SchoolCalendarEventVisibility.Teachers,
	PUBLIC: SchoolCalendarEventVisibility.Public,
};

/** D1 `layer_kind` → GraphQL enum */
const LAYER_KIND_MAP: Record<string, SchoolEventLayerKind> = {
	holiday: SchoolEventLayerKind.Holiday,
	admin_fixed: SchoolEventLayerKind.AdminFixed,
	resource_lock: SchoolEventLayerKind.ResourceLock,
	academic_milestone: SchoolEventLayerKind.AcademicMilestone,
};

export const schoolCalendarEventQueries = {
	schoolCalendarEvents: async (
		_: unknown,
		args: Args,
		ctx: GraphQLContext,
	) => {
		if (!ctx.db) {
			throw new GraphQLError("D1 DB холбогдоогүй байна.");
		}
		const rs = String(args.rangeStart ?? "").trim();
		const re = String(args.rangeEnd ?? "").trim();
		if (!rs || !re) {
			throw new GraphQLError("rangeStart, rangeEnd заавал бөглөнө (ISO 8601).");
		}
		const rangeStart = new Date(rs);
		const rangeEnd = new Date(re);
		if (
			Number.isNaN(rangeStart.getTime()) ||
			Number.isNaN(rangeEnd.getTime())
		) {
			throw new GraphQLError("rangeStart / rangeEnd ISO 8601 буруу байна.");
		}
		if (rangeStart.getTime() > rangeEnd.getTime()) {
			throw new GraphQLError("rangeStart нь rangeEnd-аас их байж болохгүй.");
		}

		const rows = await ctx.db
			.select()
			.from(schoolCalendarEvents)
			.where(
				and(
					lt(schoolCalendarEvents.startTime, rangeEnd),
					gt(schoolCalendarEvents.endTime, rangeStart),
				),
			)
			.orderBy(asc(schoolCalendarEvents.startTime));

		const asDate = (v: unknown): Date => {
			if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
			if (typeof v === "number") {
				return v > 1e12 ? new Date(v) : new Date(v * 1000);
			}
			const d = new Date(String(v));
			return Number.isNaN(d.getTime()) ? new Date(0) : d;
		};

		return rows.map((row) => {
			const st = asDate(row.startTime);
			const en = asDate(row.endTime);
			const cat = CATEGORY_MAP[String(row.category)] ?? SchoolCalendarEventCategory.Academic;
			const vis =
				VIS_MAP[String(row.visibility)] ??
				SchoolCalendarEventVisibility.SchoolWide;
			const lk =
				LAYER_KIND_MAP[String(row.layerKind)] ??
				SchoolEventLayerKind.AcademicMilestone;
			return {
				id: row.id,
				title: row.title,
				description: row.description ?? null,
				category: cat,
				layerKind: lk,
				subcategory: row.subcategory ?? null,
				startAt: st.toISOString(),
				endAt: en.toISOString(),
				allDay: Boolean(row.allDay),
				visibility: vis,
				metadataJson: row.metadataJson ?? null,
			};
		});
	},
};
