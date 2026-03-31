import { CircleAlert, Gauge, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ReportSummaryCardsProps {
  averageScore: number | null;
  failingCount: number;
  highestScore: number | null;
  lowestScore: number | null;
}

const summaryCards = [
  {
    icon: Gauge,
    key: "average",
    label: "Дундаж оноо",
    toneClassName: "border-l-[4px] border-l-primary",
    valueClassName: "text-primary",
  },
  {
    icon: TrendingUp,
    key: "highest",
    label: "Хамгийн өндөр оноо",
    toneClassName: "border-l-[4px] border-l-success",
    valueClassName: "text-success",
  },
  {
    icon: TrendingDown,
    key: "lowest",
    label: "Хамгийн бага оноо",
    toneClassName: "border-l-[4px] border-l-danger",
    valueClassName: "text-danger",
  },
  {
    icon: CircleAlert,
    key: "failing",
    label: "Тэнцээгүй сурагчид",
    toneClassName: "border-l-[4px] border-l-info",
    valueClassName: "text-foreground",
  },
] as const;

export function ReportSummaryCards({
  averageScore,
  failingCount,
  highestScore,
  lowestScore,
}: ReportSummaryCardsProps) {
  const values = {
    average: formatPercent(averageScore),
    failing: `${failingCount}`,
    highest: formatPercent(highestScore),
    lowest: formatPercent(lowestScore),
  };

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {summaryCards.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            key={card.key}
            className={`rounded-[22px] bg-card/95 py-0 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] ${card.toneClassName}`}
          >
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </p>
                <p className={`mt-5 text-4xl font-semibold ${card.valueClassName}`}>
                  {values[card.key]}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/80 text-muted-foreground">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function formatPercent(value: number | null): string {
  if (typeof value !== "number") {
    return "--";
  }

  return `${value.toFixed(1)}%`;
}
