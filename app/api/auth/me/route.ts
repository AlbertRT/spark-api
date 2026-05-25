import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validations";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/response";

const USER_SELECT = {
  id: true, email: true, fullName: true, phone: true,
  campusId: true, role: true, createdAt: true, updatedAt: true,
};

// GET /api/auth/me — profil user + membership aktif
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const user = await prisma.user.findUnique({
      where: { id: auth.payload.userId },
      select: USER_SELECT,
    });
    if (!user) return notFoundResponse("User tidak ditemukan");

    const activeMembership = await prisma.membership.findFirst({
      where: { userId: auth.payload.userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        plan: { select: { name: true, pricePerMonth: true, vehicleType: true } },
      },
    });

    return successResponse({ user, active_membership: activeMembership }, "Data user berhasil diambil");
  } catch (err) {
    return serverErrorResponse(err);
  }
}

// PATCH /api/auth/me — update profil (fullName, phone, campusId)
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e) => e.message).join(", "));
    }

    const { full_name, phone, campus_id } = parsed.data;

    // Kalau campus_id diisi, cek tidak duplikat dengan user lain
    if (campus_id) {
      const duplicate = await prisma.user.findFirst({
        where: { campusId: campus_id, NOT: { id: auth.payload.userId } },
      });
      if (duplicate) return errorResponse("Student ID / Staff ID sudah digunakan akun lain", 409);
    }

    const updated = await prisma.user.update({
      where: { id: auth.payload.userId },
      data: {
        ...(full_name  ? { fullName: full_name }   : {}),
        ...(phone      ? { phone }                 : {}),
        ...(campus_id !== undefined ? { campusId: campus_id } : {}),
      },
      select: USER_SELECT,
    });

    return successResponse(updated, "Profil berhasil diperbarui");
  } catch (err) {
    return serverErrorResponse(err);
  }
}
