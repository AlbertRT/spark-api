import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addVehicleSchema } from "@/lib/validations";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/response";
import { MAX_VEHICLES_PER_USER } from "@/types";

// GET /api/vehicles — daftar kendaraan milik user
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: auth.payload.userId, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    return successResponse(vehicles, "Daftar kendaraan berhasil diambil");
  } catch (err) {
    return serverErrorResponse(err);
  }
}

// POST /api/vehicles — tambah kendaraan baru (max 3)
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.success) return errorResponse(auth.message, auth.status);
    if (auth.payload.role === "ADMIN") return errorResponse("Admin tidak dapat menambah kendaraan", 403);

    const body = await req.json();
    const parsed = addVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Data tidak valid", 400, parsed.error.issues.map((e) => e.message).join(", "));
    }

    const { vehicle_plate, vehicle_type, label } = parsed.data;

    // Cek max 3 kendaraan
    const count = await prisma.vehicle.count({
      where: { userId: auth.payload.userId, isActive: true },
    });
    if (count >= MAX_VEHICLES_PER_USER) {
      return errorResponse(`Maksimal ${MAX_VEHICLES_PER_USER} kendaraan per akun`, 409);
    }

    // Cek plat tidak duplikat di akun ini
    const existing = await prisma.vehicle.findFirst({
      where: { userId: auth.payload.userId, vehiclePlate: vehicle_plate, isActive: true },
    });
    if (existing) return errorResponse("Plat kendaraan sudah terdaftar di akun ini", 409);

    const vehicle = await prisma.vehicle.create({
      data: { userId: auth.payload.userId, vehiclePlate: vehicle_plate, vehicleType: vehicle_type, label: label ?? null },
    });

    return successResponse(vehicle, "Kendaraan berhasil ditambahkan", 201);
  } catch (err) {
    return serverErrorResponse(err);
  }
}
