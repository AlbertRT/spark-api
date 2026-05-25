import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createSlotSchema } from "@/lib/validations";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";
import { SlotStatus, VehicleType } from "@/types";

// GET /api/parking/slots
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { searchParams } = new URL(req.url);
    const zoneId = searchParams.get("zone_id");
    const vehicleType = searchParams.get("vehicle_type") as VehicleType | null;
    const status = searchParams.get("status") as SlotStatus | null;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const perPage = Math.min(100, parseInt(searchParams.get("per_page") ?? "50"));

    const where = {
      isActive: true,
      ...(zoneId ? { zoneId } : {}),
      ...(vehicleType ? { vehicleType } : {}),
      ...(status ? { status } : {}),
    };

    const [slots, total] = await prisma.$transaction([
      prisma.parkingSlot.findMany({
        where,
        include: { zone: { select: { id: true, name: true, floorNumber: true } } },
        orderBy: { slotCode: "asc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.parkingSlot.count({ where }),
    ]);

    return successResponse(slots, "Data slot parkir berhasil diambil", 200, { total, page, per_page: perPage });
  } catch (err) {
    return serverErrorResponse(err);
  }
}

// POST /api/parking/slots (admin)
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);
    if (auth.payload.role !== "ADMIN") return errorResponse("Akses ditolak", 403);

    const body = await req.json();
    const parsed = createSlotSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e) => e.message).join(", "));
    }

    const existing = await prisma.parkingSlot.findUnique({
      where: { zoneId_slotCode: { zoneId: parsed.data.zone_id, slotCode: parsed.data.slot_code } },
    });
    if (existing) return errorResponse(`Kode slot ${parsed.data.slot_code} sudah digunakan di zona ini`, 409);

    const [slot] = await prisma.$transaction([
      prisma.parkingSlot.create({
        data: {
          zoneId: parsed.data.zone_id,
          slotCode: parsed.data.slot_code,
          vehicleType: parsed.data.vehicle_type,
          positionX: parsed.data.position_x,
          positionY: parsed.data.position_y,
          isActive: parsed.data.is_active,
        },
        include: { zone: { select: { id: true, name: true, floorNumber: true } } },
      }),
      prisma.parkingZone.update({
        where: { id: parsed.data.zone_id },
        data: { totalSlots: { increment: 1 } },
      }),
    ]);

    return successResponse(slot, "Slot parkir berhasil dibuat", 201);
  } catch (err) {
    return serverErrorResponse(err);
  }
}
