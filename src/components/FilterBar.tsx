import { Filter } from 'lucide-react';
import { MultiSelect } from './common/MultiSelect';

interface Props {
  companies: string[];
  selectedCompanies: string[];
  onSelectedCompaniesChange: (v: string[]) => void;
  // Aksiyon sekmesinde gösterilir; undefined ise gizlenir
  sorumlular?: string[];
  selectedSorumlular?: string[];
  onSelectedSorumlularChange?: (v: string[]) => void;
  // Teknik sekmesinde gösterilir; undefined ise gizlenir
  technicalStatuses?: string[];
  selectedTechnicalStatuses?: string[];
  onSelectedTechnicalStatusesChange?: (v: string[]) => void;
}

export function FilterBar({
  companies,
  selectedCompanies,
  onSelectedCompaniesChange,
  sorumlular,
  selectedSorumlular,
  onSelectedSorumlularChange,
  technicalStatuses,
  selectedTechnicalStatuses,
  onSelectedTechnicalStatusesChange,
}: Props) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3 text-slate-700">
        <Filter size={16} />
        <span className="text-sm font-medium">Filtreler</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MultiSelect
          label="Şirket"
          options={companies}
          selected={selectedCompanies}
          onChange={onSelectedCompaniesChange}
          placeholder="Şirket ara..."
        />
        {sorumlular && onSelectedSorumlularChange && (
          <MultiSelect
            label="Sorumlu"
            options={sorumlular}
            selected={selectedSorumlular ?? []}
            onChange={onSelectedSorumlularChange}
            placeholder="Sorumlu ara..."
          />
        )}
        {technicalStatuses && onSelectedTechnicalStatusesChange && (
          <MultiSelect
            label="Teknik Durum"
            options={technicalStatuses}
            selected={selectedTechnicalStatuses ?? []}
            onChange={onSelectedTechnicalStatusesChange}
            placeholder="Durum ara..."
            allLabel="Tüm durumlar"
          />
        )}
      </div>
    </div>
  );
}
