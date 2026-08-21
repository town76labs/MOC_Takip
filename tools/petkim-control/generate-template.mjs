import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const inventoryPath = path.join(
  projectRoot,
  'src/data/scePetkimEquipmentInventory.tsv',
);
const outputPath = path.join(here, 'Petkim_SCE_Kontrol_Sablonu.xlsx');

const equipment = fs
  .readFileSync(inventoryPath, 'utf8')
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [, equipmentNo, tagNo, , , equipmentType] = line.split('\t');
    return ['PETKIM', equipmentNo, tagNo, equipmentType];
  });

const resultHeaders = [
  'Şirket',
  'Ekipman No',
  'Tag No',
  'Sipariş No',
  'Kalibrasyon Raporu',
  'PDF Sayısı',
  'Toplam Doküman',
  'Rapor Klasörü',
  'Örnek PDF',
  'Son Tarama Tarihi',
  'Deferral Başlatıldı mı?',
  'Açıklama',
  'Ekipman Tipi',
];

const initialResults = equipment.map(
  ([, equipmentNo, tagNo, equipmentType]) => [
    'PETKIM',
    equipmentNo,
    tagNo,
    '',
    'Yok',
    0,
    0,
    '',
    '',
    '',
    '',
    '',
    equipmentType,
  ],
);

const workbook = XLSX.utils.book_new();
const resultsSheet = XLSX.utils.aoa_to_sheet([
  resultHeaders,
  ...initialResults,
]);
const equipmentSheet = XLSX.utils.aoa_to_sheet([
  ['Şirket', 'Ekipman No', 'Teknik Tanıtıcı Numarası', 'Ekipman Tipi'],
  ...equipment,
]);
const settingsSheet = XLSX.utils.aoa_to_sheet([
  ['Ana Klasör', ''],
  ['Son Tarama', ''],
  [
    'Tarama Kuralı',
    'Seçilen klasörün doğrudan içindeki PDF dosya adında Teknik Tanıtıcı Numarası aranır.',
  ],
  [
    'Kullanım',
    'VBA modülünü içe aktarın, PetkimKontrolKurulumu makrosunu bir kez çalıştırın, ardından klasörü seçip tarayın.',
  ],
]);

resultsSheet['!cols'] = [
  { wch: 12 },
  { wch: 16 },
  { wch: 18 },
  { wch: 18 },
  { wch: 22 },
  { wch: 12 },
  { wch: 18 },
  { wch: 50 },
  { wch: 50 },
  { wch: 22 },
  { wch: 24 },
  { wch: 36 },
  { wch: 34 },
];
equipmentSheet['!cols'] = [
  { wch: 12 },
  { wch: 18 },
  { wch: 30 },
  { wch: 40 },
];
settingsSheet['!cols'] = [{ wch: 22 }, { wch: 105 }];
resultsSheet['!autofilter'] = { ref: `A1:M${initialResults.length + 1}` };
equipmentSheet['!autofilter'] = { ref: `A1:D${equipment.length + 1}` };

XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Kontrol_Sonuclari');
XLSX.utils.book_append_sheet(workbook, equipmentSheet, 'Ekipman_Listesi');
XLSX.utils.book_append_sheet(workbook, settingsSheet, 'Ayarlar');
XLSX.writeFile(workbook, outputPath);

console.log(`Created ${outputPath} with ${equipment.length} Petkim equipment rows.`);
