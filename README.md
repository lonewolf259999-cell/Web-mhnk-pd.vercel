# MHNK Police Department Web System

ระบบจัดการข้อมูลเจ้าหน้าที่ตำรวจ: รายชื่อ/คดี/ข้อปฏิบัติ/กฎ/ค่าปรับ/ตารางเวร, ประวัติ
รายบุคคลพร้อมสรุปยอดเงินรายสัปดาห์, สมัครตำรวจ/หน่วยแพทย์ผ่าน Discord, และแผงแอดมิน
สำหรับอนุมัติใบสมัคร/จัดการสถานะสมาชิก. ฐานข้อมูลหลักคือ Google Sheets (ไม่ต้องมี
database server แยก), ยืนยันตัวตนผ่าน Discord OAuth, แจ้งเตือนผ่าน Discord Webhook.

Stack: **Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Elysia**

---

## ⚙️ ตัวแปรสภาพแวดล้อม (Environment Variables)

คัดลอก `.env.example` เป็น `.env` แล้วกรอกค่า (รายละเอียด/ค่าเริ่มต้นแต่ละตัวดูในไฟล์
นั้นโดยตรง — เป็นแหล่งอ้างอิงเดียวที่ต้องอัปเดตคู่กับ `server/config.ts`):

| ตัวแปร | จำเป็น |
|--------|--------|
| `SHEET_ID`, `CASES_SHEET_ID`, `RULES_SHEET_ID` | ✅ |
| `ADMIN_PIN` | ✅ |
| `GOOGLE_JSON_KEY` (service-account JSON ทั้งก้อน บรรทัดเดียว) | ✅ |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | ✅ |
| `APP_URL` | ✅ |
| `DISCORD_REGISTER_WEBHOOK_URL`, `DISCORD_MEDICAL_WEBHOOK_URL`, `DISCORD_PROCTOR_WEBHOOK_URL`, `DISCORD_COUNCIL_WEBHOOK_URL`, `DISCORD_OUTPD_WEBHOOK_URL` | ✅ |
| `CASES_DATA_SHEET_ID`, `PENDING_SPREADSHEET_ID`, `ROSTER_SHEET_ID`, `PENDING_SHEET_NAME`, `PORT` | 🔶 มีค่า default |

**Discord OAuth ต้องตรงกันทุกจุด:** `APP_URL`, โดเมนจริงที่เสิร์ฟเว็บ, และ redirect URI
ที่ลงทะเบียนใน Discord Developer Portal ต้องเหมือนกันตัวต่อตัว (รวมถึง `www` กับ apex
domain) ไม่งั้น login จะเงียบ ๆ ล้มเหลว

---

## 📦 Deploy บน DirectAdmin (Node.js Selector) — วิธีหลัก

1. **Build บนเครื่อง local ก่อนเสมอ** — อย่า build บนโฮสต์ปันส่วน เพราะ `next build`
   กินแรมสูงและแพ็กเกจโฮสต์ปันส่วนมักมีแรมจำกัดเกินกว่าจะ build ผ่าน:
   ```bash
   npm install
   npm run build
   npm run package
   ```
   คำสั่งสุดท้ายจะเติม `.next/static` และ `public/` เข้าไปใน `.next/standalone`
   (สองโฟลเดอร์นี้ปกติ `next build` ไม่ใส่มาให้ เพราะบน Vercel มี CDN เสิร์ฟแทน — ถ้าข้าม
   ขั้นตอนนี้เว็บจะขึ้นแต่ไม่มี CSS/JS และโลโก้จะ 404) และลบ `.env` ที่ `next build`
   แอบรวมเข้าไปในบันเดิล (มีค่า secret จริงติดไปด้วย) ออกให้อัตโนมัติ
2. อัปโหลดเนื้อหาทั้งหมดใน `.next/standalone/` ขึ้น DirectAdmin (ไม่ต้องอัปโหลด
   `node_modules` หรือ source เดิม — บันเดิลนี้พกไลบรารีที่ใช้จริงมาให้ครบแล้ว)
3. ใน DirectAdmin → **Node.js Selector**: สร้างแอปใหม่ชี้ไปที่โฟลเดอร์ที่อัปโหลด
   - Startup file: `server.js`
   - Node version: 20.x ขึ้นไป
   - ไม่ต้องกด "Run NPM Install" — dependencies ถูกรวมมาแล้ว
4. ตั้งค่า **Environment Variables** ในหน้า Node.js Selector ให้ครบตามตารางด้านบน
   (ห้ามอัปโหลดไฟล์ `.env` ที่มี secret จริงขึ้นไปกับซอร์ส — ตั้งผ่านช่องนี้แทน)
5. กด **Restart** แอป แล้วตรวจว่าหน้าเว็บขึ้น CSS/รูปครบและ `/auth/discord` login ได้

---

## ▲ ทางเลือก: Deploy บน Vercel

Vercel ตรวจจับ Next.js ให้อัตโนมัติ ไม่ต้องตั้งค่า Build Command เอง — import repo,
ตั้ง Environment Variables ตามตารางด้านบน, ตั้ง `APP_URL` เป็นโดเมนจริง แล้ว deploy

> **หมายเหตุ:** cache และ idempotency-key store ในหน่วยความจำอยู่กับแต่ละ instance
> เท่านั้น (`server/services/cache.ts`, `paymentStore.ts`, `server/rateLimit.ts`) —
> serverless ไม่มี disk ที่เขียนร่วมกันได้ระหว่างหลาย instance

---

## 🧑‍💻 คำสั่งสำหรับพัฒนา

```bash
npm run dev        # next dev — มี auto-reload
npm run build      # next build — รันก่อนสรุปว่างานพร้อม deploy
npm run typecheck  # tsc --noEmit — ตัวเช็คความถูกต้องที่เร็วที่สุด
npm run lint       # eslint . — flat config in eslint.config.mjs
npm run package    # ประกอบ .next/standalone สำหรับ self-host (ดูหัวข้อ DirectAdmin)
```

ไม่มี test suite — `typecheck`, `lint` และการ build คือการตรวจสอบอัตโนมัติที่มี

`lint` เรียก ESLint CLI ตรง ๆ ไม่ใช่ `next lint` (ซึ่งเลิกใช้แล้วใน Next 15 และถูกถอดออกใน 16)
ตั้งค่าอยู่ใน `eslint.config.mjs` และ `eslint-config-next` ถูกล็อกให้เป็นเวอร์ชันหลักเดียวกับ `next`

---

## 🗂️ โครงสร้างโปรเจกต์

```
Web-Mhnk/
├── app/                      # Next.js App Router
│   ├── api/[[...slugs]]/     # Elysia mounted as one catch-all function
│   ├── auth/discord/         # OAuth login + callback (plain route handlers)
│   ├── profile/              # หน้าข้อมูลเจ้าหน้าที่ + จ่ายเงิน
│   ├── register/              # สมัครตำรวจ
│   ├── medical/               # สมัครหน่วยแพทย์
│   ├── proctor/                # Admin: ตรวจใบสมัคร
│   ├── rostermanage/           # Admin: จัดการสถานะสมาชิก
│   ├── regulation/             # ข้อปฏิบัติเจ้าหน้าที่ (อ่านอย่างเดียว)
│   ├── layout.tsx              # Root layout (fonts, background effects)
│   ├── page.tsx                # Main SPA (roster/cases/conduct/rules/fines/schedule)
│   └── globals.css             # Tailwind v4 @theme design tokens
├── server/                   # Elysia backend (TypeScript)
│   ├── app.ts                 # Root instance + error handling; exports type Api
│   ├── config.ts               # Environment configuration
│   ├── errors.ts                # ApiError + PIN guard (constant-time + lockout)
│   ├── rateLimit.ts             # Instance-local fixed-window rate limiter
│   ├── routes/                  # roster, rules, admin, registration, rosterAdmin
│   └── services/                 # Google Sheets, cache, CSV, Discord, payment store
├── components/                # React components
│   ├── ui/                      # States, modals, toasts
│   ├── views/                    # Roster, Cases, Rules, Fines, Schedule
│   ├── profile/                   # Week selector, stats, payment flow
│   └── forms/                      # Register, Medical, Proctor, Roster admin
├── lib/                        # Shared code
│   ├── client/                    # Eden typed client, queries, fetch hook
│   ├── types.ts                    # Data models
│   ├── format.ts                    # Ranks, currency, grouping, search
│   └── sanitize.ts                  # Allowlist sanitizer for Sheets rich text
├── public/                     # Static assets served at /
│   ├── logo.gif, vs.png
├── data/                       # schedule.json
└── scripts/package-standalone.mjs   # Assembles .next/standalone for self-hosting
```

### ทำไม Elysia ถึงรันอยู่ใน Next.js แทนที่จะแยกเซิร์ฟเวอร์

Elysia ปกติออกแบบมาให้รันบน Bun แต่ Vercel serverless runtime เป็น Node — ที่นี่มันถูก
mount ผ่าน `api.handle(request)` แทน `.listen()` เพราะ Elysia กับ Next route handler
รับ-คืนค่าเป็น `Request`/`Response` มาตรฐานตัวเดียวกัน จึงไม่ต้องมี Bun runtime และทั้งแอป
ยัง deploy เป็น Next.js project เดียวได้

ผลตอบแทนคือ **Eden Treaty**: `lib/client/eden.ts` สร้าง client ที่มีชนิดข้อมูลตรงจาก
`server/app.ts`'s `type Api` โดยอัตโนมัติ — เปลี่ยนชื่อ route แล้ว compile error ทันที
แทนที่จะไป 404 ตอนใช้งานจริง

---

## 🔒 มาตรการความปลอดภัย

- **PIN แบบ constant-time comparison** (`crypto.timingSafeEqual`) กันการเดา PIN ผ่าน
  ความต่างของเวลา response, พร้อม **lockout ชั่วคราว** หลังใส่ PIN ผิดเกิน 10 ครั้งใน
  15 นาที (per-instance, per-IP)
- **Rate limiting** บนทุก endpoint ที่ผูก PIN และบน `/register`, `/medical`
  (10 ครั้ง/นาทีต่อ IP) — ครอบคลุมทั้งสองฟอร์มเท่ากัน (เดิมมีเฉพาะฟอร์มตำรวจ)
- **Allowlist HTML sanitizer** (`lib/sanitize.ts`) สำหรับข้อความที่พิมพ์ใน Google
  Sheets — escape ทุกอย่างก่อนแล้วค่อยปลดล็อกเฉพาะแท็กที่อนุญาต ป้องกัน XSS
- **Discord OAuth2** สำหรับยืนยันตัวตนผู้ใช้ก่อนสมัคร/แก้ไขใบสมัคร
- **Idempotency key** บนการจ่ายเงิน กันจ่ายซ้ำซ้อนเมื่อ request timeout

---

## 🔗 API Endpoints หลัก

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/api/officers`, `/api/weeks`, `/api/week-data`, `/api/week-top10` | ข้อมูลกำลังพล/สัปดาห์ |
| GET/POST/PUT/DELETE | `/api/rules-data/:type` (`conduct`/`rules`/`fines`/`cases`) | อ่าน/แก้ข้อปฏิบัติ-กฎ-ค่าปรับ (`cases` อ่านอย่างเดียว) |
| POST | `/api/mark-paid`, GET `/api/mark-paid/status` | จ่ายเงินรายสัปดาห์ (idempotent) |
| POST/PATCH/GET | `/api/register`, `/api/medical` | สมัคร/แก้ไข/ดึงใบสมัคร (ผ่าน Discord embed) |
| POST | `/api/pending`, `/api/pending/approve/:row`, `/api/pending/reject/:row` | แผงตรวจใบสมัคร |
| POST/PUT | `/api/roster/namepd`, `/api/roster/outdc`, `/api/roster/status/:row`, `/api/roster/move-out/:row` | จัดการสถานะสมาชิก |
| GET | `/auth/discord`, `/auth/discord/callback` | Discord OAuth |

---

## 📝 หมายเหตุ

- พัฒนาสำหรับ **FiveM Server — MHNK Police Department** โดยเฉพาะ
- Google Sheets เป็นฐานข้อมูลหลัก อ่านผ่าน GViz CSV export (cache 15 วิ) และเขียนผ่าน
  Sheets API — คอลัมน์ในชีตอ้างอิงตาม**ตำแหน่ง** ไม่ใช่ชื่อ (ดูคอมเมนต์ใน
  `server/services/csv.ts`/`sheets.ts`) สลับคอลัมน์แล้วข้อมูลจะเพี้ยนแบบไม่มี error แจ้ง
- Discord Webhook ใช้ทั้งแจ้งเตือนทีมงานและเป็น "ที่เก็บข้อมูลใบสมัคร" (ข้อความ Discord
  คือ record ตัวจริง — แก้ไขใบสมัครคือการ parse embed เดิมกลับมา)
