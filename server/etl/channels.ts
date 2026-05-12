export type ChannelClassification = {
  channelName: string;
  subChannelName: string | null;
  channelHandle: string | null;
  isMarketplace: boolean;
};

type ClassifyInput = {
  sourceName?: string | null;
  firstVisitSource?: string | null;
  lastVisitSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

const norm = (s: string | null | undefined): string =>
  (s ?? "").toString().trim().toLowerCase();

function classifyToken(token: string): ChannelClassification | null {
  const t = token;
  if (!t) return null;

  if (
    /(^|\W)(facebook|instagram|meta|pinterest|igshopping|linktr)(\W|$)/.test(t)
  ) {
    if (t.includes("instagram") || t.includes("igshopping")) {
      return {
        channelName: "Meta",
        subChannelName: "Instagram",
        channelHandle: t,
        isMarketplace: false,
      };
    }
    if (t.includes("pinterest")) {
      return {
        channelName: "Meta",
        subChannelName: "Pinterest",
        channelHandle: t,
        isMarketplace: false,
      };
    }
    if (t.includes("linktr")) {
      return {
        channelName: "Meta",
        subChannelName: "Linktree",
        channelHandle: t,
        isMarketplace: false,
      };
    }
    return {
      channelName: "Meta",
      subChannelName: "Facebook",
      channelHandle: t,
      isMarketplace: false,
    };
  }

  if (
    /(^|\W)(google|youtube|gmail|googlesyndication|bing|brave|doubleclick)(\W|$)/.test(
      t,
    )
  ) {
    let sub = "Search";
    if (t.includes("youtube")) sub = "YouTube";
    else if (t.includes("gmail")) sub = "Gmail";
    else if (t.includes("bing")) sub = "Bing";
    else if (t.includes("brave")) sub = "Brave";
    else if (t.includes("doubleclick") || t.includes("googlesyndication"))
      sub = "Display";
    return {
      channelName: "Google",
      subChannelName: sub,
      channelHandle: t,
      isMarketplace: false,
    };
  }

  if (
    /(^|\W)(klaviyo|inlead|pesquisa-interesses|destaques)(\W|$)/.test(t)
  ) {
    return {
      channelName: "Klaviyo-Inlead",
      subChannelName: t.includes("klaviyo") ? "Klaviyo" : "Inlead",
      channelHandle: t,
      isMarketplace: false,
    };
  }

  if (/(^|\W)foxappy(\W|$)/.test(t)) {
    return {
      channelName: "FoxAppy",
      subChannelName: null,
      channelHandle: t,
      isMarketplace: false,
    };
  }

  if (/(^|\W)tiktok(\W|$)/.test(t)) {
    return {
      channelName: "TikTok",
      subChannelName: "TikTok",
      channelHandle: t,
      isMarketplace: false,
    };
  }

  if (/(^|\W)whatsapp(\W|$)/.test(t)) {
    return {
      channelName: "WhatsApp",
      subChannelName: null,
      channelHandle: t,
      isMarketplace: false,
    };
  }

  return null;
}

export function consolidaCanalPorSource(
  input: ClassifyInput,
): ChannelClassification {
  const source = norm(input.sourceName);
  const first = norm(input.firstVisitSource);
  const last = norm(input.lastVisitSource);
  const medium = norm(input.utmMedium);
  const campaign = norm(input.utmCampaign);

  const grupoVipPattern = /grupovip|grupo-vip|grupo_vip/;
  if (
    (source.includes("whatsapp") || first.includes("whatsapp") || last.includes("whatsapp")) &&
    (grupoVipPattern.test(medium) || grupoVipPattern.test(campaign))
  ) {
    return {
      channelName: "Grupo VIP",
      subChannelName: "WhatsApp",
      channelHandle: "grupovip",
      isMarketplace: false,
    };
  }

  for (const candidate of [source, last, first]) {
    const match = classifyToken(candidate);
    if (match) return match;
  }

  return {
    channelName: "Direct",
    subChannelName: null,
    channelHandle: source || "direct",
    isMarketplace: false,
  };
}
