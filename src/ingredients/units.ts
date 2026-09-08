/**
 * Unit tables and conversion helpers.
 *
 * Three dimensions are recognised. Volume and weight convert within themselves;
 * "count" units (cloves, cans, sticks…) have no meaningful conversion, so they
 * only ever aggregate when the unit is identical.
 */

export type UnitDimension = "volume" | "weight" | "count";

function buildUnitTable(entries: { factor: number; aliases: string[] }[]): Record<string, number> {
	const table: Record<string, number> = {};
	for (const { factor, aliases } of entries) {
		for (const alias of aliases) table[alias] = factor;
	}
	return table;
}

/** Volume units → ml */
export const VOLUME_ML = buildUnitTable([
	{ factor: 4.92,     aliases: ["tsp", "teaspoon", "teaspoons"] },
	{ factor: 14.79,    aliases: ["tbsp", "tablespoon", "tablespoons", "tbs"] },
	{ factor: 29.57,    aliases: ["fl oz", "fluid oz", "fluid ounce", "fluid ounces"] },
	{ factor: 236.59,   aliases: ["cup", "cups"] },
	{ factor: 473.18,   aliases: ["pt", "pint", "pints"] },
	{ factor: 946.35,   aliases: ["qt", "quart", "quarts"] },
	{ factor: 3785.41,  aliases: ["gal", "gallon", "gallons"] },
	{ factor: 1,        aliases: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"] },
	{ factor: 1000,     aliases: ["l", "liter", "liters", "litre", "litres"] },
]);

/** Weight units → g */
export const WEIGHT_G = buildUnitTable([
	{ factor: 1,      aliases: ["g", "gram", "grams"] },
	{ factor: 1000,   aliases: ["kg", "kilogram", "kilograms"] },
	{ factor: 28.35,  aliases: ["oz", "ounce", "ounces"] },
	{ factor: 453.59, aliases: ["lb", "lbs", "pound", "pounds"] },
]);

/**
 * Countable units. These are not convertible — they exist so the unit is
 * lifted out of the ingredient name ("4 garlic cloves" → 4 cloves of "garlic")
 * rather than polluting it, and so identical counts still sum.
 */
export const COUNT_UNITS: readonly string[] = [
	"clove", "cloves",
	"can", "cans",
	"tin", "tins",
	"jar", "jars",
	"stick", "sticks",
	"bunch", "bunches",
	"slice", "slices",
	"piece", "pieces",
	"package", "packages", "packet", "packets", "pkg",
	"pinch", "pinches",
	"dash", "dashes",
	"head", "heads",
	"sprig", "sprigs",
	"stalk", "stalks",
	"handful", "handfuls",
	"sheet", "sheets",
];

const COUNT_SET = new Set(COUNT_UNITS);

/**
 * Normalise a raw unit token for table lookup: lowercase, and drop a trailing
 * abbreviation period so "Tbsp." resolves the same as "tbsp".
 */
export function canonicalUnit(token: string): string {
	return token.toLowerCase().trim().replace(/\.+$/, "");
}

export function isKnownUnit(token: string): boolean {
	const u = canonicalUnit(token);
	return u in VOLUME_ML || u in WEIGHT_G || COUNT_SET.has(u);
}

export function isCountUnit(token: string): boolean {
	return COUNT_SET.has(canonicalUnit(token));
}

export function getUnitDimension(unit: string): UnitDimension | null {
	const u = canonicalUnit(unit);
	if (u in VOLUME_ML) return "volume";
	if (u in WEIGHT_G) return "weight";
	if (COUNT_SET.has(u)) return "count";
	return null;
}

export function toBaseUnit(qty: number, unit: string): number {
	const u = canonicalUnit(unit);
	return qty * (VOLUME_ML[u] ?? WEIGHT_G[u] ?? 1);
}

export function roundQty(n: number): number {
	return Math.round(n * 100) / 100;
}

/** Convert a base amount (ml or g) back to the preferred display unit. */
export function fromBaseUnit(
	base: number,
	dimension: UnitDimension,
	preferUnit: string,
): { qty: number; unit: string } {
	if (dimension === "count") return { qty: roundQty(base), unit: preferUnit };

	const table = dimension === "volume" ? VOLUME_ML : WEIGHT_G;
	const factor = table[canonicalUnit(preferUnit)];
	if (factor) return { qty: roundQty(base / factor), unit: preferUnit };
	// Fallback
	if (dimension === "volume") {
		if (base >= 236.59) return { qty: roundQty(base / 236.59), unit: "cups" };
		if (base >= 14.79) return { qty: roundQty(base / 14.79), unit: "tbsp" };
		return { qty: roundQty(base / 4.92), unit: "tsp" };
	}
	if (base >= 1000) return { qty: roundQty(base / 1000), unit: "kg" };
	return { qty: roundQty(base), unit: "g" };
}

// Common cooking fractions as [numerator, denominator] pairs, ordered by denominator
const COOKING_FRACTIONS: [number, number][] = [
	[1, 8], [1, 4], [1, 3], [3, 8], [1, 2], [5, 8], [2, 3], [3, 4], [7, 8],
];

/**
 * Format a numeric quantity as a human-readable cooking fraction.
 * e.g. 1.5 → "1 1/2", 0.25 → "1/4", 2 → "2"
 */
export function formatQty(n: number): string {
	if (n <= 0) return String(n);
	const whole = Math.floor(n);
	const frac = n - whole;

	if (frac < 0.01) return String(whole);
	if (frac > 0.99) return String(whole + 1);

	// Snap to nearest common cooking fraction
	let bestNum = 1, bestDen = 2, bestDist = Infinity;
	for (const [num, den] of COOKING_FRACTIONS) {
		const dist = Math.abs(frac - num / den);
		if (dist < bestDist) {
			bestDist = dist;
			bestNum = num;
			bestDen = den;
		}
	}

	// Snapped to 1 whole
	if (bestNum === bestDen) return String(whole + 1);

	const fracStr = `${bestNum}/${bestDen}`;
	return whole > 0 ? `${whole} ${fracStr}` : fracStr;
}
