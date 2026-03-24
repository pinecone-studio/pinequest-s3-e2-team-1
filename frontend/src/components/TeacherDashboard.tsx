"use client";

import { useState, useTransition, useEffect } from "react";
import type {
    EditableQuestion,
    GenerateTestRequest,
    GenerateTestResponse,
    MockTest,
    MockTestDraft,
    QuestionOption,
    DeleteTestResponse,
    SaveTestResponse,
    UpdateTestResponse,
    AttemptSummary,
    ListAttemptsResponse,
} from "@shared/contracts/mock-exam";

type Notice = {
    tone: "success" | "error" | "neutral";
    message: string;
};

const defaultCriteria: GenerateTestRequest = {
    gradeLevel: 10,
    className: "10а",
    subject: "Математик",
    topic: "Явц-1",
    difficulty: "easy",
    questionCount: 6,
};

const createClientId = (prefix: string) => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    }
    return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
};

const createOption = (label: string): QuestionOption => ({
    id: createClientId("option"),
    text: label,
});

const createBlankQuestion = (): EditableQuestion => {
    const firstOption = createOption("А сонголт");
    const secondOption = createOption("Б сонголт");
    return {
        id: createClientId("question"),
        type: "single-choice",
        prompt: "Шинэ асуултын агуулга",
        options: [firstOption, secondOption],
        correctOptionId: firstOption.id,
        explanation: "Яагаад энэ хариулт зөв вэ?",
        points: 1,
        competency: "Ерөнхий сэтгэлгээ",
    };
};

const toDraftPayload = (test: MockTest): MockTestDraft => ({
    title: test.title,
    description: test.description,
    criteria: test.criteria,
    timeLimitMinutes: test.timeLimitMinutes,
    questions: test.questions,
});

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json" },
    });
    const payload = (await response.json()) as T & { message?: string };
    if (!response.ok) throw new Error(payload.message || "Хүсэлт амжилтгүй боллоо.");
    return payload;
}

export function TeacherDashboard() {
    const [criteria, setCriteria] = useState(defaultCriteria);
    const [draftTest, setDraftTest] = useState<MockTest | null>(null);
    const [allAttempts, setAllAttempts] = useState<AttemptSummary[]>([]);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice>({ tone: "neutral", message: "Багшийн удирдлагын хэсэгт тавтай морилно уу." });
    const [isPending, startTransition] = useTransition();

    const [selectedAttempt, setSelectedAttempt] = useState<AttemptSummary | null>(null);

    const setSuccess = (message: string) => setNotice({ tone: "success", message });
    const setError = (message: string) => setNotice({ tone: "error", message });

    const fetchAttempts = async () => {
        try {
            const result = await jsonRequest<ListAttemptsResponse>("/api/demo/exams");
            setAllAttempts(result.attempts);
        } catch (error) {
            console.error("Attempts fetch failed", error);
        }
    };

    useEffect(() => {
        fetchAttempts();
        const timer = setInterval(fetchAttempts, 5000); // 5 секунд тутамд шинэчилнэ
        return () => clearInterval(timer);
    }, []);

    const updateQuestion = (questionId: string, updater: (question: EditableQuestion) => EditableQuestion) => {
        setDraftTest((current) => {
            if (!current) return current;
            return {
                ...current,
                questions: current.questions.map((question) => (question.id === questionId ? updater(question) : question)),
            };
        });
    };

    const runRequest = <T,>(label: string, task: () => Promise<T>, onSuccess: (result: T) => void, successMessage: string) => {
        setBusyAction(label);
        startTransition(async () => {
            try {
                const result = await task();
                onSuccess(result);
                setSuccess(successMessage);
            } catch (error) {
                setError(error instanceof Error ? error.message : "Үйлдэл амжилтгүй боллоо.");
            } finally {
                setBusyAction(null);
            }
        });
    };

    const handleGenerate = () => runRequest(
        "Генератор ажиллаж байна...",
        () => jsonRequest<GenerateTestResponse>("/api/demo/generate", { method: "POST", body: JSON.stringify(criteria) }),
        (result) => setDraftTest(result.test),
        "Тест амжилттай үүсгэгдлээ."
    );

    const handleSaveDraft = () => draftTest && runRequest(
        "Хадгалж байна...",
        () => jsonRequest<SaveTestResponse>(`/api/demo/tests/${draftTest.id}`, { method: "PUT", body: JSON.stringify({ draft: toDraftPayload(draftTest) }) }),
        (result) => setDraftTest(result.test),
        "Ноорог амжилттай хадгалагдлаа."
    );

    const handleApprove = (attemptId: string) => runRequest(
        "Батлаж байна...",
        () => jsonRequest<{ success: true }>(`/api/demo/exams/approve`, { method: "POST", body: JSON.stringify({ attemptId }) }),
        () => fetchAttempts(),
        "Дүн амжилттай баталгаажлаа."
    );

    const handlePublish = () => draftTest && runRequest(
        "Нийтэлж байна...",
        () => jsonRequest<SaveTestResponse>("/api/demo/tests/save", { method: "POST", body: JSON.stringify({ testId: draftTest.id }) }),
        (result) => setDraftTest(result.test),
        "Тест нийтлэгдлээ. Одоо оюутнууд 3002 порт дээр харах боломжтой."
    );

    return (
        <div className="min-h-screen bg-stone-950 text-stone-100 p-8 font-sans">
            <div className="mx-auto max-w-7xl space-y-8">
                <header className="flex flex-col gap-4 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.4em] text-amber-500">Багшийн Удирдлагын Төв (Порт 3000)</p>
                        <h1 className="text-4xl font-bold tracking-tight">Mock Тест Үүсгэгч</h1>
                        <p className="text-stone-400 max-w-xl">Энд тестээ үүсгэж, нийтлээд, оюутнуудын ирүүлсэн хариулт болон оноог хянах боломжтой.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className={`px-5 py-3 rounded-2xl border text-sm ${notice.tone === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : notice.tone === "error" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-white/5 border-white/10 text-stone-400"}`}>
                            {notice.message} {busyAction && `(${busyAction})`}
                        </div>
                    </div>
                </header>

                <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
                    <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-semibold">1. Тест Загварчлах</h2>
                            <button
                                onClick={handleGenerate}
                                disabled={busyAction !== null}
                                className="rounded-full bg-amber-500 px-8 py-3 font-bold text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
                            >
                                Тест Үүсгэх
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
                            <label className="space-y-2">
                                <span className="text-xs uppercase text-stone-500">Анги (Жишээ: 10)</span>
                                <input type="number" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2" value={criteria.gradeLevel} onChange={e => setCriteria(c => ({ ...c, gradeLevel: Number(e.target.value) }))} />
                            </label>
                            <label className="space-y-2">
                                <span className="text-xs uppercase text-stone-500">Бүлэг (Жишээ: 10а)</span>
                                <input className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2" value={criteria.className} onChange={e => setCriteria(c => ({ ...c, className: e.target.value }))} />
                            </label>
                            <label className="space-y-2">
                                <span className="text-xs uppercase text-stone-500">Хичээл</span>
                                <input className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2" value={criteria.subject} onChange={e => setCriteria(c => ({ ...c, subject: e.target.value }))} />
                            </label>
                            <label className="space-y-2">
                                <span className="text-xs uppercase text-stone-500">Сэдэв</span>
                                <input className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2" value={criteria.topic} onChange={e => setCriteria(c => ({ ...c, topic: e.target.value }))} />
                            </label>
                            <label className="space-y-2">
                                <span className="text-xs uppercase text-stone-500">Асуулт</span>
                                <input type="number" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2" value={criteria.questionCount} onChange={e => setCriteria(c => ({ ...c, questionCount: Number(e.target.value) }))} />
                            </label>
                        </div>

                        {draftTest && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                                <div className="space-y-4">
                                    <input
                                        className="w-full text-2xl font-bold bg-transparent border-b border-white/10 pb-2 focus:border-amber-500 outline-none"
                                        value={draftTest.title}
                                        onChange={e => setDraftTest({ ...draftTest, title: e.target.value })}
                                    />
                                    <textarea
                                        className="w-full bg-black/20 rounded-xl p-4 text-stone-300 outline-none"
                                        value={draftTest.description}
                                        onChange={e => setDraftTest({ ...draftTest, description: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={handleSaveDraft} className="rounded-xl border border-white/10 bg-white/5 px-6 py-2 hover:bg-white/10">Ноорог хадгалах</button>
                                    <button onClick={handlePublish} className="rounded-xl bg-emerald-600 px-6 py-2 font-bold hover:bg-emerald-500">Нийтлэх (3002 руу илгээх)</button>
                                </div>

                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {draftTest.questions.map((q, i) => (
                                        <div key={q.id} className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                                            <div className="flex justify-between items-center text-stone-500">
                                                <span className="text-sm">Асуулт {i + 1}</span>
                                                <span className="text-xs">{q.competency}</span>
                                            </div>
                                            <input
                                                className="w-full bg-transparent border-none text-lg font-medium outline-none"
                                                value={q.prompt}
                                                onChange={e => updateQuestion(q.id, curr => ({ ...curr, prompt: e.target.value }))}
                                            />
                                            <div className="space-y-2">
                                                {q.options.map(opt => (
                                                    <div key={opt.id} className="flex gap-4 items-center">
                                                        <input type="radio" checked={q.correctOptionId === opt.id} readOnly />
                                                        <input className="flex-1 bg-white/5 rounded-lg px-3 py-1 text-sm outline-none" value={opt.text} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-semibold">2. Оюутны Шүүлтүүр (Results)</h2>
                        <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden shadow-xl">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-stone-400">
                                    <tr>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider">Оюутан</th>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider">Оноо</th>
                                        <th className="px-6 py-4 font-medium uppercase tracking-wider"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {allAttempts.length === 0 ? (
                                        <tr><td colSpan={3} className="px-6 py-12 text-center text-stone-500 italic">Одоогоор ирсэн хариулт байхгүй байна.</td></tr>
                                    ) : (
                                        allAttempts.map(a => (
                                            <tr key={a.attemptId} className={`hover:bg-white/5 transition cursor-pointer ${selectedAttempt?.attemptId === a.attemptId ? "bg-white/10" : ""}`} onClick={() => setSelectedAttempt(a)}>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-lg">{a.studentName}</p>
                                                    <p className="text-xs text-stone-500">{a.title}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {a.status === "submitted" ? (
                                                        <span className="text-xl font-bold text-emerald-400">{a.score}/{a.maxScore}</span>
                                                    ) : (
                                                        <span className="text-stone-500 animate-pulse">Өгч буй...</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-xs uppercase font-bold text-stone-500 hover:text-white">Дэлгэрэнгүй &rarr;</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {selectedAttempt?.result && (
                            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-8 space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                    <h3 className="text-xl font-bold text-amber-500">{selectedAttempt.studentName}-ийн дэлгэрэнгүй хариулт</h3>
                                    <div className="flex gap-4">
                                        {selectedAttempt.status === "submitted" && (
                                            <button
                                                onClick={() => handleApprove(selectedAttempt.attemptId)}
                                                className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition"
                                            >
                                                Батлах
                                            </button>
                                        )}
                                        <button onClick={() => setSelectedAttempt(null)} className="text-stone-500 hover:text-white">&times; Хаах</button>
                                    </div>
                                </div>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {selectedAttempt.result.questionResults.map((r, i) => (
                                        <div key={r.questionId} className={`p-4 rounded-xl border ${r.isCorrect ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
                                            <div className="flex justify-between font-medium mb-1">
                                                <span>{i + 1}. Асуулт</span>
                                                <span className={r.isCorrect ? "text-emerald-400" : "text-rose-400"}>
                                                    {r.isCorrect ? `Зөв (+${r.pointsAwarded})` : `Буруу (0/${r.maxPoints})`}
                                                </span>
                                            </div>
                                            {r.selectedOptionId ? (
                                                <p className="text-sm text-stone-400 italic">Сонгосон: {r.selectedOptionId.slice(-4)}</p>
                                            ) : (
                                                <p className="text-sm text-rose-400/60">Хариулаагүй</p>
                                            )}
                                            {!r.isCorrect && r.explanation && (
                                                <p className="mt-2 text-xs text-amber-200/40 bg-black/20 p-2 rounded">Тайлбар: {r.explanation}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-6 space-y-4">
                            <h3 className="text-cyan-400 font-bold">Архитектур зөвлөгөө</h3>
                            <p className="text-xs leading-relaxed text-cyan-100/60 font-mono">
                                БАГШ - 3000 Порт<br />
                                ОЮУТАН - 3002 Порт<br />
                                БҮХ ДҮНГҮҮД - "Take-Exam-Service"-ээс татаж авч байна.
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
