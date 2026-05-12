import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getAllMetaAccounts } from "@/server/meta/sync";
import { DiscoverAccountsButton } from "./discover-button";
import { AccountToggle } from "./account-toggle";

const STATUS_LABEL: Record<number, string> = {
  1: "Ativa",
  2: "Desabilitada",
  3: "Não-paga",
  7: "Pendente review",
  8: "Em revisão",
  9: "Em grace period",
  100: "Pendente fechamento",
  101: "Pendente review/risco",
  102: "Desativada por user",
};

export default async function MetaContasPage() {
  const accounts = await getAllMetaAccounts();
  const enabledCount = accounts.filter((a) => a.enabled).length;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href="/marketing"
            className="flex w-fit items-center gap-1.5 text-xs text-fg-muted hover:text-fg-primary"
          >
            <ArrowLeft className="size-3" /> Marketing
          </Link>
          <PageHeader
            title="Contas Meta"
            subtitle={
              accounts.length === 0
                ? "Clique em 'Buscar contas' pra descobrir suas contas Meta"
                : `${enabledCount} de ${accounts.length} habilitadas`
            }
          />
        </div>
        <DiscoverAccountsButton />
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-default bg-surface-card p-12 text-center text-sm text-fg-muted">
          Nenhuma conta cadastrada ainda. Clique em &quot;Buscar contas no Meta&quot;
          pra puxar a lista usando o token configurado em
          {" "}<code className="rounded bg-surface-input px-1 py-0.5 text-[11px]">META_ACCESS_TOKEN</code>.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-default bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs uppercase tracking-wider text-fg-muted">
                <th className="px-4 py-3 font-medium">Ativar</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Moeda</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-border-subtle last:border-0"
                >
                  <td className="px-4 py-3">
                    <AccountToggle id={a.id} enabled={a.enabled} />
                  </td>
                  <td className="px-4 py-3 font-medium text-fg-primary">
                    {a.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-fg-muted">
                    {a.id}
                  </td>
                  <td className="px-4 py-3 text-fg-secondary">
                    {a.currency ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-secondary">
                    {a.accountStatus != null
                      ? `${STATUS_LABEL[a.accountStatus] ?? "?"} (${a.accountStatus})`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
