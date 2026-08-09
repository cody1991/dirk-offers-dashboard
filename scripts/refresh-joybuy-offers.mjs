import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sourceUrl = "https://www.joybuy.nl/marketing/lightning-offers";
const response = await fetch(`https://r.jina.ai/${sourceUrl}`);
if (!response.ok) throw new Error(`Joybuy offer page request failed: ${response.status}`);
const markdown = await response.text();
const entries = [...markdown.matchAll(/\[!\[Image \d+: ([^\]]+)\]\(([^)]+)\) (\d+)% korting\]\(([^?]+)\?requestIdentity=flashSale\)([\s\S]*?)(?=\[!\[Image \d+:|$)/g)];
const offers = entries.map((match) => {
  const [, name, imageUrl, discountPercent, productUrl, detail] = match;
  const prices = [...detail.matchAll(/€([\d.]+,[\d]{2})/g)].map((item) => Number(item[1].replace(".", "").replace(",", ".")));
  const rating = detail.match(/([\d.]+)/)?.[1] ?? null;
  const sold = detail.match(/(\d+[k+]*\s+verkocht)/)?.[1] ?? null;
  return { name, imageUrl, productUrl, discountPercent: Number(discountPercent), sale: prices[0] ?? null, original: prices[1] ?? null, rating, sold, advice: `闪电价比标价低 ${discountPercent}%。` };
}).filter((offer) => offer.sale != null);
if (!offers.length) throw new Error("No Joybuy lightning offers could be parsed.");
const output = { generatedAt: new Date().toISOString(), sourceUrl, offers };
await fs.writeFile(path.join(root, "public", "data", "joybuy-offers.json"), JSON.stringify(output, null, 2));
console.log(`Saved ${offers.length} Joybuy lightning offers.`);
