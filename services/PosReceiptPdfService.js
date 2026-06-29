const PDFDocument = require('pdfkit');

function money(value) {
  return Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function safe(value, fallback = '-') {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function dateText(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  });
}

function receiptTitle(type) {
  if (type === 'factura') return 'FACTURA ELECTRONICA';
  if (type === 'boleta') return 'BOLETA ELECTRONICA';
  return 'TICKET INTERNO POS';
}

function logoBuffer(dataUrl) {
  if (!dataUrl || !String(dataUrl).startsWith('data:image/')) return null;
  const [, base64] = String(dataUrl).split(',');
  if (!base64) return null;
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

function drawLabelValue(doc, label, value, x, y, width = 230, labelWidth = 70) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#4A5568').text(label, x, y, { width: labelWidth });
  doc.font('Helvetica').fontSize(8).fillColor('#1A202C').text(safe(value), x + labelWidth, y, { width: width - labelWidth });
}

function tableHeader(doc, y, showTax = true) {
  doc.rect(40, y, 515, 24).fill('#1F4E79');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
  doc.text('Descripcion', 48, y + 8, { width: showTax ? 232 : 270 });
  doc.text('Cant.', showTax ? 286 : 330, y + 8, { width: 55, align: 'right' });
  doc.text('P. Unit.', showTax ? 352 : 400, y + 8, { width: 70, align: 'right' });
  if (showTax) doc.text('IGV', 430, y + 8, { width: 48, align: 'right' });
  doc.text('Total', 486, y + 8, { width: 60, align: 'right' });
}

function addPageIfNeeded(doc, y, showTax = true) {
  if (y <= 720) return y;
  doc.addPage();
  tableHeader(doc, 48, showTax);
  return 80;
}

class PosReceiptPdfService {
  static build({ receipt, company = {} }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      const sale = receipt.sale || {};
      const items = receipt.items || [];
      const payments = receipt.payments || [];
      const showTax = sale.receiptType !== 'boleta';

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const logo = logoBuffer(company.logoDataUrl);
      if (logo) {
        try {
          doc.image(logo, 40, 36, { fit: [70, 50] });
        } catch {
          doc.rect(40, 36, 70, 50).strokeColor('#CBD5E0').stroke();
        }
      } else {
        doc.rect(40, 36, 70, 50).strokeColor('#CBD5E0').stroke();
        doc.font('Helvetica').fontSize(8).fillColor('#718096').text('Logo', 40, 58, { width: 70, align: 'center' });
      }

      doc.font('Helvetica-Bold').fontSize(14).fillColor('#1A202C').text(safe(company.legalName || company.name, 'Tienda'), 124, 38, { width: 260 });
      doc.font('Helvetica').fontSize(8).fillColor('#4A5568');
      doc.text(`RUC: ${safe(company.ruc, 'No configurado')}`, 124, 58, { width: 260 });
      doc.text(safe(company.address, 'Direccion no configurada'), 124, 72, { width: 260 });
      doc.text([company.phones && `Tel: ${company.phones}`, company.email].filter(Boolean).join(' | ') || '-', 124, 86, { width: 260 });

      doc.rect(398, 36, 157, 82).strokeColor('#1F4E79').lineWidth(1.2).stroke();
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#1F4E79').text(receiptTitle(sale.receiptType), 410, 52, { width: 133, align: 'center' });
      doc.fontSize(10).fillColor('#1A202C').text(safe(sale.receiptFullNumber), 410, 76, { width: 133, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('#4A5568').text(`Fecha: ${dateText(sale.saleDate)}`, 410, 98, { width: 133, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A202C').text('Datos de venta', 40, 146);
      doc.rect(40, 162, 515, 76).strokeColor('#CBD5E0').lineWidth(1).stroke();
      drawLabelValue(doc, 'Cliente', sale.customerName || 'Cliente varios', 52, 178, 270, 72);
      drawLabelValue(doc, 'Documento', [sale.customerDocumentType, sale.customerDocumentNumber].filter(Boolean).join(' ') || '-', 52, 198, 270, 72);
      drawLabelValue(doc, 'Tienda', sale.locationName, 52, 218, 270, 72);
      drawLabelValue(doc, 'Vendedor', sale.sellerName, 334, 178, 200, 70);
      drawLabelValue(doc, 'Terminal', sale.terminalName, 334, 198, 200, 70);
      drawLabelValue(doc, 'Moneda', sale.currency || 'PEN', 334, 218, 200, 70);

      tableHeader(doc, 266, showTax);
      let y = 298;
      items.forEach((item, index) => {
        y = addPageIfNeeded(doc, y, showTax);
        const description = safe(item.productDescription);
        const rowHeight = Math.max(28, doc.heightOfString(description, { width: showTax ? 232 : 270 }) + 12);
        if (y + rowHeight > 730) y = addPageIfNeeded(doc, 721, showTax);
        doc.rect(40, y, 515, rowHeight).fill(index % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
        doc.fillColor('#1A202C').font('Helvetica').fontSize(8);
        doc.text(description, 48, y + 7, { width: showTax ? 232 : 270 });
        doc.text(money(item.quantity), showTax ? 286 : 330, y + 7, { width: 55, align: 'right' });
        doc.text(money(item.unitPrice), showTax ? 352 : 400, y + 7, { width: 70, align: 'right' });
        if (showTax) doc.text(money(item.taxAmount), 430, y + 7, { width: 48, align: 'right' });
        doc.font('Helvetica-Bold').text(money(item.total), 486, y + 7, { width: 60, align: 'right' });
        doc.moveTo(40, y + rowHeight).lineTo(555, y + rowHeight).strokeColor('#E2E8F0').lineWidth(0.7).stroke();
        y += rowHeight;
      });

      y = addPageIfNeeded(doc, y + 22, showTax);
      const paymentText = payments.length ? payments.map((payment) => `${payment.methodName}: S/ ${money(payment.amount)}`).join(' | ') : '-';
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1A202C').text('Pago', 40, y);
      doc.font('Helvetica').fontSize(8).text(paymentText, 76, y, { width: 260 });

      const totalsX = 374;
      doc.rect(totalsX, y - 10, 181, showTax ? 104 : 64).strokeColor('#CBD5E0').lineWidth(1).stroke();
      doc.font('Helvetica').fontSize(9).fillColor('#1A202C');
      if (showTax) {
        doc.text('Subtotal', totalsX + 12, y + 2, { width: 88 });
        doc.text(`S/ ${money(sale.subtotal)}`, totalsX + 105, y + 2, { width: 62, align: 'right' });
        doc.text('IGV', totalsX + 12, y + 22, { width: 88 });
        doc.text(`S/ ${money(sale.taxTotal)}`, totalsX + 105, y + 22, { width: 62, align: 'right' });
      }
      doc.text('Descuento', totalsX + 12, showTax ? y + 42 : y + 2, { width: 88 });
      doc.text(`S/ ${money(sale.discountTotal)}`, totalsX + 105, showTax ? y + 42 : y + 2, { width: 62, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('Total', totalsX + 12, showTax ? y + 66 : y + 28, { width: 88 });
      doc.text(`S/ ${money(sale.total)}`, totalsX + 105, showTax ? y + 66 : y + 28, { width: 62, align: 'right' });

      doc.font('Helvetica').fontSize(8).fillColor('#718096');
      doc.text('Representacion impresa del comprobante POS. Documento preparado para integracion electronica.', 40, 760, { width: 515, align: 'center' });

      doc.end();
    });
  }
}

module.exports = PosReceiptPdfService;
