import assert from 'node:assert/strict';
import { buildNeonAuthTarget, validatePasswordPolicy } from '../src/auth-proxy.js';

assert.equal(validatePasswordPolicy('Abcdef12'),true);
assert.equal(validatePasswordPolicy('abcdefgh'),false);
assert.equal(validatePasswordPolicy('ABCDEFGH1'),false);
assert.equal(validatePasswordPolicy('Abcdefgh'),false);
assert.equal(validatePasswordPolicy('Abc1'),false);

const target = buildNeonAuthTarget(
  'https://synapsemax.ru/api/auth/sign-in/email?foo=bar',
  'https://ep-lively-bread-b1ewktwx.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth',
);
assert.equal(
  target.href,
  'https://ep-lively-bread-b1ewktwx.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth/sign-in/email?foo=bar',
);

console.log('auth-password-policy: PASS');
console.log('auth-proxy-target: PASS');
