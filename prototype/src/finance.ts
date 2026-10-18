/**
 * Simple, transparent illustrative model. Not a forecast or investment offer.
 *
 * Distributable cash flow = gross revenue − operating expenses − equipment reserve.
 * The owner/investor split is applied to that amount, i.e. AFTER opex and reserve
 * but BEFORE recovering the initial investment, taxes and financing costs.
 * Simple payback = installation cost ÷ investor annual cash flow (only if > 0).
 */

export interface FinanceInputs {
  capacityKw: number;
  yieldKwhPerKw: number; // kWh per installed kW per year
  tariffIlsPerKwh: number;
  installCostIls: number;
  opexIlsYear: number;
  reserveIlsYear: number;
  ownerSharePct: number;
}

export interface FinanceResult {
  annualKwh: number;
  gross: number;
  distributable: number;
  owner: number;
  investor: number;
  ownerMonthly: number;
  investorMonthly: number;
  paybackYears: number | null; // null = no payback in this scenario
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
};

export function defaultInputsFor(usableAreaSqm: number, ownerSharePct?: number): FinanceInputs {
  const a = DEFAULT_ASSUMPTIONS;
  const capacityKw = Math.max(10, Math.round(usableAreaSqm / a.sqmPerKw / 5) * 5);
  return {
    capacityKw,
    yieldKwhPerKw: a.yieldKwhPerKw,
    tariffIlsPerKwh: a.tariffIlsPerKwh,
    installCostIls: Math.round((capacityKw * a.installCostPerKw) / 1000) * 1000,
    opexIlsYear: Math.round(capacityKw * a.opexPerKwYear),
    reserveIlsYear: Math.round(capacityKw * a.reservePerKwYear),
    ownerSharePct: ownerSharePct ?? a.ownerSharePct,
  };
}

export function calculate(i: FinanceInputs): FinanceResult {
  const annualKwh = Math.max(0, i.capacityKw) * Math.max(0, i.yieldKwhPerKw);
  const gross = annualKwh * Math.max(0, i.tariffIlsPerKwh);
  const distributable = gross - i.opexIlsYear - i.reserveIlsYear;
  const share = Math.min(100, Math.max(0, i.ownerSharePct)) / 100;
  // When there is nothing to distribute, neither side receives a positive amount.
  const owner = distributable > 0 ? distributable * share : 0;
  const investor = distributable > 0 ? distributable - owner : distributable;
  const paybackYears = investor > 0 && i.installCostIls > 0 ? i.installCostIls / investor : null;
  return {
    annualKwh,
    gross,
    distributable,
    owner,
    investor,
    ownerMonthly: owner / 12,
    investorMonthly: investor / 12,
    paybackYears,
  };
}
