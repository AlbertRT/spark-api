import { VehicleType, Role, SlotStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const { MOTOR, MOBIL } = VehicleType;
const { ADMIN, STUDENT, STAFF } = Role;
const { AVAILABLE } = SlotStatus;

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Users ────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("admin123!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@ubmtower.com" },
    update: {},
    create: {
      email: "admin@ubmtower.com",
      passwordHash: adminPassword,
      fullName: "Admin UBM Tower",
      phone: "0811234567",
      campusId: "STF001",
      role: ADMIN,
    },
  });
  console.log("✅ Admin:", admin.email);

  const staffPassword = await bcrypt.hash("staff123!", 12);
  const staffUser = await prisma.user.upsert({
    where: { email: "staff@ubmtower.com" },
    update: {},
    create: {
      email: "staff@ubmtower.com",
      passwordHash: staffPassword,
      fullName: "Budi Santoso",
      phone: "081234567890",
      campusId: "STF002",
      role: STAFF,
    },
  });
  console.log("✅ Staff:", staffUser.email);

  const studentPassword = await bcrypt.hash("student123!", 12);
  const studentUser = await prisma.user.upsert({
    where: { email: "student@ubmtower.com" },
    update: {},
    create: {
      email: "student@ubmtower.com",
      passwordHash: studentPassword,
      fullName: "Andi Mahasiswa",
      phone: "082345678901",
      campusId: "2021001234",
      role: STUDENT,
    },
  });
  console.log("✅ Student:", studentUser.email);

  // ─── Vehicles ─────────────────────────────────────────────────────────────
  await prisma.vehicle.upsert({
    where: { userId_vehiclePlate: { userId: staffUser.id, vehiclePlate: "D1234ABC" } },
    update: {},
    create: { userId: staffUser.id, vehiclePlate: "D1234ABC", vehicleType: MOBIL, label: "Mobil Kantor" },
  });
  await prisma.vehicle.upsert({
    where: { userId_vehiclePlate: { userId: staffUser.id, vehiclePlate: "D5678XYZ" } },
    update: {},
    create: { userId: staffUser.id, vehiclePlate: "D5678XYZ", vehicleType: MOTOR, label: "Motor Harian" },
  });
  await prisma.vehicle.upsert({
    where: { userId_vehiclePlate: { userId: studentUser.id, vehiclePlate: "D9999STD" } },
    update: {},
    create: { userId: studentUser.id, vehiclePlate: "D9999STD", vehicleType: MOTOR, label: "Motor Kuliah" },
  });
  console.log("✅ Vehicles seeded");

  // ─── Membership Plans ─────────────────────────────────────────────────────
  const plans: Prisma.MembershipPlanCreateInput[] = [
    { id: "plan-motor-basic",   name: "Basic Motor",   vehicleType: MOTOR, pricePerMonth: 150000, description: "Akses parkir motor bulanan" },
    { id: "plan-mobil-basic",   name: "Basic Mobil",   vehicleType: MOBIL, pricePerMonth: 350000, description: "Akses parkir mobil bulanan" },
    { id: "plan-motor-premium", name: "Premium Motor", vehicleType: MOTOR, pricePerMonth: 200000, description: "Akses prioritas parkir motor" },
    { id: "plan-mobil-premium", name: "Premium Mobil", vehicleType: MOBIL, pricePerMonth: 450000, description: "Akses prioritas parkir mobil" },
  ];
  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id as string },
      update: {},
      create: plan,
    });
  }
  console.log(`✅ ${plans.length} membership plans`);

  // ─── Parking Zones ────────────────────────────────────────────────────────
  const zones: Prisma.ParkingZoneCreateInput[] = [
    { id: "zone-b1", name: "Basement 1", floorNumber: -1, description: "Area parkir basement lantai 1" },
    { id: "zone-b2", name: "Basement 2", floorNumber: -2, description: "Area parkir basement lantai 2" },
    { id: "zone-l1", name: "Lantai 1",   floorNumber:  1, description: "Area parkir lantai 1" },
    { id: "zone-rf", name: "Rooftop",    floorNumber:  5, description: "Area parkir rooftop" },
  ];
  for (const zone of zones) {
    await prisma.parkingZone.upsert({
      where: { id: zone.id as string },
      update: {},
      create: zone,
    });
  }
  console.log(`✅ ${zones.length} parking zones`);

  // ─── Parking Slots ────────────────────────────────────────────────────────
  type SlotSeed = Prisma.ParkingSlotCreateInput & { id: string };

  const buildSlots = (
    zoneId: string,
    prefix: string,
    vehicleType: Prisma.VehicleType,
    count: number,
    colsPerRow: number,
    rowOffset = 0
  ): SlotSeed[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `slot-${zoneId}-${prefix.replace("-", "")}-${String(i + 1).padStart(2, "0")}`,
      zone: { connect: { id: zoneId } },
      slotCode: `${prefix.toUpperCase()}${String(i + 1).padStart(2, "0")}`,
      vehicleType,
      status: AVAILABLE,
      positionX: i % colsPerRow,
      positionY: rowOffset + Math.floor(i / colsPerRow),
    }));

  const allSlots: SlotSeed[] = [
    ...buildSlots("zone-b1", "B1-M", MOTOR, 20, 10),
    ...buildSlots("zone-b1", "B1-C", MOBIL, 10, 5, 2),
    ...buildSlots("zone-b2", "B2-M", MOTOR, 20, 10),
    ...buildSlots("zone-b2", "B2-C", MOBIL, 10, 5, 2),
    ...buildSlots("zone-l1", "L1-M", MOTOR, 10, 5),
    ...buildSlots("zone-l1", "L1-C", MOBIL,  5, 5, 2),
    ...buildSlots("zone-rf", "RF-M", MOTOR, 10, 5),
    ...buildSlots("zone-rf", "RF-C", MOBIL,  5, 5, 2),
  ];

  for (const { id, ...data } of allSlots) {
    await prisma.parkingSlot.upsert({
      where: { id },
      update: {},
      create: { id, ...data },
    });
  }

  // Update totalSlots per zona
  const slotCountByZone = allSlots.reduce<Record<string, number>>((acc, s) => {
    const zoneId = (s.zone as Prisma.ParkingZoneCreateNestedOneWithoutSlotsInput).connect!.id as string;
    acc[zoneId] = (acc[zoneId] ?? 0) + 1;
    return acc;
  }, {});

  for (const [zoneId, total] of Object.entries(slotCountByZone)) {
    await prisma.parkingZone.update({ where: { id: zoneId }, data: { totalSlots: total } });
  }

  console.log(`✅ ${allSlots.length} parking slots di ${zones.length} zona`);
  console.log("\n✨ Seeding selesai!");
  console.log("   Admin   → admin@ubmtower.com   / admin123!");
  console.log("   Staff   → staff@ubmtower.com   / staff123!");
  console.log("   Student → student@ubmtower.com / student123!");
  console.log(`\n   Total slots: ${allSlots.length}`);
  for (const [zoneId, count] of Object.entries(slotCountByZone)) {
    const zone = zones.find((z) => z.id === zoneId);
    console.log(`   ${zone?.name}: ${count} slots`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
