type RecordValue = Record<string, unknown>;

const esc = (value: unknown) =>
  String(value ?? "—").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const inr = (value: unknown) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(value || 0),
  );

const amountWords = (value: unknown) => {
  const n = Math.round(Number(value || 0));
  if (!Number.isFinite(n) || n < 0) return "";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ],
  tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const under100 = (x: number): string =>
    x < 20 ? (ones[x] ?? "") : `${tens[Math.floor(x / 10)] ?? ""}${x % 10 ? ` ${ones[x % 10] ?? ""}` : ""}`,
  under1000 = (x: number): string =>
    x < 100 ? under100(x) : `${ones[Math.floor(x / 100)] ?? ""} Hundred${x % 100 ? ` ${under100(x % 100)}` : ""}`;
  const parts: string[] = [];
  let left = n;
  const crore = Math.floor(left / 10000000); left %= 10000000;
  const lakh = Math.floor(left / 100000); left %= 100000;
  const thousand = Math.floor(left / 1000); left %= 1000;
  if (crore) parts.push(`${under1000(crore)} Crore`);
  if (lakh) parts.push(`${under100(lakh)} Lakh`);
  if (thousand) parts.push(`${under100(thousand)} Thousand`);
  if (left) parts.push(under1000(left));
  return `${parts.join(" ") || "Zero"} Only`;
};

/** Shared CSS for all three documents — invoice-style layout */
const sharedCss = () => `
@page{size:A4;margin:0}
*{box-sizing:border-box}
body{margin:0;font:12px Arial,Helvetica,sans-serif;color:#333;background:#e8e8e8}
.sheet{width:210mm;min-height:297mm;margin:auto;background:#fff}
/* ─── Hero Banner ─── */
.hero{width:100%;height:58mm;display:block;object-fit:cover;print-color-adjust:exact;-webkit-print-color-adjust:exact}
/* ─── Sub-header row ─── */
.doc-header{display:grid;align-items:center;padding:4mm 14mm;border-bottom:1px solid #dde1ea;gap:0}
.doc-header.cols-4{grid-template-columns:36mm 1fr 34mm 36mm}
.doc-header.cols-3{grid-template-columns:36mm 1fr 60mm}
.mini-brand{font-weight:900;color:#163d52;font-size:13px;line-height:1.3;text-transform:uppercase}
.doc-title{text-align:center}
.doc-title h1{margin:0;font-size:22px;font-weight:900;letter-spacing:.06em;color:#1a3a6b}
.doc-title b{display:block;color:#586bc5;font-size:12px;margin-top:2px}
.meta{text-align:center;color:#8a95ae;font-size:11px;border-left:1px solid #dde1ea;padding-left:8mm}
.meta b{display:block;color:#1a3a6b;font-size:13px;font-weight:800;margin-top:3px}
/* ─── Party strip ─── */
.party{display:grid;grid-template-columns:1fr 1fr;background:#f0f4fb;padding:6mm 14mm;gap:12mm;font-size:12px;line-height:1.55}
.party>div:last-child{text-align:right}
.party b{font-size:13px;color:#1a3a6b}
/* ─── Product table ─── */
.products{padding:6mm 14mm 2mm}
.products table{width:100%;border-collapse:collapse}
.products th{color:#586bc5;text-transform:uppercase;font-size:10px;border-bottom:2px solid #586bc5;padding:6px 5px;text-align:left}
.products td{padding:9px 5px;border-bottom:1px solid #dde1e6;font-size:12px}
.products th:nth-last-child(-n+3),.products td:nth-last-child(-n+3){text-align:right}
/* ─── Totals ─── */
.summary{display:flex;justify-content:flex-end;padding:3mm 14mm}
.total-box{width:96mm;background:#1a3a6b;color:#fff;padding:5mm;font-size:14px}
.total-line,.words-line{display:flex;justify-content:space-between;gap:12px}
.total-line{font-size:15px;font-weight:700}
.words-line{margin-top:6px;font-weight:700;font-size:11px}
.gst{text-align:right;margin-top:5px;font-size:10px;opacity:.85}
/* ─── Bottom sections ─── */
.bottom{display:grid;grid-template-columns:1fr 64mm;padding:4mm 14mm;gap:10mm;align-items:end}
.payment h2{color:#586bc5;font-size:13px;margin:0 0 4px}
.payment{font-size:12px;font-weight:700;line-height:1.6}
.vsig{text-align:center}
.vsig img{width:54mm;height:21mm;object-fit:contain;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.vsig b{display:block;color:#1a3a6b;font-size:11px;margin-top:2px}
.status-bar{padding:0 14mm 4mm;display:flex;justify-content:space-between;color:#666;font-size:11px}
/* ─── Terms section (quotation page 2) ─── */
.terms{padding:6mm 14mm;font-size:12px;line-height:1.6}
.terms h2{font-size:13px;color:#1a3a6b;border-bottom:2px solid #586bc5;padding-bottom:3px;margin:10px 0 5px}
.terms p{margin:4px 0}
.sig-row{display:grid;grid-template-columns:1fr 1fr;gap:24mm;padding:8mm 14mm 6mm;align-items:end}
.sig-block{text-align:center}
.sig-block img{display:block;width:54mm;height:21mm;object-fit:contain;margin:0 auto 4px;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.sig-line{border-top:1px solid #333;padding-top:5px;font-size:11px}
/* ─── Agreement pages ─── */
.page{break-after:page;page-break-after:always}.page:last-of-type{break-after:auto;page-break-after:auto}
.agreement-body{padding:5mm 14mm;font-size:9.5px;line-height:1.32}
.agreement-body p{margin:2mm 0}
.agreement-body ol{padding-left:6mm;margin:2mm 0}
.agreement-body li{margin:1.5mm 0}
.agreement-body .clause{margin:2mm 0}
.party-grid{display:grid;grid-template-columns:1fr 1fr;gap:14mm;margin-top:10mm}
.sig-box{min-height:30mm}
.a-line{border-top:1px solid #333;padding-top:2mm;font-size:9px}
.disclaimer{font-size:8px;border-top:1px solid #aaa;padding-top:2mm;margin-top:5mm}
/* ─── Stamp ─── */
.stamp-wrap{text-align:center;margin:3mm 0 2mm}
.stamp{display:block;width:140mm;height:16mm;object-fit:contain;margin:0 auto;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.annexure{text-align:right;font-weight:700;font-size:10px;margin-bottom:1mm}
.agr-title{text-align:center;font-size:11px;font-weight:700;margin:2mm 8mm}
/* ─── Misc ─── */
.page-break{break-before:page;page-break-before:always}
.actions{position:fixed;right:15px;bottom:15px;z-index:999}
@media print{body{background:#fff}.actions{display:none}.sheet{margin:0}}
`;

// ─── QUOTATION ────────────────────────────────────────────────────────────────
export function quotationDocument(row: RecordValue) {
  const customer = (row.customers ?? {}) as RecordValue;
  const items = Array.isArray(row.quotation_items) ? (row.quotation_items as RecordValue[]) : [];
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const header = `${origin}/document-assets/solar-document-header.png`;
  const signature = `${origin}/document-assets/vendor-authorized-signature.png`;

  const itemRows = items.map((item, i) => {
    const product = (item.products ?? {}) as RecordValue;
    return `<tr>
      <td>${i + 1}</td>
      <td><b>${esc(product.name ?? item.product_name ?? item.description)}</b></td>
      <td>${esc(item.description)}</td>
      <td>${esc(product.brand ?? product.model ?? item.brand ?? item.model)}</td>
      <td style="text-align:right">${esc(item.quantity)}</td>
      <td style="text-align:right">${inr(item.unit_price)}</td>
      <td style="text-align:right">${inr(Number(item.quantity || 0) * Number(item.unit_price || 0))}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">No line items recorded</td></tr>`;

  const grandTotal = Number(row.grand_total || 0);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Quotation ${esc(row.quotation_number)}</title>
<style>${sharedCss()}</style></head><body>
<main class="sheet">
  <img class="hero" src="${esc(header)}" alt="A1 Solar Solution Header Banner">
  <div class="doc-header cols-4">
    <div class="mini-brand">A1 SOLAR<br>SOLUTION</div>
    <div class="doc-title"><h1>QUOTATION</h1><b>${esc(row.capacity_kw)} kW ${esc(row.quotation_type ?? "Solar Power System")}</b></div>
    <div class="meta">Date<b>${esc(row.quotation_date)}</b></div>
    <div class="meta">Quotation #<b>${esc(row.quotation_number)}</b></div>
  </div>
  <section class="party">
    <div><b>A1 SOLAR SOLUTION</b><br>Mobile: 7739661147<br>Email: a1solarsolution2026@gmail.com<br>GSTIN: 10EFTPA0258C1Z1<br>VISHNUPUR KAIJU PATEHPUR VAISHALI BIHA</div>
    <div><b>${esc(customer.name)}</b><br>Mobile: ${esc(customer.mobile)}${customer.email ? `<br>Email: ${esc(customer.email)}` : ""}${customer.gst_number ? `<br>GSTIN: ${esc(customer.gst_number)}` : ""}<br>${esc(row.installation_address)}</div>
  </section>
  <section class="products">
    <table>
      <thead><tr><th>#</th><th>Product Name</th><th>Description</th><th>Brand / Model</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </section>
  <section class="summary">
    <div class="total-box">
      <div class="total-line"><span>Grand Total :</span><span>${inr(grandTotal)}/-</span></div>
      <div class="words-line"><span>In Words :</span><span>${esc(amountWords(grandTotal))}</span></div>
      <div class="gst">(Subtotal: ${inr(row.subtotal)} | Discount: ${inr(row.discount)} | Tax: ${inr(row.tax)}) (Including GST)</div>
    </div>
  </section>

  <div class="page-break"></div>

  <div class="doc-header cols-4" style="margin-top:8mm">
    <div class="mini-brand">A1 SOLAR<br>SOLUTION</div>
    <div class="doc-title"><h1>QUOTATION</h1><b>Terms &amp; Conditions</b></div>
    <div class="meta">Valid Until<b>${esc(row.valid_until)}</b></div>
    <div class="meta">Quotation #<b>${esc(row.quotation_number)}</b></div>
  </div>
  <div class="terms">
    <h2>Payment Terms</h2>
    <p>${esc(row.payment_terms ?? "Advance payment on order confirmation; balance after installation completion. Payment percentages are governed by the approved business template.")}</p>
    <h2>Delivery &amp; Installation</h2>
    <p>${esc(row.installation_terms ?? "Installation begins after advance payment and is subject to site readiness, approvals and material availability. Additional civil or electrical work is charged separately.")}</p>
    <h2>Guarantee &amp; Support</h2>
    <p>${esc(row.warranty_terms ?? "Solar panels, inverter and components carry their respective manufacturer warranties. Physical damage, misuse, theft, fire and natural calamities are excluded unless expressly covered.")}</p>
    <h2>System Components</h2>
    <p><b>Solar Panels:</b> High-efficiency modules selected for the approved capacity.</p>
    <p><b>Inverter:</b> Grid-compatible inverter sized for the system.</p>
    <p><b>Mounting Structure:</b> Site-specific structure designed for safe placement.</p>
    <p><b>Monitoring:</b> Performance monitoring subject to selected equipment.</p>
  </div>
  <div class="sig-row">
    <div class="sig-block"><div class="sig-line">Customer Acceptance Signature</div></div>
    <div class="sig-block">
      <img src="${esc(signature)}" alt="A1 Solar proprietor signature">
      <div class="sig-line"><b>For A1 Solar Solution</b><br>Authorized Signatory / Proprietor</div>
    </div>
  </div>
</main>
<button class="actions" onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

// ─── INVOICE ─────────────────────────────────────────────────────────────────
export function invoiceDocument(row: RecordValue) {
  const customer = (row.customers ?? {}) as RecordValue;
  const items = Array.isArray(row.invoice_items) ? (row.invoice_items as RecordValue[]) : [];
  const itemRows = items.map((item, i) => {
    const product = (item.products ?? {}) as RecordValue;
    return `<tr>
      <td>${i + 1}.</td>
      <td><b>${esc(item.product_name ?? product.name)}</b></td>
      <td>${esc(item.description)}</td>
      <td>${esc(item.brand ?? product.brand ?? product.model)}</td>
      <td style="text-align:right">${esc(item.quantity)}</td>
      <td style="text-align:right">${inr(item.unit_price)}</td>
      <td style="text-align:right">${inr(item.line_amount ?? Number(item.quantity || 0) * Number(item.unit_price || 0))}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">No line items recorded</td></tr>`;

  const balance = Math.max(0, Number(row.total || 0) - Number(row.paid_amount || 0));
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const header = `${origin}/document-assets/solar-document-header.png`;
  const signature = `${origin}/document-assets/vendor-authorized-signature.png`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(row.invoice_number)}</title>
<style>${sharedCss()}</style></head><body>
<main class="sheet">
  <img class="hero" src="${esc(header)}" alt="A1 Solar Solution Header Banner">
  <div class="doc-header cols-4">
    <div class="mini-brand">A1 SOLAR<br>SOLUTION</div>
    <div class="doc-title"><h1>INVOICE</h1><b>${esc(row.title ?? "SOLAR POWER SYSTEM")}</b></div>
    <div class="meta">Date<b>${esc(row.invoice_date)}</b></div>
    <div class="meta">Invoice #<b>${esc(row.invoice_number)}</b></div>
  </div>
  <section class="party">
    <div><b>A1 SOLAR SOLUTION</b><br>Mobile: 7739661147<br>Email: a1solarsolution2026@gmail.com<br>GSTIN: 10EFTPA0258C1Z1<br>VISHNUPUR KAIJU PATEHPUR VAISHALI BIHA</div>
    <div><b>${esc(customer.name)}</b><br>Mobile: ${esc(customer.mobile)}${customer.email ? `<br>Email: ${esc(customer.email)}` : ""}${customer.gst_number ? `<br>GSTIN: ${esc(customer.gst_number)}` : ""}<br>${esc(row.installation_address)}</div>
  </section>
  <section class="products">
    <table>
      <thead><tr><th>#</th><th>Product Name</th><th>Description</th><th>Brand</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </section>
  <section class="summary">
    <div class="total-box">
      <div class="total-line"><span>Total :</span><span>${inr(row.total)}/-</span></div>
      <div class="words-line"><span>In Words :</span><span>${esc(amountWords(row.total))}</span></div>
      <div class="gst">(Including GST)</div>
    </div>
  </section>
  <section class="bottom">
    <div class="payment">
      <h2>PAYMENT DETAILS</h2>
      ACCOUNT HOLDER: A1 SOLAR SOLUTION<br>
      PUNJAB NATIONAL BANK<br>
      BRANCH: TAJPUR<br>
      A/C NO: 9335002100003167<br>
      IFSC CODE: PUNB0933500
    </div>
    <div class="vsig">
      <img src="${esc(signature)}" alt="Proprietor signature">
      <b>A1 SOLAR SOLUTION<br>PROPRIETOR</b>
    </div>
  </section>
  <section class="status-bar">
    <span>Paid: ${inr(row.paid_amount)} &nbsp;|&nbsp; Balance: ${inr(balance)}</span>
    <span>Status: ${esc(row.status)} &nbsp;|&nbsp; Due: ${esc(row.due_date)}</span>
  </section>
</main>
<button class="actions" onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

// ─── AGREEMENT ───────────────────────────────────────────────────────────────
export function agreementDocument(row: RecordValue) {
  const customer = (row.customers ?? {}) as RecordValue;
  const merged = (row.merged_data ?? {}) as RecordValue;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const header = `${origin}/document-assets/solar-document-header.png`;
  const stamp = `${origin}/document-assets/agreement-stamp-paper.png`;
  const vendorSign = `${origin}/document-assets/vendor-authorized-signature.png`;

  const rawDate = String(merged.agreement_date ?? row.created_at);
  const parsedDate = new Date(rawDate);
  const address = esc(merged.consumer_address);
  const day = Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.getDate();
  const month = Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toLocaleString("en-IN", { month: "long" }).toUpperCase();
  const year = Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.getFullYear();
  const displayDate = Number.isNaN(parsedDate.getTime()) ? esc(rawDate) : parsedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const customerSigHtml = row.customer_signature_url
    ? `<img style="height:18mm;max-width:55mm;object-fit:contain;display:block;margin:2mm 0;print-color-adjust:exact;-webkit-print-color-adjust:exact" src="${esc(String(row.customer_signature_url))}" alt="Customer signature">`
    : `<div style="border:2px dashed #047857;background:#ecfdf5;border-radius:5px;padding:8px;text-align:center;margin:4px 0;color:#065f46;font-size:9px;font-weight:700">✍️ Customer Signature &amp; Thumb Impression</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Agreement ${esc(row.agreement_number)}</title>
<style>${sharedCss()}</style></head><body>
<main class="sheet">

<!-- PAGE 1 -->
<div class="page">
  <div class="doc-header cols-3" style="margin-top:6mm">
    <div class="mini-brand">A1 SOLAR<br>SOLUTION</div>
    <div class="doc-title"><h1>AGREEMENT</h1><b>Grid Connected Rooftop Solar Installation</b></div>
    <div class="meta">Date<b>${esc(displayDate)}</b></div>
  </div>
  <div class="agreement-body">
    <div class="stamp-wrap"><img class="stamp" src="${esc(stamp)}" alt="Revenue stamp" onerror="this.style.display='none'"><div class="annexure">Annexure 2</div></div>
    <p class="agr-title"><b>Agreement between Consumer &amp; Vendor for installation of grid connected rooftop solar (RTS) project<br>under PM – Surya Ghar: Muft Bijali Yojana</b></p>
    <p>This agreement is executed on <b>${day} (Day) - ${month} (Month) - ${year} (Year)</b> for design, supply, installation, commissioning and 5-year comprehensive maintenance of RTS project/system along with warranty under PM Surya Ghar: Muft Bijli Yojana.</p>
    <p style="text-align:center"><b>Between</b></p>
    <p><b>${esc(customer.name)} (Name of Consumer)</b> having<br><b>${address}</b> (herein referred to as first Party i.e. Consumer / purchaser / owner of system).</p>
    <p style="text-align:center"><b>And</b></p>
    <p><b>A1 SOLAR SOLUTIONS (Name of Vendor)</b> having registered office at <b>VISHNUPUR KAIJU PATEHPUR VAISHALI BIHA</b><br>(hereinafter referred to as second Party i.e. Vendor / contractor / System Integrator).</p>
    <p><b>Whereas</b><br>First Party wishes to install a Grid Connected Rooftop Solar Plant on the rooftop of the residential building of the Consumer under PM Surya Ghar: Muft Bijli Yojana.</p>
    <p><b>And whereas</b><br>Second Party has verified availability of appropriate roof and found it feasible to install a Grid Connected Roof Top Solar plant and that the second party is willing to design, supply, install, test, commission and carry out Operation &amp; Maintenance of the Rooftop Solar plant for 5 year period.</p>
    <p>On this day, the First Party and Second Party agree to the following:</p>
    <p><b>The First Party hereby undertakes to perform the following activities:</b></p>
    <ol>
      <li>Submission of online application at National Portal for installation of RTS project/system, Submission of application for net-metering and system inspection and upload of the relevant documents on the National Portal of the scheme.</li>
      <li>Provide secure storage of the material of the RTS plant delivered at the premises till handover of the system.</li>
      <li>Provide access to the Roof Top during installation of the plant, operation &amp; maintenance, testing of the plant and equipment and for meter reading from solar meter, inverter etc.</li>
      <li>Provide electricity during plant installation and water for cleaning of the panels.</li>
      <li>Report any malfunctioning of the plant to the Vendor during the warranty period.</li>
      <li>Pay the amount as per the payment schedule as mutually agreed with the vendor, including any additional amount to the second party for any additional work / customization required depending upon the building condition.</li>
    </ol>
    <p><b>The Second Party hereby undertakes to perform the following activities:</b></p>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  <div class="doc-header cols-3" style="margin-top:6mm">
    <div class="mini-brand">A1 SOLAR<br>SOLUTION</div>
    <div class="doc-title"><h1>AGREEMENT</h1><b>Vendor Obligations &amp; Standards</b></div>
    <div class="meta">Ref #<b>${esc(row.agreement_number)}</b></div>
  </div>
  <div class="agreement-body">
    <p>The Vendor must follow all the standards and safety guidelines prescribed under state regulations and technical standards prescribed by MNRE for RTS projects, failing which the vendor is liable for blacklisting from participation in the govt. project/scheme and other penal actions in accordance with the law. The responsibility of supply, installation and commissioning of the rooftop solar project/system in complete compliance with MNRE scheme guidelines lies with the Vendor.</p>
    <p class="clause"><b>Site Survey:</b> Site visit, survey and development of detailed project report for installation of RTS system. This also includes feasibility study of roof, strength of roof and shadow free area. If any additional work or customization is involved for the plant installation as per site condition and requirement of the consumer building, the Vendor shall prepare an estimate and can raise separate invoice including GST in addition to the amount towards standard plant cost. The consumer shall pay the amount for such additional work directly to the Vendor.</p>
    <p class="clause"><b>Design &amp; Engineering:</b> Design of plant along with drawings and selection of components as per standard provided by the DISCOM/SERC/MNRE for best performance and safety of the plant.</p>
    <p class="clause"><b>Module and Inverter:</b> The solar modules, including the solar cells, should be manufactured in India. Both the solar modules and inverters shall conform to the relevant standards and specifications prescribed by MNRE. Any other requirement, viz. star labelling (solar modules), quality control orders and standards &amp; labelling (inverters) etc., shall also be complied.</p>
    <p class="clause"><b>Procurement &amp; Supply:</b> Procurement of complete system as per BIS/IS/IEC standard (whatever applicable) &amp; safety guidelines for installation of rooftop solar plants. The supplied materials should comply with all MNRE standards for release of subsidy.</p>
    <p class="clause"><b>Installation &amp; Civil work:</b> Complete civil work, structure work and electrical work (including drawings) following all the safety and relevant BIS standards.</p>
    <p class="clause"><b>Documentation:</b> All such documents shall be provided to the consumer for online uploading and submission of technical specifications, IEC/BIS report, Sr. Nos, Warranty card of Solar Panel &amp; Inverter, Layout &amp; Electrical SLD, Structure Design and Drawing, Cable and other detailed documents.</p>
    <p class="clause"><b>Project completion report (PCR):</b> Assisting the consumer in filling and uploading of signed documents (Consumer &amp; Vendor) on the national portal.</p>
    <p class="clause"><b>Warranty:</b> System warranty certificates should be provided to the consumer. The complete system should be warranted for 5 years from the date of commissioning by DISCOM. Individual component warranty documents provided by the manufacturer shall be provided to the consumer and all possible assistance should be extended to the consumer for claiming the warranty from the manufacturer.</p>
    <p class="clause"><b>NET meter &amp; Grid Connectivity:</b> Net meter supply/procurement, testing and approvals shall be in the scope of vendor. Grid connection of the plant shall be in the scope of the vendor.</p>
    <p class="clause"><b>Testing and Commissioning:</b> The vendor shall be present at the time of testing and commissioning by the DISCOM.</p>
    <p class="clause"><b>Operation &amp; Maintenance:</b> Five (5) years Comprehensive Operation and Maintenance including overhauling, wear and tear and regular checking of healthiness of system at proper interval shall be in the scope of vendor. The vendor shall also educate the consumer on best practices for cleaning of the modules and system maintenance.</p>
    <p class="clause"><b>Insurance:</b> Any insurance cost pertaining to material transfer/storage before commissioning of the system shall be in the scope of the vendor.</p>
    <p class="clause"><b>Applicable Standard:</b> The system must meet the technical standards and specifications notified by MNRE. The vendor is solely responsible to supply component and service which meets the technical standards and specification prescribed by MNRE and State DISCOMs.</p>
    <p class="clause"><b>Project/system cost &amp; payment terms:</b> The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</p>
  </div>
</div>

<!-- PAGE 3 – Signatures -->
<div class="page">
  <div class="doc-header cols-3" style="margin-top:6mm">
    <div class="mini-brand">A1 SOLAR<br>SOLUTION</div>
    <div class="doc-title"><h1>AGREEMENT</h1><b>Signatures &amp; Declaration</b></div>
    <div class="meta">Date<b>${esc(displayDate)}</b></div>
  </div>
  <div class="agreement-body">
    <p class="clause"><b>Dispute:</b> In-case of any dispute between consumer and vendor (in supply/installation/maintenance of system or payment terms), both parties must settle the same mutually or as per law. MNRE/DISCOM shall not be liable for, and would not be a party to any dispute arising between vendor and consumer.</p>
    <p class="clause"><b>Subsidy / Project Related Documents:</b> Vendor must provide all the documents to consumer and help in uploading the same to National Portal for smooth release of subsidy.</p>
    <p class="clause"><b>Performance of Plant:</b> The Performance Ratio (PR) of Plant must be 75% at the time of commissioning of the project by DISCOM or its authorised agency. Vendor must provide (returnable basis) radiation sensor with valid calibration certificate of any NABL / International laboratory at the time of commissioning/testing of the plant. Vendor must maintain the PR of the plant till warranty of project i.e. 5 years from the date of commissioning.</p>
    <p class="clause"><b>19. Mutually Agreed Terms of Payment:</b> The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</p>
    <div class="party-grid">
      <div class="sig-box">
        <b>First Party (Consumer)</b>
        <p>Name: ${esc(customer.name)}<br>Address: ${address}</p>
        ${customerSigHtml}
        <div class="a-line">Signature &amp; Thumb Impression<br>Date: ${esc(displayDate)}</div>
      </div>
      <div class="sig-box">
        <b>Second Party (Vendor)</b>
        <p>Name: A1 SOLAR SOLUTIONS<br>Address: VISHNUPUR KAIJU PATEHPUR<br>VAISHALI BIHA</p>
        <img style="height:18mm;max-width:55mm;object-fit:contain;display:block;margin:2mm 0;print-color-adjust:exact;-webkit-print-color-adjust:exact" src="${esc(vendorSign)}" alt="Vendor signature" onerror="this.style.display='none'">
        <div class="a-line">Signature &amp; Stamp<br>Date: ${esc(displayDate)}</div>
      </div>
    </div>
    <p class="disclaimer"><b>Disclaimer:</b> This agreement is between Vendor and Consumer. Any dispute related to the same shall not involve any third party including MNRE and Distribution Utilities.</p>
  </div>
</div>

</main>
<button class="actions" onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}
