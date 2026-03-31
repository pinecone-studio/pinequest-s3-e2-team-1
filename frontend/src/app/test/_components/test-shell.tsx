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
        <SidebarInset className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.08),_transparent_28%),linear-gradient(180deg,_rgba(248,250,252,0.98)_0%,_rgba(241,245,249,0.96)_100%)]">
          <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <SidebarTrigger className="mt-1 shrink-0" />
                    <div className="min-w-0">
                      <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                        {title}
                      </h1>
                      {description ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {meta ? (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-11 text-xs text-muted-foreground">
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
