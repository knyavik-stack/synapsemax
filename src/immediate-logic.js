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
  const monthlyLaborCost = money(input.monthlyLaborCost ?? input.monthlyCost ?? 0);
  const monthlyErrorCost = money(input.monthlyErrorCost ?? 0);
  const monthlyDelayCost = money(input.monthlyDelayCost ?? 0);
  const manualWorkShare = percent(input.manualWorkShare ?? input.automationShare ?? 0);
  const recoverableManualShare = percent(input.recoverableManualShare ?? input.expectedEfficiency ?? 0);
  const recoverableErrorShare = percent(input.recoverableErrorShare ?? 0);
  const recoverableDelayShare = percent(input.recoverableDelayShare ?? 0);
  const implementationCost = money(input.implementationCost ?? 0);
  const monthlyRevenue = money(input.monthlyRevenue ?? 0);
  const baselineMarginPercent = percent(input.baselineMarginPercent ?? 0);
  const manualLeakage = monthlyLaborCost * manualWorkShare;
  const recoverableManualLeakage = manualLeakage * recoverableManualShare;
  const recoverableErrorLeakage = monthlyErrorCost * recoverableErrorShare;
  const recoverableDelayLeakage = monthlyDelayCost * recoverableDelayShare;
  const totalMonthlyLeakage = manualLeakage + monthlyErrorCost + monthlyDelayCost;
  const recoverableMonthlyValue = recoverableManualLeakage + recoverableErrorLeakage + recoverableDelayLeakage;
  const annualRecoverableValue = recoverableMonthlyValue * 12;
  const roiPercent = implementationCost ? ((annualRecoverableValue - implementationCost) / implementationCost) * 100 : null;
  const paybackMonths = recoverableMonthlyValue ? implementationCost / recoverableMonthlyValue : null;
  const marginUpliftPoints = monthlyRevenue ? (recoverableMonthlyValue / monthlyRevenue) * 100 : null;
  const projectedMarginPercent = monthlyRevenue ? baselineMarginPercent * 100 + (recoverableMonthlyValue / monthlyRevenue) * 100 : null;
  const sources = [
    { key: 'manual', leakage: manualLeakage, recoverable: recoverableManualLeakage, action: 'Оптимизация процесса / автоматизация ручных операций' },
    { key: 'errors', leakage: monthlyErrorCost, recoverable: recoverableErrorLeakage, action: 'Контроли, валидация и устранение первопричин ошибок' },
    { key: 'delays', leakage: monthlyDelayCost, recoverable: recoverableDelayLeakage, action: 'Устранение bottleneck и redesign процесса' }
  ].sort((a, b) => b.leakage - a.leakage);
  return {
    manualLeakage: Math.round(manualLeakage),
    recoverableManualLeakage: Math.round(recoverableManualLeakage),
    errorLeakage: Math.round(monthlyErrorCost),
    recoverableErrorLeakage: Math.round(recoverableErrorLeakage),
    delayLeakage: Math.round(monthlyDelayCost),
    recoverableDelayLeakage: Math.round(recoverableDelayLeakage),
    totalMonthlyLeakage: Math.round(totalMonthlyLeakage),
    recoverableMonthlyValue: Math.round(recoverableMonthlyValue),
    annualRecoverableValue: Math.round(annualRecoverableValue),
    roiPercent: roiPercent == null ? null : Math.round(roiPercent),
    paybackMonths: paybackMonths == null ? null : Math.round(paybackMonths * 10) / 10,
    marginUpliftPoints: marginUpliftPoints == null ? null : Math.round(marginUpliftPoints * 10) / 10,
    projectedMarginPercent: projectedMarginPercent == null ? null : Math.round(projectedMarginPercent * 10) / 10,
    prioritySource: sources[0]?.key ?? null,
    actionMap: sources.map(({ key, leakage, recoverable, action }) => ({ key, leakage: Math.round(leakage), recoverable: Math.round(recoverable), action })),
    assumptions: ['Доля возврата для ошибок и задержек задаётся отдельно; по умолчанию 0, чтобы не приписывать клиенту гарантированный эффект.', 'Эффект и ROI являются сценарной оценкой до верификации исходных данных клиента.']
  };
}
