import { describe, it, expect } from "vitest";
import { consolidaCanalPorSource } from "./channels";

describe("consolidaCanalPorSource", () => {
  describe("Meta", () => {
    it("classifies facebook source as Meta/Facebook", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "facebook" }).channelName,
      ).toBe("Meta");
      expect(
        consolidaCanalPorSource({ sourceName: "facebook" }).subChannelName,
      ).toBe("Facebook");
    });

    it("classifies instagram as Meta/Instagram", () => {
      const r = consolidaCanalPorSource({ sourceName: "instagram" });
      expect(r.channelName).toBe("Meta");
      expect(r.subChannelName).toBe("Instagram");
    });

    it("classifies igshopping as Meta/Instagram", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "igshopping" }).subChannelName,
      ).toBe("Instagram");
    });

    it("classifies pinterest as Meta/Pinterest", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "pinterest" }).subChannelName,
      ).toBe("Pinterest");
    });

    it("classifies linktree as Meta/Linktree", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "linktr.ee" }).subChannelName,
      ).toBe("Linktree");
    });
  });

  describe("Google", () => {
    it("classifies google as Google/Search", () => {
      const r = consolidaCanalPorSource({ sourceName: "google" });
      expect(r.channelName).toBe("Google");
      expect(r.subChannelName).toBe("Search");
    });

    it("classifies youtube as Google/YouTube", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "youtube" }).subChannelName,
      ).toBe("YouTube");
    });

    it("classifies gmail as Google/Gmail", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "gmail" }).subChannelName,
      ).toBe("Gmail");
    });

    it("classifies bing as Google/Bing", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "bing" }).subChannelName,
      ).toBe("Bing");
    });

    it("classifies googlesyndication as Google/Display", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "googlesyndication.com" })
          .subChannelName,
      ).toBe("Display");
    });
  });

  describe("Klaviyo-Inlead", () => {
    it("classifies klaviyo as Klaviyo-Inlead/Klaviyo", () => {
      const r = consolidaCanalPorSource({ sourceName: "klaviyo" });
      expect(r.channelName).toBe("Klaviyo-Inlead");
      expect(r.subChannelName).toBe("Klaviyo");
    });

    it("classifies inlead as Klaviyo-Inlead/Inlead", () => {
      const r = consolidaCanalPorSource({ sourceName: "inlead" });
      expect(r.channelName).toBe("Klaviyo-Inlead");
      expect(r.subChannelName).toBe("Inlead");
    });

    it("classifies pesquisa-interesses as Klaviyo-Inlead", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "pesquisa-interesses" })
          .channelName,
      ).toBe("Klaviyo-Inlead");
    });
  });

  describe("Grupo VIP", () => {
    it("classifies whatsapp + grupovip campaign as Grupo VIP", () => {
      const r = consolidaCanalPorSource({
        sourceName: "whatsapp",
        utmCampaign: "grupovip-novembro",
      });
      expect(r.channelName).toBe("Grupo VIP");
    });

    it("classifies whatsapp + grupovip medium as Grupo VIP", () => {
      const r = consolidaCanalPorSource({
        sourceName: "whatsapp",
        utmMedium: "grupo-vip",
      });
      expect(r.channelName).toBe("Grupo VIP");
    });

    it("does NOT classify plain whatsapp without grupovip as Grupo VIP", () => {
      const r = consolidaCanalPorSource({ sourceName: "whatsapp" });
      expect(r.channelName).toBe("WhatsApp");
    });
  });

  describe("Other channels", () => {
    it("classifies foxappy as FoxAppy", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "foxappy" }).channelName,
      ).toBe("FoxAppy");
    });

    it("classifies whatsapp as WhatsApp", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "whatsapp" }).channelName,
      ).toBe("WhatsApp");
    });

    it("classifies tiktok as TikTok", () => {
      expect(
        consolidaCanalPorSource({ sourceName: "tiktok" }).channelName,
      ).toBe("TikTok");
    });
  });

  describe("Fallthrough", () => {
    it("falls back to lastVisitSource when sourceName doesn't match", () => {
      const r = consolidaCanalPorSource({
        sourceName: "unknown",
        lastVisitSource: "google",
      });
      expect(r.channelName).toBe("Google");
    });

    it("falls back to firstVisitSource if neither sourceName nor lastVisitSource match", () => {
      const r = consolidaCanalPorSource({
        sourceName: "unknown",
        firstVisitSource: "facebook",
      });
      expect(r.channelName).toBe("Meta");
    });

    it("classifies as Direct when nothing matches", () => {
      const r = consolidaCanalPorSource({ sourceName: "unknown" });
      expect(r.channelName).toBe("Direct");
    });

    it("classifies empty input as Direct", () => {
      const r = consolidaCanalPorSource({});
      expect(r.channelName).toBe("Direct");
    });

    it("classifies direct sourceName as Direct", () => {
      const r = consolidaCanalPorSource({ sourceName: "direct" });
      expect(r.channelName).toBe("Direct");
    });

    it("prioritizes lastVisitSource over firstVisitSource", () => {
      const r = consolidaCanalPorSource({
        sourceName: "unknown",
        lastVisitSource: "facebook",
        firstVisitSource: "google",
      });
      expect(r.channelName).toBe("Meta");
    });
  });

  describe("Normalization", () => {
    it("handles uppercase input", () => {
      const r = consolidaCanalPorSource({ sourceName: "FACEBOOK" });
      expect(r.channelName).toBe("Meta");
    });

    it("handles whitespace", () => {
      const r = consolidaCanalPorSource({ sourceName: "  google  " });
      expect(r.channelName).toBe("Google");
    });

    it("handles null and undefined", () => {
      const r = consolidaCanalPorSource({
        sourceName: null,
        firstVisitSource: undefined,
      });
      expect(r.channelName).toBe("Direct");
    });
  });
});
