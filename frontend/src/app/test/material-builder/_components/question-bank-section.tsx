"use client";

import { CircleDot, RefreshCcw, Repeat2, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  answerOptions,
  explanationClassName,
  optionFieldClassName,
  textareaClassName,
} from "./material-builder-config";

export function QuestionBankSection() {
  return (
    <section className="mt-5 rounded-[18px] border border-[#e3e9f4] bg-white px-5 py-6 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:px-6">
      <div className="mb-5 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
        <Sparkles className="h-4 w-4 text-[#2563eb]" />
        Асуулт үүсгэх
      </div>

      <div className="grid gap-3 xl:grid-cols-[68px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Select defaultValue="2">
          <SelectTrigger className={optionFieldClassName}>
            <SelectValue placeholder="Тоо" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="4">4</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="single-choice">
          <SelectTrigger className={optionFieldClassName}>
            <span className="flex min-w-0 items-center gap-2">
              <CircleDot className="h-4 w-4 text-slate-700" />
              <SelectValue placeholder="Асуултын төрөл" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single-choice">Нэг сонголттой</SelectItem>
            <SelectItem value="multiple-choice">Олон сонголттой</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="easy">
          <SelectTrigger className={optionFieldClassName}>
            <SelectValue placeholder="Түвшин" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Энгийн</SelectItem>
            <SelectItem value="medium">Дунд</SelectItem>
            <SelectItem value="hard">Хүнд</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="shuffle">
          <SelectTrigger className={optionFieldClassName}>
            <span className="flex min-w-0 items-center gap-2">
              <Repeat2 className="h-4 w-4 text-slate-700" />
              <SelectValue placeholder="Сонголт" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shuffle">Сэргээн санах</SelectItem>
            <SelectItem value="concept">Ойлголтын</SelectItem>
            <SelectItem value="practice">Дасгалын</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        <Textarea
          defaultValue="2x+5=13 тэгшитгэлийг бод."
          className={textareaClassName}
        />
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="secondary"
          className="!h-[36px] min-w-[158px] rounded-[10px] border border-[#d6e4fb] bg-[#edf4ff] px-4 text-[#1659a6] hover:bg-[#e5efff]"
        >
          <WandSparkles className="h-4 w-4" />
          Хариулт үүсгэх
        </Button>
      </div>

      <Separator className="my-4 bg-[#e6edf7]" />

      <div>
        <p className="mb-3 text-[14px] font-medium text-slate-800">Хариулт</p>
        <RadioGroup defaultValue="3" className="gap-3">
          {answerOptions.map((option) => (
            <label
              key={option.id}
              htmlFor={option.id}
              className="flex min-h-[44px] items-center gap-3 rounded-[10px] border border-[#e2e8f0] bg-[#eef3ff] px-4 text-[14px] text-slate-800"
            >
              <RadioGroupItem
                id={option.id}
                value={option.value}
                className="border-[#cdd8ea] text-[#0b5cab] data-checked:border-[#0b5cab] data-checked:bg-[#0b5cab]"
              />
              <span>{option.value}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="mt-4">
        <Label
          htmlFor="answer-explanation"
          className="mb-3 block text-[14px] font-medium text-slate-800"
        >
          Зөв хариултын тайлбар
        </Label>
        <Textarea
          id="answer-explanation"
          defaultValue={`Бодолт:
1. +5-ыг нөгөө тал руу шилжүүлнэ:
   2x = 13 - 5
2. Хасна:
   2x = 8
3. 2-оор хуваана:
   x = 4`}
          className={explanationClassName}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-[14px] font-medium text-slate-700 transition hover:text-slate-900"
        >
          <RefreshCcw className="h-4 w-4" />
          Дахин үүсгүүлэх
        </button>

        <Button
          type="button"
          variant="outline"
          className="!h-[38px] min-w-[140px] rounded-[10px] border-[#0b5cab] bg-white px-5 text-[#0b5cab] hover:bg-[#f4f8ff]"
        >
          Асуулт нэмэх
        </Button>
      </div>
    </section>
  );
}
