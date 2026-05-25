import { NextResponse } from "next/server";
import { ApiResponse } from "@/types";

export function successResponse<T>(
  data: T,
  message = "Berhasil",
  status = 200,
  meta?: ApiResponse<T>["meta"]
): NextResponse {
  const body: ApiResponse<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

export function errorResponse(
  message: string,
  status = 400,
  error?: string
): NextResponse {
  const body: ApiResponse = { success: false, message, error };
  return NextResponse.json(body, { status });
}

export function unauthorizedResponse(message = "Akses tidak diizinkan"): NextResponse {
  return errorResponse(message, 401);
}

export function forbiddenResponse(message = "Tidak memiliki izin"): NextResponse {
  return errorResponse(message, 403);
}

export function notFoundResponse(message = "Data tidak ditemukan"): NextResponse {
  return errorResponse(message, 404);
}

export function serverErrorResponse(error?: unknown): NextResponse {
  const msg =
    error instanceof Error ? error.message : "Terjadi kesalahan server";
  console.error("[Server Error]", error);
  return errorResponse("Terjadi kesalahan internal server", 500, msg);
}
