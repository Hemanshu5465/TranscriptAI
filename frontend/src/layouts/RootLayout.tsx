import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, LogOut } from "lucide-react";
import { Wordmark } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/Button";
import { useAuth } from "../store/auth";
import { cn } from "../lib/cn";

export function RootLayout() {
  const { user, status, logout } = useAuth();
  const loc = useLocation();
  const onTranscript = /^\/t\/[^/]+$/.test(loc.pathname);

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header
        className={cn(
          "sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md",
          onTranscript && "bg-surface/90",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
          <Wordmark className="shrink-0" />
          <nav className="flex items-center gap-1.5 sm:gap-3">
            {status === "authed" && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn(
                    "hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors sm:inline-flex",
                    isActive ? "bg-surface-sunken text-ink" : "text-ink-soft hover:text-ink",
                  )
                }
              >
                <LayoutDashboard className="size-4" /> Dashboard
              </NavLink>
            )}
            <ThemeToggle compact />
            {status === "anon" && (
              <>
                <Link
                  to="/login"
                  className="hidden text-sm text-ink-soft hover:text-ink min-[420px]:inline"
                >
                  Sign in
                </Link>
                <Link to="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
            {status === "authed" && user && (
              <div className="flex items-center gap-2">
                <span
                  className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-[var(--color-accent-ink)]"
                  title={user.email}
                >
                  {user.email[0].toUpperCase()}
                </span>
                <button
                  onClick={logout}
                  aria-label="Sign out"
                  className="grid size-8 place-items-center rounded-full border border-line text-ink-soft hover:text-ink"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-ink-faint sm:px-6">
          <p>TranscriptAI — turn YouTube videos into accurate, editable scripts.</p>
          <p>
            Only transcribe content you are authorized to process. TranscriptAI uses
            publicly available captions and metadata and does not bypass platform protections.
          </p>
        </div>
      </footer>
    </div>
  );
}
