import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/response";

// POST /api/parking/sessions/[sessionId]/checkout
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { sessionId } = await params;

    const session = await prisma.parkingSession.findUnique({
      where: { id: sessionId },
      include: { slot: { select: { slotCode: true } } },
    });

    if (!session) return notFoundResponse("Sesi parkir tidak ditemukan");
    if (auth.payload.role !== "ADMIN" && session.userId !== auth.payload.userId) {
      return errorResponse("Akses ditolak", 403);
    }
    if (session.checkedOutAt) return errorResponse("Sesi ini sudah di-checkout", 400);

    const checkedOutAt = new Date();
    const durationMinutes = Math.floor((checkedOutAt.getTime() - session.checkedInAt.getTime()) / (1000 * 60));

    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.parkingSession.update({
        where: { id: sessionId },
        data: { checkedOutAt },
        include: {
          vehicle: { select: { vehiclePlate: true, vehicleType: true, label: true } },
          slot: { select: { slotCode: true, zone: { select: { name: true, floorNumber: true } } } },
        },
      });
      await tx.parkingSlot.update({ where: { id: session.slotId }, data: { status: "AVAILABLE" } });
      return updated;
    });

    return successResponse(
      { ...result, duration_minutes: durationMinutes },
      `Check-out dari slot ${session.slot.slotCode} berhasil. Durasi: ${durationMinutes} menit.`
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}
