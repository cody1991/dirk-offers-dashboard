import { useEffect, useMemo, useState } from "react";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Europe/Amsterdam", dateStyle: "medium", timeStyle: "short" });
const zhTerms = [[/bibigo/gi,"必品阁"],[/Kimchi/gi,"泡菜"],[/Kip/gi,"鸡肉"],[/Gyoza/gi,"饺子"],[/Rundvlees/gi,"牛肉"],[/Bulgogi/gi,"烤牛肉"],[/jasmijnrijst/gi,"茉莉香米"],[/rijst/gi,"米"],[/zeewierchips/gi,"海苔脆片"],[/zeewier/gi,"海苔"],[/Sriracha-saus/gi,"是拉差辣酱"],[/Mangosteen Fruitdrank/gi,"山竹饮料"],[/lagerbier/gi,"拉格啤酒"],[/gelei/gi,"果冻"],[/Melkpoeder/gi,"奶粉"],[/matcha/gi,"抹茶"],[/Doeriancake/gi,"榴莲糕"],[/Oestersaus/gi,"蚝油"],[/Honing-Boter Chips/gi,"蜂蜜黄油薯片"],[/Smaakpoeder/gi,"风味粉"],[/gecondenseerde melk/gi,"炼乳"],[/Original Taste Cola/gi,"原味可乐"]];
const chineseName = (offer) => offer.nameZh || zhTerms.reduce((name, [from, to]) => name.replace(from, to), offer.name);
const judgement = (offer) => offer.advice || (offer.discountPercent >= 50 && Number(offer.rating || 0) >= 4.6 ? `降 ${offer.discountPercent}%、评分 ${offer.rating}，本次可优先看。` : offer.discountPercent < 20 ? `仅降 ${offer.discountPercent}%；本次不列为优先。` : `降 ${offer.discountPercent}%；下单前核对规格与价格。`);

export default function JoybuyPage() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  useEffect(() => { fetch("./data/joybuy-offers.json").then((response) => response.json()).then(setData).catch(() => setData({ error: true, offers: [] })); }, []);
  const offers = useMemo(() => (data?.offers ?? []).filter((offer) => `${offer.name} ${chineseName(offer)}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.discountPercent - a.discountPercent), [data, query]);
  if (!data) return <main className="loading">正在读取 Joybuy 闪电优惠…</main>;
  if (data.error) return <main className="loading">Joybuy 数据暂不可用。</main>;
  return <main className="page joybuy-page">
    <header className="hero joybuy-hero">
      <a className="repo-link" href="https://github.com/cody1991/dirk-offers-dashboard" target="_blank" rel="noreferrer">GitHub 仓库 <span>↗</span></a>
      <div className="stamp joybuy-stamp">JOY<br />BUY</div>
      <div>
        <div className="hero-meta"><p className="kicker">荷兰公开站 · 食品与饮料</p><a className="official-link" href={data.sourceUrl} target="_blank" rel="noreferrer">打开 Joybuy 闪电优惠 <span>↗</span></a></div>
        <h1>食品闪电价，<em>先看</em>再买。</h1>
        <p className="subhead">未登录也能看到的 Joybuy 食品与饮料优惠；与个人账户、收货地址无关。</p>
      </div>
      <div className="update"><b>{data.offers.length}</b><span>个闪电优惠<br />最近更新<br />{dateFormatter.format(new Date(data.generatedAt))}</span></div>
    </header>
    <nav className="shop-switch" aria-label="优惠来源"><a href="./">Dirk 超市</a><a className="selected" href="?shop=joybuy">Joybuy 闪电优惠</a></nav>
    <section className="catalogue joybuy-catalogue" aria-labelledby="joybuy-title">
      <div className="catalogue-head"><div><span>公开食品闪电优惠 · {offers.length} 项</span><h2 id="joybuy-title">折扣先排好，再决定要不要点开。</h2></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索：饺子、米、饮料…" aria-label="搜索 Joybuy 食品优惠" /></div>
      <div className="offer-grid joybuy-grid">{offers.map((offer) => <article className="offer joybuy-offer" key={offer.name}><div className="photo"><img src={offer.imageUrl} alt={offer.name} loading="lazy" decoding="async" /><span>−{offer.discountPercent}%</span></div><div className="offer-body"><p className="category">JOYBUY · FOOD FLASH DEAL</p><h3>{chineseName(offer)}</h3><p className="pack">{offer.name}</p><p className="joybuy-meta">{offer.rating && `评分 ${offer.rating}`} {offer.rating && offer.sold && " · "}{offer.sold}</p><div className="price"><b>{euro.format(offer.sale)}</b>{offer.original && <s>{euro.format(offer.original)}</s>}</div><p className="advice">{judgement(offer)}</p><a className="product-link" href={offer.productUrl} target="_blank" rel="noreferrer">在 Joybuy 查看商品 ↗</a></div></article>)}</div>
    </section>
    <footer>数据来自未登录可见的 Joybuy 食品闪电优惠页；价格、库存、配送与商品页跳转以 Joybuy 页面为准。</footer>
  </main>;
}
