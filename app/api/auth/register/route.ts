import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { registerSchema } from "@/lib/validations";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e) => e.message).join(", "));
    }

    const { email, password, full_name, phone, campus_id, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return errorResponse("Email sudah terdaftar", 409);

    if (campus_id) {
      const duplicateCampusId = await prisma.user.findFirst({ where: { campusId: campus_id } });
      if (duplicateCampusId) return errorResponse("Student ID / Staff ID sudah terdaftar", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, passwordHash, fullName: full_name, phone, campusId: campus_id ?? null, role },
      select: { id: true, email: true, fullName: true, phone: true, campusId: true, role: true, createdAt: true },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    return successResponse({ user, token }, "Registrasi berhasil", 201);
  } catch (err) {
    return serverErrorResponse(err);
  }
}
