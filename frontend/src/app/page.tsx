import Link from "next/link";
import MathExam from "@/components/exam/math-exam";

export default function Home() {
  return (
    <div className="relative">
      <div className="pointer-events-none fixed right-4 top-4 z-40">
        <Link
          href="/book"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-sky-300 bg-white/95 px-4 py-2 text-sm font-semibold text-sky-700 shadow-[0_8px_24px_rgba(2,132,199,0.2)] transition hover:border-sky-500 hover:text-sky-900"
        >
          Book Section
        </Link>
      </div>
      <MathExam />
    </div>
  );
}
