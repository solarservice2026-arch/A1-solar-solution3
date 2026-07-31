import type { NextFunction, Request, Response } from "express";
import type { AppRole } from "@a1/validation";
import { AppError } from "../lib/http.js";
import { MongoAuthProvider } from "./provider.js";
import type { AuthProvider } from "./types.js";

let provider: AuthProvider = new MongoAuthProvider();
export const setAuthProvider = (next: AuthProvider) => { provider = next; };
export const resetAuthProvider = () => { provider = new MongoAuthProvider(); };
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header=req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next(new AppError(401,"Authentication required","UNAUTHORIZED"));
  const context=await provider.resolve(header.slice(7));
  if (!context) return next(new AppError(401,"Session is invalid or expired","INVALID_SESSION"));
  if (!context.active) return next(new AppError(403,"Account is disabled","ACCOUNT_DISABLED"));
  req.auth=context; return next();
}
export const requireRole = (...roles: AppRole[]) => (req:Request,_res:Response,next:NextFunction) =>
  req.auth?.roles.includes("super_admin") || req.auth?.roles.includes("admin") || roles.some((role)=>req.auth?.roles.includes(role)) ? next() : next(new AppError(403,"Role is not authorized","FORBIDDEN"));
export const requirePermission = (permission:string) => (req:Request,_res:Response,next:NextFunction) =>
  req.auth?.roles.includes("super_admin") || req.auth?.roles.includes("admin") || req.auth?.permissions.includes(permission) ? next() : next(new AppError(403,"Permission denied","FORBIDDEN"));
export const requireAnyPermission = (...permissions:string[]) => (req:Request,_res:Response,next:NextFunction) =>
  req.auth?.roles.includes("super_admin") || req.auth?.roles.includes("admin") || permissions.some((key)=>req.auth?.permissions.includes(key)) ? next() : next(new AppError(403,"Permission denied","FORBIDDEN"));
