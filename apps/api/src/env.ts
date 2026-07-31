import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
if (process.env.NODE_ENV !== "production") {
  config({
    path: fileURLToPath(new URL("../../../.env", import.meta.url)),
    quiet: true,
    override: false,
  });
}
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  WEB_URL: z.string().url().default("http://localhost:5173"),
  CLIENT_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  JWT_SECRET: z.string().default("a1-solar-secret-key-2026-safe"),
}).superRefine((value,ctx)=>{
  if(value.NODE_ENV==="production" && !value.MONGODB_URI) {
    ctx.addIssue({code:z.ZodIssueCode.custom,path:["MONGODB_URI"],message:"MONGODB_URI must be provided in production"});
  }
});
export const env = envSchema.parse(process.env);
