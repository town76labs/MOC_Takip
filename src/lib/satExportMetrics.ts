import type { SATExportRow } from '../types';

export function getSATItemKey(row: SATExportRow) {
  return `${row.satNo}::${row.satItemNo || row.rowId}`;
}

export function getUniqueSATItemRows(rows: SATExportRow[]) {
  const items = new Map<string, SATExportRow[]>();

  rows.forEach((row) => {
    const key = getSATItemKey(row);
    const current = items.get(key) ?? [];
    current.push(row);
    items.set(key, current);
  });

  return [...items.values()].map((itemRows) => {
    const first = itemRows[0];
    return {
      ...first,
      completed: itemRows.every((row) => row.completed),
      lastDelivery: itemRows.every((row) => row.lastDelivery),
      lastInvoice: itemRows.every((row) => row.lastInvoice),
    };
  });
}

export function sumSATItemUsd(rows: SATExportRow[]) {
  return getUniqueSATItemRows(rows).reduce(
    (total, row) => total + row.satItemUsd,
    0,
  );
}
