import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { loginSchema } from "@/lib/validations";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e) => e.message).join(", "));
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return errorResponse("Email atau password salah", 401);

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return errorResponse("Email atau password salah", 401);

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    const { passwordHash: _, ...safeUser } = user;

    return successResponse({ user: safeUser, token }, "Login berhasil");
  } catch (err) {
    return serverErrorResponse(err);
  }
}
