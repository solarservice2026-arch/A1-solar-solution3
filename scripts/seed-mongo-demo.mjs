import mongoose from "mongoose";
import dns from "node:dns";

try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch {}

const uri = process.env.MONGODB_URI || "mongodb+srv://solarservice2026_db_user:3mBhnK31EaekXW0g@cluster0.wfuspha.mongodb.net/a1solar?retryWrites=true&w=majority&appName=Cluster0";

console.log("Connecting to MongoDB Atlas...");
await mongoose.connect(uri);
console.log("Connected to database:", mongoose.connection.name);

const db = mongoose.connection.db;

// 1. Users Collection
console.log("Seeding users collection...");
await db.collection("users").deleteMany({});
await db.collection("users").insertMany([
  {
    name: "Super Admin",
    email: "a1-e2e-super-admin@example.test",
    role: "super_admin",
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "Admin User",
    email: "a1-e2e-admin@example.test",
    role: "admin",
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "Manager User",
    email: "a1-e2e-manager@example.test",
    role: "manager",
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "Sales Executive",
    email: "a1-e2e-sales@example.test",
    role: "sales_executive",
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "Installation Staff",
    email: "a1-e2e-installer@example.test",
    role: "installation_staff",
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "Service Technician",
    email: "a1-e2e-technician@example.test",
    role: "service_technician",
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "Accountant",
    email: "a1-e2e-accountant@example.test",
    role: "accountant",
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "Rajesh Kumar",
    email: "a1-e2e-customer-a@example.test",
    role: "customer",
    status: "Active",
    created_at: new Date(),
  },
]);

// 2. Customers Collection
console.log("Seeding customers collection...");
await db.collection("customers").deleteMany({});
const custResult = await db.collection("customers").insertMany([
  {
    customer_number: "CUS-202601",
    name: "Rajesh Kumar",
    mobile: "9876543210",
    email: "a1-e2e-customer-a@example.test",
    customer_type: "Residential",
    address: "Vishnupur Kaiju Patehpur, Vaishali, Bihar",
    city: "Vaishali",
    state: "Bihar",
    pincode: "844101",
    status: "Active",
    created_at: new Date(),
  },
  {
    customer_number: "CUS-202602",
    name: "Sunita Sharma",
    mobile: "9876543211",
    email: "a1-e2e-customer-b@example.test",
    customer_type: "Residential",
    address: "Boring Road, Patna, Bihar",
    city: "Patna",
    state: "Bihar",
    pincode: "800001",
    status: "Active",
    created_at: new Date(),
  },
  {
    customer_number: "CUS-202603",
    name: "Apex Solar Industries",
    mobile: "9876543212",
    email: "contact@apexindustries.test",
    customer_type: "Commercial",
    address: "Industrial Area, Hajipur, Bihar",
    city: "Hajipur",
    state: "Bihar",
    pincode: "844102",
    status: "Active",
    created_at: new Date(),
  },
]);

// 3. Products Collection
console.log("Seeding products collection...");
await db.collection("products").deleteMany({});
const prodResult = await db.collection("products").insertMany([
  {
    name: "Mono PERC Solar Panel 400W",
    brand: "Waaree",
    model: "WS-400",
    category: "Solar Panel",
    unit: "Piece",
    price: 12000,
    gst_rate: 12,
    stock_quantity: 150,
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "Bifacial Solar Module 540W",
    brand: "Adani Solar",
    model: "AS-540",
    category: "Solar Panel",
    unit: "Piece",
    price: 16500,
    gst_rate: 12,
    stock_quantity: 80,
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "On-Grid String Inverter 3kW",
    brand: "Growatt",
    model: "MIN-3000TL-X",
    category: "Inverter",
    unit: "Piece",
    price: 28000,
    gst_rate: 18,
    stock_quantity: 25,
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "Three-Phase Solar Inverter 10kW",
    brand: "Sungrow",
    model: "SG10RT",
    category: "Inverter",
    unit: "Piece",
    price: 72000,
    gst_rate: 18,
    stock_quantity: 10,
    status: "Active",
    created_at: new Date(),
  },
  {
    name: "Aluminum Solar Panel Mounting Structure",
    brand: "A1 Structural",
    model: "STR-3KW",
    category: "Structure",
    unit: "Set",
    price: 8500,
    gst_rate: 18,
    stock_quantity: 50,
    status: "Active",
    created_at: new Date(),
  },
]);

// 4. Projects Collection
console.log("Seeding projects collection...");
await db.collection("projects").deleteMany({});
await db.collection("projects").insertMany([
  {
    project_number: "PRJ-2026-001",
    customer_id: custResult.insertedIds[0],
    customer_name: "Rajesh Kumar",
    system_type: "On-Grid",
    capacity_kw: 3.0,
    site_address: "Vishnupur Kaiju Patehpur, Vaishali, Bihar",
    status: "In Progress",
    stage: "Structure Installation",
    total_cost: 155000,
    paid_amount: 80000,
    created_at: new Date(),
  },
  {
    project_number: "PRJ-2026-002",
    customer_id: custResult.insertedIds[2],
    customer_name: "Apex Solar Industries",
    system_type: "Commercial Rooftop",
    capacity_kw: 25.0,
    site_address: "Industrial Area, Hajipur, Bihar",
    status: "Approved",
    stage: "Site Survey Complete",
    total_cost: 1125000,
    paid_amount: 500000,
    created_at: new Date(),
  },
]);

// 5. Quotations Collection
console.log("Seeding quotations collection...");
await db.collection("quotations").deleteMany({});
await db.collection("quotations").insertMany([
  {
    quotation_number: "QUO-20260731-01",
    customer_id: custResult.insertedIds[0],
    customer_name: "Rajesh Kumar",
    capacity_kw: 3,
    subtotal: 135000,
    discount: 5000,
    tax: 15600,
    grand_total: 145600,
    status: "Approved",
    quotation_date: "2026-07-31",
    valid_until: "2026-08-31",
    created_at: new Date(),
  },
]);

// 6. Agreements Collection
console.log("Seeding agreements collection...");
await db.collection("agreements").deleteMany({});
await db.collection("agreements").insertMany([
  {
    agreement_number: "AGR-20260731-01",
    customer_id: custResult.insertedIds[0],
    customer_name: "Rajesh Kumar",
    payment_status: "Paid",
    status: "Signed",
    payment_amount: 145600,
    consumer_address: "Vishnupur Kaiju Patehpur, Vaishali, Bihar",
    created_at: new Date(),
  },
]);

// 7. Enquiries Collection
console.log("Seeding enquiries collection...");
await db.collection("enquiries").deleteMany({});
await db.collection("enquiries").insertMany([
  {
    name: "Amit Verma",
    email: "amit.verma@example.test",
    phone: "9988776655",
    city: "Patna",
    monthly_bill: "₹3,000 - ₹5,000",
    type: "Residential Solar System",
    message: "Interested in installing a 5kW solar panel system under PM Surya Ghar Yojana.",
    status: "New",
    created_at: new Date(),
  },
]);

console.log("\n==============================================");
console.log("SUCCESS: MongoDB Atlas collections & demo data seeded!");
console.log("Collections populated:");
const collections = await db.listCollections().toArray();
for (const col of collections) {
  const count = await db.collection(col.name).countDocuments();
  console.log(` - ${col.name}: ${count} documents`);
}
console.log("==============================================\n");

await mongoose.disconnect();
