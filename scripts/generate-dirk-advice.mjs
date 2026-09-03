import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const offersPath = path.join(root, "public/data/offers.json");
const data = await fs.readFile(offersPath, "utf8").then(JSON.parse);

function amount(value) { return "€" + value.toFixed(2); }
function unitEvidence(offer) { return offer.unitPrice != null ? "，约 €" + offer.unitPrice.toFixed(2) + "/kg" : ""; }
function historyEvidence(offer) {
  const days = offer.metrics?.days;
  const low = offer.metrics?.low;
  return days && low != null ? `近${days}日已是最低价${amount(low)}` : "暂无历史低价";
}
function regularAdvice(offer) {
  const saving = offer.original == null ? null : offer.original - offer.sale;
  const discount = offer.discountPercent;
  const evidence = saving == null ? "现价" + amount(offer.sale) : "现价" + amount(offer.sale) + "，直降" + amount(saving) + "（" + discount + "%）";
  const unit = unitEvidence(offer);
  const history = historyEvidence(offer);
  if (discount == null) return evidence + unit + "，" + history + "；原价未列。";
  if (discount >= 50) return evidence + unit + "；" + history + "。";
  if (discount >= 35) return evidence + unit + "；" + history + "，降幅明显。";
  if (discount >= 20) return evidence + unit + "；" + history + "，有实际让利。";
  return evidence + unit + "；" + history + "，降幅有限。";
}

for (const offer of data.offers) {
  offer.advice = regularAdvice(offer);
}
await fs.writeFile(offersPath, JSON.stringify(data, null, 2) + "\n");
if (data.archiveDate) {
  const historyPath = path.join(root, "public", "data", "history", `${data.archiveDate}.json`);
  await fs.writeFile(historyPath, JSON.stringify(data, null, 2) + "\n");
}
console.log("Generated evidence-based advice for " + data.offers.length + " Dirk offers.");
