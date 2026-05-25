import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { renewMemberSchema } from "@/lib/validations";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/response";

// POST /api/members/renew
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const body = await req.json();
    const parsed = renewMemberSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e) => e.message).join(", "));
    }

    const { payment_method } = parsed.data;

    const membership = await prisma.membership.findUnique({
      where: { userId: auth.payload.userId },
      include: { plan: true },
    });
    if (!membership) return notFoundResponse("Membership tidak ditemukan");
    if (!["ACTIVE", "EXPIRED"].includes(membership.status)) {
      return errorResponse(`Membership dengan status "${membership.status}" tidak dapat diperpanjang`, 400);
    }

    const pendingPayment = await prisma.payment.findFirst({
      where: { membershipId: membership.id, status: "PENDING" },
    });
    if (pendingPayment) return errorResponse("Terdapat tagihan pending yang belum dibayar", 409);

    const baseDate =
      membership.status === "ACTIVE" && membership.endDate > new Date()
        ? membership.endDate
        : new Date();

    const newStart = new Date(baseDate);
    const newEnd = new Date(baseDate);
    newEnd.setDate(newEnd.getDate() + 30);

    const result = await prisma.$transaction(async (tx: any) => {
      await tx.membership.update({
        where: { id: membership.id },
        data: { endDate: newEnd, status: membership.status === "EXPIRED" ? "PENDING" : membership.status },
      });

      return tx.payment.create({
        data: {
          membershipId: membership.id,
          userId: auth.payload.userId,
          amount: membership.plan.pricePerMonth,
          paymentMethod: payment_method,
          status: "PENDING",
          periodStart: newStart,
          periodEnd: newEnd,
        },
      });
    });

    return successResponse(
      { payment: result, new_period: { start: newStart, end: newEnd } },
      "Perpanjangan membership berhasil. Silakan selesaikan pembayaran."
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}
