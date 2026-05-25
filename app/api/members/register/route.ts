import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { registerMemberSchema } from "@/lib/validations";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";

// GET /api/members/register — membership milik user
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const membership = await prisma.membership.findUnique({
      where: { userId: auth.payload.userId },
      include: {
        plan: true,
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    return successResponse(membership, "Data membership berhasil diambil");
  } catch (err) {
    return serverErrorResponse(err);
  }
}

// POST /api/members/register — daftar membership
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    // Admin tidak bisa daftar membership
    if (auth.payload.role === "ADMIN") return errorResponse("Admin tidak dapat mendaftar membership", 403);

    const body = await req.json();
    const parsed = registerMemberSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e) => e.message).join(", "));
    }

    // Cek sudah punya membership (unique per user)
    const existing = await prisma.membership.findUnique({ where: { userId: auth.payload.userId } });
    if (existing && ["ACTIVE", "PENDING"].includes(existing.status)) {
      return errorResponse("Anda sudah memiliki membership aktif atau pending", 409);
    }

    const plan = await prisma.membershipPlan.findFirst({ where: { id: parsed.data.plan_id, isActive: true } });
    if (!plan) return errorResponse("Plan tidak ditemukan atau tidak aktif", 404);

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    const result = await prisma.$transaction(async (tx: any) => {
      const membership = await tx.membership.upsert({
        where: { userId: auth.payload.userId },
        update: { planId: parsed.data.plan_id, status: "PENDING", startDate, endDate, autoRenew: parsed.data.auto_renew },
        create: { userId: auth.payload.userId, planId: parsed.data.plan_id, status: "PENDING", startDate, endDate, autoRenew: parsed.data.auto_renew },
        include: { plan: true },
      });

      const payment = await tx.payment.create({
        data: {
          membershipId: membership.id,
          userId: auth.payload.userId,
          amount: plan.pricePerMonth,
          paymentMethod: "TRANSFER",
          status: "PENDING",
          periodStart: startDate,
          periodEnd: endDate,
        },
      });

      return { membership, payment };
    });

    return successResponse(result, "Pendaftaran membership berhasil. Silakan lakukan pembayaran.", 201);
  } catch (err) {
    return serverErrorResponse(err);
  }
}
