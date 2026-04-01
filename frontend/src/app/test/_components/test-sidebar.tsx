"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type NavigationItem =
  | {
      href: string;
      icon: LucideIcon;
      label: string;
      disabled?: false;
    }
  | {
      icon: LucideIcon;
      label: string;
      disabled: true;
      href?: never;
    };

const navigationItems: NavigationItem[] = [
  {
    href: "/test/live-dashboard",
    icon: Activity,
    label: "Шууд хяналт",
  },
  {
    href: "/test/exam-report",
    icon: BarChart3,
    label: "Шалгалтын тайлан",
  },
  {
    disabled: true,
    icon: ClipboardCheck,
    label: "Гүйцэтгэлийн хяналт",
  },
];

export function TestSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-slate-200/80 bg-white"
    >
      <SidebarHeader className="border-b border-slate-200/80 px-4 py-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-1 py-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b5cad] text-white shadow-[0_10px_24px_-18px_rgba(11,92,173,0.9)]">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-base font-semibold text-slate-900">
              Шалгалт систем
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Хяналт</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  {item.disabled ? (
                    <SidebarMenuButton
                      disabled
                      tooltip={item.label}
                      className="cursor-not-allowed opacity-70"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`)
                      }
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <div className="rounded-xl border border-dashed border-sidebar-border bg-sidebar-accent/40 px-3 py-3 group-data-[collapsible=icon]:hidden">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-sidebar-foreground">
              Live Dashboard
            </p>
            <Badge variant="secondary">Active</Badge>
          </div>
          <p className="text-xs leading-5 text-sidebar-foreground/70">
            Sidebar бүтэц бэлэн болсон. Дараагийн page-уудыг эндээс нэмэхэд
            амар боллоо.
          </p>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
