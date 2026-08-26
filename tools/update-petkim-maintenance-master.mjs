import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error(
    'Kullanım: node tools/update-petkim-maintenance-master.mjs <kaynak.xlsx>',
  );
}

const here = path.dirname(fileURLToPath(import.meta.url));
const inventoryPath = path.resolve(
  here,
  '../src/data/scePetkimEquipmentInventory.tsv',
);

const inventoryLines = fs
  .readFileSync(inventoryPath, 'utf8')
  .trimEnd()
  .split(/\r?\n/);
const headers = inventoryLines[0].split('\t');
const inventoryRows = inventoryLines.slice(1).map((line) => line.split('\t'));

const equipmentIndex = requireColumn(headers, 'Ekipman');
const maintenanceItemIndex = ensureColumn(headers, inventoryRows, 'Bakim Kalemi');
const maintenancePlanIndex = ensureColumn(headers, inventoryRows, 'Bakim Plani');

const workbook = XLSX.readFile(sourcePath, { cellDates: true });
const source = findMaintenanceSheet(workbook);
const sourceByEquipment = new Map();

for (const cells of source.rows) {
  const equipmentNo = compact(cells[source.equipmentIndex]);
  const maintenanceItemNo = compact(cells[source.maintenanceItemIndex]);
  const maintenancePlanNo = compact(cells[source.maintenancePlanIndex]);
  if (!equipmentNo && !maintenanceItemNo && !maintenancePlanNo) continue;
  if (!equipmentNo || !maintenanceItemNo || !maintenancePlanNo) {
    throw new Error(
      `${source.sheetName} sayfasında ekipman/plan/kalem alanı eksik bir satır bulundu.`,
    );
  }

  const key = normalizeEquipmentNo(equipmentNo);
  const current = sourceByEquipment.get(key);
  if (
    current &&
    (current.maintenanceItemNo !== maintenanceItemNo ||
      current.maintenancePlanNo !== maintenancePlanNo)
  ) {
    throw new Error(`Ekipman ${equipmentNo} için çelişkili bakım planları var.`);
  }
  sourceByEquipment.set(key, { maintenanceItemNo, maintenancePlanNo });
}

const inventoryKeys = new Set();
const conflicts = [];
let matched = 0;
let updatedItems = 0;
let updatedPlans = 0;

for (const row of inventoryRows) {
  const equipmentNo = compact(row[equipmentIndex]);
  const key = normalizeEquipmentNo(equipmentNo);
  if (!key) continue;
  if (inventoryKeys.has(key)) {
    throw new Error(`Master listede yinelenen ekipman bulundu: ${equipmentNo}`);
  }
  inventoryKeys.add(key);

  const sourceRow = sourceByEquipment.get(key);
  if (!sourceRow) continue;
  matched += 1;

  const currentItem = compact(row[maintenanceItemIndex]);
  const currentPlan = compact(row[maintenancePlanIndex]);
  if (currentItem && currentItem !== sourceRow.maintenanceItemNo) {
    conflicts.push(
      `${equipmentNo}: bakım kalemi ${currentItem} / ${sourceRow.maintenanceItemNo}`,
    );
  }
  if (currentPlan && currentPlan !== sourceRow.maintenancePlanNo) {
    conflicts.push(
      `${equipmentNo}: bakım planı ${currentPlan} / ${sourceRow.maintenancePlanNo}`,
    );
  }
  if (!currentItem) {
    row[maintenanceItemIndex] = sourceRow.maintenanceItemNo;
    updatedItems += 1;
  }
  if (!currentPlan) {
    row[maintenancePlanIndex] = sourceRow.maintenancePlanNo;
    updatedPlans += 1;
  }
}

if (conflicts.length > 0) {
  throw new Error(
    `Master değerleri kaynakla çelişiyor:\n${conflicts.slice(0, 20).join('\n')}`,
  );
}

const sourceOnly = [...sourceByEquipment.keys()].filter(
  (key) => !inventoryKeys.has(key),
);
if (sourceOnly.length > 0) {
  throw new Error(
    `Kaynakta master listede bulunmayan ${sourceOnly.length} ekipman var: ${sourceOnly.join(', ')}`,
  );
}

fs.writeFileSync(
  inventoryPath,
  [headers, ...inventoryRows]
    .map((row) => trimTrailingEmptyCells(row).join('\t'))
    .join('\n') + '\n',
);

console.log(
  JSON.stringify(
    {
      sourceFile: path.resolve(sourcePath),
      sheet: source.sheetName,
      inventoryEquipment: inventoryKeys.size,
      sourceEquipment: sourceByEquipment.size,
      matched,
      updatedItems,
      updatedPlans,
      inventoryWithoutSource: inventoryKeys.size - matched,
    },
    null,
    2,
  ),
);

function findMaintenanceSheet(xlsxWorkbook) {
  for (const sheetName of xlsxWorkbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(xlsxWorkbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: '',
    });
    for (let headerIndex = 0; headerIndex < Math.min(rows.length, 20); headerIndex += 1) {
      const candidateHeaders = rows[headerIndex].map(compact);
      const equipmentIndex = findColumn(candidateHeaders, ['ekipman']);
      const maintenanceItemIndex = findColumn(candidateHeaders, [
        'bakim kalemi',
      ]);
      const maintenancePlanIndex = findColumn(candidateHeaders, [
        'bakim plani',
      ]);
      if (
        equipmentIndex >= 0 &&
        maintenanceItemIndex >= 0 &&
        maintenancePlanIndex >= 0
      ) {
        return {
          sheetName,
          rows: rows.slice(headerIndex + 1),
          equipmentIndex,
          maintenanceItemIndex,
          maintenancePlanIndex,
        };
      }
    }
  }
  throw new Error('Ekipman, Bakım Kalemi ve Bakım Planı sütunları bulunamadı.');
}

function ensureColumn(columnHeaders, rows, name) {
  const currentIndex = columnHeaders.indexOf(name);
  if (currentIndex >= 0) return currentIndex;
  columnHeaders.push(name);
  for (const row of rows) row.push('');
  return columnHeaders.length - 1;
}

function requireColumn(columnHeaders, name) {
  const index = columnHeaders.indexOf(name);
  if (index < 0) throw new Error(`Master listede ${name} sütunu bulunamadı.`);
  return index;
}

function findColumn(columnHeaders, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return columnHeaders.findIndex((header) =>
    normalizedAliases.includes(normalizeHeader(header)),
  );
}

function normalizeHeader(value) {
  return compact(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeEquipmentNo(value) {
  return compact(value)
    .replace(/\.0+$/, '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');
}

function compact(value) {
  return String(value ?? '').trim();
}

function trimTrailingEmptyCells(row) {
  const lastValueIndex = row.findLastIndex((value) => compact(value));
  return row.slice(0, lastValueIndex + 1);
}
