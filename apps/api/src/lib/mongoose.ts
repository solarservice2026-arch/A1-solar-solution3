import mongoose from "mongoose";
import dns from "node:dns";

try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch {
  // fallback if DNS setting isn't permitted in current runtime
}

let connectionPromise: Promise<typeof mongoose> | null = null;

const fullPermissions = [
  "users:view", "users:create", "users:update", "users:disable", "users:remove", "users:assign_roles",
  "roles:view", "roles:assign_permissions",
  "business:view", "business:update",
  "leads:view", "leads:create", "leads:update",
  "quotations:view", "quotations:create", "quotations:update",
  "agreements:view", "agreements:create", "agreements:update",
  "invoices:view", "invoices:create", "invoices:update",
  "installations:view", "installations:update",
  "technicians:view", "technicians:update",
  "payments:view", "payments:verify",
  "dashboard:view", "customers:view", "products:view", "projects:view", "tickets:view"
];

export async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    }).then(async (m) => {
      try {
        const db = m.connection.db;
        if (db) {
          const count = await db.collection("roles").countDocuments();
          if (count === 0) {
            console.log("[MongoDB] Seeding roles and permissions...");
            const permissionsList = fullPermissions.map((key) => ({
              key,
              description: `Permission to ${key.replace(":", " ")}`
            }));
            const permResult = await db.collection("permissions").insertMany(permissionsList);
            const permIds = Object.values(permResult.insertedIds);
            
            const rolesList = [
              { name: "super_admin", description: "Primary Super Admin" },
              { name: "admin", description: "A1 Solar Admin" },
              { name: "manager", description: "Sales Manager" },
              { name: "sales_executive", description: "Sales Executive User" },
              { name: "installation_staff", description: "Installation Staff User" },
              { name: "service_technician", description: "Service Technician User" },
              { name: "accountant", description: "Finance & Accounts User" },
              { name: "customer", description: "Rohan Sharma (Customer)" },
            ];
            
            for (const r of rolesList) {
              const rDoc = await db.collection("roles").insertOne(r);
              let assignedPerms: any[] = [];
              if (r.name === "super_admin" || r.name === "admin") {
                assignedPerms = permissionsList.map((p, idx) => ({
                  role_id: rDoc.insertedId.toString(),
                  permission_id: permIds[idx].toString(),
                  permissions: p
                }));
              } else if (r.name === "installation_staff") {
                const targets = ["dashboard:view", "projects:view", "projects:update", "quotations:view", "agreements:view", "invoices:view"];
                assignedPerms = permissionsList
                  .filter(p => targets.includes(p.key))
                  .map((p) => ({
                    role_id: rDoc.insertedId.toString(),
                    permission_id: permIds[permissionsList.indexOf(p)].toString(),
                    permissions: p
                  }));
              } else if (r.name === "service_technician") {
                const targets = ["dashboard:view", "tickets:view", "tickets:update", "quotations:view", "agreements:view", "invoices:view"];
                assignedPerms = permissionsList
                  .filter(p => targets.includes(p.key))
                  .map((p) => ({
                    role_id: rDoc.insertedId.toString(),
                    permission_id: permIds[permissionsList.indexOf(p)].toString(),
                    permissions: p
                  }));
              } else if (r.name === "accountant") {
                const targets = ["dashboard:view", "customers:view", "quotations:view", "agreements:view", "invoices:view", "invoices:create", "invoices:update", "payments:view", "payments:verify"];
                assignedPerms = permissionsList
                  .filter(p => targets.includes(p.key))
                  .map((p) => ({
                    role_id: rDoc.insertedId.toString(),
                    permission_id: permIds[permissionsList.indexOf(p)].toString(),
                    permissions: p
                  }));
              } else {
                const targets = ["agreements:view", "payments:create"];
                assignedPerms = permissionsList
                  .filter(p => targets.includes(p.key))
                  .map((p) => ({
                    role_id: rDoc.insertedId.toString(),
                    permission_id: permIds[permissionsList.indexOf(p)].toString(),
                    permissions: p
                  }));
              }
              if (assignedPerms.length > 0) {
                await db.collection("role_permissions").insertMany(assignedPerms);
              }
            }
            console.log("[MongoDB] Seeding completed successfully!");
          }
        }
      } catch (err: any) {
        console.error("[MongoDB] Seeding error:", err.message);
      }
      return m;
    }).catch((err) => {
      connectionPromise = null;
      console.error("[MongoDB] Connection error:", err.message);
      throw err;
    });
  }
  return connectionPromise;
}
