import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "public", "data");
const archiveDir = path.join(dataDir, "joybuy-history");
const snapshot = JSON.parse(await fs.readFile(path.join(dataDir, "joybuy-offers.json"), "utf8"));
if (!snapshot.generatedAt || !Array.isArray(snapshot.offers)) throw new Error("Expected Joybuy offers data.");

const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date(snapshot.generatedAt));
const archived = { ...snapshot, archiveDate: date };
await fs.mkdir(archiveDir, { recursive: true });
await fs.writeFile(path.join(archiveDir, `${date}.json`), JSON.stringify(archived, null, 2));

let prior = [];
try { prior = JSON.parse(await fs.readFile(path.join(dataDir, "joybuy-history.json"), "utf8")); } catch { /* first archive */ }
const history = [{ date, generatedAt: snapshot.generatedAt, offerCount: snapshot.offers.length }, ...prior.filter((entry) => entry.date !== date)].sort((a, b) => b.date.localeCompare(a.date));
await fs.writeFile(path.join(dataDir, "joybuy-history.json"), JSON.stringify(history, null, 2));
console.log(`Archived ${snapshot.offers.length} Joybuy offers for ${date}.`);
