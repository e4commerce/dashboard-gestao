// Atribuição consolidada de canal por pedido.
// Especificação completa em docs internos: combina dados de jornada (firstVisit
// + lastVisit), parâmetros UTM (source/medium/campaign), referrer URLs e três
// modelos de toque (last_touch, last_click_strict, first_touch).
//
// Princípio central: valores "sem sinal" (direct, unknown, próprio site) NÃO
// classificam como Direct imediatamente — viram null e o fallback tenta o
// próximo sinal disponível. Direct só aparece quando nenhum sinal classifica.

export type ConsolidatedChannel =
  | "Meta"
  | "Google"
  | "Klaviyo-Inlead"
  | "Grupo VIP"
  | "WhatsApp"
  | "FoxAppy"
  | "TikTok"
  | "Direct";

export type TouchModel = "last_touch" | "last_click_strict" | "first_touch";

export type ChannelAttributionInput = {
  firstVisitSource?: string | null;
  lastVisitSource?: string | null;
  firstVisitUtmSource?: string | null;
  firstVisitUtmMedium?: string | null;
  firstVisitUtmCampaign?: string | null;
  lastVisitUtmSource?: string | null;
  lastVisitUtmMedium?: string | null;
  lastVisitUtmCampaign?: string | null;
  firstVisitReferrerUrl?: string | null;
  lastVisitReferrerUrl?: string | null;
};

// ─── Padrões de detecção ─────────────────────────────────────────────────────

const META_PATTERNS = [
  "facebook",
  "instagram",
  "meta",
  "linktr",
  "fb",
  "igshopping",
  "pinterest",
];

const GOOGLE_PATTERNS = [
  "google",
  "youtube",
  "googlesyndication",
  "gmail",
  "bing",
  "brave",
  "doubleclick",
  "yahoo",
  "uol",
];

const KLAVIYO_INLEAD_PATTERNS = [
  "klaviyo",
  "inlead",
  "pesquisa-interesses",
  "destaques",
];

// 'wax' e 'e4desk' são utm_source de ferramentas de disparo de WhatsApp.
const WHATSAPP_PATTERNS = ["whatsapp", "wax", "e4desk"];

const FOXAPPY_PATTERNS = ["foxappy", "loox"];

const TIKTOK_PATTERNS = ["tiktok", "pangleglobal"];

// Direct-pattern: trackers/gateways que aparecem como referrer mas não são
// canal de origem real (mercadopago, parcelpanel). Aqui retornamos Direct
// porque NÃO queremos cair pra firstVisit nesses casos — eles ofuscam o sinal.
const DIRECT_PATTERNS = ["mercadopago", "parcelpanel"];

// No-signal: valores que indicam ausência de origem (direct/unknown) ou tráfego
// interno (próprio site). Retornam null e deixam o fallback tentar a próxima
// fonte — diferente de DIRECT_PATTERNS que classificam direto como Direct.
const NO_SIGNAL_PATTERNS = ["direct", "an unknown source", "unknown"];

const OWN_SITE_PATTERNS = [
  "muranojoias.com",
  "conta.muranojoias",
  "muranojoias.troque",
];

// Grupo VIP: subset de WhatsApp identificado por utm_medium ou utm_campaign.
const GRUPO_VIP_MEDIUM_PATTERNS = ["grupovip"];
const GRUPO_VIP_CAMPAIGN_PATTERNS = ["grupovip", "whatsapp_grupovip"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchesAny(value: string, patterns: string[]): boolean {
  const lower = value.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function isNoSignal(value: string | null | undefined): boolean {
  if (!value) return true;
  const s = value.trim().toLowerCase();
  if (!s) return true;
  if (NO_SIGNAL_PATTERNS.some((p) => s.includes(p))) return true;
  if (OWN_SITE_PATTERNS.some((p) => s.includes(p))) return true;
  return false;
}

function classifySource(
  source: string | null | undefined,
): ConsolidatedChannel | null {
  if (!source) return null;
  const s = source.trim();
  if (!s) return null;
  if (isNoSignal(s)) return null;

  if (matchesAny(s, META_PATTERNS)) return "Meta";
  if (matchesAny(s, GOOGLE_PATTERNS)) return "Google";
  if (matchesAny(s, KLAVIYO_INLEAD_PATTERNS)) return "Klaviyo-Inlead";
  if (matchesAny(s, WHATSAPP_PATTERNS)) return "WhatsApp";
  if (matchesAny(s, FOXAPPY_PATTERNS)) return "FoxAppy";
  if (matchesAny(s, TIKTOK_PATTERNS)) return "TikTok";
  if (matchesAny(s, DIRECT_PATTERNS)) return "Direct";

  return null;
}

function isGrupoVip(
  utmMedium: string | null | undefined,
  utmCampaign: string | null | undefined,
): boolean {
  if (utmMedium && matchesAny(utmMedium, GRUPO_VIP_MEDIUM_PATTERNS)) return true;
  if (utmCampaign && matchesAny(utmCampaign, GRUPO_VIP_CAMPAIGN_PATTERNS))
    return true;
  return false;
}

function classifyUtm(
  utmSource: string | null | undefined,
  utmMedium: string | null | undefined,
  utmCampaign?: string | null | undefined,
): ConsolidatedChannel | null {
  if (isGrupoVip(utmMedium, utmCampaign)) return "Grupo VIP";
  const fromSource = classifySource(utmSource);
  if (fromSource) return fromSource;
  const fromMedium = classifySource(utmMedium);
  if (fromMedium) return fromMedium;
  return null;
}

// ─── API principal ───────────────────────────────────────────────────────────

export function getConsolidatedChannel(
  input: ChannelAttributionInput,
  touchModel: TouchModel = "last_touch",
): ConsolidatedChannel {
  const lastUtm = () =>
    classifyUtm(
      input.lastVisitUtmSource,
      input.lastVisitUtmMedium,
      input.lastVisitUtmCampaign,
    );
  const firstUtm = () =>
    classifyUtm(
      input.firstVisitUtmSource,
      input.firstVisitUtmMedium,
      input.firstVisitUtmCampaign,
    );
  const lastSrc = () => classifySource(input.lastVisitSource);
  const firstSrc = () => classifySource(input.firstVisitSource);
  const lastRef = () => classifySource(input.lastVisitReferrerUrl);
  const firstRef = () => classifySource(input.firstVisitReferrerUrl);

  const chain: Array<() => ConsolidatedChannel | null> =
    touchModel === "first_touch"
      ? [firstUtm, firstSrc, firstRef, lastUtm, lastSrc, lastRef]
      : touchModel === "last_click_strict"
        ? [lastUtm, lastSrc, lastRef]
        : [lastUtm, lastSrc, lastRef, firstUtm, firstSrc, firstRef];

  for (const step of chain) {
    const match = step();
    if (match) return match;
  }
  return "Direct";
}

// ─── Compat: API antiga usada no ETL ─────────────────────────────────────────

export type ChannelClassification = {
  channelName: string;
  subChannelName: string | null;
  channelHandle: string | null;
  isMarketplace: boolean;
};

// Mantém o shape que o ETL grava em `order_attribution`. channelName segue o
// novo classificador; subChannelName traz um detalhe quando facilmente
// derivável (Instagram vs Facebook dentro de Meta, etc.).
export function consolidaCanalPorSource(input: {
  sourceName?: string | null;
  firstVisitSource?: string | null;
  lastVisitSource?: string | null;
  firstVisitUtmSource?: string | null;
  lastVisitUtmSource?: string | null;
  firstVisitUtmMedium?: string | null;
  lastVisitUtmMedium?: string | null;
  firstVisitUtmCampaign?: string | null;
  lastVisitUtmCampaign?: string | null;
  firstVisitReferrerUrl?: string | null;
  lastVisitReferrerUrl?: string | null;
  // Aliases legados (compat com chamadas antigas que passavam só um par).
  utmMedium?: string | null;
  utmCampaign?: string | null;
}): ChannelClassification {
  // Aceita tanto os campos por visita quanto os legados (utmMedium/utmCampaign
  // colapsados). Quando vem o legado, joga em "last_visit" pra preservar
  // semântica anterior.
  const lastUtmMedium = input.lastVisitUtmMedium ?? input.utmMedium ?? null;
  const lastUtmCampaign =
    input.lastVisitUtmCampaign ?? input.utmCampaign ?? null;

  // Considera sourceName também como candidato — alguns clientes passam aqui
  // o canal já consolidado da Shopify (legacy).
  const adapter: ChannelAttributionInput = {
    firstVisitSource: input.firstVisitSource,
    lastVisitSource: input.lastVisitSource ?? input.sourceName,
    firstVisitUtmSource: input.firstVisitUtmSource,
    lastVisitUtmSource: input.lastVisitUtmSource,
    firstVisitUtmMedium: input.firstVisitUtmMedium,
    lastVisitUtmMedium: lastUtmMedium,
    firstVisitUtmCampaign: input.firstVisitUtmCampaign,
    lastVisitUtmCampaign: lastUtmCampaign,
    firstVisitReferrerUrl: input.firstVisitReferrerUrl,
    lastVisitReferrerUrl: input.lastVisitReferrerUrl,
  };

  const channelName = getConsolidatedChannel(adapter, "last_touch");

  const allTokens = [
    input.lastVisitUtmSource,
    input.lastVisitSource,
    input.firstVisitUtmSource,
    input.firstVisitSource,
    input.sourceName,
    input.lastVisitReferrerUrl,
    input.firstVisitReferrerUrl,
  ]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map((v) => v.trim().toLowerCase());

  let subChannelName: string | null = null;
  let channelHandle: string | null = null;
  for (const t of allTokens) {
    if (channelName === "Meta") {
      if (t.includes("instagram") || t.includes("igshopping")) {
        subChannelName = "Instagram";
        channelHandle = t;
        break;
      }
      if (t.includes("pinterest")) {
        subChannelName = "Pinterest";
        channelHandle = t;
        break;
      }
      if (t.includes("linktr")) {
        subChannelName = "Linktree";
        channelHandle = t;
        break;
      }
      if (t.includes("facebook") || t === "fb" || t.includes("meta")) {
        subChannelName = "Facebook";
        channelHandle = t;
        break;
      }
    } else if (channelName === "Google") {
      if (t.includes("youtube")) {
        subChannelName = "YouTube";
        channelHandle = t;
        break;
      }
      if (t.includes("gmail")) {
        subChannelName = "Gmail";
        channelHandle = t;
        break;
      }
      if (t.includes("bing")) {
        subChannelName = "Bing";
        channelHandle = t;
        break;
      }
      if (t.includes("brave")) {
        subChannelName = "Brave";
        channelHandle = t;
        break;
      }
      if (
        t.includes("doubleclick") ||
        t.includes("googlesyndication")
      ) {
        subChannelName = "Display";
        channelHandle = t;
        break;
      }
      if (t.includes("google")) {
        subChannelName = "Search";
        channelHandle = t;
        break;
      }
    } else if (channelName === "Klaviyo-Inlead") {
      if (t.includes("klaviyo")) {
        subChannelName = "Klaviyo";
        channelHandle = t;
        break;
      }
      if (t.includes("inlead")) {
        subChannelName = "Inlead";
        channelHandle = t;
        break;
      }
    } else if (channelName === "WhatsApp") {
      if (t.includes("wax")) {
        subChannelName = "Wax";
        channelHandle = t;
        break;
      }
      if (t.includes("e4desk")) {
        subChannelName = "E4DESK";
        channelHandle = t;
        break;
      }
      if (t.includes("whatsapp")) {
        subChannelName = "WhatsApp";
        channelHandle = t;
        break;
      }
    } else if (channelName === "TikTok") {
      subChannelName = "TikTok";
      channelHandle = t;
      break;
    } else if (channelName === "Grupo VIP") {
      subChannelName = "WhatsApp";
      channelHandle = "grupovip";
      break;
    }
  }

  return {
    channelName,
    subChannelName,
    channelHandle: channelHandle ?? (allTokens[0] ?? null),
    isMarketplace: false,
  };
}
