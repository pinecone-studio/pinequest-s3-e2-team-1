const dotenv = require("dotenv");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { getBookStoreBackend, initBookStore } = require("./lib/book-store");
const { booksRouter } = require("./routes/books");

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
  override: true,
});

const app = express();
const desiredPort = Number(process.env.PORT || 4000);
const host = process.env.HOST || "127.0.0.1";
const DEFAULT_PROVIDER = "auto";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:0.5b";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

const rawCorsOrigin = String(process.env.CORS_ORIGIN || "").trim();
let corsOrigin = true;

if (rawCorsOrigin && rawCorsOrigin !== "*" && rawCorsOrigin.toLowerCase() !== "true") {
  const allowList = rawCorsOrigin
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  corsOrigin = (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowList.includes(origin)) return callback(null, true);

    // Local dev convenience: allow any localhost port to avoid "CORS" confusion
    // when running the UI on a different port (Vite dev/preview, Next.js, etc.).
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`));
  };
}

app.use(
  cors({
    origin: corsOrigin,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Book Question Backend</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.5; color: #0f172a; }
      code { background: #f1f5f9; padding: 0.15rem 0.35rem; border-radius: 0.25rem; }
    </style>
  </head>
  <body>
    <h1>Book Question Backend ажиллаж байна</h1>
    <p>Health: <a href="/health"><code>/health</code></a></p>
    <p>API base: <code>/api/books</code></p>
  </body>
</html>`);
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(204).end();
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get("/health", (_req, res) => {
  const providerRequested = String(process.env.LLM_PROVIDER || DEFAULT_PROVIDER)
    .trim()
    .toLowerCase();
  const hasGeminiKey = Boolean(String(process.env.GEMINI_API_KEY || "").trim());
  const providerUsed =
    providerRequested === "gemini" || providerRequested === "ollama"
      ? providerRequested
      : hasGeminiKey
        ? "gemini"
        : "ollama";
  const model =
    providerUsed === "gemini"
      ? process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
      : process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;

  res.json({
    ok: true,
    service: "book-question-backend",
    bookStoreBackend: getBookStoreBackend(),
    providerRequested,
    providerUsed,
    model,
  });
});

app.use("/api/books", booksRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Endpoint олдсонгүй." });
});

const reactDistPath = path.join(__dirname, "..", "frontend-react", "dist");
const reactIndexPath = path.join(reactDistPath, "index.html");
app.use("/app", express.static(reactDistPath));
app.get("/app/*", (_req, res) => {
  if (fs.existsSync(reactIndexPath)) {
    return res.sendFile(reactIndexPath);
  }

  return res.status(404).type("text").send(
    [
      "React frontend build олдсонгүй.",
      "Дараах командыг ажиллуулаад дахин оролдоно уу:",
      "",
      "  cd backend",
      "  npm run frontend:build",
      "",
      "эсвэл dev mode:",
      "",
      "  cd backend",
      "  npm run frontend:dev",
    ].join("\n"),
  );
});

app.use((error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Server error";
  const statusCode =
    error && typeof error === "object" && typeof error.status === "number"
      ? error.status
      : 500;

  res.status(statusCode).json({
    error: message,
  });
});

function startListening({ basePort, host: listenHost, maxTries = 20 }) {
  const startPort = Number.isFinite(basePort) && basePort > 0 ? Math.trunc(basePort) : 4000;
  let port = startPort;

  const portFilePath = path.join(__dirname, "..", ".backend-port");
  const persistRuntimePort = (value) => {
    try {
      fs.writeFileSync(portFilePath, `${value}\n`, "utf8");
    } catch {
      // ignore
    }
  };

  const tryListen = () => {
    const server = app.listen(port, listenHost, () => {
      // eslint-disable-next-line no-console
      console.log(`Book backend listening on http://${listenHost}:${port}`);
      persistRuntimePort(port);
      if (port !== startPort) {
        // eslint-disable-next-line no-console
        console.warn(
          `PORT ${startPort} ашиглах боломжгүй байсан тул ${port} port дээр асаалаа. ` +
            "Frontend proxy/URL тохиргоогоо шалгана уу.",
        );
      }
    });

    server.on("error", (error) => {
      if (!error || typeof error !== "object") {
        throw error;
      }

      const code = error.code || "";
      const canRetry = code === "EADDRINUSE" || code === "EACCES" || code === "EPERM";
      if (!canRetry) {
        throw error;
      }

      try {
        server.close();
      } catch {
        // ignore
      }

      if (port - startPort + 1 >= maxTries) {
        if (code === "EPERM") {
          // eslint-disable-next-line no-console
          console.warn(
            `Listen permission error (EPERM) on ${listenHost}:${port}. ` +
              "If you are running inside a restricted sandbox, run the backend outside of it " +
              "or change PORT/HOST.",
          );
        }
        throw error;
      }

      port += 1;
      tryListen();
    });
  };

  tryListen();
}

async function bootstrap() {
  await initBookStore();
  // eslint-disable-next-line no-console
  console.log(`Book store backend: ${getBookStoreBackend()}`);
  startListening({ basePort: desiredPort, host, maxTries: 20 });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(
    "Failed to initialize backend:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
