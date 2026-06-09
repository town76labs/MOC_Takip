import { Modal } from './Modal';

interface Field {
  label: string;
  value: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mocFormNo: string;
  fields: Field[];
}

export function MOCDetailModal({ open, onClose, mocFormNo, fields }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={`MOC ${mocFormNo}`} widthClass="max-w-xl">
      <dl className="space-y-4">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="mb-1 text-xs font-medium uppercase text-slate-500">
              {f.label}
            </dt>
            <dd className="text-sm text-slate-900 whitespace-pre-wrap break-words">
              {f.value || '—'}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
