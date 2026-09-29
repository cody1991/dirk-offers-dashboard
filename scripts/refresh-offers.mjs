import fs from "node:fs/promises";
import path from "node:path";
import initSqlJs from "sql.js";

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public", "data");
const dbDir = path.join(root, "data");
const translationsPath = path.join(dbDir, "translations.json");
const offerUrl = "https://www.dirk.nl/aanbiedingen";
const storeUrl = "https://www.dirk.nl/winkels/almere/korte-promenade/68";
const store = {
  name: "Dirk supermarkt Almere",
  url: storeUrl
};
const force = process.argv.includes("--force");
const localHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hourCycle: "h23" }).format(new Date());
const generatedAt = new Date().toISOString();
const localDate = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
const archiveDate = `${localDate.year}-${localDate.month}-${localDate.day}`;
const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", weekday: "long" }).format(new Date());
const dutchWeekdays = { Monday: "Maandag", Tuesday: "Dinsdag", Wednesday: "Woensdag", Thursday: "Donderdag", Friday: "Vrijdag", Saturday: "Zaterdag", Sunday: "Zondag" };
const translations = new Map(Object.entries(JSON.parse(await fs.readFile(translationsPath, "utf8").catch(() => "{}"))));


function deriveOfferIdFromImageUrl(imageUrl) {
  if (!imageUrl || !imageUrl.includes("/offers/")) return null;
  const encodedPath = imageUrl.split("/offers/")[1] ?? "";
  const pathPart = decodeURIComponent(encodedPath.split("?")[0] ?? "");
  const digits = [];
  for (const segment of pathPart.split("/")) {
    if (/^\d$/.test(segment)) digits.push(segment);
    else break;
  }
  if (digits.length < 3) return null;
  return digits.reverse().join("");
}

function deepenProductUrl(productUrl, imageUrl) {
  const bare = productUrl?.replace(/\/$/, "") === offerUrl;
  if (!bare) return productUrl;
  const offerId = deriveOfferIdFromImageUrl(imageUrl);
  return offerId ? `${offerUrl}?offer=${offerId}` : productUrl;
}

const dutchWeekdayLong = { Monday: "maandag", Tuesday: "dinsdag", Wednesday: "woensdag", Thursday: "donderdag", Friday: "vrijdag", Saturday: "zaterdag", Sunday: "zondag" };
const dutchMonthLong = { January: "januari", February: "februari", March: "maart", April: "april", May: "mei", June: "juni", July: "juli", August: "augustus", September: "september", October: "oktober", November: "november", December: "december" };
const zhWeekday = { Monday: "星期一", Tuesday: "星期二", Wednesday: "星期三", Thursday: "星期四", Friday: "星期五", Saturday: "星期六", Sunday: "星期日" };

// Dirk encodes offer calendar days as UTC timestamps (end often 23:59Z).
// Format labels from the UTC calendar date so 2026-09-29T23:59:00.000Z stays 29 september.
function utcCalendarParts(iso) {
  const date = new Date(iso);
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return { weekday: weekdays[date.getUTCDay()], day: date.getUTCDate(), month: months[date.getUTCMonth()], monthNum: date.getUTCMonth() + 1 };
}

function formatDutchValidityDay(iso) {
  const parts = utcCalendarParts(iso);
  return `${dutchWeekdayLong[parts.weekday]} ${parts.day} ${dutchMonthLong[parts.month]}`;
}

function formatChineseValidityDay(iso) {
  const parts = utcCalendarParts(iso);
  return `${parts.monthNum}月${parts.day}日${zhWeekday[parts.weekday]}`;
}

function validityLabels(validFrom, validTo) {
  if (!validFrom || !validTo) return { validityNl: null, validityZh: null };
  return {
    validityNl: `Geldig van ${formatDutchValidityDay(validFrom)} t/m ${formatDutchValidityDay(validTo)}`,
    validityZh: `有效期为${formatChineseValidityDay(validFrom)}至${formatChineseValidityDay(validTo)}`
  };
}

function extractNuxtPayload(html) {
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function lit(data, ref, depth = 0) {
  if (depth > 8 || typeof ref !== "number" || ref < 0 || ref >= data.length) return ref;
  const value = data[ref];
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return value;
  return value;
}

function parseOfferValidityById(html) {
  const data = extractNuxtPayload(html);
  const byId = new Map();
  if (!Array.isArray(data)) return byId;
  for (const node of data) {
    if (!node || typeof node !== "object" || !("offerId" in node) || !("startDate" in node) || !("endDate" in node)) continue;
    const offerId = String(lit(data, node.offerId));
    const startDate = lit(data, node.startDate);
    const endDate = lit(data, node.endDate);
    const disclaimerStart = "disclaimerStartDate" in node ? lit(data, node.disclaimerStartDate) : null;
    const disclaimerEnd = "disclaimerEndDate" in node ? lit(data, node.disclaimerEndDate) : null;
    if (!/^\d+$/.test(offerId) || typeof startDate !== "string" || typeof endDate !== "string") continue;
    // Prefer disclaimer dates for calendar display when present (endDate is often 23:59Z).
    byId.set(offerId, {
      validFrom: typeof disclaimerStart === "string" ? disclaimerStart : startDate,
      validTo: typeof disclaimerEnd === "string" ? disclaimerEnd : endDate
    });
  }
  return byId;
}

function majorityValidity(validityById) {
  const counts = new Map();
  for (const value of validityById.values()) {
    const key = `${value.validFrom}|${value.validTo}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      const [validFrom, validTo] = key.split("|");
      best = { validFrom, validTo };
    }
  }
  return best;
}



async function fetchText(url, label, init = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(`${label} failed: ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      console.warn(`${label} attempt ${attempt}/3 failed: ${error.message ?? error}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}


function buildOfferImageUrl(imagePath) {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath.includes("?") ? imagePath : `${imagePath}?width=190`;
  // Nuxt stores paths like "1/3/3/9/3/1/Odorex....png" under offers/
  const encoded = imagePath.split("/").map(encodeURIComponent).join("/");
  const prefix = imagePath.startsWith("artikelen/") ? "" : (imagePath.startsWith("offers/") ? "" : "offers/");
  return `https://web-fileserver.dirk.nl/${prefix}${encoded}?width=190`;
}

function parseOffersFromNuxt(html) {
  const data = extractNuxtPayload(html);
  if (!Array.isArray(data)) return [];
  const categoryByOfferId = new Map();
  // Walk HTML sections for category labels tied to article data-product-id
  const headings = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => ({ index: m.index, name: m[1].replace(/&amp;/g, "&").trim() }));
  for (const match of html.matchAll(/<article data-product-id="(\d+)"[^>]*>/g)) {
    const heading = headings.filter((item) => item.index < match.index).at(-1)?.name ?? "其他";
    categoryByOfferId.set(match[1], heading);
  }
  const parsed = [];
  for (const node of data) {
    if (!node || typeof node !== "object" || !("offerId" in node) || !("headerText" in node) || !("offerPrice" in node)) continue;
    const offerId = String(lit(data, node.offerId));
    if (!/^\d+$/.test(offerId)) continue;
    const headerText = lit(data, node.headerText);
    const packaging = lit(data, node.packaging) ?? "";
    const sale = lit(data, node.offerPrice);
    let original = lit(data, node.normalPrice);
    if (typeof original !== "number") original = null;
    const imagePath = lit(data, node.image);
    const startDate = lit(data, node.startDate);
    const endDate = lit(data, node.endDate);
    if (typeof headerText !== "string" || typeof sale !== "number") continue;
    const name = `${headerText} ${typeof packaging === "string" ? packaging : ""}`.replace(/\s+/g, " ").trim();
    // Prefer category from HTML article; fall back to first product department
    let category = categoryByOfferId.get(offerId) ?? "其他";
    if (category === "其他" && typeof node.products === "number") {
      const products = data[node.products];
      if (Array.isArray(products) && products.length) {
        const first = typeof products[0] === "number" ? data[products[0]] : products[0];
        if (first && typeof first === "object" && typeof first.productInformation === "number") {
          const info = data[first.productInformation];
          if (info && typeof info === "object") {
            const dept = lit(data, info.department);
            if (typeof dept === "string") category = dept === "Vlees & vis" ? "Vlees, vis & vega" : dept;
          }
        }
      }
    }
    const imageUrl = buildOfferImageUrl(typeof imagePath === "string" ? imagePath : "");
    const productUrl = `${offerUrl}?offer=${offerId}`;
    const labels = validityLabels(typeof startDate === "string" ? startDate : null, typeof endDate === "string" ? endDate : null);
    parsed.push({
      name,
      category,
      sale,
      original,
      imageUrl,
      productUrl,
      offerId,
      validFrom: typeof startDate === "string" ? startDate : null,
      validTo: typeof endDate === "string" ? endDate : null,
      validityNl: labels.validityNl,
      validityZh: labels.validityZh
    });
  }
  // Deduplicate by name, prefer richer category
  const byName = new Map();
  for (const item of parsed) {
    const existing = byName.get(item.name);
    if (!existing || (existing.category === "其他" && item.category !== "其他")) byName.set(item.name, item);
  }
  return [...byName.values()];
}

function parseStoreHoursFromHtml(html, dutchWeekday) {
  const row = html.match(new RegExp(`${dutchWeekday}[^<]{0,40}?([0-2]\\d:[0-5]\\d)\\s*[–-]\\s*([0-2]\\d:[0-5]\\d)`, "i"));
  if (row) return { opensAt: row[1], closesAt: row[2] };
  const openTot = html.match(/Open tot\s+([0-2]\d:[0-5]\d)/i);
  return { opensAt: null, closesAt: openTot?.[1] ?? null };
}


if (!force && process.env.GITHUB_ACTIONS && localHour !== "10") {
  console.log(`Skipped: Amsterdam time is ${localHour}:00, not 10:00.`);
  process.exit(0);
}

function grams(name) {
  if (/\b(?:of|or)\b/i.test(name) || /\d+(?:[.,]\d+)?\s*(?:-|–)\s*\d+(?:[.,]\d+)?\s*(?:gram|g|kilo|kg)\b/i.test(name)) return null;
  const kg = name.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo|kg)\b/i);
  if (kg) return Number(kg[1].replace(",", ".")) * 1000;
  const g = name.match(/(\d+(?:[.,]\d+)?)\s*(?:gram|g)\b/i);
  return g ? Number(g[1].replace(",", ".")) : null;
}
function queryRows(result) {
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index]])));
}
function evidenceAdvice(offer) {
  const days = offer.metrics?.days;
  let variant = 2166136261;
  for (const character of offer.name) variant = Math.imul(variant ^ character.charCodeAt(0), 16777619) >>> 0;
  const phrase = (variants) => variants[(variant >>> 8) % variants.length];
  const spec = offer.grams ? `${offer.grams}克规格` : offer.package ? `该包装规格` : "单件规格";
  const unit = offer.unitPrice != null ? `，约€${offer.unitPrice.toFixed(2)}/公斤` : "";
  if (offer.original != null) {
    const saving = offer.original - offer.sale;
    const percent = Math.round(saving / offer.original * 100);
    return phrase([
      `${spec}省€${saving.toFixed(2)}，较原标降${percent}%，${days}日低价${unit}。`,
      `${spec}现价少€${saving.toFixed(2)}，折扣${percent}%，创${days}日低位${unit}。`,
      `${spec}比原价低${percent}%，价差€${saving.toFixed(2)}，${days}日最低${unit}。`,
      `${spec}让利€${saving.toFixed(2)}，降幅${percent}%，守住${days}日低点${unit}。`,
      `${spec}原标减€${saving.toFixed(2)}，直降${percent}%，${days}日未更低${unit}。`,
      `${spec}标价差€${saving.toFixed(2)}，优惠${percent}%，刷新${days}日低位${unit}。`,
      `${spec}省下€${saving.toFixed(2)}，价格低${percent}%，${days}日新低${unit}。`,
      `${spec}从原价降€${saving.toFixed(2)}，折扣${percent}%，处${days}日低点${unit}。`
    ]);
  }
  return phrase([
    `${spec}原价未列，€${offer.sale.toFixed(2)}为${days}日最低${unit}。`,
    `${spec}仅见€${offer.sale.toFixed(2)}现价，${days}日无更低${unit}。`,
    `${spec}缺原标，€${offer.sale.toFixed(2)}守住${days}日低位${unit}。`,
    `${spec}原价待核，€${offer.sale.toFixed(2)}刷新${days}日低点${unit}。`,
    `${spec}无标价对照，€${offer.sale.toFixed(2)}处${days}日低位${unit}。`,
    `${spec}原标未知，€${offer.sale.toFixed(2)}是${days}日观察低点${unit}。`,
    `${spec}只标€${offer.sale.toFixed(2)}，历史${days}日未见低价${unit}。`,
    `${spec}标价缺失，€${offer.sale.toFixed(2)}仍为${days}日最低${unit}。`
  ]);
}
let markdown = "";
let storeMarkdown = "";
let dirkHtml = "";
try {
  dirkHtml = await fetchText(offerUrl, "Dirk HTML", { headers: { "user-agent": "Mozilla/5.0 (compatible; DirkOffersBot/1.0)" } });
} catch (error) {
  console.warn(`Dirk HTML unavailable: ${error.message ?? error}`);
}
try {
  markdown = await fetchText(`https://r.jina.ai/${offerUrl}`, "Jina offer markdown");
} catch (error) {
  console.warn(`Jina offer markdown unavailable: ${error.message ?? error}`);
}
try {
  storeMarkdown = await fetchText(`https://r.jina.ai/${storeUrl}`, "Jina store markdown");
} catch (error) {
  console.warn(`Jina store markdown unavailable: ${error.message ?? error}`);
}

const validityById = parseOfferValidityById(dirkHtml);
const sharedValidity = majorityValidity(validityById);
if (sharedValidity) console.log(`Offer validity window: ${sharedValidity.validFrom} -> ${sharedValidity.validTo} (${validityById.size} Nuxt offers).`);
else console.warn("Could not parse offer validity dates from Dirk HTML Nuxt payload.");

let storeHours = storeMarkdown.match(new RegExp(`\\*\\s+${dutchWeekdays[weekday]}\\s*\\n+([0-2]\\d:[0-5]\\d)\\s*-\\s*([0-2]\\d:[0-5]\\d)`));
let storeClosesAt = storeHours?.[2] ?? storeMarkdown.match(/Almere Korte Promenade[\s\S]{0,100}?Open tot\s+([0-2]\d:[0-5]\d)/)?.[1];
let storeOpensAt = storeHours?.[1] ?? null;
if (!storeClosesAt) {
  let storeHtml = "";
  try {
    storeHtml = await fetchText(storeUrl, "Dirk store HTML", { headers: { "user-agent": "Mozilla/5.0 (compatible; DirkOffersBot/1.0)" }, redirect: "follow" });
  } catch (error) {
    console.warn(`Dirk store HTML unavailable: ${error.message ?? error}`);
  }
  const parsedStore = parseStoreHoursFromHtml(storeHtml, dutchWeekdays[weekday]);
  storeOpensAt = parsedStore.opensAt;
  storeClosesAt = parsedStore.closesAt;
}
if (!storeClosesAt) throw new Error(`Could not parse opening hours or today's closing time for ${store.name}`);
const todayStore = { ...store, opensAt: storeOpensAt, closesAt: storeClosesAt };

const offers = new Map();
const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)].map((m) => ({ index: m.index, name: m[1] }));
const product = /\[([^\]]+)\]\((https:\/\/www\.dirk\.nl\/(?:aanbiedingen|boodschappen)[^)]*)\)/g;
for (const match of markdown.matchAll(product)) {
  const name = match[1].replace(/\s+/g, " ").trim();
  if (name.length < 5 || name.includes("Image ")) continue;
  const prior = markdown.slice(Math.max(0, match.index - 3000), match.index);
  const chunks = prior.trim().split(/\n\s*\n/);
  const parts = chunks.at(-1).trim().match(/^(\d+)(?:\s+(\d+))?$/);
  if (!parts) continue;
  const sale = parts[2] ? Number(`${parts[1]}.${parts[2]}`) : Number(`0.${parts[1]}`);
  const original = chunks.at(-2)?.match(/van\s+(\d+\.\d+)/)?.[1];
  const heading = headings.filter((item) => item.index < match.index).at(-1)?.name ?? "其他";
  const imageUrl = [...prior.matchAll(/!\[Image \d+: Foto van [^\]]+\]\((https:[^)]+)\)/g)].at(-1)?.[1] ?? "";
  const productUrl = deepenProductUrl(match[2], imageUrl);
  const offerId = deriveOfferIdFromImageUrl(imageUrl) ?? productUrl.match(/[?&]offer=(\d+)/)?.[1] ?? null;
  const validity = (offerId && validityById.get(String(offerId))) || sharedValidity || null;
  const labels = validityLabels(validity?.validFrom, validity?.validTo);
  const candidate = { name, category: heading, sale, original: original ? Number(original) : null, imageUrl, productUrl, offerId: offerId ? String(offerId) : null, validFrom: validity?.validFrom ?? null, validTo: validity?.validTo ?? null, validityNl: labels.validityNl, validityZh: labels.validityZh };
  const existing = offers.get(name);
  if (!existing || (existing.category === "Weekendverwenners" && heading !== "Weekendverwenners")) offers.set(name, candidate);
}

const nuxtOffers = parseOffersFromNuxt(dirkHtml);
if (offers.size < Math.max(10, Math.floor(nuxtOffers.length * 0.75))) {
  console.warn(`Markdown parser yielded ${offers.size} offers vs ${nuxtOffers.length} Nuxt offers; merging Nuxt fallback.`);
  for (const candidate of nuxtOffers) {
    const existing = offers.get(candidate.name);
    if (!existing) offers.set(candidate.name, candidate);
  }
} else if (nuxtOffers.length) {
  console.log(`Markdown parser yielded ${offers.size} offers (Nuxt has ${nuxtOffers.length}); keeping markdown names for translation continuity.`);
}
if (offers.size === 0) throw new Error("No offers parsed from Jina markdown or Dirk Nuxt HTML.");


const output = [...offers.values()].map((item) => {
  const weight = grams(item.name);
  const unitPrice = weight ? Number((item.sale / weight * 1000).toFixed(2)) : null;
  return { ...item, nameZh: translations.get(item.name) ?? null, package: item.name.match(/(?:Bak|Pak|Zak|Per stuk|Schaal|Fles|Blik).*/i)?.[0] ?? "", grams: weight, unitPrice, discountPercent: item.original ? Math.round((1 - item.sale / item.original) * 100) : null };
}).sort((a, b) => (b.discountPercent ?? -1) - (a.discountPercent ?? -1) || a.name.localeCompare(b.name));

await fs.mkdir(publicDir, { recursive: true });
await fs.mkdir(dbDir, { recursive: true });
const SQL = await initSqlJs();
const dbPath = path.join(dbDir, "offers.sqlite");
const db = new SQL.Database(await fs.readFile(dbPath).catch(() => undefined));
const legacyTables = queryRows(db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('offers', 'snapshots')"));
db.run("CREATE TABLE IF NOT EXISTS price_stats (name TEXT PRIMARY KEY, days INTEGER NOT NULL, low REAL NOT NULL, high REAL NOT NULL, latest REAL NOT NULL, last_seen_date TEXT NOT NULL);");
if (legacyTables.some((table) => table.name === "offers") && legacyTables.some((table) => table.name === "snapshots")) {
  const rows = queryRows(db.exec("SELECT o.name, substr(s.generated_at, 1, 10) AS date, o.sale FROM offers o JOIN snapshots s ON s.id = o.snapshot_id ORDER BY s.generated_at ASC"));
  const dailyPrices = new Map(rows.map((row) => [`${row.name}|${row.date}`, row]));
  const stats = new Map();
  for (const row of dailyPrices.values()) {
    const current = stats.get(row.name) ?? { days: 0, low: row.sale, high: row.sale, latest: row.sale, lastSeenDate: row.date };
    current.days += 1;
    current.low = Math.min(current.low, row.sale);
    current.high = Math.max(current.high, row.sale);
    if (row.date >= current.lastSeenDate) { current.latest = row.sale; current.lastSeenDate = row.date; }
    stats.set(row.name, current);
  }
  db.run("BEGIN; DROP TABLE offers; DROP TABLE snapshots; COMMIT;");
  for (const [name, stat] of stats) db.run("INSERT OR REPLACE INTO price_stats VALUES (?, ?, ?, ?, ?, ?)", [name, stat.days, stat.low, stat.high, stat.latest, stat.lastSeenDate]);
}
const statsByName = new Map(queryRows(db.exec("SELECT name, days, low, high, latest, last_seen_date AS lastSeenDate FROM price_stats")).map((stat) => [stat.name, stat]));
for (const item of output) {
  const prior = statsByName.get(item.name);
  const days = prior ? prior.days + Number(prior.lastSeenDate !== archiveDate) : 1;
  const stat = { days, low: Math.min(prior?.low ?? item.sale, item.sale), high: Math.max(prior?.high ?? item.sale, item.sale), latest: item.sale, lastSeenDate: archiveDate };
  item.metrics = { days: stat.days, low: stat.low, high: stat.high, latest: stat.latest };
  db.run("INSERT OR REPLACE INTO price_stats VALUES (?, ?, ?, ?, ?, ?)", [item.name, stat.days, stat.low, stat.high, stat.latest, stat.lastSeenDate]);
}
for (const item of output) {
  item.advice = evidenceAdvice(item);
  const chineseChars = [...item.advice].filter((character) => /[\u3400-\u9fff]/.test(character)).length;
  if (chineseChars < 10 || chineseChars > 28) throw new Error(`Advice must contain 10-28 Chinese characters: ${item.name}`);
}
output.sort((a, b) => (b.discountPercent ?? -1) - (a.discountPercent ?? -1) || a.name.localeCompare(b.name));
db.run("VACUUM");
await fs.writeFile(dbPath, db.export());
db.close();
const payload = {
  generatedAt,
  sourceUrl: offerUrl,
  store: todayStore,
  validity: sharedValidity ? { validFrom: sharedValidity.validFrom, validTo: sharedValidity.validTo, ...validityLabels(sharedValidity.validFrom, sharedValidity.validTo) } : null,
  offers: output
};
await fs.writeFile(path.join(publicDir, "offers.json"), JSON.stringify(payload, null, 2));
const uniqueUrls = new Set(output.map((item) => item.productUrl)).size;
const deepLinked = output.filter((item) => /[?&]offer=\d+/.test(item.productUrl ?? "")).length;
console.log(`Saved ${output.length} offers for ${archiveDate}; ${uniqueUrls} unique productUrls (${deepLinked} ?offer= deep links); compact price statistics updated.`);
