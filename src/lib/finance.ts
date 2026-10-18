/**
 * Simple, transparent illustrative model. Not a forecast or investment offer.
 *
 * Distributable cash flow = gross revenue − operating expenses − equipment reserve.
 * The owner/investor split is applied to that amount, i.e. AFTER opex and reserve
 * but BEFORE recovering the initial investment, taxes and financing costs.
 *  • 'share' model: the owner receives a percentage of the distributable cash flow.
 *  • 'fixed_rent' model: the owner receives a fixed yearly rent (paid even when the
 *    cash flow is low); the investor receives the remainder.
 * Simple payback = installation cost ÷ investor annual cash flow (only if > 0).
 */

export type SplitMode = 'share' | 'fixed_rent';

export interface FinanceInputs {
  capacityKw: number;
  yieldKwhPerKw: number;
  tariffIlsPerKwh: number;
  installCostIls: number;
  opexIlsYear: number;
  reserveIlsYear: number;
  ownerSharePct: number;
  /** Defaults to 'share'. */
  splitMode?: SplitMode;
  /** Yearly rent to the owner in the 'fixed_rent' model, ₪. */
  ownerFixedRentIls?: number;
}

export interface FinanceResult {
  annualKwh: number;
  gross: number;
  distributable: number;
  owner: number;
  investor: number;
  ownerMonthly: number;
  investorMonthly: number;
  /** Owner's actual share of the distributable cash flow, %; null when it is not positive. */
  ownerPctOfDistributable: number | null;
  /** null = no payback in this scenario */
  paybackYears: number | null;
}

export const DEFAULT_ASSUMPTIONS = {
  sqmPerKw: 6.5,
  yieldKwhPerKw: 1650,
  // Illustrative commercial-scale sale price. Deliberately NOT a residential tariff.
  tariffIlsPerKwh: 0.3,
  installCostPerKw: 2800,
  opexPerKwYear: 45,
  reservePerKwYear: 20,
  ownerSharePct: 12,
} as const;

const finite = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * Starting assumptions for a roof. When a yearly fixed rent is given (fixed-rent
 * listings: requested ₪/m² × usable m²), the calculator starts in that model.
 */
export function defaultInputsFor(
  usableAreaSqm: number,
  ownerSharePct?: number | null,
  yieldKwhPerKw?: number,
  fixedRentIlsYear?: number | null,
): FinanceInputs {
  const a = DEFAULT_ASSUMPTIONS;
  const capacityKw = Math.max(10, Math.round(finite(usableAreaSqm) / a.sqmPerKw / 5) * 5);
  const hasRent = typeof fixedRentIlsYear === 'number' && Number.isFinite(fixedRentIlsYear) && fixedRentIlsYear > 0;
  return {
    capacityKw,
    yieldKwhPerKw: yieldKwhPerKw ?? a.yieldKwhPerKw,
    tariffIlsPerKwh: a.tariffIlsPerKwh,
    installCostIls: Math.round((capacityKw * a.installCostPerKw) / 1000) * 1000,
    opexIlsYear: Math.round(capacityKw * a.opexPerKwYear),
    reserveIlsYear: Math.round(capacityKw * a.reservePerKwYear),
    ownerSharePct: ownerSharePct ?? a.ownerSharePct,
    splitMode: hasRent ? 'fixed_rent' : 'share',
    ownerFixedRentIls: hasRent ? Math.round(fixedRentIlsYear) : 0,
  };
}

export function calculate(i: FinanceInputs): FinanceResult {
  const annualKwh = Math.max(0, finite(i.capacityKw)) * Math.max(0, finite(i.yieldKwhPerKw));
  const gross = annualKwh * Math.max(0, finite(i.tariffIlsPerKwh));
  const distributable = gross - Math.max(0, finite(i.opexIlsYear)) - Math.max(0, finite(i.reserveIlsYear));

  let owner: number;
  if (i.splitMode === 'fixed_rent') {
    // Rent is owed regardless of production; the investor carries any shortfall.
    owner = Math.max(0, finite(i.ownerFixedRentIls));
  } else {
    const share = Math.min(100, Math.max(0, finite(i.ownerSharePct))) / 100;
    // When there is nothing to distribute, the owner receives nothing.
    owner = distributable > 0 ? distributable * share : 0;
  }
  const investor = distributable - owner;

  const cost = Math.max(0, finite(i.installCostIls));
  const paybackYears = investor > 0 && cost > 0 ? cost / investor : null;
  return {
    annualKwh,
    gross,
    distributable,
    owner,
    investor,
    ownerMonthly: owner / 12,
    investorMonthly: investor / 12,
    ownerPctOfDistributable: distributable > 0 ? (owner / distributable) * 100 : null,
    paybackYears,
  };
}
