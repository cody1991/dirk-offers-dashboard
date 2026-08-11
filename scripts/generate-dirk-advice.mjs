import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const offersPath = path.join(root, "public/data/offers.json");
const [data, purchases] = await Promise.all([
  fs.readFile(offersPath, "utf8").then(JSON.parse),
  fs.readFile(path.join(root, "public/data/purchases.json"), "utf8").then(JSON.parse)
]);

for (const offer of data.offers) {
  const trail = offer.metrics;
  const bought = purchases.find((item) => item.name === offer.name);
  const discount = offer.discountPercent != null ? `省€${(offer.original - offer.sale).toFixed(2)}（${offer.discountPercent}%）` : `现€${offer.sale.toFixed(2)}`;
  const unit = offer.unitPrice != null ? `，€${offer.unitPrice.toFixed(2)}/kg` : "";
  if (bought) {
    const delta = offer.sale - bought.paidPrice;
    offer.advice = Math.abs(delta) < 0.005 ? `现价与买入€${bought.paidPrice.toFixed(2)}相同${unit}，无价差可利用。` : delta < 0 ? `比买入€${bought.paidPrice.toFixed(2)}低€${Math.abs(delta).toFixed(2)}${unit}，价格差已扩大。` : `比买入€${bought.paidPrice.toFixed(2)}高€${delta.toFixed(2)}${unit}，不及上次买价。`;
  } else if (trail?.low != null && offer.sale <= trail.low + 0.005) {
    offer.advice = `${discount}${unit}，持平${trail.days}天史低，当前价处记录低位。`;
  } else if (trail?.low != null) {
    offer.advice = `${discount}${unit}，高于史低€${trail.low.toFixed(2)}，未回落到记录低位。`;
  } else {
    offer.advice = `${discount}${unit}，首次记录，暂无法与历史低价比。`;
  }
}
await fs.writeFile(offersPath, JSON.stringify(data, null, 2) + "\n");
console.log(`Generated evidence-based advice for ${data.offers.length} Dirk offers.`);
