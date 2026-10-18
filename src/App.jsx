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

/** Almost-expired: validTo calendar day is today or tomorrow in Europe/Amsterdam. */
function daysUntilValidTo(validTo) {
  if (!validTo) return null;
  // Dirk validity timestamps are calendar dates in UTC; compare that UTC day to Amsterdam today.
  const end = new Date(validTo);
  const endKey = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const toUtc = (dateKey) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(endKey) - toUtc(todayKey)) / 86400000);
}
function isAlmostExpired(offer) {
  const days = daysUntilValidTo(offer.validTo);
  return days != null && days >= 0 && days <= 1;
}

function Price({ value }) { return value == null ? "—" : euro.format(value); }
function UnitPrice({ offer }) { const value = offer.unitPrice ?? (offer.grams ? offer.sale / offer.grams * 1000 : null); return value == null ? null : <span className="unit-price">€{value.toFixed(2)}/kg</span>; }
const shortDate = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
function PriceTrail({ points, dates }) {
  const [hover, setHover] = useState(null);
  if (!points || !dates) return <p className="price-trail">价格走势：等待数据</p>;
  const pts = points.map(([i, v]) => ({ date: dates[i], day: dayNum(dates[i]), v }));
  if (pts.length < 2) return <p className="price-trail">价格走势：仅1天记录</p>;

  const W = 260, H = 110;
  const left = 42, right = 10, top = 12, bottom = 26;
  const plotW = W - left - right, plotH = H - top - bottom;
  const first = pts[0].day, span = Math.max(1, pts.at(-1).day - first);
  const vals = pts.map((p) => p.v);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max === min) { min = Math.max(0, min - 0.2); max = max + 0.2; }
  const niceStep = (() => {
    const raw = (max - min) / 2;
    const pow = 10 ** Math.floor(Math.log10(raw || 1));
    const n = raw / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  })();
  const yMin = Math.floor(min / niceStep) * niceStep;
  const yMax = Math.ceil(max / niceStep) * niceStep || yMin + niceStep;
  const yRange = yMax - yMin || 1;
  const x = (p) => left + (p.day - first) / span * plotW;
  const y = (p) => top + (yMax - p.v) / yRange * plotH;
  const segs = [];
  for (const p of pts) {
    const last = segs.at(-1);
    if (last && p.day - last.at(-1).day === 1) last.push(p);
    else segs.push([p]);
  }
  const low = pts.reduce((a, b) => (b.v < a.v ? b : a));
  const cur = pts.at(-1);
  const yTicks = [];
  for (let v = yMin; v <= yMax + niceStep / 1000; v += niceStep) yTicks.push(Number(v.toFixed(4)));
  const xTicks = pts.length <= 3 ? pts : [pts[0], pts[Math.floor(pts.length / 2)], pts.at(-1)];
  const tip = (p) => `${shortDate(p.date)} · ${euro.format(p.v)}`;
  const money = (v) => euro.format(v).replace(/\s/g, "");

  return <div className="price-trail chart">
    <div className="price-trail-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="价格走势">
        {yTicks.map((v) => {
          const yy = top + (yMax - v) / yRange * plotH;
          return <g key={`y-${v}`}>
            <line x1={left} y1={yy} x2={left + plotW} y2={yy} stroke="#e6e8e2" strokeWidth="1" />
            <text x={left - 6} y={yy + 3} textAnchor="end" className="axis-label">{money(v)}</text>
          </g>;
        })}
        <line x1={left} y1={top} x2={left} y2={top + plotH} stroke="#9aa39a" strokeWidth="1.2" />
        <line x1={left} y1={top + plotH} x2={left + plotW} y2={top + plotH} stroke="#9aa39a" strokeWidth="1.2" />
        {xTicks.map((p, i) => (
          <text key={`x-${i}`} x={x(p)} y={H - 6} textAnchor="middle" className="axis-label">{shortDate(p.date)}</text>
        ))}
        {segs.map((seg, k) => seg.length > 1
          ? <polyline key={k} points={seg.map((p) => `${x(p)},${y(p)}`).join(" ")} fill="none" stroke="#536056" strokeWidth="1.8" pointerEvents="none" />
          : null)}
        {pts.map((p, k) => (
          <g key={k} onMouseEnter={() => setHover(p)} style={{ cursor: "crosshair" }}>
            <circle cx={x(p)} cy={y(p)} r="9" fill="transparent" />
            <circle cx={x(p)} cy={y(p)} r="2.4" fill={p === low ? "#2e8b57" : p === cur ? "#d62828" : "#536056"} />
          </g>
        ))}
      </svg>
      {hover && (
        <div
          className="price-trail-tip"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${Math.max(4, (y(hover) / H) * 100 - 12)}%` }}
          role="status"
        >{tip(hover)}</div>
      )}
    </div>
    <small>
      <span style={{ color: "#2e8b57" }}>● 最低 {euro.format(low.v)}（{shortDate(low.date)}）</span>{" "}
      <span style={{ color: "#d62828" }}>● 当前 {euro.format(cur.v)}</span> · {pts.length} 天记录
    </small>
  </div>;
}

function SortControl({ value, onChange }) {
  const options = [{ value: "discount", label: "折扣最高" }, { value: "unit", label: "单位价低" }, { value: "price", label: "售价最低" }];
  return <div className="sort-control" aria-label="排序方式"><span>排序</span><div className="sort-options">{options.map((option) => <button type="button" className={option.value === value ? "selected" : ""} onClick={() => onChange(option.value)} aria-pressed={option.value === value} key={option.value}>{option.label}</button>)}</div></div>;
}

export default function App() {
  const [data, setData] = useState(null);
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("discount");
  const [series, setSeries] = useState(null);
  useEffect(() => {
    fetch("./data/offers.json").then((response) => response.json()).then(setData).catch(() => setData({ offers: [], error: true }));
    fetch("./data/price-series.json").then((response) => response.json()).then(setSeries).catch(() => setSeries(null));
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
      <div className="catalogue-head"><div><span>全部优惠 · {offers.length} 项</span><h2 id="catalogue-title">今日优惠。</h2><p className="catalogue-summary">按折扣、单位价格或售价排序。{data.validity?.validityZh ? ` ${data.validity.validityZh}。` : ""}{data.validity?.validityNl ? <span className="validity-nl"> {data.validity.validityNl}</span> : null}</p></div><div className="catalogue-controls"><SortControl value={sortBy} onChange={setSortBy} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索：草莓、鸡翅、咖啡…" aria-label="搜索优惠" /></div></div>
      <div className="filters">{categories.map((item) => <button className={item === category ? "selected" : ""} onClick={() => setCategory(item)} key={item}>{item === "全部" ? item : categoryLabel(item)}</button>)}</div>
      <div className="offer-grid">
        {offers.map((offer) => {
          const atHistoricalLow = offer.metrics?.low != null && Math.abs(offer.sale - offer.metrics.low) < 0.005;
          const almostExpired = isAlmostExpired(offer);
          const classes = ["offer", atHistoricalLow ? "historical-low" : "", almostExpired ? "almost-expired" : ""].filter(Boolean).join(" ");
          return <article className={classes} key={offer.name}>
            <div className="photo"><img src={offer.imageUrl} alt={offer.name} loading="lazy" decoding="async" />{atHistoricalLow && <span className="low-badge">史低价</span>}{almostExpired && <span className="expiry-badge">即将结束</span>}</div>
            <div className="offer-body"><p className="category">{categoryLabel(offer.category)}</p><h3>{offer.nameZh ?? offer.name}</h3>{offer.nameZh && <p className="original-name">{offer.name}</p>}{(offer.validityZh || offer.validityNl) && <p className={"validity " + (almostExpired ? "expiring" : "")}>{offer.validityZh ?? offer.validityNl}{offer.validityZh && offer.validityNl ? <span className="validity-nl"> · {offer.validityNl}</span> : null}</p>}<p className="pack">{offer.package}</p><div className="price"><b><Price value={offer.sale} /></b>{offer.original && <s><Price value={offer.original} /></s>} {offer.discountPercent && <i>−{offer.discountPercent}%</i>}</div><UnitPrice offer={offer} /><PriceTrail points={series ? series.series[offer.name] ?? [] : null} dates={series?.dates} /><p className="advice">{offer.advice}</p>{offer.productUrl && <a className="product-link" href={offer.productUrl} target="_blank" rel="noreferrer">在 Dirk 查看原商品 ↗</a>}</div>
          </article>;
        })}
      </div>
    </section>
    <footer>数据来自 Dirk aanbiedingen；仅展示当天优惠。每个商品的小折线图展示我们记录到的每日优惠价走势（自 9 月 20 日起，未记录的日子留空不连线），绿点为记录最低价，红点为当前价。图片与价格以门店实际标签为准。</footer>
  </main>;
}
