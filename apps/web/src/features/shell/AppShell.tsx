import {
  ArrowLeft,
  BarChart3,
  Bell,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Sun,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../../lib/api";
const items = [
  {
    to: "/app",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    to: "/app/customers",
    label: "Customers",
    icon: Users,
    permission: "customers:view",
  },
  {
    to: "/app/products",
    label: "Products",
    icon: Package,
    permission: "products:view",
  },
  {
    to: "/app/projects",
    label: "Installations",
    icon: Package,
    permission: "projects:view",
  },
  {
    to: "/app/tickets",
    label: "Service tickets",
    icon: FileText,
    permission: "tickets:view",
  },
  {
    to: "/app/quotations",
    label: "Quotations",
    icon: FileText,
    permission: "quotations:view",
  },
  {
    to: "/app/invoices",
    label: "Invoices",
    icon: FileText,
    permission: "invoices:view",
  },
  {
    to: "/app/agreements",
    label: "Agreements",
    icon: FileText,
    permission: "agreements:view",
  },
  { to: "/app/staff", label: "Staff", icon: Users, permission: "users:view" },
  {
    to: "/app/roles",
    label: "Roles & permissions",
    icon: Settings,
    permission: "roles:view",
  },
  {
    to: "/app/settings",
    label: "Settings",
    icon: Settings,
    permission: "settings:view",
  },
  {
    to: "/app/profile",
    label: "Profile & password",
    icon: UserCircle,
    permission: "dashboard:view",
  },
];
export function AppShell() {
  const { user, signOut } = useAuth(),
    [open, setOpen] = useState(false),
    location = useLocation(),
    navigate = useNavigate();
  const allowed = (permission: string) =>
    user?.roles.includes("super_admin") ||
    user?.roles.includes("admin") ||
    user?.permissions.includes(permission);
  const crumb =
    items.find((i) => i.to === location.pathname)?.label ?? "Workspace";
  return (
    <div className="app-layout">
      <aside className={open ? "app-sidebar open" : "app-sidebar"}>
        <div className="app-logo">
          <span className="brandmark">
            <Sun />
          </span>
          <b>A1 Solar</b>
          <button onClick={() => setOpen(false)} aria-label="Close menu">
            <X />
          </button>
        </div>
        <nav>
          {items
            .filter((i) => allowed(i.permission))
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                end={to === "/app"}
                key={to}
                to={to}
                onClick={() => setOpen(false)}
              >
                <Icon />
                {label}
                <ChevronRight />
              </NavLink>
            ))}
        </nav>
        <button className="logout" onClick={() => void signOut()}>
          <LogOut /> Sign out
        </button>
      </aside>
      <div className="app-main">
        <header className="app-top">
          <div className="header-context">
            <button
              className="drawer"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <button
              className="back-button"
              aria-label="Go back"
              onClick={() =>
                location.pathname === "/app" ? navigate("/") : navigate(-1)
              }
            >
              <ArrowLeft />
              <span>Back</span>
            </button>
            <div className="header-title-box">
              <small>WORKSPACE</small>
              <b>{crumb}</b>
            </div>
          </div>
          <div className="app-user">
            <div className="user-profile-badge">
              <span>{user?.fullName ?? "Super Admin"}</span>
              <small>{(user?.roles ?? ["super_admin"]).join(", ").replaceAll("_", " ")}</small>
            </div>
            <button
              className="icon-button logout-header-button"
              aria-label="Sign out"
              onClick={() => void signOut()}
              title="Sign out"
              style={{
                marginLeft: "12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
export function Dashboard() {
  const { user } = useAuth(),
    [data, setData] = useState<Record<string, number>>({});
  useEffect(() => {
    api<Record<string, number>>("/dashboard")
      .then(setData)
      .catch(() => setData({}));
  }, []);
  return (
    <main className="app-page">
      <span className="kicker">OVERVIEW</span>
      <h1>Welcome, {user?.fullName}.</h1>
      <p>Your live role-authorized business overview.</p>
      <div className="role-grid">
        {Object.entries(data).map(([key, value]) => (
          <article className="card" key={key}>
            <small>{key.replaceAll("_", " ")}</small>
            <h2>{value.toLocaleString("en-IN")}</h2>
          </article>
        ))}
      </div>
      {Object.keys(data).length === 0 && (
        <div className="empty-state">
          <LayoutDashboard />
          <h2>No operational data yet</h2>
          <p>Create your first business record to populate this dashboard.</p>
        </div>
      )}
    </main>
  );
}
export function Forbidden() {
  return (
    <main className="page center-page">
      <h1>403</h1>
      <h2>Access denied</h2>
      <p>Your account does not have permission to open this page.</p>
      <Link className="primary" to="/app">
        Back to dashboard
      </Link>
    </main>
  );
}
