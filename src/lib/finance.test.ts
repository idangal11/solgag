import { describe, expect, it } from 'vitest';
import { calculate, DEFAULT_ASSUMPTIONS, defaultInputsFor, type FinanceInputs } from './finance';

// Worked example used in the product copy: 490 kW × 1,650 kWh/kW × 0.30 ₪ = 242,550 ₪ gross.
const EXAMPLE: FinanceInputs = {
  capacityKw: 490,
  yieldKwhPerKw: 1650,
  tariffIlsPerKwh: 0.3,
  installCostIls: 1_372_000,
  opexIlsYear: 22_050,
  reserveIlsYear: 9_800,
  ownerSharePct: 12,
};

describe('DEFAULT_ASSUMPTIONS', () => {
  it('uses illustrative commercial-scale values, not a residential tariff', () => {
    expect(DEFAULT_ASSUMPTIONS).toEqual({
      sqmPerKw: 6.5,
      yieldKwhPerKw: 1650,
      tariffIlsPerKwh: 0.3,
      installCostPerKw: 2800,
      opexPerKwYear: 45,
      reservePerKwYear: 20,
      ownerSharePct: 12,
    });
  });
});

describe('defaultInputsFor', () => {
  it('derives capacity from usable area (6.5 m² per kW, rounded to 5 kW) and per-kW costs', () => {
    // 3,180 m² ÷ 6.5 = 489.2 kW → 490 kW
    expect(defaultInputsFor(3180)).toEqual({ ...EXAMPLE, splitMode: 'share', ownerFixedRentIls: 0 });
  });

  it('starts in the fixed-rent model when a yearly rent is given', () => {
    const i = defaultInputsFor(3180, null, undefined, 18 * 3180);
    expect(i.splitMode).toBe('fixed_rent');
    expect(i.ownerFixedRentIls).toBe(57_240);
    expect(defaultInputsFor(3180, null, undefined, 0).splitMode).toBe('share');
    expect(defaultInputsFor(3180, null, undefined, Number.NaN).splitMode).toBe('share');
  });

  it('rounds the install cost to whole thousands', () => {
    // 1,000 m² ÷ 6.5 = 153.8 → 155 kW × 2,800 = 434,000
    const i = defaultInputsFor(1000);
    expect(i.capacityKw).toBe(155);
    expect(i.installCostIls).toBe(434_000);
    expect(i.installCostIls % 1000).toBe(0);
    expect(i.opexIlsYear).toBe(155 * 45);
    expect(i.reserveIlsYear).toBe(155 * 20);
  });

  it('never goes below 10 kW, also for missing or invalid areas', () => {
    expect(defaultInputsFor(0).capacityKw).toBe(10);
    expect(defaultInputsFor(20).capacityKw).toBe(10);
    expect(defaultInputsFor(Number.NaN).capacityKw).toBe(10);
    expect(defaultInputsFor(-5000).capacityKw).toBe(10);
  });

  it("uses the listing's owner share and a location yield when given", () => {
    const i = defaultInputsFor(3180, 14, 1720);
    expect(i.ownerSharePct).toBe(14);
    expect(i.yieldKwhPerKw).toBe(1720);
  });

  it('falls back to the default share when the listing has none', () => {
    expect(defaultInputsFor(3180, null).ownerSharePct).toBe(12);
    expect(defaultInputsFor(3180, undefined).ownerSharePct).toBe(12);
  });
});

describe('calculate', () => {
  it('computes the worked example: gross, distributable, split and payback', () => {
    const r = calculate(EXAMPLE);
    expect(r.annualKwh).toBe(808_500);
    expect(r.gross).toBeCloseTo(242_550, 6);
    // Distributable = gross − opex − reserve
    expect(r.distributable).toBeCloseTo(242_550 - 22_050 - 9_800, 6); // 210,700
    // The split is applied after opex + reserve
    expect(r.owner).toBeCloseTo(210_700 * 0.12, 6); // 25,284
    expect(r.investor).toBeCloseTo(210_700 * 0.88, 6); // 185,416
    expect(r.owner + r.investor).toBeCloseTo(r.distributable, 6);
    expect(r.ownerMonthly).toBeCloseTo(r.owner / 12, 6);
    expect(r.investorMonthly).toBeCloseTo(r.investor / 12, 6);
    // Simple payback = install cost ÷ investor annual cash flow
    expect(r.paybackYears).not.toBeNull();
    expect(r.paybackYears!).toBeCloseTo(1_372_000 / 185_416, 6); // ≈ 7.4 years
  });

  it('gives the owner nothing and the investor the shortfall when cash flow is negative', () => {
    const r = calculate({ ...EXAMPLE, opexIlsYear: 300_000 });
    expect(r.distributable).toBeLessThan(0);
    expect(r.owner).toBe(0);
    expect(r.ownerMonthly).toBe(0);
    expect(r.investor).toBeCloseTo(r.distributable, 6);
    expect(r.investor).toBeLessThan(0);
    expect(r.paybackYears).toBeNull();
  });

  it('has no payback when there is exactly nothing to distribute', () => {
    const r = calculate({ ...EXAMPLE, tariffIlsPerKwh: 0, opexIlsYear: 0, reserveIlsYear: 0 });
    expect(r.gross).toBe(0);
    expect(r.distributable).toBe(0);
    expect(r.owner).toBe(0);
    expect(r.investor).toBe(0);
    expect(r.paybackYears).toBeNull();
  });

  it('has no payback when the install cost is zero', () => {
    expect(calculate({ ...EXAMPLE, installCostIls: 0 }).paybackYears).toBeNull();
  });

  it('has no payback when the owner takes 100% of the cash flow', () => {
    const r = calculate({ ...EXAMPLE, ownerSharePct: 100 });
    expect(r.owner).toBeCloseTo(r.distributable, 6);
    expect(r.investor).toBe(0);
    expect(r.paybackYears).toBeNull();
  });

  it('treats NaN and infinite inputs as zero', () => {
    const r = calculate({
      capacityKw: Number.NaN,
      yieldKwhPerKw: Number.POSITIVE_INFINITY,
      tariffIlsPerKwh: Number.NaN,
      installCostIls: Number.NaN,
      opexIlsYear: Number.NaN,
      reserveIlsYear: Number.NEGATIVE_INFINITY,
      ownerSharePct: Number.NaN,
    });
    for (const v of Object.values(r)) {
      if (v !== null) expect(Number.isFinite(v)).toBe(true);
    }
    expect(r).toMatchObject({ annualKwh: 0, gross: 0, distributable: 0, owner: 0, investor: 0, paybackYears: null });
  });

  it('clamps negative quantities to zero instead of producing negative energy or costs', () => {
    const r = calculate({ ...EXAMPLE, capacityKw: -490 });
    expect(r.annualKwh).toBe(0);
    expect(r.gross).toBe(0);

    // Negative opex/reserve must not inflate the cash flow.
    const r2 = calculate({ ...EXAMPLE, opexIlsYear: -50_000, reserveIlsYear: -50_000 });
    expect(r2.distributable).toBeCloseTo(r2.gross, 6);

    // A negative install cost is not a free system: no payback figure.
    expect(calculate({ ...EXAMPLE, installCostIls: -1 }).paybackYears).toBeNull();
  });

  it('clamps the owner share to 0–100%', () => {
    const none = calculate({ ...EXAMPLE, ownerSharePct: -20 });
    expect(none.owner).toBe(0);
    expect(none.investor).toBeCloseTo(none.distributable, 6);

    const all = calculate({ ...EXAMPLE, ownerSharePct: 250 });
    expect(all.owner).toBeCloseTo(all.distributable, 6);
    expect(all.investor).toBe(0);
  });

  it('fixed rent: the owner gets the rent, the investor the remainder of the cash flow', () => {
    const r = calculate({ ...EXAMPLE, splitMode: 'fixed_rent', ownerFixedRentIls: 57_240 });
    expect(r.owner).toBe(57_240);
    expect(r.investor).toBeCloseTo(210_700 - 57_240, 6);
    expect(r.ownerPctOfDistributable).toBeCloseTo((57_240 / 210_700) * 100, 6);
    expect(r.paybackYears!).toBeCloseTo(1_372_000 / (210_700 - 57_240), 6);
  });

  it('fixed rent is still owed when cash flow is negative; the investor carries it', () => {
    const r = calculate({ ...EXAMPLE, opexIlsYear: 300_000, splitMode: 'fixed_rent', ownerFixedRentIls: 50_000 });
    expect(r.owner).toBe(50_000);
    expect(r.investor).toBeCloseTo(r.distributable - 50_000, 6);
    expect(r.ownerPctOfDistributable).toBeNull();
    expect(r.paybackYears).toBeNull();
  });

  it('reports the share percentage only when there is something to distribute', () => {
    expect(calculate(EXAMPLE).ownerPctOfDistributable).toBeCloseTo(12, 6);
    expect(calculate({ ...EXAMPLE, opexIlsYear: 300_000 }).ownerPctOfDistributable).toBeNull();
  });

  it('is consistent with the defaults generated for a listing', () => {
    const r = calculate(defaultInputsFor(3180));
    expect(r.gross).toBeCloseTo(242_550, 6);
    expect(r.paybackYears!).toBeGreaterThan(0);
  });
});
