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

const exactTranslations = new Map([
  [
    "Vleeschmeesters Actie varkensoester 6 st. 720 g",
    "Vleeschmeesters 特价猪里脊肉 6 块 720g"
  ],
  [
    "Calvé partysaus Fles 320 ml.",
    "Calvé 派对酱 瓶装 320 毫升。"
  ],
  [
    "Robijn wasparfum Flacon 342 ml.",
    "红宝石洗涤香水瓶 342 毫升。"
  ],
  [
    "Silvo kruiden of specerijen Pot 4 - 83 gram (m.u.v. bio en dragon).",
    "Silvo 香草或香料 罐子 4 - 83 克（有机和龙蒿除外）。"
  ],
  [
    "Douwe Egberts ice coffee Beker 230 ml of blik 250 ml.",
    "Douwe Egberts 冰咖啡杯 230 毫升或罐装 250 毫升。"
  ],
  [
    "Prodent Tube 75 ml (m.u.v. junior en kids).",
    "Prodent 管 75 毫升（青少年和儿童除外）。"
  ],
  [
    "Coca-Cola, Fanta, Sprite of Fernandes Blik 250 ml.",
    "可口可乐、芬达、雪碧或 Fernandes 罐装 250 毫升。"
  ],
  [
    "De Vegetarische Slager burgers Pak 2 stuks.",
    "Vegetarian Butcher 汉堡 2 件装。"
  ],
  [
    "Danio kwark Beker 450 gram.",
    "Danio 干酪杯 450 克。"
  ],
  [
    "Dettol reiniger Flacon 500 of pak 72 stuks. OP=OP",
    "Dettol 清洁剂 500 瓶或 72 件装。 OP=OP"
  ],
  [
    "Dubbelfrisss Boost Pak 1.5 liter.",
    "Dubbelfrisss Boost Pak 1.5 升。"
  ],
  [
    "Mad sauce of Gouda's Glorie saus Statube 500 of 550 ml.",
    "Mad 酱或 Gouda's Glorie 酱 Statube 500 或 550 毫升。"
  ],
  [
    "Bonduelle diepvriesgroente Zak 300 of 400 gram.",
    "Bonduelle 冷冻蔬菜袋装 300 或 400 克。"
  ],
  [
    "Kesbeke tafelzuren Pot 330 - 675 gram.",
    "Kesbeke 泡菜锅 330 - 675 克。"
  ],
  [
    "Bieze rauwkost Kuip 250 gram.",
    "备泽生菜盆250克。"
  ],
  [
    "Tasty Basics Pak 200 of 350 gram (m.u.v. robuust brood).",
    "美味基本装 200 或 350 克（粗面包除外）。"
  ],
  [
    "Becel, Blue Band of Croma Wikkel 250 gram.",
    "Becel、Blue Band 或 Croma Wrap 250 克。"
  ],
  [
    "Coolbest 100% juice Pak 1 liter.",
    "Coolbest 100% 果汁装 1 升。"
  ],
  [
    "Mangiare scrocchi Zak 150 gram.",
    "Mangiare scrocchi 袋装 150 克。"
  ],
  [
    "Zuivelhoeve Boer'n yoghurt Beker 170 gram.",
    "Zuivelhoeve Boer'n 杯酸奶 170 克。"
  ],
  [
    "Arla Skyr Beker 450 gram. OP=OP",
    "Arla Skyr 杯 450 克。 OP=OP"
  ],
  [
    "Milner kaasplakken Pak 6 plakken.",
    "米尔纳奶酪片 6 片装。"
  ],
  [
    "Patak's Indiase specialiteiten Pak 2 - 4 stuks of pot 165 - 450 gram.",
    "Patak 的印度特色菜 2 - 4 件装或罐装 165 - 450 克。"
  ],
  [
    "Sourcy Vitaminwater Fles 500 ml.",
    "Sourcy 维生素水瓶 500 毫升。"
  ],
  [
    "Whiskas Pak 12 x 85 gram.",
    "Whiskas 包装 12 x 85 克。"
  ],
  [
    "Balconi Trancetto of Rollino Pak 6 of 10 stuks. OP=OP",
    "Balconi Trancetto 或 Rollino 6 件或 10 件装。 OP=OP"
  ],
  [
    "Heks'nkaas Origineel 200 g",
    "女巫奶酪原味 200 克"
  ],
  [
    "Jan Napoli pizzadeeg 300 g",
    "Jan Napoli 披萨面团 300 克"
  ],
  [
    "Spa Fruit Fles 1.25 liter.",
    "Spa 水果瓶 1.25 升。"
  ],
  [
    "Zandvliet Gelderse kookworst 250 g",
    "Zandvliet 海尔德兰香肠 250 克"
  ],
  [
    "Affligem Blond of Tripel 6-pack fles à 30 cl.",
    "Affligem Blonde 或 Tripel 6 瓶装 30 cl。"
  ],
  [
    "Bakker Bollebof cakeplakken Pak 4 stuks. OP=OP",
    "Bakker Bollebof 蛋糕片 4 片装。 OP=OP"
  ],
  [
    "Bakker van der Akker Reuze rozijnen- of mueslibollen Zak 4 stuks.",
    "Bakker van der Akker 巨型葡萄干或麦片球 4 件装袋。"
  ],
  [
    "DeliciouS Fles 75 cl.",
    "美味瓶装 75 cl。"
  ],
  [
    "Hertog Jan pils of 0.0 6-pack blik à 33 of 50 cl.",
    "Hertog Jan 啤酒或 0.0 6 罐装 33 或 50 cl。"
  ],
  [
    "Texels Zeebries, Skuumkoppe of 0.0 4 of 6-pack fles à 30 cl.",
    "Texels Sea Breeze、Skuumkoppe 或 0.0 4 或 6 瓶装 30 cl。"
  ],
  [
    "Wicky Pakje 200 ml.",
    "Wicky 套装 200 毫升。"
  ],
  [
    "Oreo enrobed Pak 6 x 2 stuks.",
    "奥利奥包裹 6 x 2 件装。"
  ],
  [
    "Real Cool Hard Seltzer of iced tea Blik 25 cl.",
    "Real Cool 硬苏打水或冰茶罐装 25 cl。"
  ],
  [
    "Die 5 Groot Fles 75 cl.",
    "Die 5 Groot 瓶 75 cl。"
  ],
  [
    "Zalmfilet met huid 2 st. 250 g",
    "带皮三文鱼片2块。 250克"
  ],
  [
    "Primá! verse maaltijd Per bak.",
    "美好的！新鲜膳食 每个容器。"
  ],
  [
    "RIMBOESAUZEN Hamburgersaus squeeze 250 ml",
    "RIMBUS SAUCES 汉堡酱挤压 250 毫升"
  ],
  [
    "Vleeschmeesters Duitse biefstuk 2 stuks 200 g",
    "Vleeschmeesters 德国牛排 2 块 200 克"
  ],
  [
    "Corona Extra 12x 25cl 3 liter",
    "Corona Extra 12x 25cl 3 升"
  ],
  [
    "Pink lady 6 Stuks",
    "粉红佳人6片"
  ],
  [
    "Vleeschmeesters Gemengd gehakt 750 g",
    "Vleeschmeesters 混合肉末 750 克"
  ],
  [
    "Cantaloupe of gele honing meloen Schaal 250 gram.",
    "哈密​​瓜或黄蜜瓜碗250克。"
  ],
  [
    "Finish Vaatwastabletten quantum 44 Stuks",
    "Finish 洗碗机片 44 片"
  ],
  [
    "La Perla tonijnstukken Blik 185 gram. OP=OP",
    "La Perla 金枪鱼片罐头 185 克。 OP=OP"
  ],
  [
    "Lenor La Collection wasverzachter Per flacon. OP=OP",
    "Lenor La Collection 织物柔顺剂 每瓶。 OP=OP"
  ],
  [
    "Nalys Keukenpapier vochtvangers 12 stuks",
    "Nalys 厨房吸湿纸 12 片"
  ],
  [
    "Red Band Bites Zak 145 gram. OP=OP",
    "红带咬袋 145 克。 OP=OP"
  ]
]);
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
function chineseName(name) { if (exactTranslations.has(name)) return exactTranslations.get(name); let value = name; for (const [nl, zh] of translations) value = value.replace(new RegExp(nl, "ig"), zh); return value.replace(/1 de Beste/ig, "Dirk 自有品牌").replace(/Biologische/ig, "有机").replace(/verpakt/ig, "包装").replace(/Per stuk/ig, "每个").replace(/\s+/g, " ").trim(); }
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
