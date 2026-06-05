const PDFDocument = require('pdfkit');

function money(value) {
  return Number(value || 0).toFixed(2);
}

function dateText(value) {
  if (!value) return '-';
  return new Date(value).toISOString().slice(0, 10);
}

function drawLabelValue(doc, label, value, x, y, width = 240) {
  doc.font('Helvetica-Bold').fontSize(9).text(label, x, y, { width });
  doc.font('Helvetica').fontSize(9).text(value || '-', x + 88, y, { width: width - 88 });
}

function drawLine(doc, y) {
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#D8DEE9').stroke();
}

function drawTableHeader(doc, y) {
  doc.rect(40, y, 515, 22).fill('#EDF2F7');
  doc.fillColor('#1A202C').font('Helvetica-Bold').fontSize(8);
  doc.text('Producto', 48, y + 7, { width: 205 });
  doc.text('Unidad', 258, y + 7, { width: 48 });
  doc.text('Cant.', 310, y + 7, { width: 45, align: 'right' });
  doc.text('Precio', 360, y + 7, { width: 55, align: 'right' });
  doc.text('IGV', 420, y + 7, { width: 55, align: 'right' });
  doc.text('Total', 480, y + 7, { width: 65, align: 'right' });
}

function addPageIfNeeded(doc, y) {
  if (y <= 720) return y;
  doc.addPage();
  drawTableHeader(doc, 50);
  return 78;
}

class QuotationPdfService {
  static build({ header, details }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold').fontSize(18).fillColor('#1A202C').text('Cotizacion', 40, 38);
      doc.font('Helvetica').fontSize(10).text(`Nro. ${header.quotationNumber}`, 420, 42, { align: 'right' });
      doc.fontSize(9).fillColor('#4A5568').text('Documento comercial', 40, 62);
      drawLine(doc, 84);

      doc.fillColor('#1A202C');
      drawLabelValue(doc, 'Fecha', dateText(header.quotationDate), 40, 104);
      drawLabelValue(doc, 'Moneda', header.currency, 40, 122);
      drawLabelValue(doc, 'Estado', header.status || 'emitida', 40, 140);
      drawLabelValue(doc, 'Vendedor', header.sellerName, 310, 104);
      drawLabelValue(doc, 'Correo', header.sellerEmail, 310, 122);

      doc.font('Helvetica-Bold').fontSize(11).text('Cliente', 40, 176);
      drawLine(doc, 192);
      drawLabelValue(doc, 'Nombre', header.customerName, 40, 206, 300);
      drawLabelValue(doc, 'Documento', [header.documentType, header.documentNumber].filter(Boolean).join(' '), 40, 224, 300);
      drawLabelValue(doc, 'Telefono', header.customerPhone, 310, 206, 245);
      drawLabelValue(doc, 'Correo', header.customerEmail, 310, 224, 245);
      drawLabelValue(doc, 'Direccion', header.customerAddress, 40, 242, 500);

      doc.font('Helvetica-Bold').fontSize(11).text('Detalle', 40, 284);
      drawTableHeader(doc, 304);

      let y = 332;
      details.forEach((item) => {
        y = addPageIfNeeded(doc, y);
        const lineHeight = Math.max(22, doc.heightOfString(item.productDescription || '-', { width: 205 }) + 10);
        doc.fillColor('#1A202C').font('Helvetica').fontSize(8);
        doc.text(item.productDescription || '-', 48, y + 5, { width: 205 });
        doc.text(item.unit || 'unidad', 258, y + 5, { width: 48 });
        doc.text(money(item.quantity), 310, y + 5, { width: 45, align: 'right' });
        doc.text(money(item.unitPrice), 360, y + 5, { width: 55, align: 'right' });
        doc.text(money(item.taxAmount), 420, y + 5, { width: 55, align: 'right' });
        doc.text(money(item.total), 480, y + 5, { width: 65, align: 'right' });
        doc.moveTo(40, y + lineHeight).lineTo(555, y + lineHeight).strokeColor('#E2E8F0').stroke();
        y += lineHeight;
      });

      y = addPageIfNeeded(doc, y + 20);
      const totalsX = 360;
      doc.font('Helvetica').fontSize(10).fillColor('#1A202C');
      doc.text('Subtotal', totalsX, y, { width: 90 });
      doc.text(money(header.subtotal), 470, y, { width: 75, align: 'right' });
      doc.text('IGV 18%', totalsX, y + 18, { width: 90 });
      doc.text(money(header.taxTotal), 470, y + 18, { width: 75, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Total', totalsX, y + 40, { width: 90 });
      doc.text(money(header.total), 470, y + 40, { width: 75, align: 'right' });

      y += 82;
      if (header.paymentMethod || header.deliveryDate || header.deliveryMethod || header.comments) {
        y = addPageIfNeeded(doc, y);
        doc.font('Helvetica-Bold').fontSize(11).text('Condiciones', 40, y);
        drawLine(doc, y + 16);
        drawLabelValue(doc, 'Pago', header.paymentMethod, 40, y + 30);
        drawLabelValue(doc, 'Entrega', dateText(header.deliveryDate), 40, y + 48);
        drawLabelValue(doc, 'Forma entrega', header.deliveryMethod, 310, y + 30);
        drawLabelValue(doc, 'Comentarios', header.comments, 40, y + 70, 500);
      }

      doc.end();
    });
  }
}

module.exports = QuotationPdfService;
