const KG_TO_LB = 2.20462;
const LB_TO_KG = 0.453592;

export type WeightUnit = "kg" | "lb";

export function convertWeight(
  weight: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit
): number {
  if (fromUnit === toUnit) return weight;
  return fromUnit === "kg" ? weight * KG_TO_LB : weight * LB_TO_KG;
}

export function toKg(weight: number, unit: WeightUnit): number {
  return unit === "kg" ? weight : weight * LB_TO_KG;
}

export function fromKg(weight: number, unit: WeightUnit): number {
  return unit === "kg" ? weight : weight * KG_TO_LB;
}

export function formatWeight(weight: number, unit: WeightUnit): string {
  return `${weight.toFixed(1)} ${unit}`;
}
