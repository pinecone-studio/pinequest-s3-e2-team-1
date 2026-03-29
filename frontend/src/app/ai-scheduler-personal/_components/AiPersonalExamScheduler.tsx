"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  addDays,
  format,
  getISODay,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { mn } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ApproveAiExamScheduleDocument,
  GetAiExamScheduleDocument,
  RequestAiExamScheduleDocument,
} from "@/gql/create-exam-documents";
import type {
  ExamSchedule,
  ExamScheduleVariant,
  RequestExamSchedulePayload,
} from "@/gql/graphql";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Menu,
  Monitor,
  Moon,
  PanelRight,
  Play,
  Sun,
  Target,
  Square,
  Circle,
  Triangle,
} from "lucide-react";

/** Тор дээрх цагийн хүрээ (08:00–20:00). */
const SCHEDULE_DAY_START = 8;
const SCHEDULE_DAY_END = 20;
const HOUR_COUNT = SCHEDULE_DAY_END - SCHEDULE_DAY_START;
const HOUR_PX = 40;
const GRID_BODY_MIN_H = HOUR_COUNT * HOUR_PX;

/** Нэг хичээлийн үргэлжлэх хугацаа + завсарлага (сургуулийн жишээ). */
const LESSON_MINUTES = 50;
const BREAK_MINUTES = 10;

/** Жишээ: нийтийн эвентийн эхлэл / дуусах (торын байрлалтай нийцнэ). */
const SCHOOL_EVENT_DEMO = {
  startH: 10,
  startM: 0,
  endH: 14,
  endM: 30,
} as const;

/** Цаг:мин-оос эхлэх цэгийг торын top% болгох (SCHEDULE_DAY_START–END хооронд). */
function slotTopPercent(hour: number, minute = 0) {
  const t = hour + minute / 60;
  const p = ((t - SCHEDULE_DAY_START) / HOUR_COUNT) * 100;
  return Math.min(Math.max(p, 0), 100);
}

/** 50 минутын хичээлийн цагийн мөр, жишээ 08:00–08:50. */
function formatLessonWindow(startHour: number, startMinute: number) {
  const startTotal = startHour * 60 + startMinute;
  const endTotal = startTotal + LESSON_MINUTES;
  const eh = Math.floor(endTotal / 60);
  const em = endTotal % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(startHour)}:${pad(startMinute)}–${pad(eh)}:${pad(em)}`;
}

/** Эхлэл–дуусах + нийт минут (нийтийн эвент гэх мэт урт хугацаа). */
function formatBlockDuration(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const s = startHour * 60 + startMinute;
  const e = endHour * 60 + endMinute;
  const mins = Math.max(0, e - s);
  return `${pad(startHour)}:${pad(startMinute)}–${pad(endHour)}:${pad(endMinute)} · ${mins} мин`;
}

/** Тор дээрх блокын өндөр % (08:00–20:00 хооронд). */
function blockHeightPercent(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
) {
  const start = startHour + startMinute / 60;
  const end = endHour + endMinute / 60;
  const span = Math.max(0, end - start);
  return Math.min(100, (span / HOUR_COUNT) * 100);
}

/** getISODay: 1=Даваа … 7=Ням — нэг үсэг (Дав/Мяг гэх мэт биш). */
const WEEKDAY_LETTER_MN: Record<number, string> = {
  1: "Д",
  2: "М",
  3: "Л",
  4: "П",
  5: "Б",
  6: "Б",
  7: "Н",
};

const DEFAULT_TEST_ID = "a1000000-0000-4000-8000-000000000001";
const DEFAULT_CLASS_ID = "10A";

const panelLight =
  "rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-200/40 dark:border-zinc-600/80 dark:bg-zinc-900/95 dark:shadow-black/40";
const textDim = "text-zinc-500 dark:text-zinc-400";

function SchedulerAppearanceMenu() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label="Дүрсийн горим: цайвар, харанхуй, систем"
        >
          {!mounted ? (
            <Sun className="size-4 opacity-70" aria-hidden />
          ) : resolvedTheme === "dark" ? (
            <Moon className="size-4" aria-hidden />
          ) : (
            <Sun className="size-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {""}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          <DropdownMenuRadioItem value="light" className="text-sm">
            <Sun className="size-4" aria-hidden />
            Цайвар
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="text-sm">
            <Moon className="size-4" aria-hidden />
            Харанхуй
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="text-sm">
            <Monitor className="size-4" aria-hidden />
            Систем
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type RequestAiExamScheduleData = {
  requestAiExamSchedule: RequestExamSchedulePayload;
};

type RequestAiExamScheduleVars = {
  testId: string;
  classId: string;
  preferredDate: string;
};

type GetAiExamScheduleData = {
  getAiExamSchedule?: ExamSchedule | null;
};

type GetAiExamScheduleVars = {
  examId: string;
};

type ApproveAiExamScheduleData = {
  approveAiExamSchedule: ExamSchedule;
};

type ApproveAiExamScheduleVars = {
  examId: string;
  variantId: string;
};

function formatVariantWhen(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, "yyyy-MM-dd HH:mm", { locale: mn });
  } catch {
    return iso;
  }
}

function parseStart(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    const d = parseISO(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Багшийн хуанли = зөвхөн цаг харах биш, AI-Powered Operations Center.
 * Cron / Linear / Reclaim-ийн урсгал + ирээдүйн шийдлүүдийг нэг дэлгэцэнд.
 */
type CalendarLayerId =
  | "primary"
  | "confirmed_exam"
  | "ai_draft"
  | "school_event"
  | "personal"
  | "conflict";

const CALENDAR_LAYERS: {
  id: CalendarLayerId;
  label: string;
  role: string;
  swatch: string;
  style?: string;
}[] = [
  {
    id: "primary",
    label: "Үндсэн хичээл",
    role: `Хичээлийн хуваарь (10А, 10Б гэх мэт) · ${LESSON_MINUTES} мин хичээл, ${BREAK_MINUTES} мин завсар`,
    swatch: "bg-sky-400",
  },
  {
    id: "confirmed_exam",
    label: "Баталгаажсан шалгалт",
    role: "Цаг товлогдсон, сурагчдад зарлагдсан шалгалтууд",
    swatch: "bg-emerald-500",
  },
  {
    id: "ai_draft",
    label: "AI-ийн санал (Draft)",
    role: "Gemini-ийн санал болгож буй хамгийн оновчтой цагууд",
    swatch: "bg-violet-200",
    style: "border border-dashed border-violet-400 opacity-90",
  },
  {
    id: "school_event",
    label: "Сургуулийн эвент",
    role: "Нийтийн хурал, баяр ёслол, заалны засвар",
    swatch: "bg-amber-100 ring-1 ring-amber-400/30",
  },
  {
    id: "personal",
    label: "Хувийн (Sync)",
    role: "Google Calendar-аас синк хийсэн завгүй цаг",
    swatch: "bg-slate-300",
  },
  {
    id: "conflict",
    label: "Зөрчилтэй",
    role: "Давхцал үүссэн эсвэл ачаалал ихтэй үе",
    swatch: "bg-rose-500",
    style: "animate-pulse",
  },
];

function ReclaimLightBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 bg-[#f4f5f7] dark:bg-zinc-950"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_65%_at_50%_-15%,rgba(59,130,246,0.12),transparent_50%)] dark:bg-[radial-gradient(ellipse_100%_65%_at_50%_-15%,rgba(59,130,246,0.22),transparent_55%)]" />
    </div>
  );
}

export type AiPersonalExamSchedulerProps = {
  /** Үнэн бол гаднах hub rail нуугдана (зөвхөн /ai-scheduler дээр). */
  shellMode?: boolean;
};

export function AiPersonalExamScheduler({
  shellMode = false,
}: AiPersonalExamSchedulerProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [testId, setTestId] = useState(DEFAULT_TEST_ID);
  const [classId, setClassId] = useState(DEFAULT_CLASS_ID);
  const [lastQueuedExamId, setLastQueuedExamId] = useState<string | null>(null);
  const [pollExamId, setPollExamId] = useState<string | null>(null);
  const [liveSchedule, setLiveSchedule] = useState<ExamSchedule | null>(null);
  const [rightTab, setRightTab] = useState<"ai" | "form">("ai");
  const [layerOn, setLayerOn] = useState<Record<CalendarLayerId, boolean>>({
    primary: true,
    confirmed_exam: true,
    ai_draft: true,
    school_event: true,
    personal: true,
    conflict: true,
  });
  /** Хуанли + давхаргын зүүн панел нээгдсэн эсэх (rail-аас сэлгэнэ). */
  const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(true);
  const toastKeyRef = useRef<string>("");

  function toggleLayer(id: CalendarLayerId) {
    setLayerOn((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const [requestSchedule, { loading: queueLoading }] = useMutation<
    RequestAiExamScheduleData,
    RequestAiExamScheduleVars
  >(RequestAiExamScheduleDocument);

  const [approveSchedule, { loading: approveLoading }] = useMutation<
    ApproveAiExamScheduleData,
    ApproveAiExamScheduleVars
  >(ApproveAiExamScheduleDocument);

  const { data: pollData } = useQuery<
    GetAiExamScheduleData,
    GetAiExamScheduleVars
  >(GetAiExamScheduleDocument, {
    variables: { examId: pollExamId ?? "" },
    skip: !pollExamId,
    pollInterval: pollExamId ? 2500 : 0,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  useEffect(() => {
    const row = pollData?.getAiExamSchedule;
    if (row) {
      setLiveSchedule(row);
    }
  }, [pollData]);

  useEffect(() => {
    const row = pollData?.getAiExamSchedule;
    if (!row || !pollExamId) return;
    const st = row.status;
    if (st === "suggested") {
      setPollExamId(null);
      const key = `${row.id}:suggested`;
      if (toastKeyRef.current === key) return;
      toastKeyRef.current = key;
      toast.message("Саналууд бэлэн", {
        description: "Баруун панелаас хувилбар сонгоно уу.",
      });
      return;
    }
    if (st !== "confirmed" && st !== "failed") return;
    const key = `${row.id}:${st}`;
    if (toastKeyRef.current === key) return;
    toastKeyRef.current = key;
    if (st === "confirmed") {
      toast.success("Хуваарь баталгаажлаа.");
    } else {
      toast.error(row.aiReasoning ?? "AI scheduler алдаатай дууслаа.");
    }
    setPollExamId(null);
  }, [pollData?.getAiExamSchedule, pollExamId]);

  async function handleApproveVariant(v: ExamScheduleVariant) {
    const examId = liveSchedule?.id ?? lastQueuedExamId;
    if (!examId) {
      toast.error("examId олдсонгүй.");
      return;
    }
    try {
      const { data } = await approveSchedule({
        variables: { examId, variantId: v.id },
      });
      const next = data?.approveAiExamSchedule;
      if (next) {
        setLiveSchedule(next);
        toastKeyRef.current = `${next.id}:confirmed`;
        toast.success("Сонгосон хувилбар баталгаажлаа.");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Батлахад алдаа гарлаа.";
      toast.error(msg);
    }
  }

  async function handleQueueSchedule() {
    const tid = testId.trim();
    const cid = classId.trim();
    if (!tid || !cid) {
      toast.error("Шалгалтын загварын ID болон ангийн ID заавал бөглөнө.");
      return;
    }
    const day = date ?? new Date();
    const preferredDate = startOfDay(day).toISOString();

    try {
      const { data } = await requestSchedule({
        variables: {
          testId: tid,
          classId: cid,
          preferredDate,
        },
      });
      const payload = data?.requestAiExamSchedule;
      if (payload?.success) {
        toastKeyRef.current = "";
        if (payload.examId) {
          setLiveSchedule(null);
          setLastQueuedExamId(payload.examId);
          setPollExamId(payload.examId);
        }
        toast.success(payload.message, {
          description: payload.examId ? `examId: ${payload.examId}` : undefined,
        });
      } else {
        toast.error(payload?.message ?? "Дараалалд оруулахад алдаа гарлаа.");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Сүлжээ эсвэл серверийн алдаа.";
      toast.error(msg);
    }
  }

  const anchor = date ?? new Date();
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const scheduleStart = liveSchedule
    ? parseStart(liveSchedule.startTime)
    : null;
  const suggested = liveSchedule?.status === "suggested";
  const showJob =
    liveSchedule && liveSchedule.id === lastQueuedExamId ? liveSchedule : null;

  /** 08:00–20:00 хүрээнд блокын байрлал (%) */
  function blockTopPercent(d: Date) {
    const h = d.getHours() + d.getMinutes() / 60;
    const t = Math.min(Math.max((h - SCHEDULE_DAY_START) / HOUR_COUNT, 0), 1);
    return t * 100;
  }

  const hourRows = Array.from(
    { length: HOUR_COUNT },
    (_, i) => SCHEDULE_DAY_START + i,
  );

  const weekEnd = addDays(weekStart, 6);
  const weekRangeLabel = `${format(weekStart, "MMM d", { locale: mn })} – ${format(weekEnd, "MMM d", { locale: mn })}`;

  function shiftWeek(deltaWeeks: number) {
    setDate((d) => addDays(d ?? new Date(), deltaWeeks * 7));
  }

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden bg-[#f4f5f7] font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100",
        "selection:bg-blue-500/20 selection:text-zinc-900 dark:selection:bg-blue-400/25 dark:selection:text-zinc-100",
      )}
    >
      <ReclaimLightBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Дээд мөр */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-zinc-700/90 dark:bg-zinc-950/90 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {shellMode ? (
              <>
                <button
                  type="button"
                  className="hidden size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:flex"
                  aria-expanded={calendarSidebarOpen}
                  aria-controls="scheduler-calendar-sidebar"
                  onClick={() => setCalendarSidebarOpen((o) => !o)}
                >
                  <span className="sr-only">Хуанлын панел нээх, хаах</span>
                  {calendarSidebarOpen ? (
                    <ChevronLeft
                      className="size-5"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  ) : (
                    <ChevronRight
                      className="size-5"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  )}
                </button>
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:hidden"
                  aria-expanded={calendarSidebarOpen}
                  aria-controls="scheduler-calendar-sidebar"
                  onClick={() => setCalendarSidebarOpen((o) => !o)}
                >
                  <span className="sr-only">Хуанлын панел нээх, хаах</span>
                  <Menu className="size-5" strokeWidth={1.5} aria-hidden />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:hidden"
                aria-expanded={calendarSidebarOpen}
                aria-controls="scheduler-calendar-sidebar"
                onClick={() => setCalendarSidebarOpen((o) => !o)}
              >
                <span className="sr-only">Хуанлын панел нээх, хаах</span>
                <Menu className="size-5" strokeWidth={1.5} aria-hidden />
              </button>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800 ring-1 ring-sky-200/80 dark:bg-sky-950/80 dark:text-sky-200 dark:ring-sky-700/60">
                <CalendarClock className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-base">
                  Багшийн хуанли
                </h1>
                <p className={cn("truncate text-xs", textDim)}>
                  {format(anchor, "yyyy MMMM", { locale: mn })}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                  AI-Powered Operations Center · Cron · Linear · Reclaim ·
                  ирээдүйн шийдэл
                </p>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <SchedulerAppearanceMenu />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 rounded-xl border-zinc-200 bg-white px-3.5 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Сонгох
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[min(100vw-2rem,18rem)] border-zinc-200 p-3 shadow-lg dark:border-zinc-600"
              >
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Сонголт
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Энд ирээдүйд хуваарь, анги эсвэл бусад тохиргоог сонгох цэс
                  гарна. Одоогоор зөвхөн загвар — ямар ч үйлдэл хийгдэхгүй.
                </p>
              </PopoverContent>
            </Popover>
            {pollExamId ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <Loader2 className="size-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                Синк…
              </span>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          {!shellMode ? (
            <nav
              className="flex w-[68px] shrink-0 flex-col border-r border-zinc-600/25 bg-[#3a3a42] text-zinc-200"
              aria-label="Үндсэн навигаци"
            >
              <div className="flex h-[52px] items-center justify-center border-b border-zinc-500/20">
                <div className="flex items-center gap-0.5" aria-hidden>
                  <Square className="size-2 fill-amber-300/75 text-amber-300/75" />
                  <Circle className="size-2 fill-sky-400 text-sky-400" />
                  <Triangle className="size-2 fill-amber-300/75 text-amber-300/75" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 px-2 py-3">
                <Link
                  href={
                    shellMode
                      ? "/ai-scheduler?view=school"
                      : "/ai-scheduler-school-event"
                  }
                  title="Сургуулийн хуанли"
                  aria-label="Сургуулийн хуанли руу очих"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/10 hover:text-blue-200"
                >
                  <CalendarDays
                    className="size-5"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </Link>
                <button
                  type="button"
                  title="Багшийн хуанли"
                  aria-current="page"
                  aria-label="Багшийн хуанли (одоо)"
                  className="flex size-11 items-center justify-center rounded-xl bg-white/14 text-white shadow-sm ring-1 ring-white/12"
                >
                  <CalendarClock
                    className="size-5"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </button>
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

          {/* Хураагддаг: жижиг хуанли + давхарга */}
          <aside
            id="scheduler-calendar-sidebar"
            className={cn(
              "shrink-0 overflow-hidden border-zinc-200/90 bg-white/50 transition-[width] duration-200 ease-out xl:bg-white/40 dark:border-zinc-700/90 dark:bg-zinc-950/60 xl:dark:bg-zinc-950/50",
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
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Календарь
                  </p>
                </div>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={mn}
                    className="w-fit"
                  />
                </div>
              </div>

              <div
                className={cn(
                  panelLight,
                  "divide-y divide-zinc-100 dark:divide-zinc-800",
                )}
              >
                <div className="px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Давхарга · Ops Center ({CALENDAR_LAYERS.length})
                  </p>
                </div>
                {CALENDAR_LAYERS.map((layer) => {
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
                          ? "bg-blue-50/80 text-zinc-900 dark:bg-blue-950/50 dark:text-zinc-100"
                          : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-sm",
                          layer.swatch,
                          layer.style,
                          !on && "opacity-35",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {layer.label}
                        </span>
                        <span className="line-clamp-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                          {layer.role}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          on
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
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
            {/* Төв: цагийн багана + 7 хоногийн тор */}
            <main className="min-h-[480px] min-w-0 flex-1 overflow-auto border-zinc-200/90 p-3 sm:p-4 xl:rounded-l-3xl xl:border-r xl:bg-zinc-50/30 dark:border-zinc-700/90 dark:xl:bg-zinc-950/40">
              <div
                className={cn(
                  panelLight,
                  "flex h-full min-h-[440px] flex-col overflow-hidden p-3 xl:rounded-l-3xl xl:shadow-md",
                )}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Энэ 7 хоног
                    </p>
                    <p className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {weekRangeLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-zinc-200 bg-zinc-50/90 p-0.5 dark:border-zinc-600 dark:bg-zinc-900/80">
                    <button
                      type="button"
                      onClick={() => shiftWeek(-1)}
                      className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      aria-label="Өмнөх долоо хоног"
                    >
                      <ChevronLeft className="size-4" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(new Date())}
                      className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      Өнөөдөр
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftWeek(1)}
                      className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      aria-label="Дараагийн долоо хоног"
                    >
                      <ChevronRight className="size-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                <div className="mb-3 rounded-xl border border-blue-100/90 bg-linear-to-r from-blue-50/90 to-white px-3 py-2.5 dark:border-blue-900/50 dark:from-blue-950/50 dark:to-zinc-900/80">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <Target className="size-4" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Фокус цаг (жишээ)
                        </p>
                        <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                          Reclaim / Linear-тай ижил төстэй: долоо хоногийн чухал
                          ажилд цаг гаргах — Operations Center-ийн нэг хэсэг.
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 tabular-nums text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                      6ц / 10ц
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100/80 dark:bg-blue-950/80"
                    role="progressbar"
                    aria-valuenow={60}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Фокус цагийн явц (жишээ)"
                  >
                    <div className="h-full w-[60%] rounded-full bg-blue-400 dark:bg-blue-500" />
                  </div>
                </div>

                <div className="mb-2 grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 gap-y-0 border-b border-zinc-200 pb-2 dark:border-zinc-700 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
                  <div
                    className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500"
                    aria-hidden
                  >
                    Цаг
                  </div>
                  {weekDays.map((d) => {
                    const isSel = isSameDay(d, anchor);
                    return (
                      <div
                        key={format(d, "yyyy-MM-dd")}
                        className="text-center"
                      >
                        <div
                          className={cn(
                            "mx-auto flex size-8 items-center justify-center rounded-full text-[11px] font-medium sm:size-9 sm:text-xs",
                            isSel
                              ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 dark:bg-blue-500 dark:shadow-blue-500/30"
                              : "border border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                          )}
                          aria-label={format(d, "EEEE", { locale: mn })}
                        >
                          {WEEKDAY_LETTER_MN[getISODay(d)] ?? "?"}
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 sm:text-sm">
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
                          className="flex items-start justify-end border-t border-zinc-100 pr-1 pt-0.5 text-[10px] tabular-nums text-zinc-400 first:border-t-0 first:pt-0 dark:border-zinc-800 dark:text-zinc-500 sm:pr-1.5 sm:text-[11px]"
                          style={{ height: HOUR_PX }}
                        >
                          {String(hour).padStart(2, "0")}:00
                        </div>
                      ))}
                    </div>

                    {weekDays.map((d, colIdx) => {
                      const sameDay =
                        scheduleStart && isSameDay(scheduleStart, d);
                      const top = scheduleStart
                        ? blockTopPercent(scheduleStart)
                        : 28;

                      return (
                        <div
                          key={`col-${colIdx}`}
                          className="relative rounded-xl border border-zinc-200/90 bg-zinc-50/80 dark:border-zinc-600/90 dark:bg-zinc-900/50"
                          style={{ minHeight: GRID_BODY_MIN_H }}
                        >
                          <div
                            className="scheduler-hour-grid-bg pointer-events-none absolute inset-0 rounded-[inherit]"
                            aria-hidden
                          />
                          {layerOn.school_event && colIdx === 5 ? (
                            <div
                              className="absolute left-1 right-1 z-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-50"
                              style={{
                                top: `${slotTopPercent(SCHOOL_EVENT_DEMO.startH, SCHOOL_EVENT_DEMO.startM)}%`,
                                height: `${blockHeightPercent(SCHOOL_EVENT_DEMO.startH, SCHOOL_EVENT_DEMO.startM, SCHOOL_EVENT_DEMO.endH, SCHOOL_EVENT_DEMO.endM)}%`,
                                minHeight: "52px",
                              }}
                            >
                              Сургуулийн эвент
                              <span className="mt-0.5 block font-normal text-amber-700 dark:text-amber-300">
                                {formatBlockDuration(
                                  SCHOOL_EVENT_DEMO.startH,
                                  SCHOOL_EVENT_DEMO.startM,
                                  SCHOOL_EVENT_DEMO.endH,
                                  SCHOOL_EVENT_DEMO.endM,
                                )}
                              </span>
                            </div>
                          ) : null}

                          {layerOn.primary && colIdx === 0 ? (
                            <div
                              className="absolute left-1 right-1 rounded-xl border border-sky-200 bg-sky-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-sky-950 shadow-sm dark:border-sky-700 dark:bg-sky-950/45 dark:text-sky-50"
                              style={{
                                top: `${slotTopPercent(8, 0)}%`,
                                minHeight: "52px",
                              }}
                            >
                              10А · Математик
                              <span className="mt-0.5 block font-normal text-sky-700 dark:text-sky-300">
                                {formatLessonWindow(8, 0)} · {LESSON_MINUTES}{" "}
                                мин
                              </span>
                            </div>
                          ) : null}
                          {layerOn.primary && colIdx === 1 ? (
                            <div
                              className="absolute left-1 right-1 rounded-xl border border-sky-200 bg-sky-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-sky-950 shadow-sm dark:border-sky-700 dark:bg-sky-950/45 dark:text-sky-50"
                              style={{
                                top: `${slotTopPercent(10, 0)}%`,
                                minHeight: "52px",
                              }}
                            >
                              10А · Геометр
                              <span className="mt-0.5 block font-normal text-sky-700 dark:text-sky-300">
                                {formatLessonWindow(10, 0)} · {LESSON_MINUTES}{" "}
                                мин
                              </span>
                            </div>
                          ) : null}
                          {layerOn.primary && colIdx === 2 ? (
                            <div
                              className="absolute left-1 right-1 rounded-xl border border-sky-200 bg-sky-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-sky-950 shadow-sm dark:border-sky-700 dark:bg-sky-950/45 dark:text-sky-50"
                              style={{
                                top: `${slotTopPercent(13, 0)}%`,
                                minHeight: "52px",
                              }}
                            >
                              10А · Математик
                              <span className="mt-0.5 block font-normal text-sky-700 dark:text-sky-300">
                                {formatLessonWindow(13, 0)} · {LESSON_MINUTES}{" "}
                                мин
                              </span>
                            </div>
                          ) : null}
                          {layerOn.primary && colIdx === 3 ? (
                            <div
                              className="absolute left-1 right-1 z-[1] rounded-xl border border-sky-200 bg-sky-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-sky-950 shadow-sm dark:border-sky-700 dark:bg-sky-950/45 dark:text-sky-50"
                              style={{
                                top: `${slotTopPercent(9, 0)}%`,
                                minHeight: "52px",
                              }}
                            >
                              10А · Геометр
                              <span className="mt-0.5 block font-normal text-sky-700 dark:text-sky-300">
                                {formatLessonWindow(9, 0)} · {LESSON_MINUTES}{" "}
                                мин
                              </span>
                            </div>
                          ) : null}
                          {layerOn.primary && colIdx === 4 ? (
                            <div
                              className="absolute left-1 right-1 rounded-xl border border-sky-200 bg-sky-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-sky-950 shadow-sm dark:border-sky-700 dark:bg-sky-950/45 dark:text-sky-50"
                              style={{
                                top: `${slotTopPercent(15, 0)}%`,
                                minHeight: "52px",
                              }}
                            >
                              10А · Математик
                              <span className="mt-0.5 block font-normal text-sky-700 dark:text-sky-300">
                                {formatLessonWindow(15, 0)} · {LESSON_MINUTES}{" "}
                                мин
                              </span>
                            </div>
                          ) : null}
                          {layerOn.conflict && colIdx === 3 ? (
                            <div
                              className="absolute left-1 right-1 top-[32%] z-[2] rounded-xl border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-rose-950 shadow-sm ring-1 ring-rose-100"
                              style={{ minHeight: "48px" }}
                            >
                              Зөрчилтэй
                              <span className="mt-0.5 block font-normal text-rose-700">
                                Conflict · жишээ (хоёр цаг давхцсан)
                              </span>
                            </div>
                          ) : null}

                          {layerOn.personal && colIdx === 6 ? (
                            <div
                              className="absolute left-1 right-1 top-[48%] z-[1] rounded-xl border border-slate-300/80 bg-slate-100/95 px-2 py-1.5 text-[10px] text-slate-800 shadow-sm ring-1 ring-slate-200/70"
                              style={{ minHeight: "44px" }}
                              title="Юу гэдэг нь харагдахгүй — зөвхөн Завгүй"
                            >
                              <span className="font-medium">Завгүй</span>
                              <span className="mt-0.5 block text-[9px] font-normal text-slate-500">
                                Busy · Google Calendar (дэлгэрүүлэхгүй)
                              </span>
                            </div>
                          ) : null}

                          {layerOn.ai_draft && suggested && colIdx === 2 ? (
                            <>
                              <div
                                className="absolute left-0.5 right-0.5 z-10 w-[calc(100%-4px)] -rotate-2 rounded-xl border-2 border-dashed border-violet-400 bg-violet-50 px-2 py-2 text-[10px] font-semibold leading-tight text-violet-950 shadow-md shadow-violet-200/60 ring-1 ring-violet-200/80"
                                style={{ top: "18%", minHeight: "72px" }}
                              >
                                AI Draft Slots
                                <span className="mt-0.5 block font-normal text-violet-700">
                                  AI-ийн оновчтой цаг · тасархай хүрээ
                                </span>
                                <span className="mt-1 block text-[9px] font-normal text-violet-600/90">
                                  Confirm дарвал ногоон (Confirmed) болно
                                </span>
                              </div>
                              <svg
                                className="pointer-events-none absolute left-[40%] top-[32%] z-5 h-16 w-24 text-violet-500"
                                viewBox="0 0 96 64"
                                fill="none"
                                aria-hidden
                              >
                                <path
                                  d="M8 8 Q 48 40 88 52"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M82 46 L88 52 L80 54"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <div
                                className="absolute left-1 right-1 top-[58%] rounded-xl border-2 border-dashed border-violet-300/90 bg-violet-50/70 px-2 py-1.5 text-center text-[9px] font-medium text-violet-900"
                                style={{ height: "44px" }}
                              >
                                Сул цонх
                              </div>
                            </>
                          ) : null}

                          {layerOn.confirmed_exam &&
                          showJob &&
                          sameDay &&
                          !suggested &&
                          showJob.status === "confirmed" ? (
                            <div
                              className={cn(
                                "absolute left-1 right-1 rounded-xl border px-2 py-1.5 text-[10px] font-medium leading-tight shadow-sm",
                                "border-emerald-200 bg-emerald-50 text-emerald-950",
                              )}
                              style={{
                                top: `${Math.min(top, 78)}%`,
                                minHeight: "56px",
                              }}
                            >
                              Баталгаажсан шалгалт
                              <span className="mt-0.5 block font-normal text-emerald-700">
                                Confirmed Exams · AI эсвэл гараар
                              </span>
                            </div>
                          ) : null}

                          {(layerOn.conflict ||
                            layerOn.ai_draft ||
                            layerOn.confirmed_exam) &&
                          showJob &&
                          sameDay &&
                          !suggested &&
                          showJob.status === "failed" ? (
                            <div
                              className="absolute left-1 right-1 rounded-xl border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-rose-950 shadow-sm ring-1 ring-rose-100"
                              style={{
                                top: `${Math.min(top, 78)}%`,
                                minHeight: "56px",
                              }}
                            >
                              Зөрчилтэй
                              <span className="mt-0.5 block font-normal text-rose-700">
                                Conflict
                              </span>
                            </div>
                          ) : null}

                          {layerOn.ai_draft &&
                          showJob &&
                          sameDay &&
                          showJob.status === "pending" ? (
                            <div
                              className="absolute left-1 right-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-medium text-amber-900"
                              style={{
                                top: `${Math.min(top, 72)}%`,
                                minHeight: "44px",
                              }}
                            >
                              Хүлээгдэж буй…
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p
                  className={cn(
                    "mt-2 text-center text-[10px] leading-relaxed",
                    textDim,
                  )}
                >
                  AI-Powered Operations Center: усан цэнхэр үндсэн хичээл
                  (жишээ {LESSON_MINUTES} мин, завсар {BREAK_MINUTES} мин),
                  Дав–Баас өөр өөр цагийн эхлэл, ногоон баталгаажсан шалгалт,
                  нил ягаан тасархай AI Draft (Confirm дарвал ногоон давхарганд
                  шилжинэ), саарал хувийн синк (Завгүй / Google Calendar),
                  цайвар шар сургуулийн эвент (цаг + мин), улаан зөрчил
                  (давхцал). Жишээ + job; бүрэн sync биш.
                </p>
              </div>
            </main>

            {/* Баруун: AI панел */}
            <aside className="flex w-full shrink-0 flex-col border-zinc-200/90 bg-white shadow-[inset_1px_0_0_0_rgba(228,228,231,0.6)] dark:border-zinc-700/90 dark:bg-zinc-950 dark:shadow-[inset_1px_0_0_0_rgba(39,39,42,0.8)] xl:w-[320px] xl:border-l">
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/90">
                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Square className="size-2.5 fill-current" />
                  <Circle className="size-2 fill-current" />
                  <Triangle className="size-2.5 fill-current" />
                </div>
                <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  PineQuest AI
                </span>
              </div>

              <div className="flex gap-1 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setRightTab("ai")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    rightTab === "ai"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )}
                >
                  AI хуваарь
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("form")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    rightTab === "form"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )}
                >
                  Тохиргоо
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-zinc-50/40 p-4 dark:bg-zinc-950/80">
                {rightTab === "form" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="scheduler-test-id"
                        className="text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        testId
                      </Label>
                      <Input
                        id="scheduler-test-id"
                        value={testId}
                        onChange={(e) => setTestId(e.target.value)}
                        className="rounded-xl border-zinc-200 bg-white font-mono text-xs text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="scheduler-class-id"
                        className="text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        classId
                      </Label>
                      <Input
                        id="scheduler-class-id"
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        placeholder="10A"
                        className="rounded-xl border-zinc-200 bg-white font-mono text-sm text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={queueLoading}
                      onClick={() => void handleQueueSchedule()}
                      className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                    >
                      {queueLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          Тооцоолох
                          <ArrowRight className="size-4" />
                        </span>
                      )}
                    </Button>
                    {lastQueuedExamId ? (
                      <p className="break-all font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                        {lastQueuedExamId}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pollExamId ? (
                      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                        <Loader2 className="size-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                        getAiExamSchedule…
                      </div>
                    ) : null}

                    {showJob ? (
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-600 dark:bg-zinc-900">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            Төлөв
                          </span>
                          <Badge
                            variant="outline"
                            className="border-zinc-300 font-mono text-[10px] text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                          >
                            {showJob.status}
                          </Badge>
                        </div>
                        <p className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                          {showJob.startTime}
                        </p>
                        {showJob.aiReasoning ? (
                          <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                            {showJob.aiReasoning}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-8 text-center text-xs text-zinc-500 shadow-sm dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
                        <PanelRight className="mx-auto mb-2 size-8 text-zinc-300 dark:text-zinc-600" />
                        Эхлээд «Тохиргоо»-оос тооцоолох товч дарна уу.
                      </div>
                    )}

                    {showJob?.status === "suggested" &&
                    showJob.aiVariants?.length ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Сонгох
                        </p>
                        {showJob.aiVariants.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-2 shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {v.label}
                              </p>
                              <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                                {formatVariantWhen(v.startTime)}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={approveLoading}
                              onClick={() => void handleApproveVariant(v)}
                              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:shadow-blue-500/25 dark:hover:bg-blue-400"
                              aria-label="Батлах"
                            >
                              {approveLoading ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Play className="size-4 translate-x-0.5 fill-current" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() =>
                    setRightTab((t) => (t === "form" ? "ai" : "form"))
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <ChevronRight
                    className={cn(
                      "size-4 transition-transform",
                      rightTab === "form" && "-rotate-90",
                    )}
                  />
                  {rightTab === "form" ? "Төлөв рүү" : "Тохиргоо нээх"}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
