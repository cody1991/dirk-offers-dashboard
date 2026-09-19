import { useEffect, useMemo, useState } from "react";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Europe/Amsterdam", dateStyle: "medium", timeStyle: "short" });
const categoryLabels = {
  "Aardappelen, groente & fruit": "土豆、蔬菜与水果",
  "Brood, beleg & koek": "面包、配料与饼干",
  "Diepvries": "冷冻食品",
  "Dranken, sap, koffie & thee": "饮料、果汁、咖啡与茶",
  "Huishoud & huisdieren": "家居与宠物",
  "Kind & drogisterij": "母婴与个护",
  "Maaltijden, salades & tapas": "即食餐、沙拉与小食",
  "Snacks & snoep": "零食与糖果",
  "Voorraadkast": "食品储藏",
  "Vlees, vis & vega": "肉类、鱼类与素食",
  "Zuivel & kaas": "乳制品与奶酪"
};
function categoryLabel(category) { return categoryLabels[category] ?? category; }

function Price({ value }) { return value == null ? "—" : euro.format(value); }
function UnitPrice({ offer }) { const value = offer.unitPrice ?? (offer.grams ? offer.sale / offer.grams * 1000 : null); return value == null ? null : <span className="unit-price">€{value.toFixed(2)}/kg</span>; }
function PriceTrail({ history }) { return history ? <p className="price-trail">价格足迹：{history.days} 天 · 史低 <b>{euro.format(history.low)}</b> · 史高 <b>{euro.format(history.high)}</b></p> : <p className="price-trail">价格足迹：等待首次出现</p>; }
function SortControl({ value, onChange }) {
  const options = [{ value: "discount", label: "折扣最高" }, { value: "unit", label: "单位价低" }, { value: "price", label: "售价最低" }];
  return <div className="sort-control" aria-label="排序方式"><span>排序</span><div className="sort-options">{options.map((option) => <button type="button" className={option.value === value ? "selected" : ""} onClick={() => onChange(option.value)} aria-pressed={option.value === value} key={option.value}>{option.label}</button>)}</div></div>;
}

export default function App() {
  const [data, setData] = useState(null);
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("discount");
  useEffect(() => {
    fetch("./data/offers.json").then((response) => response.json()).then(setData).catch(() => setData({ offers: [], error: true }));
  }, []);

  const categories = useMemo(() => ["全部", ...new Set((data?.offers ?? []).map((item) => item.category))], [data]);
  const offers = useMemo(() => (data?.offers ?? []).filter((item) => {
    const haystack = `${item.name} ${item.nameZh ?? ""} ${item.category} ${categoryLabel(item.category)}`.toLowerCase();
    return (category === "全部" || item.category === category) && haystack.includes(query.toLowerCase());
  }).sort((a, b) => {
    const unit = (item) => item.unitPrice ?? (item.grams ? item.sale / item.grams * 1000 : Number.POSITIVE_INFINITY);
    if (sortBy === "unit") return unit(a) - unit(b) || (b.discountPercent ?? -1) - (a.discountPercent ?? -1);
    if (sortBy === "price") return a.sale - b.sale || (b.discountPercent ?? -1) - (a.discountPercent ?? -1);
    return (b.discountPercent ?? -1) - (a.discountPercent ?? -1) || a.name.localeCompare(b.name);
  }), [data, category, query, sortBy]);

  if (!data) return <main className="loading">正在读取今天的 Dirk 优惠…</main>;
  if (data.error) return <main className="loading">今天的数据还没有生成。请稍后刷新。</main>;

  const stale = Date.now() - Date.parse(data.generatedAt) > 36 * 60 * 60 * 1000;
  return <main className="page">
    <header className="hero">
      <a className="repo-link" href="https://github.com/cody1991/dirk-offers-dashboard" target="_blank" rel="noreferrer" aria-label="在 GitHub 查看本项目仓库">GitHub 仓库 <span>↗</span></a>
      <div className="stamp">DIRK / DAILY</div>
      <div>
        <div className="hero-meta"><p className="kicker">{data.store?.name ?? "Dirk"} · 今日关店 {data.store?.closesAt ?? "待确认"}</p><a className="official-link" href={data.store?.url ?? "https://www.dirk.nl/aanbiedingen"} target="_blank" rel="noreferrer">查看门店营业时间 <span>↗</span></a></div>
        <h1>今天，<em>买对</em>一点。</h1>
        <p className="subhead">当前 Dirk 优惠的价格、折扣与商品图，一页看完。</p>
      </div>
      <div className={`update ${stale ? "stale" : ""}`}><b>{data.offers.length}</b><span>个优惠<br />{stale ? "数据等待更新" : "最近更新"}<br />{dateFormatter.format(new Date(data.generatedAt))}</span></div>
    </header>
    <section className="catalogue" aria-labelledby="catalogue-title">
      <div className="catalogue-head"><div><span>全部优惠 · {offers.length} 项</span><h2 id="catalogue-title">今日优惠。</h2><p className="catalogue-summary">按折扣、单位价格或售价排序。</p></div><div className="catalogue-controls"><SortControl value={sortBy} onChange={setSortBy} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索：草莓、鸡翅、咖啡…" aria-label="搜索优惠" /></div></div>
      <div className="filters">{categories.map((item) => <button className={item === category ? "selected" : ""} onClick={() => setCategory(item)} key={item}>{item === "全部" ? item : categoryLabel(item)}</button>)}</div>
      <div className="offer-grid">
        {offers.map((offer) => {
          const atHistoricalLow = offer.metrics?.low != null && Math.abs(offer.sale - offer.metrics.low) < 0.005;
          return <article className={"offer " + (atHistoricalLow ? "historical-low" : "")} key={offer.name}>
            <div className="photo"><img src={offer.imageUrl} alt={offer.name} loading="lazy" decoding="async" />{atHistoricalLow && <span className="low-badge">史低价</span>}</div>
            <div className="offer-body"><p className="category">{categoryLabel(offer.category)}</p><h3>{offer.nameZh ?? offer.name}</h3>{offer.nameZh && <p className="original-name">{offer.name}</p>}<p className="pack">{offer.package}</p><div className="price"><b><Price value={offer.sale} /></b>{offer.original && <s><Price value={offer.original} /></s>} {offer.discountPercent && <i>−{offer.discountPercent}%</i>}</div><UnitPrice offer={offer} /><PriceTrail history={offer.metrics} /><p className="advice">{offer.advice}</p>{offer.productUrl && <a className="product-link" href={offer.productUrl} target="_blank" rel="noreferrer">在 Dirk 查看原商品 ↗</a>}</div>
          </article>;
        })}
      </div>
    </section>
    <footer>数据来自 Dirk aanbiedingen；仅展示当天优惠。价格统计仅保留每个商品的出现天数、最低价、最高价与最近价格。图片与价格以门店实际标签为准。</footer>
  </main>;
}
