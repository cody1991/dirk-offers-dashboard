import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const file = path.join(root, "public", "data", "joybuy-offers.json");
const data = JSON.parse(await fs.readFile(file, "utf8"));

for (const offer of data.offers) {
  const unit = typeof offer.unitPrice === "string"
    ? offer.unitPrice.match(/€\s*[\d,]+\s*per\s+(?:liter|100\s*g|stuk)/i)?.[0] ?? null
    : null;
  offer.unitPrice = unit;
  const evidence = [
    `降${offer.discountPercent}%至€${offer.sale.toFixed(2)}`,
    offer.rating ? `评分${offer.rating}` : "未列评分",
    offer.sold || "未列销量",
    unit ? unit.replace(/per/i, "每") : null,
    offer.deposit ? `另有${offer.deposit.replace(/^excl\.\s*/i, "")}` : null
  ].filter(Boolean).join("，");
  offer.advice = offer.discountPercent >= 50
    ? `${evidence}，优先买。`
    : offer.discountPercent >= 30
      ? `${evidence}，价格值得关注。`
      : offer.discountPercent >= 20
        ? `${evidence}，折扣中等。`
        : `${evidence}，折扣低不优先。`;
}

await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Normalized ${data.offers.length} Joybuy offers.`);
