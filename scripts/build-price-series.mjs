// Builds public/data/price-series.json: { dates: [...], series: { name: [[dateIndex, sale], ...] } } from daily snapshots.
import fs from "node:fs/promises";
import path from "node:path";

export async function buildPriceSeries(dataDir) {
  const historyDir = path.join(dataDir, "history");
  const files = (await fs.readdir(historyDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const dates = files.map((f) => f.slice(0, 10));
  const series = {};
  for (const [index, file] of files.entries()) {
    const snapshot = JSON.parse(await fs.readFile(path.join(historyDir, file), "utf8"));
    const seen = new Set();
    for (const offer of snapshot.offers ?? []) {
      if (typeof offer.sale !== "number" || seen.has(offer.name)) continue;
      seen.add(offer.name);
      (series[offer.name] ??= []).push([index, offer.sale]);
    }
  }
  const out = { dates, series };
  await fs.writeFile(path.join(dataDir, "price-series.json"), JSON.stringify(out));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = await buildPriceSeries(path.resolve(import.meta.dirname, "..", "public", "data"));
  console.log(`price-series.json: ${Object.keys(out.series).length} products over ${out.dates.length} days.`);
}
