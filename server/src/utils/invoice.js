import PDFDocument from 'pdfkit';

export function generateInvoicePDF(order, items, stream) {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(stream);

  // Brand Header Accent (Deep Maroon)
  doc.rect(0, 0, doc.page.width, 25).fill('#7D1C1C');

  // Brand Name & Logo Placeholder
  doc.fillColor('#7D1C1C').fontSize(22).font('Helvetica-Bold').text('SUNITHAPRASAD FASHION WORLD', 50, 45);
  doc.fillColor('#C4913A').fontSize(9).font('Helvetica-Bold').text('LUXURY INDIAN SAREES & APPARELS', 50, 68);

  // Invoice Label
  doc.fillColor('#1C0806').fontSize(24).font('Helvetica-Bold').text('INVOICE', 50, 45, { align: 'right' });
  
  // Horizontal Rule
  doc.strokeColor('rgba(122,96,80,0.2)').lineWidth(1).moveTo(50, 85).lineTo(doc.page.width - 50, 85).stroke();

  // Order Details
  doc.fillColor('#1C0806').fontSize(10).font('Helvetica');
  doc.text(`Invoice Number: INVC-${order.order_id.replace('SPFW-', '')}`, 50, 105);
  doc.text(`Order ID: ${order.order_id}`, 50, 120);
  doc.text(`Order Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}`, 50, 135);
  doc.text(`Payment ID: ${order.payment_id || 'Pending'}`, 50, 150);

  // Bill To (Right Aligned Details)
  doc.font('Helvetica-Bold').text('BILL TO:', doc.page.width - 250, 105);
  doc.font('Helvetica').text(order.customer_name, doc.page.width - 250, 120);
  doc.text(order.address, doc.page.width - 250, 135, { width: 200 });
  doc.text(`${order.city}, ${order.state} - ${order.pincode}`, doc.page.width - 250, 150);
  doc.text(`Contact: +91 ${order.mobile}`, doc.page.width - 250, 165);

  doc.moveDown(3);

  // Table Headers
  const tableTop = 210;
  doc.rect(50, tableTop, doc.page.width - 100, 20).fill('#FDF5E8');
  doc.fillColor('#7D1C1C').fontSize(10).font('Helvetica-Bold');
  doc.text('S.No', 60, tableTop + 5);
  doc.text('Product Description', 100, tableTop + 5);
  doc.text('Price (INR)', doc.page.width - 200, tableTop + 5, { align: 'right', width: 60 });
  doc.text('Qty', doc.page.width - 120, tableTop + 5, { align: 'right', width: 20 });
  doc.text('Total (INR)', doc.page.width - 90, tableTop + 5, { align: 'right', width: 30 });

  // Draw Table Lines
  doc.strokeColor('rgba(122,96,80,0.2)').lineWidth(1).moveTo(50, tableTop).lineTo(doc.page.width - 50, tableTop).stroke();
  doc.moveTo(50, tableTop + 20).lineTo(doc.page.width - 50, tableTop + 20).stroke();

  // Draw Items
  let currentY = tableTop + 25;
  doc.fillColor('#1C0806').font('Helvetica');

  items.forEach((item, index) => {
    const desc = `${item.product_name} ${item.variant_color ? ` - Color: ${item.variant_color}` : ''}`;
    const price = parseFloat(item.price).toFixed(2);
    const qty = item.quantity;
    const total = (item.price * item.quantity).toFixed(2);

    doc.text(`${index + 1}`, 60, currentY);
    doc.text(desc, 100, currentY, { width: doc.page.width - 320 });
    doc.text(price, doc.page.width - 200, currentY, { align: 'right', width: 60 });
    doc.text(qty.toString(), doc.page.width - 120, currentY, { align: 'right', width: 20 });
    doc.text(total, doc.page.width - 90, currentY, { align: 'right', width: 30 });

    currentY += 20;
  });

  // Draw boundary line
  doc.strokeColor('rgba(122,96,80,0.15)').moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).stroke();
  currentY += 10;

  // Calculation Breakdown
  const rightColumnX = doc.page.width - 200;
  const deliveryCharge = parseFloat(order.delivery_charge || 100).toFixed(2);
  const weekendDiscount = parseFloat(order.weekend_discount || 0).toFixed(2);
  const gatewayCharge = parseFloat(order.gateway_charge || 0).toFixed(2);
  const totalPaid = parseFloat(order.total_amount).toFixed(2);
  const subtotal = (parseFloat(order.total_amount) - parseFloat(deliveryCharge) + parseFloat(weekendDiscount) - parseFloat(gatewayCharge)).toFixed(2);

  doc.fontSize(10).font('Helvetica');
  doc.text('Subtotal:', rightColumnX, currentY);
  doc.text(`Rs. ${subtotal}`, doc.page.width - 90, currentY, { align: 'right', width: 30 });
  
  currentY += 15;
  doc.text('Delivery Charges:', rightColumnX, currentY);
  doc.text(`Rs. ${deliveryCharge}`, doc.page.width - 90, currentY, { align: 'right', width: 30 });

  if (parseFloat(weekendDiscount) > 0) {
    currentY += 15;
    doc.text('Weekend Offer:', rightColumnX, currentY);
    doc.text(`-Rs. ${weekendDiscount}`, doc.page.width - 90, currentY, { align: 'right', width: 30 });
  }

  if (parseFloat(gatewayCharge) > 0) {
    currentY += 15;
    doc.text('Payment gateway charges:', rightColumnX, currentY);
    doc.text(`Rs. ${gatewayCharge}`, doc.page.width - 90, currentY, { align: 'right', width: 30 });
  }

  currentY += 20;
  doc.rect(rightColumnX - 10, currentY - 5, 170, 22).fill('#7D1C1C');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold');
  doc.text('Grand Total:', rightColumnX, currentY);
  doc.text(`Rs. ${totalPaid}`, doc.page.width - 90, currentY, { align: 'right', width: 30 });

  // Footer Accent (Gold Color)
  const footerY = doc.page.height - 70;
  doc.strokeColor('#C4913A').lineWidth(1.5).moveTo(50, footerY - 5).lineTo(doc.page.width - 50, footerY - 5).stroke();

  doc.fillColor('#7A5F50').fontSize(8).font('Helvetica-Oblique');
  doc.text('Thank you for shopping with Sunithaprasad Fashion World! We are honored to drape you in elegance.', 50, footerY + 5, { align: 'center' });
  doc.text('For returns or support inquiries, contact us at care@sunithaprasad.com.', 50, footerY + 18, { align: 'center' });

  doc.end();
}
