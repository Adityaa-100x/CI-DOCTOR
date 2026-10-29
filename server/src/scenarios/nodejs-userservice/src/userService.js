export function calculateUserDiscount(user, cartTotal) {
  // BUG: Missing null check - crashes if user is null or tier is undefined
  if (user.tier.toLowerCase() === 'vip') {
    return cartTotal * 0.20;
  } else if (user.tier.toLowerCase() === 'gold') {
    return cartTotal * 0.10;
  }
  return 0;
}

export function formatUserAddress(user) {
  // BUG: Unhandled TypeError if profile or address is null/undefined
  return `${user.profile.address.street}, ${user.profile.address.city}`;
}

