const PDFDocument = require('pdfkit');

function money(value) {
  return Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateText(value) {
  if (!value) return '-';
  return new Date(value).toISOString().slice(0, 10);
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

function drawLine(doc, y) {
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#E2E8F0').lineWidth(1).stroke();
}

function drawLabelValue(doc, label, value, x, y, width = 240, labelWidth = 82) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#4A5568').text(label, x, y, { width: labelWidth });
  doc.font('Helvetica').fontSize(8).fillColor('#1A202C').text(safe(value), x + labelWidth, y, { width: width - labelWidth });
}

function drawSectionTitle(doc, title, x, y, width = 515) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1F4E79').text(title, x, y, { width });
  drawLine(doc, y + 15);
}

function drawTableHeader(doc, y) {
  doc.roundedRect(40, y, 515, 24, 4).fill('#1F4E79');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
  doc.text('Descripcion', 48, y + 8, { width: 200 });
  doc.text('Unidad', 252, y + 8, { width: 45 });
  doc.text('Cant.', 302, y + 8, { width: 45, align: 'right' });
  doc.text('P. Unit.', 352, y + 8, { width: 58, align: 'right' });
  doc.text('IGV', 415, y + 8, { width: 55, align: 'right' });
  doc.text('Total', 480, y + 8, { width: 65, align: 'right' });
}

function addPageIfNeeded(doc, y) {
  if (y <= 710) return y;
  doc.addPage();
  drawTableHeader(doc, 50);
  return 80;
}

function drawCompanyHeader(doc, company, header) {
  const logo = logoBuffer(company.logoDataUrl);
  if (logo) {
    try {
      doc.image(logo, 40, 34, { fit: [82, 58], align: 'left', valign: 'center' });
    } catch {
      doc.roundedRect(40, 34, 82, 58, 6).strokeColor('#CBD5E0').stroke();
    }
  } else {
    doc.roundedRect(40, 34, 82, 58, 6).strokeColor('#CBD5E0').stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#718096').text('Logo', 40, 58, { width: 82, align: 'center' });
  }

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1A202C').text(safe(company.legalName, 'Compania'), 136, 36, { width: 260 });
  doc.font('Helvetica').fontSize(8).fillColor('#4A5568');
  doc.text(`RUC: ${safe(company.ruc)}`, 136, 56, { width: 260 });
  doc.text(safe(company.address), 136, 70, { width: 260 });
  const contact = [
    company.phones && `Tel: ${company.phones}`,
    company.whatsappPhones && `WhatsApp: ${company.whatsappPhones}`,
  ].filter(Boolean).join(' | ');
  doc.text(contact || '-', 136, 84, { width: 260 });

  doc.roundedRect(410, 34, 145, 72, 8).fillAndStroke('#F7FAFC', '#CBD5E0');
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#1F4E79').text('COTIZACION', 420, 46, { width: 125, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A202C').text(`Nro. ${safe(header.quotationNumber)}`, 420, 68, { width: 125, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor('#4A5568').text(`Fecha: ${dateText(header.quotationDate)}`, 420, 88, { width: 125, align: 'center' });
  drawLine(doc, 124);
}

function drawFooter(doc, company) {
  const bottom = 754;
  doc.moveTo(40, bottom - 10).lineTo(555, bottom - 10).strokeColor('#E2E8F0').stroke();
  doc.font('Helvetica').fontSize(7).fillColor('#718096');
  const web = [company.email, company.website].filter(Boolean).join(' | ');
  doc.text(web || 'Gracias por su preferencia.', 40, bottom, { width: 250 });
  const social = Array.isArray(company.socialLinks)
    ? company.socialLinks.filter((item) => item.network || item.url).map((item) => `${item.network}: ${item.url}`).join(' | ')
    : '';
  doc.text(social, 300, bottom, { width: 255, align: 'right' });
}

function drawBankAccounts(doc, company, y) {
  const accounts = Array.isArray(company.bankAccounts) ? company.bankAccounts.filter((item) => item.bankName || item.accountNumber || item.cci) : [];
  if (!accounts.length) return y;
  y = addPageIfNeeded(doc, y);
  drawSectionTitle(doc, 'Cuentas bancarias', 40, y);
  y += 26;
  doc.font('Helvetica').fontSize(8).fillColor('#1A202C');
  accounts.slice(0, 4).forEach((account) => {
    y = addPageIfNeeded(doc, y);
    const line = [
      account.bankName,
      account.currency,
      account.accountNumber && `Cuenta: ${account.accountNumber}`,
      account.cci && `CCI: ${account.cci}`,
      account.holder && `Titular: ${account.holder}`,
    ].filter(Boolean).join(' | ');
    doc.text(line, 48, y, { width: 500 });
    y += 14;
  });
  return y + 8;
}

class QuotationPdfService {
  static build({ header, details, company = {} }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      drawCompanyHeader(doc, company, header);

      doc.roundedRect(40, 142, 245, 86, 6).strokeColor('#CBD5E0').stroke();
      doc.roundedRect(310, 142, 245, 86, 6).strokeColor('#CBD5E0').stroke();
      drawSectionTitle(doc, 'Datos del cliente', 52, 154, 220);
      drawLabelValue(doc, 'Nombre', header.customerName, 52, 180, 220, 70);
      drawLabelValue(doc, 'Documento', [header.documentType, header.documentNumber].filter(Boolean).join(' '), 52, 196, 220, 70);
      drawLabelValue(doc, 'Telefono', header.customerPhone, 52, 212, 220, 70);

      drawSectionTitle(doc, 'Datos de la cotizacion', 322, 154, 220);
      drawLabelValue(doc, 'Moneda', header.currency, 322, 180, 220, 70);
      drawLabelValue(doc, 'Estado', header.status || 'emitida', 322, 196, 220, 70);
      drawLabelValue(doc, 'Vendedor', header.sellerName, 322, 212, 220, 70);

      doc.font('Helvetica').fontSize(8).fillColor('#4A5568');
      doc.text(`Correo cliente: ${safe(header.customerEmail)}`, 40, 242, { width: 250 });
      doc.text(`Direccion: ${safe(header.customerAddress)}`, 40, 256, { width: 515 });

      drawSectionTitle(doc, 'Detalle de productos y servicios', 40, 286);
      drawTableHeader(doc, 308);

      let y = 338;
      details.forEach((item, index) => {
        y = addPageIfNeeded(doc, y);
        const detailText = [item.productDescription || '-', item.detailNotes].filter(Boolean).join('\n');
        const lineHeight = Math.max(24, doc.heightOfString(detailText, { width: 200 }) + 12);
        if (y + lineHeight > 730) y = addPageIfNeeded(doc, 731);
        doc.roundedRect(40, y, 515, lineHeight, 2).fill(index % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
        doc.fillColor('#1A202C').font('Helvetica').fontSize(8);
        doc.text(item.productDescription || '-', 48, y + 7, { width: 200 });
        if (item.detailNotes) {
          const noteY = y + 7 + doc.heightOfString(item.productDescription || '-', { width: 200 }) + 3;
          doc.fillColor('#4A5568').fontSize(7).text(item.detailNotes, 48, noteY, { width: 200 });
          doc.fillColor('#1A202C').fontSize(8);
        }
        doc.text(item.unit || 'unidad', 252, y + 7, { width: 45 });
        doc.text(money(item.quantity), 302, y + 7, { width: 45, align: 'right' });
        doc.text(money(item.unitPrice), 352, y + 7, { width: 58, align: 'right' });
        doc.text(money(item.taxAmount), 415, y + 7, { width: 55, align: 'right' });
        doc.font('Helvetica-Bold').text(money(item.total), 480, y + 7, { width: 65, align: 'right' });
        doc.moveTo(40, y + lineHeight).lineTo(555, y + lineHeight).strokeColor('#EDF2F7').stroke();
        y += lineHeight;
      });

      y = addPageIfNeeded(doc, y + 18);
      const totalsX = 350;
      doc.roundedRect(totalsX, y, 205, 78, 6).fillAndStroke('#F7FAFC', '#CBD5E0');
      doc.font('Helvetica').fontSize(9).fillColor('#1A202C');
      doc.text('Subtotal', totalsX + 12, y + 12, { width: 90 });
      doc.text(money(header.subtotal), totalsX + 118, y + 12, { width: 70, align: 'right' });
      doc.text(`IGV ${money(company.taxRate ?? 18)}%`, totalsX + 12, y + 30, { width: 90 });
      doc.text(money(header.taxTotal), totalsX + 118, y + 30, { width: 70, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#1F4E79');
      doc.text('Total', totalsX + 12, y + 52, { width: 90 });
      doc.text(money(header.total), totalsX + 118, y + 52, { width: 70, align: 'right' });

      y += 98;
      if (header.paymentMethod || header.deliveryDate || header.deliveryMethod || header.comments) {
        y = addPageIfNeeded(doc, y);
        drawSectionTitle(doc, 'Condiciones comerciales', 40, y);
        drawLabelValue(doc, 'Pago', header.paymentMethod, 40, y + 28, 250, 72);
        drawLabelValue(doc, 'Entrega', dateText(header.deliveryDate), 40, y + 44, 250, 72);
        drawLabelValue(doc, 'Forma entrega', header.deliveryMethod, 300, y + 28, 250, 85);
        if (header.comments) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#4A5568').text('Comentarios', 40, y + 68);
          doc.font('Helvetica').fontSize(8).fillColor('#1A202C').text(header.comments, 120, y + 68, { width: 420 });
        }
        y += 96;
      }

      y = drawBankAccounts(doc, company, y);
      y = addPageIfNeeded(doc, y);
      doc.font('Helvetica').fontSize(8).fillColor('#718096');
      doc.text('Esta cotizacion esta sujeta a disponibilidad de stock y vigencia comercial acordada. Los importes se expresan en la moneda indicada.', 40, y, { width: 515 });

      const range = doc.bufferedPageRange();
      for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
        doc.switchToPage(pageIndex);
        drawFooter(doc, company);
        doc.font('Helvetica').fontSize(7).fillColor('#718096').text(`Pagina ${pageIndex + 1} de ${range.count}`, 500, 778, { width: 55, align: 'right' });
      }

      doc.end();
    });
  }
}

module.exports = QuotationPdfService;
