import { ParkingSlot, ParkingZone } from "@/types";
import { NavigationRoute, NavigationStep } from "@/types";

const UBM_ENTRANCE = "Lobby Utama Gedung UBM Tower - Jl. Soekarno Hatta";

export function generateNavigation(slot: ParkingSlot, zone: ParkingZone): NavigationRoute {
  const steps: NavigationStep[] = [];

  steps.push({
    step: 1,
    instruction: `Masuk melalui ${UBM_ENTRANCE}`,
    direction: "straight",
    landmark: "Lobby Utama",
  });

  if (zone.floorNumber < 0) {
    steps.push({
      step: 2,
      instruction: `Ambil lift atau ramp menuju Basement ${Math.abs(zone.floorNumber)} (${zone.name})`,
      direction: "down",
      landmark: "Lift / Ramp Basement",
    });
  } else if (zone.floorNumber === 0) {
    steps.push({
      step: 2,
      instruction: `Lanjutkan lurus menuju area parkir ${zone.name} di lantai dasar`,
      direction: "straight",
      landmark: "Area Parkir Ground Floor",
    });
  } else {
    steps.push({
      step: 2,
      instruction: `Naik ke Lantai ${zone.floorNumber} menggunakan ramp atau lift (${zone.name})`,
      direction: "up",
      landmark: `Ramp / Lift Lantai ${zone.floorNumber}`,
    });
  }

  const colLabel = String.fromCharCode(65 + slot.positionY);
  const rowLabel = String(slot.positionX + 1).padStart(2, "0");

  steps.push({
    step: 3,
    instruction: `Sesampainya di ${zone.name}, cari baris ${colLabel} (jalur ke-${slot.positionY + 1} dari pintu masuk)`,
    direction: slot.positionY <= 2 ? "left" : "right",
    landmark: `Baris ${colLabel}`,
  });

  steps.push({
    step: 4,
    instruction: `Lanjutkan ke nomor slot ${rowLabel} — slot Anda adalah ${slot.slotCode}`,
    direction: "straight",
    landmark: `Slot ${slot.slotCode}`,
  });

  steps.push({
    step: 5,
    instruction: `Anda telah tiba di slot parkir ${slot.slotCode}. Parkir kendaraan Anda di area yang telah ditandai.`,
    landmark: `Slot ${slot.slotCode}`,
  });

  const floorTime = Math.abs(zone.floorNumber) * 15;
  const gridTime = (slot.positionX + slot.positionY) * 5;
  const estimatedSeconds = 30 + floorTime + gridTime;

  return { slot, zone, entrance: UBM_ENTRANCE, estimated_walk_seconds: estimatedSeconds, steps };
}
