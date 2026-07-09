import { create } from 'zustand';
import type {
  ActionRow,
  ParseError,
  RCARow,
  SATBudgetRow,
  SATBudgetUsageRow,
  SATExportRow,
  SATFileFormat,
  SATRow,
  SCECompany,
  SCERow,
  TechnicalRow,
  TechnicalStatus,
} from '../types';
import {
  parseMOCTakipExcel,
  parseActionsExcel,
  parseTechnicalExcel,
} from '../lib/excelParser';
import { parseSCEExcel } from '../lib/sceParser';
import { parseRCAExcel } from '../lib/rcaParser';
import { parseSATExcel } from '../lib/satParser';
import { parseSATBudgetExcel } from '../lib/satBudgetParser';
import {
  linkSATBudgetUsageToExport,
  parseSATBudgetUsageExcel,
} from '../lib/satBudgetUsageParser';

interface FileMeta {
  name: string;
  size: number;
  uploadedAt: Date;
}

interface SCERowBuckets {
  scePetkimRows: SCERow[];
  sceStarRows: SCERow[];
  sceStadRows: SCERow[];
}

interface DataState {
  // Yüklenen veriler
  technicalRows: TechnicalRow[];
  actionRows: ActionRow[];
  mocTakipMocNos: string[];
  sceRows: SCERow[];
  scePetkimRows: SCERow[];
  sceStarRows: SCERow[];
  sceStadRows: SCERow[];
  rcaRows: RCARow[];
  satRows: SATRow[];
  satExportRows: SATExportRow[];
  satBudgetRows: SATBudgetRow[];
  satBudgetUsageRows: SATBudgetUsageRow[];
  satFormat: SATFileFormat | null;
  technicalFile: FileMeta | null;
  actionsFile: FileMeta | null;
  mocTakipFile: FileMeta | null;
  sceFile: FileMeta | null;
  sceStarFile: FileMeta | null;
  sceStadFile: FileMeta | null;
  rcaFile: FileMeta | null;
  satFile: FileMeta | null;
  satBudgetFile: FileMeta | null;
  satBudgetUsageFile: FileMeta | null;

  // Yükleme/hata durumları
  technicalLoading: boolean;
  actionsLoading: boolean;
  mocTakipLoading: boolean;
  sceLoading: boolean;
  sceStarLoading: boolean;
  sceStadLoading: boolean;
  rcaLoading: boolean;
  satLoading: boolean;
  satBudgetLoading: boolean;
  satBudgetUsageLoading: boolean;
  technicalError: ParseError | null;
  actionsError: ParseError | null;
  mocTakipError: ParseError | null;
  sceError: ParseError | null;
  sceStarError: ParseError | null;
  sceStadError: ParseError | null;
  rcaError: ParseError | null;
  satError: ParseError | null;
  satBudgetError: ParseError | null;
  satBudgetUsageError: ParseError | null;

  // Global filtreler
  selectedCompanies: string[];
  selectedTechnicalStatuses: TechnicalStatus[];

  // Aksiyonlar
  uploadTechnical: (file: File) => Promise<void>;
  uploadActions: (file: File) => Promise<void>;
  uploadMOCTakip: (file: File) => Promise<void>;
  uploadSCE: (file: File) => Promise<void>;
  uploadSCEStar: (file: File) => Promise<void>;
  uploadSCEStad: (file: File) => Promise<void>;
  uploadRCA: (file: File) => Promise<void>;
  uploadSAT: (file: File) => Promise<void>;
  uploadSATBudget: (file: File) => Promise<void>;
  uploadSATBudgetUsage: (file: File) => Promise<void>;
  clearTechnical: () => void;
  clearActions: () => void;
  clearMOCTakip: () => void;
  clearSCE: () => void;
  clearSCEStar: () => void;
  clearSCEStad: () => void;
  clearRCA: () => void;
  clearSAT: () => void;
  clearSATBudget: () => void;
  clearSATBudgetUsage: () => void;
  setSelectedCompanies: (v: string[]) => void;
  setSelectedTechnicalStatuses: (v: TechnicalStatus[]) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  technicalRows: [],
  actionRows: [],
  mocTakipMocNos: [],
  sceRows: [],
  scePetkimRows: [],
  sceStarRows: [],
  sceStadRows: [],
  rcaRows: [],
  satRows: [],
  satExportRows: [],
  satBudgetRows: [],
  satBudgetUsageRows: [],
  satFormat: null,
  technicalFile: null,
  actionsFile: null,
  mocTakipFile: null,
  sceFile: null,
  sceStarFile: null,
  sceStadFile: null,
  rcaFile: null,
  satFile: null,
  satBudgetFile: null,
  satBudgetUsageFile: null,
  technicalLoading: false,
  actionsLoading: false,
  mocTakipLoading: false,
  sceLoading: false,
  sceStarLoading: false,
  sceStadLoading: false,
  rcaLoading: false,
  satLoading: false,
  satBudgetLoading: false,
  satBudgetUsageLoading: false,
  technicalError: null,
  actionsError: null,
  mocTakipError: null,
  sceError: null,
  sceStarError: null,
  sceStadError: null,
  rcaError: null,
  satError: null,
  satBudgetError: null,
  satBudgetUsageError: null,
  selectedCompanies: [],
  selectedTechnicalStatuses: [],

  uploadTechnical: async (file: File) => {
    set({ technicalLoading: true, technicalError: null });
    const { data, error } = await parseTechnicalExcel(file);
    if (error) {
      set({
        technicalLoading: false,
        technicalError: error,
        technicalRows: [],
        technicalFile: null,
      });
      return;
    }
    set({
      technicalLoading: false,
      technicalRows: data,
      technicalFile: { name: file.name, size: file.size, uploadedAt: new Date() },
      technicalError: null,
      selectedTechnicalStatuses: [],
    });
  },

  uploadActions: async (file: File) => {
    set({ actionsLoading: true, actionsError: null });
    const { data, error } = await parseActionsExcel(file);
    if (error) {
      set({
        actionsLoading: false,
        actionsError: error,
        actionRows: [],
        actionsFile: null,
      });
      return;
    }
    set({
      actionsLoading: false,
      actionRows: data,
      actionsFile: { name: file.name, size: file.size, uploadedAt: new Date() },
      actionsError: null,
    });
  },

  uploadMOCTakip: async (file: File) => {
    set({ mocTakipLoading: true, mocTakipError: null });
    const { data, error } = await parseMOCTakipExcel(file);
    if (error) {
      set({
        mocTakipLoading: false,
        mocTakipError: error,
        mocTakipMocNos: [],
        mocTakipFile: null,
      });
      return;
    }
    set({
      mocTakipLoading: false,
      mocTakipMocNos: data,
      mocTakipFile: { name: file.name, size: file.size, uploadedAt: new Date() },
      mocTakipError: null,
      selectedTechnicalStatuses: [],
    });
  },

  uploadSCE: async (file: File) => {
    set({ sceLoading: true, sceError: null });
    const { data, error } = await parseSCEExcel(file);
    if (error) {
      set((state) => {
        const scePetkimRows: SCERow[] = [];
        return {
          sceLoading: false,
          sceError: error,
          scePetkimRows,
          sceRows: combineSCERows({ ...state, scePetkimRows }),
          sceFile: null,
        };
      });
      return;
    }
    set((state) => {
      const scePetkimRows = forceSCECompany(data, 'PETKIM');
      return {
        sceLoading: false,
        scePetkimRows,
        sceRows: combineSCERows({ ...state, scePetkimRows }),
        sceFile: { name: file.name, size: file.size, uploadedAt: new Date() },
        sceError: null,
      };
    });
  },

  uploadSCEStar: async (file: File) => {
    set({ sceStarLoading: true, sceStarError: null });
    const { data, error } = await parseSCEExcel(file);
    if (error) {
      set((state) => {
        const sceStarRows: SCERow[] = [];
        return {
          sceStarLoading: false,
          sceStarError: error,
          sceStarRows,
          sceRows: combineSCERows({ ...state, sceStarRows }),
          sceStarFile: null,
        };
      });
      return;
    }
    set((state) => {
      const sceStarRows = forceSCECompany(data, 'STAR');
      return {
        sceStarLoading: false,
        sceStarRows,
        sceRows: combineSCERows({ ...state, sceStarRows }),
        sceStarFile: { name: file.name, size: file.size, uploadedAt: new Date() },
        sceStarError: null,
      };
    });
  },

  uploadSCEStad: async (file: File) => {
    set({ sceStadLoading: true, sceStadError: null });
    const { data, error } = await parseSCEExcel(file);
    if (error) {
      set((state) => {
        const sceStadRows: SCERow[] = [];
        return {
          sceStadLoading: false,
          sceStadError: error,
          sceStadRows,
          sceRows: combineSCERows({ ...state, sceStadRows }),
          sceStadFile: null,
        };
      });
      return;
    }
    set((state) => {
      const sceStadRows = forceSCECompany(data, 'STAD');
      return {
        sceStadLoading: false,
        sceStadRows,
        sceRows: combineSCERows({ ...state, sceStadRows }),
        sceStadFile: { name: file.name, size: file.size, uploadedAt: new Date() },
        sceStadError: null,
      };
    });
  },

  uploadRCA: async (file: File) => {
    set({ rcaLoading: true, rcaError: null });
    const { data, error } = await parseRCAExcel(file);
    if (error) {
      set({
        rcaLoading: false,
        rcaError: error,
        rcaRows: [],
        rcaFile: null,
      });
      return;
    }
    set({
      rcaLoading: false,
      rcaRows: data,
      rcaFile: { name: file.name, size: file.size, uploadedAt: new Date() },
      rcaError: null,
    });
  },

  uploadSAT: async (file: File) => {
    set({ satLoading: true, satError: null });
    const { data, exportData, format, error } = await parseSATExcel(file);
    if (error) {
      set({
        satLoading: false,
        satError: error,
        satRows: [],
        satExportRows: [],
        satBudgetUsageRows: linkSATBudgetUsageToExport(
          get().satBudgetUsageRows,
          [],
        ),
        satFormat: null,
        satFile: null,
      });
      return;
    }
    set({
      satLoading: false,
      satRows: data,
      satExportRows: exportData,
      satBudgetUsageRows: linkSATBudgetUsageToExport(
        get().satBudgetUsageRows,
        exportData,
      ),
      satFormat: format,
      satFile: { name: file.name, size: file.size, uploadedAt: new Date() },
      satError: null,
    });
  },

  uploadSATBudget: async (file: File) => {
    set({ satBudgetLoading: true, satBudgetError: null });
    const { data, error } = await parseSATBudgetExcel(file);
    if (error) {
      set({
        satBudgetLoading: false,
        satBudgetError: error,
        satBudgetRows: [],
        satBudgetFile: null,
      });
      return;
    }
    set({
      satBudgetLoading: false,
      satBudgetRows: data,
      satBudgetFile: {
        name: file.name,
        size: file.size,
        uploadedAt: new Date(),
      },
      satBudgetError: null,
    });
  },

  uploadSATBudgetUsage: async (file: File) => {
    set({ satBudgetUsageLoading: true, satBudgetUsageError: null });
    const { data, error } = await parseSATBudgetUsageExcel(
      file,
      get().satExportRows,
    );
    if (error) {
      set({
        satBudgetUsageLoading: false,
        satBudgetUsageError: error,
        satBudgetUsageRows: [],
        satBudgetUsageFile: null,
      });
      return;
    }
    set({
      satBudgetUsageLoading: false,
      satBudgetUsageRows: data,
      satBudgetUsageFile: {
        name: file.name,
        size: file.size,
        uploadedAt: new Date(),
      },
      satBudgetUsageError: null,
    });
  },

  clearTechnical: () =>
    set({
      technicalRows: [],
      technicalFile: null,
      technicalError: null,
      selectedTechnicalStatuses: [],
    }),
  clearActions: () =>
    set({
      actionRows: [],
      actionsFile: null,
      actionsError: null,
    }),
  clearMOCTakip: () =>
    set({
      mocTakipMocNos: [],
      mocTakipFile: null,
      mocTakipError: null,
      selectedTechnicalStatuses: [],
    }),
  clearSCE: () =>
    set((state) => {
      const scePetkimRows: SCERow[] = [];
      return {
        scePetkimRows,
        sceRows: combineSCERows({ ...state, scePetkimRows }),
        sceFile: null,
        sceError: null,
      };
    }),
  clearSCEStar: () =>
    set((state) => {
      const sceStarRows: SCERow[] = [];
      return {
        sceStarRows,
        sceRows: combineSCERows({ ...state, sceStarRows }),
        sceStarFile: null,
        sceStarError: null,
      };
    }),
  clearSCEStad: () =>
    set((state) => {
      const sceStadRows: SCERow[] = [];
      return {
        sceStadRows,
        sceRows: combineSCERows({ ...state, sceStadRows }),
        sceStadFile: null,
        sceStadError: null,
      };
    }),
  clearRCA: () =>
    set({
      rcaRows: [],
      rcaFile: null,
      rcaError: null,
    }),
  clearSAT: () =>
    set((state) => ({
      satRows: [],
      satExportRows: [],
      satBudgetUsageRows: linkSATBudgetUsageToExport(
        state.satBudgetUsageRows,
        [],
      ),
      satFormat: null,
      satFile: null,
      satError: null,
    })),
  clearSATBudget: () =>
    set({
      satBudgetRows: [],
      satBudgetFile: null,
      satBudgetError: null,
    }),
  clearSATBudgetUsage: () =>
    set({
      satBudgetUsageRows: [],
      satBudgetUsageFile: null,
      satBudgetUsageError: null,
    }),

  setSelectedCompanies: (v) => set({ selectedCompanies: v }),
  setSelectedTechnicalStatuses: (v) => set({ selectedTechnicalStatuses: v }),
}));

function forceSCECompany(rows: SCERow[], company: SCECompany): SCERow[] {
  return rows.map((row) => ({
    ...row,
    rowId: `${company}-${row.rowId}`,
    sirket: company,
  }));
}

function combineSCERows(state: SCERowBuckets) {
  return [
    ...state.scePetkimRows,
    ...state.sceStarRows,
    ...state.sceStadRows,
  ];
}
