import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/response";

// POST /api/parking/reservations/[reservationId]/confirm — admin konfirmasi bayar
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  try {
    const auth = requireRole(req, "ADMIN");
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { reservationId } = await params;

    const reservation = await prisma.slotReservation.findUnique({
      where: { id: reservationId },
      include: { slot: { select: { slotCode: true, status: true } } },
    });

    if (!reservation) return notFoundResponse("Reservasi tidak ditemukan");
    if (reservation.status !== "PENDING") {
      return errorResponse(`Reservasi sudah berstatus "${reservation.status}"`, 400);
    }

    // Cek slot tidak sedang di-maintain atau di-reserve admin
    if (["MAINTENANCE", "RESERVED"].includes(reservation.slot.status)) {
      return errorResponse(`Slot ${reservation.slot.slotCode} sedang ${reservation.slot.status.toLowerCase()}, tidak dapat dikonfirmasi`, 400);
    }

    const updated = await prisma.slotReservation.update({
      where: { id: reservationId },
      data: { status: "ACTIVE", paidAt: new Date() },
      include: {
        vehicle: { select: { vehiclePlate: true, vehicleType: true } },
        slot: { select: { slotCode: true, zone: { select: { name: true } } } },
      },
    });

    return successResponse(updated, "Pembayaran reservasi dikonfirmasi. Slot diprioritaskan untuk user ini.");
  } catch (err) {
    return serverErrorResponse(err);
  }
}
