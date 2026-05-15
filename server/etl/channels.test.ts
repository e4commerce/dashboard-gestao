import { describe, it, expect } from "vitest";
import {
  consolidaCanalPorSource,
  getConsolidatedChannel,
} from "./channels";

describe("getConsolidatedChannel (new API)", () => {
  describe("classifySource via lastVisitSource", () => {
    it("classifies instagram as Meta", () => {
      expect(
        getConsolidatedChannel({ lastVisitSource: "Instagram" }),
      ).toBe("Meta");
    });

    it("classifies youtube as Google", () => {
      expect(
        getConsolidatedChannel({ lastVisitSource: "youtube.com" }),
      ).toBe("Google");
    });

    it("classifies klaviyo as Klaviyo-Inlead", () => {
      expect(
        getConsolidatedChannel({ lastVisitSource: "klaviyo" }),
      ).toBe("Klaviyo-Inlead");
    });

    it("classifies tiktok as TikTok", () => {
      expect(
        getConsolidatedChannel({ lastVisitSource: "tiktok" }),
      ).toBe("TikTok");
    });

    it("classifies foxappy as FoxAppy", () => {
      expect(
        getConsolidatedChannel({ lastVisitSource: "foxappy" }),
      ).toBe("FoxAppy");
    });

    it("classifies loox as FoxAppy", () => {
      expect(
        getConsolidatedChannel({ lastVisitSource: "loox.io" }),
      ).toBe("FoxAppy");
    });
  });

  describe("UTM source overrides Shopify-derived source", () => {
    it("utm_source=wax → WhatsApp even when lastVisitSource=Direct", () => {
      expect(
        getConsolidatedChannel({
          lastVisitSource: "Direct",
          lastVisitUtmSource: "wax",
        }),
      ).toBe("WhatsApp");
    });

    it("utm_source=e4desk → WhatsApp", () => {
      expect(
        getConsolidatedChannel({
          lastVisitSource: "Unknown",
          lastVisitUtmSource: "E4DESK",
        }),
      ).toBe("WhatsApp");
    });

    it("utm_source=klaviyo with Shopify source=Email → Klaviyo-Inlead", () => {
      expect(
        getConsolidatedChannel({
          lastVisitSource: "Email",
          lastVisitUtmSource: "klaviyo",
        }),
      ).toBe("Klaviyo-Inlead");
    });
  });

  describe("isNoSignal — fallback to next source", () => {
    it("falls back to firstVisit when lastVisit=direct", () => {
      expect(
        getConsolidatedChannel({
          lastVisitSource: "direct",
          firstVisitSource: "Instagram",
        }),
      ).toBe("Meta");
    });

    it("falls back to firstVisit when lastVisit=unknown", () => {
      expect(
        getConsolidatedChannel({
          lastVisitSource: "an unknown source",
          firstVisitSource: "google",
        }),
      ).toBe("Google");
    });

    it("treats own-site referrer (muranojoias.com) as no-signal", () => {
      expect(
        getConsolidatedChannel({
          lastVisitReferrerUrl: "https://muranojoias.com/cart",
          firstVisitSource: "facebook",
        }),
      ).toBe("Meta");
    });

    it("returns Direct when all signals are no-signal", () => {
      expect(
        getConsolidatedChannel({
          firstVisitSource: "direct",
          lastVisitSource: "unknown",
        }),
      ).toBe("Direct");
    });

    it("returns Direct on empty input", () => {
      expect(getConsolidatedChannel({})).toBe("Direct");
    });
  });

  describe("Grupo VIP detection", () => {
    it("utm_medium=grupovip → Grupo VIP regardless of source", () => {
      expect(
        getConsolidatedChannel({
          lastVisitUtmSource: "whatsapp",
          lastVisitUtmMedium: "grupovip",
        }),
      ).toBe("Grupo VIP");
    });

    it("utm_campaign=whatsapp_grupovip → Grupo VIP", () => {
      expect(
        getConsolidatedChannel({
          lastVisitUtmCampaign: "whatsapp_grupovip",
        }),
      ).toBe("Grupo VIP");
    });

    it("plain whatsapp without grupovip → WhatsApp", () => {
      expect(
        getConsolidatedChannel({
          lastVisitUtmSource: "whatsapp",
        }),
      ).toBe("WhatsApp");
    });
  });

  describe("Mercadopago / parcelpanel referrers → Direct (not no-signal)", () => {
    it("mercadopago referrer → Direct, doesn't fall through", () => {
      expect(
        getConsolidatedChannel({
          lastVisitReferrerUrl: "https://www.mercadopago.com.br/checkout",
          firstVisitSource: "facebook",
        }),
      ).toBe("Direct");
    });
  });

  describe("Touch models", () => {
    it("last_touch: prefers lastVisit over firstVisit", () => {
      expect(
        getConsolidatedChannel(
          {
            firstVisitSource: "google",
            lastVisitSource: "facebook",
          },
          "last_touch",
        ),
      ).toBe("Meta");
    });

    it("first_touch: prefers firstVisit over lastVisit", () => {
      expect(
        getConsolidatedChannel(
          {
            firstVisitSource: "google",
            lastVisitSource: "facebook",
          },
          "first_touch",
        ),
      ).toBe("Google");
    });

    it("last_click_strict: returns Direct without fallback to firstVisit", () => {
      expect(
        getConsolidatedChannel(
          {
            firstVisitSource: "google",
            lastVisitSource: "direct",
          },
          "last_click_strict",
        ),
      ).toBe("Direct");
    });

    it("last_touch: falls back to firstVisit when lastVisit=no-signal", () => {
      expect(
        getConsolidatedChannel(
          {
            firstVisitSource: "google",
            lastVisitSource: "direct",
          },
          "last_touch",
        ),
      ).toBe("Google");
    });
  });

  describe("Case insensitivity and partial matches", () => {
    it("uppercase tokens work", () => {
      expect(
        getConsolidatedChannel({ lastVisitSource: "FACEBOOK" }),
      ).toBe("Meta");
    });

    it("partial match: instagram.com matches Meta", () => {
      expect(
        getConsolidatedChannel({ lastVisitReferrerUrl: "https://instagram.com" }),
      ).toBe("Meta");
    });

    it("partial match: facebook_ads in utm_source matches Meta", () => {
      expect(
        getConsolidatedChannel({ lastVisitUtmSource: "facebook_ads" }),
      ).toBe("Meta");
    });
  });
});

describe("consolidaCanalPorSource (legacy wrapper)", () => {
  it("returns shape compatible with ETL (channelName + subChannelName)", () => {
    const r = consolidaCanalPorSource({
      sourceName: "instagram",
    });
    expect(r.channelName).toBe("Meta");
    expect(r.subChannelName).toBe("Instagram");
  });

  it("derives Facebook subchannel", () => {
    const r = consolidaCanalPorSource({ sourceName: "facebook" });
    expect(r.channelName).toBe("Meta");
    expect(r.subChannelName).toBe("Facebook");
  });

  it("derives Klaviyo subchannel when utm_source=klaviyo", () => {
    const r = consolidaCanalPorSource({
      lastVisitUtmSource: "klaviyo",
      lastVisitSource: "Email",
    });
    expect(r.channelName).toBe("Klaviyo-Inlead");
    expect(r.subChannelName).toBe("Klaviyo");
  });

  it("derives Wax subchannel for utm_source=Wax", () => {
    const r = consolidaCanalPorSource({
      lastVisitUtmSource: "Wax",
    });
    expect(r.channelName).toBe("WhatsApp");
    expect(r.subChannelName).toBe("Wax");
  });

  it("derives E4DESK subchannel for utm_source=E4DESK", () => {
    const r = consolidaCanalPorSource({
      lastVisitUtmSource: "E4DESK",
    });
    expect(r.channelName).toBe("WhatsApp");
    expect(r.subChannelName).toBe("E4DESK");
  });

  it("accepts legacy utmMedium/utmCampaign for Grupo VIP", () => {
    const r = consolidaCanalPorSource({
      sourceName: "whatsapp",
      utmCampaign: "grupovip-novembro",
    });
    expect(r.channelName).toBe("Grupo VIP");
  });

  it("classifies as Direct on empty input", () => {
    const r = consolidaCanalPorSource({});
    expect(r.channelName).toBe("Direct");
  });
});
