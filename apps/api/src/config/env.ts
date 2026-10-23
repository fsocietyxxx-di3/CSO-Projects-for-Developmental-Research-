import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required — Supabase Postgres connection string"),

  SUPABASE_URL: z
    .string()
    .url("SUPABASE_URL must be your project URL, e.g. https://<ref>.supabase.co"),

  SUPABASE_JWKS_URL: z.string().url().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  DEV_BYPASS_AUTH: z
    .string()
    .default("false")
    .transform((v) => v.trim().toLowerCase() === "true"),
});

export const env = envSchema.parse(process.env);

/** Supabase's RS256 signing keys (JSON Web Key Set). */
export const jwksUrl =
  env.SUPABASE_JWKS_URL ?? new URL("/auth/v1/.well-known/jwks.json", env.SUPABASE_URL).toString();

export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
