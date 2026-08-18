import lookupText from '../data/scePetkimEquipmentLookup.tsv?raw';

const equipmentTypeByNumber = new Map<string, string>();

for (const line of lookupText.split(/\r?\n/).slice(1)) {
  const [equipmentNo, equipmentType] = line
    .split('\t')
    .map((value) => value?.trim() ?? '');
  if (!equipmentNo || !equipmentType) continue;
  equipmentTypeByNumber.set(normalizeEquipmentNo(equipmentNo), equipmentType);
}

export function getSCEPetkimEquipmentType(equipmentNo: string) {
  return equipmentTypeByNumber.get(normalizeEquipmentNo(equipmentNo)) ?? '';
}

function normalizeEquipmentNo(value: string) {
  return value.trim().replace(/\.0+$/, '').replace(/\D/g, '');
}
