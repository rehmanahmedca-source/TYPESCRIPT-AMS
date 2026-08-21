import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { api } from "./routes.ts";
import { xeroxApi } from "./xerox.ts";
import { attachAuth, authApi, enforcePermission, requireAuth } from "./auth.ts";
import "./db.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(cookieParser());
app.use(express.json({ limit: "256mb" }));
app.use(express.urlencoded({ extended: true, limit: "256mb" }));

// AMS99 is a same-origin, cookie-authenticated application. Never reflect an
// arbitrary Origin while credentials are enabled.
app.use(attachAuth);
app.use("/api/auth", authApi);
app.use("/api", requireAuth, enforcePermission, xeroxApi);
app.use("/api", requireAuth, enforcePermission, api);

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "AMS ERP", runtime: "typescript" });
});

async function start() {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && fs.existsSync(path.join(root, "dist", "index.html"))) {
    app.use(express.static(path.join(root, "dist")));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(root, "dist", "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root,
      server: {
        middlewareMode: true,
        host: "0.0.0.0",
        allowedHosts: true,
        hmr: { server: undefined }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AMS ERP (TypeScript) running at http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
