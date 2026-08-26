import inventoryText from '../data/scePetkimEquipmentInventory.tsv?raw';

export interface SCEPetkimEquipmentInfo {
  maintenanceArea: string;
  equipmentNo: string;
  tagNo: string;
  sceGroup: string;
  sceReason: string;
  equipmentType: string;
  maintenanceItemNo: string;
  maintenancePlanNo: string;
}

const inventoryByEquipment = new Map<string, SCEPetkimEquipmentInfo>();

for (const line of inventoryText.split(/\r?\n/).slice(1)) {
  const [
    maintenanceArea,
    equipmentNo,
    tagNo,
    sceGroup,
    sceReason,
    equipmentType,
    maintenanceItemNo,
    maintenancePlanNo,
  ] = line.split('\t').map((value) => value?.trim() ?? '');
  if (!equipmentNo) continue;
  inventoryByEquipment.set(normalizeEquipmentNo(equipmentNo), {
    maintenanceArea,
    equipmentNo,
    tagNo,
    sceGroup,
    sceReason,
    equipmentType,
    maintenanceItemNo,
    maintenancePlanNo,
  });
}

export function getSCEPetkimEquipmentInfo(equipmentNo: string) {
  return inventoryByEquipment.get(normalizeEquipmentNo(equipmentNo));
}

export function getAllSCEPetkimEquipmentInfo() {
  return [...inventoryByEquipment.values()];
}

export function getSCEPetkimEquipmentType(equipmentNo: string) {
  return getSCEPetkimEquipmentInfo(equipmentNo)?.equipmentType ?? '';
}

function normalizeEquipmentNo(value: string) {
  return value.trim().replace(/\.0+$/, '').replace(/\D/g, '').replace(/^0+/, '');
}
