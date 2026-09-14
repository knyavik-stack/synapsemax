export function assess(input = {}) {
  const clamp = (v) => Math.min(100, Math.max(0, Number(v) || 0));
  const profile = { complexity: clamp(input.complexity ?? 58), manualWork: clamp(input.manualWork ?? 52), dataFragmentation: clamp(input.dataFragmentation ?? 61), errorRate: clamp(input.errorRate ?? 28) };
  const automationPotential = Math.round(profile.manualWork * .42 + profile.dataFragmentation * .18 + profile.errorRate * .22 + profile.complexity * .18);
  const aiReadiness = Math.round((100 - profile.dataFragmentation) * .25 + (100 - profile.manualWork) * .2 + (100 - profile.errorRate) * .15 + profile.complexity * .4);
  return { score: Math.round(Object.values(profile).reduce((a, b) => a + b, 0) / 4), aiReadiness, automationPotential, priority: automationPotential >= 70 ? 'Высокий' : automationPotential >= 45 ? 'Средний' : 'Низкий', profile };
}

export function calculateRoi(input = {}) {
  const cost = Math.max(0, Number(input.monthlyCost ?? 1000000));
  const share = Math.min(.9, Math.max(0, Number(input.automationShare ?? 35) / 100));
  const efficiency = Math.min(.8, Math.max(0, Number(input.expectedEfficiency ?? 25) / 100));
  const implementation = Math.max(0, Number(input.implementationCost ?? 1500000));
  const monthlySaving = cost * share * efficiency;
  const annualSaving = monthlySaving * 12;
  return { monthlySaving: Math.round(monthlySaving), annualSaving: Math.round(annualSaving), roiPercent: implementation ? Math.round(((annualSaving - implementation) / implementation) * 100) : 0, paybackMonths: monthlySaving ? Math.round((implementation / monthlySaving) * 10) / 10 : null };
}

export function diagnoseProfitLeakage(input = {}) {
  const money = (v) => Math.max(0, Number(v) || 0);
  const percent = (v) => Math.min(100, Math.max(0, Number(v) || 0)) / 100;
  const clampFactor = (v, fallback) => Math.min(2, Math.max(0, Number.isFinite(Number(v)) ? Number(v) : fallback));
  const monthlyLaborCost = money(input.monthlyLaborCost ?? input.monthlyCost ?? 0);
  const monthlyErrorCost = money(input.monthlyErrorCost ?? 0);
  const monthlyDelayCost = money(input.monthlyDelayCost ?? 0);
  const manualWorkShare = percent(input.manualWorkShare ?? input.automationShare ?? 0);
  const recoverableManualShare = percent(input.recoverableManualShare ?? input.expectedEfficiency ?? 0);
  const recoverableErrorShare = percent(input.recoverableErrorShare ?? 0);
  const recoverableDelayShare = percent(input.recoverableDelayShare ?? 0);
  const implementationCost = money(input.implementationCost ?? 0);
  const oneTimeCapex = money(input.oneTimeCapex ?? 0);
  const monthlyOpex = money(input.monthlyOpex ?? 0);
  const annualOpex = money(input.annualOpex ?? 0);
  const monthlyRevenue = money(input.monthlyRevenue ?? 0);
  const baselineMarginPercent = percent(input.baselineMarginPercent ?? 0);
  const evidenceQuality = input.evidenceQuality == null ? 0 : Math.min(100, Math.max(0, Number(input.evidenceQuality) || 0));

  const manualLeakage = monthlyLaborCost * manualWorkShare;
  const recoverableManualLeakage = manualLeakage * recoverableManualShare;
  const recoverableErrorGross = monthlyErrorCost * recoverableErrorShare;
  const recoverableDelayGross = monthlyDelayCost * recoverableDelayShare;

  // Secondary loss buckets can overlap with a primary bucket. We subtract the explicitly
  // declared overlap instead of silently adding the same economic damage twice.
  const errorOverlapShare = percent(input.errorOverlapShare ?? 0);
  const delayOverlapShare = percent(input.delayOverlapShare ?? 0);
  const errorDelayOverlapShare = percent(input.errorDelayOverlapShare ?? 0);
  const recoverableErrorLeakage = recoverableErrorGross * (1 - errorOverlapShare);
  const recoverableDelayAfterPrimary = recoverableDelayGross * (1 - delayOverlapShare);
  const recoverableDelayLeakage = recoverableDelayAfterPrimary * (1 - errorDelayOverlapShare);
  const grossRecoverableMonthlyValue = recoverableManualLeakage + recoverableErrorGross + recoverableDelayGross;
  const recoverableMonthlyValue = recoverableManualLeakage + recoverableErrorLeakage + recoverableDelayLeakage;
  const totalMonthlyLeakage = manualLeakage + monthlyErrorCost + monthlyDelayCost;

  const upfrontInvestment = implementationCost + oneTimeCapex;
  const monthlyOngoingCost = monthlyOpex + annualOpex / 12;
  const netMonthlyValue = Math.max(0, recoverableMonthlyValue - monthlyOngoingCost);
  const annualRecoverableValue = recoverableMonthlyValue * 12;
  const annualNetValue = Math.max(0, annualRecoverableValue - monthlyOpex * 12 - annualOpex);
  const roiPercent = upfrontInvestment ? ((annualNetValue - upfrontInvestment) / upfrontInvestment) * 100 : null;
  const paybackMonths = netMonthlyValue ? upfrontInvestment / netMonthlyValue : null;
  const marginUpliftPoints = monthlyRevenue ? (netMonthlyValue / monthlyRevenue) * 100 : null;
  const projectedMarginPercent = monthlyRevenue ? baselineMarginPercent * 100 + marginUpliftPoints : null;

  const scenarioFactors = input.scenarioFactors ?? {};
  const factors = {
    conservative: clampFactor(scenarioFactors.conservative, 0.7),
    base: clampFactor(scenarioFactors.base, 1),
    optimistic: clampFactor(scenarioFactors.optimistic, 1.15),
  };
  const scenarios = Object.fromEntries(Object.entries(factors).map(([name, factor]) => {
    const monthlyValue = Math.max(0, netMonthlyValue * factor);
    const annualValue = monthlyValue * 12;
    const roi = upfrontInvestment ? ((annualValue - upfrontInvestment) / upfrontInvestment) * 100 : null;
    const payback = monthlyValue ? upfrontInvestment / monthlyValue : null;
    return [name, {
      factor,
      monthlyValue: Math.round(monthlyValue),
      annualValue: Math.round(annualValue),
      roiPercent: roi == null ? null : Math.round(roi),
      paybackMonths: payback == null ? null : Math.round(payback * 10) / 10,
    }];
  }));

  const dataQuality = {
    evidenceQuality: Math.round(evidenceQuality),
    label: evidenceQuality >= 80 ? 'Высокая' : evidenceQuality >= 50 ? 'Средняя' : 'Низкая',
    missingEvidence: [
      ...(monthlyLaborCost ? [] : ['monthlyLaborCost']),
      ...(monthlyErrorCost ? [] : ['monthlyErrorCost']),
      ...(monthlyDelayCost ? [] : ['monthlyDelayCost']),
      ...(recoverableManualShare ? [] : ['recoverableManualShare']),
    ],
  };

  const sources = [
    { key: 'manual', leakage: manualLeakage, recoverable: recoverableManualLeakage, action: 'Оптимизация процесса / автоматизация ручных операций' },
    { key: 'errors', leakage: monthlyErrorCost, recoverable: recoverableErrorLeakage, action: 'Контроли, валидация и устранение первопричин ошибок' },
    { key: 'delays', leakage: monthlyDelayCost, recoverable: recoverableDelayLeakage, action: 'Устранение bottleneck и redesign процесса' }
  ].sort((a, b) => b.leakage - a.leakage);

  const overlapAdjustment = grossRecoverableMonthlyValue - recoverableMonthlyValue;
  return {
    manualLeakage: Math.round(manualLeakage), recoverableManualLeakage: Math.round(recoverableManualLeakage),
    errorLeakage: Math.round(monthlyErrorCost), recoverableErrorLeakage: Math.round(recoverableErrorLeakage),
    delayLeakage: Math.round(monthlyDelayCost), recoverableDelayLeakage: Math.round(recoverableDelayLeakage),
    totalMonthlyLeakage: Math.round(totalMonthlyLeakage), recoverableMonthlyValue: Math.round(recoverableMonthlyValue),
    grossRecoverableMonthlyValue: Math.round(grossRecoverableMonthlyValue), overlapAdjustment: Math.round(overlapAdjustment),
    annualRecoverableValue: Math.round(annualRecoverableValue), annualNetValue: Math.round(annualNetValue),
    upfrontInvestment: Math.round(upfrontInvestment), monthlyOngoingCost: Math.round(monthlyOngoingCost),
    roiPercent: roiPercent == null ? null : Math.round(roiPercent),
    paybackMonths: paybackMonths == null ? null : Math.round(paybackMonths * 10) / 10,
    marginUpliftPoints: marginUpliftPoints == null ? null : Math.round(marginUpliftPoints * 10) / 10,
    projectedMarginPercent: projectedMarginPercent == null ? null : Math.round(projectedMarginPercent * 10) / 10,
    dataQuality, scenarios,
    prioritySource: sources[0]?.key ?? null,
    actionMap: sources.map(({ key, leakage, recoverable, action }) => ({ key, leakage: Math.round(leakage), recoverable: Math.round(recoverable), action })),
    assumptions: [
      'Доля возврата для ошибок и задержек задаётся отдельно; по умолчанию 0, чтобы не приписывать клиенту гарантированный эффект.',
      'Пересечение потерь учитывается только там, где клиент явно указал overlap; без evidence модель не делает автоматического вычета.',
      'Сценарии по умолчанию: conservative 70%, base 100%, optimistic 115% от очищенного эффекта; коэффициенты являются сценарными, а не прогнозом.',
      'ROI и окупаемость учитывают разовые инвестиции и OPEX; расчёт не является гарантией экономического эффекта до проверки исходных данных.'
    ]
  };
}
