export const DELIVERY_CHARGE = 100;
export const WEEKEND_DISCOUNT = 50;
// Razorpay gateway fee: 2% + 18% GST on the fee (configurable via env)
export const RAZORPAY_FEE_PERCENT = parseFloat(process.env.RAZORPAY_FEE_PERCENT || '2');
export const RAZORPAY_FEE_GST_PERCENT = parseFloat(process.env.RAZORPAY_FEE_GST_PERCENT || '18');
// Checkout payment gateway charge (flat rate shown to customers)
export const PAYMENT_GATEWAY_CHARGE_PERCENT = parseFloat(process.env.PAYMENT_GATEWAY_CHARGE_PERCENT || '2.4');
export const PAYMENT_GATEWAY_CHARGE_RATE = PAYMENT_GATEWAY_CHARGE_PERCENT / 100;
// Effective Razorpay deduction used for admin net-revenue analytics
export const RAZORPAY_EFFECTIVE_RATE =
  (RAZORPAY_FEE_PERCENT / 100) * (1 + RAZORPAY_FEE_GST_PERCENT / 100);
const IST = 'Asia/Kolkata';

export function calculateGatewayCharge(preGatewayTotal) {
  const base = parseFloat(preGatewayTotal) || 0;
  if (base <= 0) return 0;
  return Math.round(base * PAYMENT_GATEWAY_CHARGE_RATE * 100) / 100;
}

// Razorpay deducts in two steps (e.g. ₹1,070 → 2% = ₹21.40, GST on fee = ₹3.86, total fee ₹25.26)
export function calculateRazorpayFee(grossAmount) {
  const gross = parseFloat(grossAmount) || 0;
  if (gross <= 0) return 0;
  const grossPaisa = Math.round(gross * 100);
  const rzpFeePaisa = Math.round(grossPaisa * RAZORPAY_FEE_PERCENT / 100);
  const gstPaisa = Math.ceil(rzpFeePaisa * RAZORPAY_FEE_GST_PERCENT / 100);
  return (rzpFeePaisa + gstPaisa) / 100;
}

export function calculateNetRevenue(grossAmount) {
  const gross = parseFloat(grossAmount) || 0;
  return Math.round((gross - calculateRazorpayFee(gross)) * 100) / 100;
}

/** Per-order Razorpay fee SQL — matches Razorpay's two-step rounding */
export function razorpayFeeSql(column = 'total_amount') {
  const feeRate = RAZORPAY_FEE_PERCENT / 100;
  const gstRate = RAZORPAY_FEE_GST_PERCENT / 100;
  const rzpFee = `ROUND((${column})::numeric * ${feeRate}, 2)`;
  return `(${rzpFee} + CEIL(${rzpFee} * ${gstRate} * 100) / 100)`;
}

/** Per-order net revenue SQL expression */
export function netRevenueSql(column = 'total_amount') {
  return `ROUND(${column} - ${razorpayFeeSql(column)}, 2)`;
}

export function isWeekendInIST(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short' }).format(date);
  return weekday === 'Sat' || weekday === 'Sun';
}

export function getWeekendDiscount(date = new Date()) {
  return isWeekendInIST(date) ? WEEKEND_DISCOUNT : 0;
}

export function calculateCheckoutTotal(subtotal, date = new Date()) {
  const deliveryCharge = DELIVERY_CHARGE;
  const weekendDiscount = getWeekendDiscount(date);
  const preGatewayTotal = Math.max(0, parseFloat(subtotal) + deliveryCharge - weekendDiscount);
  const gatewayCharge = calculateGatewayCharge(preGatewayTotal);
  const total = Math.round((preGatewayTotal + gatewayCharge) * 100) / 100;

  return {
    subtotal: parseFloat(subtotal),
    deliveryCharge,
    weekendDiscount,
    preGatewayTotal: Math.round(preGatewayTotal * 100) / 100,
    gatewayCharge,
    total,
  };
}

export function getItemsSubtotalFromOrder(order) {
  const total = parseFloat(order.total_amount);
  const delivery = parseFloat(order.delivery_charge || DELIVERY_CHARGE);
  const weekendDiscount = parseFloat(order.weekend_discount || 0);
  const gatewayCharge = parseFloat(order.gateway_charge || 0);
  return total - delivery + weekendDiscount - gatewayCharge;
}
