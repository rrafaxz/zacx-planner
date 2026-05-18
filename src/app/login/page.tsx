"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data?.message || "Senha incorreta.");
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
    <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white flex items-center justify-center px-5">
      <section className="w-full max-w-sm rounded-3xl border border-black/10 dark:border-white/10 p-6 bg-white dark:bg-zinc-950">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1D10D7] text-white dark:bg-[#DFFF06] dark:text-black font-bold text-xl">
            Z
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            Acesso interno
          </h1>

          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Digite a senha para acessar o painel.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
            >
              Senha
            </label>

            <input
              id="password"
              type="password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite a senha"
              className="h-12 w-full rounded-2xl border border-black/15 dark:border-white/15 bg-transparent px-4 text-base outline-none focus:border-[#1D10D7] dark:focus:border-[#DFFF06]"
            />
          </div>

          {error ? (
            <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-2xl bg-[#1D10D7] text-white dark:bg-[#DFFF06] dark:text-black font-semibold disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}