import { BarChart3, FileText, Package, Settings, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import {
  agreementDocument,
  invoiceDocument,
  quotationDocument,
} from "../documents/templates";

type Row = Record<string, unknown>;
const text = (v: unknown) => (v == null ? "—" : String(v));
const money = (v: unknown) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const formObject = (form: HTMLFormElement) => {
  const result: Record<string, FormDataEntryValue> = {};
  new FormData(form).forEach((value, key) => {
    result[key] = value;
  });
  return result;
};
const printRecord = (title: string, row: Row) => {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return toast.error("Allow pop-ups to print PDF");
  const html =
    title === "Quotation"
      ? quotationDocument(row)
      : title === "Agreement"
        ? agreementDocument(row)
        : invoiceDocument(row);
  popup.document.write(html);
  popup.document.close();
};

function DataPage({
  title,
  kicker,
  description,
  path,
  permission,
  columns,
  fields,
  icon,
  printable = false,
  deletePermission,
}: {
  title: string;
  kicker: string;
  description: string;
  path: string;
  permission: string;
  columns: Array<[string, string, ((v: unknown) => string)?]>;
  fields?: Array<[string, string, string, string[]?]>;
  icon: React.ReactNode;
  printable?: boolean;
  deletePermission?: string;
}) {
  const { user } = useAuth(),
    [rows, setRows] = useState<Row[]>([]),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true),
    [open, setOpen] = useState(false);
  const canCreate =
    user?.roles.includes("super_admin") ||
    user?.permissions.includes(permission);
  const canDelete = Boolean(
    deletePermission &&
    (user?.roles.includes("super_admin") ||
      user?.permissions.includes(deletePermission)),
  );
  const load = async () => {
    setLoading(true);
    try {
      setRows(
        await api<Row[]>(
          `${path}${search ? `?search=${encodeURIComponent(search)}` : ""}`,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [path]);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = formObject(e.currentTarget);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      toast.success(`${title.slice(0, -1)} created`);
      setOpen(false);
      await load();
    } catch (x) {
      toast.error(x instanceof Error ? x.message : "Unable to create");
    }
  };
  const remove = async (row: Row) => {
    if (
      !confirm(
        `Delete ${title.slice(0, -1).toLowerCase()} ${text(row.name ?? row.customer_number ?? row.id)}?`,
      )
    )
      return;
    try {
      await api(`${path}/${text(row.id)}`, { method: "DELETE" });
      toast.success(`${title.slice(0, -1)} deleted`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete");
    }
  };
  return (
    <main className="app-page">
      <div className="page-bar">
        <div>
          <span className="kicker">{kicker}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {canCreate && fields && (
          <button className="primary" onClick={() => setOpen(!open)}>
            {open ? "Close" : `Add ${title.slice(0, -1)}`}
          </button>
        )}
      </div>
      {open && fields && (
        <form className="card operational-form" onSubmit={submit}>
          {fields.map(([name, label, type, options]) => (
            <label key={name}>
              {label}
              {type === "select" && options ? (
                <select name={name} required>
                  {options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={name}
                  type={type}
                  placeholder={type === "password" ? "Set login password for customer" : undefined}
                  required={
                    ![
                      "email",
                      "password",
                      "gstNumber",
                      "consumerNumber",
                      "provider",
                      "brand",
                      "model",
                    ].includes(name)
                  }
                />
              )}
            </label>
          ))}
          <button className="primary">Save</button>
        </form>
      )}
      <div className="toolbar">
        <input
          aria-label={`Search ${title}`}
          placeholder={`Search ${title.toLowerCase()}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => void load()}>Search</button>
      </div>
      {loading ? (
        <div className="skeleton">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          {icon}
          <h2>No {title.toLowerCase()} yet</h2>
          <p>Use the action above to create the first record.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c[0]}>{c[1]}</th>
                ))}
                {(printable || canDelete) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={text(r.id) || i}>
                  {columns.map(([key, , format]) => (
                    <td key={key}>{format ? format(r[key]) : text(r[key])}</td>
                  ))}
                  {(printable || canDelete) && (
                    <td>
                      <div className="row-actions">
                        {printable && (
                          <button
                            onClick={() => printRecord(title.slice(0, -1), r)}
                          >
                            Print / PDF
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="danger"
                            onClick={() => void remove(r)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export function CustomersPage() {
  return (
    <DataPage
      title="Customers"
      kicker="CRM"
      description="Manage customer information and solar accounts."
      path="/customers"
      permission="customers:create"
      deletePermission="customers:delete"
      icon={<Users />}
      columns={[
        ["customer_number", "Customer #"],
        ["name", "Name"],
        ["mobile", "Mobile"],
        ["customer_type", "Type"],
        ["status", "Status"],
      ]}
      fields={[
        ["name", "Customer name", "text"],
        ["mobile", "Mobile", "tel"],
        ["email", "Email", "email"],
        ["password", "Password (for customer login)", "password"],
        ["customerType", "Customer type", "select", ["Admin", "Manager", "Sales Executive", "Installer", "Engineer", "Technician", "Residential Customer", "Commercial Customer", "Industrial"]],
        ["gstNumber", "GST number", "text"],
        ["consumerNumber", "Consumer number", "text"],
        ["provider", "Electricity provider", "text"],
      ]}
    />
  );
}
export function ProductsPage() {
  return (
    <DataPage
      title="Products"
      kicker="CATALOGUE"
      description="Maintain solar products, pricing and tax information."
      path="/products"
      permission="products:create"
      deletePermission="products:delete"
      icon={<Package />}
      columns={[
        ["sku", "SKU"],
        ["name", "Product"],
        ["category", "Category"],
        ["selling_price", "Selling price", money],
        ["tax_rate", "Tax %"],
        ["active", "Status", (v) => (v ? "Active" : "Disabled")],
      ]}
      fields={[
        ["sku", "SKU", "text"],
        ["name", "Product name", "text"],
        ["category", "Category", "text"],
        ["brand", "Brand", "text"],
        ["model", "Model", "text"],
        ["sellingPrice", "Selling price", "number"],
        ["taxRate", "Tax rate", "number"],
      ]}
    />
  );
}
const installationStages = [
  "Confirmed",
  "Site Survey",
  "Material Dispatched",
  "Installation",
  "Testing",
  "Completed",
  "On Hold",
];

export function ProjectsPage() {
  const { user } = useAuth(),
    [rows, setRows] = useState<Row[]>([]),
    [installers, setInstallers] = useState<
      Array<{ id: string; fullName: string }>
    >([]),
    [documents, setDocuments] = useState<Record<string, Row[]>>({}),
    [loading, setLoading] = useState(true);
  const isInstaller = Boolean(user?.roles.includes("installation_staff"));
  const canAssign =
    Boolean(user?.roles.includes("super_admin")) ||
    Boolean(user?.roles.includes("admin")) ||
    Boolean(user?.permissions.includes("projects:assign"));
  const load = async () => {
    setLoading(true);
    try {
      const projects = await api<Row[]>("/projects");
      setRows(projects);
      if (canAssign)
        setInstallers(
          await api<Array<{ id: string; fullName: string }>>(
            "/projects/installers",
          ),
        );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load projects",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const updateProject = async (row: Row, stage: string, progress: number) => {
    try {
      await api(`/projects/${text(row.id)}/progress`, {
        method: "PATCH",
        body: JSON.stringify({ stage, progress }),
      });
      toast.success("Installation progress updated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };
  const loadDocuments = async (projectId: string) => {
    try {
      const data = await api<Row[]>(`/projects/${projectId}/documents`);
      setDocuments((current) => ({ ...current, [projectId]: data }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load documents",
      );
    }
  };
  const assign = async (projectId: string, assignedTo: string) => {
    if (!assignedTo) return;
    try {
      await api(`/projects/${projectId}/assignment`, {
        method: "PATCH",
        body: JSON.stringify({ assignedTo }),
      });
      toast.success("Installer assigned");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assignment failed");
    }
  };
  const upload = async (projectId: string, file: File) => {
    if (file.size > 10 * 1024 * 1024)
      return toast.error("Document must be under 10 MB");
    const storagePath = `${user!.id}/projects/${projectId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage
      .from("private-documents")
      .upload(storagePath, file, { contentType: file.type });
    if (error) return toast.error(error.message);
    try {
      await api(`/projects/${projectId}/documents`, {
        method: "POST",
        body: JSON.stringify({
          originalName: file.name,
          storagePath,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          category: "Installation",
        }),
      });
      toast.success("Installation document uploaded");
      await loadDocuments(projectId);
    } catch (registrationError) {
      await supabase.storage.from("private-documents").remove([storagePath]);
      toast.error(
        registrationError instanceof Error
          ? registrationError.message
          : "Document registration failed",
      );
    }
  };
  const download = async (row: Row) => {
    const newTab = window.open("about:blank", "_blank");
    if (!newTab) return toast.error("Allow pop-ups to view document");
    const { data, error } = await supabase.storage
      .from("private-documents")
      .createSignedUrl(text(row.storage_path), 60);
    if (error || !data?.signedUrl) {
      newTab.close();
      return toast.error(error?.message ?? "Download failed");
    }
    newTab.location.href = data.signedUrl;
  };
  return (
    <main className="app-page">
      <div className="page-bar">
        <div>
          <span className="kicker">INSTALLATION OPERATIONS</span>
          <h1>{isInstaller ? "My installations" : "Projects"}</h1>
          <p>
            {isInstaller
              ? "View assigned installations, update progress and upload site documents."
              : "Monitor solar project installation progress."}
          </p>
        </div>
      </div>
      {loading ? (
        <div className="skeleton">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <Package />
          <h2>No assigned installations</h2>
          <p>An administrator must assign a project to this installer.</p>
        </div>
      ) : (
        <div className="installation-list">
          {rows.map((row) => {
            const projectId = text(row.id),
              customer = row.customers as Row | undefined;
            return (
              <article className="card installation-card" key={projectId}>
                <div>
                  <span className="kicker">{text(row.project_number)}</span>
                  <h2>{text(customer?.name)}</h2>
                  <p>
                    {text(row.capacity_kw)} kW · {text(row.stage)}
                  </p>
                </div>
                <label>
                  Stage
                  <select
                    defaultValue={text(row.stage)}
                    onChange={(event) =>
                      void updateProject(
                        row,
                        event.target.value,
                        Number(row.progress || 0),
                      )
                    }
                  >
                    {installationStages.map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Progress: {text(row.progress)}%
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    defaultValue={Number(row.progress || 0)}
                    onChange={(event) =>
                      void updateProject(
                        row,
                        text(row.stage),
                        Number(event.target.value),
                      )
                    }
                  />
                </label>
                {canAssign && (
                  <label>
                    Assigned installer
                    <select
                      value={row.assigned_to ? String(row.assigned_to) : ""}
                      onChange={(event) =>
                        void assign(projectId, event.target.value)
                      }
                    >
                      <option value="">Select installer</option>
                      {installers.map((installer) => (
                        <option key={installer.id} value={installer.id}>
                          {installer.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="row-actions">
                  <label className="secondary upload-button">
                    Upload document
                    <input
                      type="file"
                      hidden
                      accept="image/*,.pdf"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload(projectId, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    className="secondary"
                    onClick={() => void loadDocuments(projectId)}
                  >
                    View documents
                  </button>
                </div>
                {(documents[projectId] ?? []).map((document) => (
                  <button
                    className="document-link"
                    key={text(document.id)}
                    onClick={() => void download(document)}
                  >
                    {text(document.original_name)}
                  </button>
                ))}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

const ticketStatuses = ["Open", "In Progress", "Waiting", "Resolved", "Closed"];

export function TicketsPage() {
  const { user } = useAuth(),
    [rows, setRows] = useState<Row[]>([]),
    [loading, setLoading] = useState(true);
  const isTechnician = Boolean(user?.roles.includes("service_technician"));
  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<Row[]>("/tickets"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load tickets",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const updateTicket = async (row: Row, status: string, resolution: string) => {
    try {
      await api(`/tickets/${text(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, resolution }),
      });
      toast.success("Service ticket updated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };
  return (
    <main className="app-page">
      <div className="page-bar">
        <div>
          <span className="kicker">SERVICE OPERATIONS</span>
          <h1>{isTechnician ? "My service tickets" : "Service tickets"}</h1>
          <p>
            View assigned customer issues, record resolution and close completed
            work.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="skeleton">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <FileText />
          <h2>No assigned service tickets</h2>
          <p>An administrator must assign a ticket to this technician.</p>
        </div>
      ) : (
        <div className="installation-list">
          {rows.map((row) => {
            const customer = row.customers as Row | undefined;
            return (
              <article className="card installation-card" key={text(row.id)}>
                <div>
                  <span className="kicker">{text(row.ticket_number)}</span>
                  <h2>{text(row.subject)}</h2>
                  <p>
                    {text(customer?.name)} · Priority {text(row.priority)}
                  </p>
                  <p>{text(row.description)}</p>
                </div>
                <label>
                  Status
                  <select
                    defaultValue={text(row.status)}
                    onChange={(event) =>
                      void updateTicket(
                        row,
                        event.target.value,
                        text(row.resolution) === "—"
                          ? ""
                          : text(row.resolution),
                      )
                    }
                  >
                    {ticketStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Resolution
                  <textarea
                    rows={3}
                    defaultValue={
                      text(row.resolution) === "—" ? "" : text(row.resolution)
                    }
                    onBlur={(event) =>
                      void updateTicket(
                        row,
                        text(row.status),
                        event.target.value,
                      )
                    }
                    placeholder="Work performed and resolution"
                  />
                </label>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

type QuoteCustomer = { id: string; name: string; mobile: string };
type QuoteProduct = {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  model?: string;
  unit?: string;
  selling_price: number;
  tax_rate: number;
  active?: boolean;
};
type QuoteItem = {
  productId?: string;
  productName: string;
  description: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  cgstRate: number;
  sgstRate: number;
};
export function QuotationsPage() {
  const { user } = useAuth(),
    [rows, setRows] = useState<Row[]>([]),
    [customers, setCustomers] = useState<QuoteCustomer[]>([]),
    [products, setProducts] = useState<QuoteProduct[]>([]),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QuoteItem[]>([]),
    [quoteTitle, setQuoteTitle] = useState(""),
    [selectedProductId, setSelectedProductId] = useState(""),
    canCreate =
      user?.roles.includes("super_admin") ||
      user?.roles.includes("admin") ||
      user?.permissions.includes("quotations:create"),
    canDelete =
      user?.roles.includes("super_admin") ||
      user?.roles.includes("admin") ||
      user?.permissions.includes("quotations:delete");
  const load = async () => {
    setLoading(true);
    try {
      const q = await api<Row[]>("/quotations");
      setRows(q);
      if (canCreate) {
        const [c, p] = await Promise.all([
          api<QuoteCustomer[]>("/customers"),
          api<QuoteProduct[]>("/products"),
        ]);
        setCustomers(c);
        setProducts(p);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load quotations");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [canCreate]);
  const addProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const description =
        [p.model, p.category].filter(Boolean).join(" — ") || p.name,
      brand = p.brand || "Standard",
      type =
        document.querySelector<HTMLSelectElement>(
          'form select[name="quotationType"]',
        )?.value || "On-grid",
      capacityText = [p.name, p.model, p.category].filter(Boolean).join(" "),
      capacityMatch = capacityText.match(/(\d+(?:\.\d+)?)\s*k\s*(?:w|va)\b/i);
    setItems((current) => [
      ...current,
      {
        productId: p.id,
        productName: p.name,
        description,
        brand,
        quantity: 1,
        unitPrice: Number(p.selling_price),
        cgstRate: Number(p.tax_rate) / 2,
        sgstRate: Number(p.tax_rate) / 2,
      },
    ]);
    setQuoteTitle(`FOR ${p.name.toUpperCase()} — ${type.toUpperCase()}`);
    if (capacityMatch?.[1]) {
      const capacityField = document.querySelector<HTMLInputElement>(
        'form input[name="capacityKw"]',
      );
      if (capacityField) capacityField.value = capacityMatch[1];
    }
  };
  const addCustomItem = () => {
    setItems((current) => [
      ...current,
      {
        productId: "",
        productName: "Solar System Item",
        description: "Solar Equipment & Accessories",
        brand: "Standard",
        quantity: 1,
        unitPrice: 15000,
        cgstRate: 6,
        sgstRate: 6,
      },
    ]);
  };
  useEffect(() => {
    const field = document.querySelector<HTMLInputElement>(
      'form input[name="title"]',
    );
    if (field && quoteTitle) field.value = quoteTitle;
  }, [quoteTitle]);
  const update = (index: number, key: keyof QuoteItem, value: string) =>
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]: ["quantity", "unitPrice", "cgstRate", "sgstRate"].includes(
                key,
              )
                ? Number(value)
                : value,
            }
          : item,
      ),
    );
  const subtotal = useMemo(
      () =>
        items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
      [items],
    ),
    tax = useMemo(
      () =>
        items.reduce(
          (sum, item) =>
            sum +
            (item.quantity * item.unitPrice * (item.cgstRate + item.sgstRate)) /
              (100 + item.cgstRate + item.sgstRate),
          0,
        ),
      [items],
    );
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = formObject(e.currentTarget);
    try {
      await api("/quotations", {
        method: "POST",
        body: JSON.stringify({
          ...body,
          items: items.map((item) => ({
            ...item,
            taxRate: item.cgstRate + item.sgstRate,
          })),
        }),
      });
      toast.success("Quotation created");
      setOpen(false);
      setItems([]);
      setQuoteTitle("");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create quotation",
      );
    }
  };
  const removeQuotation = async (row: Row) => {
    if (
      !confirm(
        `Archive quotation ${text(row.quotation_number)}? Linked invoices and agreements will remain safe.`,
      )
    )
      return;
    try {
      await api(`/quotations/${text(row.id)}`, { method: "DELETE" });
      toast.success("Quotation archived");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to archive quotation",
      );
    }
  };
  return (
    <main className="app-page">
      <div className="page-bar">
        <div>
          <span className="kicker">SALES</span>
          <h1>Quotations</h1>
          <p>Create, view and print customer quotations.</p>
        </div>
        {canCreate && (
          <button className="primary" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Create quotation"}
          </button>
        )}
      </div>
      {open && (
        <form className="card operational-form" onSubmit={submit}>
          <h2>Create New Quotation</h2>
          <div className="detail-grid">
            <label>
              Date
              <input
                name="quotationDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Valid until
              <input name="validUntil" type="date" required />
            </label>
            <label>
              Customer
              <select name="customerId" required>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.mobile}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quotation type
              <select name="quotationType" required>
                <option>On-grid</option>
                <option>Off-grid</option>
                <option>Hybrid</option>
              </select>
            </label>
            <label>
              Capacity (kW)
              <input
                name="capacityKw"
                type="number"
                min=".1"
                step=".1"
                required
              />
            </label>
            <label>
              Title
              <input
                name="title"
                required
                placeholder="FOR 3KW ON-GRID SOLAR POWER SYSTEM"
              />
            </label>
          </div>
          <label>
            Installation address
            <textarea name="installationAddress" rows={3} />
          </label>
          <div className="page-bar">
            <h3>Products</h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                aria-label="Add product"
                value={selectedProductId}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) addProduct(id);
                  setSelectedProductId("");
                }}
              >
                <option value="">Select from database…</option>
                {products
                  .filter((p) => p.active !== false)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="secondary"
                onClick={addCustomItem}
              >
                + Add Custom Item
              </button>
            </div>
            <small>Select from database or click + Add Custom Item.</small>
          </div>
          {items.map((item, index) => (
            <div className="card" key={`${item.productId}-${index}`}>
              <div className="quote-item-grid">
                <label>
                  Product Name
                  <input
                    value={item.productName}
                    onChange={(e) =>
                      update(index, "productName", e.target.value)
                    }
                  />
                </label>
                <label>
                  Description
                  <input
                    value={item.description}
                    onChange={(e) =>
                      update(index, "description", e.target.value)
                    }
                  />
                </label>
                <label>
                  Brand
                  <input
                    value={item.brand}
                    onChange={(e) => update(index, "brand", e.target.value)}
                  />
                </label>
                <label>
                  QTY
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => update(index, "quantity", e.target.value)}
                  />
                </label>
                <label>
                  Price (Incl. GST)
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    value={item.unitPrice}
                    onChange={(e) => update(index, "unitPrice", e.target.value)}
                  />
                </label>
                <label>
                  CGST %
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    value={item.cgstRate}
                    onChange={(e) => update(index, "cgstRate", e.target.value)}
                  />
                </label>
                <label>
                  SGST %
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    value={item.sgstRate}
                    onChange={(e) => update(index, "sgstRate", e.target.value)}
                  />
                </label>
                <label>
                  Gross Amount
                  <input
                    readOnly
                    value={(item.quantity * item.unitPrice).toFixed(2)}
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setItems((x) => x.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="totals-card">
            <span>
              Subtotal <b>{money(subtotal)}</b>
            </span>
            <span>
              Included GST <b>{money(tax)}</b>
            </span>
            <span>
              Grand total <b>{money(subtotal)}</b>
            </span>
          </div>
          <label>
            Terms
            <textarea name="terms" rows={3} />
          </label>
          <button className="primary" disabled={!items.length}>
            Create quotation
          </button>
        </form>
      )}
      {loading ? (
        <div className="skeleton">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <FileText />
          <h2>No quotations yet</h2>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quotation #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={text(row.id)}>
                  <td>{text(row.quotation_number)}</td>
                  <td>{text(row.quotation_date)}</td>
                  <td>{text((row.customers as Row | undefined)?.name)}</td>
                  <td>{text(row.quotation_type)}</td>
                  <td>{text(row.capacity_kw)} kW</td>
                  <td>{money(row.grand_total)}</td>
                  <td>{text(row.status)}</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => printRecord("Quotation", row)}>
                        Print / PDF
                      </button>
                      {canDelete && (
                        <button
                          className="danger"
                          onClick={() => void removeQuotation(row)}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
export function InvoicesPage() {
  const { user } = useAuth(),
    [rows, setRows] = useState<Row[]>([]),
    [customers, setCustomers] = useState<QuoteCustomer[]>([]),
    [products, setProducts] = useState<QuoteProduct[]>([]),
    [quotes, setQuotes] = useState<Row[]>([]),
    [items, setItems] = useState<QuoteItem[]>([]),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState(""),
    [invoiceType, setInvoiceType] = useState("On-grid"),
    [title, setTitle] = useState(""),
    [selectedProductId, setSelectedProductId] = useState(""),
    [editing, setEditing] = useState<Row | null>(null);
  const canCreate =
    user?.roles.includes("super_admin") ||
    user?.roles.includes("admin") ||
    user?.permissions.includes("invoices:create");
  const canUpdate =
      user?.roles.includes("super_admin") ||
      user?.roles.includes("admin") ||
      user?.permissions.includes("invoices:update"),
    canDelete =
      user?.roles.includes("super_admin") ||
      user?.roles.includes("admin") ||
      user?.permissions.includes("invoices:delete");
  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<Row[]>("/invoices"));
      if (canCreate) {
        const [c, p, q] = await Promise.all([
          api<QuoteCustomer[]>("/customers"),
          api<QuoteProduct[]>("/products"),
          api<Row[]>("/quotations"),
        ]);
        setCustomers(c);
        setProducts(p);
        setQuotes(q);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load invoices");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [canCreate]);
  const addProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const description =
        [p.model, p.category].filter(Boolean).join(" — ") || p.name,
      brand = p.brand || "Standard";
    setItems((current) => [
      ...current,
      {
        productId: p.id,
        productName: p.name,
        description,
        brand,
        quantity: 1,
        unitPrice: Number(p.selling_price),
        cgstRate: Number(p.tax_rate) / 2,
        sgstRate: Number(p.tax_rate) / 2,
      },
    ]);
    setTitle(
      `FOR ${p.name.toUpperCase()}${invoiceType ? ` — ${invoiceType.toUpperCase()}` : ""}`,
    );
  };
  const addCustomItem = () => {
    setItems((current) => [
      ...current,
      {
        productId: "",
        productName: "Solar System Item",
        description: "Solar Equipment & Accessories",
        brand: "Standard",
        quantity: 1,
        unitPrice: 15000,
        cgstRate: 6,
        sgstRate: 6,
      },
    ]);
  };
  const update = (index: number, key: keyof QuoteItem, value: string) =>
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]: ["quantity", "unitPrice", "cgstRate", "sgstRate"].includes(
                key,
              )
                ? Number(value)
                : value,
            }
          : item,
      ),
    );
  const subtotal = useMemo(
      () =>
        items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
      [items],
    ),
    tax = useMemo(
      () =>
        items.reduce(
          (sum, item) =>
            sum +
            (item.quantity * item.unitPrice * (item.cgstRate + item.sgstRate)) /
              (100 + item.cgstRate + item.sgstRate),
          0,
        ),
      [items],
    );
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = formObject(e.currentTarget);
    try {
      await api("/invoices", {
        method: "POST",
        body: JSON.stringify({
          ...body,
          items: items.map((item) => ({
            ...item,
            taxRate: item.cgstRate + item.sgstRate,
          })),
        }),
      });
      toast.success("Invoice generated");
      setOpen(false);
      setItems([]);
      setCustomerId("");
      setTitle("");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to generate invoice",
      );
    }
  };
  const updateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await api(`/invoices/${text(editing.id)}`, {
        method: "PATCH",
        body: JSON.stringify(formObject(e.currentTarget)),
      });
      toast.success("Invoice updated");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update invoice",
      );
    }
  };
  const deleteInvoice = async (row: Row) => {
    if (
      !confirm(
        `Delete invoice ${text(row.invoice_number)}? This action cannot be undone.`,
      )
    )
      return;
    try {
      await api(`/invoices/${text(row.id)}`, { method: "DELETE" });
      toast.success("Invoice deleted");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete invoice",
      );
    }
  };
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );
  return (
    <main className="app-page">
      <div className="page-bar">
        <div>
          <span className="kicker">ACCOUNTS</span>
          <h1>Invoices</h1>
          <p>
            Generate, view and print customer invoices with complete product
            details.
          </p>
        </div>
        {canCreate && (
          <button className="primary" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Generate invoice"}
          </button>
        )}
      </div>
      {open && (
        <form className="card operational-form invoice-form" onSubmit={submit}>
          <h2>Create New Invoice</h2>
          <div className="detail-grid invoice-fields">
            <label>
              Date
              <input
                name="invoiceDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Invoice Number
              <input value="Auto-generated after save" readOnly />
            </label>
            <label>
              Customer Name
              <select
                name="customerId"
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Customer Mobile
              <input
                value={selectedCustomer?.mobile ?? ""}
                placeholder="Selected customer mobile"
                readOnly
              />
            </label>
            <label className="wide-field">
              Address Line 1
              <textarea
                name="installationAddress"
                rows={3}
                required
                placeholder="Enter installation / billing address"
              />
            </label>
            <label>
              Invoice Type
              <select
                name="invoiceType"
                required
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
              >
                <option>On-grid</option>
                <option>Off-grid</option>
                <option>Hybrid</option>
              </select>
            </label>
            <label>
              Title
              <input
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Select a product to auto-fill title"
              />
            </label>
            <label>
              Due date
              <input name="dueDate" type="date" required />
            </label>
            <label>
              Related quotation
              <select name="quotationId">
                <option value="">Without quotation</option>
                {quotes.map((q) => (
                  <option key={text(q.id)} value={text(q.id)}>
                    {text(q.quotation_number)} —{" "}
                    {text((q.customers as Row | undefined)?.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status">
                <option>Unpaid</option>
                <option>Draft</option>
                <option>Partially Paid</option>
                <option>Paid</option>
              </select>
            </label>
            <label>
              Paid amount
              <input
                name="paidAmount"
                type="number"
                min="0"
                step=".01"
                defaultValue="0"
              />
            </label>
          </div>
          <div className="page-bar invoice-products-head">
            <div>
              <h3>Product details</h3>
              <p>
                Select products from the database or edit each line before
                saving.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                aria-label="Add invoice product"
                value={selectedProductId}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) addProduct(id);
                  setSelectedProductId("");
                }}
              >
                <option value="">Select from database…</option>
                {products
                  .filter((p) => p.active !== false)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="secondary"
                onClick={addCustomItem}
              >
                + Add Custom Item
              </button>
            </div>
            <small>Select from database or click + Add Custom Item.</small>
          </div>
          <div className="invoice-items">
            {items.map((item, index) => (
              <div
                className="card invoice-item"
                key={`${item.productId}-${index}`}
              >
                <div className="quote-item-grid">
                  <label>
                    Product Name
                    <input
                      required
                      value={item.productName}
                      onChange={(e) =>
                        update(index, "productName", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Description
                    <input
                      value={item.description}
                      onChange={(e) =>
                        update(index, "description", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Brand / Model
                    <input
                      value={item.brand}
                      onChange={(e) => update(index, "brand", e.target.value)}
                    />
                  </label>
                  <label>
                    QTY
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        update(index, "quantity", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Price (Incl. GST)
                    <input
                      required
                      type="number"
                      min="0"
                      step=".01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        update(index, "unitPrice", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    CGST %
                    <input
                      type="number"
                      min="0"
                      step=".01"
                      value={item.cgstRate}
                      onChange={(e) =>
                        update(index, "cgstRate", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    SGST %
                    <input
                      type="number"
                      min="0"
                      step=".01"
                      value={item.sgstRate}
                      onChange={(e) =>
                        update(index, "sgstRate", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Gross Amount
                    <input
                      readOnly
                      value={(item.quantity * item.unitPrice).toFixed(2)}
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setItems((x) => x.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="invoice-footer">
            <label>
              Notes
              <textarea
                name="notes"
                rows={4}
                placeholder="Optional payment or invoice notes"
              />
            </label>
            <div className="totals-card">
              <span>
                Subtotal <b>{money(subtotal)}</b>
              </span>
              <span>
                Included GST <b>{money(tax)}</b>
              </span>
              <span>
                Total Amount <b>{money(subtotal)}</b>
              </span>
            </div>
          </div>
          <div className="form-actions">
            <button className="primary" disabled={!items.length}>
              Generate Invoice
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setOpen(false);
                setItems([]);
                setCustomerId("");
                setTitle("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {editing && (
        <form
          className="card operational-form invoice-edit-form"
          onSubmit={updateInvoice}
        >
          <h2>Edit {text(editing.invoice_number)}</h2>
          <label>
            Title
            <input name="title" defaultValue={text(editing.title)} />
          </label>
          <label>
            Due date
            <input
              name="dueDate"
              type="date"
              defaultValue={text(editing.due_date)}
              required
            />
          </label>
          <label>
            Paid amount
            <input
              name="paidAmount"
              type="number"
              min="0"
              step=".01"
              defaultValue={Number(editing.paid_amount || 0)}
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={text(editing.status)}>
              <option>Draft</option>
              <option>Unpaid</option>
              <option>Partially Paid</option>
              <option>Paid</option>
              <option>Cancelled</option>
            </select>
          </label>
          <label>
            Notes
            <textarea
              name="notes"
              rows={3}
              defaultValue={
                text(editing.notes) === "â€”" ? "" : text(editing.notes)
              }
            />
          </label>
          <div className="form-actions">
            <button className="primary">Save changes</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <div className="skeleton">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <FileText />
          <h2>No invoices yet</h2>
          <p>Generate the first invoice using the product details above.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Due date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={text(row.id)}>
                  <td>{text(row.invoice_number)}</td>
                  <td>{text(row.invoice_date)}</td>
                  <td>{text((row.customers as Row | undefined)?.name)}</td>
                  <td>{text(row.due_date)}</td>
                  <td>{money(row.total)}</td>
                  <td>{money(row.paid_amount)}</td>
                  <td>{text(row.status)}</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => printRecord("Invoice", row)}>
                        Print / PDF
                      </button>
                      {canUpdate && (
                        <button onClick={() => setEditing(row)}>Edit</button>
                      )}
                      {canDelete && (
                        <button
                          className="danger"
                          onClick={() => void deleteInvoice(row)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
export function AgreementsPage() {
  const { user } = useAuth(),
    [rows, setRows] = useState<Row[]>([]),
    [customers, setCustomers] = useState<QuoteCustomer[]>([]),
    [quotes, setQuotes] = useState<Row[]>([]),
    [selectedCustomerId, setSelectedCustomerId] = useState(""),
    [open, setOpen] = useState(false),
    [payingId, setPayingId] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  const isCustomer = Boolean(user?.roles.includes("customer"));
  const canCreate =
    !isCustomer &&
    (Boolean(user?.roles.includes("super_admin")) ||
      Boolean(user?.roles.includes("admin")) ||
      Boolean(user?.permissions.includes("agreements:create")));
  const canVerifyPayment =
    !isCustomer &&
    (Boolean(user?.roles.includes("super_admin")) ||
      Boolean(user?.roles.includes("admin")) ||
      Boolean(user?.permissions.includes("payments:create")));
  const canDelete =
    !isCustomer &&
    (Boolean(user?.roles.includes("super_admin")) ||
      Boolean(user?.roles.includes("admin")) ||
      Boolean(user?.permissions.includes("agreements:delete")));
  const availableQuotes = isCustomer
    ? quotes
    : quotes.filter(
        (quote) => text(quote.customer_id) === selectedCustomerId,
      );
  const load = async () => {
    setLoading(true);
    try {
      const [a, q] = await Promise.all([
        api<Row[]>("/agreements"),
        api<Row[]>("/quotations"),
      ]);
      setRows(a);
      setQuotes(q);
      if (!isCustomer) setCustomers(await api<QuoteCustomer[]>("/customers"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load agreements");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      data = formObject(form),
      file = new FormData(form).get("signature") as File | null;
    if (isCustomer) {
      const quote = quotes.find(
        (item) => text(item.id) === text(data.quotationId),
      );
      data.customerId = String(quote?.customer_id ?? "");
    } else if (data.quotationId) {
      const selectedQuote = quotes.find(
        (item) => text(item.id) === text(data.quotationId),
      );
      if (
        selectedQuote &&
        text(selectedQuote.customer_id) !== text(data.customerId)
      )
        return toast.error(
          "Select a quotation belonging to the selected customer",
        );
    }
    let customerSignaturePath: string | undefined;
    if (file?.size) {
      if (
        file.size > 2 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        return toast.error("Signature must be JPG, PNG or WebP and under 2 MB");
      // Convert to base64 Data URI so it always renders in the PDF,
      // regardless of Supabase storage bucket permissions.
      customerSignaturePath = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read signature file"));
        reader.readAsDataURL(file);
      });
    }
    try {
      const payload = {
        customerId: data.customerId,
        quotationId: data.quotationId,
        consumerAddress: data.consumerAddress,
        agreementDate: data.agreementDate,
        paymentTerms: data.paymentTerms,
        customerSignaturePath,
      };
      await api("/agreements", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Agreement created");
      setOpen(false);
      setSelectedCustomerId("");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create agreement",
      );
    }
  };
  const openAgreement = async (row: Row) => {
    try {
      const document = await api<Row>(`/agreements/${text(row.id)}/document`);
      const sigPath = text(document.customer_signature_path);
      let customerSignatureUrl: string | undefined;
      if (sigPath && sigPath !== "—" && sigPath !== "") {
        // If stored as base64 Data URI or an absolute URL, use directly
        if (sigPath.startsWith("data:image/") || sigPath.startsWith("http")) {
          customerSignatureUrl = sigPath;
        } else {
          // Fallback: try Supabase signed URL for old records
          const { data: signedData } = await supabase.storage
            .from("private-documents")
            .createSignedUrl(sigPath, 300);
          if (signedData?.signedUrl) customerSignatureUrl = signedData.signedUrl;
        }
      }
      printRecord("Agreement", { ...document, customer_signature_url: customerSignatureUrl });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Payment is required before download",
      );
    }
  };
  const submitPayment = async (row: Row) => {
    const agreementId = text(row.id);
    if (!agreementId || payingId) return;
    setPayingId(agreementId);
    try {
      const checkout = await api<{
        action: string;
        fields: Record<string, string>;
      }>(`/agreements/${agreementId}/payu-checkout`, {
        method: "POST",
      });
      const form = document.createElement("form");
      form.method = "POST";
      form.action = checkout.action;
      form.target = "_self";
      form.acceptCharset = "UTF-8";
      form.style.display = "none";
      Object.entries(checkout.fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      setPayingId(null);
      toast.error(
        error instanceof Error ? error.message : "PayU checkout failed",
      );
    }
  };
  const executeTestPayment = async (row: Row) => {
    if (!confirm(`Complete test payment for ${text(row.agreement_number)}?`)) return;
    try {
      await api(`/agreements/${text(row.id)}/test-payment`, { method: "POST" });
      toast.success("Test payment successful! Agreement download unlocked.");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Test payment failed",
      );
    }
  };
  const verifyPayment = async (row: Row) => {
    if (!confirm(`Verify payment for ${text(row.agreement_number)}?`)) return;
    try {
      await api(`/agreements/${text(row.id)}/verify-payment`, {
        method: "POST",
      });
      toast.success("Payment verified; customer download is now enabled");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verification failed",
      );
    }
  };
  const removeAgreement = async (row: Row) => {
    const numberStr = text(row.agreement_number);
    if (!confirm(`Are you sure you want to delete agreement ${numberStr}?`)) return;
    try {
      await api(`/agreements/${text(row.id)}`, { method: "DELETE" });
      toast.success(`Agreement ${numberStr} removed`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove agreement",
      );
    }
  };
  return (
    <main className="app-page">
      <div className="page-bar">
        <div>
          <span className="kicker">DOCUMENTS</span>
          <h1>Agreements</h1>
          <p>
            Review customer agreements, digital signatures and payment status
          </p>
        </div>
        {canCreate && (
          <button className="primary" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Create agreement"}
          </button>
        )}
      </div>
      {open && (
        <form className="card operational-form" onSubmit={submit}>
          <h2>Create New Agreement</h2>
          {!isCustomer && (
            <label>
              Customer Name
              <select
                name="customerId"
                required
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.mobile}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Related quotation
            <select
              key={selectedCustomerId}
              name="quotationId"
              required
              disabled={!isCustomer && !selectedCustomerId}
            >
              <option value="">
                {!isCustomer && !selectedCustomerId
                  ? "Select customer first"
                  : availableQuotes.length
                    ? "Select quotation"
                    : "No quotation available for this customer"}
              </option>
              {availableQuotes.map((q) => (
                <option key={text(q.id)} value={text(q.id)}>
                  {text(q.quotation_number)} —{" "}
                  {text((q.customers as Row | undefined)?.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Full Address
            <textarea name="consumerAddress" rows={4} required />
          </label>
          <label>
            Agreement date
            <input
              name="agreementDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label>
            Payment terms
            <textarea name="paymentTerms" rows={3} />
          </label>
          <label>
            Customer Signature (optional)
            <input
              name="signature"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
            <small>JPG, PNG or WebP. Maximum 2 MB.</small>
          </label>
          <button className="primary">Create MOU</button>
        </form>
      )}
      {loading ? (
        <div className="skeleton">Loading…</div>
      ) : (
        <div className="table-wrap agreements-table-wrap">
          <table className="agreements-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer Name</th>
                <th>Full Address</th>
                <th>Signature</th>
                <th>Created At</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={text(row.id)}>
                  <td data-label="Agreement #">{text(row.agreement_number)}</td>
                  <td data-label="Customer">
                    {text((row.customers as Row | undefined)?.name)}
                  </td>
                  <td data-label="Address">
                    {text(
                      (row.merged_data as Row | undefined)?.consumer_address,
                    )}
                  </td>
                  <td data-label="Signature">
                    {row.customer_signature_path ? "Uploaded" : "Not uploaded"}
                  </td>
                  <td data-label="Created">
                    {new Date(String(row.created_at)).toLocaleString("en-IN")}
                  </td>
                  <td data-label="Payment">
                    <span className="pill">
                      {text(row.payment_status ?? "Unpaid")}
                    </span>
                    {isCustomer && row.payment_status !== "Paid" && (
                      <small> · {money(row.payment_amount)}</small>
                    )}
                  </td>
                  <td data-label="Actions">
                    <div className="row-actions">
                      {(!isCustomer || row.payment_status === "Paid") && (
                        <button onClick={() => void openAgreement(row)}>
                          {isCustomer ? "Download PDF" : "Print / PDF"}
                        </button>
                      )}
                      {row.payment_status !== "Paid" && (
                        <button
                          type="button"
                          style={{ background: "#059669", color: "#fff", border: "none" }}
                          onClick={() => void executeTestPayment(row)}
                        >
                          💳 Test Payment
                        </button>
                      )}
                      {isCustomer && row.payment_status !== "Paid" && (
                        <button
                          type="button"
                          disabled={payingId !== null}
                          onClick={() => void submitPayment(row)}
                        >
                          {payingId === text(row.id)
                            ? "Opening PayU…"
                            : "Pay ₹1 with PayU"}
                        </button>
                      )}
                      {canVerifyPayment &&
                        row.payment_status === "Pending Verification" && (
                          <button onClick={() => void verifyPayment(row)}>
                            Verify payment
                          </button>
                        )}
                      {canDelete && (
                        <button
                          className="danger"
                          onClick={() => void removeAgreement(row)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export function ReportsPage() {
  return (
    <main className="app-page">
      <span className="kicker">INSIGHTS</span>
      <h1>Reports</h1>
      <p>
        Live operational totals are available on the dashboard. Detailed exports
        unlock as transactions are recorded.
      </p>
      <div className="empty-state">
        <BarChart3 />
        <h2>Reporting workspace</h2>
        <p>Reports use real business records and never fabricated figures.</p>
      </div>
    </main>
  );
}
export function SettingsPage() {
  return (
    <main className="app-page">
      <span className="kicker">ADMINISTRATION</span>
      <h1>Settings</h1>
      <div className="card">
        <h2>Platform settings</h2>
        <p>
          Company, access and security configuration is managed from this
          protected workspace.
        </p>
      </div>
    </main>
  );
}
export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const profile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const b = formObject(e.currentTarget);
    await api("/profile", { method: "PATCH", body: JSON.stringify(b) });
    await refreshProfile();
    toast.success("Profile updated");
  };
  const password = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      b = formObject(form);
    await api("/profile/password", { method: "POST", body: JSON.stringify(b) });
    form.reset();
    toast.success("Password changed");
  };
  return (
    <main className="app-page">
      <span className="kicker">MY ACCOUNT</span>
      <h1>Profile & security</h1>
      <div className="detail-grid">
        <form className="card operational-form" onSubmit={profile}>
          <h2>Profile</h2>
          <label>
            Full name
            <input name="fullName" defaultValue={user?.fullName} required />
          </label>
          <label>
            Phone
            <input name="phone" />
          </label>
          <button className="primary">Update profile</button>
        </form>
        <form className="card operational-form" onSubmit={password}>
          <h2>Change password</h2>
          <label>
            Current password
            <input name="currentPassword" type="password" required />
          </label>
          <label>
            New password
            <input name="newPassword" type="password" minLength={10} required />
          </label>
          <button className="primary">Change password</button>
        </form>
      </div>
    </main>
  );
}
export function WorkspaceNotFound() {
  return (
    <main className="app-page">
      <div className="empty-state">
        <Settings />
        <h1>Page not found</h1>
        <p>Choose a module from the workspace navigation.</p>
      </div>
    </main>
  );
}
export function LeadsPage() {
  return (
    <main className="app-page">
      <span className="kicker">CRM</span>
      <h1>Leads</h1>
      <div className="empty-state">
        <Users />
        <h2>Lead workflow</h2>
        <p>
          Lead capture and conversion remains available as the extended CRM
          workflow.
        </p>
      </div>
    </main>
  );
}
