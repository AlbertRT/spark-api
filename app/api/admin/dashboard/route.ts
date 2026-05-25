/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";

// GET /api/admin/dashboard
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, "ADMIN");
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [slotStats, zones, memberStats, paymentStats, pendingMemberships, activeSessions] =
      await prisma.$transaction([
        prisma.parkingSlot.groupBy({
          by: ["status"],
          where: { isActive: true },
          _count: { id: true },
        }),
        prisma.parkingZone.findMany({
          where: { isActive: true },
          select: { id: true, name: true, floorNumber: true, totalSlots: true },
          orderBy: { floorNumber: "asc" },
        }),
        prisma.membership.groupBy({
          by: ["status"],
          _count: { id: true },
        }),
        prisma.payment.findMany({
          where: { createdAt: { gte: startOfMonth } },
          select: { status: true, amount: true },
        }),
        prisma.membership.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            user: { select: { fullName: true, email: true } },
            plan: { select: { name: true, pricePerMonth: true } },
          },
        }),
        // Kendaraan yang sedang parkir saat ini
        prisma.parkingSession.count({ where: { checkedOutAt: null } }),
      ]);

    const totalSlots = slotStats.reduce((s: number, g: any) => s + g._count.id, 0);
    const slotByStatus = Object.fromEntries(slotStats.map((g: any) => [g.status.toLowerCase(), g._count.id]));
    const memberByStatus = Object.fromEntries(memberStats.map((g: any) => [g.status.toLowerCase(), g._count.id]));
    const paid = paymentStats.filter((p: any) => p.status === "PAID");
    const monthlyRevenue = paid.reduce((s: number, p: any) => s + p.amount, 0);

    return successResponse(
      {
        slots: {
          total: totalSlots,
          available: slotByStatus.available ?? 0,
          occupied: slotByStatus.occupied ?? 0,
          reserved: slotByStatus.reserved ?? 0,   // di-reserve admin
          maintenance: slotByStatus.maintenance ?? 0,
        },
        zones,
        members: {
          total: memberStats.reduce((s: number, g: any) => s + g._count.id, 0),
          active: memberByStatus.active ?? 0,
          pending: memberByStatus.pending ?? 0,
          expired: memberByStatus.expired ?? 0,
        },
        payments: {
          total_this_month: paymentStats.length,
          paid: paid.length,
          pending: paymentStats.filter((p: any) => p.status === "PENDING").length,
          monthly_revenue: monthlyRevenue,
        },
        active_sessions: activeSessions,  // jumlah kendaraan parkir sekarang
        pending_memberships: pendingMemberships,
        occupancy_rate:
          totalSlots > 0
            ? Math.round(((slotByStatus.occupied ?? 0) / totalSlots) * 100)
            : 0,
      },
      "Dashboard data berhasil diambil"
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}
