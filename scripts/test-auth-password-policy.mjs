import assert from 'node:assert/strict';
import { validatePasswordPolicy } from '../src/auth-proxy.js';
assert.equal(validatePasswordPolicy('Abcdef12'),true);
assert.equal(validatePasswordPolicy('abcdefgh'),false);
assert.equal(validatePasswordPolicy('ABCDEFGH1'),false);
assert.equal(validatePasswordPolicy('Abcdefgh'),false);
assert.equal(validatePasswordPolicy('Abc1'),false);
console.log('auth-password-policy: PASS');
