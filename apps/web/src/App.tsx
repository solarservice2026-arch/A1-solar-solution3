import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeIndianRupee,
  Building2,
  Check,
  ChevronRight,
  Home as HomeIcon,
  Leaf,
  Menu,
  Phone,
  ShieldCheck,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { estimateSolar } from "./calculator";
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
} from "./features/auth/AuthPages";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { useAuth } from "./features/auth/AuthProvider";
import {
  AgreementsPage,
  CustomersPage,
  InvoicesPage,
  ProductsPage,
  ProfilePage,
  ProjectsPage,
  QuotationsPage,
  SettingsPage,
  TicketsPage,
  WorkspaceNotFound,
} from "./features/modules/ModulePages";
import { AppShell, Dashboard, Forbidden } from "./features/shell/AppShell";
import {
  RoleDetail,
  RolesPage,
  StaffDetail,
  StaffEdit,
  StaffForm,
  StaffList,
} from "./features/staff/StaffPages";

const nav = [
  ["Solutions", "/#solutions"],
  ["Process", "/#process"],
  ["Projects", "/#projects"],
  ["Calculator", "/calculator"],
  ["Contact", "/contact"],
] as const;
function Header() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  return (
    <header className="header">
      <Link className="brand" to="/">
        <span className="brandmark">
          <Sun />
        </span>
        <span>
          A1 <b>Solar</b>
          <small>Solution</small>
        </span>
      </Link>
      <nav className={open ? "nav open" : "nav"}>
        {nav.map(([label, to]) => (
          <a key={label} href={to} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
        {user ? (
          <>
            <NavLink className="login" to="/app" onClick={() => setOpen(false)} style={{ marginRight: "10px" }}>
              Dashboard
            </NavLink>
            <button
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              style={{
                background: "transparent",
                border: "1px solid var(--ink)",
                padding: "10px 16px",
                borderRadius: "4px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <NavLink className="login" to="/login" onClick={() => setOpen(false)}>
            Portal login <ChevronRight size={16} />
          </NavLink>
        )}
      </nav>
      <button
        className="menu"
        aria-label="Toggle menu"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
    </header>
  );
}
function Footer() {
  return (
    <footer>
      <div className="footer-grid">
        <div>
          <div className="brand light">
            <span className="brandmark">
              <Sun />
            </span>
            <span>
              A1 <b>Solar</b>
              <small>Solution</small>
            </span>
          </div>
          <p>
            Thoughtful solar planning for homes and businesses. Estimates are
            indicative; final output depends on site conditions.
          </p>
        </div>
        <div>
          <b>Explore</b>
          <a href="/#solutions">Solar solutions</a>
          <Link to="/calculator">Savings calculator</Link>
          <Link to="/contact">Site survey</Link>
        </div>
        <div>
          <b>Contact</b>
          <a href="tel:+917839213375">+91 78392 13375</a>
          <a href="mailto:harshsingh78392133@gmail.com">Email our team</a>
          <span>India</span>
        </div>
      </div>
      <div className="legal">
        © 2026 A1 Solar Solution{" "}
        <span>
          <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
        </span>
      </div>
    </footer>
  );
}
const benefits = [
  ["Lower grid dependence", "Use clean energy generated on your own roof."],
  [
    "Designed around your site",
    "Capacity and components selected after assessment.",
  ],
  [
    "Support beyond installation",
    "Documentation, commissioning and service in one place.",
  ],
];
function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Leaf size={15} /> Smarter energy starts here
          </span>
          <h1>
            Put your roof to <em>work.</em>
          </h1>
          <p>
            Practical solar systems designed around your property, your
            consumption, and your long-term goals.
          </p>
          <div className="actions">
            <Link className="primary" to="/contact">
              Book a free site survey <ArrowRight size={18} />
            </Link>
            <Link className="secondary" to="/calculator">
              Estimate your savings
            </Link>
          </div>
          <div className="trust">
            <span>
              <ShieldCheck /> Transparent planning
            </span>
            <span>
              <Check /> End-to-end support
            </span>
            <span>
              <Check /> Quality components
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div className="sun-orb"></div>
          <div className="panel panel-one"></div>
          <div className="panel panel-two"></div>
          <div className="float-card">
            <Zap />
            <span>
              <b>Clean power</b>
              <small>from your own rooftop</small>
            </span>
          </div>
        </div>
      </section>
      <section className="ticker">
        <span>RESIDENTIAL SOLAR</span>
        <i>✦</i>
        <span>COMMERCIAL SYSTEMS</span>
        <i>✦</i>
        <span>INSTALLATION SUPPORT</span>
        <i>✦</i>
        <span>SERVICE & CARE</span>
      </section>
      <section className="section intro">
        <span className="kicker">WHY SOLAR, WHY NOW</span>
        <div className="split">
          <h2>Energy that makes sense for your future.</h2>
          <p>
            Every good solar project starts with the right questions—not
            oversized promises. We assess your usage, roof, tariff, and budget
            before recommending a system.
          </p>
        </div>
        <div className="benefits">
          {benefits.map((b, i) => (
            <article key={b[0]}>
              <span>0{i + 1}</span>
              <h3>{b[0]}</h3>
              <p>{b[1]}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="solutions" className="section solutions">
        <div className="section-head">
          <div>
            <span className="kicker">SOLUTIONS</span>
            <h2>Built for the way you use energy.</h2>
          </div>
          <p>
            From family homes to growing businesses, each system is planned for
            real-world performance.
          </p>
        </div>
        <div className="solution-grid">
          <Solution
            icon={<HomeIcon />}
            title="Residential"
            text="Turn unused roof space into clean power for your home."
          />
          <Solution
            icon={<Building2 />}
            title="Commercial"
            text="Reduce operational energy costs with scalable solar systems."
          />
          <Solution
            icon={<Zap />}
            title="Industrial"
            text="High-capacity solutions designed for demanding facilities."
          />
        </div>
      </section>
      <section id="process" className="section process">
        <span className="kicker">HOW IT WORKS</span>
        <h2>A clear path from first call to clean power.</h2>
        <div className="steps">
          {[
            "Understand your needs",
            "Survey & system design",
            "Clear proposal",
            "Installation & handover",
          ].map((x, i) => (
            <div key={x}>
              <b>{String(i + 1).padStart(2, "0")}</b>
              <span>{x}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="cta">
        <div>
          <span className="kicker">START YOUR SOLAR JOURNEY</span>
          <h2>Your roof could be doing more.</h2>
          <p>
            Tell us about your electricity use and we’ll help you understand the
            possibilities.
          </p>
        </div>
        <Link className="primary dark" to="/contact">
          Request a site survey <ArrowRight />
        </Link>
      </section>
    </>
  );
}
function Solution({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="solution">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      <Link to="/contact">
        Explore solution <ArrowRight size={16} />
      </Link>
    </article>
  );
}
function Calculator() {
  const [bill, setBill] = useState(4000);
  const [tariff, setTariff] = useState(8);
  const data = useMemo(() => estimateSolar(bill, tariff), [bill, tariff]);
  return (
    <main className="page calc">
      <span className="kicker">SOLAR SAVINGS CALCULATOR</span>
      <h1>See what solar could mean for you.</h1>
      <p className="lead">
        A planning estimate—not a guarantee. A site survey is required for a
        proposal.
      </p>
      <div className="calc-grid">
        <form className="card">
          <label>
            Average monthly bill <span>₹{bill.toLocaleString("en-IN")}</span>
            <input
              type="range"
              min="500"
              max="100000"
              step="500"
              value={bill}
              onChange={(e) => setBill(Number(e.target.value))}
            />
          </label>
          <label>
            Electricity tariff (₹/unit)
            <input
              type="number"
              min="1"
              max="30"
              value={tariff}
              onChange={(e) => setTariff(Number(e.target.value))}
            />
          </label>
          <label>
            Location
            <input placeholder="City or district" />
          </label>
        </form>
        <div className="result">
          <small>INDICATIVE SYSTEM SIZE</small>
          <strong>
            {data.capacityKw} <span>kW</span>
          </strong>
          <div>
            <Metric
              label="Estimated annual generation"
              value={`${data.annualGeneration.toLocaleString("en-IN")} units`}
            />
            <Metric
              label="Estimated annual savings"
              value={`₹${data.annualSavings.toLocaleString("en-IN")}`}
            />
            <Metric
              label="Approx. roof area"
              value={`${data.roofAreaSqFt} sq ft`}
            />
          </div>
          <Link className="primary dark" to="/contact">
            Get an accurate assessment
          </Link>
        </div>
      </div>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span>{label}</span>
      <b>{value}</b>
    </p>
  );
}
function Contact() {
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.info(
      "Connect Supabase to submit enquiries. You can still call us directly.",
    );
  };
  return (
    <main className="page contact">
      <div>
        <span className="kicker">LET’S TALK SOLAR</span>
        <h1>Tell us about your site.</h1>
        <p>Share a few details and our team will help plan the next step.</p>
        <a href="tel:+917839213375">
          <Phone /> +91 78392 13375
        </a>
      </div>
      <form className="card form" onSubmit={submit}>
        <label>
          Full name
          <input required minLength={2} />
        </label>
        <label>
          Mobile number
          <input required pattern="[6-9][0-9]{9}" inputMode="numeric" />
        </label>
        <label>
          Email (optional)
          <input type="email" />
        </label>
        <label>
          Requirement
          <select>
            <option>Residential solar</option>
            <option>Commercial solar</option>
            <option>Industrial solar</option>
            <option>Service support</option>
          </select>
        </label>
        <label>
          Message
          <textarea rows={4} />
        </label>
        <button className="primary">
          Request a callback <ArrowRight />
        </button>
      </form>
    </main>
  );
}
function Legal({ title }: { title: string }) {
  return (
    <main className="page legal-page">
      <span className="kicker">A1 SOLAR SOLUTION</span>
      <h1>{title}</h1>
      <p>
        This policy is a deployment-ready starting point and must be reviewed
        with company counsel before publication. We collect only information
        needed to respond to enquiries and provide contracted services. Private
        customer documents are access-controlled and are not publicly available.
      </p>
    </main>
  );
}
function PublicLayout() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Legal title="Privacy policy" />} />
        <Route path="/terms" element={<Legal title="Terms & conditions" />} />
      </Routes>
      <Footer />
    </>
  );
}
export function App() {
  return (
    <Routes>
      <Route path="/*" element={<PublicLayout />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/forbidden" element={<Forbidden />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route element={<ProtectedRoute permission="customers:view" />}>
            <Route path="customers" element={<CustomersPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="products:view" />}>
            <Route path="products" element={<ProductsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="projects:view" />}>
            <Route path="projects" element={<ProjectsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="tickets:view" />}>
            <Route path="tickets" element={<TicketsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="quotations:view" />}>
            <Route path="quotations" element={<QuotationsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="invoices:view" />}>
            <Route path="invoices" element={<InvoicesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="agreements:view" />}>
            <Route path="agreements" element={<AgreementsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="settings:view" />}>
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="users:view" />}>
            <Route path="staff" element={<StaffList />} />
            <Route path="staff/new" element={<StaffForm />} />
            <Route path="staff/:id" element={<StaffDetail />} />
            <Route path="staff/:id/edit" element={<StaffEdit />} />
          </Route>
          <Route element={<ProtectedRoute permission="roles:view" />}>
            <Route path="roles" element={<RolesPage />} />
            <Route path="roles/:id" element={<RoleDetail />} />
          </Route>
          <Route path="*" element={<WorkspaceNotFound />} />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <main className="page">
            <h1>Page not found</h1>
            <Link to="/">Return home</Link>
          </main>
        }
      />
    </Routes>
  );
}
