"use client";

import { useTransition } from "react";
import { toggleAccountAction } from "./actions";

type Props = { id: string; enabled: boolean };

export function AccountToggle({ id, enabled }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(() => toggleAccountAction(formData))
      }
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <button
        type="submit"
        disabled={pending}
        aria-label={enabled ? "Desativar conta" : "Ativar conta"}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-status-success" : "bg-border-default"
        }`}
      >
        <span
          className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </form>
  );
}
