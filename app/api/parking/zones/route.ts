import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createZoneSchema } from "@/lib/validations";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";
import { VehicleType, SlotStatus } from "@/types";

type SlotRow = { status: SlotStatus; vehicleType: VehicleType };

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { searchParams } = new URL(req.url);
    const vehicleType = searchParams.get("vehicle_type") as VehicleType | null;

    const zones = await prisma.parkingZone.findMany({
      where: { isActive: true },
      orderBy: { floorNumber: "asc" },
      include: {
        slots: {
          where: { isActive: true, ...(vehicleType ? { vehicleType } : {}) },
          select: { status: true, vehicleType: true },
        },
      },
    });

    const zonesWithStats = zones.map(({ slots, ...zone }: { slots: SlotRow[]; [k: string]: unknown }) => ({
      ...zone,
      stats: {
        total: slots.length,
        available: slots.filter((s: SlotRow) => s.status === "AVAILABLE").length,
        occupied: slots.filter((s: SlotRow) => s.status === "OCCUPIED").length,
        reserved: slots.filter((s: SlotRow) => s.status === "RESERVED").length,
        maintenance: slots.filter((s: SlotRow) => s.status === "MAINTENANCE").length,
      },
    }));

    return successResponse(zonesWithStats, "Data zona parkir berhasil diambil");
  } catch (err) {
    return serverErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);
    if (auth.payload.role !== "ADMIN") return errorResponse("Akses ditolak", 403);

    const body = await req.json();
    const parsed = createZoneSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e: { message: string }) => e.message).join(", "));
    }

    const zone = await prisma.parkingZone.create({
      data: {
        name: parsed.data.name,
        floorNumber: parsed.data.floor_number,
        description: parsed.data.description,
        isActive: parsed.data.is_active,
      },
    });

    return successResponse(zone, "Zona parkir berhasil dibuat", 201);
  } catch (err) {
    return serverErrorResponse(err);
  }
}
