const test = require('node:test');
const assert = require('node:assert');
const { calculateSubtotal, calculateTotal } = require('../src/cart.js');

test('calculateSubtotal computes sum of item price * quantity', () => {
    const items = [
        { name: 'Mechanical Keyboard', price: 100, quantity: 1 },
        { name: 'USB-C Cable', price: 20, quantity: 2 }
    ];
    assert.strictEqual(calculateSubtotal(items), 140);
});

test('calculateTotal applies discount correctly', () => {
    const items = [
        { name: 'Laptop Stand', price: 100, quantity: 1 }
    ];
    // 100 with 10% discount should be 90.00
    assert.strictEqual(calculateTotal(items, 0.10), 90.00);
});

test('calculateTotal with zero discount returns subtotal', () => {
    const items = [
        { name: 'Mousepad', price: 25, quantity: 1 }
    ];
    assert.strictEqual(calculateTotal(items, 0), 25.00);
});
