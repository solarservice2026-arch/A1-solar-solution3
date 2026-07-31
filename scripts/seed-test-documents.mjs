/**
 * Seed test quotations and agreements in the live database.
 * Run: node --env-file=.env scripts/seed-test-documents.mjs
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const randNum = (prefix, n = 6) =>
  `${prefix}-${Date.now().toString().slice(-n)}${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`;

const fail = (msg, err) => { console.error("✗", msg, err?.message ?? err); process.exit(1); };
const today = new Date().toISOString().slice(0, 10);
const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// ── 1. Find or create customer ────────────────────────────────────────────
console.log("\n📋 Looking for customers…");
let { data: customers, error: cErr } = await db.from("customers").select("id,name,customer_number").limit(3);
if (cErr) fail("list customers", cErr);

let customer;
if (customers?.length) {
  customer = customers[0];
  console.log(`  ✓ Using: ${customer.name} (${customer.customer_number})`);
} else {
  const { data: cust, error } = await db.from("customers").insert({
    customer_number: randNum("CUS"),
    name: "Demo Customer",
    mobile: "7739661147",
    email: "demo.customer@a1solar.test",
    customer_type: "Residential",
    status: "Active",
  }).select().single();
  if (error) fail("create customer", error);
  customer = cust;
  console.log(`  ✓ Created: ${customer.name} (${customer.customer_number})`);
}

// ── 2. Find or create product ─────────────────────────────────────────────
let { data: products } = await db.from("products").select("id,name").limit(1);
let productId;
if (products?.length) {
  productId = products[0].id;
  console.log(`  ✓ Product: ${products[0].name}`);
} else {
  const { data: prod, error } = await db.from("products").insert({
    name: "Solar Panel 400W Mono",
    brand: "Waaree",
    model: "WS-400",
    category: "Solar Panel",
    unit: "Piece",
    price: 12000,
    gst_rate: 12,
    status: "Active",
  }).select().single();
  if (error) fail("create product", error);
  productId = prod.id;
  console.log(`  ✓ Created product: ${prod.name}`);
}

// ── 3. Create Quotation ───────────────────────────────────────────────────
console.log("\n📄 Creating quotation…");
const { data: quotation, error: qErr } = await db.from("quotations").insert({
  quotation_number: randNum("Q"),
  customer_id: customer.id,
  quotation_date: today,
  valid_until: future,
  capacity_kw: 3,
  status: "Approved",
  subtotal: 36000,
  discount: 0,
  tax: 4320,
  grand_total: 40320,
  terms: "50% advance, balance on commissioning",
}).select().single();
if (qErr) fail("create quotation", qErr);
console.log(`  ✓ Quotation: ${quotation.quotation_number}`);

// ── 4. Quotation Items ────────────────────────────────────────────────────
const { error: qiErr } = await db.from("quotation_items").insert({
  quotation_id: quotation.id,
  product_id: productId,
  description: "3 kW Solar Rooftop System (8 × 400W Mono panels + 3 kW inverter)",
  quantity: 1,
  unit_price: 40320,
  gst_rate: 12,
  amount: 40320,
});
if (qiErr) console.warn("  ⚠ Quotation items:", qiErr.message);
else console.log("  ✓ Quotation item added");

// ── 5. Create Agreement ───────────────────────────────────────────────────
console.log("\n📜 Creating agreement…");

// Check if agreements table has gst_amount or payment_amount
const { data: agSample } = await db.from("agreements").select("*").limit(1);
const agColumns = agSample?.[0] ? Object.keys(agSample[0]) : [];
console.log("  Agreement columns:", agColumns.join(", ") || "(none – inserting with payment_amount)");

const agPayload = {
  agreement_number: randNum("AGR"),
  customer_id: customer.id,
  quotation_id: quotation.id,
  payment_status: "Paid",
  merged_data: {
    consumer_address: "VISHNUPUR KAIJU PATEHPUR VAISHALI BIHA",
    agreement_date: today,
    payment_terms: "50% advance, 50% on commissioning",
    capacity_kw: 3,
    system_cost: 40320,
  },
};

// Try adding payment_amount if column exists
if (agColumns.includes("payment_amount") || agColumns.length === 0) {
  agPayload.payment_amount = 40320;
}
if (agColumns.includes("status") || agColumns.length === 0) {
  agPayload.status = "Signed";
}

const { data: agreement, error: agErr } = await db.from("agreements").insert(agPayload).select().single();
if (agErr) fail("create agreement", agErr);
console.log(`  ✓ Agreement: ${agreement.agreement_number}`);

// ── 6. Summary ────────────────────────────────────────────────────────────
console.log(`
╔═══════════════════════════════════════════════╗
║         TEST DATA SEEDED SUCCESSFULLY         ║
╠═══════════════════════════════════════════════╣
║  Customer   : ${customer.name.padEnd(29)}║
║  Customer # : ${customer.customer_number.padEnd(29)}║
║  Quotation  : ${quotation.quotation_number.padEnd(29)}║
║  Agreement  : ${agreement.agreement_number.padEnd(29)}║
║  Amount     : ₹40,320 (PAID)                 ║
╚═══════════════════════════════════════════════╝
`);
