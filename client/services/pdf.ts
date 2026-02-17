import { jsPDF } from 'jspdf';
import { Transaction, BusinessProfile, Product } from '../types';

export const sharePdfBlob = async (blob: Blob, filename: string) => {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const data = {
    files: [file],
    title: filename,
    text: `Here is your invoice ${filename}`,
  };

  if (navigator.canShare && navigator.canShare(data)) {
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      console.warn('Share failed or cancelled:', error);
      return false;
    }
  } else {
    // Fallback for browsers that don't support file sharing
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }
};

export const generateInvoicePDF = async (transaction: Transaction, business: BusinessProfile, products: Product[] = []): Promise<Blob> => {
  const isThermal = business.useThermalPrinter;

  // --- THERMAL LAYOUT (80mm) ---
  if (isThermal) {
     // 1. Calculate Estimated Height
     let estimatedHeight = 100; // Base height for header/footer
     transaction.items.forEach(item => {
        // Rough estimate: 10mm per item + extra for wrapping
        const nameLen = item.productName.length;
        estimatedHeight += 10 + Math.ceil(nameLen / 30) * 4;
     });

     const doc = new jsPDF({
       orientation: 'portrait',
       unit: 'mm',
       format: [80, estimatedHeight + 50] // Dynamic height + buffer
     });

     const pageWidth = 80;
     const margin = 2;
     let y = 10;

     const drawTextCenter = (text: string, yPos: number, size = 10, isBold = false) => {
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.text(text, pageWidth / 2, yPos, { align: 'center' });
     };

     const drawLine = () => {
        doc.setDrawColor(0);
        doc.setLineWidth(0.1);
        doc.line(margin, y, pageWidth - margin, y);
        y += 2;
     };

     // Header
     drawTextCenter(business.name, y, 12, true);
     y += 5;
     drawTextCenter(business.address, y, 8);
     y += 4;
     drawTextCenter(business.phone, y, 8);
     y += 6;

     drawLine();

     // Info
     doc.setFontSize(8);
     doc.text(`Date: ${new Date(transaction.transactionDate).toLocaleDateString()}`, margin, y);
     y += 4;
     doc.text(`Time: ${new Date(transaction.transactionDate).toLocaleTimeString()}`, margin, y);
     y += 4;
     doc.text(`ID: ${transaction.id.slice(-8)}`, margin, y);
     y += 4;
     doc.text(`Customer: ${transaction.customerName}`, margin, y);
     y += 6;

     drawLine();

     // Items Header
     doc.setFont('helvetica', 'bold');
     doc.setFontSize(8);
     doc.text('Item', margin, y);
     doc.text('Qty', 45, y, { align: 'right' });
     doc.text('Total', pageWidth - margin, y, { align: 'right' });
     y += 4;

     // Items
     doc.setFont('helvetica', 'normal');
     transaction.items.forEach(item => {
         // Resolve Category
         const category = item.category || products.find(p => p.id === item.productId)?.category;

         const nameLines = doc.splitTextToSize(item.productName, 40);
         doc.text(nameLines, margin, y);

         // Draw Qty and Total aligned with first line of name
         doc.text(item.quantity.toString(), 45, y, { align: 'right' });
         doc.text(item.total.toLocaleString(), pageWidth - margin, y, { align: 'right' });

         y += (nameLines.length * 3.5);

         // Category below name
         if (category) {
            doc.setFontSize(7);
            doc.setTextColor(100);
            doc.text(`(${category})`, margin, y);
            doc.setTextColor(0);
            doc.setFontSize(8);
            y += 4;
         }

         y += 2; // Spacing
     });

     drawLine();

     // Totals
     const drawRow = (label: string, val: string, bold = false) => {
         doc.setFont('helvetica', bold ? 'bold' : 'normal');
         doc.text(label, 40, y, { align: 'right' });
         doc.text(val, pageWidth - margin, y, { align: 'right' });
         y += 5;
     };

     drawRow('Subtotal:', transaction.subtotal.toLocaleString());
     if (transaction.globalDiscount > 0) {
        drawRow('Discount:', `-${transaction.globalDiscount.toLocaleString()}`);
     }
     drawRow('Total:', `NGN ${transaction.totalAmount.toLocaleString()}`, true);
     drawRow('Paid:', transaction.amountPaid.toLocaleString());
     drawRow('Balance:', transaction.balance.toLocaleString(), true);

     y += 5;
     drawTextCenter('Thank you!', y, 10, true);
     y += 5;
     drawTextCenter('Powered by Ginvoice', y, 7);

     return doc.output('blob');
  }

  // --- STANDARD A4 LAYOUT ---
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15;
  let y = 20;

  // --- Helper Functions ---
  const drawText = (text: string, x: number, y: number, options: any = {}) => {
    doc.text(text, x, y, options);
  };

  const drawLine = (yPos: number) => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  // --- Header ---
  // Business Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  drawText(business.name, margin, y);
  y += 7;

  // Business Info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  drawText(business.address, margin, y);
  y += 5;
  drawText(`Phone: ${business.phone}`, margin, y);
  y += 5;
  if (business.email) {
    drawText(`Email: ${business.email}`, margin, y);
    y += 5;
  }

  // Invoice Title (Right aligned)
  y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(200); // Light gray
  drawText('INVOICE', pageWidth - margin, y, { align: 'right' });

  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(0); // Black
  drawText(`ID: ${transaction.id.slice(0, 8)}...`, pageWidth - margin, y, { align: 'right' });
  y += 5;
  drawText(`Date: ${new Date(transaction.transactionDate).toLocaleDateString()}`, pageWidth - margin, y, { align: 'right' });

  // Reset Y to below header
  y = 50;

  // --- Bill To ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(150);
  drawText('BILL TO', margin, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0);
  drawText(transaction.customerName, margin, y);
  y += 10;

  // --- Table Header ---
  const cols = {
    desc: margin,
    qty: 120,
    price: 150,
    total: 180
  };

  doc.setFillColor(245, 247, 250);
  doc.rect(margin, y, pageWidth - (margin * 2), 10, 'F');
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  drawText('ITEM DESCRIPTION', cols.desc + 2, y);
  drawText('QTY', cols.qty, y, { align: 'center' });
  drawText('PRICE', cols.price, y, { align: 'right' });
  drawText('TOTAL', pageWidth - margin - 2, y, { align: 'right' });

  y += 8;

  // --- Table Content ---
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);

  transaction.items.forEach((item) => {
    // Resolve Category
    const category = item.category || products.find(p => p.id === item.productId)?.category;

    // Handle text wrapping for long names
    const nameLines = doc.splitTextToSize(item.productName, 100); // Max width 100mm
    let lineCount = nameLines.length;

    // Add category line if exists
    if (category) lineCount += 1;

    const rowHeight = Math.max(10, lineCount * 5);

    // Check for page break
    if (y + rowHeight > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    drawText(nameLines, cols.desc + 2, y);

    // Draw Category below
    if (category) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        // Calculate Y position for category (below name lines)
        const catY = y + (nameLines.length * 4);
        drawText(`(${category})`, cols.desc + 2, catY);
        doc.setTextColor(0);
        doc.setFontSize(9);
    }

    drawText(item.quantity.toString(), cols.qty, y, { align: 'center' });
    drawText(item.unitPrice.toLocaleString(), cols.price, y, { align: 'right' });
    drawText(item.total.toLocaleString(), pageWidth - margin - 2, y, { align: 'right' });

    y += rowHeight;

    // Add light separator
    doc.setDrawColor(240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;
  });

  drawLine(y);
  y += 10;

  // --- Totals ---
  const drawTotalRow = (label: string, value: string, isBold = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 12 : 10);
    drawText(label, 140, y, { align: 'right' });
    drawText(value, pageWidth - margin, y, { align: 'right' });
    y += 7;
  };

  drawTotalRow('Subtotal:', transaction.subtotal.toLocaleString());
  if (transaction.globalDiscount > 0) {
    doc.setTextColor(0, 150, 0); // Green
    drawTotalRow('Discount:', `-${transaction.globalDiscount.toLocaleString()}`);
    doc.setTextColor(0);
  }

  // Grand Total Box
  y += 2;
  doc.setFillColor(30, 30, 30); // Dark background
  doc.rect(130, y - 6, pageWidth - 130 - margin + 5, 12, 'F'); // Roughly positioned
  doc.setTextColor(255); // White text
  doc.setFont('helvetica', 'bold');
  drawText('TOTAL:', 140, y + 2, { align: 'right' });
  drawText(`NGN ${transaction.totalAmount.toLocaleString()}`, pageWidth - margin, y + 2, { align: 'right' });
  doc.setTextColor(0);
  y += 15;

  drawTotalRow('Paid:', transaction.amountPaid.toLocaleString());
  drawTotalRow('Balance:', transaction.balance.toLocaleString(), true);

  // --- Footer ---
  const footerY = pageHeight - 30;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.line(margin, footerY, pageWidth - margin, footerY);
  drawText('Thank you for your patronage!', margin, footerY + 5);
  drawText('Generated by Ginvoice Market OS', pageWidth - margin, footerY + 5, { align: 'right' });

  // Return Blob
  return doc.output('blob');
};
