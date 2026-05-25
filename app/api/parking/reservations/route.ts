import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createReservationSchema } from "@/lib/validations";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";
import { RESERVATION_PRICE } from "@/types";
import { Role } from "@/types";

// GET /api/parking/reservations — riwayat reservasi user
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const perPage = Math.min(50, parseInt(searchParams.get("per_page") ?? "20"));

    const [reservations, total] = await prisma.$transaction([
      prisma.slotReservation.findMany({
        where: { userId: auth.payload.userId },
        orderBy: { reserveDate: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          vehicle: { select: { vehiclePlate: true, vehicleType: true, label: true } },
          slot: { select: { slotCode: true, zone: { select: { name: true, floorNumber: true } } } },
        },
      }),
      prisma.slotReservation.count({ where: { userId: auth.payload.userId } }),
    ]);

    return successResponse(reservations, "Riwayat reservasi berhasil diambil", 200, { total, page, per_page: perPage });
  } catch (err) {
    return serverErrorResponse(err);
  }
}

// POST /api/parking/reservations — buat reservasi slot harian
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);
    if (auth.payload.role === "ADMIN") return errorResponse("Admin tidak dapat membuat reservasi", 403);

    const body = await req.json();
    const parsed = createReservationSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e) => e.message).join(", "));
    }

    const { slot_id, vehicle_id, reserve_date, payment_method } = parsed.data;

    // Parse tanggal & validasi tidak boleh masa lalu
    const reserveDate = new Date(reserve_date);
    reserveDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (reserveDate < today) return errorResponse("Tidak dapat reserve untuk tanggal yang sudah lewat", 400);

    // Max reserve 7 hari ke depan
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);
    if (reserveDate > maxDate) return errorResponse("Reservasi maksimal 7 hari ke depan", 400);

    // Cek vehicle milik user
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicle_id, userId: auth.payload.userId, isActive: true },
    });
    if (!vehicle) return errorResponse("Kendaraan tidak ditemukan", 404);

    // Cek slot ada dan aktif
    const slot = await prisma.parkingSlot.findUnique({
      where: { id: slot_id },
      include: { zone: { select: { name: true, floorNumber: true } } },
    });
    if (!slot || !slot.isActive) return errorResponse("Slot tidak ditemukan atau tidak aktif", 404);
    if (slot.status === "MAINTENANCE") return errorResponse("Slot sedang dalam maintenance", 400);
    if (slot.vehicleType !== vehicle.vehicleType) {
      return errorResponse(`Slot ini untuk ${slot.vehicleType.toLowerCase()}, kendaraan Anda ${vehicle.vehicleType.toLowerCase()}`, 400);
    }

    // Cek slot belum di-reserve orang lain di tanggal yang sama
    const existingReservation = await prisma.slotReservation.findUnique({
      where: { slotId_reserveDate: { slotId: slot_id, reserveDate } },
    });
    if (existingReservation) {
      if (existingReservation.userId === auth.payload.userId) {
        return errorResponse("Anda sudah mereservasi slot ini di tanggal tersebut", 409);
      }
      return errorResponse("Slot ini sudah direservasi orang lain di tanggal tersebut", 409);
    }

    // Cek user tidak double reserve kendaraan yang sama di tanggal yang sama
    const doubleReserve = await prisma.slotReservation.findFirst({
      where: { userId: auth.payload.userId, vehicleId: vehicle_id, reserveDate, status: { in: ["PENDING", "ACTIVE"] } },
    });
    if (doubleReserve) return errorResponse("Kendaraan ini sudah memiliki reservasi di tanggal tersebut", 409);

    // Hitung harga berdasarkan role
    const userRole = auth.payload.role as Exclude<Role, "ADMIN">;
    const amount = RESERVATION_PRICE[userRole];

    const reservation = await prisma.slotReservation.create({
      data: {
        userId: auth.payload.userId,
        vehicleId: vehicle_id,
        slotId: slot_id,
        reserveDate,
        status: "PENDING",
        pricePerDay: amount,       // ← bukan amount
        paymentMethod: payment_method,  // ← tambah ini
      },
      include: {
        vehicle: { select: { vehiclePlate: true, vehicleType: true, label: true } },
        slot: { select: { slotCode: true, zone: { select: { name: true, floorNumber: true } } } },
      },
    });

    return successResponse(
      reservation,
      `Reservasi berhasil dibuat. Silakan bayar Rp ${amount.toLocaleString("id-ID")} untuk mengaktifkan reservasi.`,
      201
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}
