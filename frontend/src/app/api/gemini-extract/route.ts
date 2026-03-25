import mammoth from "mammoth";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ExtractRequest = {
  attachments?: Array<{
    data?: string;
    mimeType?: string;
    name?: string;
    text?: string;
  }>;
};
type ExtractedExamPayload = {
  title?: string;
  questions?: Array<{
    answerLatex?: string;
    correctOption?: number | null;
    imageAlt?: string;
    options?: string[];
    points?: number;
    prompt?: string;
    responseGuide?: string;
    sourceImageName?: string;
    type?: "mcq" | "math";
  }>;
};

function cleanJsonBlock(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  return trimmed;
}

type AttachmentPayload = {
  data?: string;
  mimeType?: string;
  name?: string;
  text?: string;
};

type TextAttachment = {
  mimeType: string;
  name: string;
  text: string;
};

type BinaryAttachment = {
  data: string;
  mimeType: string;
  name: string;
};

type DocxArtifacts = {
  embeddedImages: BinaryAttachment[];
  mathHints: string[];
  text: string;
};

function isMarkdownLikeTextFile(name?: string) {
  return Boolean(name?.match(/\.(md|markdown|txt|csv|json)$/i));
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  if (mimeType === "image/gif") {
    return "gif";
  }

  if (mimeType === "image/bmp") {
    return "bmp";
  }

  if (mimeType === "image/svg+xml") {
    return "svg";
  }

  return "bin";
}

function buildEmbeddedImageName(docxName: string, index: number, mimeType: string) {
  const safeName = docxName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `${safeName}_embedded_${index + 1}.${extensionFromMimeType(mimeType)}`;
}

function detectPotentialMathGaps(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (/[._]{3,}/.test(line)) {
        return true;
      }

      if (/[=+\-*/^]$/.test(line)) {
        return true;
      }

      if (/^[A-D]\.\s*$/.test(line)) {
        return true;
      }

      if (/[xyabc]\s*[=<>+\-*/^]/i.test(line) && !/\d/.test(line)) {
        return true;
      }

      return false;
    })
    .slice(0, 20);
}

async function extractDocxArtifacts(
  attachment: AttachmentPayload,
): Promise<DocxArtifacts> {
  const data = attachment.data ?? "";

  if (!data) {
    return {
      embeddedImages: [],
      mathHints: [],
      text: "",
    };
  }

  const buffer = Buffer.from(data, "base64");
  const rawTextResult = await mammoth.extractRawText({ buffer });
  const embeddedImages: BinaryAttachment[] = [];

  await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read("base64");
        const mimeType = image.contentType || "application/octet-stream";

        embeddedImages.push({
          data: base64,
          mimeType,
          name: buildEmbeddedImageName(
            attachment.name ?? "docx",
            embeddedImages.length,
            mimeType,
          ),
        });

        return { src: "" };
      }),
    },
  );

  const text = rawTextResult.value.trim();

  return {
    embeddedImages,
    mathHints: detectPotentialMathGaps(text),
    text,
  };
}

function decodeBase64Text(data: string) {
  return Buffer.from(data, "base64").toString("utf-8").trim();
}

async function uploadGeminiFile({
  apiKey,
  data,
  mimeType,
  name,
}: {
  apiKey: string;
  data: string;
  mimeType: string;
  name: string;
}) {
  const fileBytes = Buffer.from(data, "base64");
  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      body: JSON.stringify({
        file: {
          display_name: name,
        },
      }),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(fileBytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "X-Goog-Upload-Protocol": "resumable",
      },
      method: "POST",
    },
  );

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");

  if (!startResponse.ok || !uploadUrl) {
    throw new Error(`${name} файлыг Gemini рүү upload хийж чадсангүй.`);
  }

  const uploadResponse = await fetch(uploadUrl, {
    body: fileBytes,
    headers: {
      "Content-Length": String(fileBytes.byteLength),
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
    },
    method: "POST",
  });

  const uploadPayload = (await uploadResponse.json()) as {
    file?: {
      mimeType?: string;
      uri?: string;
    };
  };

  if (!uploadResponse.ok || !uploadPayload.file?.uri) {
    throw new Error(`${name} файлыг finalize хийж чадсангүй.`);
  }

  return {
    mimeType: uploadPayload.file.mimeType ?? mimeType,
    name,
    uri: uploadPayload.file.uri,
  };
}

async function normalizeAttachments(attachments: AttachmentPayload[]) {
  const textAttachments: TextAttachment[] = [];
  const binaryAttachments: BinaryAttachment[] = [];
  const docxContexts: Array<{
    embeddedImageNames: string[];
    mathHints: string[];
    name: string;
  }> = [];

  for (const attachment of attachments) {
    const mimeType = attachment.mimeType ?? "application/octet-stream";
    const name = attachment.name ?? "attachment";
    const text = attachment.text?.trim();
    const data = attachment.data?.trim();

    if (mimeType === DOCX_MIME_TYPE) {
      const artifacts = await extractDocxArtifacts(attachment);

      if (artifacts.text) {
        textAttachments.push({
          mimeType: "text/plain",
          name,
          text: artifacts.text,
        });
      }

      binaryAttachments.push(...artifacts.embeddedImages);
      docxContexts.push({
        embeddedImageNames: artifacts.embeddedImages.map((image) => image.name),
        mathHints: artifacts.mathHints,
        name,
      });

      continue;
    }

    if (text) {
      textAttachments.push({
        mimeType: mimeType.startsWith("text/") ? mimeType : "text/plain",
        name,
        text,
      });
      continue;
    }

    if (
      data &&
      (mimeType.startsWith("text/") || isMarkdownLikeTextFile(name))
    ) {
      const decodedText = decodeBase64Text(data);

      if (decodedText) {
        textAttachments.push({
          mimeType: "text/plain",
          name,
          text: decodedText,
        });
      }

      continue;
    }

    if (data) {
      binaryAttachments.push({
        data,
        mimeType,
        name,
      });
    }
  }

  return {
    binaryAttachments,
    docxContexts,
    textAttachments,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractRequest;
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (attachments.length === 0) {
      return Response.json(
        { error: "Унших файл хавсаргаагүй байна." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY тохируулаагүй байна." },
        { status: 500 },
      );
    }

    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const { binaryAttachments, docxContexts, textAttachments } =
      await normalizeAttachments(attachments);
    const uploadedFiles = await Promise.all(
      binaryAttachments.map((attachment) =>
        uploadGeminiFile({
          apiKey,
          data: attachment.data ?? "",
          mimeType: attachment.mimeType ?? "application/octet-stream",
          name: attachment.name ?? "attachment",
        }),
      ),
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
Хавсаргасан материал доторх шалгалтын асуултуудыг шууд таньж JSON болгон буцаа.

Дүрэм:
- Зөвхөн JSON буцаа. Тайлбар, markdown, code fence бүү нэм.
- Асуулт бүрийг дарааллаар нь Q1, Q2 гэж таньж ав.
- Prompt талбарт боломжтой бол асуултын дугаарыг хадгал. Жишээ: "Q1. ..."
- Текстийг бүү хураангуйл. Тоо, томьёо, илэрхийлэл, бутархай, зэргийг яг байгаа хэлбэрээр нь хадгал.
- Хариултын түлхүүр, зөв сонголт, бодлогын зөв хариу байвал заавал гаргаж ав.
- Сонголтууд доторх тоо, тэмдэг, нэгж, томьёог алдалгүй буцаа.
- Сонгох асуултыг "mcq", задгай/бодлогын асуултыг "math" гэж тэмдэглэ.
- DOCX raw text дутуу байж болох тул embedded images болон standalone images-ийг заавал давхар шалгаж missing formula, diagram, graph, table, equation-ийг нөхөн сэргээ.
- Хэрэв материал дотор зураг байвал түүнийг уншаад тухайн асуултын prompt дотор утгыг нь шингээ.
- Хэрэв зураг нь тухайн асуултад чухал бол imageAlt талбарт богино тайлбар өг.
- Хэрэв тусдаа image file-аас ирсэн зураг ашигласан бол sourceImageName талбарт файлын нэрийг яг оноо.
- DOCX доторх embedded image ашигласан бол sourceImageName талбарт embedded image-ийн файлын нэрийг яг оноо.
- Хэрэв raw text мөр эвдэрсэн, томьёо тасарсан, сонголт дутуу, эсвэл математикийн мөр incomplete байвал image болон context-оос сэргээн бүрэн болго.
- Материал доторх асуултын эх бичвэрийг аль болох хадгал.
- mcq асуулт бол A/B/C/D дарааллыг зөв таньж options болон correctOption-ийг гарга.
- math асуулт бол answerLatex-ийг аль болох LaTeX хэлбэрээр гарга.
- responseGuide боломжтой бол богино заавар өг.
- title-д баримтын эсвэл шалгалтын нэрийг өг.

JSON бүтэц:
{
  "title": "string",
  "questions": [
    {
      "type": "mcq",
      "prompt": "string",
      "points": 2,
      "imageAlt": "string",
      "sourceImageName": "string",
      "options": ["string", "string", "string", "string"],
      "correctOption": 1
    },
    {
      "type": "math",
      "prompt": "string",
      "points": 4,
      "imageAlt": "string",
      "sourceImageName": "string",
      "responseGuide": "string",
      "answerLatex": "string"
    }
  ]
}
                  `.trim(),
                },
                ...textAttachments.map((attachment) => ({
                  text: `Хавсаргасан текст (${attachment.name ?? "text"}):\n${attachment.text}`,
                })),
                ...docxContexts.map((context) => ({
                  text: `DOCX reconstruction hints (${context.name}):\nPotentially broken math lines:\n${context.mathHints.join("\n") || "none"}\nEmbedded image names:\n${context.embeddedImageNames.join("\n") || "none"}`,
                })),
                {
                  text: `Тусдаа binary файл нэрс: ${uploadedFiles
                    .map((file) => file.name)
                    .join(", ")}`,
                },
                ...uploadedFiles.map((file) => ({
                  file_data: {
                    file_uri: file.uri,
                    mime_type: file.mimeType,
                  },
                })),
              ],
              role: "user",
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    if (!response.ok) {
      return Response.json(
        {
          error:
            payload.error?.message ??
            "Материалыг Gemini-аар унших үед алдаа гарлаа.",
        },
        { status: response.status },
      );
    }

    const extractedText = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim();

    if (!extractedText) {
      return Response.json(
        { error: "Материалаас уншигдах агуулга олдсонгүй." },
        { status: 502 },
      );
    }

    const exam = JSON.parse(cleanJsonBlock(extractedText)) as ExtractedExamPayload;

    if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
      return Response.json(
        { error: "Файлаас танигдсан асуулт олдсонгүй." },
        { status: 502 },
      );
    }

    return Response.json({ exam });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Материалыг унших үед алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
