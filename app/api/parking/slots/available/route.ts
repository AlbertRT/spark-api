import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";
import { VehicleType } from "@/types";

interface ZoneInfo { id: string; name: string; floorNumber: number; description: string | null }
interface SlotItem { id: string; slotCode: string; vehicleType: VehicleType; status: string; positionX: number; positionY: number; zone: ZoneInfo }
interface GroupedZone { zone: ZoneInfo; slots: SlotItem[]; count: number }

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { searchParams } = new URL(req.url);
    const vehicleType = searchParams.get("vehicle_type") as VehicleType | null;
    const zoneId = searchParams.get("zone_id");

    const slots: SlotItem[] = await prisma.parkingSlot.findMany({
      where: { status: "AVAILABLE", isActive: true, ...(vehicleType ? { vehicleType } : {}), ...(zoneId ? { zoneId } : {}) },
      select: { id: true, slotCode: true, vehicleType: true, status: true, positionX: true, positionY: true, zone: { select: { id: true, name: true, floorNumber: true, description: true } } },
      orderBy: { slotCode: "asc" },
    });

    const grouped = slots.reduce((acc: Record<string, GroupedZone>, slot: SlotItem) => {
      const key = slot.zone.id;
      if (!acc[key]) acc[key] = { zone: slot.zone, slots: [], count: 0 };
      acc[key].slots.push(slot);
      acc[key].count++;
      return acc;
    }, {});

    const result = Object.values(grouped).sort((a: GroupedZone, b: GroupedZone) => a.zone.floorNumber - b.zone.floorNumber);

    return successResponse({ zones: result, total_available: slots.length }, "Slot tersedia berhasil diambil");
  } catch (err) {
    return serverErrorResponse(err);
  }
}
