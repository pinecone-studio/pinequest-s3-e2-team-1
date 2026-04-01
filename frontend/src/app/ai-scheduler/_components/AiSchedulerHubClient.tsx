"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import {
	CalendarClock,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	FileQuestion,
	GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AiTeacherPersonalScheduler } from "@/app/ai-scheduler/_components/AiTeacherPersonalScheduler";
import { AiStudentPersonalScheduler } from "@/app/ai-scheduler/_components/AiStudentPersonalScheduler";
import GenerateExamPage from "@/app/ai-scheduler/_components/GenerateExamPage";
import { SchoolEventScheduler } from "@/app/ai-scheduler/_components/SchoolEventScheduler";

export function AiSchedulerHubClient() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const rawView = searchParams.get("view");
	const view =
		rawView === "school" || rawView === "student" || rawView === "generate"
			? rawView
			: "teacher";

	const setView = useCallback(
		(next: "teacher" | "student" | "school" | "generate") => {
			const url = next === "teacher" ? "/ai-scheduler" : `/ai-scheduler?view=${next}`;
			router.replace(url, { scroll: false });
		},
		[router],
	);

	const navBtn =
		"flex w-full items-center rounded-xl text-left text-sm font-medium transition-colors";
	const navInactive =
		"text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";
	const navActive = "bg-blue-50 text-blue-900 ring-1 ring-blue-200/80";

	return (
		<div className="flex min-h-screen bg-[#f4f5f7]">
			<aside
				className={cn(
					"flex shrink-0 flex-col border-r border-zinc-200/90 bg-white shadow-sm shadow-zinc-200/30 transition-[width] duration-200",
					sidebarOpen ? "w-[min(100%,240px)]" : "w-[72px]",
				)}
				aria-label="Хуваарь сонгох"
			>
				<div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-4 py-3">
					<div className={cn(!sidebarOpen && "hidden")}>
						<p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
							AI хуваарь
						</p>
						<p className="truncate text-sm font-semibold text-zinc-900">
							Харагдац
						</p>
					</div>
					<button
						type="button"
						onClick={() => setSidebarOpen((prev) => !prev)}
						className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100"
						aria-label={sidebarOpen ? "Sidebar хураах" : "Sidebar дэлгэх"}
						aria-expanded={sidebarOpen}
					>
						{sidebarOpen ? (
							<ChevronLeft className="size-4" strokeWidth={1.75} />
						) : (
							<ChevronRight className="size-4" strokeWidth={1.75} />
						)}
					</button>
				</div>
				<nav className="flex flex-col gap-1 p-3">
					<button
						type="button"
						onClick={() => setView("school")}
						className={cn(
							navBtn,
							sidebarOpen ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-3",
							view === "school" ? navActive : navInactive,
						)}
						aria-current={view === "school" ? "page" : undefined}
						title="Сургуулийн хуанли"
					>
						<CalendarDays className="size-5 shrink-0 text-blue-600" strokeWidth={1.75} />
						{sidebarOpen ? <span className="min-w-0">Сургуулийн хуанли</span> : null}
					</button>
					<button
						type="button"
						onClick={() => setView("teacher")}
						className={cn(
							navBtn,
							sidebarOpen ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-3",
							view === "teacher" ? navActive : navInactive,
						)}
						aria-current={view === "teacher" ? "page" : undefined}
						title="Багшийн хувийн хуваарь"
					>
						<CalendarClock className="size-5 shrink-0 text-emerald-600" strokeWidth={1.75} />
						{sidebarOpen ? <span className="min-w-0">Багшийн хувийн хуваарь</span> : null}
					</button>
					<button
						type="button"
						onClick={() => setView("student")}
						className={cn(
							navBtn,
							sidebarOpen ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-3",
							view === "student" ? navActive : navInactive,
						)}
						aria-current={view === "student" ? "page" : undefined}
						title="Сурагчийн хувийн хуваарь"
					>
						<GraduationCap className="size-5 shrink-0 text-violet-600" strokeWidth={1.75} />
						{sidebarOpen ? <span className="min-w-0">Сурагчийн хувийн хуваарь</span> : null}
					</button>
					<button
						type="button"
						onClick={() => setView("generate")}
						className={cn(
							navBtn,
							sidebarOpen ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-3",
							view === "generate" ? navActive : navInactive,
						)}
						aria-current={view === "generate" ? "page" : undefined}
						title="Шалгалт үүсгэх"
					>
						<FileQuestion className="size-5 shrink-0 text-amber-600" strokeWidth={1.75} />
						{sidebarOpen ? <span className="min-w-0">Шалгалт үүсгэх</span> : null}
					</button>
				</nav>
			</aside>
			<div className="min-h-screen min-w-0 flex-1">
				{view === "school" ? (
					<SchoolEventScheduler shellMode />
				) : view === "generate" ? (
					<GenerateExamPage />
				) : view === "student" ? (
					<AiStudentPersonalScheduler shellMode />
				) : (
					<AiTeacherPersonalScheduler shellMode />
				)}
			</div>
		</div>
	);
}
