export const METAS_ADMIN = "thiago@muranojoias.com.br";

export const ALLOWED_EMAILS = new Set([
  "thiago@muranojoias.com.br",
  "vinicius@muranojoias.com.br",
  "emanuele@muranojoias.com.br",
  "alan@muranojoias.com.br",
  "octavio@muranojoias.com.br",
  "caio@muranojoias.com.br",
  "lucas@muranojoias.com.br",
  "guilherme@muranojoias.com.br",
]);

const NAME_MAP: Record<string, string> = {
  "thiago@muranojoias.com.br": "Thiago",
  "vinicius@muranojoias.com.br": "Vinicius",
  "emanuele@muranojoias.com.br": "Emanuele",
  "alan@muranojoias.com.br": "Alan",
  "octavio@muranojoias.com.br": "Octavio",
  "caio@muranojoias.com.br": "Caio",
  "lucas@muranojoias.com.br": "Lucas",
  "guilherme@muranojoias.com.br": "Guilherme",
};

export function getNameForEmail(email: string): string {
  return NAME_MAP[email] ?? email.split("@")[0];
}
