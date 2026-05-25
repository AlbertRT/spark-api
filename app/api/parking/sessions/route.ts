import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { checkInSchema } from "@/lib/validations";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";

// POST /api/parking/sessions — check-in
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const body = await req.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e) => e.message).join(", "));
    }

    const { slot_id, vehicle_id } = parsed.data;

    // Cek membership aktif
    const activeMembership = await prisma.membership.findUnique({
      where: { userId: auth.payload.userId },
    });
    if (!activeMembership || activeMembership.status !== "ACTIVE" || activeMembership.endDate < new Date()) {
      return errorResponse("Anda tidak memiliki membership aktif", 403);
    }

    // Cek vehicle milik user
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicle_id, userId: auth.payload.userId, isActive: true },
    });
    if (!vehicle) return errorResponse("Kendaraan tidak ditemukan", 404);

    // Cek slot tersedia atau di-reserve oleh user ini
    const slot = await prisma.parkingSlot.findUnique({
      where: { id: slot_id },
      include: { zone: { select: { name: true, floorNumber: true } } },
    });
    if (!slot || !slot.isActive) return errorResponse("Slot tidak ditemukan atau tidak aktif", 404);

    // Cek apakah slot di-reserve orang lain hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reservation = await prisma.slotReservation.findUnique({
      where: { slotId_reserveDate: { slotId: slot_id, reserveDate: today } },
    });

    if (reservation && reservation.status === "ACTIVE" && reservation.userId !== auth.payload.userId) {
      return errorResponse(`Slot ${slot.slotCode} sudah di-reserve orang lain hari ini`, 409);
    }

    if (slot.status === "OCCUPIED") {
      return errorResponse(`Slot ${slot.slotCode} sedang digunakan, pilih slot lain`, 409);
    }
    if (slot.status === "MAINTENANCE") {
      return errorResponse(`Slot ${slot.slotCode} sedang dalam maintenance`, 400);
    }
    if (slot.vehicleType !== vehicle.vehicleType) {
      return errorResponse(`Slot ini untuk ${slot.vehicleType.toLowerCase()}, kendaraan Anda ${vehicle.vehicleType.toLowerCase()}`, 400);
    }

    // Cek tidak ada sesi aktif lain dari vehicle ini
    const activeSession = await prisma.parkingSession.findFirst({
      where: { vehicleId: vehicle_id, checkedOutAt: null },
    });
    if (activeSession) return errorResponse("Kendaraan ini masih dalam sesi parkir aktif", 409);

    const result = await prisma.$transaction(async (tx: any) => {
      const session = await tx.parkingSession.create({
        data: { userId: auth.payload.userId, vehicleId: vehicle_id, slotId: slot_id },
        include: {
          vehicle: { select: { vehiclePlate: true, vehicleType: true, label: true } },
          slot: { include: { zone: { select: { id: true, name: true, floorNumber: true } } } },
        },
      });
      await tx.parkingSlot.update({ where: { id: slot_id }, data: { status: "OCCUPIED" } });
      return session;
    });

    return successResponse(result, `Check-in berhasil ke slot ${slot.slotCode}`, 201);
  } catch (err) {
    return serverErrorResponse(err);
  }
}

// GET /api/parking/sessions — riwayat sesi
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const perPage = Math.min(50, parseInt(searchParams.get("per_page") ?? "20"));

    const [sessions, total] = await prisma.$transaction([
      prisma.parkingSession.findMany({
        where: { userId: auth.payload.userId },
        orderBy: { checkedInAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          vehicle: { select: { vehiclePlate: true, vehicleType: true, label: true } },
          slot: { select: { slotCode: true, vehicleType: true, zone: { select: { name: true, floorNumber: true } } } },
        },
      }),
      prisma.parkingSession.count({ where: { userId: auth.payload.userId } }),
    ]);

    return successResponse(sessions, "Riwayat sesi parkir berhasil diambil", 200, { total, page, per_page: perPage });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
