import React from "react";
import { getGeneratorStats, listTests } from "@/lib/mock-exams/store";

const page = () => {
  const stats = getGeneratorStats();
  const tests = listTests();

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300">
            Тест Үүсгэгчийн Үйлчилгээ
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Mock шалгалт үүсгэх, засварлах backend
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
            Энэ үйлчилгээ нь багшид зориулсан mock шалгалт үүсгэж, бүрэн CRUD
            засварыг дэмжиж, зөв хариултуудыг өөрийн өгөгдлийн давхаргад
            хадгалж, оюутны шалгалтын үйлчилгээнд зориулсан төрөл-аюулгүй
            endpoint-үүдийг нээдэг.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Загварууд</p>
            <p className="mt-2 text-3xl font-semibold">{stats.templateCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Нийт тестүүд</p>
            <p className="mt-2 text-3xl font-semibold">{stats.totalTests}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Нийтлэгдсэн</p>
            <p className="mt-2 text-3xl font-semibold">
              {stats.publishedTests}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Ноорог</p>
            <p className="mt-2 text-3xl font-semibold">{stats.draftTests}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-semibold">Боломжит endpoint-үүд</h2>
          <ul className="mt-4 space-y-2 font-mono text-sm text-slate-300">
            <li>POST /api/tests/generate</li>
            <li>GET /api/tests</li>
            <li>GET /api/tests/:testId</li>
            <li>PUT /api/tests/:testId</li>
            <li>DELETE /api/tests/:testId</li>
            <li>POST /api/tests/save</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-semibold">Одоогийн mock шалгалтууд</h2>
          <div className="mt-4 grid gap-4">
            {tests.map((test) => (
              <div
                key={test.id}
                className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-medium">{test.title}</p>
                    <p className="text-sm text-slate-400">
                      {test.criteria.gradeLevel}-р анги •{" "}
                      {test.criteria.subject} • {test.criteria.topic} •{" "}
                      {test.criteria.difficulty}
                    </p>
                  </div>
                  <span className="rounded-full border border-sky-400/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-200">
                    {test.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  {test.questionCount} асуулт • Шинэчлэгдсэн{" "}
                  {new Date(test.updatedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default page;
