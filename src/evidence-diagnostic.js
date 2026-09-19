import { diagnoseProfitLeakage } from './immediate-logic.js';

export const FINANCIAL_DIAGNOSTIC_CONTRACT = 'p1-evidence-backed-v1';

const SCENARIOS = ['conservative', 'base', 'optimistic'];
const QUALITY_WEIGHT = { low: 0.55, medium: 0.8, high: 1 };

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(name + ' must be an object');
}

function normalizeQuality(value) {
  const quality = String(value ?? '').toLowerCase();
  if (!Object.hasOwn(QUALITY_WEIGHT, quality)) throw new Error('evidence quality must be low, medium or high');
  return quality;
}

function numericValue(evidence, metric) {
  const value = evidence.value;
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && typeof value.amount === 'number') return value.amount;
  throw new Error('Evidence ' + metric + ' requires a numeric value');
}

export function buildEvidenceModel(input = {}) {
  assertObject(input, 'input');
  const rawEvidence = Array.isArray(input.evidence) ? input.evidence : [];
  const evidence = rawEvidence.map((item, index) => {
    assertObject(item, 'evidence[' + index + ']');
    const metric = String(item.metric ?? '').trim();
    const sourceType = String(item.sourceType ?? '').trim();
    const sourceRef = String(item.sourceRef ?? '').trim();
    if (!metric || !sourceType || !sourceRef) throw new Error('evidence[' + index + '] requires metric, sourceType and sourceRef');
    const quality = normalizeQuality(item.quality);
    const numeric = numericValue(item, metric);
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error('evidence[' + index + '] numeric value must be finite and non-negative');
    return {
      metric,
      sourceType,
      sourceRef,
      observedAt: item.observedAt ?? new Date().toISOString(),
      collectedAt: item.collectedAt ?? new Date().toISOString(),
      value: item.value,
      unit: String(item.unit ?? 'RUB/month'),
      quality,
      confidenceWeight: QUALITY_WEIGHT[quality],
      metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
      provenanceHash: String(item.provenanceHash ?? ''),
      numericValue: numeric,
    };
  });

  const byMetric = new Map();
  for (const item of evidence) {
    if (!byMetric.has(item.metric)) byMetric.set(item.metric, []);
    byMetric.get(item.metric).push(item);
  }

  const aggregate = (metric) => {
    const rows = byMetric.get(metric) ?? [];
    if (!rows.length) return { value: 0, confidence: 0, evidenceIds: [] };
    const weight = rows.reduce((sum, row) => sum + row.confidenceWeight, 0);
    const value = rows.reduce((sum, row) => sum + row.numericValue * row.confidenceWeight, 0) / weight;
    return {
      value,
      confidence: Math.round((weight / rows.length) * 100),
      evidenceIds: rows.map((row) => row.id).filter(Boolean),
    };
  };

  return {
    evidence,
    aggregates: {
      monthlyLaborCost: aggregate('monthlyLaborCost'),
      monthlyErrorCost: aggregate('monthlyErrorCost'),
      monthlyDelayCost: aggregate('monthlyDelayCost'),
      monthlyRevenue: aggregate('monthlyRevenue'),
      baselineMarginPercent: aggregate('baselineMarginPercent'),
    },
    evidenceQuality: evidence.length
      ? Math.round(evidence.reduce((sum, row) => sum + row.confidenceWeight, 0) / evidence.length * 100)
      : 0,
  };
}

export function calibrateScenarios(result, evidenceQuality) {
  const quality = Math.max(0, Math.min(100, Number(evidenceQuality) || 0));
  // Scenario spread narrows as evidence quality rises; no scenario becomes a probability.
  const uncertainty = (100 - quality) / 100;
  return {
    conservative: Math.max(0.5, 0.7 - 0.1 * uncertainty),
    base: 1,
    optimistic: Math.min(1.25, 1.15 + 0.1 * uncertainty),
  };
}

export function runEvidenceBackedDiagnostic(input = {}) {
  assertObject(input, 'input');
  const model = buildEvidenceModel(input);
  const p = model.aggregates;
  const explicit = input.calculationInput && typeof input.calculationInput === 'object' ? input.calculationInput : {};

  const calculationInput = {
    ...explicit,
    monthlyLaborCost: explicit.monthlyLaborCost ?? p.monthlyLaborCost.value,
    monthlyErrorCost: explicit.monthlyErrorCost ?? p.monthlyErrorCost.value,
    monthlyDelayCost: explicit.monthlyDelayCost ?? p.monthlyDelayCost.value,
    monthlyRevenue: explicit.monthlyRevenue ?? p.monthlyRevenue.value,
    baselineMarginPercent: explicit.baselineMarginPercent ?? p.baselineMarginPercent.value,
    evidenceQuality: model.evidenceQuality,
  };

  const result = diagnoseProfitLeakage(calculationInput);
  const factors = calibrateScenarios(result, model.evidenceQuality);
  const recalibratedScenarios = Object.fromEntries(SCENARIOS.map((scenario) => {
    const factor = factors[scenario];
    const netMonthlyValue = Math.max(0, Number(result.recoverableMonthlyValue ?? 0) - Number(result.monthlyOngoingCost ?? 0));
    const monthlyValue = Math.max(0, netMonthlyValue * factor);
    const annualValue = monthlyValue * 12;
    const roi = result.upfrontInvestment ? ((annualValue - result.upfrontInvestment) / result.upfrontInvestment) * 100 : null;
    const payback = monthlyValue ? result.upfrontInvestment / monthlyValue : null;
    return [scenario, {
      factor,
      monthlyValue: Math.round(monthlyValue),
      annualValue: Math.round(annualValue),
      roiPercent: roi == null ? null : Math.round(roi),
      paybackMonths: payback == null ? null : Math.round(payback * 10) / 10,
    }];
  }));

  const fiveYear = {};
  for (const scenario of SCENARIOS) {
    const annualNet = recalibratedScenarios[scenario].annualValue;
    const discountRate = Math.max(0, Math.min(0.5, Number(input.discountRate ?? 0.12)));
    let npv = -Number(result.upfrontInvestment ?? 0);
    for (let year = 1; year <= 5; year += 1) npv += annualNet / ((1 + discountRate) ** year);
    fiveYear[scenario] = {
      undiscountedValue: Math.round(annualNet * 5 - Number(result.upfrontInvestment ?? 0)),
      npv: Math.round(npv),
      discountRate,
      horizonYears: 5,
    };
  }

  return {
    contractVersion: FINANCIAL_DIAGNOSTIC_CONTRACT,
    result,
    evidenceModel: {
      evidenceCount: model.evidence.length,
      evidenceQuality: model.evidenceQuality,
      aggregates: model.aggregates,
      attribution: result.actionMap,
    },
    scenarios: recalibratedScenarios,
    fiveYear,
    lineage: {
      sourceRefs: model.evidence.map((row) => row.sourceRef),
      metrics: model.evidence.map((row) => row.metric),
      noDoubleCounting: {
        overlapAdjustmentMonthly: result.overlapAdjustment,
        method: 'explicit-overlap-only',
      },
    },
  };
}
