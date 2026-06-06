const PDFDocument = require('pdfkit');

function money(value) {
  return Number(value || 0).toFixed(2);
}

function safe(value, fallback = '-') {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function dateText(value) {
  if (!value) return '-';
  return new Date(value).toISOString().slice(0, 10);
}

function timeText(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
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

function line(doc, y, x1 = 14, x2 = 212) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor('#111111').lineWidth(0.6).stroke();
}

function ticketText(doc, text, x, y, options = {}) {
  doc.fillColor('#111111').font(options.bold ? 'Courier-Bold' : 'Courier').fontSize(options.size || 8).text(text, x, y, options);
}

function buildBoleta({ document, sale, details, company }) {
  const height = Math.max(520, 390 + details.length * 42);
  const doc = new PDFDocument({ size: [226, height], margin: 12 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = 18;
    ticketText(doc, companyName(company), 14, y, { width: 198, align: 'center', bold: true, size: 10 });
    y += 16;
    ticketText(doc, `RUC: ${companyRuc(company)}`, 14, y, { width: 198, align: 'center', size: 8 });
    y += 13;
    ticketText(doc, safe(company.address, 'Direccion no configurada'), 14, y, { width: 198, align: 'center', size: 7 });
    y += 22;
    line(doc, y);
    y += 13;

    ticketText(doc, documentTitle(document.documentType), 14, y, { width: 198, align: 'center', bold: true, size: 9 });
    y += 14;
    ticketText(doc, safe(document.fullNumber), 14, y, { width: 198, align: 'center', bold: true, size: 9 });
    y += 20;

    ticketText(doc, `Fecha: ${dateText(document.issueDate)}`, 14, y);
    y += 12;
    ticketText(doc, `Hora : ${timeText(document.createdAt || document.issueDate)}`, 14, y);
    y += 18;

    ticketText(doc, `Cliente : ${safe(document.customerName, 'CLIENTE VARIOS')}`, 14, y, { width: 198 });
    y += 12;
    ticketText(doc, `${safe(document.customerDocumentType, 'DOC').padEnd(8, ' ')}: ${safe(document.customerDocumentNumber)}`, 14, y);
    y += 18;

    line(doc, y);
    y += 8;
    ticketText(doc, 'Cant  Descripcion          P.Unit   Total', 14, y, { bold: true, size: 7 });
    y += 10;
    line(doc, y);
    y += 8;

    details.forEach((item) => {
      const description = safe(item.productDescription || item.variantName, '-');
      const descriptionHeight = doc.heightOfString(description, { width: 96 });
      ticketText(doc, money(item.quantity), 14, y, { width: 28, size: 7 });
      ticketText(doc, description, 44, y, { width: 96, size: 7 });
      ticketText(doc, money(item.unitPrice), 142, y, { width: 32, align: 'right', size: 7 });
      ticketText(doc, money(item.total), 176, y, { width: 36, align: 'right', size: 7 });
      y += Math.max(18, descriptionHeight + 8);
    });

    line(doc, y);
    y += 12;
    ticketText(doc, 'TOTAL A PAGAR', 14, y, { bold: true, size: 9 });
    ticketText(doc, money(document.total), 148, y, { width: 64, align: 'right', bold: true, size: 9 });
    y += 18;
    line(doc, y);
    y += 14;

    ticketText(doc, `Forma de Pago: ${safe(sale.paymentMethod, 'Por definir')}`, 14, y, { width: 198 });
    y += 22;
    ticketText(doc, 'SON:', 14, y, { bold: true });
    y += 12;
    ticketText(doc, amountInWords(document.total, document.currency), 14, y, { width: 198, size: 8 });
    y += 30;

    ticketText(doc, 'Representacion impresa de la', 14, y, { width: 198, align: 'center', size: 7 });
    y += 10;
    ticketText(doc, 'Boleta de Venta Electronica.', 14, y, { width: 198, align: 'center', size: 7 });
    y += 14;
    line(doc, y);

    doc.end();
  });
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

function buildFactura({ document, sale, details, company }) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(40, 36, 330, 88).strokeColor('#CBD5E0').lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1A202C').text(companyName(company), 52, 50, { width: 300 });
    doc.font('Helvetica').fontSize(8).fillColor('#4A5568');
    doc.text(`RUC: ${companyRuc(company)}`, 52, 70, { width: 300 });
    doc.text(safe(company.address, 'Direccion no configurada'), 52, 84, { width: 300 });
    doc.text([company.phones && `Tel: ${company.phones}`, company.email].filter(Boolean).join(' | '), 52, 106, { width: 300 });

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
      const lineHeight = Math.max(24, doc.heightOfString(item.productDescription || '-', { width: 218 }) + 10);
      doc.fillColor('#1A202C').font('Helvetica').fontSize(8);
      doc.text(item.productDescription || '-', 48, y + 5, { width: 218 });
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
    doc.text('Representacion impresa de la Factura Electronica. Documento preparado para integracion SUNAT.', 40, y, { width: 515, align: 'center' });

    doc.end();
  });
}

class SaleDocumentPdfService {
  static build(data) {
    if (data.document?.documentType === 'boleta') {
      return buildBoleta(data);
    }
    return buildFactura(data);
  }
}

module.exports = SaleDocumentPdfService;
