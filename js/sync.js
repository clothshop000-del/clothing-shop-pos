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
  let lastFlush = 0, cache = {}, timer = 0, busy = false, dirty = false, again = false, moff = [], rtOn = false;

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
    qr_orders: { k: "id", rows: () => S.orders.filter(o => o.id).map(o => ({ id: o.id, name: o.name || null, phone: o.phone || null, lines: o.lines, t: iso(o.t), done: !!o.done, status: o.status || (o.done ? "completed" : "pending"), pay_method: o.pay_method || null, address: o.address || null, total: o.total || 0, sale_id: o.sale_id || null, done_t: o.done_t ? iso(o.done_t) : null })) },
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
    try { for (const t of ORDER) await sync(t); lastFlush = Date.now(); st("✓ Saved " + new Date().toLocaleTimeString()); }
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
    S.orders = qo.map(o => ({ id: o.id, name: o.name || "", phone: o.phone || "", lines: o.lines, t: ms(o.t), done: o.done ? 1 : undefined, status: o.status || "pending", pay_method: o.pay_method || "", address: o.address || "", total: +o.total || 0, sale_id: o.sale_id || undefined, done_t: o.done_t ? ms(o.done_t) : undefined })).sort((a, b) => a.t - b.t);
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
  // refresh from the database (other devices' bills, orders, stock ...) without losing what the user is typing
  const sigAll = () => ORDER.map(t => JSON.stringify(cache[t] || {})).join("|");
  const typing = () => { const a = document.activeElement; return a && /INPUT|SELECT|TEXTAREA/.test(a.tagName) && a.id !== "sc"; };
  async function pullQ() {
    if (dirty || busy || !SB.ready) { again = true; return; }
    if (typing()) { setTimeout(pullQ, 4000); return; }
    try {
      const pend = () => S.orders.filter(o => (o.status || "pending") == "pending" && !o.done).length, b = sigAll(), n0 = pend();
      await pull();
      if (sigAll() !== b) { if (pend() > n0) T("🔔 New QR order"); R(); }
    } catch (e) { console.error(e); }
  }
  function subscribe() {
    if (rtOn) return; rtOn = true; let tm;
    const f = () => { if (Date.now() - lastFlush < 3000) return; clearTimeout(tm); tm = setTimeout(pullQ, 1200); };
    let ch = c.channel("pos-live");
    ORDER.forEach(t => { ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, f); });
    ch.subscribe();
    setInterval(() => { if (SB.ready && !dirty && !busy) pullQ(); }, 30000);
    setInterval(() => { if (SB.ready) { chk().catch(() => {}); stRefresh(); } }, 20000);
    c.channel("staff-live").on("postgres_changes", { event: "*", schema: "public", table: "staff" }, () => { if (SB.ready) { chk().catch(() => {}); stRefresh(); } }).subscribe();
  }

  // ---- screens ---------------------------------------------------------------------
  const box = h => { $("app").innerHTML = `<div class="ov"><div class="md">${h}</div></div>`; };
  const devName = () => { const u = navigator.userAgent, os = /Windows/.test(u) ? "Windows" : /Android/.test(u) ? "Android" : /iPhone|iPad/.test(u) ? "iPhone/iPad" : /Mac/.test(u) ? "Mac" : "Device", br = /Edg\//.test(u) ? "Edge" : /Chrome\//.test(u) ? "Chrome" : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "Browser"; return br + " on " + os; };
  let amode = "in", waitT = 0;
  SB.mode = m => { amode = m; authUI(); };
  function authUI(msg) {
    const reg = amode == "req";
    box(`<h3 style="text-align:center">🔐 ${reg ? "Request access" : "Shop sign in"}</h3>${reg ? `<input id="an2" placeholder="Your name"><br><br>` : ""}<input id="ae" type="email" placeholder="Email" autocomplete="username"><br><br><input id="ap2" type="password" placeholder="Password (min 6 characters)" autocomplete="${reg ? "new-password" : "current-password"}" onkeyup="if(event.key=='Enter')SB.signin()"><br><br><button class="pri" style="width:100%" onclick="SB.signin()">${reg ? "Request access" : "Sign in"}</button><p class="wn">${esc(msg || "")}</p><p style="text-align:center"><button onclick="SB.mode('${reg ? "in" : "req"}')">${reg ? "I already have an account" : "New device? Request access"}</button></p>`);
  }
  SB.signin = async () => {
    const email = $("ae").value.trim(), password = $("ap2").value;
    if (amode == "req") {
      const name = $("an2").value.trim(); if (!name) { authUI("Enter your name"); return; }
      const { data, error } = await c.auth.signUp({ email, password, options: { data: { name } } });
      if (error) { authUI(error.message); return; }
      if (!data.session) { authUI("Check your email to confirm the account, then sign in. (Tip: turn OFF 'Confirm email' in Supabase to skip this.)"); return; }
    } else {
      const { error } = await c.auth.signInWithPassword({ email, password });
      if (error) { authUI(error.message); return; }
    }
    gate();
  };
  SB.out = async () => { clearTimeout(waitT); await c.auth.signOut(); location.reload(); };
  // after sign in: is this account approved by the admin?
  async function gate() {
    clearTimeout(waitT);
    const { data: sess } = await c.auth.getSession(), user = sess.session && sess.session.user;
    if (!user) { authUI(); return; }
    const { data, error } = await c.rpc("request_access", { p_name: (user.user_metadata && user.user_metadata.name) || user.email, p_device: devName() });
    if (error) { box(`<h3 class="wn">Cannot check access</h3><p>${esc(error.message)}</p><p><small>Did you run supabase/update-2.sql ?</small></p><button onclick="SB.boot()">Retry</button> <button onclick="SB.out()">Sign out</button>`); return; }
    SB.staff = data;
    if (data.status == "approved") { await start(); return; }
    if (data.status == "removed") { box(`<h3 class="wn">Access removed</h3><p>The admin removed this device. Ask the admin to approve it again.</p><button onclick="SB.out()">Sign out</button>`); waitT = setTimeout(gate, 10000); return; }
    box(`<h3>⏳ Waiting for admin approval</h3><p>Your request was sent:<br><b>${esc(data.name)}</b> · ${esc(data.email)}<br><small>${esc(data.device || "")}</small></p><p>Ask the shop admin to open <b>Settings → Staff &amp; devices</b> and approve you. This page continues automatically.</p><button onclick="SB.out()">Sign out</button>`);
    waitT = setTimeout(gate, 6000);
  }
  // admin: staff & devices panel (Settings page)
  SB.staffList = [];
  async function loadStaff() {
    if (!SB.staff || SB.staff.role != "A") return;
    const { data } = await c.from("staff").select("*").order("created_at");
    const n0 = SB.staffList.filter(x => x.status == "pending").length;
    SB.staffList = data || [];
    if (SB.staffList.filter(x => x.status == "pending").length > n0 && n0 >= 0 && SB.staffSeen) T("🔔 A new device is waiting for approval");
    SB.staffSeen = true;
  }
  const stH = () => `<table><tr><th>Name</th><th>Device</th><th>Status</th><th>Role</th><th></th></tr>${SB.staffList.map(s => { const me = s.user_id == SB.staff.user_id; return `<tr><td>${esc(s.name)}<br><small>${esc(s.email)}</small></td><td><small>${esc(s.device || "")}</small></td><td class="${s.status == "approved" ? "" : "wn"}">${s.status}</td><td><select ${me ? "disabled" : ""} onchange="SB.st('${s.user_id}',{role:this.value})">${[["A", "Admin"], ["C", "Cashier"], ["K", "Stock Keeper"]].map(r => `<option value="${r[0]}"${s.role == r[0] ? " selected" : ""}>${r[1]}</option>`).join("")}</select></td><td>${me ? "(you)" : (s.status != "approved" ? `<button class="pri" onclick="SB.st('${s.user_id}',{status:'approved',approved_at:new Date().toISOString()})">✓ Approve</button>` : `<button onclick="SB.st('${s.user_id}',{status:'removed'})">Remove</button>`) + ` <button onclick="SB.del('${s.user_id}')" title="Delete">🗑</button>`}</td></tr>`; }).join("")}</table>`;
  const stRefresh = async () => { await loadStaff(); const e = $("stp"); if (e) e.innerHTML = stH(); };
  SB.st = async (uid, patch) => { const { error } = await c.from("staff").update(patch).eq("user_id", uid); if (error) T(error.message); stRefresh(); };
  SB.del = async uid => { const { error } = await c.from("staff").delete().eq("user_id", uid); if (error) T(error.message); stRefresh(); };
  V.set = (set0 => function () { stRefresh(); return set0() + `<div class="cd"><b>👥 Staff &amp; devices</b><br><small style="color:var(--mu)">New devices appear here as <b>pending</b>. Approve them, choose their role, or remove them. Only Admins can see this.</small><div id="stp" style="overflow-x:auto;margin-top:8px">${stH()}</div></div>`; })(V.set);
  async function chk() {       // signed-in device: still approved? role changed?
    const { data } = await c.rpc("my_staff");
    if (!data || data.status != "approved" || data.role != SB.staff.role) location.reload();
  }

  async function start() {
    box("Loading…");
    try { await pull(); }
    catch (e) { box(`<h3 class="wn">Cannot load data</h3><p>${esc(e.message || e)}</p><p><small>Did you run supabase/schema.sql, update-1.sql and update-2.sql ?</small></p><button onclick="SB.boot()">Retry</button> <button onclick="SB.out()">Sign out</button>`); return; }
    SB.ready = true; U = { n: SB.staff.name || SB.staff.email, r: SB.staff.role, pin: "" }; LU(); R(); subscribe(); stRefresh();
    if (!cache.settings && SB.staff.role == "A") SB.push();
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
    await loadOffers(); await loadOrders(false); R();
    setInterval(async () => { try { await loadOrders(true); const a = document.activeElement; if (!(a && /INPUT/.test(a.tagName))) R(); } catch (e) {} }, 15000);
  }
  window.mreg = function () {
    let p = ""; try { p = localStorage.getItem("regp") || ""; } catch (e) {}
    if (!p) return `<div class="cd" style="background:var(--bg)"><b>Register to get offers</b><div class="fm"><input id="rn" placeholder="Name"><input id="rp" placeholder="Phone"><button class="pri" onclick="RG()">Register</button></div></div>`;
    return moff.map(o => `<div class="cd" style="border-color:var(--ac)">${o.img ? `<img src="${o.img}" alt="" style="width:100%;border-radius:10px;margin-bottom:8px">` : ""}<b>🎁 ${esc(o.title)}</b><p>${esc(o.msg)}</p>${(o.items || []).map(i => `<div class="row"><span>${esc(i.name)} <small>${esc(i.cat || "Other")}</small></span><span><s>${m(i.price)}</s> <b>${m(i.offer)}</b></span></div>`).join("")}</div>`).join("");
  };
  // ---- customer app: order, pay choice, status + notifications ---------------------
  let mcat = "", mq = "", mpay = "cod", mqty = {}, mnm = "", mph = "", mad = "", orders = [], ost = {};
  try { ost = JSON.parse(localStorage.getItem("ost") || "{}"); } catch (e) {}
  const STX = { pending: "⏳ Waiting for confirmation", confirmed: "👨‍🍳 Confirmed · preparing", ready: "🛍 Ready!", completed: "✔ Completed", rejected: "❌ Rejected" };
  const phone0 = () => { try { return localStorage.getItem("regp") || localStorage.getItem("ordph") || ""; } catch (e) { return ""; } };
  async function loadOrders(notify) {
    const p = phone0(); if (!p) return;
    const { data } = await c.rpc("my_orders", { p_phone: p });
    orders = data || [];
    orders.forEach(o => {
      if (notify && ost[o.id] && ost[o.id] !== o.status) {
        const msg = { confirmed: "✅ Order #" + o.id + " confirmed — we are preparing it", ready: "🛍 Order #" + o.id + " is READY!", rejected: "❌ Order #" + o.id + " was rejected", completed: "✔ Order #" + o.id + " completed" }[o.status];
        if (msg) { T(msg); try { if (Notification.permission === "granted") new Notification(S.shop.name, { body: msg }); } catch (e) {} }
      }
      ost[o.id] = o.status;
    });
    try { localStorage.setItem("ost", JSON.stringify(ost)); } catch (e) {}
  }
  window.RG = async function () {
    const p = np($("rp").value); if (!p) { T("Phone required"); return; }
    const { error } = await c.rpc("register_customer", { p_name: $("rn").value.trim(), p_phone: p });
    if (error) { T("Could not register"); return; }
    try { localStorage.setItem("regp", p); } catch (e) {}
    mph = p; mnm = $("rn").value.trim();
    await loadOffers(); await loadOrders(false); R();
  };
  const mrows = () => {
    const k = mq.toLowerCase();
    return VS().filter(x => (!mcat || (x.it.cat || "Other") == mcat) && (!k || (x.it.name + " " + vl(x.v) + " #" + x.it.no).toLowerCase().includes(k))).map(x => {
      const im = (x.it.ci && x.it.ci[x.v.color]) || x.it.img, off = x.v.qty < 1;
      return `<div class="row" style="${off ? "opacity:.55" : ""}"><span>${im ? `<img src="${im}" alt="" style="height:44px;width:44px;object-fit:cover;border-radius:8px;vertical-align:middle;margin-right:8px">` : ""}${esc(x.it.name)} <small>${esc(vl(x.v))}</small><br><small style="color:var(--mu)">${esc(x.it.cat || "")} · ${m(x.it.price)} · ${off ? "Out of stock" : x.v.qty + " in stock"}</small></span><input class="mq" type="text" inputmode="numeric" value="${mqty[x.v.sku] || 0}" style="width:60px" ${off ? "disabled" : ""} oninput="MQ('${x.v.sku}',this.value)"></div>`;
    }).join("") || "<p>—</p>";
  };
  window.MQ = (k, v) => { const f = FV(k); mqty[k] = Math.min(Math.max(0, parseInt(v) || 0), f ? f.v.qty : 0); };
  window.MS = v => { mq = v; $("ml").innerHTML = mrows(); };
  window.menu = function () {
    const sh = S.shop, cats = [...new Set(S.items.map(i => i.cat || "Other"))], PM = { cod: "💵 Cash on delivery", bank: "🏦 Bank transfer · delivery", shop: "🏬 I will visit the shop" };
    return `<main><div class="cd"><div style="text-align:center">${sh.logo ? `<img src="${sh.logo}" alt="" style="max-height:90px;border-radius:10px"><br>` : ""}<h2>${esc(sh.name)}</h2></div>${sh.offer ? `<p><b>${esc(sh.offer)}</b></p>` : ""}${mreg()}
${orders.length ? `<div class="cd"><b>My orders</b>${orders.slice(0, 8).map(o => `<div class="row"><span>#${o.id} · ${new Date(o.t).toLocaleDateString()} · ${m(o.total)}</span><b>${STX[o.status] || o.status}</b></div>`).join("")}${(window.Notification && Notification.permission === "default") ? `<button onclick="Notification.requestPermission().then(R)">🔔 Turn on notifications</button>` : ""}</div>` : ""}
<input placeholder="🔍 Search items" value="${esc(mq)}" oninput="MS(this.value)"><div class="pills">${["", ...cats].map(c => `<button class="ch ${mcat == c ? "on" : ""}" onclick="mcat=${J(c)};R()">${c ? esc(c) : "All"}</button>`).join("")}</div>
<div id="ml">${mrows()}</div>
<div class="fm"><input placeholder="Name" value="${esc(mnm)}" oninput="mnm=this.value"><input placeholder="Phone" value="${esc(mph)}" oninput="mph=this.value"></div>
<div class="pills">${Object.keys(PM).map(k => `<button class="ch ${mpay == k ? "on" : ""}" onclick="mpay='${k}';R()">${PM[k]}</button>`).join("")}</div>
${mpay != "shop" ? `<input placeholder="Delivery address" value="${esc(mad)}" oninput="mad=this.value"><br><br>` : ""}<button class="pri" onclick="MO()">Place order</button></div></main>`;
  };
  window.MO = async function () {
    const lines = Object.entries(mqty).filter(([k, q]) => q > 0 && FV(k)).map(([k, q]) => { const f = FV(k); return { sku: k, n: f.it.name + " " + vl(f.v), qty: Math.min(q, f.v.qty) }; });
    if (!lines.length) { T("Choose at least one item"); return; }
    const ph = np(mph); if (!ph) { T("Phone required"); return; }
    if (mpay != "shop" && !mad.trim()) { T("Delivery address required"); return; }
    try { if (window.Notification && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
    const { data, error } = await c.rpc("place_order", { p_name: mnm.trim(), p_phone: ph, p_lines: lines, p_pay: mpay, p_addr: mad.trim() });
    if (error) { T("Could not send the order: " + (error.message || "")); return; }
    mqty = {}; try { localStorage.setItem("ordph", ph); } catch (e) {}
    T("✅ Order sent! Total " + m(data.total));
    await loadOrders(false); R();
  };

  SB.boot = async () => {
    try { Object.assign(S, JSON.parse(localStorage.getItem("pospref") || "{}")); } catch (e) {}
    if (!c) { box(`<h3>⚙️ Setup needed</h3><p>Open <b>config.js</b> and paste your Supabase <b>URL</b> and <b>anon key</b>.</p>`); return; }
    if (location.hash == "#menu") { try { await menuLoad(); } catch (e) { box("Menu is not available right now."); } return; }
    const { data } = await c.auth.getSession();
    if (!data.session) { authUI(); return; }
    await gate();
  };
  SB.boot();
})();
