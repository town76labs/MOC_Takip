import { create } from 'zustand';
import type { ActionRow, ParseError, TechnicalRow, TechnicalStatus } from '../types';
import {
  parseMOCTakipExcel,
  parseActionsExcel,
  parseTechnicalExcel,
} from '../lib/excelParser';

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
  technicalFile: FileMeta | null;
  actionsFile: FileMeta | null;
  mocTakipFile: FileMeta | null;

  // Yükleme/hata durumları
  technicalLoading: boolean;
  actionsLoading: boolean;
  mocTakipLoading: boolean;
  technicalError: ParseError | null;
  actionsError: ParseError | null;
  mocTakipError: ParseError | null;

  // Global filtreler
  selectedCompanies: string[];
  selectedTechnicalStatuses: TechnicalStatus[];

  // Aksiyonlar
  uploadTechnical: (file: File) => Promise<void>;
  uploadActions: (file: File) => Promise<void>;
  uploadMOCTakip: (file: File) => Promise<void>;
  clearTechnical: () => void;
  clearActions: () => void;
  clearMOCTakip: () => void;
  setSelectedCompanies: (v: string[]) => void;
  setSelectedTechnicalStatuses: (v: TechnicalStatus[]) => void;
}

export const useDataStore = create<DataState>((set) => ({
  technicalRows: [],
  actionRows: [],
  mocTakipMocNos: [],
  technicalFile: null,
  actionsFile: null,
  mocTakipFile: null,
  technicalLoading: false,
  actionsLoading: false,
  mocTakipLoading: false,
  technicalError: null,
  actionsError: null,
  mocTakipError: null,
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

  setSelectedCompanies: (v) => set({ selectedCompanies: v }),
  setSelectedTechnicalStatuses: (v) => set({ selectedTechnicalStatuses: v }),
}));
