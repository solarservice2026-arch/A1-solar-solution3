import { Router } from "express";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { asyncHandler, AppError, success } from "../lib/http.js";
import {
  requireAnyPermission,
  requireAuth,
  requirePermission,
} from "../auth/middleware.js";

const db = () => {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new AppError(
      503,
      "Supabase is not configured",
      "SERVICE_UNAVAILABLE",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
const number = (prefix: string) =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
const invoiceNumber = () =>
  `A1-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
const sha512 = (value: string) =>
  crypto.createHash("sha512").update(value).digest("hex");
const publicUrl = (value: string | undefined, fallback: string) => {
  const candidate = value?.trim();
  if (
    !candidate ||
    /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(candidate)
  )
    return fallback;
  return candidate.replace(/\/$/, "");
};
const payuConfig = () => {
  const key = process.env.PAYU_MERCHANT_KEY,
    salt = process.env.PAYU_MERCHANT_SALT,
    production = process.env.PAYU_ENV === "production";
  if (!key || !salt)
    throw new AppError(
      503,
      "PayU is not configured",
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
    );
  return {
    key,
    salt,
    paymentUrl: production
      ? "https://secure.payu.in/_payment"
      : "https://test.payu.in/_payment",
    verifyUrl: production
      ? "https://info.payu.in/merchant/postservice.php?form=2"
      : "https://test.payu.in/merchant/postservice.php?form=2",
  };
};
async function customerId(userId: string) {
  const { data } = await db()
    .from("customers")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}
async function validCreatorId(client: any, reqUserId: string | undefined) {
  const userId = reqUserId || "00000000-0000-0000-0000-000000000001";
  try {
    await client.from("profiles").upsert(
      {
        id: userId,
        full_name: "Super Admin",
        active: true,
      },
      { onConflict: "id" }
    );
    return userId;
  } catch {
    return userId;
  }
}
async function scope(req: any, query: any, column = "customer_id") {
  if (req.auth.roles.includes("customer")) {
    const id = await customerId(req.auth.userId);
    return id
      ? query.eq(column, id)
      : query.eq(column, "00000000-0000-0000-0000-000000000000");
  }
  return query;
}

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get(
  "/",
  requirePermission("dashboard:view"),
  asyncHandler(async (req, res) => {
    const admin = db(),
      isCustomer = req.auth!.roles.includes("customer"),
      cid = isCustomer ? await customerId(req.auth!.userId) : null;
    const count = async (table: string, column?: string) => {
      let q = admin.from(table).select("id", { count: "exact", head: true });
      if (isCustomer && column)
        q = q.eq(column, cid ?? "00000000-0000-0000-0000-000000000000");
      const { count, error } = await q;
      if (error) throw new AppError(400, error.message, "DATABASE_ERROR");
      return count ?? 0;
    };
    const entries: ReadonlyArray<
      readonly [key: string, table: string, column?: string]
    > = isCustomer
      ? [
          ["quotations", "quotations", "customer_id"],
          ["invoices", "invoices", "customer_id"],
          ["projects", "projects", "customer_id"],
          ["tickets", "service_tickets", "customer_id"],
        ]
      : [
          ["leads", "leads"],
          ["customers", "customers"],
          ["quotations", "quotations"],
          ["invoices", "invoices"],
          ["products", "products"],
          ["staff", "profiles"],
        ];
    const data = Object.fromEntries(
      await Promise.all(
        entries.map(async ([key, table, column]) => [
          key,
          await count(table, column),
        ]),
      ),
    );
    return success(res, "Dashboard retrieved", data);
  }),
);

export const customersRouter = Router();
customersRouter.use(requireAuth);
customersRouter.get(
  "/",
  requirePermission("customers:view"),
  asyncHandler(async (req, res) => {
    let q = db()
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    q = await scope(req, q, "id");
    if (req.query.search)
      q = q.or(
        `name.ilike.%${String(req.query.search).replace(/[%_,]/g, "")}%,mobile.ilike.%${String(req.query.search).replace(/[%_,]/g, "")}%`,
      );
    const { data, error } = await q;
    if (error) throw new AppError(400, error.message, "DATABASE_ERROR");
    return success(res, "Customers retrieved", data);
  }),
);
customersRouter.post(
  "/",
  requirePermission("customers:create"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!b.name || !b.mobile || !b.customerType)
      throw new AppError(
        400,
        "Name, mobile and customer type are required",
        "VALIDATION_ERROR",
      );

    const client = db();
    let profileId: string | null = null;

    if (b.email && b.password) {
      const email = String(b.email).trim().toLowerCase();
      const password = String(b.password).trim();

      if (password.length < 6) {
        throw new AppError(
          400,
          "Password must be at least 6 characters long",
          "VALIDATION_ERROR",
        );
      }

      let userId: string | undefined;

      const { data: createdUser, error: authErr } =
        await client.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: b.name },
        });

      if (createdUser?.user) {
        userId = createdUser.user.id;
      } else if (
        authErr?.message?.includes("already registered") ||
        authErr?.message?.includes("already exists")
      ) {
        const { data: existingProfiles } = await client
          .from("profiles")
          .select("id")
          .eq("phone", b.mobile)
          .limit(1);

        if (existingProfiles && existingProfiles.length > 0) {
          const existingProfile = existingProfiles[0];

          const existingUserId = existingProfile?.id;
          if (!existingUserId) {
            throw new AppError(
              400,
              "Unable to resolve existing user profile",
              "USER_PROFILE_NOT_FOUND",
            );
          }

          userId = existingUserId;
          await client.auth.admin.updateUserById(existingUserId, { password });
        } else {
          throw new AppError(
            400,
            "An account with this email address already exists",
            "EMAIL_EXISTS",
          );
        }
      } else if (authErr) {
        throw new AppError(400, authErr.message, "USER_CREATION_FAILED");
      }

      if (userId) {
        profileId = userId;

        await client.from("profiles").upsert({
          id: userId,
          full_name: b.name,
          phone: b.mobile,
          active: true,
        });

        const { data: customerRole } = await client
          .from("roles")
          .select("id")
          .eq("name", "customer")
          .single();

        if (customerRole) {
          await client.from("user_roles").upsert({
            user_id: userId,
            role_id: customerRole.id,
          });
        }
      }
    }

    const creatorId = await validCreatorId(client, req.auth?.userId);

    const payload: any = {
      customer_number: number("CUS"),
      profile_id: profileId,
      name: b.name,
      customer_type: b.customerType || "Retail",
      mobile: b.mobile,
      email: b.email || null,
      gst_number: b.gstNumber || null,
      consumer_number: b.consumerNumber || null,
      provider: b.provider || null,
    };

    if (creatorId) {
      payload.created_by = creatorId;
    }

    let { data, error } = await client
      .from("customers")
      .insert(payload)
      .select()
      .maybeSingle();

    if (error && error.message?.includes("created_by")) {
      delete payload.created_by;
      const retry = await client
        .from("customers")
        .insert(payload)
        .select()
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (!data) {
      data = {
        id: `cus-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
      };
    }

    return success(res.status(201), "Customer created", data);
  }),
);
customersRouter.delete(
  "/:id",
  requirePermission("customers:delete"),
  asyncHandler(async (req, res) => {
    const { error } = await db()
      .from("customers")
      .delete()
      .eq("id", req.params.id);
    if (error)
      throw new AppError(
        409,
        "Customer has linked business records and cannot be deleted",
        "RECORD_IN_USE",
      );
    return success(res, "Customer deleted", null);
  }),
);

export const productsRouter = Router();
productsRouter.use(requireAuth);
productsRouter.get(
  "/",
  requireAnyPermission("products:view", "quotations:create", "invoices:create"),
  asyncHandler(async (req, res) => {
    let q = db()
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (req.query.search)
      q = q.or(
        `name.ilike.%${String(req.query.search).replace(/[%_,]/g, "")}%,sku.ilike.%${String(req.query.search).replace(/[%_,]/g, "")}%`,
      );
    const { data, error } = await q;
    if (error) throw new AppError(400, error.message, "DATABASE_ERROR");
    return success(res, "Products retrieved", data);
  }),
);
productsRouter.post(
  "/",
  requirePermission("products:create"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!b.sku || !b.name || !b.category)
      throw new AppError(
        400,
        "SKU, name and category are required",
        "VALIDATION_ERROR",
      );
    const { data, error } = await db()
      .from("products")
      .insert({
        sku: b.sku,
        name: b.name,
        category: b.category,
        brand: b.brand || null,
        model: b.model || null,
        unit: b.unit || "Nos",
        purchase_price: Number(b.purchasePrice || 0),
        selling_price: Number(b.sellingPrice || 0),
        tax_rate: Number(b.taxRate || 0),
        minimum_stock: Number(b.minimumStock || 0),
      })
      .select()
      .single();
    if (error) throw new AppError(400, error.message, "DATABASE_ERROR");
    return success(res.status(201), "Product created", data);
  }),
);

export const projectsRouter = Router();
projectsRouter.use(requireAuth);
projectsRouter.get(
  "/",
  requirePermission("projects:view"),
  asyncHandler(async (req, res) => {
    let query = db()
      .from("projects")
      .select(
        "*,customers(name,mobile),quotations(quotation_number),profiles!projects_assigned_to_fkey(full_name)",
      )
      .order("updated_at", { ascending: false });
    if (req.auth!.roles.includes("installation_staff"))
      query = query.eq("assigned_to", req.auth!.userId);
    else query = await scope(req, query);
    const { data, error } = await query;
    if (error) throw new AppError(500, error.message, "DATABASE_ERROR");
    return success(res, "Projects retrieved", data);
  }),
);
projectsRouter.patch(
  "/:id/progress",
  requireAnyPermission("projects:update", "projects:change_stage"),
  asyncHandler(async (req, res) => {
    const progress = Number(req.body.progress),
      stage = String(req.body.stage ?? ""),
      allowedStages = new Set([
        "Confirmed",
        "Site Survey",
        "Material Dispatched",
        "Installation",
        "Testing",
        "Completed",
        "On Hold",
      ]);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100)
      throw new AppError(
        400,
        "Progress must be a whole number between 0 and 100",
        "VALIDATION_ERROR",
      );
    if (!allowedStages.has(stage))
      throw new AppError(400, "Invalid project stage", "VALIDATION_ERROR");
    let query = db()
      .from("projects")
      .update({
        progress,
        stage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id);
    if (req.auth!.roles.includes("installation_staff"))
      query = query.eq("assigned_to", req.auth!.userId);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw new AppError(500, error.message, "DATABASE_ERROR");
    if (!data)
      throw new AppError(
        404,
        "Assigned project not found",
        "PROJECT_NOT_FOUND",
      );
    return success(res, "Installation progress updated", data);
  }),
);
projectsRouter.patch(
  "/:id/assignment",
  requirePermission("projects:assign"),
  asyncHandler(async (req, res) => {
    const assignedTo = String(req.body.assignedTo ?? "");
    const { data: role } = await db()
      .from("user_roles")
      .select("user_id,roles!inner(name),profiles!inner(active)")
      .eq("user_id", assignedTo)
      .eq("roles.name", "installation_staff")
      .eq("profiles.active", true)
      .maybeSingle();
    if (!role)
      throw new AppError(
        400,
        "Select an active installation staff member",
        "INVALID_INSTALLER",
      );
    const { data, error } = await db()
      .from("projects")
      .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw new AppError(500, error.message, "DATABASE_ERROR");
    return success(res, "Installer assigned", data);
  }),
);
projectsRouter.get(
  "/installers",
  requirePermission("projects:assign"),
  asyncHandler(async (_req, res) => {
    const { data, error } = await db()
      .from("user_roles")
      .select("user_id,profiles!inner(full_name,active),roles!inner(name)")
      .eq("roles.name", "installation_staff")
      .eq("profiles.active", true);
    if (error) throw new AppError(500, error.message, "DATABASE_ERROR");
    return success(
      res,
      "Installers retrieved",
      (data ?? []).map((item: any) => ({
        id: item.user_id,
        fullName: item.profiles.full_name,
      })),
    );
  }),
);
projectsRouter.get(
  "/:id/documents",
  requirePermission("documents:view"),
  asyncHandler(async (req, res) => {
    if (req.auth!.roles.includes("installation_staff")) {
      const { data } = await db()
        .from("projects")
        .select("id")
        .eq("id", req.params.id)
        .eq("assigned_to", req.auth!.userId)
        .maybeSingle();
      if (!data)
        throw new AppError(
          404,
          "Assigned project not found",
          "PROJECT_NOT_FOUND",
        );
    }
    const { data, error } = await db()
      .from("documents")
      .select("*")
      .eq("entity_type", "project")
      .eq("entity_id", req.params.id)
      .order("created_at", { ascending: false });
    if (error) throw new AppError(500, error.message, "DATABASE_ERROR");
    return success(res, "Project documents retrieved", data);
  }),
);
projectsRouter.post(
  "/:id/documents",
  requirePermission("documents:upload"),
  asyncHandler(async (req, res) => {
    if (req.auth!.roles.includes("installation_staff")) {
      const { data } = await db()
        .from("projects")
        .select("id")
        .eq("id", req.params.id)
        .eq("assigned_to", req.auth!.userId)
        .maybeSingle();
      if (!data)
        throw new AppError(
          404,
          "Assigned project not found",
          "PROJECT_NOT_FOUND",
        );
    }
    const b = req.body;
    if (
      !b.originalName ||
      !b.storagePath ||
      !b.mimeType ||
      Number(b.fileSize) < 1
    )
      throw new AppError(
        400,
        "Complete document metadata is required",
        "VALIDATION_ERROR",
      );
    const { data, error } = await db()
      .from("documents")
      .insert({
        original_name: b.originalName,
        storage_path: b.storagePath,
        mime_type: b.mimeType,
        file_size: Number(b.fileSize),
        uploaded_by: req.auth!.userId,
        entity_type: "project",
        entity_id: req.params.id,
        category: b.category || "Installation",
      })
      .select()
      .single();
    if (error) throw new AppError(500, error.message, "DATABASE_ERROR");
    return success(res.status(201), "Project document registered", data);
  }),
);

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);
ticketsRouter.get(
  "/",
  requirePermission("tickets:view"),
  asyncHandler(async (req, res) => {
    let query = db()
      .from("service_tickets")
      .select(
        "*,customers(name,mobile),projects(project_number),profiles!service_tickets_assigned_to_fkey(full_name)",
      )
      .order("opened_at", { ascending: false });
    if (req.auth!.roles.includes("service_technician"))
      query = query.eq("assigned_to", req.auth!.userId);
    else query = await scope(req, query);
    const { data, error } = await query;
    if (error) throw new AppError(500, error.message, "DATABASE_ERROR");
    return success(res, "Service tickets retrieved", data);
  }),
);
ticketsRouter.patch(
  "/:id",
  requirePermission("tickets:update"),
  asyncHandler(async (req, res) => {
    const status = String(req.body.status ?? ""),
      resolution = String(req.body.resolution ?? "").trim(),
      allowed = new Set([
        "Open",
        "In Progress",
        "Waiting",
        "Resolved",
        "Closed",
      ]);
    if (!allowed.has(status))
      throw new AppError(400, "Invalid ticket status", "VALIDATION_ERROR");
    let query = db()
      .from("service_tickets")
      .update({
        status,
        resolution: resolution || null,
        closed_at: status === "Closed" ? new Date().toISOString() : null,
      })
      .eq("id", req.params.id);
    if (req.auth!.roles.includes("service_technician"))
      query = query.eq("assigned_to", req.auth!.userId);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw new AppError(500, error.message, "DATABASE_ERROR");
    if (!data)
      throw new AppError(404, "Assigned ticket not found", "TICKET_NOT_FOUND");
    return success(res, "Service ticket updated", data);
  }),
);

export const quotationsRouter = Router();
quotationsRouter.use(requireAuth);
quotationsRouter.get(
  "/",
  requirePermission("quotations:view"),
  asyncHandler(async (req, res) => {
    let q = db()
      .from("quotations")
      .select(
        "*,customers(name,mobile),quotation_items(*,products(name,brand,model))",
      )
      .neq("status", "Archived")
      .order("created_at", { ascending: false });
    q = await scope(req, q);
    const { data, error } = await q;
    if (error) throw error;
    return success(res, "Quotations retrieved", data);
  }),
);
quotationsRouter.post(
  "/",
  requirePermission("quotations:create"),
  asyncHandler(async (req, res) => {
    const b = req.body,
      items: any[] = Array.isArray(b.items) ? b.items : [];
    if (
      !b.customerId ||
      !b.validUntil ||
      !b.capacityKw ||
      !b.quotationType ||
      !b.title ||
      items.length === 0
    )
      throw new AppError(
        400,
        "Customer, validity, capacity, type, title and products are required",
        "VALIDATION_ERROR",
      );
    type NormalizedItem = {
      product_id: string | null;
      product_name: string;
      description: string;
      brand: string;
      quantity: number;
      unit_price: number;
      tax_rate: number;
      line_amount: number;
    };
    const normalized: NormalizedItem[] = items.map((item: any) => {
      const quantity = Number(item.quantity),
        unitPrice = Number(item.unitPrice),
        taxRate = Number(item.taxRate || 0);
      if (
        !item.productName ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        unitPrice < 0 ||
        taxRate < 0
      )
        throw new AppError(
          400,
          "Each product requires name, whole-number quantity, price and valid tax",
          "VALIDATION_ERROR",
        );
      return {
        product_id: item.productId || null,
        product_name: String(item.productName),
        description: String(item.description || item.productName),
        brand: String(item.brand || ""),
        quantity,
        unit_price: unitPrice,
        tax_rate: taxRate,
        line_amount: quantity * unitPrice,
      };
    });
    const subtotal = normalized.reduce(
        (sum, item) => sum + item.line_amount,
        0,
      ),
      tax = normalized.reduce(
        (sum, item) =>
          sum + (item.line_amount * item.tax_rate) / (100 + item.tax_rate),
        0,
      ),
      discount = Math.max(0, Number(b.discount || 0));
    const admin = db();
    const { data, error } = await admin
      .from("quotations")
      .insert({
        quotation_number: number("QUO"),
        customer_id: b.customerId,
        quotation_date:
          b.quotationDate || new Date().toISOString().slice(0, 10),
        valid_until: b.validUntil,
        capacity_kw: Number(b.capacityKw),
        quotation_type: b.quotationType,
        title: b.title,
        installation_address: b.installationAddress || null,
        subtotal,
        discount,
        tax,
        grand_total: subtotal - discount,
        terms: b.terms || null,
        created_by: req.auth!.userId,
      })
      .select()
      .single();
    if (error || !data)
      throw new AppError(
        400,
        error?.message ?? "Unable to create quotation",
        "DATABASE_ERROR",
      );
    const { error: itemError } = await admin
      .from("quotation_items")
      .insert(normalized.map((item) => ({ ...item, quotation_id: data.id })));
    if (itemError) {
      await admin.from("quotations").delete().eq("id", data.id);
      throw new AppError(400, itemError.message, "DATABASE_ERROR");
    }
    return success(res.status(201), "Quotation created", data);
  }),
);
quotationsRouter.delete(
  "/:id",
  requirePermission("quotations:delete"),
  asyncHandler(async (req, res) => {
    const { data, error } = await db()
      .from("quotations")
      .update({ status: "Archived", updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .neq("status", "Archived")
      .select("id")
      .maybeSingle();
    if (error) throw new AppError(400, error.message, "DATABASE_ERROR");
    if (!data)
      throw new AppError(
        404,
        "Quotation not found or already archived",
        "NOT_FOUND",
      );
    return success(res, "Quotation archived", null);
  }),
);

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);
invoicesRouter.get(
  "/",
  requirePermission("invoices:view"),
  asyncHandler(async (req, res) => {
    let q = db()
      .from("invoices")
      .select(
        "*,customers(name,mobile,email,gst_number),invoice_items(*,products(name,brand,model))",
      )
      .order("created_at", { ascending: false });
    q = await scope(req, q);
    const { data, error } = await q;
    if (error) throw new AppError(400, error.message, "DATABASE_ERROR");
    return success(res, "Invoices retrieved", data);
  }),
);
invoicesRouter.post(
  "/",
  requirePermission("invoices:create"),
  asyncHandler(async (req, res) => {
    const b = req.body,
      items: any[] = Array.isArray(b.items) ? b.items : [];
    if (!b.customerId || !b.dueDate || items.length === 0)
      throw new AppError(
        400,
        "Customer, due date and products are required",
        "VALIDATION_ERROR",
      );
    type InvoiceItem = {
      product_id: string | null;
      product_name: string;
      description: string;
      brand: string;
      quantity: number;
      unit_price: number;
      tax_rate: number;
      line_amount: number;
    };
    const normalized: InvoiceItem[] = items.map((item: any) => {
      const quantity = Number(item.quantity),
        unitPrice = Number(item.unitPrice),
        taxRate = Number(item.taxRate || 0);
      if (
        !item.productName ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        unitPrice < 0 ||
        taxRate < 0
      )
        throw new AppError(
          400,
          "Each product requires valid name, whole-number quantity, price and tax",
          "VALIDATION_ERROR",
        );
      return {
        product_id: item.productId || null,
        product_name: String(item.productName),
        description: String(item.description || item.productName),
        brand: String(item.brand || ""),
        quantity,
        unit_price: unitPrice,
        tax_rate: taxRate,
        line_amount: quantity * unitPrice,
      };
    });
    const subtotal = normalized.reduce(
        (sum, item) => sum + item.line_amount,
        0,
      ),
      tax = normalized.reduce(
        (sum, item) =>
          sum + (item.line_amount * item.tax_rate) / (100 + item.tax_rate),
        0,
      ),
      total = subtotal,
      admin = db();
    const { data, error } = await admin
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber(),
        customer_id: b.customerId,
        quotation_id: b.quotationId || null,
        invoice_date: b.invoiceDate || new Date().toISOString().slice(0, 10),
        due_date: b.dueDate,
        invoice_type: b.invoiceType || null,
        title: b.title || null,
        subtotal,
        tax,
        total,
        paid_amount: Number(b.paidAmount || 0),
        installation_address: b.installationAddress || null,
        notes: b.notes || null,
        status: b.status || "Draft",
      })
      .select()
      .single();
    if (error || !data)
      throw new AppError(
        400,
        error?.message ?? "Unable to create invoice",
        "DATABASE_ERROR",
      );
    const { error: itemError } = await admin
      .from("invoice_items")
      .insert(normalized.map((item) => ({ ...item, invoice_id: data.id })));
    if (itemError) {
      await admin.from("invoices").delete().eq("id", data.id);
      throw new AppError(400, itemError.message, "DATABASE_ERROR");
    }
    return success(res.status(201), "Invoice created", data);
  }),
);
invoicesRouter.patch(
  "/:id",
  requirePermission("invoices:update"),
  asyncHandler(async (req, res) => {
    const b = req.body,
      changes: Record<string, unknown> = {};
    if (b.dueDate !== undefined) changes.due_date = b.dueDate;
    if (b.title !== undefined) changes.title = String(b.title);
    if (b.status !== undefined) changes.status = String(b.status);
    if (b.paidAmount !== undefined)
      changes.paid_amount = Math.max(0, Number(b.paidAmount));
    if (b.notes !== undefined) changes.notes = b.notes || null;
    if (Object.keys(changes).length === 0)
      throw new AppError(
        400,
        "No invoice changes supplied",
        "VALIDATION_ERROR",
      );
    const { data, error } = await db()
      .from("invoices")
      .update(changes)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error || !data)
      throw new AppError(
        400,
        error?.message ?? "Unable to update invoice",
        "DATABASE_ERROR",
      );
    return success(res, "Invoice updated", data);
  }),
);
invoicesRouter.delete(
  "/:id",
  requirePermission("invoices:delete"),
  asyncHandler(async (req, res) => {
    const { error } = await db()
      .from("invoices")
      .delete()
      .eq("id", req.params.id);
    if (error) throw new AppError(400, error.message, "DATABASE_ERROR");
    return success(res, "Invoice deleted", null);
  }),
);

export const agreementsRouter = Router();
agreementsRouter.use(requireAuth);
agreementsRouter.get(
  "/",
  requirePermission("agreements:view"),
  asyncHandler(async (req, res) => {
    let q = db()
      .from("agreements")
      .select(
        "*,customers(name,mobile),quotations(quotation_number,capacity_kw,grand_total,quotation_items(*,products(name,brand,model)))",
      )
      .order("created_at", { ascending: false });
    q = await scope(req, q);
    const { data, error } = await q;
    if (error)
      throw new AppError(500, "Unable to load agreements", "DATABASE_ERROR");
    const result = req.auth!.roles.includes("customer")
      ? (data ?? []).map((agreement: any) =>
          agreement.payment_status === "Paid"
            ? agreement
            : {
                id: agreement.id,
                agreement_number: agreement.agreement_number,
                created_at: agreement.created_at,
                payment_status: agreement.payment_status,
                payment_amount: agreement.payment_amount,
                customers: agreement.customers
                  ? { name: agreement.customers.name }
                  : null,
                locked: true,
              },
        )
      : data;
    return success(res, "Agreements retrieved", result);
  }),
);
agreementsRouter.get(
  "/:id/document",
  requirePermission("agreements:view"),
  asyncHandler(async (req, res) => {
    let query = db()
      .from("agreements")
      .select(
        "*,customers(name,mobile),quotations(quotation_number,capacity_kw,grand_total,quotation_items(*,products(name,brand,model)))",
      )
      .eq("id", req.params.id);
    if (req.auth!.roles.includes("customer")) {
      const cid = await customerId(req.auth!.userId);
      query = query
        .eq("customer_id", cid ?? "00000000-0000-0000-0000-000000000000")
        .eq("payment_status", "Paid");
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw new AppError(500, error.message, "DATABASE_ERROR");
    if (!data)
      throw new AppError(
        402,
        "Verified payment is required before viewing or downloading this agreement",
        "PAYMENT_REQUIRED",
      );
    return success(res, "Agreement document retrieved", data);
  }),
);
agreementsRouter.post(
  "/:id/payu-checkout",
  requirePermission("payments:create"),
  asyncHandler(async (req, res) => {
    if (!req.auth!.roles.includes("customer"))
      throw new AppError(403, "Customer checkout only", "FORBIDDEN");
    const cid = await customerId(req.auth!.userId);
    const { data: agreement } = await db()
      .from("agreements")
      .select(
        "id,agreement_number,payment_amount,payment_status,customers(name,mobile,email)",
      )
      .eq("id", req.params.id)
      .eq("customer_id", cid ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    if (!agreement) throw new AppError(404, "Agreement not found", "NOT_FOUND");
    if (agreement.payment_status === "Paid")
      throw new AppError(409, "Agreement is already paid", "ALREADY_PAID");
    const config = payuConfig(),
      customer = agreement.customers as unknown as {
        name: string;
        mobile: string;
        email: string | null;
      },
      txnid = `AGR${Date.now()}${crypto.randomBytes(3).toString("hex")}`,
      amount = Number(agreement.payment_amount).toFixed(2),
      productinfo = `Agreement ${agreement.agreement_number}`,
      firstname = String(customer.name || "Customer").slice(0, 60),
      email = customer.email || req.auth!.email,
      udf1 = agreement.id,
      hash = sha512(
        `${config.key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}||||||||||${config.salt}`,
      ),
      publicApi = publicUrl(
        process.env.PUBLIC_API_URL,
        "https://a1-solor-solution.vercel.app/api/v1",
      ),
      callback = `${publicApi}/payments/payu/callback`;
    const { error } = await db().from("agreement_payment_requests").upsert(
      {
        agreement_id: agreement.id,
        customer_id: cid,
        amount,
        method: "PayU",
        transaction_reference: txnid,
        status: "Initiated",
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "agreement_id" },
    );
    if (error) throw new AppError(400, error.message, "DATABASE_ERROR");
    await db()
      .from("agreements")
      .update({ payment_status: "Payment Initiated" })
      .eq("id", agreement.id);
    return success(res, "PayU checkout initialized", {
      action: config.paymentUrl,
      fields: {
        key: config.key,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        phone: customer.mobile,
        udf1,
        surl: callback,
        furl: callback,
        hash,
      },
    });
  }),
);
agreementsRouter.post(
  "/:id/payment-request",
  requirePermission("payments:create"),
  asyncHandler(async (req, res) => {
    if (!req.auth!.roles.includes("customer"))
      throw new AppError(403, "Customer payment request only", "FORBIDDEN");
    const cid = await customerId(req.auth!.userId),
      transactionReference = String(req.body.transactionReference ?? "").trim(),
      method = String(req.body.method ?? "").trim();
    if (!cid || !transactionReference || !method)
      throw new AppError(
        400,
        "Payment method and transaction reference are required",
        "VALIDATION_ERROR",
      );
    const { data: agreement } = await db()
      .from("agreements")
      .select("id,payment_amount,payment_status")
      .eq("id", req.params.id)
      .eq("customer_id", cid)
      .maybeSingle();
    if (!agreement) throw new AppError(404, "Agreement not found", "NOT_FOUND");
    if (agreement.payment_status === "Paid")
      return success(res, "Agreement payment already verified", agreement);
    const { data, error } = await db()
      .from("agreement_payment_requests")
      .upsert(
        {
          agreement_id: agreement.id,
          customer_id: cid,
          amount: agreement.payment_amount,
          method,
          transaction_reference: transactionReference,
          status: "Pending",
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "agreement_id" },
      )
      .select()
      .single();
    if (error) throw new AppError(400, error.message, "DATABASE_ERROR");
    await db()
      .from("agreements")
      .update({ payment_status: "Pending Verification" })
      .eq("id", agreement.id);
    return success(res.status(201), "Payment submitted for verification", data);
  }),
);

export const payuCallback = asyncHandler(async (req, res) => {
  const config = payuConfig(),
    body = req.body as Record<string, string>,
    txnid = String(body.txnid ?? ""),
    status = String(body.status ?? ""),
    receivedHash = String(body.hash ?? ""),
    additionalCharges = body.additional_charges,
    reverseSequence = `${config.salt}|${status}||||||${body.udf5 ?? ""}|${body.udf4 ?? ""}|${body.udf3 ?? ""}|${body.udf2 ?? ""}|${body.udf1 ?? ""}|${body.email ?? ""}|${body.firstname ?? ""}|${body.productinfo ?? ""}|${body.amount ?? ""}|${txnid}|${body.key ?? ""}`,
    expectedHash = sha512(
      additionalCharges
        ? `${additionalCharges}|${reverseSequence}`
        : reverseSequence,
    ),
    web = publicUrl(
      process.env.WEB_URL,
      "https://a1-solor-solution.vercel.app",
    );
  const redirect = (result: "success" | "failed") =>
    res.redirect(303, `${web}/app/agreements?payment=${result}`);
  if (
    !txnid ||
    body.key !== config.key ||
    receivedHash.length !== expectedHash.length ||
    !crypto.timingSafeEqual(
      Buffer.from(receivedHash),
      Buffer.from(expectedHash),
    )
  )
    return redirect("failed");
  const { data: request } = await db()
    .from("agreement_payment_requests")
    .select("id,agreement_id,amount,transaction_reference")
    .eq("transaction_reference", txnid)
    .maybeSingle();
  if (
    !request ||
    Number(request.amount).toFixed(2) !== Number(body.amount).toFixed(2)
  )
    return redirect("failed");
  const command = "verify_payment",
    verifyHash = sha512(`${config.key}|${command}|${txnid}|${config.salt}`),
    verificationResponse = await fetch(config.verifyUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: config.key,
        command,
        var1: txnid,
        hash: verifyHash,
      }),
    }),
    verification = (await verificationResponse.json()) as {
      transaction_details?: Record<
        string,
        { status?: string; amount?: string; unmappedstatus?: string }
      >;
    },
    verified = verification.transaction_details?.[txnid];
  if (
    status !== "success" ||
    verified?.status !== "success" ||
    Number(verified.amount).toFixed(2) !== Number(request.amount).toFixed(2)
  ) {
    await db()
      .from("agreement_payment_requests")
      .update({ status: "Failed" })
      .eq("id", request.id);
    return redirect("failed");
  }
  const admin = db();
  await admin
    .from("agreement_payment_requests")
    .update({ status: "Verified", verified_at: new Date().toISOString() })
    .eq("id", request.id);
  await admin
    .from("agreements")
    .update({ payment_status: "Paid", paid_at: new Date().toISOString() })
    .eq("id", request.agreement_id);
  return redirect("success");
});
agreementsRouter.post(
  "/:id/verify-payment",
  requirePermission("payments:create"),
  asyncHandler(async (req, res) => {
    if (req.auth!.roles.includes("customer"))
      throw new AppError(
        403,
        "Payment verification is restricted",
        "FORBIDDEN",
      );
    const { data: request } = await db()
      .from("agreement_payment_requests")
      .select("*")
      .eq("agreement_id", req.params.id)
      .eq("status", "Pending")
      .maybeSingle();
    if (!request)
      throw new AppError(404, "Pending payment request not found", "NOT_FOUND");
    const admin = db();
    const { error } = await admin
      .from("agreement_payment_requests")
      .update({
        status: "Verified",
        verified_by: req.auth!.userId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", request.id);
    if (error) throw new AppError(500, error.message, "DATABASE_ERROR");
    await admin
      .from("agreements")
      .update({ payment_status: "Paid", paid_at: new Date().toISOString() })
      .eq("id", req.params.id);
    return success(res, "Agreement payment verified", { paid: true });
  }),
);
agreementsRouter.post(
  "/",
  requirePermission("agreements:create"),
  asyncHandler(async (req, res) => {
    try {
      const b = req.body,
        isCustomer = req.auth!.roles.includes("customer");
      if (isCustomer)
        throw new AppError(
          403,
          "Customers can only view and download their agreements",
          "FORBIDDEN",
        );
      let agreementCustomerId = String(b.customerId ?? "");
      if (isCustomer) {
        agreementCustomerId = (await customerId(req.auth!.userId)) ?? "";
        if (!agreementCustomerId)
          throw new AppError(
            409,
            "Customer account is not linked to a customer record",
            "CUSTOMER_PROFILE_NOT_LINKED",
          );
        const { data: ownedQuote } = await db()
          .from("quotations")
          .select("id")
          .eq("id", b.quotationId)
          .eq("customer_id", agreementCustomerId)
          .maybeSingle();
        if (!ownedQuote)
          throw new AppError(
            403,
            "You can create an agreement only for your own quotation",
            "FORBIDDEN",
          );
      }
      if (!agreementCustomerId || !b.consumerAddress || !b.agreementDate)
        throw new AppError(
          400,
          "Customer, address and agreement date are required",
          "VALIDATION_ERROR",
        );
      const admin = db();
      let validQuotationId: string | null = null;
      if (b.quotationId && String(b.quotationId).trim() !== "") {
        const { data: selectedQuote } = await admin
          .from("quotations")
          .select("id,customer_id")
          .eq("id", b.quotationId)
          .maybeSingle();
        if (
          selectedQuote &&
          String(selectedQuote.customer_id) === String(agreementCustomerId)
        ) {
          validQuotationId = selectedQuote.id;
        }
      }
      if (!validQuotationId) {
        const { data: latestQuote } = await admin
          .from("quotations")
          .select("id")
          .eq("customer_id", agreementCustomerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestQuote) validQuotationId = latestQuote.id;
      }
      const { data: foundTemplate, error: templateError } = await admin
        .from("agreement_templates")
        .select("id,version")
        .eq("active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (templateError) {
        console.error("Agreement template fetch error:", templateError);
        throw new AppError(500, templateError.message, "DATABASE_ERROR");
      }
      let template: { id: string; version: number } | null = foundTemplate;
      if (!template) {
        const { data: newTemplate, error: createError } = await admin
          .from("agreement_templates")
          .insert({
            name: "PM Surya Ghar Consumer Vendor Agreement",
            scheme_name: "PM Surya Ghar: Muft Bijli Yojana",
            version: 1,
            body: {
              title:
                "Agreement between Consumer and Vendor for installation of a grid-connected rooftop solar project",
              sections: [
                "Consumer and vendor identification",
                "Project purpose",
                "Consumer responsibilities",
                "Vendor responsibilities",
                "Site survey and feasibility",
                "Design and engineering",
                "Procurement and supply",
                "Installation and documentation",
                "Warranty and maintenance",
                "Grid connectivity",
                "Subsidy documentation",
                "Plant performance",
                "Payment and disputes",
                "Signatures and disclaimer",
              ],
            },
            active: true,
          })
          .select("id,version")
          .single();
        if (createError) {
          console.error("Agreement template create error:", createError);
          throw new AppError(
            500,
            createError.message || "Failed to create default agreement template",
            "TEMPLATE_NOT_CONFIGURED",
          );
        }
        if (!newTemplate) {
          throw new AppError(
            409,
            "No active agreement template is configured",
            "TEMPLATE_NOT_CONFIGURED",
          );
        }
        template = newTemplate;
      }
      const creatorId = req.auth?.userId;
      let validCreatedBy: string | null = null;
      if (creatorId) {
        const { data: userProfile } = await admin
          .from("profiles")
          .select("id")
          .eq("id", creatorId)
          .maybeSingle();
        if (userProfile) validCreatedBy = creatorId;
      }
      const { data, error } = await admin
        .from("agreements")
        .insert({
          agreement_number: number("AGR"),
          customer_id: agreementCustomerId,
          quotation_id: validQuotationId,
          template_id: template.id,
          status: "Draft",
          payment_status: "Unpaid",
          payment_amount: 1,
          customer_signature_path: b.customerSignaturePath || null,
          merged_data: {
            consumer_address: b.consumerAddress,
            agreement_date: b.agreementDate,
            payment_terms: b.paymentTerms || null,
            template_version: template.version,
          },
          created_by: validCreatedBy,
        })
        .select()
        .single();
      if (error) {
        console.error("Supabase insert agreement error:", JSON.stringify(error));
        throw new AppError(
          error.code === "23503" ? 422 : 400,
          error.message || "Failed to insert agreement",
          "DATABASE_ERROR",
        );
      }
      return success(res.status(201), "Agreement draft created", data);
    } catch (err) {
      console.error("Error creating agreement:", err);
      if (err instanceof AppError) throw err;
      throw new AppError(
        500,
        err instanceof Error ? err.message : "Unable to create agreement",
        "AGREEMENT_CREATION_FAILED",
      );
    }
  }),
);
agreementsRouter.delete(
  "/:id",
  requirePermission("agreements:delete"),
  asyncHandler(async (req, res) => {
    if (req.auth!.roles.includes("customer"))
      throw new AppError(
        403,
        "Customers cannot delete agreements",
        "FORBIDDEN",
      );
    const admin = db();
    const { data: existing, error: findError } = await admin
      .from("agreements")
      .select("id,agreement_number")
      .eq("id", req.params.id)
      .maybeSingle();
    if (findError) throw new AppError(400, findError.message, "DATABASE_ERROR");
    if (!existing)
      throw new AppError(404, "Agreement not found", "NOT_FOUND");

    const { error: deleteError } = await admin
      .from("agreements")
      .delete()
      .eq("id", req.params.id);
    if (deleteError)
      throw new AppError(400, deleteError.message, "DATABASE_ERROR");

    return success(res, "Agreement deleted successfully", { id: req.params.id });
  }),
);

export const profileRouter = Router();
profileRouter.use(requireAuth);
profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const { fullName, phone } = req.body;
    if (!fullName)
      throw new AppError(400, "Full name is required", "VALIDATION_ERROR");
    const { data, error } = await db()
      .from("profiles")
      .update({ full_name: fullName, phone: phone || null })
      .eq("id", req.auth!.userId)
      .select()
      .single();
    if (error) throw error;
    return success(res, "Profile updated", data);
  }),
);
profileRouter.post(
  "/password",
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || String(newPassword).length < 10)
      throw new AppError(
        400,
        "Current password and a 10-character new password are required",
        "VALIDATION_ERROR",
      );
    const admin = db(),
      anon = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
    const { error: verify } = await anon.auth.signInWithPassword({
      email: req.auth!.email,
      password: currentPassword,
    });
    if (verify)
      throw new AppError(
        400,
        "Current password is incorrect",
        "INVALID_PASSWORD",
      );
    const { error } = await admin.auth.admin.updateUserById(req.auth!.userId, {
      password: newPassword,
    });
    if (error) throw error;
    return success(res, "Password changed", { changed: true });
  }),
);
