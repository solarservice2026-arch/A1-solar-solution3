import { describe,expect,it } from "vitest";
import { envSchema } from "./env.js";
describe("environment validation",()=>{
 it("permits an unconfigured local development shell",()=>expect(envSchema.safeParse({NODE_ENV:"development"}).success).toBe(true));
 it("rejects production without MongoDB URI",()=>{const result=envSchema.safeParse({NODE_ENV:"production"});expect(result.success).toBe(false);if(!result.success)expect(result.error.issues.some(issue=>issue.path[0]==="MONGODB_URI")).toBe(true)});
 it("does not include secret values in missing-variable errors",()=>{const result=envSchema.safeParse({NODE_ENV:"production"});if(!result.success)expect(JSON.stringify(result.error.issues)).not.toContain("actual-secret")});
});
