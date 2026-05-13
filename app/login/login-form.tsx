"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Props = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Erro ao enviar código");
        return;
      }
      setStep("code");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        otp_code: code,
        redirect: false,
      });

      if (result?.error || !result?.ok) {
        setError("Código inválido ou expirado. Tente novamente.");
        setCode("");
        return;
      }

      router.push(callbackUrl || "/visao-geral");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "rounded-md border border-border-default bg-surface-input px-3 py-2 text-sm text-fg-primary outline-none focus:border-action-primary focus:ring-2 focus:ring-action-primary/40 disabled:opacity-50";

  return (
    <div className="w-full max-w-sm rounded-lg border border-border-default bg-surface-card p-8">
      <div className="mb-6 flex flex-col gap-1">
        <span className="text-base font-semibold text-fg-primary">
          Dashboard de Gestão
        </span>
        <span className="text-sm text-fg-muted">
          {step === "email"
            ? "Digite seu e-mail para receber um código de acesso"
            : `Código enviado para ${email}`}
        </span>
      </div>

      {step === "email" ? (
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-secondary">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className={inputClass}
            />
          </label>

          {error ? (
            <div className="rounded-md bg-status-error/10 px-3 py-2 text-xs text-status-error">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-fg-on-dark transition-colors hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Enviando…" : "Receber código"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-secondary">
              Código de 6 dígitos
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
              placeholder="000000"
              className={`${inputClass} tracking-[0.4em] text-center text-lg`}
            />
          </label>

          {error ? (
            <div className="rounded-md bg-status-error/10 px-3 py-2 text-xs text-status-error">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-fg-on-dark transition-colors hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verificando…" : "Entrar"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError("");
            }}
            className="text-xs text-fg-muted hover:text-fg-secondary"
          >
            ← Usar outro e-mail
          </button>
        </form>
      )}
    </div>
  );
}
