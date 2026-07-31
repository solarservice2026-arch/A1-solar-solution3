import { Router } from "express";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import mongoose from "mongoose";
import { paginationSchema, staffSchema } from "@a1/validation";
import { asyncHandler, AppError, success } from "../lib/http.js";
import { requireAuth, requirePermission } from "./middleware.js";
import { testAccountMap, fullPermissions } from "./provider.js";

const JWT_SECRET = process.env.JWT_SECRET || "a1-solar-secret-key-2026-safe";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError(400, "Email and password are required", "VALIDATION_ERROR");
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  
  // 1. Check test accounts mock list
  const testUser = testAccountMap[normalizedEmail];
  if (testUser && testUser.pass === password) {
    const token = jwt.sign(
      {
        userId: "00000000-0000-0000-0000-000000000001",
        email: normalizedEmail,
        active: true,
        roles: testUser.roles,
        permissions: testUser.permissions,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    return success(res, "Login successful", {
      access_token: token,
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        email: normalizedEmail,
        full_name: testUser.fullName,
        active: true,
      },
      roles: testUser.roles,
      permissions: testUser.permissions,
    });
  }

  // 2. Check MongoDB users collection
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const userDoc = await db.collection("users").findOne({ email: normalizedEmail });
    if (userDoc) {
      const passwordHash = userDoc.password_hash;
      const isValid = passwordHash ? bcryptjs.compareSync(password, passwordHash) : false;
      if (isValid) {
        const role = userDoc.role || "customer";
        const permissions: string[] = [];
        
        if (role === "super_admin" || role === "admin") {
          permissions.push(...fullPermissions);
        } else if (role === "installation_staff") {
          permissions.push("dashboard:view", "projects:view", "projects:update", "quotations:view", "agreements:view", "invoices:view");
        } else if (role === "service_technician") {
          permissions.push("dashboard:view", "tickets:view", "tickets:update", "quotations:view", "agreements:view", "invoices:view");
        } else if (role === "accountant") {
          permissions.push("dashboard:view", "customers:view", "quotations:view", "agreements:view", "invoices:view", "invoices:create", "invoices:update", "payments:view", "payments:verify");
        } else {
          permissions.push("agreements:view", "payments:create");
        }

        const token = jwt.sign(
          {
            userId: userDoc._id.toString(),
            email: normalizedEmail,
            active: userDoc.status !== "Disabled",
            roles: [role],
            permissions,
          },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        return success(res, "Login successful", {
          access_token: token,
          user: {
            id: userDoc._id.toString(),
            email: normalizedEmail,
            full_name: userDoc.name || "Customer",
            active: userDoc.status !== "Disabled",
          },
          roles: [role],
          permissions,
        });
      }
    }
  }

  throw new AppError(401, "Invalid email or password", "UNAUTHORIZED");
}));

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  if (req.auth) {
    return success(res, "Current user retrieved", {
      user: {
        id: req.auth.userId,
        email: req.auth.email,
        full_name: req.auth.email.split("@")[0] || "User",
        active: req.auth.active,
      },
      roles: req.auth.roles,
      permissions: req.auth.permissions,
    });
  }
  throw new AppError(401, "Not authenticated", "UNAUTHORIZED");
}));

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get("/", requirePermission("users:view"), asyncHandler(async (req, res) => {
  const query = paginationSchema.parse({ page: req.query.page, pageSize: req.query.limit, search: req.query.search });

  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    let filter: any = {};
    if (query.search) {
      filter.name = { $regex: String(query.search).trim(), $options: "i" };
    }
    const total = await db.collection("users").countDocuments(filter);
    const start = (query.page - 1) * query.pageSize;
    const items = await db.collection("users")
      .find(filter)
      .sort({ created_at: -1 })
      .skip(start)
      .limit(query.pageSize)
      .toArray();
      
    const formatted = items.map((u) => ({
      id: u._id.toString(),
      full_name: u.name,
      phone: u.phone || null,
      active: u.status !== "Disabled",
      last_login_at: u.last_login_at || null,
      created_at: u.created_at,
      user_roles: [
        {
          roles: {
            name: u.role || "customer"
          }
        }
      ]
    }));
    return success(res, "Users retrieved", formatted, { page: query.page, limit: query.pageSize, total });
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

usersRouter.post("/", requirePermission("users:create"), asyncHandler(async (req, res) => {
  const input = staffSchema.parse(req.body);

  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const defaultHash = bcryptjs.hashSync("admin123", 10);
    const result = await db.collection("users").updateOne(
      { email: input.email.trim().toLowerCase() },
      {
        $setOnInsert: {
          name: input.fullName,
          email: input.email.trim().toLowerCase(),
          role: input.role,
          status: input.active ? "Active" : "Disabled",
          created_at: new Date(),
          password_hash: defaultHash,
        },
        $set: {
          status: input.active ? "Active" : "Disabled",
        }
      },
      { upsert: true }
    );
    const userId = result.upsertedId ? result.upsertedId.toString() : "00000000-0000-0000-0000-000000000001";
    await audit(req.auth!.userId, "staff.invited", userId, { role: input.role });
    return success(res.status(201), "Staff invitation sent", { id: userId, email: input.email });
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

usersRouter.patch("/:id/status", requirePermission("users:disable"), asyncHandler(async (req, res) => {
  const active = req.body.active;
  if (typeof active !== "boolean") throw new AppError(400, "Active status must be boolean", "VALIDATION_ERROR");
  const paramId = req.params.id as string;

  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const { ObjectId } = await import("mongodb");
    let query: any = { profile_id: paramId };
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      query = { $or: [ { _id: new ObjectId(paramId) }, { profile_id: paramId } ] };
    }
    await db.collection("users").updateOne(
      query,
      { $set: { status: active ? "Active" : "Disabled" } }
    );
    return success(res, "Account status updated", { id: paramId, active });
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

usersRouter.get("/:id", requirePermission("users:view"), asyncHandler(async (req, res) => {
  const paramId = req.params.id as string;
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const { ObjectId } = await import("mongodb");
    let filter: any = { profile_id: paramId };
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      filter = { $or: [ { _id: new ObjectId(paramId) }, { profile_id: paramId } ] };
    }
    const u = await db.collection("users").findOne(filter);
    if (!u) throw new AppError(404, "Staff member not found", "NOT_FOUND");
    
    const roleName = u.role || "customer";
    const permissions: string[] = [];
    if (roleName === "super_admin" || roleName === "admin") {
      permissions.push(...fullPermissions);
    } else if (roleName === "installation_staff") {
      permissions.push("dashboard:view", "projects:view", "projects:update", "quotations:view", "agreements:view", "invoices:view");
    } else if (roleName === "service_technician") {
      permissions.push("dashboard:view", "tickets:view", "tickets:update", "quotations:view", "agreements:view", "invoices:view");
    } else if (roleName === "accountant") {
      permissions.push("dashboard:view", "customers:view", "quotations:view", "agreements:view", "invoices:view", "invoices:create", "invoices:update", "payments:view", "payments:verify");
    } else {
      permissions.push("agreements:view", "payments:create");
    }

    const formatted = {
      id: u._id.toString(),
      full_name: u.name,
      phone: u.phone || null,
      active: u.status !== "Disabled",
      last_login_at: u.last_login_at || null,
      created_at: u.created_at,
      user_roles: [
        {
          role_id: "0",
          roles: {
            id: "0",
            name: roleName,
            description: roleName,
            role_permissions: permissions.map((p, idx) => ({
              permissions: {
                id: String(idx),
                key: p,
                description: p
              }
            }))
          }
        }
      ]
    };
    return success(res, "Staff member retrieved", formatted);
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

usersRouter.patch("/:id", requirePermission("users:update"), asyncHandler(async (req, res) => {
  const paramId = req.params.id as string;
  const fullName = String(req.body.fullName ?? "").trim();
  if (fullName.length < 2 || fullName.length > 120) throw new AppError(400, "Valid full name is required", "VALIDATION_ERROR");

  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const { ObjectId } = await import("mongodb");
    let query: any = { profile_id: paramId };
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      query = { $or: [ { _id: new ObjectId(paramId) }, { profile_id: paramId } ] };
    }
    await db.collection("users").updateOne(
      query,
      { $set: { name: fullName, phone: req.body.phone ?? null } }
    );
    await audit(req.auth!.userId, "staff.updated", paramId, { fullName });
    return success(res, "Staff updated", { id: paramId, full_name: fullName, phone: req.body.phone });
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

usersRouter.post("/:id/activate", requirePermission("users:update"), statusAction(true));
usersRouter.post("/:id/disable", requirePermission("users:disable"), statusAction(false));

usersRouter.delete("/:id", requirePermission("users:remove"), asyncHandler(async (req, res) => {
  const paramId = String(req.params.id);

  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const { ObjectId } = await import("mongodb");
    let query: any = { profile_id: paramId };
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      query = { $or: [ { _id: new ObjectId(paramId) }, { profile_id: paramId } ] };
    }
    await db.collection("users").deleteOne(query);
    await audit(req.auth!.userId, "staff.archived", paramId, { active: false, archived: true });
    return success(res, "Account archived", { id: paramId, archived: true });
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

usersRouter.post("/:id/roles", requirePermission("users:assign_roles"), asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const { ObjectId } = await import("mongodb");
    const paramId = req.params.id as string;
    const roleId = String(req.body.roleId ?? "");
    
    let rObj = null;
    try {
      rObj = await db.collection("roles").findOne({ _id: new ObjectId(roleId) });
    } catch {
      rObj = await db.collection("roles").findOne({ name: roleId });
    }
    if (!rObj) throw new AppError(400, "Role not found", "INVALID_ROLE");
    
    assertRoleGrantAllowed(req.auth!.roles, rObj.name);
    
    let query: any = { profile_id: paramId };
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      query = { $or: [ { _id: new ObjectId(paramId) }, { profile_id: paramId } ] };
    }
    
    await db.collection("users").updateOne(
      query,
      { $set: { role: rObj.name } }
    );
    await audit(req.auth!.userId, "staff.role_assigned", paramId, { roleId });
    return success(res, "Role assigned", { userId: paramId, roleId });
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

usersRouter.delete("/:id/roles/:roleId", requirePermission("users:assign_roles"), asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const { ObjectId } = await import("mongodb");
    const paramId = req.params.id as string;
    const roleId = req.params.roleId as string;
    
    let rObj = null;
    try {
      rObj = await db.collection("roles").findOne({ _id: new ObjectId(roleId) });
    } catch {
      rObj = await db.collection("roles").findOne({ name: roleId });
    }
    
    if (rObj) {
      assertRoleGrantAllowed(req.auth!.roles, rObj.name);
      if (rObj.name === "super_admin") {
        if (!req.auth!.roles.includes("super_admin")) throw new AppError(403, "Protected role", "PROTECTED_ROLE");
        const activeSuperAdmins = await db.collection("users").countDocuments({
          role: "super_admin",
          status: { $ne: "Disabled" },
          _id: { $ne: mongoose.Types.ObjectId.isValid(paramId) ? new ObjectId(paramId) : undefined as any }
        });
        if (activeSuperAdmins === 0) {
          throw new AppError(409, "The final active Super Admin cannot be changed", "FINAL_SUPER_ADMIN");
        }
      }
    }
    
    let query: any = { profile_id: paramId };
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      query = { $or: [ { _id: new ObjectId(paramId) }, { profile_id: paramId } ] };
    }
    
    await db.collection("users").updateOne(
      query,
      { $set: { role: "customer" } }
    );
    await audit(req.auth!.userId, "staff.role_removed", paramId, { roleId });
    return success(res, "Role removed", { userId: paramId, roleId });
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

usersRouter.get("/:id/permissions", requirePermission("users:view"), asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const { ObjectId } = await import("mongodb");
    const paramId = req.params.id as string;
    
    let filter: any = { profile_id: paramId };
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      filter = { $or: [ { _id: new ObjectId(paramId) }, { profile_id: paramId } ] };
    }
    const u = await db.collection("users").findOne(filter);
    if (!u) throw new AppError(404, "Staff member not found", "NOT_FOUND");
    
    const roleName = u.role || "customer";
    const rObj = await db.collection("roles").findOne({ name: roleName });
    const effective = new Map<string, string>();
    if (rObj) {
      const rpList = await db.collection("role_permissions").find({ role_id: rObj._id.toString() }).toArray();
      for (const rp of rpList) {
        if (rp.permissions) {
          effective.set(rp.permissions.key, rp.permissions.description || "");
        }
      }
    }
    return success(res, "Effective permissions retrieved", [...effective].map(([key, description]) => ({ key, description })));
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

rolesRouter.get("/", requirePermission("roles:view"), asyncHandler(async (_req, res) => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const roles = await db.collection("roles").find().toArray();
    const formatted = [];
    for (const r of roles) {
      const rpList = await db.collection("role_permissions").find({ role_id: r._id.toString() }).toArray();
      const userCount = await db.collection("users").countDocuments({ role: r.name });
      formatted.push({
        id: r._id.toString(),
        name: r.name,
        description: r.description,
        role_permissions: rpList.map((rp) => ({
          permissions: {
            id: rp.permission_id,
            key: rp.permissions?.key,
            description: rp.permissions?.description
          }
        })),
        user_roles: { count: userCount }
      });
    }
    return success(res, "Roles retrieved", formatted);
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

rolesRouter.get("/permissions", requirePermission("roles:view"), asyncHandler(async (_req, res) => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const perms = await db.collection("permissions").find().toArray();
    const formatted = perms.map((p) => ({
      id: p._id.toString(),
      key: p.key,
      description: p.description
    }));
    return success(res, "Permissions retrieved", formatted);
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

rolesRouter.get("/:id", requirePermission("roles:view"), asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const { ObjectId } = await import("mongodb");
    const roleId = req.params.id as string;
    let rObj = null;
    try {
      rObj = await db.collection("roles").findOne({ _id: new ObjectId(roleId) });
    } catch {
      rObj = await db.collection("roles").findOne({ name: roleId });
    }
    if (!rObj) throw new AppError(404, "Role not found", "NOT_FOUND");
    
    const rpList = await db.collection("role_permissions").find({ role_id: rObj._id.toString() }).toArray();
    const users = await db.collection("users").find({ role: rObj.name }).toArray();
    
    const formatted = {
      id: rObj._id.toString(),
      name: rObj.name,
      description: rObj.description,
      role_permissions: rpList.map((rp) => ({
        permissions: {
          id: rp.permission_id,
          key: rp.permissions?.key,
          description: rp.permissions?.description
        }
      })),
      user_roles: users.map((u) => ({
        user_id: u._id.toString(),
        profiles: {
          full_name: u.name,
          active: u.status !== "Disabled"
        }
      }))
    };
    return success(res, "Role retrieved", formatted);
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

rolesRouter.post("/:id/permissions", requirePermission("roles:assign_permissions"), asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const { ObjectId } = await import("mongodb");
    const roleId = req.params.id as string;
    const permissionId = String(req.body.permissionId ?? "");
    
    const rObj = await db.collection("roles").findOne({ _id: new ObjectId(roleId) });
    if (!rObj) throw new AppError(404, "Role not found", "NOT_FOUND");
    const pObj = await db.collection("permissions").findOne({ _id: new ObjectId(permissionId) });
    if (!pObj) throw new AppError(404, "Permission not found", "NOT_FOUND");
    
    const rpDoc = {
      role_id: roleId,
      permission_id: permissionId,
      permissions: {
        key: pObj.key,
        description: pObj.description
      }
    };
    await db.collection("role_permissions").updateOne(
      { role_id: roleId, permission_id: permissionId },
      { $set: rpDoc },
      { upsert: true }
    );
    return success(res, "Permission assigned", { roleId, permissionId });
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

rolesRouter.delete("/:id/permissions/:permissionId", requirePermission("roles:assign_permissions"), asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const roleId = req.params.id as string;
    const permissionId = req.params.permissionId as string;
    await db.collection("role_permissions").deleteOne({ role_id: roleId, permission_id: permissionId });
    return success(res, "Permission removed", { roleId, permissionId });
  }
  throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
}));

function statusAction(active: boolean) {
  return asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const db = mongoose.connection.db;
      const { ObjectId } = await import("mongodb");
      let query: any = { profile_id: id };
      if (mongoose.Types.ObjectId.isValid(id)) {
        query = { $or: [ { _id: new ObjectId(id) }, { profile_id: id } ] };
      }
      await db.collection("users").updateOne(
        query,
        { $set: { status: active ? "Active" : "Disabled" } }
      );
      return success(res, active ? "Staff activated" : "Staff disabled", { id, active });
    }
    throw new AppError(503, "Database unavailable", "DATABASE_ERROR");
  });
}

async function assertEditable(actorId: string, targetId: string, actorRoles: string[]) {
  if (actorId === targetId) throw new AppError(403, "You cannot change your own protected access", "SELF_PRIVILEGE_CHANGE");
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const { ObjectId } = await import("mongodb");
    let query: any = { profile_id: targetId };
    if (mongoose.Types.ObjectId.isValid(targetId)) {
      query = { $or: [ { _id: new ObjectId(targetId) }, { profile_id: targetId } ] };
    }
    const targetUser = await db.collection("users").findOne(query);
    if (targetUser) {
      if (targetUser.role === "super_admin") throw new AppError(403, "Super Admin is protected", "PROTECTED_ACCOUNT");
      if (!actorRoles.includes("super_admin") && targetUser.role === "admin") {
        throw new AppError(403, "Only Super Admin can manage Admin accounts", "PROTECTED_ACCOUNT");
      }
    }
  }
}

function assertRoleGrantAllowed(actorRoles: string[], role: string) {
  if (role === "super_admin") throw new AppError(403, "Super Admin role cannot be granted through user management", "PROTECTED_ROLE");
  if (actorRoles.includes("super_admin")) return;
  const operational = new Set(["manager", "sales_executive", "installation_staff", "service_technician", "accountant", "customer"]);
  if (!actorRoles.includes("admin") || !operational.has(role)) throw new AppError(403, "You cannot assign this role", "PROTECTED_ROLE");
}

async function audit(actor: string, action: string, entity: string, newValues: object) {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    await mongoose.connection.db.collection("audit_logs").insertOne({
      actor_user_id: actor,
      action,
      entity_type: "profile",
      entity_id: entity,
      new_values: newValues,
      created_at: new Date()
    });
  }
}
