import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const offersPath = path.join(root, "public/data/offers.json");
const [data, purchases] = await Promise.all([
  fs.readFile(offersPath, "utf8").then(JSON.parse),
  fs.readFile(path.join(root, "public/data/purchases.json"), "utf8").then(JSON.parse)
]);

function amount(value) { return "€" + value.toFixed(2); }
function unitEvidence(offer) { return offer.unitPrice != null ? "，约 €" + offer.unitPrice.toFixed(2) + "/kg" : ""; }
function regularAdvice(offer) {
  const saving = offer.original == null ? null : offer.original - offer.sale;
  const discount = offer.discountPercent;
  const evidence = saving == null ? "现价" + amount(offer.sale) : "省" + amount(saving) + "（" + discount + "%），现" + amount(offer.sale);
  const unit = unitEvidence(offer);
  if (discount == null) return evidence + unit + "，缺少原价，无法核验折扣。";
  if (discount >= 50) return evidence + unit + "，折扣超过五成，优先级高。";
  if (discount >= 35) return evidence + unit + "，降幅明显，值得优先查看。";
  if (discount >= 20) return evidence + unit + "，有价格让利，按规格决定。";
  return evidence + unit + "，降幅有限，不列优先。";
}

for (const offer of data.offers) {
  const bought = purchases.find((item) => item.name === offer.name);
  if (bought) {
    const delta = offer.sale - bought.paidPrice;
    const unit = unitEvidence(offer);
    offer.advice = Math.abs(delta) < 0.005
      ? "现价" + amount(offer.sale) + "与买入价相同" + unit + "，没有新增价差。"
      : delta < 0
        ? "现价比买入" + amount(bought.paidPrice) + "低" + amount(Math.abs(delta)) + unit + "，价差可用。"
        : "现价比买入" + amount(bought.paidPrice) + "高" + amount(delta) + unit + "，不如上次。";
  } else {
    offer.advice = regularAdvice(offer);
  }
}
await fs.writeFile(offersPath, JSON.stringify(data, null, 2) + "\n");
console.log("Generated evidence-based advice for " + data.offers.length + " Dirk offers.");
