/**
 * `ai-exam` — шинжлүүлэх оролтын paste (`AiExamAnalyzePromptField`).
 * `components/exam` (MathAssistField)-аас тусдаа.
 * Word/PDF/вэбээс paste хийхэд гардаг тэмдгүүдийг энгийн текст болгоно; LaTeX `\`, `$`, `{` хэвээр.
 */
export function normalizeAiExamPromptPaste(raw: string): string {
  if (!raw) return raw;

  return (
    raw
      .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\u2013|\u2014|\u2212/g, "-")
      .replace(/[\u2018\u2019\u2032]/g, "'")
      .replace(/[\u201c\u201d\u2033]/g, '"')
      .replace(/\u2026/g, "...")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
  );
}
