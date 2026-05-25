import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  full_name: z.string().min(3, "Nama lengkap minimal 3 karakter").max(100),
  phone: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, "Nomor telepon tidak valid"),
  campus_id: z.string().max(50).optional(),
  role: z.enum(["STUDENT", "STAFF"]).default("STUDENT"),
});

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(3).max(100).optional(),
  phone: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/).optional(),
  campus_id: z.string().max(50).optional(),
});

// ─── Vehicle ──────────────────────────────────────────────────────────────────
export const addVehicleSchema = z.object({
  vehicle_plate: z.string().min(4).max(12).toUpperCase(),
  vehicle_type: z.enum(["MOTOR", "MOBIL"]),
  label: z.string().max(50).optional(),
});

export const updateVehicleSchema = z.object({
  label: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
});

// ─── Slot Reservation ─────────────────────────────────────────────────────────
export const createReservationSchema = z.object({
  slot_id: z.string().uuid("Slot ID tidak valid"),
  vehicle_id: z.string().uuid("Vehicle ID tidak valid"),
  reserve_date: z.string().date("Format tanggal harus YYYY-MM-DD"),
  payment_method: z.enum(["TRANSFER", "VIRTUAL_ACCOUNT", "QRIS"]),
});

// ─── Membership ───────────────────────────────────────────────────────────────
export const registerMemberSchema = z.object({
  plan_id: z.string().uuid("Plan ID tidak valid"),
  auto_renew: z.boolean().default(false),
});

export const renewMemberSchema = z.object({
  payment_method: z.enum(["TRANSFER", "VIRTUAL_ACCOUNT", "QRIS"]),
});

// ─── Parking Session ──────────────────────────────────────────────────────────
export const checkInSchema = z.object({
  slot_id: z.string().uuid("Slot ID tidak valid"),
  vehicle_id: z.string().uuid("Vehicle ID tidak valid"),
});

// ─── Slot (admin) ─────────────────────────────────────────────────────────────
export const updateSlotStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"]),
  reserved_note: z.string().max(200).optional(),
});

export const createZoneSchema = z.object({
  name: z.string().min(1).max(100),
  floor_number: z.number().int(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

export const createSlotSchema = z.object({
  zone_id: z.string().uuid(),
  slot_code: z.string().min(1).max(20).toUpperCase(),
  vehicle_type: z.enum(["MOTOR", "MOBIL"]),
  position_x: z.number().int().min(0),
  position_y: z.number().int().min(0),
  is_active: z.boolean().default(true),
});
