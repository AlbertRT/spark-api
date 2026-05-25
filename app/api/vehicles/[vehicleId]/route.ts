import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/response";

// DELETE /api/vehicles/[vehicleId] — hapus kendaraan (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { vehicleId } = await params;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId: auth.payload.userId },
    });
    if (!vehicle) return notFoundResponse("Kendaraan tidak ditemukan");

    // Cek tidak ada sesi aktif
    const activeSession = await prisma.parkingSession.findFirst({
      where: { vehicleId, checkedOutAt: null },
    });
    if (activeSession) return errorResponse("Kendaraan sedang dalam sesi parkir aktif", 409);

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isActive: false },
    });

    return successResponse(null, "Kendaraan berhasil dihapus");
  } catch (err) {
    return serverErrorResponse(err);
  }
}

// PATCH /api/vehicles/[vehicleId] — update label kendaraan
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { vehicleId } = await params;
    const body = await req.json();
    const label = typeof body.label === "string" ? body.label.slice(0, 50) : null;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId: auth.payload.userId, isActive: true },
    });
    if (!vehicle) return notFoundResponse("Kendaraan tidak ditemukan");

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { label },
    });

    return successResponse(updated, "Kendaraan berhasil diperbarui");
  } catch (err) {
    return serverErrorResponse(err);
  }
}
