# 👕 Clothing Shop POS — Supabase + GitHub + Cloudflare Pages

මේ project එකේ තියෙන්නේ:

```
clothing-shop-pos/
├─ index.html            ← POS page එක
├─ css/style.css         ← පෙනුම (design)
├─ js/app.js             ← POS app එකේ මුළු කේතය (billing, orders, refunds, customers,
│                          inventory, barcode labels, QR ordering, dashboard, settings)
├─ js/sync.js            ← Supabase එක්ක සම්බන්ධය (login, දත්ත load/save, live QR orders, QR menu)
├─ config.js             ← ඔයාගේ Supabase URL + anon key මෙතන දාන්න
├─ supabase/schema.sql   ← Database එක හදන SQL (tables, security, QR functions, realtime)
├─ server.js             ← VS Code / computer එකේ run කරන පොඩි server එක (package ඕන නැහැ)
├─ package.json          ← `npm start` සඳහා
└─ .vscode/              ← VS Code tasks + extension නිර්දේශ
```

Hosting = **Cloudflare Pages** (free), Database = **Supabase** (free), Code = **GitHub**.
Computer එකේ test කරන්න = **VS Code** (පහළ "VS Code එකේ run කරන විදිය" බලන්න).

---|---|
| `index.html` | POS app එක (billing, orders, refunds, customers, inventory, barcode labels, QR ordering, dashboard, settings) |
| `sync.js` | Supabase එක්ක සම්බන්ධය: login, දත්ත load/save, live QR orders, customers ගේ QR menu |
| `config.js` | **ඔයාගේ Supabase URL + anon key** මෙතන ඇතුළත් කරනවා |
| `supabase/schema.sql` | Database එක හදන SQL (tables, security, QR functions) |

Server එකක් ඕන නැහැ. Hosting = **Cloudflare Pages** (free), Database = **Supabase** (free), Code = **GitHub**.

---

## 💻 VS Code එකේ run කරන විදිය (computer එකේ)

> මුලින්ම **පියවර 1 – 5** (Supabase project, SQL, login user, `config.js`) කරගන්න. ඒවා නැතුව app එක පෙනෙන්නේ "Setup needed" කියලා.

**ඕන දේවල්:** [Node.js (LTS)](https://nodejs.org) සහ [VS Code](https://code.visualstudio.com) install කරලා තියෙන්න ඕන. Internet එක ඕන (Supabase සහ QR library එක ඒකෙන් එන නිසා).

**විදිය A — Node server (නිර්දේශිතයි)**
1. Zip එක **Extract** කරන්න.
2. VS Code → **File → Open Folder** → extract කරපු `clothing-shop-pos` folder එක.
3. `config.js` open කරලා Supabase URL + anon key දාලා Save (`Ctrl+S`).
4. VS Code terminal එක open කරන්න: **Terminal → New Terminal**.
5. මෙය type කරලා Enter ඔබන්න:
   ```
   npm start
   ```
   (නැත්නම් `node server.js`, හෝ `Ctrl+Shift+B` ඔබලා "Run POS" task එක.)
6. Browser එකේ **http://localhost:3000** open කරන්න. Sign in → PIN screen එක එනවා.
7. නවත්වන්න: terminal එකේ `Ctrl+C`.

**විදිය B — Live Server extension**
1. VS Code **Extensions** (Ctrl+Shift+X) → **Live Server** (Ritwick Dey) install කරන්න.
2. `index.html` එක right-click → **Open with Live Server**.
3. Browser එකේ `http://127.0.0.1:5500` open වෙනවා.

**QR menu එක local එකේ බලන්න:** `http://localhost:3000/#menu`.
(Phone එකෙන් බලන්න ඕන නම් computer සහ phone එකම Wi-Fi එකේ තියලා `http://<computer ගේ IP>:3000/#menu` වලින්. ඒත් QR code එක හදද්දී ඒ link එකම ඇතුළත් වෙන නිසා, QR එක print කරන්නේ **Cloudflare link එකෙන් open කරලා** ඉන්න වෙලාවේ.)

---

## පියවර 1 — Supabase project එක හදන්න

1. https://supabase.com → **Start your project** → GitHub එකෙන් හෝ email එකෙන් sign up.
2. **New project** → නමක් දෙන්න (උදා: `my-shop-pos`) → **Database Password** එකක් දාලා **ඒක ලියලා තියාගන්න** → Region: **Southeast Asia (Singapore)** → **Create new project**. විනාඩි 1–2ක් යනවා.

## පියවර 2 — SQL run කරන්න (tables හැදීම)

1. වම් menu එකේ **SQL Editor** → **New query**.
2. `supabase/schema.sql` file එක open කරලා **ඔක්කොම copy** කරලා paste කරන්න.
3. **Run** ඔබන්න. "Success. No rows returned" කියලා ආවොත් හරි.

මේකෙන් හැදෙන tables:

| Table | මොකටද |
|---|---|
| `settings` | shop නම, logo, tax, users + PIN, categories, brands |
| `items`, `variants` | inventory (item, size, colour, SKU, barcode, stock, photos, hidden) |
| `label_jobs` | barcode labels print කරන්න තෝරපු ඒවා |
| `sales` | bills (re-edit bills ඇතුළුව) |
| `refunds`, `credit_notes` | refunds සහ credit notes |
| `customers`, `qr_registrations` | customers (WhatsApp / QR app) |
| `qr_orders` | QR menu එකෙන් එන orders |
| `offers`, `offer_notes` | offers සහ customers ට යවපු notifications |

## පියවර 3 — Shop එකේ login එක හදන්න

1. **Authentication → Users → Add user → Create new user**.
2. Email + password දෙන්න, **Auto Confirm User** tick කරන්න → **Create user**.

## පියවර 4 — ⚠️ සුරක්ෂිතතාව (අනිවාර්යයි)

**Authentication → Sign In / Providers → "Allow new users to sign up" → OFF** කරලා Save කරන්න.

> මේක OFF නොකළොත් ඕනම කෙනෙකුට account එකක් හදාගෙන ඔයාගේ දත්ත බලන්න පුළුවන්.
> Login එක ඔයා හදපු user ලා ට විතරයි.

## පියවර 5 — Keys `config.js` එකට දාන්න

1. **Project Settings → API** (හෝ **Data API / API Keys**).
2. **Project URL** සහ **anon / public** key එක copy කරන්න.
3. `config.js` open කරලා:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...."
};
```

> ✅ `anon` key එක public එකක්, ආරක්ෂිතයි (RLS නිසා).
> ❌ `service_role` key එක **කිසිවිටක** මෙතනට / GitHub එකට දාන්න එපා.

## පියවර 6 — GitHub එකට උඩුගත කරන්න

1. https://github.com → **New repository** → නම `my-shop-pos` → (Private කරන්න පුළුවන්) → **Create**.
2. **uploading an existing file** → මේ files drag කරන්න: `index.html`, `config.js`, `package.json`, `server.js`, `README.md`, සහ `css`, `js`, `supabase` folders (GitHub එකට folder drag කරන්න පුළුවන්).
3. **Commit changes**.

## පියවර 7 — Cloudflare Pages වලට host කරන්න

1. https://dash.cloudflare.com → sign up / login.
2. **Workers & Pages → Create → Pages → Connect to Git**.
   (Workers විතරක් පෙනෙනවා නම්, යටින් තියෙන **"Looking to deploy Pages? Get started"** ඔබන්න.)
3. GitHub authorize කරලා `my-shop-pos` repo එක තෝරන්න → **Begin setup**.
4. Settings:
   - **Framework preset:** `None`
   - **Build command:** *(හිස්)*
   - **Build output directory:** `/`
5. **Save and Deploy**. විනාඩියකින් `https://my-shop-pos.pages.dev` වගේ link එකක් ලැබෙනවා. 🎉

## පියවර 8 — Supabase එකට site URL එක කියන්න

**Authentication → URL Configuration → Site URL** = ඔයාගේ `https://....pages.dev` link එක → **Save**.

## පියවර 9 — පළමු වතාවට පාවිච්චි කරන්න

1. Site එක open කරලා පියවර 3 හි email + password එකෙන් **Sign in**.
2. ඊළඟට PIN screen එක: **Admin = 1111**, Cashier = 2222, Stock Keeper = 3333.
3. **Settings → Users & roles** වලින් **PIN වෙනස් කරන්න**. Settings එකේම shop නම, logo, tax දාන්න.
4. Inventory එකට categories / brands / items දාන්න.

## පියවර 10 — QR ordering

1. **QR Ordering** tab → **QR** බොත්තම → **⬇ Download QR** → print කරලා කඩේට ගහන්න.
2. Customer ගේ phone එකේ QR scan → `https://....pages.dev/#menu` menu එක → register / order කරන්න පුළුවන්.
3. Order එක ඔයාගේ **QR Ordering** page එකට **ඒ ගමන්ම** එනවා (🔔 පණිවිඩයක් සමඟ).
4. Offers: Customers tab → Offers → WhatsApp / QR customers ට යවන්න. Customer register වුණාම ඒ phone number එකට අදාල offer image + items QR menu එකේ පෙනෙනවා.

## පසුව වෙනස්කම් කරන්න

GitHub එකේ file එක edit කරලා **Commit** කළාම Cloudflare ඉබේම අලුත් version එක deploy කරනවා.

---

## දැනගන්න ඕන දේවල්

- **Roles (Admin / Cashier / Stock Keeper)** app එක ඇතුළේ පාලනය වෙන ඒවා. Database එකට ඇතුල් වෙන්නේ shop login (email+password) එකෙන්, ඒ නිසා ඒක **විශ්වාස කරන කෙනෙක්ට / device එකකට** විතරක් දෙන්න.
- **Customers (QR)** ට කෙලින්ම tables වලට access නැහැ. ඔවුන්ට පෙනෙන්නේ stock තියෙන, හංගලා නැති items (ගත් මිල නැතුව) සහ ඒ ඒ phone එකට අදාල offers විතරයි. Order එවන / register වෙන functions තියෙනවා.
- **Backups:** Supabase free plan එකේ automatic backups නැහැ. Table Editor එකෙන් CSV export කරන්න (නිතර), හෝ Pro plan එකක් ගන්න. Free project එක **දවස් 7ක් භාවිතයක් නැතිව ගියොත් pause වෙනවා** (Dashboard එකෙන් resume කරන්න පුළුවන්).
- **Claude preview එකේ දැනට තියෙන දත්ත** මේකට ඉබේම එන්නේ නැහැ. අලුතින් items / settings ඇතුළත් කරන්න.
- Realtime (QR order එක ඒ ගමන් පෙනෙන්න) SQL එකෙන්ම on වෙනවා.

## ගැටළු විසඳන්න

| පෙනෙන දේ | කරන්න ඕන දේ |
|---|---|
| "Setup needed" | `config.js` එකේ URL / key හරියට දාලාද බලන්න |
| "Cannot load data" | පියවර 2 (SQL) run කළාද බලන්න |
| "⚠ Not saved …" (වම් පහළ) | Internet / login එක බලන්න, Sign out → ආයෙත් sign in |
| QR menu එකේ items නැහැ | Item එක **Hide in POS** tick කරලාද, stock 0 ද බලන්න |
| Sign in වෙන්න බැහැ | Authentication → Users එකේ user ඉන්නවාද, **Auto Confirm** කළාද බලන්න |
