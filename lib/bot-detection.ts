// Heurística simples por User-Agent para excluir bots da contagem oficial.
// Cobre os crawlers/scrapers mais comuns que executam JS e podem disparar
// o pixel da Shopify (Headless Chrome, link previews, etc).
// Os eventos detectados ficam salvos com is_bot=true para auditoria.

const BOT_PATTERNS: RegExp[] = [
  /\bbot\b/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /headless/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /python-/i,
  /\brequests\b/i,
  /\baxios\b/i,
  /\bgo-http-client\b/i,
  /facebookexternalhit/i,
  /whatsapp/i,
  /slackbot/i,
  /telegrambot/i,
  /\bdiscord(bot)?\b/i,
  /pinterest/i,
  /linkedinbot/i,
  /twitterbot/i,
  /preview/i,
  /lighthouse/i,
  /pagespeed/i,
  /chrome-lighthouse/i,
  /ahrefs/i,
  /semrush/i,
  /\bmj12bot\b/i,
  /\bdotbot\b/i,
  /\bduckduckbot\b/i,
  /\byandex/i,
  /\bbaidu/i,
];

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true;
  if (ua.length < 10) return true;
  return BOT_PATTERNS.some((p) => p.test(ua));
}
