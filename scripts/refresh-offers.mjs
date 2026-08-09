import fs from "node:fs/promises";
import path from "node:path";
import initSqlJs from "sql.js";

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public", "data");
const historyDir = path.join(publicDir, "history");
const dbDir = path.join(root, "data");
const offerUrl = "https://www.dirk.nl/aanbiedingen";
const force = process.argv.includes("--force");
const localHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hourCycle: "h23" }).format(new Date());
const generatedAt = new Date().toISOString();
const localDate = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
const archiveDate = `${localDate.year}-${localDate.month}-${localDate.day}`;

if (!force && process.env.GITHUB_ACTIONS && localHour !== "10") {
  console.log(`Skipped: Amsterdam time is ${localHour}:00, not 10:00.`);
  process.exit(0);
}

const translations = [
  ["Aardbeien", "草莓"], ["Chinese kool", "大白菜"], ["Cocktail trostomaten", "串番茄"], ["Handperen", "雪梨"], ["blauwe bessen", "蓝莓"], ["Galia meloen", "哈密瓜"], ["Roerbakgarnalen", "炒虾"], ["Kipkluifjes gekruid", "腌制鸡翅根"], ["XL watermeloen", "特大西瓜"], ["Kersen", "樱桃"], ["Mango ready to eat", "即食芒果"], ["witte druiven", "白葡萄"], ["Nectarines", "油桃"], ["courgette", "西葫芦"], ["rode paprika", "红甜椒"], ["Uien", "洋葱"], ["Avocado", "牛油果"], ["koffiebonen", "咖啡豆"], ["koffie", "咖啡"], ["Magnum ijs", "梦龙冰淇淋"], ["Friet", "薯条"], ["pasta", "意大利面"], ["pastasaus", "意面酱"], ["wasmiddel", "洗衣液/洗衣凝珠"], ["shampoo", "洗发水"], ["conditioner", "护发素"], ["deodorant", "止汗剂"], ["Klene", "甘草糖"], ["Lay", "乐事薯片"], ["Heineken", "喜力啤酒"], ["Grolsch", "格罗尔施啤酒"]
];
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
const personalPurchases = [
  ["XL watermeloen", 3.99, "2026-08-08"], ["Kipkluifjes gekruid", 3.99, "2026-08-08"], ["Roerbakgarnalen", 2.99, "2026-08-08"], ["Roombroodjes", 2.49, "2026-08-08"], ["Magnum ijs", 2.99, "2026-08-08"]
];
function chineseName(name) { let value = name; for (const [nl, zh] of translations) value = value.replace(new RegExp(nl, "ig"), zh); return value.replace(/1 de Beste/ig, "Dirk 自有品牌").replace(/Biologische/ig, "有机").replace(/verpakt/ig, "包装").replace(/Per stuk/ig, "每个").replace(/\s+/g, " ").trim(); }
function grams(name) { if (/\b(?:of|or)\b/i.test(name)) return null; const kg = name.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo|kg)\b/i); if (kg) return Number(kg[1].replace(",", ".")) * 1000; const g = name.match(/(\d+(?:[.,]\d+)?)\s*(?:gram|g)\b/i); return g ? Number(g[1].replace(",", ".")) : null; }
function analysis(offer) {
  const saving = offer.original == null ? null : offer.original - offer.sale;
  const percent = saving == null ? null : Math.round(saving / offer.original * 100);
  const perKg = offer.unitPrice;
  const prefix = saving == null ? `现价 €${offer.sale.toFixed(2)}` : `省 €${saving.toFixed(2)}（${percent}%）`;
  if (offer.name.includes("XL watermeloen")) return `${prefix}；约 €${perKg.toFixed(2)}/kg，是本页最值的水果。`;
  if (offer.name.includes("Roerbakgarnalen")) return `${prefix}；约 €${perKg.toFixed(2)}/kg，单价仍高，不必囤。`;
  if (percent != null && percent >= 45) return `${prefix}；折扣很大，刚好需要就带。`;
  if (percent != null && percent >= 25) return `${prefix}${perKg ? `；约 €${perKg.toFixed(2)}/kg` : ""}，正常好价。`;
  return `${prefix}${perKg ? `；约 €${perKg.toFixed(2)}/kg` : ""}，折扣有限，不缺不用凑。`;
}

const response = await fetch(`https://r.jina.ai/${offerUrl}`);
if (!response.ok) throw new Error(`Offer page request failed: ${response.status}`);
const markdown = await response.text();
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
  const analysisData = { ...item, grams: weight, unitPrice };
  return { ...item, nameZh: chineseName(item.name), package: item.name.match(/(?:Bak|Pak|Zak|Per stuk|Schaal|Fles|Blik).*/i)?.[0] ?? "", grams: weight, unitPrice, friendPick: Boolean(friend), friendNote: friend?.note ?? "", friendLabel: friend?.label ?? "", friendRank: friend?.rank ?? 0, discountPercent: item.original ? Math.round((1 - item.sale / item.original) * 100) : null, advice: analysis(analysisData) };
}).sort((a, b) => b.friendRank - a.friendRank || (b.discountPercent ?? -1) - (a.discountPercent ?? -1) || a.nameZh.localeCompare(b.nameZh));

await fs.mkdir(publicDir, { recursive: true });
await fs.mkdir(historyDir, { recursive: true });
await fs.mkdir(dbDir, { recursive: true });
const SQL = await initSqlJs();
const dbPath = path.join(dbDir, "offers.sqlite");
const db = new SQL.Database(await fs.readFile(dbPath).catch(() => undefined));
db.run("CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, generated_at TEXT NOT NULL, source_url TEXT NOT NULL); CREATE TABLE IF NOT EXISTS offers (snapshot_id INTEGER, name TEXT, name_zh TEXT, category TEXT, sale REAL, original_price REAL, image_url TEXT, friend_pick INTEGER, advice TEXT); CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY, product_name TEXT NOT NULL, product_name_zh TEXT NOT NULL, paid_price REAL NOT NULL, purchased_on TEXT NOT NULL, UNIQUE(product_name, paid_price, purchased_on));");
db.run("INSERT INTO snapshots (generated_at, source_url) VALUES (?, ?)", [generatedAt, offerUrl]);
const snapshotId = db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0];
for (const item of output) db.run("INSERT INTO offers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [snapshotId, item.name, item.nameZh, item.category, item.sale, item.original, item.imageUrl, Number(item.friendPick), item.advice]);
for (const [term, paidPrice, purchasedOn] of personalPurchases) {
  const item = output.find((offer) => offer.name.includes(term));
  if (item) {
    db.run("DELETE FROM purchases WHERE product_name = ? AND paid_price = ? AND purchased_on <> ?", [item.name, paidPrice, purchasedOn]);
    db.run("INSERT OR IGNORE INTO purchases (product_name, product_name_zh, paid_price, purchased_on) VALUES (?, ?, ?, ?)", [item.name, item.nameZh, paidPrice, purchasedOn]);
  }
}
function queryRows(result) {
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index]])));
}
const purchaseRows = queryRows(db.exec("SELECT product_name AS name, product_name_zh AS nameZh, paid_price AS paidPrice, purchased_on AS date FROM purchases ORDER BY purchased_on DESC, id DESC"));
const snapshotRows = queryRows(db.exec("SELECT s.generated_at AS generatedAt, substr(s.generated_at, 1, 10) AS date, o.name, o.name_zh AS nameZh, o.sale FROM offers o JOIN snapshots s ON s.id = o.snapshot_id ORDER BY s.generated_at ASC"));
const lastAppearancePerDay = new Map();
for (const row of snapshotRows) lastAppearancePerDay.set(`${row.name}|${row.date}`, row);
const productHistories = {};
for (const row of lastAppearancePerDay.values()) {
  const history = productHistories[row.name] ?? { name: row.name, nameZh: row.nameZh, entries: [] };
  history.entries.push({ date: row.date, price: row.sale });
  productHistories[row.name] = history;
}
for (const history of Object.values(productHistories)) {
  history.entries.sort((a, b) => a.date.localeCompare(b.date));
  const prices = history.entries.map((entry) => entry.price);
  history.days = history.entries.length;
  history.low = Math.min(...prices);
  history.high = Math.max(...prices);
  history.latest = history.entries.at(-1).price;
}
await fs.writeFile(dbPath, db.export());
db.close();
const snapshot = { generatedAt, archiveDate, sourceUrl: offerUrl, offers: output };
const indexPath = path.join(publicDir, "history.json");
const priorHistory = JSON.parse(await fs.readFile(indexPath, "utf8").catch(() => "[]"));
const history = [{ date: archiveDate, generatedAt, offerCount: output.length }, ...priorHistory.filter((entry) => entry.date !== archiveDate)].sort((a, b) => b.date.localeCompare(a.date));
await fs.writeFile(path.join(publicDir, "offers.json"), JSON.stringify(snapshot, null, 2));
await fs.writeFile(path.join(historyDir, `${archiveDate}.json`), JSON.stringify(snapshot, null, 2));
await fs.writeFile(indexPath, JSON.stringify(history, null, 2));
await fs.writeFile(path.join(publicDir, "purchases.json"), JSON.stringify(purchaseRows, null, 2));
await fs.writeFile(path.join(publicDir, "product-history.json"), JSON.stringify(productHistories, null, 2));
console.log(`Saved ${output.length} offers for ${archiveDate}; ${history.length} daily snapshots and ${purchaseRows.length} purchases available.`);
