import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const sourcePaths = process.argv.slice(2);
if (sourcePaths.length === 0) {
  throw new Error(
    'Kullanım: node tools/update-petkim-shutdown-master.mjs <kaynak1.xlsx> [kaynak2.xlsx ...]',
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
const shutdownRequirementIndex = ensureColumn(
  headers,
  inventoryRows,
  'Durus Durumu',
);
const shutdownExplanationIndex = ensureColumn(
  headers,
  inventoryRows,
  'Durus Aciklamasi',
);

const sourceByEquipment = new Map();
const sourceSummaries = [];

for (const sourcePath of sourcePaths) {
  const workbook = XLSX.readFile(sourcePath, { cellDates: true });
  const source = findShutdownSheet(workbook);
  let equipmentCount = 0;

  for (const cells of source.rows) {
    const equipmentNo = cleanText(cells[source.equipmentIndex]);
    if (!equipmentNo) continue;
    equipmentCount += 1;

    const shutdownRequirement = cleanText(
      cells[source.shutdownRequirementIndex],
    );
    const shutdownExplanation = cleanText(
      cells[source.shutdownExplanationIndex],
    );
    const key = normalizeEquipmentNo(equipmentNo);
    const current = sourceByEquipment.get(key);
    if (
      current &&
      (current.shutdownRequirement !== shutdownRequirement ||
        current.shutdownExplanation !== shutdownExplanation)
    ) {
      throw new Error(`Ekipman ${equipmentNo} için çelişkili duruş bilgileri var.`);
    }
    sourceByEquipment.set(key, {
      equipmentNo,
      shutdownRequirement,
      shutdownExplanation,
      sourceFile: path.basename(sourcePath),
    });
  }

  sourceSummaries.push({
    file: path.basename(sourcePath),
    sheet: source.sheetName,
    equipment: equipmentCount,
  });
}

const inventoryKeys = new Set();
const conflicts = [];
let matched = 0;
let updatedRequirements = 0;
let updatedExplanations = 0;

for (const row of inventoryRows) {
  const equipmentNo = cleanText(row[equipmentIndex]);
  const key = normalizeEquipmentNo(equipmentNo);
  if (!key) continue;
  if (inventoryKeys.has(key)) {
    throw new Error(`Master listede yinelenen ekipman bulundu: ${equipmentNo}`);
  }
  inventoryKeys.add(key);

  const sourceRow = sourceByEquipment.get(key);
  if (!sourceRow) continue;
  matched += 1;

  const currentRequirement = cleanText(row[shutdownRequirementIndex]);
  const currentExplanation = cleanText(row[shutdownExplanationIndex]);
  if (
    currentRequirement &&
    sourceRow.shutdownRequirement &&
    currentRequirement !== sourceRow.shutdownRequirement
  ) {
    conflicts.push(
      `${equipmentNo}: duruş durumu ${currentRequirement} / ${sourceRow.shutdownRequirement}`,
    );
  }
  if (
    currentExplanation &&
    sourceRow.shutdownExplanation &&
    currentExplanation !== sourceRow.shutdownExplanation
  ) {
    conflicts.push(
      `${equipmentNo}: duruş açıklaması kaynakla eşleşmiyor`,
    );
  }
  if (!currentRequirement && sourceRow.shutdownRequirement) {
    row[shutdownRequirementIndex] = sourceRow.shutdownRequirement;
    updatedRequirements += 1;
  }
  if (!currentExplanation && sourceRow.shutdownExplanation) {
    row[shutdownExplanationIndex] = sourceRow.shutdownExplanation;
    updatedExplanations += 1;
  }
}

if (conflicts.length > 0) {
  throw new Error(
    `Master değerleri kaynakla çelişiyor:\n${conflicts.slice(0, 20).join('\n')}`,
  );
}

const sourceOnly = [...sourceByEquipment.entries()].filter(
  ([key]) => !inventoryKeys.has(key),
);
if (sourceOnly.length > 0) {
  throw new Error(
    `Kaynakta master listede bulunmayan ${sourceOnly.length} ekipman var: ${sourceOnly
      .slice(0, 20)
      .map(([, row]) => row.equipmentNo)
      .join(', ')}`,
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
      sources: sourceSummaries,
      inventoryEquipment: inventoryKeys.size,
      sourceEquipment: sourceByEquipment.size,
      matched,
      updatedRequirements,
      updatedExplanations,
      sourceWithoutRequirement: [...sourceByEquipment.values()].filter(
        (row) => !row.shutdownRequirement,
      ).length,
      sourceWithoutExplanation: [...sourceByEquipment.values()].filter(
        (row) => !row.shutdownExplanation,
      ).length,
    },
    null,
    2,
  ),
);

function findShutdownSheet(xlsxWorkbook) {
  for (const sheetName of xlsxWorkbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(xlsxWorkbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: '',
    });
    for (let headerIndex = 0; headerIndex < Math.min(rows.length, 20); headerIndex += 1) {
      const candidateHeaders = rows[headerIndex].map(cleanText);
      const equipmentIndex = findColumn(candidateHeaders, ['ekipman']);
      const shutdownRequirementIndex = findColumn(candidateHeaders, [
        'durus gereklilik yapilabilirlik',
      ]);
      const shutdownExplanationIndex = findColumn(candidateHeaders, [
        'aciklama',
      ]);
      if (
        equipmentIndex >= 0 &&
        shutdownRequirementIndex >= 0 &&
        shutdownExplanationIndex >= 0
      ) {
        return {
          sheetName,
          rows: rows.slice(headerIndex + 1),
          equipmentIndex,
          shutdownRequirementIndex,
          shutdownExplanationIndex,
        };
      }
    }
  }
  throw new Error(
    'Ekipman, Duruş Gereklilik & Yapılabilirlik ve Açıklama sütunları bulunamadı.',
  );
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
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeEquipmentNo(value) {
  return cleanText(value)
    .replace(/\.0+$/, '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function trimTrailingEmptyCells(row) {
  const lastValueIndex = row.findLastIndex((value) => cleanText(value));
  return row.slice(0, lastValueIndex + 1);
}
