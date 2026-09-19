import fs from "node:fs/promises";
import path from "node:path";
import initSqlJs from "sql.js";

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public", "data");
const dbDir = path.join(root, "data");
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

if (!force && process.env.GITHUB_ACTIONS && localHour !== "10") {
  console.log(`Skipped: Amsterdam time is ${localHour}:00, not 10:00.`);
  process.exit(0);
}

const friendTerms = new Map([
  ["Roerbakgarnalen", { label: "觉得便宜", rank: 2, note: "朋友认为便宜，但提醒去壳后量会少。" }],
  ["XL watermeloen", { label: "推荐购买", rank: 3, note: "朋友说西瓜便宜，建议买。" }],
  ["Aardbeien", { label: "可以购买", rank: 2, note: "朋友确认草莓可以。" }],
  ["blauwe bessen", { label: "可以购买", rank: 2, note: "朋友确认蓝莓也可以。" }],
  ["Chinese kool", { label: "可以购买", rank: 2, note: "朋友确认大白菜也可以。" }],
  ["Galia meloen", { label: "推荐购买", rank: 3, note: "朋友确认是哈密瓜，可以买。" }],
  ["Handperen", { label: "可以购买", rank: 2, note: "朋友确认雪梨可以。" }],
  ["Cocktail trostomaten", { label: "推荐购买", rank: 3, note: "朋友说这种串番茄好吃，建议买。" }],
  ["Kipkluifjes gekruid", { label: "可以购买", rank: 2, note: "朋友确认腌制好，适合空气炸锅。" }],
  ["Mango", { label: "可以尝试", rank: 1, note: "朋友觉得芒果看起来很大。" }],
  ["Kersen verpakt", { label: "觉得便宜", rank: 2, note: "朋友认为樱桃便宜。" }],
  ["witte druiven", { label: "觉得便宜", rank: 2, note: "朋友认为葡萄/油桃很便宜。" }]
]);
function grams(name) { if (/\b(?:of|or)\b/i.test(name)) return null; const kg = name.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo|kg)\b/i); if (kg) return Number(kg[1].replace(",", ".")) * 1000; const g = name.match(/(\d+(?:[.,]\d+)?)\s*(?:gram|g)\b/i); return g ? Number(g[1].replace(",", ".")) : null; }
function queryRows(result) {
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index]])));
}
function evidenceAdvice(offer) {
  const low = offer.metrics?.low;
  const days = offer.metrics?.days;
  let variant = 2166136261;
  for (const character of offer.name) variant = Math.imul(variant ^ character.charCodeAt(0), 16777619) >>> 0;
  const shortName = offer.name;
  const pickPhrase = (openings, evidence) => `${openings[(variant >>> 16) & 7]}${evidence[(variant >>> 8) & 7]}`;
  if (offer.original != null) {
    const saving = offer.original - offer.sale;
    const percent = Math.round(saving / offer.original * 100);
    return pickPhrase([
      `${shortName}现价€${offer.sale.toFixed(2)}，`, `${shortName}今日标价€${offer.sale.toFixed(2)}，`,
      `${shortName}页面售价€${offer.sale.toFixed(2)}，`, `${shortName}本期促销€${offer.sale.toFixed(2)}，`,
      `${shortName}货架现价€${offer.sale.toFixed(2)}，`, `${shortName}当前价格€${offer.sale.toFixed(2)}，`,
      `${shortName}优惠现价€${offer.sale.toFixed(2)}，`, `${shortName}这期售价€${offer.sale.toFixed(2)}，`
    ], [
      `较原价省€${saving.toFixed(2)}，创近${days}日低。`, `比标价降${percent}%，为近${days}日最低。`,
      `原价少€${saving.toFixed(2)}，近${days}日未见更低。`, `折扣${percent}%，记录近${days}日低点。`,
      `比原价低${percent}%，处近${days}日低位。`, `标价让€${saving.toFixed(2)}，刷新近${days}日低价。`,
      `优惠€${saving.toFixed(2)}，近${days}日价格最低。`, `较原价减${percent}%，守住近${days}日低。`
    ]);
  }
  return pickPhrase([
    `${shortName}现价€${offer.sale.toFixed(2)}，`, `${shortName}今日售价€${offer.sale.toFixed(2)}，`,
    `${shortName}页面价格€${offer.sale.toFixed(2)}，`, `${shortName}本期价€${offer.sale.toFixed(2)}，`,
    `${shortName}当前售价€${offer.sale.toFixed(2)}，`, `${shortName}货架价€${offer.sale.toFixed(2)}，`,
    `${shortName}促销价€${offer.sale.toFixed(2)}，`, `${shortName}本页现价€${offer.sale.toFixed(2)}，`
  ], [
    `原价未列，创近${days}日观察低点。`, `无原价可比，为近${days}日低价。`,
    `标价缺失，近${days}日未见更低。`, `原价未标，记录近${days}日低位。`,
    `暂无标价，刷新近${days}日低点。`, `缺少原价，近${days}日价格最低。`,
    `原价未给，守住近${days}日低价。`, `未见原价，处近${days}日观察低位。`
  ]);
}
function recommendation(offer) {
  if ((offer.discountPercent ?? 0) >= 60) return { rank: 3, label: "强烈推荐" };
  if ((offer.discountPercent ?? 0) >= 50) return { rank: 2, label: "优先看看" };
  if ((offer.discountPercent ?? 0) >= 40 && offer.metrics?.low != null && Math.abs(offer.sale - offer.metrics.low) < 0.005) return { rank: 1, label: "值得关注" };
  return { rank: 0, label: "" };
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
  const friend = [...friendTerms.entries()].find(([term]) => item.name.includes(term))?.[1] ?? null;
  const weight = grams(item.name);
  const unitPrice = weight ? Number((item.sale / weight * 1000).toFixed(2)) : null;
  return { ...item, package: item.name.match(/(?:Bak|Pak|Zak|Per stuk|Schaal|Fles|Blik).*/i)?.[0] ?? "", grams: weight, unitPrice, friendPick: Boolean(friend), friendLabel: friend?.label ?? "", friendRank: friend?.rank ?? 0, discountPercent: item.original ? Math.round((1 - item.sale / item.original) * 100) : null };
}).sort((a, b) => b.friendRank - a.friendRank || (b.discountPercent ?? -1) - (a.discountPercent ?? -1) || a.name.localeCompare(b.name));

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
  const pick = recommendation(item);
  item.recommendationRank = pick.rank;
  item.recommendationLabel = pick.label;
}
output.sort((a, b) => b.recommendationRank - a.recommendationRank || b.friendRank - a.friendRank || (b.discountPercent ?? -1) - (a.discountPercent ?? -1) || a.name.localeCompare(b.name));
db.run("VACUUM");
await fs.writeFile(dbPath, db.export());
db.close();
const payload = { generatedAt, sourceUrl: offerUrl, store: todayStore, offers: output };
await fs.writeFile(path.join(publicDir, "offers.json"), JSON.stringify(payload, null, 2));
console.log(`Saved ${output.length} offers for ${archiveDate}; compact price statistics updated.`);
