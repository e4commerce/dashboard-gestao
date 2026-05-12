"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { discoverAccountsAction, type DiscoverState } from "./actions";

const initial: DiscoverState = { status: "idle" };

export function DiscoverAccountsButton() {
  const [state, formAction, pending] = useActionState(
    discoverAccountsAction,
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-md bg-action-primary px-3.5 py-2 text-sm font-medium text-fg-on-dark transition-colors hover:bg-action-primary-hover disabled:opacity-60"
      >
        <Search
          className={`size-3.5 ${pending ? "animate-pulse" : ""}`}
          strokeWidth={2.25}
        />
        {pending ? "Buscando…" : "Buscar contas no Meta"}
      </button>
      {state.status === "ok" && state.result ? (
        <span className="text-[11px] text-status-success">
          ✓ {state.result.discovered} conta(s) encontrada(s)
          {state.result.newlyAdded > 0
            ? ` · ${state.result.newlyAdded} nova(s)`
            : ""}
        </span>
      ) : null}
      {state.status === "error" ? (
        <span className="max-w-[320px] text-right text-[11px] text-status-error">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
