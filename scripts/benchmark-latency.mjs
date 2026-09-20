const DEFAULT_TARGET_MS = 15;
const url = process.env.SYNAPSEMAX_BENCHMARK_URL;
const iterations = Number(process.env.SYNAPSEMAX_BENCHMARK_ITERATIONS ?? 20);
const targetMs = Number(process.env.SYNAPSEMAX_BENCHMARK_TARGET_MS ?? DEFAULT_TARGET_MS);
if (!url) {
  console.log(JSON.stringify({ contractVersion:'latency-benchmark-v1', status:'not-run', reason:'SYNAPSEMAX_BENCHMARK_URL not configured', targetMs }));
  process.exit(0);
}
if (!Number.isInteger(iterations) || iterations < 5 || iterations > 1000) throw new Error('iterations must be 5..1000');
const samples=[];
for(let i=0;i<iterations;i++){const t=performance.now();const r=await fetch(url,{cache:'no-store'});await r.arrayBuffer();if(!r.ok)throw new Error('benchmark request failed: '+r.status);samples.push(performance.now()-t);}
samples.sort((a,b)=>a-b);
const percentile=p=>samples[Math.min(samples.length-1,Math.ceil(samples.length*p)-1)];
const result={contractVersion:'latency-benchmark-v1',iterations,targetMs,p50Ms:percentile(.50),p95Ms:percentile(.95),maxMs:samples.at(-1),pass:percentile(.95)<=targetMs};
console.log(JSON.stringify(result,null,2));
if(!result.pass)process.exit(2);
