import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveBackendTarget() {
  const configured = String(process.env.VITE_BACKEND_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  const portFilePath = path.resolve(__dirname, "..", ".backend-port");
  try {
    if (fs.existsSync(portFilePath)) {
      const raw = String(fs.readFileSync(portFilePath, "utf8") || "").trim();
      const port = Number(raw);
      if (Number.isFinite(port) && port > 0) {
        return `http://127.0.0.1:${Math.trunc(port)}`;
      }
    }
  } catch {
    // ignore
  }

  return "http://127.0.0.1:4000";
}

const backendTarget = resolveBackendTarget();

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/health": backendTarget,
      "/api": backendTarget,
    },
  },
});
