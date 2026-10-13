// E-Commerce Cart Service
function calculateSubtotal(items) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function calculateTotal(items, discountRate = 0) {
    const subtotal = calculateSubtotal(items);
    const discountAmount = subtotal * discountRate;
    // ❌ BUG: Adding discount instead of subtracting
    return Number((subtotal + discountAmount).toFixed(2));
}

module.exports = { calculateSubtotal, calculateTotal };
