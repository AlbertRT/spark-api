import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateSlotStatusSchema } from "@/lib/validations";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);
    const { slotId } = await params;

    const slot = await prisma.parkingSlot.findUnique({
      where: { id: slotId },
      select: {
        id: true, slotCode: true, vehicleType: true, status: true,
        reservedByAdmin: true, reservedNote: true, positionX: true, positionY: true,
        zone: { select: { id: true, name: true, floorNumber: true } },
      },
    });
    if (!slot) return notFoundResponse("Slot tidak ditemukan");
    return successResponse(slot, "Status slot berhasil diambil");
  } catch (err) {
    return serverErrorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);
    if (auth.payload.role !== "ADMIN") return errorResponse("Hanya admin yang dapat mengubah status slot", 403);

    const { slotId } = await params;
    const body = await req.json();
    const parsed = updateSlotStatusSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e) => e.message).join(", "));
    }

    const slot = await prisma.parkingSlot.findUnique({ where: { id: slotId }, select: { slotCode: true } });
    if (!slot) return notFoundResponse("Slot tidak ditemukan");

    const isReserved = parsed.data.status === "RESERVED";
    const updated = await prisma.parkingSlot.update({
      where: { id: slotId },
      data: {
        status: parsed.data.status,
        reservedByAdmin: isReserved,
        reservedNote: isReserved ? (parsed.data.reserved_note ?? null) : null,
      },
      include: { zone: { select: { id: true, name: true, floorNumber: true } } },
    });
    return successResponse(updated, `Status slot ${slot.slotCode} berhasil diperbarui`);
  } catch (err) {
    return serverErrorResponse(err);
  }
}
