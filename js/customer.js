/* Customer app (menu.html) - works on phones, tablets and desktops.
   Browse by category, pick size -> colour, offers slider, cart, order (cash on delivery / bank transfer / shop visit),
   order status + notifications, profile with purchase history, dark mode, 3 languages, installable (PWA). */
(() => {
  "use strict";
  const CFG = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const js = x => esc("'" + String(x).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'");   // safe value inside onclick="..."
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const SZL = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free"];
  const szk = z => { const i = SZL.indexOf(z); return i >= 0 ? i : 100 + (parseFloat(z) || 0); };

  // English | සිංහල | தமிழ்
  const L = {
    search: "Search items|භාණ්ඩ සොයන්න|பொருட்களைத் தேடு", all: "All|සියල්ල|அனைத்தும்", offers: "Offers|දීමනා|சலுகைகள்",
    orderNow: "Order now|දැන් ඇණවුම් කරන්න|இப்போது ஆர்டர் செய்", size: "Size|ප්‍රමාණය|அளவு", colour: "Colour|වර්ණය|நிறம்",
    std: "Standard|සාමාන්‍ය|சாதாரண", add: "Add to cart|කරත්තයට දමන්න|கார்ட்டில் சேர்", cart: "Cart|කරත්තය|கார்ட்",
    total: "Total|මුළු මුදල|மொத்தம்", place: "Place order|ඇණවුම තබන්න|ஆர்டர் செய்", cod: "Cash on delivery|බෙදාහැරීමේදී මුදල්|டெலிவரியில் பணம்",
    bank: "Bank transfer · delivery|බැංකු මාරුව · බෙදාහැරීම|வங்கி பரிமாற்றம் · டெலிவரி", shop: "I will visit the shop|මම සාප්පුවට එන්නම්|நான் கடைக்கு வருகிறேன்",
    addr: "Delivery address|බෙදාහැරීමේ ලිපිනය|டெலிவரி முகவரி", name: "Your name|ඔබේ නම|உங்கள் பெயர்", phone: "Phone number|දුරකථන අංකය|தொலைபேசி எண்",
    out: "Out of stock|තොග නැත|இருப்பு இல்லை", left: "in stock|තොගයේ ඇත|இருப்பில்", profile: "Profile|පැතිකඩ|சுயவிவரம்",
    register: "Register|ලියාපදිංචි වන්න|பதிவு செய்", logout: "Log out|ඉවත් වන්න|வெளியேறு", myorders: "My orders|මගේ ඇණවුම්|என் ஆர்டர்கள்",
    history: "Purchase history|මිලදී ගත් ඉතිහාසය|வாங்கிய வரலாறு", none: "Nothing here yet|තවම කිසිවක් නැත|இன்னும் எதுவுமில்லை",
    install: "Install|ස්ථාපනය|நிறுவு", installq: "Install our app for faster ordering|වේගවත් ඇණවුම් සඳහා යෙදුම ස්ථාපනය කරන්න|விரைவான ஆர்டருக்கு ஆப்பை நிறுவவும்",
    iosHint: "iPhone: tap Share, then “Add to Home Screen”|iPhone: Share ඔබා “Add to Home Screen” තෝරන්න|iPhone: Share → “Add to Home Screen”",
    notify: "Turn on notifications|දැනුම්දීම් සක්‍රිය කරන්න|அறிவிப்புகளை இயக்கு", share: "Share|බෙදාගන්න|பகிர்",
    empty: "Your cart is empty|කරත්තය හිස්ය|கார்ட் காலியாக உள்ளது", sent: "Order sent!|ඇණවුම යැවුවා!|ஆர்டர் அனுப்பப்பட்டது!",
    pending: "Waiting for confirmation|තහවුරු කරන තෙක්|உறுதிப்படுத்த காத்திருக்கிறது", confirmed: "Confirmed · preparing|තහවුරු කළා · සකසමින්|உறுதி · தயாராகிறது",
    ready: "Ready!|සූදානම්!|தயார்!", completed: "Completed|සම්පූර්ණයි|முடிந்தது", rejected: "Rejected|ප්‍රතික්ෂේප කළා|நிராகரிக்கப்பட்டது",
    dark: "Dark|අඳුරු|இருள்", light: "Light|ආලෝක|ஒளி", clear: "Show all|සියල්ල පෙන්වන්න|அனைத்தையும் காட்டு", offerOnly: "Offer items|දීමනා භාණ්ඩ|சலுகை பொருட்கள்",
    phoneReq: "Phone number is required|දුරකථන අංකය අවශ්‍යයි|தொலைபேசி எண் தேவை", addrReq: "Delivery address is required|ලිපිනය අවශ්‍යයි|முகவரி தேவை",
    needReg: "Register to see your history|ඉතිහාසය බැලීමට ලියාපදිංචි වන්න|வரலாற்றைக் காண பதிவு செய்யுங்கள்", orders: "orders|ඇණවුම්|ஆர்டர்கள்",
    copied: "Link copied|සබැඳිය පිටපත් කළා|இணைப்பு நகலெடுக்கப்பட்டது", close: "Close|වසන්න|மூடு", was: "was|කලින්|முன்பு",
  };
  const A = { shop: { name: "Shop", logo: "", cur: "Rs.", offer: "" }, items: [], offers: [], off: {}, orders: [], bills: [], cart: ls.get("c_cart", []),
    lang: +ls.get("c_lang", 0) || 0, theme: ls.get("c_theme", ""), prof: ls.get("c_prof", null), cat: "", q: "", of: 0, sheet: null, view: "", pay: "cod",
    addr: ls.get("c_addr", ""), nm: "", ph: "", inst: null, noInst: ls.get("c_noinst", 0) > Date.now() - 3 * 864e5, sw: null };
  const t = k => { const a = (L[k] || k).split("|"); return a[A.lang] || a[0]; };
  const m = n => A.shop.cur + " " + (Math.round(n * 100) / 100).toLocaleString();
  const np = p => String(p || "").replace(/\D/g, "").replace(/^94/, "0");
  const c = (CFG.SUPABASE_URL && !/YOUR/i.test(CFG.SUPABASE_URL) && window.supabase) ? supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  // ---- helpers -------------------------------------------------------------------
  const item = id => A.items.find(x => x.id == id);
  const find = sku => { for (const it of A.items) { const v = it.v.find(x => x.sku == sku); if (v) return { it, v }; } return null; };
  const unit = it => (A.off[it.id] != null && A.off[it.id] < it.price ? A.off[it.id] : it.price);
  const stock = it => it.v.reduce((a, v) => a + v.qty, 0);
  const photo = (it, colour) => (colour && it.ci && it.ci[colour]) || it.img || Object.values(it.ci || {})[0] || "";
  const sizes = it => [...new Set(it.v.map(v => v.size))].sort((a, b) => szk(a) - szk(b));
  const vlabel = v => [v.size, v.color].filter(x => x && x != "-").join(" · ");
  const cartN = () => A.cart.reduce((a, l) => a + l.qty, 0);
  const cartTotal = () => A.cart.reduce((a, l) => { const f = find(l.sku); return f ? a + unit(f.it) * l.qty : a; }, 0);
  const saveCart = () => ls.set("c_cart", A.cart);
  const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
  const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone();
  let tt;
  const toast = x => { const e = $("ts"); if (!e) return; e.textContent = x; e.style.display = "block"; clearTimeout(tt); tt = setTimeout(() => { e.style.display = "none"; }, 3200); };
  const notify = msg => {
    toast(msg);
    try {
      if (window.Notification && Notification.permission === "granted") {
        if (A.sw && A.sw.showNotification) A.sw.showNotification(A.shop.name, { body: msg, icon: "icons/icon-192.png", badge: "icons/icon-192.png" });
        else new Notification(A.shop.name, { body: msg });
      }
    } catch (e) {}
  };

  // ---- data ----------------------------------------------------------------------
  async function all(tb) {
    let o = [], f = 0;
    for (;;) {
      const { data, error } = await c.from(tb).select("*").range(f, f + 999);
      if (error) throw error;
      o = o.concat(data); if (data.length < 1000) return o; f += 1000;
    }
  }
  async function load() {
    const [its, stk, sh, of] = await Promise.all([all("public_items"), all("public_stock"), c.from("public_shop").select("*").maybeSingle(), c.rpc("public_offers")]);
    const M = {};
    its.forEach(r => { M[r.id] = { id: String(r.id), no: r.no, name: r.name, price: +r.price, cat: r.cat || "", br: r.brand || "", img: r.img || "", ci: r.ci || {}, v: [] }; });
    stk.forEach(r => { const it = M[r.item_id]; if (it) it.v.push({ sku: r.sku, size: r.size, color: r.color, qty: r.qty }); });
    A.items = Object.values(M).filter(i => i.v.length).sort((a, b) => a.no - b.no);
    const s = sh.data || {};
    A.shop = { name: s.name || "Shop", logo: s.logo || "", cur: s.cur || "Rs.", offer: s.offer || "" };
    A.offers = (of.data || []).map(o => ({ ...o, items: (o.items || []).filter(i => item(i.id)) })).filter(o => o.items.length);
    A.off = {}; A.offers.forEach(o => o.items.forEach(i => { if (A.off[i.id] == null || +i.offer < A.off[i.id]) A.off[i.id] = +i.offer; }));
    A.cart = A.cart.filter(l => find(l.sku)); saveCart();
    document.title = A.shop.name;
  }
  async function loadStock() {      // light refresh: only the stock numbers
    const map = {}; (await all("public_stock")).forEach(r => { map[r.sku] = r.qty; });
    A.items.forEach(it => it.v.forEach(v => { if (map[v.sku] != null) v.qty = map[v.sku]; }));
  }
  async function loadProfile(notifyChanges) {
    if (!A.prof) return;
    const ph = A.prof.phone;
    const [o, b] = await Promise.all([c.rpc("my_orders", { p_phone: ph }), c.rpc("my_bills", { p_phone: ph })]);
    A.orders = o.data || []; A.bills = b.data || [];
    const old = ls.get("c_ost", {}), nw = {};
    A.orders.forEach(x => {
      nw[x.id] = x.status;
      if (notifyChanges && old[x.id] && old[x.id] !== x.status) {
        const msg = { confirmed: "✅ #" + x.id + " · " + t("confirmed"), ready: "🛍 #" + x.id + " · " + t("ready"), completed: "✔ #" + x.id + " · " + t("completed"), rejected: "❌ #" + x.id + " · " + t("rejected") }[x.status];
        if (msg) notify(msg);
      }
    });
    ls.set("c_ost", nw);
  }

  // ---- views ---------------------------------------------------------------------
  const card = it => {
    const q = stock(it), im = photo(it), op = A.off[it.id], has = op != null && op < it.price;
    return `<button class="card ${q ? "" : "off"}" ${q ? `onclick="CA.open(${js(it.id)})"` : "disabled"}><div class="ph">${im ? `<img src="${im}" alt="" loading="lazy">` : "👕"}${q ? "" : `<span class="so">${t("out")}</span>`}</div><div class="in"><div class="nm">${esc(it.name)}</div><div class="pr">${has ? `<s>${m(it.price)}</s><em>${m(op)}</em>` : m(it.price)}</div><small>${esc(it.cat || "")}${it.br ? " › " + esc(it.br) : ""}</small></div></button>`;
  };
  const grid = () => {
    const k = A.q.toLowerCase().trim(), of = A.of ? A.offers.find(o => o.id == A.of) : null, ids = of ? new Set(of.items.map(i => String(i.id))) : null;
    const a = A.items.filter(it => (!ids || ids.has(it.id)) && (k ? (it.name + " " + it.cat + " " + it.br + " #" + it.no).toLowerCase().includes(k) : (!A.cat || (it.cat || "Other") == A.cat)));
    return a.map(card).join("") || `<p class="mu" style="grid-column:1/-1;text-align:center;padding:30px 0">${t("none")}</p>`;
  };
  const slider = () => !A.offers.length ? "" : `<div class="sl" id="sl">${A.offers.map(o => `<div class="sd ${o.img ? "" : "nt"}" onclick="CA.offer(${js(o.id)})">${o.img ? `<img src="${o.img}" alt="">` : ""}<span class="tag">🎁 ${t("offers")}</span><div class="tx"><b>${esc(o.title)}</b><span>${esc(o.msg || "")}</span><br><span><b style="display:inline">${t("orderNow")} →</b></span></div></div>`).join("")}</div>`;
  const banner = () => {
    if (A.noInst || standalone()) return "";
    if (A.inst) return `<div class="bn"><b>📲 ${t("installq")}</b><button onclick="CA.install()">${t("install")}</button><button onclick="CA.noInstall()" aria-label="${t("close")}" style="background:transparent;color:inherit;border:1px solid #fff6">✕</button></div>`;
    if (isIos()) return `<div class="bn"><b>📲 ${t("iosHint")}</b><button onclick="CA.noInstall()">OK</button></div>`;
    return "";
  };
  const itemSheet = () => {
    const s = A.sheet, it = item(s.id); if (!it) return "";
    const zs = sizes(it), vs = it.v.filter(v => v.size == s.size), cur = it.v.find(v => v.sku == s.sku), hero = photo(it, cur && cur.color), op = A.off[it.id], has = op != null && op < it.price;
    return `<div class="hd"><h3>${esc(it.name)}</h3><button onclick="CA.view('')" aria-label="${t("close")}">✕</button></div>
${hero ? `<img class="hero" src="${hero}" alt="">` : ""}
<div class="row"><span class="pr big">${has ? `<s>${m(it.price)}</s><em>${m(op)}</em>` : m(it.price)}</span><span class="mu">${esc(it.cat || "")}${it.br ? " › " + esc(it.br) : ""}</span></div>
<div class="mu" style="margin-top:6px">${t("size")}</div>
<div class="pills" style="flex-wrap:wrap;overflow:visible">${zs.map(z => { const q = it.v.filter(v => v.size == z).reduce((a, v) => a + v.qty, 0); return `<button class="ch ${s.size == z ? "on" : ""}" ${q ? "" : "disabled"} onclick="CA.size(${js(z)})">${esc(z)}</button>`; }).join("")}</div>
<div class="mu">${t("colour")}</div>
${vs.map(v => { const im = photo(it, v.color), off = v.qty < 1; return `<button class="cv ${s.sku == v.sku ? "on" : ""}" ${off ? "disabled" : ""} onclick="CA.sku(${js(v.sku)})">${im ? `<img src="${im}" alt="">` : `<span class="sw"></span>`}<span class="t"><b>${v.color == "-" ? t("std") : esc(v.color)}</b><small class="mu">${off ? t("out") : v.qty + " " + t("left")}</small></span>${s.sku == v.sku ? "✓" : ""}</button>`; }).join("")}
<div class="row" style="margin-top:14px"><span class="qty"><button onclick="CA.step(-1)" aria-label="-">−</button><b>${s.qty}</b><button onclick="CA.step(1)" aria-label="+">+</button></span><button class="pri" ${cur ? "" : "disabled"} onclick="CA.add()">🛒 ${t("add")}</button></div>`;
  };
  const cartSheet = () => {
    const lines = A.cart.map(l => ({ l, f: find(l.sku) })).filter(x => x.f), p = A.prof || {};
    if (!lines.length) return `<div class="hd"><h3>🛒 ${t("cart")}</h3><button onclick="CA.view('')">✕</button></div><p class="mu" style="text-align:center;padding:24px 0">${t("empty")}</p>`;
    return `<div class="hd"><h3>🛒 ${t("cart")}</h3><button onclick="CA.view('')">✕</button></div>
${lines.map(({ l, f }) => { const im = photo(f.it, f.v.color); return `<div class="ln">${im ? `<img src="${im}" alt="">` : `<span class="sw"></span>`}<div><b>${esc(f.it.name)}</b><br><small class="mu">${esc(vlabel(f.v))}</small><br><span class="qty"><button onclick="CA.cq(${js(l.sku)},-1)">−</button><b>${l.qty}</b><button onclick="CA.cq(${js(l.sku)},1)">+</button></span></div><div style="text-align:right" class="pr">${m(unit(f.it) * l.qty)}<br><button onclick="CA.del(${js(l.sku)})" aria-label="Remove">🗑</button></div></div>`; }).join("")}
<div class="row big"><span>${t("total")}</span><span>${m(cartTotal())}</span></div>
<div class="pay">${[["cod", "💵 " + t("cod")], ["bank", "🏦 " + t("bank")], ["shop", "🏬 " + t("shop")]].map(x => `<button class="${A.pay == x[0] ? "on" : ""}" onclick="CA.pay('${x[0]}')">${x[1]}</button>`).join("")}</div>
<div class="fm two"><input id="nm" placeholder="${t("name")}" value="${esc(A.nm || p.name || "")}" oninput="CA.f('nm',this.value)" autocomplete="name"><input id="ph" type="tel" inputmode="tel" placeholder="${t("phone")}" value="${esc(A.ph || p.phone || "")}" oninput="CA.f('ph',this.value)" autocomplete="tel"></div>
${A.pay != "shop" ? `<input id="ad" placeholder="${t("addr")}" value="${esc(A.addr)}" oninput="CA.f('addr',this.value)" autocomplete="street-address"><br><br>` : ""}
<button class="pri" style="width:100%" onclick="CA.place()">${t("place")} · ${m(cartTotal())}</button>`;
  };
  const STEPS = ["pending", "confirmed", "ready", "completed"];
  const orderH = o => { const i = STEPS.indexOf(o.status); return `<div style="padding:8px 0;border-bottom:1px solid var(--bd)"><div class="row"><b>#${o.id} · ${m(o.total)}</b><span class="badge ${o.status == "ready" ? "ready" : ""}">${t(o.status)}</span></div><small class="mu">${new Date(o.t).toLocaleString()} · ${(o.lines || []).map(l => esc(l.n) + " ×" + l.qty).join(", ")}</small>${o.status == "rejected" ? "" : `<div class="st">${STEPS.map((s, k) => `<i class="${k <= i ? "d" : ""}"></i>`).join("")}</div>`}</div>`; };
  const profileSheet = () => {
    const p = A.prof;
    if (!p) return `<div class="hd"><h3>👤 ${t("register")}</h3><button onclick="CA.view('')">✕</button></div><div class="fm"><input id="rn" placeholder="${t("name")}" value="${esc(A.nm)}" oninput="CA.f('nm',this.value)" autocomplete="name"><input id="rp" type="tel" inputmode="tel" placeholder="${t("phone")}" value="${esc(A.ph)}" oninput="CA.f('ph',this.value)" autocomplete="tel"></div><button class="pri" style="width:100%" onclick="CA.reg()">${t("register")}</button><p class="mu">${t("needReg")}</p>`;
    return `<div class="hd"><h3>👤 ${esc(p.name || t("profile"))}</h3><button onclick="CA.view('')">✕</button></div><p class="mu" style="margin:0 0 8px">📞 ${esc(p.phone)}</p>
<div style="display:flex;gap:8px;flex-wrap:wrap">${(window.Notification && Notification.permission === "default") ? `<button onclick="CA.perm()">🔔 ${t("notify")}</button>` : ""}<button onclick="CA.share()">🔗 ${t("share")}</button><button onclick="CA.logout()">⎋ ${t("logout")}</button></div>
<h3 style="margin:16px 0 4px">${t("myorders")}</h3>${A.orders.map(orderH).join("") || `<p class="mu">${t("none")}</p>`}
<h3 style="margin:16px 0 4px">${t("history")}</h3>${A.bills.map(b => `<div style="padding:8px 0;border-bottom:1px solid var(--bd)"><div class="row"><b>#${b.id} · ${m(b.total)}</b><small class="mu">${new Date(b.t).toLocaleDateString()}</small></div><small class="mu">${(b.lines || []).map(l => esc(l.n) + (l.vl ? " " + esc(l.vl) : "") + " ×" + l.qty).join(", ")}</small></div>`).join("") || `<p class="mu">${t("none")}</p>`}`;
  };
  function render() {
    const d = document.documentElement; d.lang = ["en", "si", "ta"][A.lang];
    if (A.theme) d.dataset.theme = A.theme; else delete d.dataset.theme;
    const y = window.scrollY, sl = $("sl"), pl = $("pl"), sh = $("sh"), sx = sl ? sl.scrollLeft : 0, px = pl ? pl.scrollLeft : 0, sy = sh ? sh.scrollTop : 0;
    const cats = [...new Set(A.items.map(i => i.cat || "Other"))], n = cartN(), dark = d.dataset.theme == "dark" || (!d.dataset.theme && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    const of = A.of ? A.offers.find(o => o.id == A.of) : null;
    $("app").innerHTML = `<header><div class="wrap"><div class="brand">${A.shop.logo ? `<img src="${A.shop.logo}" alt="">` : "👕"}<span>${esc(A.shop.name)}</span></div>
<select onchange="CA.lang(this.value)" aria-label="Language">${["English", "සිංහල", "தமிழ்"].map((x, i) => `<option value="${i}"${A.lang == i ? " selected" : ""}>${x}</option>`).join("")}</select>
<button onclick="CA.theme()" aria-label="Theme">${dark ? "☀️" : "🌙"}</button><button onclick="CA.view('profile')" aria-label="${t("profile")}">👤</button></div></header>
<div class="wrap">${banner()}${A.shop.offer ? `<div class="bn"><b>📣 ${esc(A.shop.offer)}</b></div>` : ""}${slider()}
<div class="search"><input id="q" type="search" placeholder="🔍 ${t("search")}" value="${esc(A.q)}" oninput="CA.q(this.value)"></div>
<div class="pills" id="pl">${["", ...cats].map(x => `<button class="ch ${A.cat == x && !A.of ? "on" : ""}" onclick="CA.cat(${js(x)})">${x ? esc(x) : t("all")}</button>`).join("")}</div>
${of ? `<div class="bn"><b>🎁 ${esc(of.title)} · ${t("offerOnly")}</b><button onclick="CA.offer(0)">✕ ${t("clear")}</button></div>` : ""}
<div class="grid" id="grid">${grid()}</div></div>
${n ? `<button class="fab" onclick="CA.view('cart')">🛒 ${n} · ${m(cartTotal())}</button>` : ""}
${A.view ? `<div class="bg" onclick="CA.view('')"><div class="sheet" id="sh" onclick="event.stopPropagation()">${A.view == "item" ? itemSheet() : A.view == "cart" ? cartSheet() : profileSheet()}</div></div>` : ""}`;
    const sl2 = $("sl"), pl2 = $("pl"), sh2 = $("sh");
    if (sl2) sl2.scrollLeft = sx; if (pl2) pl2.scrollLeft = px; if (sh2) sh2.scrollTop = sy; window.scrollTo(0, y);
  }

  // ---- actions (called from the page) ----------------------------------------------
  const CA = window.CA = {
    q(v) { A.q = v; const g = $("grid"); if (g) g.innerHTML = grid(); },
    cat(x) { A.cat = x; A.q = ""; A.of = 0; render(); },
    offer(id) { A.of = id || 0; A.q = ""; render(); if (id) { const g = $("grid"); if (g) g.scrollIntoView({ behavior: "smooth", block: "start" }); } },
    lang(v) { A.lang = +v; ls.set("c_lang", A.lang); render(); },
    theme() { const d = document.documentElement, dark = d.dataset.theme == "dark" || (!d.dataset.theme && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); A.theme = dark ? "light" : "dark"; ls.set("c_theme", A.theme); render(); },
    view(v) { A.view = v; if (v == "profile" && A.prof) loadProfile(false).then(render).catch(() => {}); render(); },
    open(id) { const it = item(id); if (!it) return; const zs = sizes(it).filter(z => it.v.some(v => v.size == z && v.qty > 0)), z = zs[0] || sizes(it)[0], vs = it.v.filter(v => v.size == z && v.qty > 0); A.sheet = { id: it.id, size: z, sku: vs.length == 1 ? vs[0].sku : "", qty: 1 }; A.view = "item"; render(); },
    size(z) { const it = item(A.sheet.id), vs = it.v.filter(v => v.size == z && v.qty > 0); A.sheet.size = z; A.sheet.sku = vs.length == 1 ? vs[0].sku : ""; A.sheet.qty = 1; render(); },
    sku(k) { A.sheet.sku = k; A.sheet.qty = 1; render(); },
    step(d) { const f = find(A.sheet.sku); if (!f) return; A.sheet.qty = Math.min(Math.max(1, A.sheet.qty + d), f.v.qty); render(); },
    add() { const f = find(A.sheet.sku); if (!f) return; const l = A.cart.find(x => x.sku == f.v.sku); const n = Math.min((l ? l.qty : 0) + A.sheet.qty, f.v.qty); if (l) l.qty = n; else A.cart.push({ sku: f.v.sku, qty: n }); saveCart(); A.view = ""; render(); toast("🛒 " + f.it.name + " ✓"); },
    cq(k, d) { const l = A.cart.find(x => x.sku == k), f = find(k); if (!l || !f) return; l.qty = Math.min(Math.max(1, l.qty + d), f.v.qty); saveCart(); render(); },
    del(k) { A.cart = A.cart.filter(x => x.sku != k); saveCart(); if (!A.cart.length) A.view = ""; render(); },
    pay(p) { A.pay = p; render(); },
    f(k, v) { A[k] = v; if (k == "addr") ls.set("c_addr", v); },
    async place() {
      const phone = np(A.ph || (A.prof && A.prof.phone)), name = (A.nm || (A.prof && A.prof.name) || "").trim();
      if (!phone) { toast(t("phoneReq")); return; }
      if (A.pay != "shop" && !A.addr.trim()) { toast(t("addrReq")); return; }
      const lines = A.cart.map(l => { const f = find(l.sku); return f ? { sku: l.sku, n: f.it.name + (vlabel(f.v) ? " " + vlabel(f.v) : ""), qty: l.qty } : null; }).filter(Boolean);
      try { if (window.Notification && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
      const { data, error } = await c.rpc("place_order", { p_name: name, p_phone: phone, p_lines: lines, p_pay: A.pay, p_addr: A.addr.trim() });
      if (error) { toast("⚠ " + (error.message || "Could not send the order")); load().then(render).catch(() => {}); return; }
      if (!A.prof) { A.prof = { name, phone }; ls.set("c_prof", A.prof); }
      A.cart = []; saveCart(); A.view = "profile"; await loadProfile(false).catch(() => {}); render(); toast("✅ " + t("sent") + " " + m(data.total));
    },
    async reg() {
      const phone = np(A.ph), name = (A.nm || "").trim();
      if (!phone) { toast(t("phoneReq")); return; }
      const { error } = await c.rpc("register_customer", { p_name: name, p_phone: phone });
      if (error) { toast("⚠ " + (error.message || "Could not register")); return; }
      A.prof = { name, phone }; ls.set("c_prof", A.prof);
      try { if (window.Notification && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
      await loadProfile(false).catch(() => {}); render();
    },
    logout() { A.prof = null; A.orders = []; A.bills = []; ls.del("c_prof"); ls.del("c_ost"); A.view = ""; render(); },
    perm() { try { Notification.requestPermission().then(render); } catch (e) {} },
    async share() {
      const url = location.origin + location.pathname;
      try { if (navigator.share) { await navigator.share({ title: A.shop.name, url }); return; } await navigator.clipboard.writeText(url); toast("🔗 " + t("copied")); } catch (e) {}
    },
    async install() { if (!A.inst) return; A.inst.prompt(); try { await A.inst.userChoice; } catch (e) {} A.inst = null; render(); },
    noInstall() { A.noInst = true; ls.set("c_noinst", Date.now()); render(); },
  };

  // ---- start -----------------------------------------------------------------------
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); A.inst = e; render(); });
  window.addEventListener("appinstalled", () => { A.inst = null; A.noInst = true; render(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).then(r => { A.sw = r; }).catch(() => {});
  (async () => {
    if (!c) { $("app").innerHTML = `<div class="wrap" style="padding:40px 0;text-align:center"><h3>⚙️ Setup needed</h3><p>Open <b>config.js</b> and paste your Supabase URL and anon key.</p></div>`; return; }
    try { await load(); await loadProfile(false).catch(() => {}); render(); }
    catch (e) { $("app").innerHTML = `<div class="wrap" style="padding:40px 0;text-align:center"><h3>😕</h3><p>The menu is not available right now.</p><button onclick="location.reload()">Retry</button></div>`; return; }
    // offers slider auto-advance
    setInterval(() => { const s = $("sl"); if (!s || A.view || s.children.length < 2) return; const w = s.children[0].offsetWidth + 12; s.scrollTo({ left: s.scrollLeft + w >= s.scrollWidth - 10 ? 0 : s.scrollLeft + w, behavior: "smooth" }); }, 4500);
    // order status + new stock
    let tick = 0;
    setInterval(async () => { try { tick++; if (A.prof) await loadProfile(true); if (tick % 8 == 0) await load(); else await loadStock(); const a = document.activeElement; if (!(a && /INPUT/.test(a.tagName))) render(); } catch (e) {} }, 15000);
  })();
})();
