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
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  MONGODB_URI: z.string().optional(),
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional()
}).superRefine((value,ctx)=>{
  if(value.SUPABASE_URL&&value.VITE_SUPABASE_URL&&value.SUPABASE_URL!==value.VITE_SUPABASE_URL)
    ctx.addIssue({code:z.ZodIssueCode.custom,path:["VITE_SUPABASE_URL"],message:"Frontend and backend Supabase URLs must match"});
  if(value.NODE_ENV!=="production") return;
  if (!value.MONGODB_URI && (!value.SUPABASE_URL || !value.DATABASE_URL)) {
    ctx.addIssue({code:z.ZodIssueCode.custom,path:["MONGODB_URI"],message:"Either MONGODB_URI or Supabase database credentials must be provided"});
  }
});
export const env = envSchema.parse(process.env);
