import fs from "node:fs/promises";
import path from "node:path";
import initSqlJs from "sql.js";

const root = path.resolve(import.meta.dirname, "..");
const snapshotPath = process.argv[2] ? path.resolve(root, process.argv[2]) : path.join(root, "public", "data", "offers.json");
const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));

if (!snapshot.generatedAt || !Array.isArray(snapshot.offers)) throw new Error("Expected a generated offers snapshot.");

const dbPath = path.join(root, "data", "offers.sqlite");
const SQL = await initSqlJs();
const db = new SQL.Database(await fs.readFile(dbPath));
const result = db.exec("SELECT id FROM snapshots WHERE generated_at = ? ORDER BY id DESC LIMIT 1", [snapshot.generatedAt]);
const snapshotId = result[0]?.values[0]?.[0];
if (!snapshotId) throw new Error(`No database snapshot matches ${snapshot.generatedAt}.`);

for (const offer of snapshot.offers) {
  if (typeof offer.advice !== "string" || !offer.advice.trim()) throw new Error(`Missing advice for ${offer.name}.`);
  db.run("UPDATE offers SET advice = ? WHERE snapshot_id = ? AND name = ?", [offer.advice.trim(), snapshotId, offer.name]);
}

await fs.writeFile(dbPath, db.export());
db.close();
console.log(`Synced Codex advice for ${snapshot.offers.length} offers to snapshot ${snapshotId}.`);
