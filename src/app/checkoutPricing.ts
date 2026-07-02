export const DELIVERY_CHARGE = 100;
export const WEEKEND_DISCOUNT = 50;
// Must match server pricing.js
export const PAYMENT_GATEWAY_CHARGE_PERCENT = 2.4;
export const PAYMENT_GATEWAY_CHARGE_RATE = PAYMENT_GATEWAY_CHARGE_PERCENT / 100;
const IST = 'Asia/Kolkata';

export function isWeekendInIST(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short' }).format(date);
  return weekday === 'Sat' || weekday === 'Sun';
}

export function calculateGatewayCharge(preGatewayTotal: number) {
  const base = preGatewayTotal || 0;
  if (base <= 0) return 0;
  return Math.round(base * PAYMENT_GATEWAY_CHARGE_RATE * 100) / 100;
}

export function getCheckoutSummary(cartTotal: number, date = new Date()) {
  const weekendDiscount = isWeekendInIST(date) ? WEEKEND_DISCOUNT : 0;
  const preGatewayTotal = Math.max(0, cartTotal + DELIVERY_CHARGE - weekendDiscount);
  const gatewayCharge = calculateGatewayCharge(preGatewayTotal);
  const finalTotal = Math.round((preGatewayTotal + gatewayCharge) * 100) / 100;

  return {
    subtotal: cartTotal,
    deliveryCharge: DELIVERY_CHARGE,
    weekendDiscount,
    preGatewayTotal: Math.round(preGatewayTotal * 100) / 100,
    gatewayCharge,
    finalTotal,
  };
}

export function getItemsSubtotalFromOrder(order: {
  total_amount: number | string;
  delivery_charge?: number | string | null;
  weekend_discount?: number | string | null;
  gateway_charge?: number | string | null;
}) {
  const total = parseFloat(String(order.total_amount));
  const delivery = parseFloat(String(order.delivery_charge ?? DELIVERY_CHARGE));
  const weekendDiscount = parseFloat(String(order.weekend_discount ?? 0));
  const gatewayCharge = parseFloat(String(order.gateway_charge ?? 0));
  return total - delivery + weekendDiscount - gatewayCharge;
}
