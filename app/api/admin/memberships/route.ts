import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";
import { MembershipStatus, VehicleType } from "@/types";

// GET /api/admin/memberships
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, "ADMIN");
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as MembershipStatus | null;
    const vehicleType = searchParams.get("vehicle_type") as VehicleType | null;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const perPage = Math.min(100, parseInt(searchParams.get("per_page") ?? "20"));

    const where = {
      ...(status ? { status } : {}),
      ...(vehicleType ? { vehicleType } : {}),
    };

    const [memberships, total] = await prisma.$transaction([
      prisma.membership.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          plan: { select: { name: true, pricePerMonth: true, vehicleType: true } },
          // Tidak ada slot — membership hanya akses masuk
        },
      }),
      prisma.membership.count({ where }),
    ]);

    return successResponse(memberships, "Data membership berhasil diambil", 200, { total, page, per_page: perPage });
  } catch (err) {
    return serverErrorResponse(err);
  }
}
