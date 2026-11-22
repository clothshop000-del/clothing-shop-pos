/* Supabase layer for the Clothing Shop POS.
   - Staff: sign in (Supabase Auth) -> data is loaded from the database and every change is saved back.
   - Customers (#menu): read the public menu, register and order through safe RPC functions. */
(() => {
  const CFG = window.APP_CONFIG || {};
  // Browser download helper (the app calls claude.use("downloads").save(...) for CSV / QR files)
  if (!window.claude) window.claude = { use: async () => ({ save: async ({ filename, data }) => {
    const b = data instanceof Blob ? data : new Blob([data]), a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  } }) };

  const configured = CFG.SUPABASE_URL && !/YOUR/i.test(CFG.SUPABASE_URL) && window.supabase;
  const c = configured ? supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
  const SB = { c, ready: false }; window.SB = SB;
  const iso = x => new Date(x || Date.now()).toISOString(), ms = x => (x ? +new Date(x) : 0);
  const sig = r => JSON.stringify(r);
  let cache = {}, timer = 0, busy = false, dirty = false, again = false, moff = [], rtOn = false;

  // small status badge (bottom-left)
  const badge = document.createElement("div");
  badge.style.cssText = "position:fixed;left:8px;bottom:8px;font-size:11px;color:var(--mu);z-index:5;max-width:60vw";
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(badge));
  if (document.body) document.body.appendChild(badge);
  const st = x => { badge.textContent = x; };

  // ---- table definitions: how app data <-> database rows --------------------------
  const TB = {
    settings: { k: "id", rows: () => [{ id: 1, data: { shop: S.shop, users: S.users, low: S.low, cats: S.cats || [], brands: S.brands || {} } }] },
    items: { k: "id", del: 1, rows: () => S.items.map(i => ({ id: String(i.id), no: i.no, name: i.name, price: i.price, cost: i.cost, cat: i.cat || null, brand: i.br || null, img: i.img || null, ci: i.ci || {}, hid: !!i.hid })) },
    variants: { k: "sku", del: 1, rows: () => VS().map(x => ({ sku: x.v.sku, item_id: String(x.it.id), size: x.v.size, color: x.v.color, bar: x.v.bar, qty: x.v.qty })) },
    sales: { k: "id", rows: () => S.sales.map(s => ({ id: s.id, t: iso(s.t), t0: s.t0 ? iso(s.t0) : null, re: s.re || 0, lines: s.lines, sub: s.sub || 0, bd: s.bd || 0, tax: s.tax || 0, total: s.total, pay: s.pay || null, cost: s.cost || 0, profit: s.profit || 0, cashier: s.by || null, ph: s.ph || null, cn: s.cn || null, rv: s.rv || 0, sp: s.sp || 0, due: s.due || 0, cnu: s.cnu || 0, cnc: s.cnc || null, rf: !!s.rf, rt: s.rt || 0, rp: s.rp || 0 })) },
    refunds: { k: "id", rows: () => S.sales.flatMap(s => (s.refs || []).map(r => ({ id: String(r.id), sale_id: s.id, t: iso(r.t), amt: r.amt, mode: r.mode, dest: r.dest || "Stock", cashier: r.by || null, code: r.code || null, ph: r.ph || null, cn: r.cn || null, lines: r.lines, nl: r.nl || [] }))) },
    credit_notes: { k: "code", rows: () => (S.cnotes || []).map(n => ({ code: n.code, amt: n.amt, ph: n.ph || null, name: n.name || null, t: iso(n.t), used: !!n.used, bill: n.bill || null })) },
    customers: { k: "phone", rows: () => (S.cust || []).map(r => ({ phone: r.p, name: r.n || null, kind: r.k || "W" })) },
    qr_registrations: { k: "phone", rows: () => (S.regs || []).map(r => ({ phone: r.p, name: r.n || null, t: iso(r.t) })) },
    qr_orders: { k: "id", rows: () => S.orders.filter(o => o.id).map(o => ({ id: o.id, name: o.name || null, phone: o.phone || null, lines: o.lines, t: iso(o.t), done: !!o.done })) },
    offers: { k: "id", del: 1, rows: () => (S.offers || []).map(o => ({ id: o.id, title: o.title || "", msg: o.msg || "", img: o.img || null, sel: osel(o) })) },
    offer_notes: { k: "phone,offer_id", id: r => r.phone + "|" + r.offer_id, rows: () => (S.notes || []).map(n => ({ phone: n.p, offer_id: n.o, t: iso(n.t) })) },
    label_jobs: { k: "sku", del: 1, rows: () => Object.entries(ls).filter(([k]) => FV(k)).map(([k, n]) => ({ sku: k, copies: Math.max(1, +n || 1) })) },
  };
  const ORDER = ["settings", "items", "variants", "sales", "refunds", "credit_notes", "customers", "qr_registrations", "qr_orders", "offers", "offer_notes", "label_jobs"];
  const idf = (t, r) => (TB[t].id ? TB[t].id(r) : r[TB[t].k]);
  const snapT = t => { const o = {}; TB[t].rows().forEach(r => { o[idf(t, r)] = sig(r); }); cache[t] = o; };

  async function sync(t) {
    const d = TB[t], rows = d.rows(), cur = {}, old = cache[t] || {};
    rows.forEach(r => { cur[idf(t, r)] = sig(r); });
    const up = rows.filter(r => old[idf(t, r)] !== cur[idf(t, r)]);
    for (let i = 0; i < up.length; i += 200) {
      const { error } = await c.from(t).upsert(up.slice(i, i + 200), { onConflict: d.k });
      if (error) throw error;
    }
    if (d.del) {
      const gone = Object.keys(old).filter(k => !(k in cur));
      for (let i = 0; i < gone.length; i += 100) {
        const { error } = await c.from(t).delete().in(d.k, gone.slice(i, i + 100));
        if (error) throw error;
      }
    }
    cache[t] = cur;
  }
  async function flush() {
    if (busy) { timer = setTimeout(flush, 800); return; }
    busy = true; dirty = false; st("Saving…");
    try { for (const t of ORDER) await sync(t); st("✓ Saved " + new Date().toLocaleTimeString()); }
    catch (e) { console.error(e); dirty = true; st("⚠ Not saved: " + (e.message || e)); timer = setTimeout(flush, 6000); }
    busy = false;
    if (again && !dirty) { again = false; pullQ(); }
  }
  SB.push = () => { if (!SB.ready) return; dirty = true; clearTimeout(timer); timer = setTimeout(flush, 1000); };
  addEventListener("pagehide", () => { if (dirty && SB.ready) flush(); });

  // ---- load everything from the database ------------------------------------------
  const all = async t => {
    let o = [], f = 0;
    for (;;) {
      const { data, error } = await c.from(t).select("*").range(f, f + 999);
      if (error) throw error;
      o = o.concat(data);
      if (data.length < 1000) return o;
      f += 1000;
    }
  };
  function mapQ(qo, rg, on) {
    S.orders = qo.map(o => ({ id: o.id, name: o.name || "", phone: o.phone || "", lines: o.lines, t: ms(o.t), done: o.done ? 1 : undefined })).sort((a, b) => a.t - b.t);
    S.regs = rg.map(r => ({ n: r.name || "", p: r.phone, t: ms(r.t) }));
    S.notes = on.map(r => ({ p: r.phone, o: +r.offer_id, t: ms(r.t) }));
  }
  async function pull() {
    const [st0, it, va, sa, rf, cn, cu, rg, qo, ofr, onn, lj] = await Promise.all(["settings", "items", "variants", "sales", "refunds", "credit_notes", "customers", "qr_registrations", "qr_orders", "offers", "offer_notes", "label_jobs"].map(all));
    const d = (st0[0] || {}).data || {};
    if (d.shop) S.shop = { ...S.shop, ...d.shop };
    if (d.users && d.users.length) S.users = d.users;
    if (d.low !== undefined) S.low = d.low;
    S.cats = d.cats || []; S.brands = d.brands || {};
    const vm = {};
    va.forEach(v => (vm[v.item_id] = vm[v.item_id] || []).push({ sku: v.sku, size: v.size, color: v.color, bar: v.bar, qty: v.qty }));
    S.items = it.map(i => ({ id: i.id, no: i.no, name: i.name, price: +i.price, cost: +i.cost, cat: i.cat || "", br: i.brand || "", img: i.img || "", ci: i.ci || {}, hid: i.hid || undefined, v: vm[i.id] || [] })).sort((a, b) => a.no - b.no);
    const sm = {};
    S.sales = sa.map(s => (sm[s.id] = { id: s.id, t: ms(s.t), t0: s.t0 ? ms(s.t0) : undefined, re: s.re || undefined, lines: s.lines, sub: +s.sub, bd: +s.bd, tax: +s.tax, total: +s.total, pay: s.pay, cost: +s.cost, profit: +s.profit, by: s.cashier || "", ph: s.ph || "", cn: s.cn || "", rv: +s.rv, sp: +s.sp, due: +s.due, cnu: +s.cnu, cnc: s.cnc || "", rf: s.rf ? 1 : undefined, rt: +s.rt || undefined, rp: +s.rp || undefined, refs: [] })).sort((a, b) => a.id - b.id);
    rf.forEach(r => { const s = sm[r.sale_id]; if (s) s.refs.push({ id: r.id, t: ms(r.t), lines: r.lines, amt: +r.amt, mode: r.mode, dest: r.dest, by: r.cashier || "", bill: r.sale_id, ph: r.ph || "", cn: r.cn || "", code: r.code || undefined, nl: r.nl || [] }); });
    S.cnotes = cn.map(n => ({ code: n.code, amt: +n.amt, ph: n.ph || "", name: n.name || "", t: ms(n.t), used: n.used ? 1 : 0, bill: n.bill }));
    S.cust = cu.map(r => ({ n: r.name || "", p: r.phone, k: r.kind }));
    S.offers = ofr.map(o => ({ id: +o.id, title: o.title, msg: o.msg, img: o.img || undefined, sel: o.sel || {} }));
    mapQ(qo, rg, onn);
    ls = Object.fromEntries(lj.map(r => [r.sku, r.copies]));
    ORDER.forEach(snapT);
    if (!st0.length) delete cache.settings;       // first run: write defaults
  }
  async function pullQ() {
    if (dirty || busy) { again = true; return; }
    try {
      const [qo, rg, on] = await Promise.all(["qr_orders", "qr_registrations", "offer_notes"].map(all));
      const n0 = S.orders.length;
      mapQ(qo, rg, on); ["qr_orders", "qr_registrations", "offer_notes"].forEach(snapT);
      if (S.orders.length > n0) T("🔔 New QR order");
      if (tab == "qr" || tab == "cu") R();
    } catch (e) { console.error(e); }
  }
  function subscribe() {
    if (rtOn) return; rtOn = true; let tm;
    const f = () => { clearTimeout(tm); tm = setTimeout(pullQ, 700); };
    c.channel("pos-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "qr_orders" }, f)
      .on("postgres_changes", { event: "*", schema: "public", table: "qr_registrations" }, f)
      .subscribe();
  }

  // ---- screens ---------------------------------------------------------------------
  const box = h => { $("app").innerHTML = `<div class="ov"><div class="md">${h}</div></div>`; };
  function authUI(msg) {
    box(`<h3 style="text-align:center">🔐 Shop sign in</h3><input id="ae" type="email" placeholder="Email" autocomplete="username"><br><br><input id="ap2" type="password" placeholder="Password" autocomplete="current-password" onkeyup="if(event.key=='Enter')SB.signin()"><br><br><button class="pri" onclick="SB.signin()">Sign in</button><p class="wn">${esc(msg || "")}</p>`);
  }
  SB.signin = async () => {
    const { error } = await c.auth.signInWithPassword({ email: $("ae").value.trim(), password: $("ap2").value });
    if (error) { authUI(error.message); return; }
    start();
  };
  SB.out = async () => { await c.auth.signOut(); location.reload(); };
  async function start() {
    box("Loading…");
    try { await pull(); }
    catch (e) { box(`<h3 class="wn">Cannot load data</h3><p>${esc(e.message || e)}</p><p><small>Did you run supabase/schema.sql ?</small></p><button onclick="SB.boot()">Retry</button> <button onclick="SB.out()">Sign out</button>`); return; }
    SB.ready = true; LU(); R(); subscribe();
    if (!cache.settings) SB.push();
  }

  // ---- customer side (QR menu) -----------------------------------------------------
  async function loadOffers() {
    let p = ""; try { p = localStorage.getItem("regp") || ""; } catch (e) {}
    if (!p) { moff = []; return; }
    const { data } = await c.rpc("my_offers", { p_phone: p });
    moff = data || [];
  }
  async function menuLoad() {
    const [a, b] = await Promise.all([all("public_menu"), c.from("public_shop").select("*").maybeSingle()]);
    const M = {};
    a.forEach(r => { const it = M[r.item_id] = M[r.item_id] || { id: r.item_id, no: r.no, name: r.name, price: +r.price, cost: 0, cat: r.cat || "", br: r.brand || "", img: r.img || "", ci: r.ci || {}, v: [] }; it.v.push({ sku: r.sku, size: r.size, color: r.color, bar: "", qty: r.qty }); });
    S.items = Object.values(M).sort((x, y) => x.no - y.no);
    const s = b.data || {};
    S.shop = { ...S.shop, name: s.name || "Shop", logo: s.logo || "", offer: s.offer || "", cur: s.cur || "Rs." };
    await loadOffers(); R();
  }
  window.mreg = function () {
    let p = ""; try { p = localStorage.getItem("regp") || ""; } catch (e) {}
    if (!p) return `<div class="cd" style="background:var(--bg)"><b>Register to get offers</b><div class="fm"><input id="rn" placeholder="Name"><input id="rp" placeholder="Phone"><button class="pri" onclick="RG()">Register</button></div></div>`;
    return moff.map(o => `<div class="cd" style="border-color:var(--ac)">${o.img ? `<img src="${o.img}" alt="" style="width:100%;border-radius:10px;margin-bottom:8px">` : ""}<b>🎁 ${esc(o.title)}</b><p>${esc(o.msg)}</p>${(o.items || []).map(i => `<div class="row"><span>${esc(i.name)} <small>${esc(i.cat || "Other")}</small></span><span><s>${m(i.price)}</s> <b>${m(i.offer)}</b></span></div>`).join("")}</div>`).join("");
  };
  window.RG = async function () {
    const p = np($("rp").value); if (!p) { T("Phone required"); return; }
    const { error } = await c.rpc("register_customer", { p_name: $("rn").value.trim(), p_phone: p });
    if (error) { T("Could not register"); return; }
    try { localStorage.setItem("regp", p); } catch (e) {}
    await loadOffers(); R();
  };
  window.MO = async function () {
    const lines = [...document.querySelectorAll(".mq")].filter(e => +e.value > 0).map(e => { const f = FV(e.dataset.k); return { sku: e.dataset.k, n: f.it.name + " " + vl(f.v), qty: +e.value }; });
    if (!lines.length) return;
    const { error } = await c.rpc("place_order", { p_name: $("mn").value.trim(), p_phone: np($("mp").value), p_lines: lines });
    if (error) { T("Could not send the order"); return; }
    T(t("thanks")); document.querySelectorAll(".mq").forEach(e => { e.value = 0; });
  };

  SB.boot = async () => {
    try { Object.assign(S, JSON.parse(localStorage.getItem("pospref") || "{}")); } catch (e) {}
    if (!c) { box(`<h3>⚙️ Setup needed</h3><p>Open <b>config.js</b> and paste your Supabase <b>URL</b> and <b>anon key</b>.</p>`); return; }
    if (location.hash == "#menu") { try { await menuLoad(); } catch (e) { box("Menu is not available right now."); } return; }
    const { data } = await c.auth.getSession();
    if (!data.session) { authUI(); return; }
    await start();
  };
  SB.boot();
})();
