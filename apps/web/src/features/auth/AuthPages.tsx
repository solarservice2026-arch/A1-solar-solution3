import { useState } from "react";
import { ArrowRight, Sun } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { resetPasswordSchema } from "@a1/validation";
import { useAuth } from "./AuthProvider";

export function LoginPage() {
  const { signIn, user, loading } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  if (user) return <Navigate to="/app" replace />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signIn(email, password);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    }
  };
  return (
    <AuthCard
      title="Welcome back."
      subtitle="Sign in to your secure A1 Solar workspace."
    >
      <form onSubmit={submit}>
        <label>
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button disabled={loading} className="primary">
          {loading ? "Signing in…" : "Sign in"} <ArrowRight />
        </button>
      </form>
      <Link to="/forgot-password">Forgot password?</Link>
    </AuthCard>
  );
}
export function ForgotPasswordPage() {
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    toast.success("If an account exists for this email, password reset instructions have been sent.");
  };
  return (
    <AuthCard
      title="Reset access."
      subtitle="We’ll send a secure reset link if the account exists."
    >
      {sent ? (
        <div className="success-box">Check your email for the next step.</div>
      ) : (
        <form onSubmit={submit}>
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="primary">
            Send reset link <ArrowRight />
          </button>
        </form>
      )}
      <Link to="/login">Back to sign in</Link>
    </AuthCard>
  );
}
export function ResetPasswordPage() {
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ password, confirmation });
    if (!parsed.success)
      return toast.error(parsed.error.issues[0]?.message ?? "Invalid password");
    toast.success("Password updated");
  };
  return (
    <AuthCard
      title="Choose a new password."
      subtitle="Use at least 10 characters with upper/lowercase and a number."
    >
      <form onSubmit={submit}>
        <label>
          New password
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Confirm password
          <input
            required
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <button className="primary">
          Update password <ArrowRight />
        </button>
      </form>
    </AuthCard>
  );
}
function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="page auth">
      <div className="card">
        <span className="brandmark">
          <Sun />
        </span>
        <span className="kicker">SECURE PORTAL</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
