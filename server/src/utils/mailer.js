import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendOrderConfirmationEmail(order, items) {
  if (!resend) {
    console.log(`[Email Mocked] Resend API key not configured. Send confirmation email to ${order.email} for order ${order.order_id}`);
    return;
  }

  try {
    const itemRows = items
      .map(
        (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid rgba(122,96,80,0.15); font-size: 14px; color: #1C0806;">
          ${item.product_name} ${item.variant_color ? `<strong>(${item.variant_color})</strong>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid rgba(122,96,80,0.15); font-size: 14px; text-align: center; color: #1C0806;">
          ${item.quantity}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid rgba(122,96,80,0.15); font-size: 14px; text-align: right; color: #1C0806;">
          ₹${parseFloat(item.price).toFixed(2)}
        </td>
      </tr>
    `
      )
      .join('');

    const deliveryCharge = parseFloat(order.delivery_charge || 100).toFixed(2);
    const weekendDiscount = parseFloat(order.weekend_discount || 0).toFixed(2);
    const gatewayCharge = parseFloat(order.gateway_charge || 0).toFixed(2);
    const subtotal = (parseFloat(order.total_amount) - parseFloat(deliveryCharge) + parseFloat(weekendDiscount) - parseFloat(gatewayCharge)).toFixed(2);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmed — Sunithaprasad Fashion World</title>
      </head>
      <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FDF5E8; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid rgba(122,96,80,0.1);">
          
          <!-- Banner Header -->
          <div style="background-color: #7D1C1C; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-family: Georgia, serif; font-size: 24px; font-weight: bold; letter-spacing: 1px;">
              SUNITHAPRASAD FASHION WORLD
            </h1>
            <p style="color: #F5D08A; margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">
              Luxury Indian Sarees
            </p>
          </div>
          
          <!-- Body Content -->
          <div style="padding: 30px;">
            <h2 style="color: #7D1C1C; font-family: Georgia, serif; font-size: 20px; font-weight: normal; margin-top: 0;">
              Hello ${order.customer_name},
            </h2>
            <p style="color: #7A5F50; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
              Thank you for shopping with us! We are thrilled to confirm that your payment has been verified. Your order is now registered under ID <strong>${order.order_id}</strong>. Below are your invoice details:
            </p>
            
            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
              <thead>
                <tr style="background-color: #FDF5E8;">
                  <th style="padding: 10px; text-align: left; font-size: 13px; color: #7D1C1C; font-weight: bold; border-bottom: 2px solid #C4913A;">Saree / Product Description</th>
                  <th style="padding: 10px; text-align: center; font-size: 13px; color: #7D1C1C; font-weight: bold; border-bottom: 2px solid #C4913A;">Qty</th>
                  <th style="padding: 10px; text-align: right; font-size: 13px; color: #7D1C1C; font-weight: bold; border-bottom: 2px solid #C4913A;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>
            
            <!-- Summary calculations -->
            <div style="max-width: 250px; margin-left: auto; margin-bottom: 30px;">
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 4px 0; color: #7A5F50;">Subtotal:</td>
                  <td style="padding: 4px 0; text-align: right; color: #1C0806;">₹${subtotal}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #7A5F50;">Delivery Charges:</td>
                  <td style="padding: 4px 0; text-align: right; color: #1C0806;">₹${deliveryCharge}</td>
                </tr>
                ${parseFloat(weekendDiscount) > 0 ? `
                <tr>
                  <td style="padding: 4px 0; color: #7A5F50;">Weekend Offer:</td>
                  <td style="padding: 4px 0; text-align: right; color: #059669;">-₹${weekendDiscount}</td>
                </tr>
                ` : ''}
                ${parseFloat(gatewayCharge) > 0 ? `
                <tr>
                  <td style="padding: 4px 0; color: #7A5F50;">Payment gateway charges:</td>
                  <td style="padding: 4px 0; text-align: right; color: #1C0806;">₹${gatewayCharge}</td>
                </tr>
                ` : ''}
                <tr style="font-weight: bold; border-top: 1px solid rgba(122,96,80,0.15);">
                  <td style="padding: 10px 0 4px 0; color: #7D1C1C; font-size: 16px;">Grand Total:</td>
                  <td style="padding: 10px 0 4px 0; text-align: right; color: #7D1C1C; font-size: 16px;">₹${parseFloat(order.total_amount).toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <!-- Shipping Address -->
            <div style="background-color: #FDF5E8; border-radius: 8px; padding: 20px; margin-bottom: 30px; border-left: 4px solid #7D1C1C;">
              <h3 style="color: #7D1C1C; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Shipping Destination</h3>
              <p style="margin: 0; font-size: 13px; color: #1C0806; line-height: 1.5;">
                <strong>${order.customer_name}</strong><br>
                ${order.address}<br>
                ${order.city}, ${order.state} - ${order.pincode}<br>
                Contact: +91 ${order.mobile}
              </p>
            </div>
            
            <p style="color: #7A5F50; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
              We will email you with tracking updates as soon as your sarees are shipped. You can track this order directly in your dashboard anytime.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #FDF5E8; padding: 20px; text-align: center; border-top: 1px solid rgba(122,96,80,0.1);">
            <p style="color: #7A5F50; font-size: 11px; margin: 0 0 5px 0;">
              This is an automated transaction confirmation email. Please do not reply.
            </p>
            <p style="color: #C4913A; font-size: 11px; margin: 0; font-weight: bold;">
              Sunithaprasad Fashion World &copy; 2026. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const fromAddress =
      process.env.EMAIL_FROM || 'Sunitha Prasad Fashion World <orders@sunithaprasadfashionworld.in>';

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: order.email.trim(),
      subject: `Order Confirmed! ID: ${order.order_id} — Sunithaprasad Fashion World`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Resend Mailer] Failed to send confirmation email:', error);
      return { success: false, error };
    }

    console.log(`[Resend Mailer] Confirmation email sent to ${order.email}. Id:`, data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Resend Mailer] Error dispatching confirmation email:', err);
    return { success: false, error: err };
  }
}
