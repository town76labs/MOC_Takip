import { create } from 'zustand';
import type {
  ActionRow,
  ParseError,
  SATExportRow,
  SATFileFormat,
  SATRow,
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
import { parseSATExcel } from '../lib/satParser';

interface FileMeta {
  name: string;
  size: number;
  uploadedAt: Date;
}

interface DataState {
  // Yüklenen veriler
  technicalRows: TechnicalRow[];
  actionRows: ActionRow[];
  mocTakipMocNos: string[];
  sceRows: SCERow[];
  satRows: SATRow[];
  satExportRows: SATExportRow[];
  satFormat: SATFileFormat | null;
  technicalFile: FileMeta | null;
  actionsFile: FileMeta | null;
  mocTakipFile: FileMeta | null;
  sceFile: FileMeta | null;
  satFile: FileMeta | null;

  // Yükleme/hata durumları
  technicalLoading: boolean;
  actionsLoading: boolean;
  mocTakipLoading: boolean;
  sceLoading: boolean;
  satLoading: boolean;
  technicalError: ParseError | null;
  actionsError: ParseError | null;
  mocTakipError: ParseError | null;
  sceError: ParseError | null;
  satError: ParseError | null;

  // Global filtreler
  selectedCompanies: string[];
  selectedTechnicalStatuses: TechnicalStatus[];

  // Aksiyonlar
  uploadTechnical: (file: File) => Promise<void>;
  uploadActions: (file: File) => Promise<void>;
  uploadMOCTakip: (file: File) => Promise<void>;
  uploadSCE: (file: File) => Promise<void>;
  uploadSAT: (file: File) => Promise<void>;
  clearTechnical: () => void;
  clearActions: () => void;
  clearMOCTakip: () => void;
  clearSCE: () => void;
  clearSAT: () => void;
  setSelectedCompanies: (v: string[]) => void;
  setSelectedTechnicalStatuses: (v: TechnicalStatus[]) => void;
}

export const useDataStore = create<DataState>((set) => ({
  technicalRows: [],
  actionRows: [],
  mocTakipMocNos: [],
  sceRows: [],
  satRows: [],
  satExportRows: [],
  satFormat: null,
  technicalFile: null,
  actionsFile: null,
  mocTakipFile: null,
  sceFile: null,
  satFile: null,
  technicalLoading: false,
  actionsLoading: false,
  mocTakipLoading: false,
  sceLoading: false,
  satLoading: false,
  technicalError: null,
  actionsError: null,
  mocTakipError: null,
  sceError: null,
  satError: null,
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
      set({
        sceLoading: false,
        sceError: error,
        sceRows: [],
        sceFile: null,
      });
      return;
    }
    set({
      sceLoading: false,
      sceRows: data,
      sceFile: { name: file.name, size: file.size, uploadedAt: new Date() },
      sceError: null,
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
        satFormat: null,
        satFile: null,
      });
      return;
    }
    set({
      satLoading: false,
      satRows: data,
      satExportRows: exportData,
      satFormat: format,
      satFile: { name: file.name, size: file.size, uploadedAt: new Date() },
      satError: null,
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
    set({
      sceRows: [],
      sceFile: null,
      sceError: null,
    }),
  clearSAT: () =>
    set({
      satRows: [],
      satExportRows: [],
      satFormat: null,
      satFile: null,
      satError: null,
    }),

  setSelectedCompanies: (v) => set({ selectedCompanies: v }),
  setSelectedTechnicalStatuses: (v) => set({ selectedTechnicalStatuses: v }),
}));
