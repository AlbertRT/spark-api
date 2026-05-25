import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { memberId } = await params;
    const membership = await prisma.membership.findUnique({
      where: { id: memberId },
      include: { plan: true, payments: { orderBy: { createdAt: "desc" } } },
    });

    if (!membership) return notFoundResponse("Membership tidak ditemukan");
    if (auth.payload.role !== "ADMIN" && membership.userId !== auth.payload.userId) {
      return errorResponse("Akses ditolak", 403);
    }

    const daysRemaining = Math.ceil((membership.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return successResponse({ ...membership, days_remaining: daysRemaining }, "Detail membership berhasil diambil");
  } catch (err) {
    return serverErrorResponse(err);
  }
}
