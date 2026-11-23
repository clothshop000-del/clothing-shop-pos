# 👕 Clothing Shop POS — Supabase + GitHub + Cloudflare Pages

මේ project එකේ තියෙන්නේ:

```
clothing-shop-pos/
├─ index.html            ← POS (staff) page එක
├─ menu.html             ← 📱 Customer app (QR menu) — customers ට
├─ manifest.webmanifest  ← customer app එක phone එකට install කරන්න (PWA)
├─ sw.js                 ← install / offline / notifications සඳහා service worker
├─ icons/                ← app icons
├─ css/style.css         ← POS පෙනුම (phone / tablet / desktop)
├─ css/customer.css      ← Customer app පෙනුම
├─ js/app.js             ← POS app එකේ මුළු කේතය (billing, orders, refunds, customers,
│                          inventory, barcode labels, QR ordering, dashboard, settings)
├─ js/customer.js        ← Customer app එකේ code එක
├─ js/sync.js            ← Supabase එක්ක සම්බන්ධය (login, දත්ත load/save, live QR orders, QR menu)
├─ config.js             ← ඔයාගේ Supabase URL + anon key මෙතන දාන්න
├─ supabase/schema.sql   ← Database එක හදන SQL (tables, security, QR functions, realtime)
├─ supabase/update-1.sql ← schema.sql ට පස්සේ run කරන SQL (QR order workflow, payments, realtime)
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
6. Browser එකේ **http://localhost:3000** open කරන්න. **Request access** (පළමු කෙනා Admin වෙනවා) → ඇතුළට යනවා.
7. නවත්වන්න: terminal එකේ `Ctrl+C`.

**විදිය B — Live Server extension**
1. VS Code **Extensions** (Ctrl+Shift+X) → **Live Server** (Ritwick Dey) install කරන්න.
2. `index.html` එක right-click → **Open with Live Server**.
3. Browser එකේ `http://127.0.0.1:5500` open වෙනවා.

**Customer app එක local එකේ බලන්න:** `http://localhost:3000/menu.html`.
(Phone එකෙන් බලන්න ඕන නම් computer සහ phone එකම Wi-Fi එකේ තියලා `http://<computer ගේ IP>:3000/menu.html` වලින්. ඒත් QR code එකට ඇතුළත් වෙන්නේ site එක open කරලා ඉන්න link එකේ `menu.html` ලිපිනය නිසා, QR එක print කරන්නේ **Cloudflare link එකෙන් open කරලා** ඉන්න වෙලාවේ.)

---

## පියවර 1 — Supabase project එක හදන්න

1. https://supabase.com → **Start your project** → GitHub එකෙන් හෝ email එකෙන් sign up.
2. **New project** → නමක් දෙන්න (උදා: `my-shop-pos`) → **Database Password** එකක් දාලා **ඒක ලියලා තියාගන්න** → Region: **Southeast Asia (Singapore)** → **Create new project**. විනාඩි 1–2ක් යනවා.

## පියවර 2 — SQL run කරන්න (tables හැදීම)

1. වම් menu එකේ **SQL Editor** → **New query**.
2. `supabase/schema.sql` file එක open කරලා **ඔක්කොම copy** කරලා paste කරන්න.
3. **Run** ඔබන්න. "Success. No rows returned" කියලා ආවොත් හරි.
4. **ඊට පස්සේ තවත් එක්:** ආයෙත් **New query** → `supabase/update-1.sql` ඔක්කොම copy කරලා paste කරලා **Run**. (මේකෙන් QR order workflow, payment choices, හැම device එකම ඉබේම refresh වෙන realtime එක ක්‍රියාත්මක වෙනවා.)
5. **තවත් එක්:** ආයෙත් **New query** → `supabase/update-2.sql` ඔක්කොම paste කරලා **Run**. (මේකෙන් **staff / device approval** සහ **database ආරක්ෂාව** ක්‍රියාත්මක වෙනවා.)
   6. **තවත් එක්:** ආයෙත් **New query** → `supabase/update-3.sql` ඔක්කොම paste කරලා **Run**. (මේකෙන් **device එකකට එකක් approval**, **table-by-table role rules**, **username login** ක්‍රියාත්මක වෙනවා.)

7. **තවත් එක්:** `supabase/update-4.sql` run කරන්න. (Customer app එකේ **offers slider** සහ **purchase history** සඳහා.)

> අනුපිළිවෙල: **schema.sql → update-1 → update-2 → update-3 → update-4**. කලින් ඒවා run කරලා තියෙනවා නම් අලුත් එක / ඒවා විතරක් run කරන්න.

මේකෙන් හැදෙන tables:

| Table | මොකටද |
|---|---|
| `settings` | shop නම, logo, tax, categories, brands |
| `staff` | staff / devices ගේ approval, role, status |
| `items`, `variants` | inventory (item, size, colour, SKU, barcode, stock, photos, hidden) |
| `label_jobs` | barcode labels print කරන්න තෝරපු ඒවා |
| `sales` | bills (re-edit bills ඇතුළුව) |
| `refunds`, `credit_notes` | refunds සහ credit notes |
| `customers`, `qr_registrations` | customers (WhatsApp / QR app) |
| `qr_orders` | QR menu එකෙන් එන orders |
| `offers`, `offer_notes` | offers සහ customers ට යවපු notifications |

## පියවර 3 — Login settings (Supabase dashboard එකේ එක් වතාවක් විතරයි)

Staff ලා ගේ accounts **app එකෙන්ම** හැදෙන නිසා Supabase dashboard එකේ user හදන්න ඕන නැහැ.

1. **Authentication → Sign In / Providers** (හෝ **Providers → Email**).
2. **"Allow new users to sign up"** = **ON**.
3. **"Confirm email"** = **OFF** (නැත්නම් හැම අලුත් device එකකටම email එකක් confirm කරන්න වෙනවා).
4. Save.

## පියවර 4 — 🔐 ආරක්ෂාව (මෙහෙමයි වැඩ කරන්නේ)

- Sign-ups ON වුණාට, **අලුත් account එකකට / අලුත් device එකකට කිසිම දත්තයක් පෙනෙන්නේ නැහැ** — Admin approve කරනකල් (`update-3.sql` එකේ database rules නිසා). **එකම email + password එක වෙන device එකකින් දැම්මත් ඒ device එකට අලුතින් approve කරන්න ඕන.**
- **පළමුවෙන්ම request කරන කෙනා Admin** වෙනවා. ඒ නිසා **site එක deploy කරපු ගමන්ම, වෙන කිසිවෙක් දැනගන්න කලින්, ඔයා ඉස්සෙල්ලා account එක හදාගන්න** (පියවර 9).
- ඊට පස්සේ එන හැම device එකක්ම / කෙනෙක්ම **pending**. ඔයා (Admin) **Settings → 👥 Staff & devices** වලින් හැම device එකකටම **Job role** (Admin / Cashier / Stock Keeper), **ඒ device එකට open කරන්න පුළුවන් pages** (tick boxes) තෝරලා **Approve** කරන්න, පස්සේ **edit**, **Remove**, **🗑 Delete** කරන්න පුළුවන්.
- Remove කළාම ඒ device එක තත්පර 20ක් ඇතුළත ඉබේම ඇතුළට යන්න බැරි වෙනවා.

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

**Admin (ඔයා) — පළමුවෙන්ම:**
1. Site එක open කරන්න → **"New device? Request access"** ඔබන්න.
2. ඔයාගේ **නම, username (ඕන නම්), email, password (අකුරු 6+)** දාලා **Create account & request access**. ඔයා තමයි පළමු කෙනා නිසා **ඉබේම Admin + approved**, ඇතුළට යනවා.
3. **Settings** → shop නම, logo, tax දාන්න. **Inventory** එකට categories / brands / items දාන්න.

**අනිත් අය (cashier, stock keeper):**
1. ඒ device එකෙන් site එක open කරලා **Request access** → නම, email, password.
2. "⏳ Waiting for admin approval" කියලා පෙනෙනවා.
3. ඔයා (Admin) **Settings → Staff & devices** එකේ ඒ අයව **Approve** කරලා **role** එක තෝරන්න (🔔 පණිවිඩයකුත් එනවා).
4. ඒ device එක ඉබේම ඇතුළට යනවා.

පසුව: **Sign in** (**email හෝ username** + password). Refresh කළත් sign in එක මතකයි, **⎋ Sign out** ඔබනකල් ඉන්නවා.

## පියවර 10 — QR ordering

1. **QR Ordering** tab → **QR** බොත්තම → **⬇ Download QR** → print කරලා කඩේට ගහන්න.
2. Customer ගේ phone එකේ QR scan → `https://....pages.dev/menu.html` (Customer app) → ඇණවුම් කරන්න, register වෙන්න, app එක install කරන්න පුළුවන්.
3. Order එක ඔයාගේ **QR Ordering** page එකට **ඒ ගමන්ම** එනවා (🔔 පණිවිඩයක් සමඟ).
4. Offers: Customers tab → Offers → WhatsApp / QR customers ට යවන්න. Customer register වුණාම ඒ phone number එකට අදාල offer image + items QR menu එකේ පෙනෙනවා.

## පසුව වෙනස්කම් කරන්න

GitHub එකේ file එක edit කරලා **Commit** කළාම Cloudflare ඉබේම අලුත් version එක deploy කරනවා.

---

## දැනගන්න ඕන දේවල්

- **Roles:** Admin = සියල්ල + Staff & devices. Cashier = POS, Orders, Refunds, Customers, Labels. Stock Keeper = Inventory, Labels. දත්ත database එකට ඇතුළු වෙන්න පුළුවන්කම (approve කළාද නැද්ද) **database එකෙන්ම** පාලනය වෙනවා; role අනුව tab මොනවාද කියන එක app එක ඇතුළේ පාලනය වෙනවා.
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
| Sign in වෙන්න බැහැ | Request access කරලා Sign in වෙන්න. "Confirm email" OFF කළාද (පියවර 3) බලන්න |
| "Cannot check access" | **update-2.sql** run කළාද බලන්න |
| Admin කෙනෙක් නැති වුණා (අහම්බෙන් Remove) | Supabase **Table Editor → staff** එකේ ඒ row එකේ `status`=approved, `role`=A කරන්න |


---

## 🆕 Update 1 හි අලුත් දේවල්

- **Bill එකේ discount / qty / price** — ඇතුළත් කරන ගමන්ම ගණන් වෙනස් වෙනවා (වෙන තැනක් click කරන්න ඕන නැහැ).
- **Refresh කළත් sign in එක මතකයි** — **⎋ Sign out** ඔබනකල් ඉන්නවා.
- **වෙනත් device වල වෙනස්කම් ඉබේම පෙනෙනවා** — bills, orders, stock, QR orders ආදිය සමාන්තරව refresh වෙනවා (QR orders තත්පර 10කට වතාවක්, අනිත් දත්ත තත්පර 30කට වතාවක් check කිරීම). ඔයා type කරමින් ඉන්න වෙලාවේ page එක refresh කරන්නේ නැහැ.
- **QR orders workflow:** `New → Confirm / Reject → Preparing → Order ready → Complete order`.
  - **Confirm** කළාම ඒ order එකෙන් **bill එකක් හැදිලා Orders tab එකේ save වෙනවා**, stock අඩු වෙනවා, bill එක print / WhatsApp කරන්න පුළුවන්.
  - **Complete** / **Rejected** orders පැය 24ක් වෙනම කොටසක පෙනෙනවා, ඊට පස්සේ ලැයිස්තුවෙන් ඉබේම අයින් වෙනවා.
- **Customer app (QR):** items search, category pills, stock පෙන්වීම (stock 0 නම් අඳුරුයි, තෝරන්න බැහැ), **payment choice** (Cash on delivery / Bank transfer · delivery / Shop visit), delivery address, **"My orders"** status, සහ status වෙනස් වුණාම notification (browser එක open ඉන්න අතරතුර; permission දුන්නොත් browser notification එකකුත්).
- Order මිල **server එකෙන්ම** ගණන් කරනවා (offer මිල සහ stock පරීක්ෂා කරලා), ඒ නිසා customer ට මිල වෙනස් කරන්න බැහැ.

> **තාම නැති දේවල් (Update 2):** device approval (admin approve කරන ලොගින්), customer app එකේ offers slider / dark mode / භාෂා / profile history / app install (PWA) / background push notification.


---

## 🆕 Update 2 — Staff & device approval

- Staff accounts **app එකෙන්ම** හැදෙනවා ("Request access"). Supabase dashboard එකට යන්න ඕන නැහැ.
- **Admin approve කරනකල්** අලුත් device එකකට කිසිම දත්තයක් පෙනෙන්නේ නැහැ (database එකෙන්ම පාලනය).
- Admin: **Settings → Staff & devices** → Approve / Role / Remove / Delete. Settings page එක Admin ට විතරයි.
- PIN login අයින් කළා. දැන් අලුත් device එකකින් email + password, ඊට පස්සේ Admin approve.


---

## 🆕 Update 3 — Device approval + table-by-table roles + username login

- **Device එකකට එකක් approval:** එකම account එක (email + password) වෙන browser / phone එකකින් දැම්මත් **ඒ device එක "pending"**. Admin (approved Admin device එකකින්) **Settings → Staff & devices** එකේ ඒක **Approve** කරන්න ඕන. එතනදීම **Job role** සහ **ඒ device එකට open කරන්න පුළුවන් pages** තෝරන්න, පස්සේ ඕන වෙලාවක edit / remove කරන්න.
- **Role rules database එකෙන්ම (table by table):**

| Table | Admin | Cashier | Stock keeper |
|---|---|---|---|
| sales (bills), refunds, credit notes, customers, QR orders | ✅ | ✅ | ⛔ |
| items | ✅ | කියවීම පමණයි (Refund කරද්දී "Sale items" හැදීම විතරයි) | ✅ |
| variants (size/colour/stock) | ✅ | ✅ (විකුණද්දී stock අඩුවෙන නිසා) | ✅ |
| settings (shop, categories, brands) | ✅ | කියවීම පමණයි | ✅ |
| offers, offer notes, QR registrations | ✅ | කියවීම පමණයි | ⛔ |
| barcode labels queue | ✅ | ✅ | ✅ |
| devices (Staff & devices) | ✅ | ⛔ | ⛔ |

- **Username + password:** Account හදද්දී username එකක් දෙන්න පුළුවන්. Sign in වෙද්දී **email හෝ username** දෙකෙන් එකක් + password. (Supabase එකට email එකක් අනිවාර්යයි, ඒක account එක හදද්දී විතරක් ඕන. username එක දැක්කාම email එක හොයාගන්නේ database function එකකින්, ඒ නිසා අනුන්ට username දන්නවා නම් ඒකට අදාල email එක දැනගන්න පුළුවන් — කුඩා කඩයකට ප්‍රශ්නයක් නෙවෙයි, ඒත් දැනගෙන ඉන්න.)
- **පළමුවෙන්ම Update 2 පාවිච්චි කළ Admin account එක:** update-3 පස්සේ ඒ account එකේ **පළමු device එක** ඉබේම Admin + approved වෙනවා. ඊට පස්සේ එන ඕනම device එකක් pending.

> **සැලකිය යුතුයි:** Realtime (WebSocket) database එකට device id එක යවන්න බැරි නිසා ඒක අයින් කරලා, QR orders තත්පර 10කට වතාවක් check කරනවා. ඒ කියන්නේ ඇණවුම පෙනෙන්න තත්පර 10ක් විතර යන්න පුළුවන්.


---

## 🆕 Update 4 — Customer app (menu.html) + responsive

**Customer app** (`menu.html`) — QR එකෙන් open වෙන වෙනම app එකක්. Phone, tablet, desktop හැමදේකම හරියට පෙනෙනවා.

- **Offers slider** — උඩින් offers ස්වයංක්‍රීයව ලිස්සනවා (තත්පර 4½ ට වතාවක්). Click කළාම ඒ offer එකේ items විතරක් පෙනෙනවා, offer මිල (සැබෑ මිල කැඩුණු ඉරකින්) එක්ක.
- **Items category වලින්** — Category pills + **search**. Item එකක් click කළාම: **Size → Colour** තෝරන්න (හැම colour එකකම photo + stock ගණන), ගණන තෝරලා **Add to cart**. **Stock නැති item / size / colour තෝරන්න බැහැ** (අඳුරුවෙලා), stock අලුත් වුණාම ඉබේම නැවත සක්‍රිය වෙනවා (තත්පර 15කට වතාවක් refresh).
- **Cart → Order:** Cash on delivery / Bank transfer · delivery / Shop visit, delivery address. මිල server එකෙන් ගණන් වෙනවා.
- **Profile (👤):** Register (නම + phone), **මගේ ඇණවුම්** (status progress bar එකක් එක්ක), **මිලදී ගත් ඉතිහාසය** (shop එකේ bills ඇතුළුව, phone number එකෙන් ගැළපෙන), notifications on කරන්න, **Share link**, **Log out**.
- **Notifications:** ඇණවුම Confirmed / **Ready** / Completed / Rejected වුණාම ඒ ගමන් දැනුම්දීමක්. (Phone එකේ app එක open ඉන්න / background එකේ තියෙන අතරතුර.)
- **Dark mode** සහ **භාෂා තුන** (English / සිංහල / தமிழ்) — customer ට තමන්ටම මාරු කරන්න පුළුවන්, මතක තියාගන්නවා.
- **Install (PWA):** Android Chrome වල "📲 Install" බොත්තම ඉබේම පෙනෙනවා (browser එක ඉඩ දුන්නොත්). iPhone වල "Share → Add to Home Screen" උපදෙස පෙනෙනවා. Install වුණාම app එකක් වගේ full screen.

**POS (staff) — phone / tablet / desktop:**
- **Desktop / laptop:** වම් sidebar, POS එකේ items + බිල පැත්තකින් පැත්තකට.
- **Tablet:** items සහ බිල ඉඩ අනුව එකම පේළියේ / යටින්.
- **Phone:** tabs **යටින් තියෙන bar** එකක් (අතින් ඇඟිල්ලෙන් ලේසියෙන් ඇදගන්න), POS එකේ **යටින් "🧾 බිල ↓" bar එකක්** (items ගණන + මුදල, ඔබපුවාම බිලට යනවා), input අකුරු ලොකු (zoom වෙන්නේ නැහැ), බොත්තම් ඇඟිල්ලට ගැළපෙන ලොකුකම, වගු දකුණට ඇදලා බලන්න පුළුවන්.

> **සැලකිය යුතුයි:**
> - Customer app එකේ **photos database එකේම** තියෙනවා (resize කරලා). Items 100කට වඩා photos එක්ක තියෙනවා නම් මුල් load එක ටිකක් සෙමින් වෙන්න පුළුවන්. ඒ වෙලාවට Supabase **Storage** එකට මාරු කරන්න වෙනවා.
> - **Background push** (app එක සම්පූර්ණයෙන් වසලා තිබුණත් එන notification) සඳහා server එකක් (Supabase Edge Function + Web Push keys) ඕන. දැන් notifications එන්නේ app එක open / background එකේ තියෙන අතරතුර.
> - Install වෙන app එකේ **නම "Clothing Shop"** (manifest එකේ). ඔයාගේ shop නම ඒකට දාන්න `manifest.webmanifest` එකේ `name` සහ `short_name` වෙනස් කරන්න. Icon එකත් `icons/` එකේ ඔයාගේ logo එකෙන් මාරු කරන්න පුළුවන් (192 සහ 512 PNG).
