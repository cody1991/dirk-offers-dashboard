import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const [capturePath, previousPath] = process.argv.slice(2);
if (!capturePath || !previousPath) throw new Error("Usage: node scripts/build-joybuy-offers.mjs capture.json previous.json");

const money = (text) => Number(text.replace(/\./g, "").replace(",", "."));
const [raw, previous] = await Promise.all([fs.readFile(capturePath, "utf8").then(JSON.parse), fs.readFile(previousPath, "utf8").then(JSON.parse)]);
const oldNames = new Map(previous.offers.map((offer) => [offer.name, offer.nameZh]).filter(([, nameZh]) => nameZh));
const exactNames = new Map([
  ["FATHAI Limoensap 700 ml", "FATHAI 青柠汁 700 毫升"], ["NongShim Instant noodlesoep Kimchi 20x120 g doos bulkkorting", "农心泡菜方便面 20×120克整箱"], ["KUNG FU dumplings - varkensvlees en maïs 400 g", "功夫猪肉玉米饺子 400克"], ["Sagiko mangosap 320 ml", "Sagiko 芒果汁 320毫升"], ["Strong Fruit Granules - Sinaasappelsap 258g", "浓缩果粒橙汁 258克"], ["SAGIKO Fruitsap Mengeling 320ml", "SAGIKO 混合果汁 320毫升"], ["Levo Premium Sojaolie 3L", "Levo 特级大豆油 3升"], ["【Cool】WANT WANT Vittorio Jelly Drink (Druif) 150 g", "旺旺 Vittorio 葡萄果冻饮料 150克"], ["WANT WANT QQ zachte snoepjes, Druivensmaak, 70 g", "旺旺 QQ 葡萄软糖 70克"], ["TCT Guokui platbrood met ingelegde en gedroogde mosterdkool 500 g", "TCT 腌菜锅盔饼 500克"], ["Laweiju Kantonese gepekelde vleeswaren 300 g", "腊味居广式腊肉 300克"], ["Laweiju Mini Worst 300g", "腊味居迷你香肠 300克"], ["Daliyuan Hartige Lente-ui Crackers 130 g", "达利园咸香葱花饼干 130克"], ["Laweiju Gegrilde Worst (Rund) 500g ", "腊味居烤牛肉香肠 500克"], ["ChaCha Guai U Wei Krabkuit Smaak Bonen 130 g", "洽洽怪U味蟹黄豆 130克"], ["SIJIA Kitchen  Aromatische varkensreuzel 212 mL", "思家厨房香猪油 212毫升"], ["Sijia Kitchen Geurige Varkensreuzel, 720ml", "思家厨房香猪油 720毫升"], ["Mooijer Bevroren Jackfruit - 500 g", "Mooijer 冷冻菠萝蜜 500克"], ["Sunlee Gehele Mungbonen 400 g", "Sunlee 整粒绿豆 400克"], ["【Halal Voedsel】Yang Zhang Gui Gao Ren Ramen met sesamaroma 182 g x 12 dozen (volledige case)", "清真芝麻味拉面 182克×12盒"]
]);
const glossary = [[/jasmijnrijst/gi, "茉莉香米"], [/rijst/gi, "米"], [/noedels?/gi, "面"], [/gyoza/gi, "饺子"], [/gelei/gi, "果冻"], [/zeewier/gi, "海苔"], [/drank/gi, "饮料"], [/water/gi, "水"], [/bier/gi, "啤酒"], [/melk/gi, "牛奶"], [/saus/gi, "酱"], [/chips/gi, "薯片"], [/koekjes/gi, "饼干"], [/pittig/gi, "辣味"], [/kip/gi, "鸡肉"], [/rundvlees/gi, "牛肉"], [/groenten/gi, "蔬菜"], [/aardbei/gi, "草莓"], [/perzik/gi, "桃子"], [/kokos/gi, "椰子"], [/kaas/gi, "奶酪"], [/originele smaak/gi, "原味"]];
function nameZh(name) { return oldNames.get(name) ?? exactNames.get(name) ?? glossary.reduce((value, [from, to]) => value.replace(from, to), name).replace(/\b(g|kg|ml|cl)\b/gi, "$1").trim(); }
function advice({ discountPercent, sale, rating, sold, unitPrice, deposit }) {
  const proof = `降${discountPercent}%至€${sale.toFixed(2)}`;
  const trust = rating && sold ? `评分${rating}、${sold}` : rating ? `评分${rating}` : sold ? sold : "未列评分销量";
  const size = unitPrice ? `，${unitPrice}` : deposit ? `，另含€${deposit.toFixed(2)}押金` : "";
  if (discountPercent >= 50 && Number(rating) >= 4.6 && sold) return `${proof}${size}，${trust}，优先买。`;
  if (discountPercent <= 15) return `仅${proof}${size}，${trust}，折扣偏低不优先。`;
  if (unitPrice && discountPercent >= 40) return `${proof}${size}，${trust}；高折扣仍须按单位价核对。`;
  return `${proof}${size}，${trust}；按包装规格判断。`;
}
const offers = raw.map(({ name, imageUrl, productUrl, text }) => {
  const prices = [...text.matchAll(/€\s*([\d.]+,[\d]{2})/g)].map((match) => money(match[1]));
  const discountPercent = Number(text.match(/(\d+)% korting/)?.[1]);
  const review = text.match(/\s*([0-5]\.\d)(\d+(?:k)?\+\s*verkocht)/);
  const rating = review?.[1] ?? null;
  const sold = review?.[2] ?? text.match(/(\d+(?:k)?\+\s*verkocht)/)?.[1] ?? null;
  const unit = text.match(/€\s*([\d.]+,[\d]{2})\s+per\s+(kg|liter|stuk)/);
  const unitPrice = unit ? `€${unit[1]}/${unit[2]}` : null;
  const deposit = text.match(/excl\.\s*€\s*([\d.]+,[\d]{2})\s+Statiegeld/)?.[1];
  if (!name || !imageUrl || !productUrl || !Number.isFinite(discountPercent) || !prices.length) return null;
  const sale = prices[0], original = prices[1] ?? null, depositValue = deposit ? money(deposit) : null;
  return { name, nameZh: nameZh(name), imageUrl, productUrl, discountPercent, sale, original, rating, sold, unitPrice, deposit: depositValue, advice: advice({ discountPercent, sale, rating, sold, unitPrice, deposit: depositValue }) };
}).filter(Boolean);
await fs.writeFile(path.join(root, "public/data/joybuy-offers.json"), JSON.stringify({ generatedAt: new Date().toISOString(), sourceUrl: "https://www.joybuy.nl/marketing/lightning-offers", scope: "public-food", offers }, null, 2) + "\n");
console.log(`Saved ${offers.length} Joybuy public food offers.`);
