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
const [response, storeResponse] = await Promise.all([
  fetch(`https://r.jina.ai/${offerUrl}`),
  fetch(`https://r.jina.ai/${storeUrl}`)
]);
if (!response.ok) throw new Error(`Offer page request failed: ${response.status}`);
if (!storeResponse.ok) throw new Error(`Store page request failed: ${storeResponse.status}`);
const [markdown, storeMarkdown] = await Promise.all([response.text(), storeResponse.text()]);
const storeHours = storeMarkdown.match(new RegExp(`\\*\\s+${dutchWeekdays[weekday]}\\s*\\n+([0-2]\\d:[0-5]\\d)\\s*-\\s*([0-2]\\d:[0-5]\\d)`));
const storeClosesAt = storeHours?.[2] ?? storeMarkdown.match(/Almere Korte Promenade[\s\S]{0,100}?Open tot\s+([0-2]\d:[0-5]\d)/)?.[1];
if (!storeClosesAt) throw new Error(`Could not parse opening hours or today's closing time for ${store.name}`);
const todayStore = { ...store, opensAt: storeHours?.[1] ?? null, closesAt: storeClosesAt };
const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)].map((m) => ({ index: m.index, name: m[1] }));
const offers = new Map();
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
  const candidate = { name, category: heading, sale, original: original ? Number(original) : null, imageUrl, productUrl: match[2] };
  const existing = offers.get(name);
  if (!existing || (existing.category === "Weekendverwenners" && heading !== "Weekendverwenners")) offers.set(name, candidate);
}

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
const payload = { generatedAt, sourceUrl: offerUrl, store: todayStore, offers: output };
await fs.writeFile(path.join(publicDir, "offers.json"), JSON.stringify(payload, null, 2));
console.log(`Saved ${output.length} offers for ${archiveDate}; compact price statistics updated.`);
