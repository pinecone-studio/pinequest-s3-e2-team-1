"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportStudentRow } from "../lib/report-adapters";

interface ReportResultsTableProps {
  rows: ReportStudentRow[];
}

export function ReportResultsTable({ rows }: ReportResultsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const normalizedSearch = search.toLowerCase();
      const matchesSearch =
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.studentCode.toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
      const matchesRisk = riskFilter === "all" || row.riskLevel === riskFilter;

      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [riskFilter, rows, search, statusFilter]);

  const handleExport = () => {
    const csv = [
      [
        "Сурагч",
        "Код",
        "Төлөв",
        "Оноо",
        "Эрсдэл",
        "Анхааруулга",
        "Аюултай",
        "Илгээсэн",
      ].join(","),
      ...filteredRows.map((row) =>
        [
          escapeCsv(row.name),
          escapeCsv(row.studentCode),
          escapeCsv(formatStatus(row.status)),
          row.score?.toFixed(1) ?? "",
          escapeCsv(formatRisk(row.riskLevel)),
          row.warningCount,
          row.dangerCount,
          escapeCsv(formatDateTime(row.submittedAt)),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "exam-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="rounded-[26px] border-border/80 bg-card/95 py-0 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.35)]">
      <CardHeader className="border-b border-border/70 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Нэгдсэн дүн орж ирнэ хүснэгтээр</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Хайлт, filter, export-тэй тайлангийн хүснэгт
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Сурагч хайх..."
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 min-w-[160px] rounded-xl bg-background">
                <SelectValue placeholder="Төлөв" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх төлөв</SelectItem>
                <SelectItem value="approved">Баталгаажсан</SelectItem>
                <SelectItem value="submitted">Илгээсэн</SelectItem>
                <SelectItem value="processing">Боловсруулж байна</SelectItem>
                <SelectItem value="in-progress">Явагдаж байна</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="h-10 min-w-[150px] rounded-xl bg-background">
                <SelectValue placeholder="Эрсдэл" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх эрсдэл</SelectItem>
                <SelectItem value="high">Өндөр</SelectItem>
                <SelectItem value="medium">Дунд</SelectItem>
                <SelectItem value="low">Бага</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 py-0">
        <ScrollArea className="max-h-[420px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="border-border/70">
                <TableHead className="px-6">Сурагч</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead>Оноо</TableHead>
                <TableHead>Эрсдэл</TableHead>
                <TableHead>Сигнал</TableHead>
                <TableHead className="pr-6 text-right">Сүүлд илгээсэн</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id} className="border-border/60">
                  <TableCell className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{row.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.studentCode}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-foreground">
                      {row.score !== null ? `${row.score.toFixed(1)}%` : "--"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <RiskBadge riskLevel={row.riskLevel} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      W {row.warningCount} / D {row.dangerCount}
                    </span>
                  </TableCell>
                  <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                    {formatDateTime(row.submittedAt ?? row.lastActivity)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-6 py-16 text-center text-sm text-muted-foreground"
                  >
                    Шүүлтүүртэй тохирох дүн олдсонгүй.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ReportStudentRow["status"] }) {
  const styles: Record<ReportStudentRow["status"], string> = {
    approved: "bg-success/10 text-success",
    "in-progress": "bg-warning/10 text-warning",
    processing: "bg-info/10 text-info",
    submitted: "bg-primary/10 text-primary",
  };

  return (
    <Badge variant="secondary" className={styles[status]}>
      {formatStatus(status)}
    </Badge>
  );
}

function RiskBadge({ riskLevel }: { riskLevel: ReportStudentRow["riskLevel"] }) {
  const styles: Record<ReportStudentRow["riskLevel"], string> = {
    high: "bg-danger/10 text-danger",
    low: "bg-success/10 text-success",
    medium: "bg-warning/10 text-warning",
  };

  return (
    <Badge variant="secondary" className={styles[riskLevel]}>
      {formatRisk(riskLevel)}
    </Badge>
  );
}

function formatStatus(status: ReportStudentRow["status"]) {
  switch (status) {
    case "approved":
      return "Баталгаажсан";
    case "submitted":
      return "Илгээсэн";
    case "processing":
      return "Боловсруулж байна";
    case "in-progress":
      return "Явагдаж байна";
    default:
      return status;
  }
}

function formatRisk(riskLevel: ReportStudentRow["riskLevel"]) {
  switch (riskLevel) {
    case "high":
      return "Өндөр";
    case "medium":
      return "Дунд";
    case "low":
      return "Бага";
    default:
      return riskLevel;
  }
}

function formatDateTime(date: Date | null) {
  if (!date) {
    return "--";
  }

  return new Intl.DateTimeFormat("mn-MN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}
