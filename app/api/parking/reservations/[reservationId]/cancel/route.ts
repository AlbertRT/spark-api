import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/response";

// POST /api/parking/reservations/[reservationId]/cancel
export async function POST(req: NextRequest, { params }: { params: Promise<{ reservationId: string }> }) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { reservationId } = await params;

    const reservation = await prisma.slotReservation.findUnique({
      where: { id: reservationId },
      include: { slot: { select: { slotCode: true } } },
    });

    if (!reservation) return notFoundResponse("Reservasi tidak ditemukan");

    // User hanya bisa cancel miliknya; admin bisa cancel semua
    if (auth.payload.role !== "ADMIN" && reservation.userId !== auth.payload.userId) {
      return errorResponse("Akses ditolak", 403);
    }

    if (reservation.status === "CANCELLED") return errorResponse("Reservasi sudah dibatalkan", 400);
    if (reservation.status === "EXPIRED") return errorResponse("Reservasi sudah expired", 400);

    await prisma.slotReservation.update({
      where: { id: reservationId },
      data: { status: "CANCELLED" },
    });

    return successResponse(null, `Reservasi slot ${reservation.slot.slotCode} berhasil dibatalkan`);
  } catch (err) {
    return serverErrorResponse(err);
  }
}
