import { useEffect, useMemo, useState } from "react";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Europe/Amsterdam", dateStyle: "medium", timeStyle: "short" });
const purchaseStorageKey = "dirk-purchase-log-v1";
const todayPurchaseSeeds = [["XL watermeloen", 3.99], ["Kipkluifjes gekruid", 3.99], ["Roerbakgarnalen", 2.99], ["Roombroodjes", 2.49], ["Magnum ijs", 2.99]];

function amsterdamDate() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function Price({ value }) { return value == null ? "—" : euro.format(value); }
function UnitPrice({ offer }) { const value = offer.unitPrice ?? (offer.grams ? offer.sale / offer.grams * 1000 : null); return value == null ? null : <span className="unit-price">€{value.toFixed(2)}/kg</span>; }

export default function App() {
  const [data, setData] = useState(null);
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("friend");
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState("latest");
  const [currentOffers, setCurrentOffers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [purchaseStoreReady, setPurchaseStoreReady] = useState(false);
  const [purchaseProduct, setPurchaseProduct] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(amsterdamDate);

  useEffect(() => {
    Promise.all([
      fetch("./data/offers.json").then((response) => response.json()),
      fetch("./data/history.json").then((response) => response.ok ? response.json() : [])
    ]).then(([offers, snapshots]) => { setData(offers); setCurrentOffers(offers.offers); setHistory(snapshots); }).catch(() => setData({ offers: [], error: true }));
  }, []);

  useEffect(() => {
    if (purchaseStoreReady || currentOffers.length === 0) return;
    try {
      const saved = JSON.parse(localStorage.getItem(purchaseStorageKey));
      const existingPurchases = Array.isArray(saved) ? saved : [];
      const missingTodayPurchases = todayPurchaseSeeds.map(([term, paidPrice]) => {
        const offer = currentOffers.find((item) => item.name.includes(term));
        const alreadyRecorded = offer && existingPurchases.some((item) => item.name === offer.name && item.date === purchaseDate);
        return offer && !alreadyRecorded && { id: `${offer.name}-${purchaseDate}`, name: offer.name, nameZh: offer.nameZh, paidPrice, date: purchaseDate };
      }).filter(Boolean);
      setPurchases([...missingTodayPurchases, ...existingPurchases]);
      setPurchaseProduct(currentOffers[0].name);
      setPurchasePrice(String(currentOffers[0].sale));
    } catch {
      setPurchases([]);
    }
    setPurchaseStoreReady(true);
  }, [currentOffers, purchaseDate, purchaseStoreReady]);

  useEffect(() => {
    if (purchaseStoreReady) localStorage.setItem(purchaseStorageKey, JSON.stringify(purchases));
  }, [purchases, purchaseStoreReady]);

  async function loadArchive(value) {
    setSelectedDate(value);
    setCategory("全部");
    setQuery("");
    try {
      const url = value === "latest" ? "./data/offers.json" : `./data/history/${value}.json`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Archive unavailable");
      const nextData = await response.json();
      setData(nextData);
      if (value === "latest") setCurrentOffers(nextData.offers);
    } catch {
      setData({ offers: [], error: true });
    }
  }

  const categories = useMemo(() => ["全部", ...new Set((data?.offers ?? []).map((item) => item.category))], [data]);
  const offers = useMemo(() => (data?.offers ?? []).filter((item) => {
    const haystack = `${item.name} ${item.nameZh} ${item.category}`.toLowerCase();
    return (category === "全部" || item.category === category) && haystack.includes(query.toLowerCase());
  }).sort((a, b) => {
    const unit = (item) => item.unitPrice ?? (item.grams ? item.sale / item.grams * 1000 : Number.POSITIVE_INFINITY);
    if (sortBy === "discount") return (b.discountPercent ?? -1) - (a.discountPercent ?? -1) || b.friendRank - a.friendRank;
    if (sortBy === "unit") return unit(a) - unit(b) || b.friendRank - a.friendRank;
    if (sortBy === "price") return a.sale - b.sale || b.friendRank - a.friendRank;
    return (b.friendRank ?? Number(b.friendPick)) - (a.friendRank ?? Number(a.friendPick)) || (b.discountPercent ?? -1) - (a.discountPercent ?? -1);
  }), [data, category, query, sortBy]);

  if (!data) return <main className="loading">正在读取今天的 Dirk 优惠…</main>;
  if (data.error) return <main className="loading">今天的数据还没有生成。请稍后刷新。</main>;

  const friendPicks = data.offers.filter((offer) => offer.friendPick).sort((a, b) => (b.friendRank ?? 1) - (a.friendRank ?? 1));
  const stale = Date.now() - Date.parse(data.generatedAt) > 36 * 60 * 60 * 1000;
  const isLatest = selectedDate === "latest";
  function openSortedOffers(nextSort) {
    setSortBy(nextSort);
    document.getElementById("catalogue-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function selectPurchaseProduct(name) {
    const offer = currentOffers.find((item) => item.name === name);
    setPurchaseProduct(name);
    setPurchasePrice(offer ? String(offer.sale) : "");
  }
  function addPurchase(event) {
    event.preventDefault();
    const offer = currentOffers.find((item) => item.name === purchaseProduct);
    const paidPrice = Number(purchasePrice);
    if (!offer || !Number.isFinite(paidPrice) || paidPrice < 0) return;
    setPurchases((items) => [{ id: `${offer.name}-${purchaseDate}-${Date.now()}`, name: offer.name, nameZh: offer.nameZh, paidPrice, date: purchaseDate }, ...items]);
  }
  function removePurchase(id) { setPurchases((items) => items.filter((item) => item.id !== id)); }
  return <main className="page">
    <header className="hero">
      <div className="stamp">DIRK / DAILY</div>
      <div>
        <div className="hero-meta"><p className="kicker">{isLatest ? "阿姆斯特丹 · 每天 10:00 自动更新" : `${data.archiveDate ?? selectedDate} · 历史快照`}</p><a className="official-link" href="https://www.dirk.nl/aanbiedingen" target="_blank" rel="noreferrer">查看 Dirk 官方优惠 <span>↗</span></a></div>
        <h1>今天，<em>买对</em>一点。</h1>
        <p className="subhead">当前 Dirk 优惠的价格分析、朋友推荐与商品图，一页看完。</p>
      </div>
      <div className={`update ${stale ? "stale" : ""}`}><b>{data.offers.length}</b><span>个优惠<br />{stale ? "数据等待更新" : "最近更新"}<br />{dateFormatter.format(new Date(data.generatedAt))}</span></div>
    </header>

    <section className="archive" aria-label="每日优惠存档">
      <div><span>每日存档</span><strong>{isLatest ? "今天的优惠" : `${data.archiveDate ?? selectedDate} 的优惠`}</strong><p>每天成功更新后自动保存；目前可查看 {history.length} 天。</p></div>
      <label>查看日期<select value={selectedDate} onChange={(event) => loadArchive(event.target.value)}><option value="latest">最新一批 · {data.offers.length} 项</option>{history.slice(1).map((entry) => <option value={entry.date} key={entry.date}>{entry.date} · {entry.offerCount} 项</option>)}</select></label>
    </section>

    <section className="purchases" id="purchases" aria-labelledby="purchases-title">
      <div className="purchase-heading"><div><span>我的购买记录</span><h2 id="purchases-title">买过的，留个价。</h2><p>只保存在这台设备的浏览器中；同一商品再次出现时自动与当前价对比。</p></div></div>
      <form className="purchase-form" onSubmit={addPurchase}>
        <label>商品<select value={purchaseProduct} onChange={(event) => selectPurchaseProduct(event.target.value)}>{currentOffers.map((offer) => <option value={offer.name} key={offer.name}>{offer.nameZh}</option>)}</select></label>
        <label>实付价格 (€)<input value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} inputMode="decimal" type="number" min="0" step="0.01" required /></label>
        <label>购买日期<input value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} type="date" required /></label>
        <button type="submit">加入记录</button>
      </form>
      <div className="purchase-list">
        {purchases.length === 0 ? <p className="purchase-empty">还没有记录。选一件商品和实际付款价，之后就能看到是否又降价。</p> : purchases.map((purchase) => {
          const current = currentOffers.find((offer) => offer.name === purchase.name);
          const difference = current ? current.sale - purchase.paidPrice : null;
          const comparison = difference == null ? "当前没有这件商品的优惠" : Math.abs(difference) < 0.005 ? `当前同价 ${euro.format(current.sale)}` : difference < 0 ? `现在便宜 ${euro.format(Math.abs(difference))}` : `现在贵 ${euro.format(difference)}`;
          return <article className="purchase" key={purchase.id}><time>{purchase.date}</time><strong>{purchase.nameZh}</strong><b>{euro.format(purchase.paidPrice)}</b><span className={difference != null && difference < 0 ? "cheaper" : difference != null && difference > 0 ? "pricier" : ""}>{comparison}</span><button type="button" onClick={() => removePurchase(purchase.id)} aria-label={`删除 ${purchase.nameZh}`}>×</button></article>;
        })}
      </div>
    </section>

    <section className="picks" aria-labelledby="picks-title">
      <div className="section-title"><span>朋友说值得</span><h2 id="picks-title">先看这些。</h2></div>
      {friendPicks.length > 0 ? <div className="pick-rail">
        {friendPicks.map((offer) => <article className="pick" key={offer.name}>
          <img src={offer.imageUrl} alt="" />
          <div><span className="pick-label">{offer.friendLabel ?? "朋友提到"}</span><strong>{offer.nameZh}</strong><p>{offer.friendNote}</p><div className="pick-price"><b><Price value={offer.sale} /></b>{offer.original && <s><Price value={offer.original} /></s>}{offer.discountPercent && <i>−{offer.discountPercent}%</i>}<UnitPrice offer={offer} /></div></div>
        </article>)}
      </div> : <div className="empty-picks"><div><span>今天没有朋友特别提到的商品</span><p>不代表没有好价；可以从折扣或单位价格开始挑。</p></div><div><button onClick={() => openSortedOffers("discount")}>看折扣最高</button><button onClick={() => openSortedOffers("unit")}>看单位价格低</button></div></div>}
    </section>

    <section className="catalogue" aria-labelledby="catalogue-title">
      <div className="catalogue-head"><div><span>全部优惠 · {offers.length} 项</span><h2 id="catalogue-title">按价格，挑真正值的。</h2></div><div className="catalogue-controls"><label>排序<select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="friend">朋友优先</option><option value="discount">折扣最高</option><option value="unit">单位价格低</option><option value="price">售价最低</option></select></label><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索：草莓、鸡翅、咖啡…" aria-label="搜索优惠" /></div></div>
      <div className="filters">{categories.map((item) => <button className={item === category ? "selected" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
      <div className="offer-grid">
        {offers.map((offer) => <article className={`offer ${offer.friendPick ? "friend" : ""}`} key={offer.name}>
          <div className="photo"><img src={offer.imageUrl} alt={offer.nameZh} loading="lazy" decoding="async" />{offer.friendPick && <span>{offer.friendLabel || "朋友推荐"}</span>}</div>
          <div className="offer-body"><p className="category">{offer.category}</p><h3>{offer.nameZh}</h3><p className="pack">{offer.package}</p><div className="price"><b><Price value={offer.sale} /></b>{offer.original && <s><Price value={offer.original} /></s>} {offer.discountPercent && <i>−{offer.discountPercent}%</i>}</div><UnitPrice offer={offer} /><p className="advice">{offer.advice}</p></div>
        </article>)}
      </div>
    </section>
    <footer>数据来自 Dirk aanbiedingen；每日快照在当天成功抓取后保存。图片与价格以门店实际标签为准。</footer>
  </main>;
}
