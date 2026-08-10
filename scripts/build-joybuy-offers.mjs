import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/build-joybuy-offers.mjs /path/to/captured-offers.json");

const money = (value) => Number(value.replace(/\./g, "").replace(",", "."));
const raw = JSON.parse(await fs.readFile(input, "utf8"));
const offers = raw.map(({ name, imageUrl, productUrl, text }) => {
  const prices = [...text.matchAll(/€\s*([\d.]+,[\d]{2})/g)].map((match) => money(match[1]));
  const discountPercent = Number(text.match(/(\d+)% korting/)?.[1]);
  const rating = text.match(/\s*\n([\d.]+)/)?.[1] ?? null;
  const sold = text.match(/(\d+[k+]*\s+verkocht)/)?.[1] ?? null;
  const unitPrice = text.match(/€\s*([\d.]+,[\d]{2})\s+per\s+(kg|liter|stuk)/)?.slice(1).join("/") ?? null;
  const unavailable = /Uitverkocht/.test(text);
  if (!name || !imageUrl || !productUrl || !Number.isFinite(discountPercent) || prices.length < 1) return null;
  const sale = prices[0];
  const original = prices[1] ?? null;
  const evidence = unitPrice ? `，${unitPrice}` : "";
  const popularity = rating && sold ? `评分${rating}、${sold}` : rating ? `评分${rating}` : sold ?? "未列评分销量";
  let advice;
  if (unavailable) advice = `降${discountPercent}%至€${sale}${evidence}，已售罄，不优先。`;
  else if (discountPercent >= 50 && Number(rating) >= 4.6) advice = `降${discountPercent}%至€${sale}${evidence}，${popularity}，优先。`;
  else if (discountPercent >= 40) advice = `降${discountPercent}%至€${sale}${evidence}；${popularity}，核对规格。`;
  else if (discountPercent <= 15) advice = `仅降${discountPercent}%至€${sale}${evidence}；${popularity}，不优先。`;
  else if (rating && Number(rating) < 4.4) advice = `降${discountPercent}%至€${sale}${evidence}，评分${rating}，不优先。`;
  else advice = `降${discountPercent}%至€${sale}${evidence}；${popularity}，按规格比较。`;
  return { name, imageUrl, productUrl, discountPercent, sale, original, rating, sold, unitPrice, unavailable, advice };
}).filter(Boolean);

await fs.writeFile(path.join(root, "public/data/joybuy-offers.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceUrl: "https://www.joybuy.nl/marketing/lightning-offers",
  scope: "public-food",
  offers
}, null, 2) + "\n");
console.log(`Saved ${offers.length} Joybuy public food offers.`);
