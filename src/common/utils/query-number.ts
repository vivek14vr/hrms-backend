export function optionalQueryNumber(value?: string) {
  if (value === undefined || value.trim() === '') return undefined;
  return Number(value);
}
