const FINANCIAL_HORIZON_CONTRACT = 'financial-horizon-v1';

function nonNegativeNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(name + ' must be a non-negative number');
  return n;
}

function rate(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= -1) throw new Error(name + ' must be greater than -100%');
  return n;
}

function positiveInteger(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(name + ' must be a positive integer');
  return n;
}

/**
 * Five-year nominal cash-flow and NPV model.
 *
 * This is a transparent planning model, not a forecast. Annual recoverable value
 * and OPEX are grown independently so the user can see which assumption drives
 * the result. The first-year upfront investment is paid at t=0.
 */
export function calculateFinancialHorizon(input = {}) {
  const years = positiveInteger(input.years ?? 5, 'years');
  const annualRecoverableValue = nonNegativeNumber(input.annualRecoverableValue, 'annualRecoverableValue');
  const upfrontInvestment = nonNegativeNumber(input.upfrontInvestment ?? 0, 'upfrontInvestment');
  const annualOpex = nonNegativeNumber(input.annualOpex ?? 0, 'annualOpex');
  const valueGrowthRate = rate(input.valueGrowthRate ?? 0, 'valueGrowthRate');
  const opexEscalationRate = rate(input.opexEscalationRate ?? 0, 'opexEscalationRate');
  const discountRate = rate(input.discountRate ?? 0, 'discountRate');

  const cashFlows = [];
  let nominalRecoverableValue = 0;
  let nominalOpex = 0;
  let nominalNetValue = 0;
  let npv = -upfrontInvestment;

  for (let year = 1; year <= years; year += 1) {
    const recoverable = annualRecoverableValue * ((1 + valueGrowthRate) ** (year - 1));
    const opex = annualOpex * ((1 + opexEscalationRate) ** (year - 1));
    const net = recoverable - opex;
    const discountFactor = (1 + discountRate) ** year;
    const discountedNet = net / discountFactor;

    nominalRecoverableValue += recoverable;
    nominalOpex += opex;
    nominalNetValue += net;
    npv += discountedNet;
    cashFlows.push({
      year,
      recoverableValue: Math.round(recoverable),
      opex: Math.round(opex),
      netValue: Math.round(net),
      discountedNetValue: Math.round(discountedNet),
    });
  }

  const totalNominalInvestment = upfrontInvestment + nominalOpex;
  const fiveYearRoiPercent = upfrontInvestment
    ? ((nominalNetValue - upfrontInvestment) / upfrontInvestment) * 100
    : null;
  const discountedPaybackYear = (() => {
    let cumulative = -upfrontInvestment;
    for (const row of cashFlows) {
      cumulative += row.netValue / ((1 + discountRate) ** row.year);
      if (cumulative >= 0) return row.year;
    }
    return null;
  })();

  return {
    contractVersion: FINANCIAL_HORIZON_CONTRACT,
    years,
    assumptions: {
      annualRecoverableValue: Math.round(annualRecoverableValue),
      upfrontInvestment: Math.round(upfrontInvestment),
      annualOpex: Math.round(annualOpex),
      valueGrowthRate,
      opexEscalationRate,
      discountRate,
    },
    totals: {
      nominalRecoverableValue: Math.round(nominalRecoverableValue),
      nominalOpex: Math.round(nominalOpex),
      nominalNetValue: Math.round(nominalNetValue),
      totalNominalInvestment: Math.round(totalNominalInvestment),
      npv: Math.round(npv),
      fiveYearRoiPercent: fiveYearRoiPercent == null ? null : Math.round(fiveYearRoiPercent),
      discountedPaybackYear,
    },
    cashFlows,
  };
}

export { FINANCIAL_HORIZON_CONTRACT };
