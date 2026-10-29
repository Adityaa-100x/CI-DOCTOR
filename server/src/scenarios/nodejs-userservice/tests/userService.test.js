import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUserDiscount, formatUserAddress } from '../src/userService.js';

test('calculateUserDiscount handles VIP and standard tiers', () => {
  assert.equal(calculateUserDiscount({ tier: 'VIP' }, 100), 20);
  assert.equal(calculateUserDiscount({ tier: 'standard' }, 100), 0);
});

test('formatUserAddress formats standard address', () => {
  const user = { profile: { address: { street: '123 Tech Way', city: 'Silicon Valley' } } };
  assert.equal(formatUserAddress(user), '123 Tech Way, Silicon Valley');
});

