import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { AuthError } from "next-auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/visao-geral");

  const params = await searchParams;
  const error = params.error;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: (formData.get("callbackUrl") as string) || "/visao-geral",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/login?error=${encodeURIComponent("invalid")}`);
      }
      throw err;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        action={login}
        className="w-full max-w-sm rounded-lg border border-border-default bg-surface-card p-8"
      >
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-base font-semibold text-fg-primary">
            Dashboard de Gestão
          </span>
          <span className="text-sm text-fg-muted">
            Entre com suas credenciais
          </span>
        </div>

        <input
          type="hidden"
          name="callbackUrl"
          defaultValue={params.callbackUrl ?? ""}
        />

        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-secondary">E-mail</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-border-default bg-surface-input px-3 py-2 text-sm text-fg-primary outline-none focus:border-action-primary focus:ring-2 focus:ring-action-primary/40"
          />
        </label>

        <label className="mb-5 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-secondary">Senha</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-border-default bg-surface-input px-3 py-2 text-sm text-fg-primary outline-none focus:border-action-primary focus:ring-2 focus:ring-action-primary/40"
          />
        </label>

        {error ? (
          <div className="mb-4 rounded-md bg-status-error/10 px-3 py-2 text-xs text-status-error">
            E-mail ou senha inválidos.
          </div>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-fg-on-dark transition-colors hover:bg-action-primary-hover"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
