import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";
import { VehicleType } from "@/types";

// GET /api/members/plans
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const { searchParams } = new URL(req.url);
    const vehicleType = searchParams.get("vehicle_type") as VehicleType | null;

    const plans = await prisma.membershipPlan.findMany({
      where: {
        isActive: true,
        ...(vehicleType ? { vehicleType } : {}),
      },
      orderBy: { pricePerMonth: "asc" },
    });

    return successResponse(plans, "Data plan membership berhasil diambil");
  } catch (err) {
    return serverErrorResponse(err);
  }
}
