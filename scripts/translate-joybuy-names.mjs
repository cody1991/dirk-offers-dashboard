import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataPath = path.join(root, "public", "data", "joybuy-offers.json");
const data = JSON.parse(await fs.readFile(dataPath, "utf8"));

async function translate(name) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "nl");
  url.searchParams.set("tl", "zh-CN");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", name);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Translation failed: ${response.status}`);
  const result = await response.json();
  return result[0].map((part) => part[0]).join("").replace(/\s+/g, " ").trim();
}

for (let start = 0; start < data.offers.length; start += 20) {
  const group = data.offers.slice(start, start + 20).filter((offer) => !offer.nameZh);
  const translated = await Promise.all(group.map(async (offer) => ({ offer, nameZh: await translate(offer.name) })));
  for (const { offer, nameZh } of translated) offer.nameZh = nameZh;
  await fs.writeFile(dataPath, JSON.stringify(data));
  console.log(`Translated ${Math.min(start + 20, data.offers.length)}/${data.offers.length}`);
}
