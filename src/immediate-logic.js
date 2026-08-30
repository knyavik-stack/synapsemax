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
  const implementationCost = money(input.implementationCost ?? 0);
  const manualLeakage = monthlyLaborCost * manualWorkShare;
  const recoverableManualLeakage = manualLeakage * recoverableManualShare;
  const totalMonthlyLeakage = manualLeakage + monthlyErrorCost + monthlyDelayCost;
  const recoverableMonthlyValue = recoverableManualLeakage + monthlyErrorCost + monthlyDelayCost;
  const annualRecoverableValue = recoverableMonthlyValue * 12;
  const roiPercent = implementationCost ? ((annualRecoverableValue - implementationCost) / implementationCost) * 100 : null;
  const paybackMonths = recoverableMonthlyValue ? implementationCost / recoverableMonthlyValue : null;
  return {
    manualLeakage: Math.round(manualLeakage),
    recoverableManualLeakage: Math.round(recoverableManualLeakage),
    errorLeakage: Math.round(monthlyErrorCost),
    delayLeakage: Math.round(monthlyDelayCost),
    totalMonthlyLeakage: Math.round(totalMonthlyLeakage),
    recoverableMonthlyValue: Math.round(recoverableMonthlyValue),
    annualRecoverableValue: Math.round(annualRecoverableValue),
    roiPercent: roiPercent == null ? null : Math.round(roiPercent),
    paybackMonths: paybackMonths == null ? null : Math.round(paybackMonths * 10) / 10,
    assumptions: ['Ошибки и задержки считаются полностью устранимыми только как сценарная гипотеза; перед инвестиционным решением требуется верификация по данным клиента.']
  };
}
