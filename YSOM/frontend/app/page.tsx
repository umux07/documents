"use client";

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api/v1";

type Account = {
  id: string;
  email: string;
  createdAt: string;
};

type DashboardService = {
  id: string;
  name: string;
  status: string;
};

type Screen = "loading" | "sign-in" | "register" | "dashboard";

const serviceIcons = {
  sim: Smartphone,
  communications: MessageSquareText,
  "mobile-money": WalletCards,
};

async function readError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return "We could not complete that request. Please try again.";
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [account, setAccount] = useState<Account | null>(null);
  const [services, setServices] = useState<DashboardService[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const response = await fetch(`${API_URL}/dashboard`, {
          credentials: "include",
          cache: "no-store",
        });

        if (response.status === 401) {
          if (active) setScreen("sign-in");
          return;
        }
        if (!response.ok) {
          throw new Error(await readError(response));
        }

        const dashboard: {
          user: Account;
          services: DashboardService[];
        } = await response.json();
        if (active) {
          setAccount(dashboard.user);
          setServices(dashboard.services);
          setScreen("dashboard");
        }
      } catch (restoreError) {
        if (active) {
          const offline = restoreError instanceof TypeError;
          setApiUnavailable(offline);
          setError(
            offline
              ? "The account service is unavailable. Start the YSOM backend and check the MySQL connection."
              : restoreError instanceof Error
                ? restoreError.message
                : "We could not check your session. Please try again.",
          );
          setScreen("sign-in");
        }
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setApiUnavailable(false);

    try {
      const endpoint = screen === "register" ? "register" : "login";
      const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const result: { user: Account } = await response.json();
      setAccount(result.user);

      const dashboardResponse = await fetch(`${API_URL}/dashboard`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!dashboardResponse.ok) {
        throw new Error(await readError(dashboardResponse));
      }
      const dashboard: { services: DashboardService[] } =
        await dashboardResponse.json();
      setServices(dashboard.services);
      setPassword("");
      setScreen("dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not complete that request. Please try again.",
      );
      if (submitError instanceof TypeError) {
        setApiUnavailable(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      setAccount(null);
      setServices([]);
      setPassword("");
      setError("");
      setScreen("sign-in");
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : "We could not sign you out. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function switchScreen(nextScreen: "sign-in" | "register") {
    setScreen(nextScreen);
    setError("");
    setApiUnavailable(false);
  }

  if (screen === "loading") {
    return (
      <main className="auth-shell auth-loading" aria-live="polite">
        <LoaderCircle size={25} className="spin" aria-hidden="true" />
        <p>Checking your account…</p>
      </main>
    );
  }

  if (screen === "dashboard" && account) {
    return (
      <main className="dashboard-shell">
        <header className="dashboard-header">
          <Link className="brand" href="/" aria-label="YSOM home">
            <span className="brand-mark" aria-hidden="true">
              <Activity size={20} strokeWidth={2.4} />
            </span>
            <span>ysom</span>
          </Link>
          <div className="account-menu">
            <span className="account-avatar" aria-hidden="true">
              {account.email.slice(0, 1).toUpperCase()}
            </span>
            <span className="account-email">{account.email}</span>
            <button
              className="logout-button"
              type="button"
              onClick={() => void handleLogout()}
              disabled={busy}
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </header>

        <section className="dashboard-content">
          <div className="dashboard-welcome">
            <p className="eyebrow">YOUR ACCOUNT</p>
            <h1>Your dashboard</h1>
            <p>
              Welcome. Your YSOM account is ready; connect an authorized
              provider to start using mobile services.
            </p>
          </div>

          {error && (
            <p className="form-message error-message" role="alert">
              {error}
            </p>
          )}

          <section className="account-card" aria-labelledby="account-title">
            <span className="account-card-icon">
              <ShieldCheck size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 id="account-title">Account created</h2>
              <p>{account.email}</p>
            </div>
            <span className="account-created">
              {new Date(account.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </section>

          <div className="dashboard-section-heading">
            <div>
              <p className="eyebrow">GETTING STARTED</p>
              <h2>Your services</h2>
            </div>
            <span className="service-count">0 connected</span>
          </div>

          <div className="dashboard-service-grid">
            {services.map((service) => {
              const Icon =
                serviceIcons[service.id as keyof typeof serviceIcons] ??
                Smartphone;
              return (
                <article className="dashboard-service-card" key={service.id}>
                  <span className="service-icon">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span className="unavailable-label">Not connected</span>
                  <h3>{service.name}</h3>
                  <p>
                    This service is unavailable until an authorized provider
                    integration is configured.
                  </p>
                </article>
              );
            })}
          </div>

          <div className="dashboard-security-note">
            <CheckCircle2 size={18} aria-hidden="true" />
            <p>
              You&apos;re signed in securely. Your session expires after seven
              days or when you sign out.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const isRegistering = screen === "register";

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <Link className="brand auth-brand" href="/" aria-label="YSOM home">
          <span className="brand-mark" aria-hidden="true">
            <Activity size={20} strokeWidth={2.4} />
          </span>
          <span>ysom</span>
        </Link>

        <div className="auth-heading">
          <p className="eyebrow">YOUR SIM ONLINE MANAGER</p>
          <h1 id="auth-title">
            {isRegistering ? "Create your account" : "Welcome back"}
          </h1>
          <p>
            {isRegistering
              ? "One secure place for your supported mobile services."
              : "Sign in to continue to your YSOM dashboard."}
          </p>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button
            type="button"
            role="tab"
            aria-selected={!isRegistering}
            className={!isRegistering ? "auth-tab active" : "auth-tab"}
            onClick={() => switchScreen("sign-in")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isRegistering}
            className={isRegistering ? "auth-tab active" : "auth-tab"}
            onClick={() => switchScreen("register")}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            required
          />

          <div className="password-label-row">
            <label htmlFor="password">Password</label>
            {!isRegistering && (
              <span className="form-hint">Use your account password</span>
            )}
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isRegistering ? "new-password" : "current-password"}
            placeholder={
              isRegistering ? "At least 12 characters" : "Enter your password"
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={isRegistering ? 12 : 1}
            maxLength={128}
            required
          />
          {isRegistering && (
            <p className="password-hint">
              Use at least 12 characters. Your password is securely hashed.
            </p>
          )}

          {error && (
            <p className="form-message error-message" role="alert">
              {error}
            </p>
          )}
          {apiUnavailable && (
            <p className="form-message help-message">
              The login form needs the YSOM API and MySQL database to be running.
            </p>
          )}

          <button className="submit-button" type="submit" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle size={17} className="spin" aria-hidden="true" />
                Please wait…
              </>
            ) : (
              <>
                {isRegistering ? "Create account" : "Sign in"}
                <ArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="auth-privacy">
          <LockKeyhole size={16} aria-hidden="true" />
          <p>
            Your password is never stored as plain text. Service integrations
            are not yet connected.
          </p>
        </div>
      </section>

      <aside className="auth-aside">
        <div className="aside-mark" aria-hidden="true">
          <Activity size={26} strokeWidth={2.1} />
        </div>
        <p className="eyebrow">SIMPLE. SECURE. CONNECTED.</p>
        <h2>Mobile services, thoughtfully managed.</h2>
        <p>
          Manage supported SIM-related services through an account designed
          around privacy, transparency, and your authorization.
        </p>
        <div className="aside-status">
          <span className="status-dot" aria-hidden="true" />
          Integrations are not connected yet
        </div>
      </aside>
    </main>
  );
}
