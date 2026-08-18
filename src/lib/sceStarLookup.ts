import lookupText from '../data/sceStarEquipmentLookup.tsv?raw';

export interface SCEStarEquipmentInfo {
  equipmentNo: string;
  sourceUnit: string;
  consoleName: string;
  categoryType: string;
  equipmentType: string;
}

const lookup = new Map<string, SCEStarEquipmentInfo>();
const consoleByUnit = new Map<string, string>();

for (const line of lookupText.split(/\r?\n/).slice(1)) {
  const [equipmentNo, sourceUnit, consoleName, categoryType, equipmentType] =
    line.split('\t').map((value) => value?.trim() ?? '');
  if (!equipmentNo) continue;
  lookup.set(normalizeEquipmentNo(equipmentNo), {
    equipmentNo,
    sourceUnit,
    consoleName,
    categoryType,
    equipmentType,
  });
  if (sourceUnit && consoleName) {
    consoleByUnit.set(normalizeUnit(sourceUnit), consoleName);
  }
}

export function getSCEStarEquipmentInfo(equipmentNo: string) {
  return lookup.get(normalizeEquipmentNo(equipmentNo));
}

export function getSCEStarConsoleByUnit(unit: string) {
  return consoleByUnit.get(normalizeUnit(unit));
}

function normalizeEquipmentNo(value: string) {
  return value.trim().replace(/\.0+$/, '').replace(/\D/g, '');
}

function normalizeUnit(value: string) {
  return value.trim().replace(/^U-/i, '').replace(/\.0+$/, '');
}
