# MHNK Police Department — เว็บระบบกรมตำรวจ

เว็บจัดการกำลังพลของ **MHNK Police Department** (FiveM Server — Mahahorn Diwa)
ใช้ **Google Sheets เป็นฐานข้อมูล** (ไม่ต้องมี database server แยก), ยืนยันตัวตนด้วย
**Discord**, และแจ้งเตือนทีมงานผ่าน **Discord Webhook**

Stack: **Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Elysia**

---

## 🚀 เริ่มรันในเครื่อง

```bash
npm install
```

```bash
npm run dev
```

เปิด http://localhost:3000 — ต้องมีไฟล์ `.env` ก่อน (ดูหัวข้อ [ตัวแปรสภาพแวดล้อม](#️-ตัวแปรสภาพแวดล้อม))

---

## 🗺️ หน้าเว็บมีอะไรบ้าง

| หน้า | URL | ใครเข้าได้ | ทำอะไร |
|---|---|---|---|
| หน้าแรก | `/` | ทุกคน | รายชื่อเจ้าหน้าที่ · การทำคดี · ข้อปฏิบัติ · กฎตำรวจ · ค่าปรับ · ตารางเวร |
| ประวัติเจ้าหน้าที่ | `/profile?name=…` | ทุกคน (ดู) | สถิติรายสัปดาห์, ตารางเวร, **ยืนยันการจ่ายเงิน** (เฉพาะแอดมิน) |
| ข้อปฏิบัติ | `/regulation` | ทุกคน | หน้าข้อปฏิบัติแบบอ่านอย่างเดียว |
| สมัครตำรวจ | `/register` | ทุกคน | กรอกใบสมัคร (ต้องเชื่อม Discord) · แก้ไขใบเดิมได้ |
| สมัครแพทย์ | `/medical` | ทุกคน | เหมือนด้านบน แต่เป็นหน่วยแพทย์ |
| ศูนย์รวมระบบตำรวจ | `/police` | **แอดมิน** | ทางเข้ารวม 4 หน้าด้านบน/ล่าง |
| จัดการสถานะสมาชิก | `/rostermanage` | **แอดมิน** | เปลี่ยนสถานะ / ย้ายคนออกจากระบบ |
| Proctor | `/proctor` | **Proctor** | ตรวจและอนุมัติใบสมัคร |

> แท็บ **กฎตำรวจ** บนหน้าแรกเป็นปุ่มลิงก์ออกไปที่หน้ากฎของเมืองบน Google Sites
> ไม่ได้เก็บเนื้อหากฎไว้ในเว็บนี้

---

## 🔐 สิทธิ์แอดมินทำงานยังไง

**ไม่มีรหัส PIN แล้ว** — ทุกอย่างดูจาก **Discord ID ที่อยู่ในรายชื่อในชีต**

ข้อดีคือรู้ว่าใครเป็นคนทำอะไร (ระบบจะ log Discord ID ของคนที่แก้กฎ/กดจ่ายเงินไว้)
และถอนสิทธิ์ใครก็แค่ลบ ID ออกจากชีต ไม่ต้องเปลี่ยนรหัสแล้วไล่บอกทุกคนใหม่

| รายชื่อ | เก็บที่ไหนในชีต | คุมอะไร |
|---|---|---|
| `ROSTERMANAGE_IDDC` | แท็บ `NamePD` — ช่อง **AA2** เขียนชื่อสิทธิ์, ช่อง **AB2** ใส่ Discord ID | โหมดแก้ไขหน้าแรก (ข้อปฏิบัติ/ค่าปรับ), ยืนยันจ่ายเงิน, `/police`, `/rostermanage` |
| `PROCTOR_IDDC` | แท็บ `Pending` — ช่อง **L1** / **M1** | `/proctor` |

ใส่ Discord ID หลายคนได้ คั่นด้วยอะไรก็ได้ (คอมมา, เว้นวรรค, ขึ้นบรรทัดใหม่) และก๊อป
แบบ `<@123…>` มาวางก็ได้

### ⚠️ ข้อควรระวัง

- **ห้ามย้ายช่อง AA2/AB2** — ถ้ามีคนแทรกแถวจนค่าเลื่อน ระบบจะอ่านสิทธิ์ไม่เจอ
- **ควรตั้ง `ROSTERMANAGE_IDDC` ใน Environment Variables ไว้เป็นกุญแจสำรองด้วย** —
  ถ้าช่องในชีตพัง จะยังมีทางเข้าไปแก้ได้ ไม่งั้นจะล็อกตัวเองออกถาวร
- ถ้า **Discord ล่ม** จะไม่มีใครเข้าโหมดแอดมินได้เลย (แลกมากับการรู้ว่าใครทำอะไร)

---

## ⚙️ ตัวแปรสภาพแวดล้อม

คัดลอก `.env.example` เป็น `.env` แล้วกรอกค่า — รายละเอียดแต่ละตัวอยู่ในไฟล์นั้น

| ตัวแปร | จำเป็น |
|--------|--------|
| `SHEET_ID`, `CASES_SHEET_ID`, `RULES_SHEET_ID` | ✅ |
| `GOOGLE_JSON_KEY` (service-account JSON ทั้งก้อน บรรทัดเดียว) | ✅ |
| `APP_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | ✅ |
| `DISCORD_REGISTER_WEBHOOK_URL`, `DISCORD_MEDICAL_WEBHOOK_URL`, `DISCORD_PROCTOR_WEBHOOK_URL`, `DISCORD_OUTPD_WEBHOOK_URL` | ✅ |
| `ROSTERMANAGE_IDDC`, `PROCTOR_IDDC` | 🔶 กุญแจสำรอง (แนะนำให้ตั้ง) |
| `CASES_DATA_SHEET_ID`, `PENDING_SPREADSHEET_ID`, `ROSTER_SHEET_ID`, `PENDING_SHEET_NAME`, `PORT` | 🔶 มีค่า default |

**⚠️ Discord OAuth ต้องตรงกัน 3 จุด** ไม่งั้น login จะล้มเหลวแบบเงียบ ๆ:

1. ค่า `APP_URL`
2. โดเมนจริงที่เสิร์ฟเว็บ
3. Redirect URI ที่ลงทะเบียนใน Discord Developer Portal

ต้องเหมือนกันตัวต่อตัว รวมถึง `www` กับ apex domain ด้วย

---

## 📦 Deploy บน DirectAdmin (Node.js Selector) — วิธีหลัก

**⚠️ ต้อง build บนเครื่องตัวเองเสมอ** อย่า build บนโฮสต์ เพราะ `next build` กินแรมสูง
เกินกว่าโฮสต์ปันส่วนจะรันไหว

```bash
npm run build
```

```bash
npm run package
```

คำสั่ง `package` จะเติม `.next/static` กับ `public/` เข้าไปใน `.next/standalone`
(ปกติ `next build` ไม่ใส่มาให้ เพราะบน Vercel มี CDN เสิร์ฟแทน — **ข้ามขั้นนี้แล้วเว็บ
จะขึ้นแบบไม่มี CSS และโลโก้จะ 404**) พร้อมลบไฟล์ `.env` ที่ถูกแอบรวมเข้าไปในบันเดิล
(มี secret จริงติดไปด้วย) ออกให้อัตโนมัติ

จากนั้น:

1. อัปโหลดทุกอย่างใน `.next/standalone/` ขึ้นโฮสต์
   (ไม่ต้องอัปโหลด `node_modules` หรือซอร์ส — บันเดิลพกไลบรารีที่ใช้จริงมาครบแล้ว)
2. DirectAdmin → **Node.js Selector** → สร้างแอปชี้ไปโฟลเดอร์ที่อัปโหลด
   - Startup file: `server.js`
   - Node version: 20.x ขึ้นไป
   - **ไม่ต้อง**กด "Run NPM Install"
3. ตั้ง **Environment Variables** ในหน้า Node.js Selector ให้ครบตามตารางด้านบน
   (ห้ามอัปโหลดไฟล์ `.env` ที่มี secret จริงขึ้นไป)
4. กด **Restart** แล้วตรวจว่า CSS/โลโก้ขึ้นครบ และกดล็อกอิน Discord ได้

> **ถ้าขึ้น `GOOGLE_JSON_KEY is not valid JSON`:** โฮสต์ตัดค่ายาว ๆ ที่ช่องว่างแรก
> ให้เว้น `GOOGLE_JSON_KEY` ว่างไว้ แล้วใช้ `GOOGLE_APPLICATION_CREDENTIALS` ชี้ไปที่
> ไฟล์ JSON ที่วางไว้**นอก**โฟลเดอร์ที่เสิร์ฟเว็บแทน

---

## ▲ ทางเลือก: Deploy บน Vercel

Vercel ตรวจจับ Next.js ให้เอง ไม่ต้องตั้ง Build Command — import repo, ตั้ง
Environment Variables ตามตารางด้านบน, ตั้ง `APP_URL` เป็นโดเมนจริง แล้ว deploy ได้เลย

> **หมายเหตุ:** cache, idempotency key และ rate limit เก็บในหน่วยความจำของแต่ละ
> instance เท่านั้น — serverless ไม่มี disk ที่หลาย instance เขียนร่วมกันได้

---

## 🧑‍💻 คำสั่งสำหรับพัฒนา

```bash
npm run dev        # รันเซิร์ฟเวอร์ dev (auto-reload)
npm run build      # build — รันก่อนสรุปว่างานพร้อม deploy
npm run typecheck  # เช็คชนิดข้อมูล — ตัวที่เร็วที่สุด
npm run lint       # ESLint
npm run package    # ประกอบ .next/standalone สำหรับ self-host
```

**ไม่มี test suite** — `typecheck`, `lint` และการ build คือการตรวจสอบอัตโนมัติทั้งหมดที่มี
ควรรันให้ครบทั้งสามก่อน deploy

> **เจอ `Cannot find module for page: /x` ตอน build?** เป็นอาการหลอกจากโฟลเดอร์ `.next`
> ที่ค้างอยู่ ให้ปิด dev server → ลบโฟลเดอร์ `.next` → build ใหม่

---

## 🗂️ โครงสร้างโปรเจกต์

```
├── app/                      # หน้าเว็บ (Next.js App Router)
│   ├── api/[[...slugs]]/     # Elysia ทั้งก้อน mount เป็นฟังก์ชันเดียว
│   ├── auth/discord/         # Discord OAuth login + callback
│   ├── page.tsx              # หน้าแรก (6 แท็บ)
│   ├── profile/              # ประวัติเจ้าหน้าที่ + จ่ายเงิน
│   ├── police/               # ศูนย์รวมระบบตำรวจ
│   ├── register/ medical/    # ใบสมัครตำรวจ / แพทย์
│   ├── proctor/              # แอดมิน: ตรวจใบสมัคร
│   ├── rostermanage/         # แอดมิน: จัดการสถานะสมาชิก
│   ├── regulation/           # ข้อปฏิบัติ (อ่านอย่างเดียว)
│   ├── not-found.tsx         # หน้า 404
│   └── globals.css           # Design token ของ Tailwind v4
├── server/                   # Backend (Elysia)
│   ├── app.ts                # รวม route ทั้งหมด + จัดการ error
│   ├── config.ts             # อ่านค่าจาก environment
│   ├── routes/               # roster, rules, admin, registration, pending, rosterAdmin
│   └── services/             # Google Sheets, cache, Discord, สิทธิ์, session, จ่ายเงิน
├── components/               # React components
│   ├── ui/                   # ปุ่ม, modal, toast, แถบสถานะ Discord
│   ├── views/                # 6 แท็บของหน้าแรก
│   ├── profile/              # ตัวเลือกสัปดาห์, สถิติ, จ่ายเงิน
│   ├── forms/                # ใบสมัคร, แผงแอดมิน, Discord gate
│   └── admin/                # ฟอร์มเพิ่ม/แก้/ลบ ข้อปฏิบัติกับค่าปรับ
├── lib/                      # โค้ดใช้ร่วม
│   ├── client/               # typed API client, hook, สถานะแอดมิน
│   ├── types.ts format.ts    # โครงข้อมูล / จัดรูปแบบ
│   └── sanitize.ts           # กรอง HTML จากชีต กัน XSS
├── public/logo.webp
├── data/schedule.json
└── scripts/package-standalone.mjs
```

### ทำไม Elysia ถึงรันอยู่ใน Next.js แทนที่จะแยกเซิร์ฟเวอร์

Elysia ปกติออกแบบมาให้รันบน Bun แต่ Vercel serverless เป็น Node — ที่นี่จึง mount ผ่าน
`api.handle(request)` แทน `.listen()` เพราะทั้งคู่รับ-คืนค่าเป็น `Request`/`Response`
มาตรฐานตัวเดียวกัน ไม่ต้องมี Bun และทั้งแอป deploy เป็น Next.js project เดียวได้

ผลพลอยได้คือ **Eden Treaty**: client ฝั่งหน้าเว็บได้ชนิดข้อมูลตรงจากเซิร์ฟเวอร์อัตโนมัติ
— เปลี่ยนชื่อ route แล้ว **compile error ทันที** แทนที่จะไปพังเป็น 404 ตอนผู้ใช้กดจริง

---

## 🔒 ความปลอดภัย

- **สิทธิ์แอดมินผูกกับบัญชี Discord จริง** ไม่ใช่รหัสที่ใช้ร่วมกัน — รู้ว่าใครทำอะไร และ
  ถอนสิทธิ์รายคนได้ทันที (อ่านรายชื่อผ่าน Sheets API ไม่ใช่ CSV export ที่ติด CDN cache
  ไม่งั้น ID ที่เพิ่งลบจะยังใช้ได้อีกหลายนาที)
- **Session cookie เป็นแบบ HttpOnly + ลงลายเซ็น** — หน้าเว็บอ่านหรือปลอมเองไม่ได้
- **Rate limiting** บน `/register` และ `/medical` (10 ครั้ง/นาที ต่อ IP)
- **กรอง HTML จากชีต** (`lib/sanitize.ts`) — escape ทุกอย่างก่อนแล้วค่อยปลดล็อกเฉพาะ
  แท็กที่อนุญาต กัน XSS จากข้อความที่พิมพ์ลงใน Google Sheets
- **Idempotency key ตอนจ่ายเงิน** — request timeout แล้วกดซ้ำจะไม่จ่ายซ้ำ

---

## 🔗 API หลัก

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/api/officers`, `/api/weeks`, `/api/week-data`, `/api/week-top10` | ข้อมูลกำลังพล/รายสัปดาห์ |
| GET | `/api/rules-data/:type` (`conduct`/`rules`/`fines`/`cases`) | อ่านข้อปฏิบัติ/กฎ/ค่าปรับ/คดี |
| POST/PUT/DELETE | `/api/rules-data/:type` | เพิ่ม/แก้/ลบ (แอดมินเท่านั้น) |
| POST | `/api/mark-paid` · GET `/api/mark-paid/status` | จ่ายเงินรายสัปดาห์ (กันจ่ายซ้ำ) |
| POST/PATCH/GET | `/api/register`, `/api/medical` | ส่ง/แก้ไข/ดึงใบสมัคร |
| GET/POST | `/api/pending/access`, `/api/pending`, `/api/pending/approve/:row`, `/api/pending/reject/:row` | แผงตรวจใบสมัคร |
| GET/POST/PUT | `/api/roster/access`, `/api/roster/namepd`, `/api/roster/outdc`, `/api/roster/status/:row`, `/api/roster/move-out/:row` | จัดการสถานะสมาชิก |
| POST | `/api/discord/logout` | ออกจากระบบ Discord |
| GET | `/auth/discord`, `/auth/discord/callback` | Discord OAuth |

---

## 📝 หมายเหตุสำคัญ

- **คอลัมน์ในชีตอ้างอิงตาม "ตำแหน่ง" ไม่ใช่ชื่อหัวคอลัมน์** — สลับหรือแทรกคอลัมน์แล้ว
  ข้อมูลจะไปลงผิดช่องแบบ**ไม่มี error แจ้ง** (ดูคอมเมนต์ใน `server/services/csv.ts`
  และ `sheets.ts` ก่อนแก้ชีต)
- **Google Sheets อ่านไม่ทันที่ตัวเองเพิ่งเขียน** — CSV export ติด CDN cache ประมาณ
  15 วินาที เว็บจึงจำไว้เองว่าสัปดาห์ไหนเพิ่งจ่ายไป ไม่งั้นจะเด้งกลับเป็น "ยังไม่จ่าย"
- **ข้อความ Discord คือ record ตัวจริงของใบสมัคร** — การแก้ใบสมัครคือการอ่าน embed เดิม
  กลับมาแก้ ไม่ได้แก้จากในชีต
- พัฒนาสำหรับ **FiveM Server — MHNK Police Department** โดยเฉพาะ

> 📄 รายละเอียดเชิงลึกสำหรับคนที่จะเข้ามาแก้โค้ด (เหตุผลเบื้องหลังการออกแบบ, กับดักที่
> เคยเจอมาแล้ว) อยู่ในไฟล์ [`CLAUDE.md`](./CLAUDE.md)
