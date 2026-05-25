import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateNavigation } from "@/lib/navigation";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);
    const { slotId } = await params;

    const slot = await prisma.parkingSlot.findUnique({ where: { id: slotId }, include: { zone: true } });
    if (!slot) return notFoundResponse("Slot tidak ditemukan");
    if (!slot.isActive) return errorResponse("Slot tidak aktif", 400);

    const navigation = generateNavigation(slot as any, slot.zone);
    return successResponse(navigation, "Navigasi berhasil dibuat");
  } catch (err) {
    return serverErrorResponse(err);
  }
}
