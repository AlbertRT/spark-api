// ─── Enums ────────────────────────────────────────────────────────────────────
export type Role = "STUDENT" | "STAFF" | "ADMIN";
export type VehicleType = "MOTOR" | "MOBIL";
export type SlotStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
export type ReservationStatus = "PENDING" | "ACTIVE" | "CANCELLED" | "EXPIRED";
export type MembershipStatus = "ACTIVE" | "EXPIRED" | "PENDING" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type PaymentMethod = "TRANSFER" | "VIRTUAL_ACCOUNT" | "QRIS";

// Harga reserve per role
export const RESERVATION_PRICE: Record<Exclude<Role, "ADMIN">, number> = {
  STUDENT: 35000,
  STAFF:   50000,
};

// ─── Models ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  campusId: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vehicle {
  id: string;
  userId: string;
  vehiclePlate: string;
  vehicleType: VehicleType;
  label: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParkingZone {
  id: string;
  name: string;
  floorNumber: number;
  description: string | null;
  totalSlots: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParkingSlot {
  id: string;
  zoneId: string;
  slotCode: string;
  vehicleType: VehicleType;
  status: SlotStatus;
  reservedByAdmin: boolean;
  reservedNote: string | null;
  positionX: number;
  positionY: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotReservation {
  id: string;
  userId: string;
  vehicleId: string;
  slotId: string;
  reserveDate: Date;
  pricePerDay: number;
  status: ReservationStatus;
  paymentMethod: PaymentMethod;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParkingSession {
  id: string;
  userId: string;
  vehicleId: string;
  slotId: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
}

export interface MembershipPlan {
  id: string;
  name: string;
  pricePerMonth: number;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface Membership {
  id: string;
  userId: string;
  planId: string;
  status: MembershipStatus;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  membershipId: string;
  userId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  paymentProofUrl: string | null;
  paidAt: Date | null;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthPayload {
  userId: string;
  email: string;
  role: Role;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
export interface NavigationStep {
  step: number;
  instruction: string;
  direction?: "straight" | "left" | "right" | "up" | "down";
  landmark?: string;
}

export interface NavigationRoute {
  slot: ParkingSlot;
  zone: ParkingZone;
  entrance: string;
  estimated_walk_seconds: number;
  steps: NavigationStep[];
}

// ─── API Response ─────────────────────────────────────────────────────────────
// ─── Constants ────────────────────────────────────────────────────────────────
export const MAX_VEHICLES_PER_USER = 3;

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: { total?: number; page?: number; per_page?: number };
}
