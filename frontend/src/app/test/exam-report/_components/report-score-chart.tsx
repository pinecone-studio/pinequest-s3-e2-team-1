"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsScoreBucket } from "../../live-dashboard/lib/types";

interface ReportScoreChartProps {
  data: AnalyticsScoreBucket[];
}

export function ReportScoreChart({ data }: ReportScoreChartProps) {
  return (
    <Card className="rounded-[26px] border-border/80 bg-card/95 py-0 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.35)]">
      <CardHeader className="border-b border-border/70 px-6 py-5">
        <CardTitle>Ангийн ахиц харагдана графикаар</CardTitle>
        <p className="text-sm text-muted-foreground">
          Онооны бүлэглэлээр ангийн тархалт
        </p>
      </CardHeader>
      <CardContent className="px-6 py-5">
        {data.some((item) => item.count > 0) ? (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barCategoryGap={18}>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  axisLine={false}
                  dataKey="range"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.875rem",
                    boxShadow: "0 16px 45px rgba(15, 23, 42, 0.12)",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--primary))"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex min-h-[250px] items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 text-sm text-muted-foreground">
            Онооны график гаргах өгөгдөл алга.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
