import { Router } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { asyncHandler, AppError, success } from "../lib/http.js";
import { connectMongoDB } from "../lib/mongoose.js";
import {
  requireAnyPermission,
  requireAuth,
  requirePermission,
} from "../auth/middleware.js";

const getMongoDb = async () => {
  if (!process.env.MONGODB_URI) throw new AppError(503, "MongoDB is not configured", "SERVICE_UNAVAILABLE");
  await connectMongoDB();
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return mongoose.connection.db;
  }
  throw new AppError(503, "Database connection failed", "SERVICE_UNAVAILABLE");
};

;
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




export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get(
  "/",
  requirePermission("dashboard:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const counts: Record<string, number> = {
      leads: await mongo.collection("enquiries").countDocuments(),
      customers: await mongo.collection("customers").countDocuments(),
      quotations: await mongo.collection("quotations").countDocuments(),
      invoices: await mongo.collection("agreements").countDocuments(),
      products: await mongo.collection("products").countDocuments(),
      staff: await mongo.collection("users").countDocuments(),
    };
    return success(res, "Dashboard retrieved", counts);
  }),
);

export const customersRouter = Router();
customersRouter.use(requireAuth);
customersRouter.get(
  "/",
  requirePermission("customers:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    let query: any = {};
    if (req.query.search) {
      const s = String(req.query.search).trim();
      query = {
        $or: [
          { name: { $regex: s, $options: "i" } },
          { mobile: { $regex: s, $options: "i" } },
          { customer_number: { $regex: s, $options: "i" } },
        ],
      };
    }
    const items = await mongo.collection("customers").find(query).sort({ created_at: -1 }).toArray();
    const formatted = items.map((item) => ({ id: item._id.toString(), ...item }));
    return success(res, "Customers retrieved", formatted);
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

    const mongo = await getMongoDb();
    let profileId: string | null = null;
    if (b.email) {
      const email = String(b.email).trim().toLowerCase();
      const existingUser = await mongo.collection("users").findOne({ email });
      
      let userIdObj = existingUser?._id;
      const hash = b.password && String(b.password).trim().length >= 6
        ? bcryptjs.hashSync(String(b.password).trim(), 10)
        : null;

      if (!existingUser) {
        const userDoc = {
          name: b.name,
          email,
          role: "customer",
          status: "Active",
          created_at: new Date(),
          password_hash: hash || bcryptjs.hashSync("customer123", 10),
        };
        const userRes = await mongo.collection("users").insertOne(userDoc);
        userIdObj = userRes.insertedId;
      } else if (hash) {
        await mongo.collection("users").updateOne(
          { _id: existingUser._id },
          { $set: { password_hash: hash } }
        );
      }
      
      if (userIdObj) {
        profileId = userIdObj.toString();
      }
    }

    const doc = {
      customer_number: number("CUS"),
      profile_id: profileId,
      name: b.name,
      mobile: b.mobile,
      email: b.email || null,
      customer_type: b.customerType || "Residential",
      gst_number: b.gstNumber || null,
      consumer_number: b.consumerNumber || null,
      provider: b.provider || null,
      status: "Active",
      created_at: new Date(),
    };
    const result = await mongo.collection("customers").insertOne(doc);
    const createdCustomer = { id: result.insertedId.toString(), ...doc };

    return success(res.status(201), "Customer created", createdCustomer);
  })
);,
);
customersRouter.delete(
  "/:id",
  requirePermission("customers:delete"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const { ObjectId } = await import("mongodb");
    try {
      await mongo.collection("customers").deleteOne({ _id: new ObjectId(idStr) });
    } catch {
      await mongo.collection("customers").deleteOne({ customer_number: idStr });
    }
    return success(res, "Customer deleted", { id: idStr });
  }),
);

export const productsRouter = Router();
productsRouter.use(requireAuth);
productsRouter.get(
  "/",
  requireAnyPermission("products:view", "quotations:create", "invoices:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    let query: any = {};
    if (req.query.search) {
      const s = String(req.query.search).trim();
      query = {
        $or: [
          { name: { $regex: s, $options: "i" } },
          { sku: { $regex: s, $options: "i" } },
          { brand: { $regex: s, $options: "i" } },
        ],
      };
    }
    const items = await mongo.collection("products").find(query).sort({ created_at: -1 }).toArray();
    const formatted = items.map((item) => ({ id: item._id.toString(), ...item }));
    return success(res, "Products retrieved", formatted);
  }),
);
productsRouter.post(
  "/",
  requirePermission("products:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const doc = {
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
      created_at: new Date(),
    };
    const result = await mongo.collection("products").insertOne(doc);
    const createdProduct = { id: result.insertedId.toString(), ...doc };
    return success(res.status(201), "Product created", createdProduct);
  }),
);
productsRouter.delete(
  "/:id",
  requirePermission("products:delete"),
  asyncHandler(async (req, res) => {
    const { error } = await db()
      .from("products")
      .delete()
      .eq("id", req.params.id);
    if (error) {
      if (error.code === "23503") {
        throw new AppError(
          409,
          "Product has linked business records and cannot be deleted",
          "DATABASE_ERROR",
        );
      }
      throw new AppError(400, error.message, "DATABASE_ERROR");
    }
    return success(res, "Product deleted", null);
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
    const mongo = await getMongoDb();

    const items = await mongo.collection("quotations").find({ status: { $ne: "Archived" } }).sort({ created_at: -1 }).toArray();
    const customers = await mongo.collection("customers").find().toArray();
    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
    const formatted = items.map((q) => {
      const c = customerMap.get(String(q.customer_id));
      return {
        id: q._id.toString(),
        ...q,
        customers: c ? { name: c.name, mobile: c.mobile } : { name: q.customer_name || "Customer", mobile: "" },
        quotation_items: q.quotation_items || q.items || [],
      };
    });
    return success(res, "Quotations retrieved", formatted);
  }),
);
quotationsRouter.post(
  "/",
  requirePermission("quotations:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    let customerName = "Customer";
    try {
      const { ObjectId } = await import("mongodb");
      const cDoc = await mongo.collection("customers").findOne({ _id: new ObjectId(b.customerId) });
      if (cDoc) customerName = cDoc.name;
    } catch {
      const cDoc = await mongo.collection("customers").findOne({ customer_number: b.customerId });
      if (cDoc) customerName = cDoc.name;
    }

    const qDoc = {
      quotation_number: number("QUO"),
      customer_id: b.customerId,
      customer_name: customerName,
      quotation_date: b.quotationDate || new Date().toISOString().slice(0, 10),
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
      status: "Draft",
      quotation_items: normalized,
      created_at: new Date(),
    };
    const result = await mongo.collection("quotations").insertOne(qDoc);
    const createdQuotation = { id: result.insertedId.toString(), ...qDoc, customers: { name: customerName } };
    return success(res.status(201), "Quotation created", createdQuotation);
  }),
);
quotationsRouter.delete(
  "/:id",
  requirePermission("quotations:delete"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const { ObjectId } = await import("mongodb");
    try {
      await mongo.collection("quotations").updateOne({ _id: new ObjectId(idStr) }, { $set: { status: "Archived" } });
    } catch {
      await mongo.collection("quotations").updateOne({ quotation_number: idStr }, { $set: { status: "Archived" } });
    }
    return success(res, "Quotation deleted", { id: idStr });
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
    const mongo = await getMongoDb();

    let filter = {};
    const isCustomer = req.auth!.roles.includes("customer");
    if (isCustomer) {
      const custObj = await mongo.collection("customers").findOne({
        email: { $regex: new RegExp("^" + req.auth!.email.trim() + "$", "i") }
      });
      if (custObj) {
        filter = {
          $or: [
            { customer_id: custObj._id },
            { customer_id: custObj._id.toString() }
          ]
        };
      } else {
        return success(res, "Agreements retrieved", []);
      }
    }
    const items = await mongo.collection("agreements").find(filter).sort({ created_at: -1 }).toArray();
    const customers = await mongo.collection("customers").find().toArray();
    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
    const formatted = items.map((a: any) => {
      const c = customerMap.get(String(a.customer_id));
      const base: any = {
        id: a._id.toString(),
        ...a,
        customers: c ? { name: c.name, mobile: c.mobile } : { name: a.customer_name || "Customer" },
      };
      if (isCustomer && a.payment_status !== "Paid") {
        return {
          id: base.id,
          agreement_number: base.agreement_number,
          created_at: base.created_at,
          payment_status: base.payment_status,
          payment_amount: base.payment_amount,
          customers: base.customers ? { name: base.customers.name } : null,
          locked: true,
        };
      }
      return base;
    });
    return success(res, "Agreements retrieved", formatted);
  }),
);
agreementsRouter.post(
  "/:id/test-payment",
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const { ObjectId } = await import("mongodb");
    let filter: any = { agreement_number: idStr };
    try {
      if (idStr.length === 24) filter = { _id: new ObjectId(idStr) };
    } catch {}
    await mongo.collection("agreements").updateOne(filter, {
      $set: { payment_status: "Paid", paid_at: new Date().toISOString() }
    });
    return success(res, "Test payment completed successfully", { paid: true });
  }),
);
agreementsRouter.get(
  "/:id/document",
  requirePermission("agreements:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const { ObjectId } = await import("mongodb");
    let filter: any = { agreement_number: idStr };
    try {
      if (idStr.length === 24) filter = { _id: new ObjectId(idStr) };
    } catch {}

    if (req.auth!.roles.includes("customer")) {
      const custObj = await mongo.collection("customers").findOne({ email: req.auth!.email.trim().toLowerCase() });
      if (custObj) {
        filter = { ...filter, customer_id: custObj._id };
      } else {
        throw new AppError(403, "Access denied", "FORBIDDEN");
      }
    }

    const agreement = await mongo.collection("agreements").findOne(filter);
    if (!agreement) throw new AppError(404, "Agreement not found", "NOT_FOUND");

    if (req.auth!.roles.includes("customer") && agreement.payment_status !== "Paid") {
      throw new AppError(
        402,
        "Verified payment is required before viewing or downloading this agreement",
        "PAYMENT_REQUIRED",
      );
    }
    const c = await mongo.collection("customers").findOne({ _id: agreement.customer_id });
    return success(res, "Agreement document retrieved", {
      id: agreement._id.toString(),
      ...agreement,
      customers: c ? { name: c.name, mobile: c.mobile } : { name: agreement.customer_name || "Customer" },
    });
  }),
);
agreementsRouter.post(
  "/:id/payu-checkout",
  requirePermission("payments:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const { ObjectId } = await import("mongodb");
    const custObj = await mongo.collection("customers").findOne({
      email: { $regex: new RegExp("^" + req.auth!.email.trim() + "$", "i") }
    });
    if (!custObj) throw new AppError(404, "Customer profile not found", "NOT_FOUND");
    
    const agreementIdStr = String(req.params.id);
    let filter: any = { customer_id: custObj._id };
    try {
      if (agreementIdStr.length === 24) {
        filter = { _id: new ObjectId(agreementIdStr), customer_id: custObj._id };
      } else {
        filter = { agreement_number: agreementIdStr, customer_id: custObj._id };
      }
    } catch {}

    agreement = await mongo.collection("agreements").findOne(filter);
    if (!agreement) throw new AppError(404, "Agreement not found", "NOT_FOUND");
    customer = custObj;
    cid = custObj._id.toString();
  }),
);
agreementsRouter.post(
  "/:id/payment-request",
  requirePermission("payments:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const { ObjectId } = await import("mongodb");
    const custObj = await mongo.collection("customers").findOne({
      email: { $regex: new RegExp("^" + req.auth!.email.trim() + "$", "i") }
    });
    if (!custObj) throw new AppError(404, "Customer profile not found", "NOT_FOUND");
    
    const agreementIdStr = String(req.params.id);
    let filter: any = { customer_id: custObj._id };
    try {
      if (agreementIdStr.length === 24) {
        filter = { _id: new ObjectId(agreementIdStr), customer_id: custObj._id };
      } else {
        filter = { agreement_number: agreementIdStr, customer_id: custObj._id };
      }
    } catch {}

    const agreement = await mongo.collection("agreements").findOne(filter);
    if (!agreement) throw new AppError(404, "Agreement not found", "NOT_FOUND");
    if (agreement.payment_status === "Paid")
      return success(res, "Agreement payment already verified", agreement);

    if (!transactionReference || !method)
      throw new AppError(
        400,
        "Payment method and transaction reference are required",
        "VALIDATION_ERROR",
      );

    const requestDoc = {
      agreement_id: agreement._id.toString(),
      customer_id: custObj._id.toString(),
      amount: agreement.payment_amount,
      method,
      transaction_reference: transactionReference,
      status: "Pending",
      submitted_at: new Date(),
    };

    await mongo.collection("agreement_payment_requests").replaceOne(
      { agreement_id: agreement._id.toString() },
      requestDoc,
      { upsert: true }
    );

    await mongo.collection("agreements").updateOne(
      { _id: agreement._id },
      { $set: { payment_status: "Pending Verification" } }
    );

    return success(res.status(201), "Payment submitted for verification", requestDoc);
  }),
);

export const payuCallback = asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

  request = await mongo.collection("agreement_payment_requests").findOne({
    transaction_reference: txnid,
  });
  });
agreementsRouter.post(
  "/:id/verify-payment",
  requirePermission("payments:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const request = await mongo.collection("agreement_payment_requests").findOne({
      agreement_id: req.params.id,
      status: "Pending",
    });
    if (!request)
      throw new AppError(404, "Pending payment request not found", "NOT_FOUND");

    await mongo.collection("agreement_payment_requests").updateOne(
      { _id: request._id },
      {
        $set: {
          status: "Verified",
          verified_by: req.auth!.userId,
          verified_at: new Date(),
        },
      }
    );

    const { ObjectId } = await import("mongodb");
    let agreementFilter = {};
    try {
      agreementFilter = { _id: new ObjectId(String(req.params.id)) };
    } catch {
      agreementFilter = { agreement_number: String(req.params.id) };
    }
    await mongo.collection("agreements").updateOne(
      agreementFilter,
      { $set: { payment_status: "Paid", paid_at: new Date() } }
    );

    return success(res, "Agreement payment verified", { paid: true });
  }),
);
agreementsRouter.post(
  "/",
  requirePermission("agreements:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

      const { ObjectId } = await import("mongodb");
      // Resolve customer name
      let customerName = "Customer";
      let customObjId: any = null;
      try {
        customObjId = new ObjectId(agreementCustomerId);
        const cust = await mongo.collection("customers").findOne({ _id: customObjId });
        if (cust) customerName = String(cust.name ?? "Customer");
      } catch { /* id may not be ObjectId */ }

      // Find related quotation
      let quotationId: any = null;
      if (b.quotationId && String(b.quotationId).trim() !== "") {
        try {
          quotationId = new ObjectId(String(b.quotationId));
        } catch { quotationId = b.quotationId; }
      }

      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const agreementNumber = `AGR-${dateStr}-${rand}`;

      const doc: Record<string, any> = {
        agreement_number: agreementNumber,
        customer_id: customObjId ?? agreementCustomerId,
        customer_name: customerName,
        quotation_id: quotationId,
        status: "Draft",
        payment_status: "Unpaid",
        payment_amount: 1,
        consumer_address: b.consumerAddress,
        customer_signature_path: b.customerSignaturePath || null,
        merged_data: {
          consumer_address: b.consumerAddress,
          agreement_date: b.agreementDate,
          payment_terms: b.paymentTerms || null,
        },
        created_at: today.toISOString(),
        updated_at: today.toISOString(),
      };
      const result = await mongo.collection("agreements").insertOne(doc);
      return success(res.status(201), "Agreement draft created", {
        ...doc,
        id: result.insertedId.toString(),
        _id: result.insertedId.toString(),
        customers: { name: customerName },
      });
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
