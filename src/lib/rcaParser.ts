import * as XLSX from 'xlsx';
import type { ParseError, RCACompany, RCARow, RCAStatus } from '../types';
import { isPastDue, normalize, parseDate, toDisplayString } from './normalize';

type RCAField =
  | 'recommendationId'
  | 'analysisId'
  | 'headline'
  | 'description'
  | 'assignedToName'
  | 'assignedToUserId'
  | 'jobTitle'
  | 'status'
  | 'targetCompletionDate';

const FIELD_ALIASES: Record<RCAField, string[]> = {
  recommendationId: ['recommendation id', 'recommendation no', 'öneri id'],
  analysisId: ['analysis id', 'analysis', 'rca id'],
  headline: ['recommendation headline', 'headline', 'aksiyon başlığı'],
  description: [
    'recommendation description',
    'description',
    'aksiyon açıklaması',
    'aciklama',
  ],
  assignedToName: ['assigned to name', 'assigned name', 'sorumlu adı'],
  assignedToUserId: ['assigned to user id', 'assigned user id', 'user id'],
  jobTitle: ['job title', 'görev', 'pozisyon'],
  status: ['status', 'durum'],
  targetCompletionDate: [
    'target completion date',
    'hedef tamamlanma tarihi',
    'target date',
  ],
};

const REQUIRED_FIELDS: RCAField[] = [
  'recommendationId',
  'analysisId',
  'headline',
  'assignedToUserId',
  'jobTitle',
  'status',
  'targetCompletionDate',
];

const EXCLUDED_JOB_TITLE_PATTERNS = [
  'enstruman proje',
  'proje muhendislik',
  'proses otomasyon',
];

interface SheetCandidate {
  name: string;
  headers: string[];
  rows: unknown[][];
  headerIndex: number;
  fieldMap: Partial<Record<RCAField, number>>;
  score: number;
}

export async function parseRCAExcel(
  file: File,
): Promise<{ data: RCARow[]; error?: ParseError }> {
  try {
    if (file.size === 0) {
      return {
        data: [],
        error: { message: 'RCA Excel dosyası boş görünüyor.' },
      };
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
    });
    const sheet = findBestSheet(workbook);
    if (!sheet || sheet.score === 0) {
      return {
        data: [],
        error: {
          message: 'RCA tablosunun başlıkları bulunamadı.',
          details: [
            'Beklenen başlıklar: Recommendation ID, Analysis ID, Job Title, Status, Target Completion Date.',
          ],
        },
      };
    }

    const missing = REQUIRED_FIELDS.filter(
      (field) => sheet.fieldMap[field] === undefined,
    );
    if (missing.length > 0) {
      return {
        data: [],
        error: {
          message: 'RCA dosyasında gerekli sütunlar eksik.',
          missing: missing.map((field) => FIELD_ALIASES[field][0]),
          foundHeaders: sheet.headers,
          details: [`Seçilen sayfa: ${sheet.name}`],
        },
      };
    }

    const data = sheet.rows
      .map((cells, index): RCARow | null =>
        parseRCARow(cells, sheet.fieldMap, index + sheet.headerIndex + 2),
      )
      .filter((row): row is RCARow => row !== null);

    if (data.length === 0) {
      return {
        data: [],
        error: {
          message: 'RCA dosyasında takip edilecek aksiyon bulunamadı.',
          details: [
            'Job Title içinde Enstrüman Proje, Proje Mühendislik veya Proses Otomasyon geçen kayıtlar hariç tutulur.',
          ],
        },
      };
    }

    return { data };
  } catch {
    return {
      data: [],
      error: {
        message:
          'RCA Excel dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.',
      },
    };
  }
}

function findBestSheet(workbook: XLSX.WorkBook): SheetCandidate | null {
  let best: SheetCandidate | null = null;
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    });
    for (let headerIndex = 0; headerIndex < Math.min(matrix.length, 20); headerIndex += 1) {
      const headers = matrix[headerIndex].map(toDisplayString);
      const fieldMap = buildFieldMap(headers);
      const score = Object.keys(fieldMap).length;
      if (!best || score > best.score) {
        best = {
          name,
          headers,
          rows: matrix.slice(headerIndex + 1),
          headerIndex,
          fieldMap,
          score,
        };
      }
    }
  }
  return best;
}

function buildFieldMap(headers: string[]) {
  return (Object.keys(FIELD_ALIASES) as RCAField[]).reduce<
    Partial<Record<RCAField, number>>
  >((map, field) => {
    const aliases = FIELD_ALIASES[field].map(normalizeHeader);
    const index = headers.findIndex((header) =>
      aliases.includes(normalizeHeader(header)),
    );
    if (index >= 0) map[field] = index;
    return map;
  }, {});
}

function parseRCARow(
  cells: unknown[],
  fieldMap: Partial<Record<RCAField, number>>,
  sourceRow: number,
): RCARow | null {
  const value = (field: RCAField) =>
    fieldMap[field] === undefined ? '' : cells[fieldMap[field] ?? -1];
  const text = (field: RCAField) => compact(value(field));

  const recommendationId = text('recommendationId');
  const analysisId = text('analysisId');
  const headline = text('headline');
  const assignedToName = text('assignedToName');
  const assignedToUserId = text('assignedToUserId');
  const jobTitle = text('jobTitle');
  const statusRaw = text('status');
  if (!recommendationId && !analysisId && !headline) return null;
  if (isExcludedJobTitle(jobTitle)) return null;

  const company = resolveCompany(jobTitle);
  if (!company) return null;

  const status = resolveStatus(statusRaw);
  const targetCompletionDate = parseDate(value('targetCompletionDate'));
  const owner = assignedToUserId || extractUserFromAssignedName(assignedToName);

  return {
    rowId: `rca-${sourceRow}-${recommendationId || analysisId || headline}`,
    sourceRow,
    recommendationId,
    analysisId,
    headline,
    description: text('description'),
    assignedToName,
    assignedToUserId,
    owner,
    jobTitle,
    company,
    statusRaw,
    status,
    targetCompletionDate,
    overdue: status === 'open' && isPastDue(targetCompletionDate),
    raw: Object.fromEntries(
      Object.entries(fieldMap).map(([field, column]) => [
        field,
        compact(cells[column ?? -1]),
      ]),
    ),
  };
}

function resolveStatus(value: string): RCAStatus {
  const clean = normalize(value);
  if (clean.includes('implemented')) return 'completed';
  return 'open';
}

function resolveCompany(jobTitle: string): RCACompany | null {
  const clean = normalize(jobTitle);
  if (clean.startsWith('rafineri')) return 'STAR';
  if (
    clean.includes('monomer') ||
    clean.includes('polimer') ||
    clean.includes('yardimci tesis')
  ) {
    return 'PETKIM';
  }
  if (clean.startsWith('enstruman bakim')) return 'STAD';
  return null;
}

function isExcludedJobTitle(jobTitle: string) {
  const clean = normalize(jobTitle);
  return EXCLUDED_JOB_TITLE_PATTERNS.some((pattern) => clean.includes(pattern));
}

function extractUserFromAssignedName(value: string) {
  const [, userId] = value.split('~');
  return userId?.trim() ?? '';
}

function compact(value: unknown) {
  return toDisplayString(value).replace(/\s+/g, ' ').trim();
}

function normalizeHeader(value: unknown) {
  return normalize(value).replace(/[^a-z0-9]+/g, ' ').trim();
}
