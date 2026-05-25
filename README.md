# 🅿️ Smart Parking UBM Tower — Backend API

Backend REST API untuk aplikasi Smart Parking UBM Tower. Dibangun dengan **Next.js 14** (App Router), **Supabase**, dan di-deploy via **Railway**.

---

## 🏗️ Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Framework   | Next.js 14 (App Router, TypeScript) |
| Database    | Supabase (PostgreSQL)             |
| Auth        | JWT (jsonwebtoken) + bcryptjs     |
| Validation  | Zod                               |
| Hosting     | Railway                           |

---

## 🚀 Setup Local

### 1. Clone & Install
```bash
git clone <repo-url>
cd smart-parking-backend
npm install
```

### 2. Environment Variables
```bash
cp .env.example .env.local
```

Isi `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=minimum-32-character-secret-key-here
```

### 3. Setup Database
- Buka Supabase Dashboard → SQL Editor
- Copy-paste isi file `supabase/schema.sql` dan jalankan
- Schema akan membuat semua tabel, index, trigger, dan seed data otomatis

### 4. Run Dev Server
```bash
npm run dev
```
API berjalan di `http://localhost:3000`

---

## 🗄️ Database Schema

```
users
  └── memberships ──→ membership_plans
        └── payments
        └── parking_slots ──→ parking_zones
```

---

## 📡 API Endpoints

### Auth
| Method | Endpoint             | Auth     | Deskripsi                    |
|--------|----------------------|----------|------------------------------|
| POST   | /api/auth/register   | No       | Daftar user baru             |
| POST   | /api/auth/login      | No       | Login, dapat JWT token       |
| GET    | /api/auth/me         | User     | Info user + membership aktif |

### Parking
| Method | Endpoint                               | Auth  | Deskripsi                     |
|--------|----------------------------------------|-------|-------------------------------|
| GET    | /api/parking/zones                     | User  | List zona + statistik slot    |
| POST   | /api/parking/zones                     | Admin | Tambah zona baru              |
| GET    | /api/parking/slots                     | User  | List semua slot               |
| POST   | /api/parking/slots                     | Admin | Tambah slot baru              |
| GET    | /api/parking/slots/available           | User  | Slot tersedia, group per zona |
| GET    | /api/parking/slots/[slotId]/status     | User  | Cek status satu slot          |
| PATCH  | /api/parking/slots/[slotId]/status     | Admin | Update status slot            |
| GET    | /api/parking/slots/[slotId]/navigate   | User  | Navigasi step-by-step ke slot |

### Membership
| Method | Endpoint                  | Auth | Deskripsi                     |
|--------|---------------------------|------|-------------------------------|
| GET    | /api/members/plans        | User | List semua plan membership    |
| GET    | /api/members/register     | User | Riwayat membership saya       |
| POST   | /api/members/register     | User | Daftar membership baru        |
| POST   | /api/members/renew        | User | Perpanjang membership         |
| GET    | /api/members/[memberId]   | User | Detail membership + sisa hari |

### Admin
| Method | Endpoint                                  | Auth  | Deskripsi                |
|--------|-------------------------------------------|-------|--------------------------|
| GET    | /api/admin/dashboard                      | Admin | Statistik keseluruhan    |
| GET    | /api/admin/memberships                    | Admin | List semua membership    |
| POST   | /api/admin/payments/[paymentId]/confirm   | Admin | Konfirmasi pembayaran    |

---

## 🚢 Deploy ke Railway

1. Set environment variables di Railway Dashboard
2. `railway up` atau connect ke GitHub repo

File `railway.toml` sudah dikonfigurasi untuk Next.js standalone.

---

## 📊 Flow Bisnis

```
User register/login → dapat JWT token
  → Lihat slot tersedia (GET /parking/slots/available)
  → Daftar membership (POST /members/register)
    → Sistem auto-assign slot + buat payment pending
  → Admin konfirmasi bayar (POST /admin/payments/[id]/confirm)
    → Membership aktif, slot jadi reserved
  → User lihat navigasi ke slot (GET /slots/[id]/navigate)
  → Tiap 30 hari → renew (POST /members/renew)
```
