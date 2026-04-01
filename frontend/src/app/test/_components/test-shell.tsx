"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TestSidebar } from "./test-sidebar";

interface TestShellProps {
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  description?: string;
  meta?: ReactNode;
  title: string;
}

export function TestShell({
  actions,
  children,
  contentClassName,
  description,
  meta,
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

                {actions ? (
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {actions}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div
            className={cn("flex-1 px-4 py-6 sm:px-6 lg:px-8", contentClassName)}
          >
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
