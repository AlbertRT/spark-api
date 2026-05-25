import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";

// GET /api/parking/sessions/active — posisi semua kendaraan user yang sedang parkir
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const sessions = await prisma.parkingSession.findMany({
      where: { userId: auth.payload.userId, checkedOutAt: null },
      include: {
        vehicle: { select: { id: true, vehiclePlate: true, vehicleType: true, label: true } },
        slot: { include: { zone: true } },
      },
    });

    const result = sessions.map((s: any) => ({
      session_id: s.id,
      vehicle: s.vehicle,
      checked_in_at: s.checkedInAt,
      duration_minutes: Math.floor((Date.now() - s.checkedInAt.getTime()) / (1000 * 60)),
      slot: {
        id: s.slot.id,
        slot_code: s.slot.slotCode,
        position_x: s.slot.positionX,
        position_y: s.slot.positionY,
        zone: s.slot.zone,
      },
    }));

    return successResponse(result, result.length > 0 ? "Kendaraan yang sedang parkir" : "Tidak ada kendaraan yang sedang parkir");
  } catch (err) {
    return serverErrorResponse(err);
  }
}
