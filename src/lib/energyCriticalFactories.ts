export const ENERGY_CRITICAL_FACTORY_NAMES: Record<string, string> = {
  '201': 'KA',
  '204': 'PVC',
  '205': 'YYPE',
  '206': 'AYPE',
  '207': 'PP',
  '212': 'PA',
  '214': 'Etilen',
  '215': 'AROM',
  '219': 'AYPE-T',
  '251': 'Su',
  '253': 'BÜ',
  '254': 'EÜ',
  '264': 'OB',
  '273': 'AGÜ',
};

export function energyCriticalFactoryLabel(businessArea: string) {
  const code = businessArea.trim();
  const name = ENERGY_CRITICAL_FACTORY_NAMES[code];
  return name ? `${code} - ${name}` : code;
}
