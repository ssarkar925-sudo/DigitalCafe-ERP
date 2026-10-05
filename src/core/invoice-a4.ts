import { jsPDF } from "jspdf";
import { InvoiceRecord, ShopProfile, DEFAULT_SHOP_PROFILE } from "./contracts";

export function formatInvoicePaisa(paisa: bigint): string {
  const isNeg = paisa < 0n;
  const abs = isNeg ? -paisa : paisa;
  const rupees = Number(abs / 100n);
  const remainder = Number(abs % 100n);
  const formatted = remainder > 0 ? `${rupees}.${remainder.toString().padStart(2, "0")}` : `${rupees}`;
  return `${isNeg ? "-" : ""}₹${formatted}`;
}

/**
 * Retrieves shop profile from localStorage, falling back to clean default.
 */
export function getSavedShopProfile(): ShopProfile {
  try {
    const saved = localStorage.getItem("dc_user_shop_profile");
    if (saved) {
      return { ...DEFAULT_SHOP_PROFILE, ...JSON.parse(saved) };
    }
  } catch (e) {}
  return DEFAULT_SHOP_PROFILE;
}

/**
 * Generates and downloads a high-density, professional A4 Tax Invoice PDF
 * with itemized GST breakdown, shop branding, customer details, bank/UPI details,
 * and authorized signatory seal block.
 */
export function generateA4InvoicePdf(inv: InvoiceRecord, customProfile?: ShopProfile): void {
  const profile = customProfile || getSavedShopProfile();
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4", // 210mm x 297mm
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // --- BRAND ACCENT HEADER STRIP ---
  doc.setFillColor(15, 23, 42); // slate-900 dark slate
  doc.rect(0, 0, pageWidth, 5, "F");

  // --- SHOP HEADER & LOGO ---
  let y = 16;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(profile.shopName || "SARKAR COMMUNICATION", margin, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text("TAX INVOICE", pageWidth - margin, y, { align: "right" });

  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(profile.tagline || "Digital Seva Kendra & Banking CSP Hub", margin, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`INVOICE NO: ${inv.invoiceNumber}`, pageWidth - margin, y, { align: "right" });

  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(profile.address || "Main Market, Station Road, West Bengal, India", margin, y);
  doc.text(`DATE: ${inv.date}  |  TIME: ${inv.time}`, pageWidth - margin, y, { align: "right" });

  y += 4.5;
  doc.text(`Phone: ${profile.phone || "+91 98765 43210"}  •  Email: ${profile.email || "support@sarkarcomm.in"}`, margin, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`GSTIN: ${profile.gstin || "19AAAAA0000A1Z5"}`, pageWidth - margin, y, { align: "right" });

  // Divider line
  y += 6;
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // --- BILL TO / CUSTOMER DETAILS BOX ---
  y += 5;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("BILLED TO / CUSTOMER DETAILS", margin + 4, y + 5);
  doc.text("PAYMENT INFORMATION", margin + 105, y + 5);

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(inv.customerName || "Walk-in Customer", margin + 4, y + 10.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Contact: ${inv.customerPhone || "Not specified"}`, margin + 4, y + 15);
  if (inv.customerGstin) {
    doc.text(`Customer GSTIN: ${inv.customerGstin}`, margin + 4, y + 19);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Payment Mode: ${inv.paymentMethod}`, margin + 105, y + 10.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice Status: ${inv.status || "PAID"}`, margin + 105, y + 15);
  doc.text(`UPI VPA: ${profile.upiId || "sarkarcommunication@upi"}`, margin + 105, y + 19);

  // --- ITEMS TABLE HEADER ---
  y += 26;
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, y, contentWidth, 7, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("#", margin + 3, y + 4.8);
  doc.text("ITEM DESCRIPTION", margin + 12, y + 4.8);
  doc.text("HSN/SAC", margin + 82, y + 4.8);
  doc.text("QTY", margin + 106, y + 4.8, { align: "right" });
  doc.text("UNIT RATE", margin + 132, y + 4.8, { align: "right" });
  doc.text("GST", margin + 152, y + 4.8, { align: "right" });
  doc.text("AMOUNT", margin + contentWidth - 3, y + 4.8, { align: "right" });

  // --- TABLE ROWS ---
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  inv.items.forEach((item, idx) => {
    const rowBg = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
    doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
    doc.rect(margin, y, contentWidth, 6.5, "F");

    doc.setTextColor(100, 116, 139);
    doc.text(`${idx + 1}`, margin + 3, y + 4.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    const name = item.name.length > 36 ? item.name.substring(0, 34) + "..." : item.name;
    doc.text(name, margin + 12, y + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(item.hsnCode || "998311", margin + 82, y + 4.5);

    doc.setTextColor(15, 23, 42);
    doc.text(`${item.quantity}`, margin + 106, y + 4.5, { align: "right" });
    doc.text(formatInvoicePaisa(item.unitPricePaisa), margin + 132, y + 4.5, { align: "right" });

    const gstLabel = item.gstRatePercent ? `${item.gstRatePercent}%` : "0%";
    doc.text(gstLabel, margin + 152, y + 4.5, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text(formatInvoicePaisa(item.totalPaisa), margin + contentWidth - 3, y + 4.5, { align: "right" });

    y += 6.5;
  });

  // Table bottom rule
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, margin + contentWidth, y);

  // --- TOTALS & GST BREAKDOWN BLOCK ---
  y += 5;
  const summaryBlockX = margin + 95;
  const summaryBlockWidth = contentWidth - 95;

  // Left Note block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("TERMS & CONDITIONS", margin, y + 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("• Computer generated tax invoice. Goods/services once provided cannot be exchanged.", margin, y + 7.5);
  doc.text("• For digital banking CSP transactions, please preserve Bank RRN/UTR receipt.", margin, y + 11.5);
  doc.text("• Customer support: " + (profile.phone || "+91 98765 43210"), margin, y + 15.5);

  if (inv.paymentMethod === "SPLIT" && inv.allocations && inv.allocations.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text("SPLIT TENDER ALLOCATION:", margin, y + 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    inv.allocations.forEach((al, aIdx) => {
      const modeLabel = al.method === "CASH" ? "Cash Received" : al.method === "UPI" ? "UPI QR Paid" : "Khata Due";
      doc.text(`  • ${modeLabel}: ${formatInvoicePaisa(al.amountPaisa)}`, margin, y + 25 + aIdx * 3.8);
    });
  }

  // Right Summary table
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(summaryBlockX, y, summaryBlockWidth, 42, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBlockX, y, summaryBlockWidth, 42, 2, 2, "S");

  let sy = y + 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal (Gross):", summaryBlockX + 4, sy);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(formatInvoicePaisa(inv.subtotalPaisa), summaryBlockX + summaryBlockWidth - 4, sy, { align: "right" });

  if (inv.discountPaisa > 0n) {
    sy += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(225, 29, 72); // rose-600
    doc.text("Discount Applied:", summaryBlockX + 4, sy);
    doc.setFont("helvetica", "bold");
    doc.text(`-${formatInvoicePaisa(inv.discountPaisa)}`, summaryBlockX + summaryBlockWidth - 4, sy, { align: "right" });
  }

  if (inv.totalTaxablePaisa) {
    sy += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Taxable Value:", summaryBlockX + 4, sy);
    doc.text(formatInvoicePaisa(inv.totalTaxablePaisa), summaryBlockX + summaryBlockWidth - 4, sy, { align: "right" });
  }

  if (inv.totalCgstPaisa) {
    sy += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("CGST (Central Tax):", summaryBlockX + 4, sy);
    doc.text(formatInvoicePaisa(inv.totalCgstPaisa), summaryBlockX + summaryBlockWidth - 4, sy, { align: "right" });
  }

  if (inv.totalSgstPaisa) {
    sy += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("SGST (State Tax):", summaryBlockX + 4, sy);
    doc.text(formatInvoicePaisa(inv.totalSgstPaisa), summaryBlockX + summaryBlockWidth - 4, sy, { align: "right" });
  }

  // Grand Total bar
  sy += 5;
  doc.setFillColor(15, 23, 42);
  doc.rect(summaryBlockX, sy, summaryBlockWidth, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("GRAND TOTAL:", summaryBlockX + 4, sy + 5.5);
  doc.text(formatInvoicePaisa(inv.totalPaisa), summaryBlockX + summaryBlockWidth - 4, sy + 5.5, { align: "right" });

  // --- SIGNATORY & FOOTER BLOCK ---
  y += 56;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`For ${profile.shopName || "Sarkar Communication"}`, summaryBlockX + summaryBlockWidth - 4, y, { align: "right" });

  y += 14;
  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineDashPattern([1, 1], 0);
  doc.line(summaryBlockX + 15, y, summaryBlockX + summaryBlockWidth - 4, y);
  doc.setLineDashPattern([], 0);

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("AUTHORIZED SIGNATORY / COUNTER SEAL", summaryBlockX + summaryBlockWidth - 4, y, { align: "right" });

  // Bottom Center Footer Note
  const pageHeight = 297;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(profile.printFooterNote || "Thank You! Visit Again for Digital Seva & Banking.", pageWidth / 2, pageHeight - 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Powered by DigitalCafe ERP • Professional Counter POS System", pageWidth / 2, pageHeight - 8, { align: "center" });

  // Save PDF
  doc.save(`${inv.invoiceNumber}_A4_Tax_Invoice.pdf`);
}

/**
 * Opens an ultra-crisp browser print window formatted for full-page A4 paper.
 */
export function printA4InvoiceHtml(inv: InvoiceRecord, customProfile?: ShopProfile): void {
  const profile = customProfile || getSavedShopProfile();
  const printWindow = window.open("", "_blank", "width=850,height=950");
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${inv.invoiceNumber} - Tax Invoice (A4)</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 13px;
            background: #fff;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #e2e8f0;
            padding: 24px;
            border-radius: 8px;
          }
          @media print {
            body { font-size: 12px; }
            .invoice-container { border: none; padding: 0; }
            .no-print { display: none !important; }
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .brand-name {
            font-size: 22px;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 4px 0;
            letter-spacing: -0.5px;
          }
          .brand-tagline {
            font-size: 13px;
            color: #475569;
            margin: 0 0 6px 0;
            font-weight: 600;
          }
          .brand-meta {
            font-size: 11px;
            color: #64748b;
            line-height: 1.5;
          }
          .invoice-badge-block {
            text-align: right;
          }
          .invoice-title {
            font-size: 20px;
            font-weight: 900;
            color: #059669;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }
          .invoice-meta-item {
            font-size: 12px;
            color: #334155;
            margin-bottom: 3px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
          }
          .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
          }
          .info-label {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 6px;
          }
          .info-value-bold {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .info-text {
            font-size: 11px;
            color: #475569;
            line-height: 1.4;
          }
          table.items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          table.items-table th {
            background: #0f172a;
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 9px 12px;
            text-align: left;
          }
          table.items-table td {
            padding: 9px 12px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 12px;
          }
          table.items-table tr:nth-child(even) td {
            background: #f8fafc;
          }
          .text-right { text-align: right !important; }
          .text-center { text-align: center !important; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          .footer-section {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 24px;
            align-items: flex-start;
          }
          .terms-box {
            font-size: 11px;
            color: #64748b;
            line-height: 1.6;
          }
          .summary-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 14px;
            font-size: 12px;
            color: #475569;
          }
          .grand-total-row {
            background: #0f172a;
            color: #fff;
            display: flex;
            justify-content: space-between;
            padding: 10px 14px;
            font-size: 15px;
            font-weight: 900;
          }
          .signatory-box {
            text-align: right;
            margin-top: 36px;
          }
          .sign-line {
            display: inline-block;
            width: 180px;
            border-top: 1px dashed #64748b;
            margin-bottom: 6px;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- HEADER -->
          <div class="header">
            <div>
              <div class="brand-name">${profile.shopName || "SARKAR COMMUNICATION"}</div>
              <div class="brand-tagline">${profile.tagline || "Digital Seva & Banking CSP"}</div>
              <div class="brand-meta">
                ${profile.address || "Main Market, Station Road, West Bengal"}<br/>
                Phone: <strong>${profile.phone || "+91 98765 43210"}</strong> | GSTIN: <strong>${profile.gstin || "19AAAAA0000A1Z5"}</strong>
              </div>
            </div>

            <div class="invoice-badge-block">
              <div class="invoice-title">TAX INVOICE</div>
              <div class="invoice-meta-item">Invoice #: <strong class="font-mono">${inv.invoiceNumber}</strong></div>
              <div class="invoice-meta-item">Date: <strong>${inv.date} ${inv.time}</strong></div>
              <div class="invoice-meta-item">Payment: <strong>${inv.paymentMethod}</strong></div>
            </div>
          </div>

          <!-- CLIENT & PAYMENT INFO -->
          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Customer Details</div>
              <div class="info-value-bold">${inv.customerName || "Walk-in Customer"}</div>
              <div class="info-text">Mobile: ${inv.customerPhone || "Not specified"}</div>
              ${inv.customerGstin ? `<div class="info-text">GSTIN: ${inv.customerGstin}</div>` : ""}
            </div>

            <div class="info-box">
              <div class="info-label">Counter Payment Status</div>
              <div class="info-value-bold" style="color: #059669;">PAID IN FULL ✅</div>
              <div class="info-text">UPI ID: <strong>${profile.upiId || "sarkarcommunication@upi"}</strong></div>
              <div class="info-text">Billed by: ${profile.ownerName || "Saikat Sarkar"}</div>
            </div>
          </div>

          <!-- ITEMS TABLE -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 40px;" class="text-center">#</th>
                <th>Item / Description</th>
                <th style="width: 90px;">HSN/SAC</th>
                <th style="width: 60px;" class="text-center">Qty</th>
                <th style="width: 100px;" class="text-right">Unit Rate</th>
                <th style="width: 70px;" class="text-center">GST</th>
                <th style="width: 110px;" class="text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${inv.items
                .map(
                  (it, i) => `
                <tr>
                  <td class="text-center text-slate-400 font-mono">${i + 1}</td>
                  <td><strong>${it.name}</strong></td>
                  <td class="text-slate-500 font-mono">${it.hsnCode || "998311"}</td>
                  <td class="text-center font-mono"><strong>${it.quantity}</strong></td>
                  <td class="text-right font-mono">${formatInvoicePaisa(it.unitPricePaisa)}</td>
                  <td class="text-center font-mono">${it.gstRatePercent ? `${it.gstRatePercent}%` : "0%"}</td>
                  <td class="text-right font-mono"><strong>${formatInvoicePaisa(it.totalPaisa)}</strong></td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <!-- FOOTER & SUMMARY -->
          <div class="footer-section">
            <div class="terms-box">
              <div style="font-weight: 800; text-transform: uppercase; margin-bottom: 6px; color: #334155;">Terms & Payment Breakdown:</div>
              <div>• Computer generated tax invoice valid for business accounts and GST input credit.</div>
              <div>• For CSP/Banking receipts, retain transaction reference numbers for bank inquiries.</div>
              ${
                inv.paymentMethod === "SPLIT" && inv.allocations && inv.allocations.length > 0
                  ? `<div style="margin-top: 8px; font-weight: bold; color: #0f172a;">Split Payment Tenders:</div>
                     ${inv.allocations
                       .map(
                         (a) => `<div>• ${a.method === "CASH" ? "Cash Received" : a.method === "UPI" ? "Soundbox UPI Paid" : "Khata Due"}: <strong>${formatInvoicePaisa(a.amountPaisa)}</strong></div>`
                       )
                       .join("")}`
                  : ""
              }
              <div style="margin-top: 14px; font-weight: 700; color: #0f172a;">${profile.printFooterNote || "Thank You! Visit Again."}</div>
            </div>

            <div>
              <div class="summary-card">
                <div class="summary-row">
                  <span>Gross Subtotal:</span>
                  <span class="font-mono"><strong>${formatInvoicePaisa(inv.subtotalPaisa)}</strong></span>
                </div>
                ${
                  inv.discountPaisa > 0n
                    ? `<div class="summary-row" style="color: #e11d48;">
                        <span>Discount:</span>
                        <span class="font-mono"><strong>-${formatInvoicePaisa(inv.discountPaisa)}</strong></span>
                       </div>`
                    : ""
                }
                ${
                  inv.totalTaxablePaisa
                    ? `<div class="summary-row">
                        <span>Taxable Value:</span>
                        <span class="font-mono">${formatInvoicePaisa(inv.totalTaxablePaisa)}</span>
                       </div>`
                    : ""
                }
                ${
                  inv.totalCgstPaisa
                    ? `<div class="summary-row">
                        <span>CGST:</span>
                        <span class="font-mono">${formatInvoicePaisa(inv.totalCgstPaisa)}</span>
                       </div>`
                    : ""
                }
                ${
                  inv.totalSgstPaisa
                    ? `<div class="summary-row">
                        <span>SGST:</span>
                        <span class="font-mono">${formatInvoicePaisa(inv.totalSgstPaisa)}</span>
                       </div>`
                    : ""
                }
                <div class="grand-total-row">
                  <span>Total Amount:</span>
                  <span class="font-mono">${formatInvoicePaisa(inv.totalPaisa)}</span>
                </div>
              </div>

              <div class="signatory-box">
                <div style="font-size: 11px; color: #64748b; margin-bottom: 30px;">For ${profile.shopName || "Sarkar Communication"}</div>
                <div class="sign-line"></div>
                <div style="font-size: 10px; font-weight: 800; color: #475569;">AUTHORIZED SIGNATORY</div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 350);
}
