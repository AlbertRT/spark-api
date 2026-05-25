-- ============================================================
-- Smart Parking UBM Tower — Supabase SQL Schema
-- Run ini di Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Parking Zones ───────────────────────────────────────────────────────────
CREATE TABLE parking_zones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,                  -- e.g. "Basement 1", "Lantai 1"
  floor_number  INTEGER NOT NULL,               -- -1=B1, 0=GF, 1=L1, dst.
  description   TEXT,
  total_slots   INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Parking Slots ───────────────────────────────────────────────────────────
CREATE TABLE parking_slots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id       UUID NOT NULL REFERENCES parking_zones(id) ON DELETE CASCADE,
  slot_code     TEXT NOT NULL,                  -- e.g. "B1-001"
  vehicle_type  TEXT NOT NULL CHECK (vehicle_type IN ('motor', 'mobil')),
  status        TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
  position_x    INTEGER NOT NULL DEFAULT 0,     -- grid koordinat untuk navigasi
  position_y    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(zone_id, slot_code)
);

-- ─── Membership Plans ────────────────────────────────────────────────────────
CREATE TABLE membership_plans (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,               -- e.g. "Basic Motor Bulanan"
  vehicle_type     TEXT NOT NULL CHECK (vehicle_type IN ('motor', 'mobil')),
  price_per_month  INTEGER NOT NULL,            -- IDR
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Memberships ─────────────────────────────────────────────────────────────
CREATE TABLE memberships (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id        UUID NOT NULL REFERENCES membership_plans(id),
  slot_id        UUID REFERENCES parking_slots(id) ON DELETE SET NULL,
  vehicle_plate  TEXT NOT NULL,
  vehicle_type   TEXT NOT NULL CHECK (vehicle_type IN ('motor', 'mobil')),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('active', 'expired', 'pending', 'cancelled')),
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  auto_renew     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Payments ────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id       UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id),
  amount              INTEGER NOT NULL,         -- IDR
  payment_method      TEXT NOT NULL CHECK (payment_method IN ('transfer', 'virtual_account', 'qris')),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_proof_url   TEXT,
  paid_at             TIMESTAMPTZ,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_parking_slots_zone_id     ON parking_slots(zone_id);
CREATE INDEX idx_parking_slots_status      ON parking_slots(status);
CREATE INDEX idx_parking_slots_vehicle     ON parking_slots(vehicle_type);
CREATE INDEX idx_memberships_user_id       ON memberships(user_id);
CREATE INDEX idx_memberships_status        ON memberships(status);
CREATE INDEX idx_memberships_end_date      ON memberships(end_date);
CREATE INDEX idx_payments_membership_id    ON payments(membership_id);
CREATE INDEX idx_payments_status           ON payments(status);
CREATE INDEX idx_users_email               ON users(email);

-- ─── Function: Auto-increment zone slot count ─────────────────────────────
CREATE OR REPLACE FUNCTION increment_zone_slot_count(p_zone_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE parking_zones
  SET total_slots = total_slots + 1,
      updated_at = NOW()
  WHERE id = p_zone_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Function: Auto-expire memberships ───────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_memberships()
RETURNS VOID AS $$
BEGIN
  -- Set expired untuk membership yang sudah lewat end_date
  UPDATE memberships
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' AND end_date < CURRENT_DATE;

  -- Bebaskan slot dari membership expired
  UPDATE parking_slots ps
  SET status = 'available', updated_at = NOW()
  FROM memberships m
  WHERE m.slot_id = ps.id
    AND m.status = 'expired'
    AND ps.status = 'reserved';
END;
$$ LANGUAGE plpgsql;

-- ─── Trigger: updated_at otomatis ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_zones_updated_at
  BEFORE UPDATE ON parking_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_slots_updated_at
  BEFORE UPDATE ON parking_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- RLS di-disable karena kita pakai service_role key dari backend (bypass RLS)
-- Kalau mau enable RLS untuk direct client access, tambahkan policy di sini
ALTER TABLE users              DISABLE ROW LEVEL SECURITY;
ALTER TABLE parking_zones      DISABLE ROW LEVEL SECURITY;
ALTER TABLE parking_slots      DISABLE ROW LEVEL SECURITY;
ALTER TABLE membership_plans   DISABLE ROW LEVEL SECURITY;
ALTER TABLE memberships        DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments           DISABLE ROW LEVEL SECURITY;

-- ─── Seed Data: Plans ─────────────────────────────────────────────────────────
INSERT INTO membership_plans (name, vehicle_type, price_per_month, description) VALUES
  ('Basic Motor',   'motor', 150000, 'Parkir motor bulanan — akses 24 jam'),
  ('Basic Mobil',   'mobil', 350000, 'Parkir mobil bulanan — akses 24 jam'),
  ('Premium Motor', 'motor', 200000, 'Parkir motor premium — slot terjamin + prioritas'),
  ('Premium Mobil', 'mobil', 450000, 'Parkir mobil premium — slot terjamin + prioritas');

-- ─── Seed Data: Zones (contoh UBM Tower) ─────────────────────────────────────
INSERT INTO parking_zones (name, floor_number, description) VALUES
  ('Basement 1', -1, 'Area parkir basement lantai 1 — 40 slot motor, 20 slot mobil'),
  ('Basement 2', -2, 'Area parkir basement lantai 2 — 40 slot motor, 20 slot mobil'),
  ('Lantai 1',    1, 'Area parkir lantai 1 — 20 slot motor, 10 slot mobil'),
  ('Rooftop',     5, 'Area parkir rooftop — 10 slot motor, 5 slot mobil');
