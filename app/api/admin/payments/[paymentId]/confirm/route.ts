import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const auth = requireRole(req, "ADMIN");
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { paymentId } = await params;
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return notFoundResponse("Payment tidak ditemukan");
    if (payment.status !== "PENDING") return errorResponse(`Payment sudah berstatus "${payment.status}"`, 400);

    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: { status: "PAID", paidAt: new Date() },
      });
      await tx.membership.update({
        where: { id: payment.membershipId },
        data: { status: "ACTIVE" },
      });
      return updated;
    });

    return successResponse(result, "Pembayaran dikonfirmasi. Membership telah diaktifkan.");
  } catch (err) {
    return serverErrorResponse(err);
  }
}
