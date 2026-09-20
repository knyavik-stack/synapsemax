import assert from 'node:assert/strict';
import { createHttpAdapter } from '../src/integration-adapter.js';
let called=false;
const adapter=createHttpAdapter({name:'demo',baseUrl:'https://erp.example.com/api',token:'t',fetchImpl:async(u,o)=>{called=String(u).endsWith('/health');assert.equal(o.headers.authorization,'Bearer t');return new Response(JSON.stringify({ok:true}),{status:200})}});
const r=await adapter.request('/health');
assert.equal(r.data.ok,true); assert.equal(called,true);
assert.throws(()=>createHttpAdapter({name:'bad',baseUrl:'http://127.0.0.1:8080'}),/Private/);
console.log('integration-adapter: PASS');
