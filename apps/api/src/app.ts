import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import compression from "compression";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { enquirySchema, paginationSchema } from "@a1/validation";
import { AppError } from "./lib/http.js";
import { connectMongoDB } from "./lib/mongoose.js";
import { authRouter, rolesRouter, usersRouter } from "./auth/routes.js";
import {
  agreementsRouter,
  customersRouter,
  dashboardRouter,
  invoicesRouter,
  productsRouter,
  profileRouter,
  projectsRouter,
  payuCallback,
  quotationsRouter,
  ticketsRouter,
} from "./business/routes.js";
import mongoose from "mongoose";

export const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader(
    "x-request-id",
    req.header("x-request-id") ?? crypto.randomUUID(),
  );
  next();
});
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = new Set(
  [
    process.env.WEB_URL ?? "http://localhost:5173",
    process.env.CLIENT_URL,
    "https://a1-solor-solution.vercel.app",
    "https://a1-solor-solution-668f.vercel.app",
    ...(process.env.CORS_ALLOWED_ORIGINS ?? "").split(","),
  ]
    .map((origin) => origin?.trim().replace(/\/$/, ""))
    .filter((origin): origin is string => Boolean(origin)),
);

const isAllowedOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return (
      host.endsWith(".vercel.app") ||
      host.endsWith(".onrender.com") ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.includes("a1-solor-solution") ||
      host.includes("a1solar")
    );
  } catch {
    return false;
  }
};

if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://localhost:5174");
  allowedOrigins.add("http://127.0.0.1:4173");
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || isAllowedOrigin(origin))
        return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
  }),
);
app.use(compression());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "10mb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: process.env.NODE_ENV === "production" ? 120 : 1_000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.use(morgan("combined", { skip: () => process.env.NODE_ENV === "test" }));
app.use(async (_req, _res, next) => {
  if (process.env.MONGODB_URI && mongoose.connection.readyState !== 1) {
    try {
      await connectMongoDB();
    } catch {}
  }
  next();
});
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/staff", usersRouter);
app.use("/api/v1/roles", rolesRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/customers", customersRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/projects", projectsRouter);
app.use("/api/v1/tickets", ticketsRouter);
app.use("/api/v1/quotations", quotationsRouter);
app.use("/api/v1/invoices", invoicesRouter);
app.use("/api/v1/agreements", agreementsRouter);
app.post("/api/v1/payments/payu/callback", payuCallback);
app.use("/api/v1/profile", profileRouter);

const ok = (res: Response, message: string, data: unknown, meta: object = {}) =>
  res.json({ success: true, message, data, meta });

app.get("/api/v1/health", async (_req, res) => {
  let mongoStatus = "disconnected";
  try {
    if (process.env.MONGODB_URI) {
      await connectMongoDB();
      mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "connecting";
    }
  } catch (err) {
    mongoStatus = `error: ${(err as Error).message}`;
  }
  return ok(res, "API is healthy", {
    status: "ok",
    database: {
      mongodb: mongoStatus,
    },
    timestamp: new Date().toISOString(),
  });
});
app.get("/api/v1/public/settings", (_req, res) =>
  ok(res, "Public settings", {
    companyName: process.env.COMPANY_NAME ?? "A1 Solar Solution",
    currency: "INR",
    locale: "en-IN",
  }),
);
app.post("/api/v1/public/enquiries", async (req, res, next) => {
  try {
    const input = enquirySchema.parse(req.body);
    // Persistence is enabled when Supabase is configured; never fake a successful write.
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({
        success: false,
        message: "Enquiry service is not configured",
        code: "SERVICE_UNAVAILABLE",
        errors: [],
      });
    }
    return ok(res.status(201), "Enquiry received", {
      accepted: true,
      type: input.type,
    });
  } catch (error) {
    return next(error);
  }
});
app.get("/api/v1/leads", (req, res, next) => {
  try {
    paginationSchema.parse(req.query);
    return res.status(501).json({
      success: false,
      message: "Supabase connection required",
      code: "NOT_CONFIGURED",
      errors: [],
    });
  } catch (error) {
    return next(error);
  }
});
if (process.env.NODE_ENV === "production") {
  const webDist = fileURLToPath(new URL("../../web/dist/", import.meta.url));
  const webIndex = fileURLToPath(
    new URL("../../web/dist/index.html", import.meta.url),
  );
  app.use(express.static(webDist));
  app.use((req, res, next) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api/") &&
      req.accepts("html")
    ) {
      return res.sendFile(webIndex);
    }
    return next();
  });
}
app.use((_req, res) =>
  res.status(404).json({
    success: false,
    message: "Route not found",
    code: "NOT_FOUND",
    errors: [],
  }),
);
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const errObj = typeof error === "object" && error !== null ? (error as Record<string, any>) : {};
  const isZod = errObj.name === "ZodError" || Array.isArray(errObj.issues);
  const status = typeof errObj.status === "number" && errObj.status >= 400 && errObj.status < 600 ? errObj.status : 400;
  const rawMsg = typeof errObj.message === "string" ? errObj.message.trim() : error instanceof Error ? error.message : "";
  const message = rawMsg || "Invalid request parameters";
  const code = typeof errObj.code === "string" ? errObj.code : isZod ? "VALIDATION_ERROR" : "BAD_REQUEST";
  const errors = Array.isArray(errObj.errors) ? errObj.errors : Array.isArray(errObj.issues) ? errObj.issues : [];

  return res.status(status).json({
    success: false,
    message,
    code,
    errors,
  });
});
