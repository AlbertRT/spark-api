import { NextRequest } from "next/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/jwt";
import { AuthPayload, Role } from "@/types";

export interface AuthResult {
  success: true;
  payload: AuthPayload;
}

export interface AuthError {
  success: false;
  message: string;
  status: number;
}

export type AuthCheck = AuthResult | AuthError;

export function requireAuth(req: NextRequest): AuthCheck {
  try {
    const authHeader = req.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader);
    const payload = verifyToken(token);
    return { success: true, payload };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unauthorized",
      status: 401,
    };
  }
}

export function requireRole(req: NextRequest, ...roles: Role[]): AuthCheck {
  const authCheck = requireAuth(req);
  if (!authCheck.success) return authCheck;

  if (!roles.includes(authCheck.payload.role)) {
    return {
      success: false,
      message: "Tidak memiliki izin untuk mengakses resource ini",
      status: 403,
    };
  }

  return authCheck;
}
