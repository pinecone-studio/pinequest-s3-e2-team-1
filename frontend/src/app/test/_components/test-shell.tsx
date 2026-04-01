"use client";

import type { ReactNode } from "react";
import { ChevronDown, GraduationCap, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TestSidebar } from "./test-sidebar";

interface TestShellProps {
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  description?: string;
  hideHeader?: boolean;
  meta?: ReactNode;
  title: string;
}

export function TestShell({
  actions,
  children,
  contentClassName,
  hideHeader,
  title,
}: TestShellProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <SidebarProvider defaultOpen>
        <TestSidebar />
        <SidebarInset className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#f4f7fb_100%)]">
          <header className="sticky top-0 z-20 bg-[rgba(248,251,255,0.92)] backdrop-blur">
            <div className="px-4 pb-3 pt-6 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <SidebarTrigger className="mt-1 shrink-0 lg:hidden" />
                    <div className="min-w-0">
                      <h1 className="truncate text-3xl font-semibold tracking-tight text-slate-900">
                        {title}
                      </h1>
                      {description ? (
                        <p className="mt-1 text-sm text-slate-500">
                          {description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {meta ? (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-11 text-xs text-slate-500 lg:pl-0">
                      {meta}
                    </div>
                  ) : null}
                </div>

          {hideHeader ? null : (
            <header className="row-start-1 col-start-2 flex items-center justify-between border-b border-slate-200 bg-white px-6">
              <h1 className="truncate text-2xl font-semibold text-slate-900">
                {title}
              </h1>

              <div className="flex items-center gap-3">
                {actions ? (
                  <div className="hidden flex-wrap items-center gap-2 lg:flex">
                    {actions}
                  </div>
                ) : null}
                <button className="flex items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50">
                  <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-700">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-slate-900">Багш</p>
                    <p className="text-xs text-slate-500">Teacher</p>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
                </button>
              </div>
            </header>
          )}

          <TestSidebar />

          <main
            className={cn(
              "row-start-2 col-start-2 overflow-y-auto bg-[#f5f7fa] p-5",
              contentClassName,
            )}
          >
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
