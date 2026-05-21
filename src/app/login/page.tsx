"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function AdminLoginLogo({ className }: { className?: string }) {
  return (
    <svg
      width="4448"
      height="2649"
      viewBox="0 0 4448 2649"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zacx"
      role="img"
    >
      <path
        d="M3617.62 458.388L3620.9 1282.93L3896.89 1282.35C4046.81 1282.03 4175.36 1334 4282.53 1438.26C4389.71 1542.52 4443.6 1669.61 4444.19 1819.52L3623.05 1821.28L3624.15 2097.26C3624.76 2249.45 3571.89 2379.04 3465.56 2486.02C3361.49 2593.01 3234.5 2646.66 3084.59 2646.98L3081.3 1822.43L2805.31 1823.02C2655.39 1823.34 2526.85 1771.37 2419.67 1667.11C2312.49 1562.85 2258.61 1435.76 2258.01 1285.84L3079.15 1284.09L3078.05 1008.11C3077.45 855.916 3129.17 726.331 3233.24 619.348C3339.57 512.361 3467.7 458.708 3617.62 458.388Z"
        fill="url(#paint0_linear_login_logo)"
      />
      <path
        d="M302.414 604.68C218.084 604.68 146.64 575.482 88.0817 516.759C29.3606 458.036 0 386.591 0 302.258V0H2231.89C2341.83 0 2436.11 39.4747 2515.06 118.098C2593.84 196.884 2633.32 291.329 2633.32 401.271C2633.32 522.142 2585.69 624.907 2490.43 709.076L956.502 2022.99H2330.74C2415.07 2022.99 2486.51 2053.17 2545.07 2113.69C2603.63 2174.2 2632.99 2246.63 2632.99 2330.8V2633.22H395.878C285.939 2633.22 192.475 2594.72 115.485 2517.73C38.495 2440.74 0 2347.27 0 2237.33V2231.79C0 2110.92 47.6294 2008.31 142.888 1923.98L1676.65 604.68H302.414Z"
        fill="url(#paint1_linear_login_logo)"
      />
      <defs>
        <linearGradient id="paint0_linear_login_logo" x1="3340.3" y1="411.327" x2="7149.03" y2="2532.87" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0015FF" />
          <stop offset="0.644222" stopColor="#D5FF00" />
        </linearGradient>
        <linearGradient id="paint1_linear_login_logo" x1="1309.11" y1="-57.3634" x2="5885.11" y2="2516.95" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0015FF" />
          <stop offset="0.644222" stopColor="#D5FF00" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [userSlug, setUserSlug] = useState("adm");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const introTimer = window.setTimeout(() => setIntroComplete(true), 5000);
    const formTimer = window.setTimeout(() => setFormVisible(true), 5600);

    return () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(formTimer);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug: userSlug, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message || "Senha incorreta");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/admin";

      router.replace(next);
      router.refresh();
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-screen flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f7f4] px-5 text-zinc-950">
      <section className="relative h-[460px] w-full max-w-sm" aria-label="Acesso ADM">
        <div className={introComplete ? "admin-login-logo admin-login-logo-final" : "admin-login-logo admin-login-logo-intro"}>
          <AdminLoginLogo className="h-auto w-full" />
        </div>

        <form
          onSubmit={handleSubmit}
          className={formVisible ? "admin-login-form admin-login-form-visible" : "admin-login-form"}
        >
          <div className="text-center">
            <h1 className="sora-heading text-2xl font-semibold tracking-normal text-zinc-950">
              Acesso Zacx Planner
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Escolha o usuário e entre com a senha.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <label htmlFor="userSlug" className="sr-only">
              Usuário
            </label>
            <select
              id="userSlug"
              value={userSlug}
              onChange={(event) => setUserSlug(event.target.value)}
              className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950 outline-none transition-colors focus:border-[#0015FF]"
            >
              <option value="adm">ADM</option>
              <option value="rafael">Rafael</option>
              <option value="matheus">Matheus</option>
            </select>
            <label htmlFor="password" className="sr-only">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoFocus={formVisible}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha"
              className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#0015FF]"
            />

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg border border-[#0015FF] bg-[#0015FF] text-sm font-semibold text-white transition-colors hover:bg-[#0012d8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>
      </section>

      <style jsx>{`
        .admin-login-screen {
          font-family: var(--font-poppins), Poppins, sans-serif;
        }

        .admin-login-logo {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(190px, 58vw);
          transform: translate(-50%, -50%);
          transform-origin: center;
          will-change: opacity, transform, top, width;
        }

        .admin-login-logo-intro {
          animation: admin-logo-intro 5s cubic-bezier(0.45, 0, 0.25, 1) both;
        }

        .admin-login-logo-final {
          top: 72px;
          width: min(122px, 40vw);
          transition: top 700ms cubic-bezier(0.2, 0.9, 0.25, 1), width 700ms cubic-bezier(0.2, 0.9, 0.25, 1),
            transform 700ms cubic-bezier(0.2, 0.9, 0.25, 1);
        }

        .admin-login-form {
          position: absolute;
          left: 0;
          right: 0;
          top: 154px;
          opacity: 0;
          transform: translateY(18px);
          pointer-events: none;
        }

        .admin-login-form-visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
          transition: opacity 650ms ease, transform 650ms cubic-bezier(0.2, 0.9, 0.25, 1);
        }

        @keyframes admin-logo-intro {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(0deg) scale(0.92);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(720deg) scale(1);
          }
        }

        @media (max-width: 640px) {
          .admin-login-logo-final {
            top: 82px;
          }

          .admin-login-form {
            top: 162px;
          }
        }
      `}</style>
    </main>
  );
}
