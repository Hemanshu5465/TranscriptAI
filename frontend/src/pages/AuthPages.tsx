import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { useAuth } from "../store/auth";
import { apiErrorMessage } from "../lib/api";
import { toast } from "../hooks/useToast";

function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
      <div className="mt-6 space-y-3">{children}</div>
      <p className="mt-5 text-center text-sm text-ink-soft">{footer}</p>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-widest text-ink-faint">
        {label}
      </span>
      <input
        {...rest}
        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to="/dashboard" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Incorrect email or password."));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your transcript history."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" size="lg" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { status, register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to="/dashboard" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await register(email, password, fullName || undefined);
      navigate("/dashboard");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't create your account."));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Keep a searchable history of every transcript."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" size="lg" loading={busy} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-2 font-display text-2xl">This page doesn't exist</h1>
      <Link to="/" className="mt-4 text-sm text-accent hover:underline">
        Back to home
      </Link>
    </div>
  );
}
