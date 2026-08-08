import { useEffect, useMemo, useState } from "react";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Europe/Amsterdam", dateStyle: "medium", timeStyle: "short" });

function Price({ value }) { return value == null ? "—" : euro.format(value); }

export default function App() {
  const [data, setData] = useState(null);
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("./data/offers.json").then((r) => r.json()).then(setData).catch(() => setData({ offers: [], error: true }));
  }, []);

  const categories = useMemo(() => ["全部", ...new Set((data?.offers ?? []).map((item) => item.category))], [data]);
  const offers = useMemo(() => (data?.offers ?? []).filter((item) => {
    const haystack = `${item.name} ${item.nameZh} ${item.category}`.toLowerCase();
    return (category === "全部" || item.category === category) && haystack.includes(query.toLowerCase());
  }), [data, category, query]);

  if (!data) return <main className="loading">正在读取今天的 Dirk 优惠…</main>;
  if (data.error) return <main className="loading">今天的数据还没有生成。请稍后刷新。</main>;

  const friendPicks = data.offers.filter((offer) => offer.friendPick);
  return <main className="page">
    <header className="hero">
      <div className="stamp">DIRK / DAILY</div>
      <div>
        <p className="kicker">阿姆斯特丹 · 每天 10:00 自动更新</p>
        <h1>今天，<em>买对</em>一点。</h1>
        <p className="subhead">当前 Dirk 优惠的价格分析、朋友推荐与商品图，一页看完。</p>
      </div>
      <div className="update"><b>{data.offers.length}</b><span>个优惠<br />{dateFormatter.format(new Date(data.generatedAt))}</span></div>
    </header>

    <section className="picks" aria-labelledby="picks-title">
      <div className="section-title"><span>朋友说值得</span><h2 id="picks-title">先看这些。</h2></div>
      <div className="pick-rail">
        {friendPicks.map((offer) => <article className="pick" key={offer.name}>
          <img src={offer.imageUrl} alt="" />
          <div><strong>{offer.nameZh}</strong><p>{offer.friendNote}</p><b><Price value={offer.sale} /></b></div>
        </article>)}
      </div>
    </section>

    <section className="catalogue" aria-labelledby="catalogue-title">
      <div className="catalogue-head"><div><span>全部优惠</span><h2 id="catalogue-title">按价格，挑真正值的。</h2></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索：草莓、鸡翅、咖啡…" aria-label="搜索优惠" /></div>
      <div className="filters">{categories.map((item) => <button className={item === category ? "selected" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
      <div className="offer-grid">
        {offers.map((offer) => <article className={`offer ${offer.friendPick ? "friend" : ""}`} key={offer.name}>
          <div className="photo"><img src={offer.imageUrl} alt={offer.nameZh} />{offer.friendPick && <span>朋友推荐</span>}</div>
          <div className="offer-body"><p className="category">{offer.category}</p><h3>{offer.nameZh}</h3><p className="pack">{offer.package}</p><div className="price"><b><Price value={offer.sale} /></b>{offer.original && <s><Price value={offer.original} /></s>} {offer.discountPercent && <i>−{offer.discountPercent}%</i>}</div><p className="advice">{offer.advice}</p></div>
        </article>)}
      </div>
    </section>
    <footer>数据来自 Dirk aanbiedingen；图片与价格以门店实际标签为准。</footer>
  </main>;
}
