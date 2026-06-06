const PDFDocument = require('pdfkit');

function money(value) {
  return Number(value || 0).toFixed(2);
}

function safe(value, fallback = '-') {
  return value === undefined || value === null || value === '' ? fallback : String(value);
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

function dateText(value) {
  if (!value) return '-';
  return new Date(value).toISOString().slice(0, 10);
}

function documentTitle(type) {
  return type === 'factura' ? 'FACTURA ELECTRONICA' : 'BOLETA DE VENTA ELECTRONICA';
}

const smallNumbers = [
  'CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];

function tensText(value) {
  if (value < 30) return smallNumbers[value];
  const tens = Math.floor(value / 10);
  const unit = value % 10;
  const names = { 3: 'TREINTA', 4: 'CUARENTA', 5: 'CINCUENTA', 6: 'SESENTA', 7: 'SETENTA', 8: 'OCHENTA', 9: 'NOVENTA' };
  return unit ? `${names[tens]} Y ${smallNumbers[unit]}` : names[tens];
}

function hundredsText(value) {
  if (value < 100) return tensText(value);
  if (value === 100) return 'CIEN';
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  const names = {
    1: 'CIENTO',
    2: 'DOSCIENTOS',
    3: 'TRESCIENTOS',
    4: 'CUATROCIENTOS',
    5: 'QUINIENTOS',
    6: 'SEISCIENTOS',
    7: 'SETECIENTOS',
    8: 'OCHOCIENTOS',
    9: 'NOVECIENTOS',
  };
  return rest ? `${names[hundred]} ${tensText(rest)}` : names[hundred];
}

function integerToSpanish(value) {
  const number = Math.floor(Number(value || 0));
  if (number < 1000) return hundredsText(number);
  if (number < 1000000) {
    const thousands = Math.floor(number / 1000);
    const rest = number % 1000;
    const prefix = thousands === 1 ? 'MIL' : `${integerToSpanish(thousands)} MIL`;
    return rest ? `${prefix} ${hundredsText(rest)}` : prefix;
  }
  const millions = Math.floor(number / 1000000);
  const rest = number % 1000000;
  const prefix = millions === 1 ? 'UN MILLON' : `${integerToSpanish(millions)} MILLONES`;
  return rest ? `${prefix} ${integerToSpanish(rest)}` : prefix;
}

function amountInWords(total, currency = 'PEN') {
  const amount = Number(total || 0);
  const integer = Math.floor(amount);
  const cents = Math.round((amount - integer) * 100);
  const currencyName = currency === 'USD' ? 'DOLARES' : 'SOLES';
  return `${integerToSpanish(integer)} Y ${String(cents).padStart(2, '0')}/100 ${currencyName}`;
}

function companyName(company = {}) {
  return safe(company.legalName || company.name, 'COMPANIA');
}

function companyRuc(company = {}) {
  return safe(company.ruc, 'RUC NO CONFIGURADO');
}

function drawLabelValue(doc, label, value, x, y, labelWidth = 72, width = 210) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#4A5568').text(label, x, y, { width: labelWidth });
  doc.font('Helvetica').fontSize(8).fillColor('#1A202C').text(safe(value), x + labelWidth, y, { width: width - labelWidth });
}

function drawInvoiceTableHeader(doc, y) {
  doc.rect(40, y, 515, 24).fill('#1A365D');
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8);
  doc.text('Descripcion', 48, y + 8, { width: 218 });
  doc.text('Unidad', 270, y + 8, { width: 48 });
  doc.text('Cant.', 322, y + 8, { width: 45, align: 'right' });
  doc.text('P. Unit', 374, y + 8, { width: 55, align: 'right' });
  doc.text('IGV', 434, y + 8, { width: 48, align: 'right' });
  doc.text('Total', 488, y + 8, { width: 58, align: 'right' });
}

function addInvoicePageIfNeeded(doc, y) {
  if (y <= 720) return y;
  doc.addPage();
  drawInvoiceTableHeader(doc, 44);
  return 76;
}

function buildA4Document({ document, sale, details, company }) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(40, 36, 330, 88).strokeColor('#CBD5E0').lineWidth(1).stroke();
    const logo = logoBuffer(company?.logoDataUrl);
    if (logo) {
      try {
        doc.image(logo, 52, 50, { fit: [66, 52], align: 'center', valign: 'center' });
      } catch {
        doc.rect(52, 50, 66, 52).strokeColor('#E2E8F0').lineWidth(0.8).stroke();
      }
    } else {
      doc.rect(52, 50, 66, 52).strokeColor('#E2E8F0').lineWidth(0.8).stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#718096').text('Logo', 52, 72, { width: 66, align: 'center' });
    }
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1A202C').text(companyName(company), 132, 50, { width: 226 });
    doc.font('Helvetica').fontSize(8).fillColor('#4A5568');
    doc.text(`RUC: ${companyRuc(company)}`, 132, 70, { width: 226 });
    doc.text(safe(company.address, 'Direccion no configurada'), 132, 84, { width: 226 });
    doc.text([company.phones && `Tel: ${company.phones}`, company.email].filter(Boolean).join(' | '), 132, 106, { width: 226 });

    doc.rect(392, 36, 163, 88).strokeColor('#1A365D').lineWidth(1.4).stroke();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1A365D').text('RUC', 404, 48, { width: 139, align: 'center' });
    doc.fontSize(10).text(companyRuc(company), 404, 64, { width: 139, align: 'center' });
    doc.fontSize(11).text(documentTitle(document.documentType), 404, 84, { width: 139, align: 'center' });
    doc.fontSize(10).text(safe(document.fullNumber), 404, 104, { width: 139, align: 'center' });

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A202C').text('Datos del cliente', 40, 148);
    doc.rect(40, 164, 515, 74).strokeColor('#CBD5E0').lineWidth(1).stroke();
    drawLabelValue(doc, 'Cliente', document.customerName, 52, 178, 78, 255);
    drawLabelValue(doc, 'Documento', [document.customerDocumentType, document.customerDocumentNumber].filter(Boolean).join(' '), 52, 196, 78, 255);
    drawLabelValue(doc, 'Direccion', document.customerAddress, 52, 214, 78, 430);
    drawLabelValue(doc, 'Fecha', dateText(document.issueDate), 360, 178, 55, 170);
    drawLabelValue(doc, 'Moneda', document.currency, 360, 196, 55, 170);
    drawLabelValue(doc, 'Pago', sale.paymentMethod || 'Por definir', 360, 214, 55, 170);

    drawInvoiceTableHeader(doc, 264);
    let y = 296;
    details.forEach((item) => {
      y = addInvoicePageIfNeeded(doc, y);
      const detailText = [item.productDescription || '-', item.detailNotes].filter(Boolean).join('\n');
      const lineHeight = Math.max(24, doc.heightOfString(detailText, { width: 218 }) + 10);
      if (y + lineHeight > 720) y = addInvoicePageIfNeeded(doc, 721);
      doc.fillColor('#1A202C').font('Helvetica').fontSize(8);
      doc.text(item.productDescription || '-', 48, y + 5, { width: 218 });
      if (item.detailNotes) {
        const noteY = y + 5 + doc.heightOfString(item.productDescription || '-', { width: 218 }) + 3;
        doc.fillColor('#4A5568').fontSize(7).text(item.detailNotes, 48, noteY, { width: 218 });
        doc.fillColor('#1A202C').fontSize(8);
      }
      doc.text(item.unit || 'unidad', 270, y + 5, { width: 48 });
      doc.text(money(item.quantity), 322, y + 5, { width: 45, align: 'right' });
      doc.text(money(item.unitPrice), 374, y + 5, { width: 55, align: 'right' });
      doc.text(money(item.taxAmount), 434, y + 5, { width: 48, align: 'right' });
      doc.text(money(item.total), 488, y + 5, { width: 58, align: 'right' });
      doc.moveTo(40, y + lineHeight).lineTo(555, y + lineHeight).strokeColor('#E2E8F0').lineWidth(0.7).stroke();
      y += lineHeight;
    });

    y = addInvoicePageIfNeeded(doc, y + 18);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1A202C').text('SON:', 40, y, { width: 40 });
    doc.font('Helvetica').text(amountInWords(document.total, document.currency), 78, y, { width: 275 });

    const totalsX = 374;
    doc.rect(totalsX, y - 8, 181, 78).strokeColor('#CBD5E0').lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#1A202C');
    doc.text('Subtotal', totalsX + 12, y + 4, { width: 88 });
    doc.text(money(document.subtotal), totalsX + 105, y + 4, { width: 62, align: 'right' });
    doc.text('IGV 18%', totalsX + 12, y + 24, { width: 88 });
    doc.text(money(document.taxTotal), totalsX + 105, y + 24, { width: 62, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Total', totalsX + 12, y + 48, { width: 88 });
    doc.text(money(document.total), totalsX + 105, y + 48, { width: 62, align: 'right' });

    y += 104;
    y = addInvoicePageIfNeeded(doc, y);
    doc.font('Helvetica').fontSize(8).fillColor('#4A5568');
    doc.text(`Representacion impresa de la ${documentTitle(document.documentType)}. Documento preparado para integracion SUNAT.`, 40, y, { width: 515, align: 'center' });

    doc.end();
  });
}

class SaleDocumentPdfService {
  static build(data) {
    return buildA4Document(data);
  }
}

module.exports = SaleDocumentPdfService;
