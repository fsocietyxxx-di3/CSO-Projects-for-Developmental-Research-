import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { corsOrigins } from "./config/env.js";
import routes from "./routes/index.js";
export function createApp() {
  const app = express();

  // Render/Vercel sit behind a proxy — needed to trust X-Forwarded-* headers.
  app.set("trust proxy", 1);

  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin: corsOrigins.includes("*") ? true : corsOrigins,
      credentials: false,
    }),
  );

  app.use("/api/v1", routes);

  // 404 for unknown /api/v1 routes
  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
  });

  // Error boundary — Zod failures become 400s, everything else a logged 500.
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    if (res.headersSent) return next(err);
    console.error(`[api] unhandled error on ${req.method} ${req.originalUrl}:`, err);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
