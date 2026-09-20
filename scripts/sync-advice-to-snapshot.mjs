import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "public", "data");
const snapshot = JSON.parse(await fs.readFile(path.join(dataDir, "offers.json"), "utf8"));

if (!snapshot.generatedAt || !Array.isArray(snapshot.offers)) throw new Error("Expected generated Dirk offers.");
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date(snapshot.generatedAt));
for (const offer of snapshot.offers) {
  if (typeof offer.advice !== "string" || !offer.advice.trim()) throw new Error(`Missing advice for ${offer.name}.`);
}

const historyDir = path.join(dataDir, "history");
await fs.mkdir(historyDir, { recursive: true });
const dailySnapshot = { ...snapshot, archiveDate: date };
const indexPath = path.join(dataDir, "history.json");
const history = JSON.parse(await fs.readFile(indexPath, "utf8").catch(() => "[]"));
const nextHistory = [{ date, generatedAt: snapshot.generatedAt, offerCount: snapshot.offers.length }, ...history.filter((entry) => entry.date !== date)]
  .sort((a, b) => b.date.localeCompare(a.date));

await fs.writeFile(path.join(historyDir, `${date}.json`), `${JSON.stringify(dailySnapshot, null, 2)}\n`);
await fs.writeFile(indexPath, `${JSON.stringify(nextHistory, null, 2)}\n`);
console.log(`Synced ${snapshot.offers.length} Dirk advice records to ${date} snapshot.`);
