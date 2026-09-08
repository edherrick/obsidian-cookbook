import { describe, it, expect } from "vitest";
import {
	canonicalUnit,
	formatQty,
	fromBaseUnit,
	getUnitDimension,
	isCountUnit,
	isKnownUnit,
	toBaseUnit,
} from "./units";

describe("canonicalUnit", () => {
	it("lowercases", () => {
		expect(canonicalUnit("Cups")).toBe("cups");
	});

	it("drops a trailing abbreviation period", () => {
		// "6 Tbsp. butter" is common in real notes and used to lose its unit
		expect(canonicalUnit("Tbsp.")).toBe("tbsp");
	});

	it("leaves an internal period alone", () => {
		expect(canonicalUnit("fl oz")).toBe("fl oz");
	});
});

describe("isKnownUnit", () => {
	it("recognises an abbreviation with a period", () => {
		expect(isKnownUnit("Tbsp.")).toBe(true);
	});

	it("recognises count units", () => {
		expect(isKnownUnit("cloves")).toBe(true);
		expect(isCountUnit("can")).toBe(true);
	});

	it("rejects a plain word", () => {
		expect(isKnownUnit("butter")).toBe(false);
	});

	it("rejects a two-word string that only starts with a unit", () => {
		expect(isKnownUnit("Tbsp. butter")).toBe(false);
	});
});

describe("getUnitDimension", () => {
	it("classifies volume, weight and count", () => {
		expect(getUnitDimension("cups")).toBe("volume");
		expect(getUnitDimension("kg")).toBe("weight");
		expect(getUnitDimension("cloves")).toBe("count");
	});

	it("returns null for an unknown unit", () => {
		expect(getUnitDimension("smidge")).toBeNull();
	});
});

describe("toBaseUnit / fromBaseUnit", () => {
	it("round-trips a volume through its base", () => {
		const base = toBaseUnit(2, "cups");
		expect(fromBaseUnit(base, "volume", "cups").qty).toBe(2);
	});

	it("converts between compatible volume units", () => {
		expect(fromBaseUnit(toBaseUnit(1, "cup"), "volume", "tbsp").qty).toBeCloseTo(16, 0);
	});

	it("leaves count quantities unconverted", () => {
		expect(fromBaseUnit(3, "count", "cloves")).toEqual({ qty: 3, unit: "cloves" });
	});
});

describe("formatQty", () => {
	it("formats a whole number", () => {
		expect(formatQty(2)).toBe("2");
	});

	it("formats 0.5 as 1/2", () => {
		expect(formatQty(0.5)).toBe("1/2");
	});

	it("formats 0.25 as 1/4", () => {
		expect(formatQty(0.25)).toBe("1/4");
	});

	it("formats 1.5 as 1 1/2", () => {
		expect(formatQty(1.5)).toBe("1 1/2");
	});

	it("formats 2.75 as 2 3/4", () => {
		expect(formatQty(2.75)).toBe("2 3/4");
	});

	it("formats 0.33 as approximately 1/3", () => {
		expect(formatQty(0.33)).toBe("1/3");
	});

	it("formats 0.67 as approximately 2/3", () => {
		expect(formatQty(0.67)).toBe("2/3");
	});

	it("formats 0.125 as 1/8", () => {
		expect(formatQty(0.125)).toBe("1/8");
	});

	it("rounds near-whole fractions up when fractional part exceeds 0.99", () => {
		expect(formatQty(1.995)).toBe("2");
	});
});
