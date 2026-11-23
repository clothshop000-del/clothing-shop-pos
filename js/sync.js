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
  let DEVID = ""; try { DEVID = localStorage.getItem("pos_device") || ""; if (!DEVID) { DEVID = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "d" + Date.now() + Math.random().toString(36).slice(2); localStorage.setItem("pos_device", DEVID); } } catch (e) { DEVID = "d" + Date.now(); }
  const c = configured ? supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { global: { headers: { "x-device-id": DEVID } } }) : null;
  const DEF = JSON.parse(JSON.stringify(ACC));
  const SB = { c, ready: false }; window.SB = SB;
  const iso = x => new Date(x || Date.now()).toISOString(), ms = x => (x ? +new Date(x) : 0);
  const sig = r => JSON.stringify(r);
  let lastFlush = 0, cache = {}, timer = 0, busy = false, dirty = false, again = false, moff = [], rtOn = false;

  // small status badge (bottom-left)
  const badge = document.createElement("div");
  badge.style.cssText = "position:fixed;left:8px;bottom:calc(8px + var(--nb,0px));font-size:11px;color:var(--mu);z-index:5;max-width:60vw";
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
  async function pollOrders() {       // cheap check: new / changed QR orders (every 10 s)
    if (!SB.ready || dirty || busy || typing()) return;
    try {
      const qo = await all("qr_orders"), n0 = S.orders.filter(o => (o.status || "pending") == "pending" && !o.done).length, before = JSON.stringify(S.orders.map(o => [o.id, o.status, o.done]));
      mapQ(qo, S.regs.map(r => ({ name: r.n, phone: r.p, t: r.t })), S.notes.map(n => ({ phone: n.p, offer_id: n.o, t: n.t })));
      snapT("qr_orders");
      if (JSON.stringify(S.orders.map(o => [o.id, o.status, o.done])) !== before) {
        if (S.orders.filter(o => (o.status || "pending") == "pending" && !o.done).length > n0) T("🔔 New QR order");
        if (["qr", "bl", "dash"].includes(tab)) R();
      }
    } catch (e) { console.error(e); }
  }
  function subscribe() {
    if (rtOn) return; rtOn = true;
    setInterval(pollOrders, 10000);
    setInterval(() => { if (SB.ready && !dirty && !busy) pullQ(); }, 30000);
    setInterval(() => { if (SB.ready) { chk().catch(() => {}); stRefresh(); } }, 15000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && SB.ready) { pollOrders(); stRefresh(); } });
  }

  // ---- screens ---------------------------------------------------------------------
  const box = h => { $("app").innerHTML = `<div class="ov"><div class="md">${h}</div></div>`; };
  const devName = () => { const u = navigator.userAgent, os = /Windows/.test(u) ? "Windows" : /Android/.test(u) ? "Android" : /iPhone|iPad/.test(u) ? "iPhone/iPad" : /Mac/.test(u) ? "Mac" : "Device", br = /Edg\//.test(u) ? "Edge" : /Chrome\//.test(u) ? "Chrome" : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "Browser"; return br + " on " + os; };
  let amode = "in", waitT = 0;
  SB.mode = m => { amode = m; authUI(); };
  function authUI(msg) {
    const reg = amode == "req";
    box(`<h3 style="text-align:center">🔐 ${reg ? "Request access" : "Shop sign in"}</h3>${reg ? `<input id="an2" placeholder="Your name"><br><br><input id="au2" placeholder="Username (optional)" autocomplete="username"><br><br>` : ""}<input id="ae" ${reg ? 'type="email" placeholder="Email"' : 'placeholder="Email or username"'} autocomplete="${reg ? "email" : "username"}"><br><br><input id="ap2" type="password" placeholder="Password (min 6 characters)" autocomplete="${reg ? "new-password" : "current-password"}" onkeyup="if(event.key=='Enter')SB.signin()"><br><br><button class="pri" style="width:100%" onclick="SB.signin()">${reg ? "Create account & request access" : "Sign in"}</button><p class="wn">${esc(msg || "")}</p><p style="text-align:center"><button onclick="SB.mode('${reg ? "in" : "req"}')">${reg ? "I already have an account" : "No account yet? Create one"}</button></p><p style="text-align:center"><small style="color:var(--mu)">Every new device must be approved by the shop admin.</small></p>`);
  }
  SB.signin = async () => {
    const login = $("ae").value.trim(), password = $("ap2").value;
    if (amode == "req") {
      const name = $("an2").value.trim(); if (!name) { authUI("Enter your name"); return; }
      const { data, error } = await c.auth.signUp({ email: login, password, options: { data: { name, username: $("au2").value.trim() } } });
      if (error) { authUI(error.message); return; }
      if (!data.session) { authUI("Check your email to confirm the account, then sign in. (Tip: turn OFF 'Confirm email' in Supabase to skip this.)"); return; }
    } else {
      const { data: em } = await c.rpc("login_email", { p_login: login });
      const { error } = await c.auth.signInWithPassword({ email: em || login, password });
      if (error) { authUI(error.message); return; }
    }
    gate();
  };
  SB.out = async () => { clearTimeout(waitT); await c.auth.signOut(); location.reload(); };
  // after sign in: has the admin approved THIS device?
  async function gate() {
    clearTimeout(waitT);
    const { data: sess } = await c.auth.getSession(), user = sess.session && sess.session.user;
    if (!user) { authUI(); return; }
    const md = user.user_metadata || {};
    const { data, error } = await c.rpc("request_access", { p_name: md.name || user.email, p_device_id: DEVID, p_label: devName(), p_username: md.username || "" });
    if (error) { box(`<h3 class="wn">Cannot check access</h3><p>${esc(error.message)}</p><p><small>Did you run supabase/update-3.sql ?</small></p><button onclick="SB.boot()">Retry</button> <button onclick="SB.out()">Sign out</button>`); return; }
    SB.staff = data;
    if (data.status == "approved") { await start(); return; }
    if (data.status == "removed") { box(`<h3 class="wn">Access removed</h3><p>The admin removed this device. Ask the admin to approve it again.</p><button onclick="SB.out()">Sign out</button>`); waitT = setTimeout(gate, 10000); return; }
    box(`<h3>⏳ Waiting for admin approval</h3><p>This device asked for access:<br><b>${esc(data.name)}</b> · ${esc(data.email)}<br><small>${esc(data.label || "")}</small></p><p>The admin must open <b>Settings → Staff &amp; devices</b> on an approved device and approve it. This page continues automatically.</p><button onclick="SB.out()">Sign out</button>`);
    waitT = setTimeout(gate, 6000);
  }
  // admin: Staff & devices panel (Settings page)
  const PAGES = [["pos", "POS"], ["rf", "Refunds"], ["bl", "Orders"], ["cu", "Customers"], ["dash", "Dashboard"], ["inv", "Inventory"], ["lab", "Labels"], ["qr", "QR orders"]];
  const RLN = { A: "Admin", C: "Cashier", K: "Stock Keeper" };
  SB.staffList = [];
  async function loadStaff() {
    if (!SB.staff || SB.staff.role != "A") return;
    const { data } = await c.from("devices").select("*").order("created_at");
    const n0 = SB.staffList.filter(x => x.status == "pending").length;
    SB.staffList = data || [];
    if (SB.staffSeen && SB.staffList.filter(x => x.status == "pending").length > n0) T("🔔 A new device is waiting for approval — open Settings");
    SB.staffSeen = true;
  }
  const same = s => s.user_id == SB.staff.user_id && s.device_id == SB.staff.device_id;
  const tabsOf = s => (s.tabs && s.tabs.length ? s.tabs : (DEF[s.role] || [])).filter(x => x != "set");
  const stH = () => SB.staffList.length ? SB.staffList.map(s => `<div class="cd" style="background:var(--bg)"><div class="row"><span><b>${esc(s.name)}</b> ${s.username ? "(" + esc(s.username) + ")" : ""}<br><small>${esc(s.email)} · ${esc(s.label || "")} · seen ${s.last_seen ? new Date(s.last_seen).toLocaleString() : "—"}</small></span><b class="${s.status == "approved" ? "" : "wn"}">${s.status}${same(s) ? " · this device" : ""}</b></div>
<div class="row" style="flex-wrap:wrap;justify-content:flex-start"><label style="margin:0">Job role</label><select style="width:auto" ${same(s) ? "disabled" : ""} onchange="SB.st('${s.user_id}','${s.device_id}',{role:this.value,tabs:null})">${["A", "C", "K"].map(r => `<option value="${r}"${s.role == r ? " selected" : ""}>${RLN[r]}</option>`).join("")}</select>${same(s) ? "" : (s.status != "approved" ? `<button class="pri" onclick="SB.st('${s.user_id}','${s.device_id}',{status:'approved',approved_at:new Date().toISOString()})">✓ Approve</button>` : `<button onclick="SB.st('${s.user_id}','${s.device_id}',{status:'removed'})">Remove</button>`) + ` <button onclick="SB.del('${s.user_id}','${s.device_id}')" title="Delete">🗑</button>`}</div>
${s.role == "A" ? `<small style="color:var(--mu)">Admin can open every page.</small>` : `<div class="pills" style="padding:6px 0 0">${PAGES.map(p => `<label style="display:inline-flex;gap:4px;align-items:center;margin:0 10px 4px 0;color:var(--tx)"><input type="checkbox" ${tabsOf(s).includes(p[0]) ? "checked" : ""} onchange="SB.tg('${s.user_id}','${s.device_id}','${p[0]}',this.checked)"> ${p[1]}</label>`).join("")}</div>`}</div>`).join("") : "<p style=\"color:var(--mu)\">No devices yet.</p>";
  const stRefresh = async () => { await loadStaff(); const e = $("stp"); if (e) e.innerHTML = stH(); };
  SB.st = async (uid, did, patch) => { const { error } = await c.from("devices").update(patch).eq("user_id", uid).eq("device_id", did); if (error) T(error.message); stRefresh(); };
  SB.del = async (uid, did) => { const { error } = await c.from("devices").delete().eq("user_id", uid).eq("device_id", did); if (error) T(error.message); stRefresh(); };
  SB.tg = (uid, did, tab, on) => { const s = SB.staffList.find(x => x.user_id == uid && x.device_id == did); if (!s) return; let a = tabsOf(s).slice(); a = on ? [...new Set([...a, tab])] : a.filter(x => x != tab); SB.st(uid, did, { tabs: a }); };
  V.set = (set0 => function () { stRefresh(); return set0() + `<div class="cd"><b>👥 Staff &amp; devices</b><br><small style="color:var(--mu)">A new device appears here as <b>pending</b>. Choose its job role and the pages it may open, then <b>Approve</b>. You can edit or remove a device at any time. Only Admin devices see this.</small><div id="stp" style="margin-top:8px">${stH()}</div></div>`; })(V.set);
  async function chk() {       // is THIS device still approved? role / pages changed?
    const { data } = await c.rpc("my_device", { p_device_id: DEVID });
    if (!data || data.status != "approved" || data.role != SB.staff.role || JSON.stringify(data.tabs || null) != JSON.stringify(SB.staff.tabs || null)) location.reload();
  }

  async function start() {
    box("Loading…");
    try { await pull(); }
    catch (e) { box(`<h3 class="wn">Cannot load data</h3><p>${esc(e.message || e)}</p><p><small>Did you run schema.sql, update-1.sql, update-2.sql and update-3.sql ?</small></p><button onclick="SB.boot()">Retry</button> <button onclick="SB.out()">Sign out</button>`); return; }
    SB.ready = true; U = { n: SB.staff.name || SB.staff.email, r: SB.staff.role, pin: "" }; if (SB.staff.role != "A" && SB.staff.tabs && SB.staff.tabs.length) ACC[SB.staff.role] = SB.staff.tabs.filter(x => x != "set"); LU(); R(); subscribe(); stRefresh();
    if (!cache.settings && SB.staff.role == "A") SB.push();
  }

  SB.boot = async () => {
    try { Object.assign(S, JSON.parse(localStorage.getItem("pospref") || "{}")); } catch (e) {}
    if (!c) { box(`<h3>⚙️ Setup needed</h3><p>Open <b>config.js</b> and paste your Supabase <b>URL</b> and <b>anon key</b>.</p>`); return; }
    if (location.hash == "#menu") { location.replace(new URL("menu.html", location.href).href); return; }
    const { data } = await c.auth.getSession();
    if (!data.session) { authUI(); return; }
    await gate();
  };
  SB.boot();
})();
