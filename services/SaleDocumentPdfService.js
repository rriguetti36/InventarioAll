const PDFDocument = require('pdfkit');

function money(value) {
  return Number(value || 0).toFixed(2);
}

function dateText(value) {
  if (!value) return '-';
  return new Date(value).toISOString().slice(0, 10);
}

function label(type) {
  return type === 'factura' ? 'FACTURA ELECTRONICA' : 'BOLETA DE VENTA ELECTRONICA';
}

function drawLabelValue(doc, labelText, value, x, y, width = 250) {
  doc.font('Helvetica-Bold').fontSize(9).text(labelText, x, y, { width });
  doc.font('Helvetica').fontSize(9).text(value || '-', x + 98, y, { width: width - 98 });
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

class SaleDocumentPdfService {
  static build({ document, sale, details }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold').fontSize(16).fillColor('#1A202C').text(label(document.documentType), 40, 38);
      doc.font('Helvetica-Bold').fontSize(12).text(document.fullNumber, 420, 42, { align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor('#4A5568').text('Representacion impresa interna', 40, 62);
      drawLine(doc, 84);

      doc.fillColor('#1A202C');
      drawLabelValue(doc, 'Fecha emision', dateText(document.issueDate), 40, 104);
      drawLabelValue(doc, 'Moneda', document.currency, 40, 122);
      drawLabelValue(doc, 'Estado', document.status || 'emitido', 40, 140);
      drawLabelValue(doc, 'Venta', sale.documentNumber || `#${sale.id}`, 310, 104);
      drawLabelValue(doc, 'Tipo venta', sale.saleType === 'formal' ? 'Formal' : 'Directa', 310, 122);

      doc.font('Helvetica-Bold').fontSize(11).text('Cliente', 40, 176);
      drawLine(doc, 192);
      drawLabelValue(doc, 'Nombre', document.customerName, 40, 206, 320);
      drawLabelValue(doc, 'Documento', [document.customerDocumentType, document.customerDocumentNumber].filter(Boolean).join(' '), 40, 224, 320);
      drawLabelValue(doc, 'Direccion', document.customerAddress, 40, 242, 500);

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
      doc.text(money(document.subtotal), 470, y, { width: 75, align: 'right' });
      doc.text('IGV 18%', totalsX, y + 18, { width: 90 });
      doc.text(money(document.taxTotal), 470, y + 18, { width: 75, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Total', totalsX, y + 40, { width: 90 });
      doc.text(money(document.total), 470, y + 40, { width: 75, align: 'right' });

      y += 86;
      y = addPageIfNeeded(doc, y);
      doc.font('Helvetica').fontSize(8).fillColor('#4A5568');
      doc.text('Documento preparado para futura integracion con SUNAT. No contiene CDR ni hash SUNAT hasta completar la emision electronica real.', 40, y, { width: 515 });

      doc.end();
    });
  }
}

module.exports = SaleDocumentPdfService;
