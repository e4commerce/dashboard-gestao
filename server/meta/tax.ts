// Imposto sobre spend Meta Ads (CIDE + IOF + ISS combinados).
// Aplicado em todo consumo de dado Meta — raw fica preservado no DB.
// Se a alíquota mudar, basta atualizar aqui.
export const META_TAX_RATE = 0.1383;
export const META_TAX_MULTIPLIER = 1 + META_TAX_RATE;
