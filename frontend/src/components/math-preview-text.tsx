"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const KATEX_CSS =
  "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
const KATEX_JS =
  "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";

type KatexRenderer = {
  renderToString: (
    latex: string,
    options?: {
      displayMode?: boolean;
      throwOnError?: boolean;
    },
  ) => string;
};

declare global {
  interface Window {
    katex?: KatexRenderer;
  }
}

type MathPreviewTextProps = {
  className?: string;
  content: string;
  displayMode?: boolean;
  forceMath?: boolean;
};

type TextSegment = {
  content: string;
  type: "text";
};

type MathSegment = {
  content: string;
  displayMode: boolean;
  raw: string;
  type: "math";
};

type Segment = MathSegment | TextSegment;

let katexAssetsPromise: Promise<void> | null = null;

function ensureStyle(id: string, href: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLLinkElement | null;

    if (existing) {
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () =>
      reject(new Error(`Failed to load stylesheet: ${href}`));
    document.head.appendChild(link);
  });
}

function ensureScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      const onLoad = () => {
        existing.dataset.loaded = "true";
        resolve();
      };
      const onError = () => reject(new Error(`Failed to load script: ${src}`));

      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

function ensureKatexAssets() {
  if (!katexAssetsPromise) {
    katexAssetsPromise = (async () => {
      await ensureStyle("math-preview-katex-css", KATEX_CSS);
      await ensureScript("math-preview-katex-js", KATEX_JS);
    })();
  }

  return katexAssetsPromise;
}

function stripOuterMathDelimiters(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
    return trimmed.slice(2, -2).trim();
  }

  if (trimmed.startsWith("$") && trimmed.endsWith("$")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function looksLikeLatexExpression(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (
    trimmed.startsWith("$") ||
    /\\(?:frac|sqrt|times|div|pi|alpha|beta|gamma|theta|sin|cos|tan|cot|log|ln|int|sum|lim|infty|left|right|cdot|pm|mp|leq|geq|neq|approx|circ|operatorname)\b/.test(
      trimmed,
    )
  ) {
    return true;
  }

  return /^[A-Za-z0-9\s=+\-*/^_()[\]{}.,|]+$/.test(trimmed) &&
    /[=^_]/.test(trimmed);
}

function tokenizeLine(
  line: string,
  options: {
    displayMode: boolean;
    forceMath: boolean;
  },
) {
  const normalizedLine = line
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");

  if (!normalizedLine.trim()) {
    return [] as Segment[];
  }

  if (options.forceMath) {
    return [
      {
        content: stripOuterMathDelimiters(normalizedLine),
        displayMode: options.displayMode,
        raw: normalizedLine,
        type: "math",
      },
    ] satisfies Segment[];
  }

  const segments: Segment[] = [];
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let cursor = 0;

  for (const match of normalizedLine.matchAll(pattern)) {
    const matchedText = match[0];
    const matchedIndex = match.index ?? 0;

    if (matchedIndex > cursor) {
      segments.push({
        content: normalizedLine.slice(cursor, matchedIndex),
        type: "text",
      });
    }

    segments.push({
      content: stripOuterMathDelimiters(matchedText),
      displayMode: Boolean(match[1]),
      raw: matchedText,
      type: "math",
    });
    cursor = matchedIndex + matchedText.length;
  }

  if (cursor < normalizedLine.length) {
    segments.push({
      content: normalizedLine.slice(cursor),
      type: "text",
    });
  }

  if (segments.length > 0) {
    return segments;
  }

  if (looksLikeLatexExpression(normalizedLine)) {
    return [
      {
        content: stripOuterMathDelimiters(normalizedLine),
        displayMode: options.displayMode,
        raw: normalizedLine,
        type: "math",
      },
    ] satisfies Segment[];
  }

  return [{ content: normalizedLine, type: "text" }] satisfies Segment[];
}

export default function MathPreviewText({
  className,
  content,
  displayMode = false,
  forceMath = false,
}: MathPreviewTextProps) {
  const [katexReady, setKatexReady] = useState(false);

  useEffect(() => {
    let active = true;

    void ensureKatexAssets()
      .then(() => {
        if (active && window.katex) {
          setKatexReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setKatexReady(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const lines = useMemo(
    () =>
      content.split(/\r?\n/).map((line) =>
        tokenizeLine(line, {
          displayMode,
          forceMath,
        }),
      ),
    [content, displayMode, forceMath],
  );

  return (
    <div
      className={cn(
        "space-y-1 whitespace-pre-wrap [&_.katex-display]:my-1",
        className,
      )}
    >
      {lines.map((segments, lineIndex) => {
        if (segments.length === 0) {
          return <div key={`line-${lineIndex}`} className="h-4" />;
        }

        return (
          <div
            key={`line-${lineIndex}`}
            className={cn(
              "flex flex-wrap items-baseline gap-x-1 gap-y-2",
              forceMath && displayMode && "block",
            )}
          >
            {segments.map((segment, segmentIndex) => {
              if (segment.type === "text") {
                return (
                  <span key={`segment-${lineIndex}-${segmentIndex}`}>
                    {segment.content}
                  </span>
                );
              }

              if (katexReady && window.katex) {
                try {
                  const html = window.katex.renderToString(segment.content, {
                    displayMode: segment.displayMode,
                    throwOnError: false,
                  });

                  const Wrapper = segment.displayMode ? "div" : "span";

                  return (
                    <Wrapper
                      key={`segment-${lineIndex}-${segmentIndex}`}
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  );
                } catch {
                  return (
                    <span key={`segment-${lineIndex}-${segmentIndex}`}>
                      {segment.raw}
                    </span>
                  );
                }
              }

              return (
                <span key={`segment-${lineIndex}-${segmentIndex}`}>
                  {segment.raw}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
