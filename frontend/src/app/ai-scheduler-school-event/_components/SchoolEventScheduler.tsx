"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { mn } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
	Building2,
	CalendarClock,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	GraduationCap,
	Menu,
	PartyPopper,
	Square,
	Circle,
	Triangle,
	FileQuestion,
} from "lucide-react";

const SCHEDULE_DAY_START = 8;
const SCHEDULE_DAY_END = 20;
const HOUR_COUNT = SCHEDULE_DAY_END - SCHEDULE_DAY_START;
const HOUR_PX = 40;
const GRID_BODY_MIN_H = HOUR_COUNT * HOUR_PX;

const panelLight =
	"rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-200/40";
const textDim = "text-zinc-500";

function ReclaimLightBackdrop() {
	return (
		<div
			className="pointer-events-none fixed inset-0 -z-10 bg-[#f4f5f7]"
			aria-hidden
		>
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_65%_at_50%_-15%,rgba(59,130,246,0.12),transparent_50%)]" />
		</div>
	);
}

type SchoolLayerId = "exams" | "events";

const SCHOOL_LAYERS: {
	id: SchoolLayerId;
	label: string;
	role: string;
	swatch: string;
}[] = [
	{
		id: "exams",
		label: "Багшийн шалгалт",
		role: "Нийтлэг харагдах",
		swatch: "bg-violet-500",
	},
	{
		id: "events",
		label: "Сургуулийн эвент",
		role: "Бүх анги",
		swatch: "bg-rose-500",
	},
];

export type SchoolEventSchedulerProps = {
	/** Үнэн бол гаднах hub rail нуугдана (зөвхөн /ai-scheduler дээр). */
	shellMode?: boolean;
};

export function SchoolEventScheduler({
	shellMode = false,
}: SchoolEventSchedulerProps) {
	const [date, setDate] = useState<Date | undefined>(new Date());
	const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(true);
	const [layerOn, setLayerOn] = useState<Record<SchoolLayerId, boolean>>({
		exams: true,
		events: true,
	});
	const [rightTab, setRightTab] = useState<"list" | "about">("list");
	const [nowTick, setNowTick] = useState(() => new Date());

	useEffect(() => {
		const id = window.setInterval(() => setNowTick(new Date()), 60_000);
		return () => window.clearInterval(id);
	}, []);

	function toggleLayer(id: SchoolLayerId) {
		setLayerOn((p) => ({ ...p, [id]: !p[id] }));
	}

	const anchor = date ?? new Date();
	const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
	const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
	const weekEnd = addDays(weekStart, 6);
	const weekRangeLabel = `${format(weekStart, "MMM d", { locale: mn })} – ${format(weekEnd, "MMM d, yyyy", { locale: mn })}`;

	const hourRows = Array.from(
		{ length: HOUR_COUNT },
		(_, i) => SCHEDULE_DAY_START + i,
	);

	const nowHourFrac =
		nowTick.getHours() + nowTick.getMinutes() / 60 + nowTick.getSeconds() / 3600;
	const nowInScheduleWindow =
		nowHourFrac >= SCHEDULE_DAY_START && nowHourFrac <= SCHEDULE_DAY_END;
	const todayInVisibleWeek = weekDays.some((d) => isSameDay(d, nowTick));
	const showNowLine = todayInVisibleWeek && nowInScheduleWindow;
	const nowLineTopPx =
		((nowHourFrac - SCHEDULE_DAY_START) / HOUR_COUNT) * GRID_BODY_MIN_H;

	function shiftWeek(deltaWeeks: number) {
		setDate((d) => addDays(d ?? new Date(), deltaWeeks * 7));
	}

	const selectedLabel = date
		? format(date, "EEEE, MMMM d", { locale: mn })
		: "—";

	return (
		<div
			className={cn(
				"relative min-h-screen overflow-x-hidden bg-[#f4f5f7] font-sans text-zinc-900 antialiased",
				"selection:bg-blue-500/20 selection:text-zinc-900",
			)}
		>
			<ReclaimLightBackdrop />

			<div className="relative z-10 flex min-h-screen flex-col">
				<header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/80 px-4 py-3 backdrop-blur-sm sm:px-5">
					<div className="flex min-w-0 items-center gap-3">
						{shellMode ? (
							<>
								<button
									type="button"
									className="hidden size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 xl:flex"
									aria-expanded={calendarSidebarOpen}
									aria-controls="school-scheduler-sidebar"
									onClick={() => setCalendarSidebarOpen((o) => !o)}
								>
									<span className="sr-only">Хуанлын панел нээх, хаах</span>
									{calendarSidebarOpen ? (
										<ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
									) : (
										<ChevronRight className="size-5" strokeWidth={1.5} aria-hidden />
									)}
								</button>
								<button
									type="button"
									className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 xl:hidden"
									aria-expanded={calendarSidebarOpen}
									aria-controls="school-scheduler-sidebar"
									onClick={() => setCalendarSidebarOpen((o) => !o)}
								>
									<span className="sr-only">Хуанлын панел нээх, хаах</span>
									<Menu className="size-5" strokeWidth={1.5} aria-hidden />
								</button>
							</>
						) : (
							<button
								type="button"
								className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 xl:hidden"
								aria-expanded={calendarSidebarOpen}
								aria-controls="school-scheduler-sidebar"
								onClick={() => setCalendarSidebarOpen((o) => !o)}
							>
								<span className="sr-only">Хуанлын панел нээх, хаах</span>
								<Menu className="size-5" strokeWidth={1.5} aria-hidden />
							</button>
						)}
						<div className="min-w-0">
							<div className="mb-0.5 flex flex-wrap items-center gap-2">
								<Badge className="rounded-md border-0 bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
									<Building2 className="mr-1 inline size-3" />
									Сургууль
								</Badge>
							</div>
							<div className="flex min-w-0 items-center gap-2">
								<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
									<CalendarDays className="size-4" strokeWidth={2} aria-hidden />
								</span>
								<h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900 sm:text-base">
									Сургуулийн хуанли
								</h1>
							</div>
							<p className={cn("truncate text-xs", textDim)}>
								Нийтлэг үйл явдал · {format(anchor, "yyyy MMMM", { locale: mn })}
							</p>
						</div>
					</div>
					<Link
						href={shellMode ? "/ai-scheduler" : "/ai-scheduler-personal"}
						className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
					>
						Багшийн хувийн хуваарь
					</Link>
				</header>

				<div className="flex min-h-0 flex-1 flex-row overflow-hidden">
					{!shellMode ? (
						<nav
							className="flex w-[68px] shrink-0 flex-col border-r border-zinc-600/25 bg-[#3a3a42] text-zinc-200"
							aria-label="Үндсэн навигаци"
						>
							<div className="flex h-[52px] items-center justify-center border-b border-zinc-500/20">
								<div className="flex items-center gap-0.5" aria-hidden>
									<Square className="size-2 fill-rose-400 text-rose-400" />
									<Circle className="size-2 fill-sky-400 text-sky-400" />
									<Triangle className="size-2 fill-amber-400 text-amber-400" />
								</div>
							</div>
							<div className="flex flex-1 flex-col gap-1 px-2 py-3">
								<div
									className="flex size-11 cursor-pointer items-center justify-center rounded-xl bg-white/14 text-white shadow-sm ring-1 ring-white/12"
									title="Сургуулийн хуанли (нийтлэг)"
									aria-current="page"
									aria-label="Сургуулийн хуанли"
								>
									<CalendarDays className="size-5" strokeWidth={1.75} aria-hidden />
								</div>
								<Link
									href="/ai-scheduler-personal"
									title="Багшийн хувийн хуваарь (цагийн тор)"
									aria-label="Багшийн хувийн хуваарь руу очих"
									className="flex size-11 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/10 hover:text-emerald-200"
								>
									<CalendarClock
										className="size-5"
										strokeWidth={1.75}
										aria-hidden
									/>
								</Link>
								<Link
									href="/ai-exam"
									title="Шалгалт үүсгэх (асуулт, сорил)"
									aria-label="Шалгалт үүсгэх хуудас"
									className="flex size-11 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/10 hover:text-amber-200"
								>
									<FileQuestion className="size-5" strokeWidth={1.75} aria-hidden />
								</Link>
							</div>
							<div className="border-t border-zinc-500/20 p-2">
								<button
									type="button"
									onClick={() => setCalendarSidebarOpen((o) => !o)}
									aria-expanded={calendarSidebarOpen}
									title={
										calendarSidebarOpen
											? "Хуанлын панел хураах"
											: "Хуанлын панел дэлгэх"
									}
									className="flex size-11 w-full items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
								>
									{calendarSidebarOpen ? (
										<ChevronLeft className="size-5" strokeWidth={1.5} />
									) : (
										<ChevronRight className="size-5" strokeWidth={1.5} />
									)}
								</button>
							</div>
						</nav>
					) : null}

					<aside
						id="school-scheduler-sidebar"
						className={cn(
							"shrink-0 overflow-hidden border-zinc-200/90 bg-white/50 transition-[width] duration-200 ease-out xl:bg-white/40",
							calendarSidebarOpen
								? shellMode
									? "w-full max-w-[min(100vw,280px)] border-r sm:max-w-[272px]"
									: "w-full max-w-[min(100vw-68px,280px)] border-r sm:max-w-[272px]"
								: "w-0 border-r-0",
						)}
					>
						<div
							className={cn(
								"flex h-full w-full max-w-[272px] flex-col gap-4 overflow-y-auto p-4",
								shellMode
									? "min-w-[min(100vw,272px)]"
									: "min-w-[min(100vw-68px,272px)]",
							)}
						>
							<div className={cn(panelLight, "p-3")}>
								<div className="mb-2 space-y-0.5 px-1">
									<p className="text-xs font-semibold text-zinc-900">
										Сургуулийн хуанли
									</p>
									<p className="text-[10px] font-medium text-zinc-500">
										Сонгох өдөр
									</p>
								</div>
								<p className="mb-2 px-1 text-[10px] text-zinc-500">{selectedLabel}</p>
								<div
									className={cn(
										"flex justify-center rounded-xl border border-zinc-100 bg-zinc-50/90 p-1",
										"[&_button[data-selected-single=true]]:rounded-full! [&_button[data-selected-single=true]]:bg-blue-600! [&_button[data-selected-single=true]]:text-white!",
										"[&_button[data-selected-single=true]]:shadow-md [&_button[data-selected-single=true]]:shadow-blue-500/25",
									)}
								>
									<Calendar
										mode="single"
										selected={date}
										onSelect={setDate}
										locale={mn}
										buttonVariant="ghost"
										className="text-zinc-800 [--cell-size:2rem] scale-[0.92] origin-top"
										classNames={{
											caption_label:
												"text-[13px] font-semibold text-zinc-900",
											button_previous:
												"rounded-lg border border-zinc-200 bg-white text-zinc-700 size-8 hover:bg-zinc-50",
											button_next:
												"rounded-lg border border-zinc-200 bg-white text-zinc-700 size-8 hover:bg-zinc-50",
											weekday:
												"text-[10px] font-medium uppercase text-zinc-500",
											day: "text-zinc-700",
											today:
												"text-blue-700 [&:not([data-selected])_button]:ring-2 [&:not([data-selected])_button]:ring-blue-400/50 [&:not([data-selected])_button]:rounded-full",
											outside: "text-zinc-400 opacity-60",
											disabled: "opacity-30",
										}}
									/>
								</div>
							</div>

							<Link
								href={shellMode ? "/ai-scheduler" : "/ai-scheduler-personal"}
								className={cn(
									panelLight,
									"flex items-center gap-3 p-3 no-underline transition-colors",
									"border-emerald-200/80 bg-linear-to-r from-emerald-50/90 to-white",
									"hover:border-emerald-300 hover:from-emerald-50 hover:shadow-md hover:shadow-emerald-500/10",
								)}
							>
								<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/25">
									<CalendarClock className="size-5" strokeWidth={2} aria-hidden />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-zinc-900">
										Багшийн хуваарь
									</p>
									<p className="text-[10px] leading-snug text-zinc-500">
										Хувийн цагийн тор, AI хуваарь
									</p>
								</div>
								<ChevronRight
									className="size-4 shrink-0 text-emerald-700"
									aria-hidden
								/>
							</Link>

							<div className={cn(panelLight, "divide-y divide-zinc-100")}>
								<p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
									Харагдац
								</p>
								{SCHOOL_LAYERS.map((layer) => {
									const on = layerOn[layer.id];
									return (
										<button
											key={layer.id}
											type="button"
											aria-pressed={on}
											onClick={() => toggleLayer(layer.id)}
											className={cn(
												"flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
												on
													? "bg-blue-50/80 text-zinc-900"
													: "text-zinc-500 hover:bg-zinc-50",
											)}
										>
											<span
												className={cn(
													"size-2.5 shrink-0 rounded-sm",
													layer.swatch,
													!on && "opacity-35",
												)}
											/>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm font-medium">
													{layer.label}
												</span>
												<span className="block truncate text-[10px] text-zinc-500">
													{layer.role}
												</span>
											</span>
											<span
												className={cn(
													"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
													on
														? "bg-blue-100 text-blue-800"
														: "bg-zinc-100 text-zinc-500",
												)}
											>
												{on ? "Идэвхтэй" : "Нуугдсан"}
											</span>
										</button>
									);
								})}
							</div>
						</div>
					</aside>

					<div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
						<main className="min-h-[480px] min-w-0 flex-1 overflow-auto border-zinc-200/90 p-3 sm:p-4 xl:rounded-l-3xl xl:border-r xl:bg-zinc-50/30">
							<div
								className={cn(
									panelLight,
									"flex min-h-[440px] flex-col overflow-hidden p-3 xl:rounded-l-3xl xl:shadow-md",
								)}
							>
								<div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
									<div className="min-w-0">
										<p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
											Энэ 7 хоног
										</p>
										<p className="truncate text-sm font-semibold tracking-tight text-zinc-900">
											{weekRangeLabel}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-zinc-200 bg-zinc-50/90 p-0.5">
										<button
											type="button"
											onClick={() => shiftWeek(-1)}
											className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
											aria-label="Өмнөх долоо хоног"
										>
											<ChevronLeft className="size-4" strokeWidth={2} />
										</button>
										<button
											type="button"
											onClick={() => setDate(new Date())}
											className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
										>
											Өнөөдөр
										</button>
										<button
											type="button"
											onClick={() => shiftWeek(1)}
											className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
											aria-label="Дараагийн долоо хоног"
										>
											<ChevronRight className="size-4" strokeWidth={2} />
										</button>
									</div>
								</div>

								<div className="mb-2 grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 border-b border-zinc-200 pb-2 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
									<div
										className="text-[10px] font-medium uppercase tracking-wide text-zinc-400"
										aria-hidden
									>
										Цаг
									</div>
									{weekDays.map((d) => {
										const isSel = isSameDay(d, anchor);
										return (
											<div key={d.toISOString()} className="text-center">
												<div
													className={cn(
														"mx-auto flex size-8 items-center justify-center rounded-full text-[11px] font-medium sm:size-9 sm:text-xs",
														isSel
															? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
															: "border border-zinc-200 bg-zinc-100 text-zinc-500",
													)}
												>
													{format(d, "EEEEE", { locale: mn })}
												</div>
												<p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500 sm:mt-1 sm:text-[10px]">
													{format(d, "EEE", { locale: mn })}
												</p>
												<p className="text-xs font-semibold text-zinc-800 sm:text-sm">
													{format(d, "d")}
												</p>
											</div>
										);
									})}
								</div>

								<div className="relative min-h-0 flex-1">
									<div className="grid min-h-0 flex-1 grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
										<div
											className="relative shrink-0 text-right"
											style={{ minHeight: GRID_BODY_MIN_H }}
										>
											{hourRows.map((hour) => (
												<div
													key={hour}
													className="flex items-start justify-end border-t border-zinc-100 pr-1 pt-0.5 text-[10px] tabular-nums text-zinc-400 first:border-t-0 first:pt-0 sm:pr-1.5 sm:text-[11px]"
													style={{ height: HOUR_PX }}
												>
													{String(hour).padStart(2, "0")}:00
												</div>
											))}
										</div>

										{weekDays.map((d, colIdx) => (
											<div
												key={`col-${colIdx}`}
												className="relative rounded-xl border border-zinc-200/90 bg-zinc-50/80"
												style={{ minHeight: GRID_BODY_MIN_H }}
											>
												<div
													className="pointer-events-none absolute inset-0 rounded-[inherit]"
													style={{
														backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${HOUR_PX - 1}px, rgb(228 228 231 / 0.9) ${HOUR_PX - 1}px, rgb(228 228 231 / 0.9) ${HOUR_PX}px)`,
													}}
													aria-hidden
												/>
												{layerOn.events && colIdx === 4 ? (
													<div
														className="absolute left-0.5 right-0.5 top-[8%] z-1 rounded-xl border-2 border-dashed border-rose-300 bg-rose-50 px-2 py-2 text-[10px] font-semibold leading-tight text-rose-900 shadow-sm"
														style={{ height: "38%" }}
													>
														Сургуулийн арга хэмжээ
														<span className="mt-1 block font-normal text-rose-700">
															Жишээ · бүх анги
														</span>
													</div>
												) : null}
												{layerOn.exams && colIdx === 2 ? (
													<div
														className="absolute left-1 right-1 top-[20%] z-1 rounded-xl border border-violet-200 bg-violet-50 px-2 py-1.5 text-[10px] font-medium text-violet-900 shadow-sm"
														style={{ minHeight: "52px" }}
													>
														Баталсан шалгалт
														<span className="mt-0.5 block font-normal text-violet-700">
															Жишээ · 10А
														</span>
													</div>
												) : null}
												{layerOn.exams && colIdx === 0 ? (
													<div
														className="absolute left-1 right-1 top-[42%] rounded-xl border border-violet-200/80 bg-violet-50/90 px-2 py-1.5 text-[10px] text-violet-800"
														style={{ height: "40px" }}
													>
														Шалгалт (жишээ)
													</div>
												) : null}
											</div>
										))}
									</div>

									{showNowLine ? (
										<div
											className="pointer-events-none absolute right-0 left-12 z-20 flex -translate-y-1/2 items-center sm:left-14"
											style={{ top: nowLineTopPx }}
											aria-hidden
										>
											<span className="mr-0.5 size-2 shrink-0 rounded-full bg-red-500 shadow-sm ring-2 ring-white" />
											<div className="h-0.5 min-w-0 flex-1 rounded-full bg-red-500 opacity-90 shadow-sm" />
										</div>
									) : null}
								</div>

								<p className={cn("mt-2 text-center text-[10px] leading-relaxed", textDim)}>
									Нийтлэг хуанли — жишээ блокууд. Дараа нь GraphQL-ээр бодит шалгалт,
									эвентүүдийг энд татна.
								</p>
							</div>
						</main>

						<aside className="flex w-full shrink-0 flex-col border-zinc-200/90 bg-white shadow-[inset_1px_0_0_0_rgba(228,228,231,0.6)] xl:w-[320px] xl:border-l">
							<div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3">
								<div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
									<Building2 className="size-4" strokeWidth={2} />
								</div>
								<span className="text-sm font-semibold tracking-tight text-zinc-900">
									Сургуулийн мэдээлэл
								</span>
							</div>

							<div className="flex gap-1 border-b border-zinc-200 bg-white px-3 py-2">
								<button
									type="button"
									onClick={() => setRightTab("list")}
									className={cn(
										"rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
										rightTab === "list"
											? "bg-blue-600 text-white shadow-sm"
											: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
									)}
								>
									Жагсаалт
								</button>
								<button
									type="button"
									onClick={() => setRightTab("about")}
									className={cn(
										"rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
										rightTab === "about"
											? "bg-blue-600 text-white shadow-sm"
											: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
									)}
								>
									Тайлбар
								</button>
							</div>

							<div className="flex-1 overflow-y-auto bg-zinc-50/40 p-4">
								{rightTab === "list" ? (
									<div className="space-y-4">
										<div className={cn(panelLight, "overflow-hidden p-0")}>
											<div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
												<GraduationCap className="size-4 text-violet-600" />
												<span className="text-xs font-semibold text-zinc-900">
													Багшдын товлосон шалгалт
												</span>
											</div>
											<div className="px-3 py-6 text-center">
												<p className="text-xs font-medium text-zinc-700">
													Одоогоор жагсаалт хоосон
												</p>
												<p className={cn("mx-auto mt-2 max-w-[220px] text-[11px]", textDim)}>
													GraphQL query (өдрөөр шүүсэн exam_schedules) энд холбогдоно.
												</p>
											</div>
										</div>
										<div className={cn(panelLight, "overflow-hidden p-0")}>
											<div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
												<PartyPopper className="size-4 text-amber-600" />
												<span className="text-xs font-semibold text-zinc-900">
													Том үйл явдал
												</span>
											</div>
											<div className="px-3 py-6 text-center">
												<p className="text-xs font-medium text-zinc-700">
													Одоогоор жагсаалт хоосон
												</p>
												<p className={cn("mx-auto mt-2 max-w-[220px] text-[11px]", textDim)}>
													School events өгөгдөл ирэхэд энд гарна.
												</p>
											</div>
										</div>
									</div>
								) : (
									<div className={cn(panelLight, "p-4 text-xs leading-relaxed text-zinc-600")}>
										<p>
											Энд багш нарын{" "}
											<strong className="font-semibold text-zinc-800">
												товлосон шалгалтууд
											</strong>{" "}
											болон сургуулийн{" "}
											<strong className="font-semibold text-zinc-800">
												том арга хэмжээ
											</strong>{" "}
											нийлж харагдана. Өөрийн шалгалтыг AI-аар оноох —{" "}
											<Link
												href="/ai-scheduler-personal"
												className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
											>
												Багшийн хувийн хуваарь
											</Link>
											.
										</p>
									</div>
								)}
							</div>

							<div className="border-t border-zinc-200 bg-white p-3">
								<button
									type="button"
									onClick={() =>
										setRightTab((t) => (t === "list" ? "about" : "list"))
									}
									className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
								>
									<ChevronRight
										className={cn(
											"size-4 transition-transform",
											rightTab === "about" && "-rotate-90",
										)}
									/>
									{rightTab === "list" ? "Тайлбар руу" : "Жагсаалт руу"}
								</button>
							</div>
						</aside>
					</div>
				</div>
			</div>
		</div>
	);
}
