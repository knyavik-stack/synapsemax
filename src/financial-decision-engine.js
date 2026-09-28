const CONTRACT = 'financial-decision-v1';
const SCENARIOS = ['conservative', 'base', 'optimistic'];
import { calculateFinancialHorizon } from './financial-horizon.js';

function money(v, name) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new Error(name + ' must be a finite non-negative number');
  return n;
}
function rate(v, name) {
  const n = Number(v ?? 0.12);
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error(name + ' must be >= 0 and < 1');
  return n;
}
function factor(v, fallback) {
  const n = Number(v ?? fallback);
  if (!Number.isFinite(n) || n < 0 || n > 3) throw new Error('scenario factor must be between 0 and 3');
  return n;
}

export function calculateFinancialDecision(input = {}) {
  const recoverableMonthlyValue = money(input.recoverableMonthlyValue, 'recoverableMonthlyValue');
  const upfrontInvestment = money(input.upfrontInvestment ?? ((input.implementationCost ?? 0) + (input.oneTimeCapex ?? 0)), 'upfrontInvestment');
  const monthlyOpex = money(input.monthlyOpex, 'monthlyOpex');
  const annualOpex = money(input.annualOpex, 'annualOpex');
  const monthlySupport = money(input.monthlySupport, 'monthlySupport');
  const monthlyInfrastructure = money(input.monthlyInfrastructure, 'monthlyInfrastructure');
  const monthlyRevenue = money(input.monthlyRevenue, 'monthlyRevenue');
  const baselineMarginPercent = money(input.baselineMarginPercent, 'baselineMarginPercent');
  if (baselineMarginPercent > 100) throw new Error('baselineMarginPercent must be <= 100');
  const discountRate = rate(input.discountRate, 'discountRate');
  const valueGrowthRate = rate(input.valueGrowthRate ?? 0, 'valueGrowthRate');
  const opexEscalationRate = rate(input.opexEscalationRate ?? 0, 'opexEscalationRate');
  const horizonYears = Math.max(1, Math.floor(Number(input.horizonYears ?? 5)));
  if (!Number.isFinite(horizonYears) || horizonYears > 30) throw new Error('horizonYears must be between 1 and 30');

  const monthlyRecurringCost = monthlyOpex + annualOpex / 12 + monthlySupport + monthlyInfrastructure;
  const baseNetMonthlyBenefit = Math.max(0, recoverableMonthlyValue - monthlyRecurringCost);
  const annualNetBenefit = baseNetMonthlyBenefit * 12;
  const totalTco = upfrontInvestment + monthlyRecurringCost * 12 * horizonYears;
  const undiscountedNetCashBenefit = annualNetBenefit * horizonYears - upfrontInvestment;
  const baseHorizon = calculateFinancialHorizon({
    annualRecoverableValue: annualNetBenefit,
    upfrontInvestment,
    annualOpex: 0,
    valueGrowthRate,
    opexEscalationRate,
    discountRate,
    years: horizonYears,
  });
  const npv = baseHorizon.totals.npv;
  const roiPercent = upfrontInvestment ? ((annualNetBenefit - upfrontInvestment) / upfrontInvestment) * 100 : null;
  const paybackMonths = baseNetMonthlyBenefit > 0 ? upfrontInvestment / baseNetMonthlyBenefit : null;
  const marginUpliftPoints = monthlyRevenue > 0 ? (baseNetMonthlyBenefit / monthlyRevenue) * 100 : null;
  const projectedMarginPercent = monthlyRevenue > 0 ? baselineMarginPercent + (marginUpliftPoints ?? 0) : null;
  const factors = {
    conservative: factor(input.scenarioFactors?.conservative, 0.7),
    base: factor(input.scenarioFactors?.base, 1),
    optimistic: factor(input.scenarioFactors?.optimistic, 1.15),
  };
  const scenarios = Object.fromEntries(SCENARIOS.map((name) => {
    const monthly = baseNetMonthlyBenefit * factors[name];
    const annual = monthly * 12;
    const scenarioHorizon = calculateFinancialHorizon({
      annualRecoverableValue: annual,
      upfrontInvestment,
      annualOpex: 0,
      valueGrowthRate,
      opexEscalationRate,
      discountRate,
      years: horizonYears,
    });
    return [name, {
      factor: factors[name],
      monthlyNetBenefit: Math.round(monthly),
      annualNetBenefit: Math.round(annual),
      npv: scenarioHorizon.totals.npv,
      roiPercent: upfrontInvestment ? Math.round(((annual - upfrontInvestment) / upfrontInvestment) * 100) : null,
      paybackMonths: monthly > 0 ? Math.round(upfrontInvestment / monthly * 10) / 10 : null,
    }];
  }));
  return {
    contractVersion: CONTRACT,
    facts: { recoverableMonthlyValue: Math.round(recoverableMonthlyValue), upfrontInvestment: Math.round(upfrontInvestment), monthlyRecurringCost: Math.round(monthlyRecurringCost), monthlyRevenue: Math.round(monthlyRevenue) },
    assumptions: { discountRate, horizonYears, baselineMarginPercent, valueGrowthRate, opexEscalationRate, scenarioFactors: factors },
    economics: { fiveYearCashFlows: baseHorizon.cashFlows, baseNetMonthlyBenefit: Math.round(baseNetMonthlyBenefit), annualNetBenefit: Math.round(annualNetBenefit), totalTco: Math.round(totalTco), undiscountedNetCashBenefit: Math.round(undiscountedNetCashBenefit), npv: Math.round(npv), roiPercent: roiPercent == null ? null : Math.round(roiPercent), paybackMonths: paybackMonths == null ? null : Math.round(paybackMonths * 10) / 10, marginUpliftPoints: marginUpliftPoints == null ? null : Math.round(marginUpliftPoints * 10) / 10, projectedMarginPercent: projectedMarginPercent == null ? null : Math.round(projectedMarginPercent * 10) / 10 },
    scenarios,
    sensitivity: { recoverableValueMinus10Percent: Math.round((recoverableMonthlyValue * 0.9 - monthlyRecurringCost) * 12), recoverableValuePlus10Percent: Math.round((recoverableMonthlyValue * 1.1 - monthlyRecurringCost) * 12), recurringCostPlus10Percent: Math.round((recoverableMonthlyValue - monthlyRecurringCost * 1.1) * 12) },
    classification: { facts: ['recoverableMonthlyValue', 'upfrontInvestment', 'monthlyRecurringCost'], assumptions: ['discountRate', 'horizonYears', 'baselineMarginPercent', 'scenarioFactors'], scenarioDependent: true },
  };
}
