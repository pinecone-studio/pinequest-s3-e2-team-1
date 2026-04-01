"use client";

import { Database, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  sharedLibraryMaterials,
  type SharedLibraryMaterial,
} from "./material-builder-config";
import {
  SharedLibraryQuestionCard,
  SharedLibraryStat,
} from "./material-builder-ui";

interface SharedLibrarySectionProps {
  selectedMaterialId: string;
  onSelectMaterialId: (id: string) => void;
}

export function SharedLibrarySection({
  selectedMaterialId,
  onSelectMaterialId,
}: SharedLibrarySectionProps) {
  const selectedSharedMaterial =
    sharedLibraryMaterials.find((material) => material.id === selectedMaterialId) ??
    sharedLibraryMaterials[0];

  return (
    <section className="mt-5 space-y-4">
      <div className="flex items-center gap-3 text-[15px] font-semibold text-slate-900">
        <Database className="h-5 w-5 text-[#2563eb]" />
        Нэгдсэн сангаас ашиглах
      </div>

      <div className="grid gap-5 xl:h-[calc(100vh-14rem)] xl:grid-cols-[356px_minmax(0,1fr)] xl:items-stretch">
        <aside className="rounded-[24px] border border-[#e3e9f4] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)] xl:flex xl:h-full xl:min-h-0 xl:flex-col">
          <h3 className="text-[20px] font-semibold text-[#0b5cab]">
            Өгөгдлийн санд буй материал
          </h3>

          <div className="relative mt-4">
            <Input
              defaultValue=""
              placeholder="Материалын нэрээр хайх"
              className="!h-[40px] rounded-[12px] border-[#dbe4f3] bg-white pr-10 text-[14px] text-slate-800"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="mt-4 space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            {sharedLibraryMaterials.map((material) => {
              const active = material.id === selectedSharedMaterial?.id;

              return (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => onSelectMaterialId(material.id)}
                  className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                    active
                      ? "border-[#cfe1ff] bg-[#f4f8ff] shadow-[0_8px_18px_rgba(59,130,246,0.10)]"
                      : "border-[#e3e9f4] bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold text-slate-900">
                        {material.title}
                      </p>
                      <p className="mt-1 text-[13px] text-slate-500">
                        {material.subject} · {material.grade}
                      </p>
                    </div>
                    <span className="inline-flex min-h-[28px] items-center justify-center rounded-full border border-[#d7e3fb] bg-[#e8f0ff] px-3 py-1 text-center text-[12px] font-medium text-[#215da8]">
                      {material.examType}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 text-[14px] leading-6 text-slate-600">
                    {material.summary}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">
                      {material.questionCount} асуулт
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">
                      {material.totalScore} оноо
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">
                      Шинэчлэгдсэн: {material.updatedAt}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {selectedSharedMaterial ? (
          <SharedLibraryPreviewPane material={selectedSharedMaterial} />
        ) : null}
      </div>
    </section>
  );
}

function SharedLibraryPreviewPane({
  material,
}: {
  material: SharedLibraryMaterial;
}) {
  return (
    <section className="rounded-[24px] border border-[#e3e9f4] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)] xl:flex xl:h-full xl:min-h-0 xl:flex-col">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[14px] font-medium text-[#2563eb]">Сонгосон материал</p>
          <h3 className="mt-2 text-[24px] font-semibold text-slate-900">
            {material.title}
          </h3>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">{material.summary}</p>
        </div>

        <div className="w-full lg:max-w-[460px] lg:pt-8">
          <div className="flex flex-wrap gap-2 text-[13px] text-slate-600">
            <span className="rounded-full border border-[#d7e3fb] bg-[#e8f0ff] px-3 py-1.5 font-medium text-[#215da8]">
              {material.subject}
            </span>
            <span className="rounded-full border border-[#d7e3fb] bg-[#e8f0ff] px-3 py-1.5 font-medium text-[#215da8]">
              {material.grade}
            </span>
            <span className="rounded-full border border-[#d7e3fb] bg-[#e8f0ff] px-3 py-1.5 font-medium text-[#215da8]">
              {material.totalScore} оноо
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SharedLibraryStat label="Нийт асуулт" value={material.questionCount} />
            <SharedLibraryStat label="Нийт оноо" value={material.totalScore} />
            <SharedLibraryStat label="Сүүлд шинэчлэгдсэн" value={material.updatedAt} />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2">
        {material.contents.map((content, index) => (
          <SharedLibraryQuestionCard
            key={content.id}
            material={material}
            content={content}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
