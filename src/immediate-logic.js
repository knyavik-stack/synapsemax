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
