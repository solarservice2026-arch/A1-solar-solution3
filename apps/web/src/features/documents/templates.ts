type RecordValue = Record<string, unknown>;

const esc = (value: unknown) =>
  String(value ?? "—").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const inr = (value: unknown) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(value || 0),
  );

const amountWords = (value: unknown) => {
  const n = Math.round(Number(value || 0));
  if (!Number.isFinite(n) || n < 0) return "";
  const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ],
    tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
  const under100 = (x: number): string =>
      x < 20
        ? (ones[x] ?? "")
        : `${tens[Math.floor(x / 10)] ?? ""}${x % 10 ? ` ${ones[x % 10] ?? ""}` : ""}`,
    under1000 = (x: number): string =>
      x < 100
        ? under100(x)
        : `${ones[Math.floor(x / 100)] ?? ""} Hundred${x % 100 ? ` ${under100(x % 100)}` : ""}`;
  const parts: string[] = [];
  let left = n;
  const crore = Math.floor(left / 10000000);
  left %= 10000000;
  const lakh = Math.floor(left / 100000);
  left %= 100000;
  const thousand = Math.floor(left / 1000);
  left %= 1000;
  if (crore) parts.push(`${under1000(crore)} Crore`);
  if (lakh) parts.push(`${under100(lakh)} Lakh`);
  if (thousand) parts.push(`${under100(thousand)} Thousand`);
  if (left) parts.push(under1000(left));
  return `${parts.join(" ") || "Zero"} Only`;
};

const base = (title: string, body: string) => {
  const headerImage =
    typeof window === "undefined"
      ? "/document-assets/solar-document-header.png"
      : `${window.location.origin}/document-assets/solar-document-header.png`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font:13px Arial;color:#12343a;margin:0}.solar-hero{position:relative;margin-bottom:12px}.solar-header{display:block;width:100%;height:auto;max-height:68mm;object-fit:cover;border-radius:6px}.solar-banner-fallback{background:linear-gradient(135deg,#064e3b 0%,#047857 50%,#0284c7 100%);color:#fff;padding:16px 20px;border-radius:8px;text-align:center;font-family:Arial,sans-serif}.solar-banner-fallback h1{margin:0 0 4px;font-size:22px;color:#fef08a}.solar-banner-fallback p{margin:0;font-size:12px;opacity:0.9}.livfast{position:absolute;top:4mm;left:50%;transform:translateX(-50%);z-index:2;color:#ed1010;font:700 14px Arial;letter-spacing:.02em}.document-head{display:flex;justify-content:space-between;align-items:end;border-bottom:3px solid #193f73;padding:4px 0 10px}h1{font-size:25px;margin:0}h2{font-size:16px;margin:18px 0 8px}.muted{color:#587074}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:18px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd7d5;padding:7px;text-align:left}th{background:#193f73;color:white}.totals{margin:12px 0 12px auto;width:280px}.section{break-inside:avoid}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:42px;align-items:end}.signature-image{display:block;width:190px;height:76px;object-fit:contain;margin:0 auto 5px}.signature-block{text-align:center}.line{border-top:1px solid #333;padding-top:7px}.page-break{break-before:page}.actions{position:fixed;right:15px;bottom:15px}@media print{.actions{display:none}.solar-header,.signature-image{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><div class="solar-hero"><span class="livfast">LivFast</span><img class="solar-header" src="${esc(headerImage)}" alt="A1 Solar Solution Notation Banner Header" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='block';"><div class="solar-banner-fallback" style="display:none"><h1>A1 SOLAR SOLUTIONS</h1><p>PM Surya Ghar: Muft Bijli Yojana — Authorized Vendor & System Integrator</p></div></div><header class="document-head"><div><h1>A1 Solar Solution</h1><span class="muted">Professional solar planning & installation</span></div><b>${esc(title)}</b></header>${body}<button class="actions" onclick="window.print()">Print / Save PDF</button></body></html>`;
};

export function quotationDocument(row: RecordValue) {
  const customer = (row.customers ?? {}) as RecordValue,
    items = Array.isArray(row.quotation_items)
      ? (row.quotation_items as RecordValue[])
      : [];
  const signature =
    typeof window === "undefined"
      ? "/document-assets/vendor-authorized-signature.png"
      : `${window.location.origin}/document-assets/vendor-authorized-signature.png`;
  const itemRows =
    items
      .map((item, index) => {
        const product = (item.products ?? {}) as RecordValue;
        return `<tr><td>${index + 1}</td><td><b>${esc(product.name ?? item.product_name ?? item.description)}</b></td><td>${esc(item.description)}</td><td>${esc(product.brand ?? product.model ?? item.brand ?? item.model)}</td><td>${esc(item.quantity)}</td><td>${inr(item.unit_price)}</td><td>${inr(Number(item.quantity || 0) * Number(item.unit_price || 0))}</td></tr>`;
      })
      .join("") || `<tr><td colspan="7">No line items recorded</td></tr>`;
  return base(
    `Quotation ${row.quotation_number ?? ""}`,
    `<div class="grid"><div><h2>Quotation</h2><b>${esc(row.quotation_number)}</b><p>Date: ${esc(row.quotation_date)}<br>Valid until: ${esc(row.valid_until)}</p></div><div><h2>Customer</h2><b>${esc(customer.name)}</b><p>${esc(customer.mobile)}<br>${esc(row.installation_address)}</p></div></div>
 <h2>${esc(row.capacity_kw)} kW ${esc(row.quotation_type ?? "Solar Power System")}</h2>
 <table><thead><tr><th>#</th><th>Product Name</th><th>Product Description</th><th>Brand / Model</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
 <table class="totals"><tr><td>Subtotal</td><td>${inr(row.subtotal)}</td></tr><tr><td>Discount</td><td>${inr(row.discount)}</td></tr><tr><td>Tax</td><td>${inr(row.tax)}</td></tr><tr><th>Grand total</th><th>${inr(row.grand_total)}</th></tr></table>
 <section class="page-break"><h2>Payment terms</h2><p>${esc(row.payment_terms ?? "Advance payment on order confirmation; balance after installation completion. Payment percentages are governed by the approved business template.")}</p>
 <h2>Delivery & installation</h2><p>${esc(row.installation_terms ?? "Installation begins after advance payment and is subject to site readiness, approvals and material availability. Additional civil or electrical work is charged separately.")}</p>
 <h2>Guarantee & support</h2><p>${esc(row.warranty_terms ?? "Solar panels, inverter and components carry their respective manufacturer warranties. Physical damage, misuse, theft, fire and natural calamities are excluded unless expressly covered.")}</p>
 <h2>System components</h2><p><b>Solar panels:</b> High-efficiency modules selected for the approved capacity.</p><p><b>Inverter:</b> Grid-compatible inverter sized for the system.</p><p><b>Mounting structure:</b> Site-specific structure designed for safe placement.</p><p><b>Monitoring:</b> Performance monitoring subject to selected equipment.</p>
 <div class="signatures"><div class="line">Customer acceptance</div><div class="signature-block"><img class="signature-image" src="${esc(signature)}" alt="A1 Solar proprietor signature"><div class="line"><b>For A1 Solar Solution</b><br>Authorized Signatory / Proprietor</div></div></div></section>`,
  );
}

export function invoiceDocument(row: RecordValue) {
  const customer = (row.customers ?? {}) as RecordValue,
    items = Array.isArray(row.invoice_items)
      ? (row.invoice_items as RecordValue[])
      : [];
  const itemRows =
    items
      .map((item, index) => {
        const product = (item.products ?? {}) as RecordValue;
        return `<tr><td>${index + 1}.</td><td><b>${esc(item.product_name ?? product.name)}</b></td><td>${esc(item.description)}</td><td>${esc(item.brand ?? product.brand ?? product.model)}</td><td>${esc(item.quantity)}</td><td>${inr(item.unit_price)}</td><td>${inr(item.line_amount ?? Number(item.quantity || 0) * Number(item.unit_price || 0))}</td></tr>`;
      })
      .join("") || `<tr><td colspan="7">No line items recorded</td></tr>`;
  const balance = Math.max(
    0,
    Number(row.total || 0) - Number(row.paid_amount || 0),
  );
  const origin = typeof window === "undefined" ? "" : window.location.origin,
    header = `${origin}/document-assets/solar-document-header.png`,
    signature = `${origin}/document-assets/vendor-authorized-signature.png`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(row.invoice_number)}</title><style>
 @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font:12px Arial,Helvetica,sans-serif;color:#444;background:#eee}.sheet{width:210mm;min-height:297mm;margin:auto;background:#fff}.hero-wrap{position:relative}.hero{width:100%;height:64mm;display:block;object-fit:cover}.livfast{position:absolute;top:4mm;left:50%;transform:translateX(-50%);z-index:2;color:#ed1010;font-weight:700;font-size:14px}.invoice-head{display:grid;grid-template-columns:34mm 1fr 32mm 35mm;align-items:center;padding:5mm 14mm;border-bottom:1px solid #e1e5ea}.mini-brand{font-weight:800;color:#163d52;text-align:center;font-size:14px}.doc-title{text-align:center;border-right:1px solid #dce1e7}.doc-title h1{margin:0;color:#ed1010;font-size:24px;letter-spacing:.04em}.doc-title b{display:block;color:#586bc5;font-size:14px;margin-top:2px}.meta{text-align:center;color:#8a95ae;font-size:13px}.meta b{display:block;color:#586bc5;font-size:14px;margin-top:4px}.party{display:grid;grid-template-columns:1fr 1fr;background:#f0f4fb;padding:7mm 14mm;gap:15mm;font-size:13px;line-height:1.5}.party>div:last-child{text-align:right}.party b{font-size:14px}.products{padding:8mm 14mm 3mm}.products table{width:100%;border-collapse:collapse}.products th{color:#586bc5;text-transform:uppercase;font-size:10px;border-bottom:2px solid #586bc5;padding:7px 5px;text-align:left}.products td{padding:10px 5px;border-bottom:1px solid #dde1e6;font-size:12px}.products th:nth-last-child(-n+3),.products td:nth-last-child(-n+3){text-align:right}.summary{display:flex;justify-content:flex-end;padding:4mm 14mm}.total-box{width:96mm;background:#5d6fc8;color:#fff;padding:5mm;font-size:14px}.total-line,.words-line{display:flex;justify-content:space-between;gap:12px}.total-line{font-size:16px;font-weight:700}.words-line{margin-top:7px;font-weight:700}.gst{text-align:right;margin-top:6px;font-size:11px}.bottom{display:grid;grid-template-columns:1fr 65mm;padding:5mm 14mm;gap:12mm;align-items:end}.payment h2{color:#586bc5;font-size:14px;margin:0 0 5px}.payment{font-size:13px;font-weight:700;line-height:1.5}.signature{text-align:center}.signature img{width:55mm;height:22mm;object-fit:contain}.signature b{display:block;color:#5d46a8}.status{padding:0 14mm 5mm;display:flex;justify-content:space-between;color:#666}.actions{position:fixed;right:15px;bottom:15px}@media print{body{background:#fff}.actions{display:none}.sheet{margin:0}.hero,.signature img{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><main class="sheet">
 <div class="hero-wrap"><span class="livfast">LivFast</span><img class="hero" src="${esc(header)}" alt="A1 Solar Solution"></div>
 <section class="invoice-head"><div class="mini-brand">A1 SOLAR<br>SOLUTION</div><div class="doc-title"><h1>INVOICE</h1><b>${esc(row.title ?? "SOLAR POWER SYSTEM")}</b></div><div class="meta">Date<b>${esc(row.invoice_date)}</b></div><div class="meta">Invoice #<b>${esc(row.invoice_number)}</b></div></section>
  <section class="party"><div><b>A1 SOLAR SOLUTION</b><br>Mobile: 7739661147<br>Email: a1solarsolution2026@gmail.com<br>GSTIN: 10EFTPA0258C1Z1<br>VISHNUPUR KAIJU PATEHPUR VAISHALI BIHA</div><div><b>${esc(customer.name)}</b><br>Mobile: ${esc(customer.mobile)}<br>${customer.email ? `Email: ${esc(customer.email)}<br>` : ""}${customer.gst_number ? `GSTIN: ${esc(customer.gst_number)}<br>` : ""}${esc(row.installation_address)}</div></section>
 <section class="products"><table><thead><tr><th>#</th><th>Product Name</th><th>Description</th><th>Brand</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>${itemRows}</tbody></table></section>
 <section class="summary"><div class="total-box"><div class="total-line"><span>Total :</span><span>${inr(row.total)}/-</span></div><div class="words-line"><span>In Words :</span><span>${esc(amountWords(row.total))}</span></div><div class="gst">(Including GST)</div></div></section>
 <section class="bottom"><div class="payment"><h2>PAYMENT DETAILS</h2>ACCOUNT HOLDER: A1 SOLAR SOLUTION<br>PUNJAB NATIONAL BANK<br>BRANCH: TAJPUR<br>A/C NO: 9335002100003167<br>IFSC CODE: PUNB0933500</div><div class="signature"><img src="${esc(signature)}" alt="Proprietor signature"><b>A1 SOLAR SOLUTION<br>PROPRIETOR</b></div></section>
 <section class="status"><span>Paid: ${inr(row.paid_amount)} &nbsp; | &nbsp; Balance: ${inr(balance)}</span><span>Status: ${esc(row.status)} &nbsp; | &nbsp; Due: ${esc(row.due_date)}</span></section>
 </main><button class="actions" onclick="window.print()">Print / Save PDF</button></body></html>`;
}

export function agreementDocument(row: RecordValue) {
  const customer = (row.customers ?? {}) as RecordValue,
    merged = (row.merged_data ?? {}) as RecordValue;
  const origin = typeof window === "undefined" ? "" : window.location.origin,
    stamp = `${origin}/document-assets/agreement-stamp-paper.png`,
    vendorSign = `${origin}/document-assets/vendor-authorized-signature.png`;
  const rawDate = String(merged.agreement_date ?? row.created_at),
    parsedDate = new Date(rawDate),
    date = esc(rawDate),
    address = esc(merged.consumer_address);
  const day = Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.getDate(),
    month = Number.isNaN(parsedDate.getTime())
      ? ""
      : parsedDate.toLocaleString("en-IN", { month: "long" }).toUpperCase(),
    year = Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.getFullYear(),
    displayDate = Number.isNaN(parsedDate.getTime())
      ? date
      : parsedDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  const customerSigHtml = row.customer_signature_url
    ? `<img class="vendor-sign" src="${esc(String(row.customer_signature_url))}" alt="Customer signature" style="height:20mm;max-width:58mm;object-fit:contain;display:block;margin:1mm 0;print-color-adjust:exact;-webkit-print-color-adjust:exact">`
    : `<div class="customer-sign-banner" style="border: 2px dashed #047857; background: #ecfdf5; border-radius: 6px; padding: 10px; text-align: center; margin: 6px 0; color: #065f46; font-size: 11px; font-weight: 600;"><span style="font-size:13px; display:block; margin-bottom:2px;">✍️ Customer Signature Banner</span>(Digital / Physical Signature &amp; Thumb Impression)</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Agreement ${esc(row.agreement_number)}</title><style>
 @page{size:A4;margin:10mm 12mm}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#161616;font-family:Arial,Helvetica,sans-serif;font-size:9.3px;line-height:1.28}.page{position:relative;break-after:page;page-break-after:always}.page:last-of-type{break-after:auto;page-break-after:auto}.stamp{display:block;width:145mm;height:20mm;object-fit:contain;margin:0 auto 2mm}.annexure{text-align:right;font-weight:700}.title{text-align:center;font-size:11.5px;line-height:1.25;margin:2mm 8mm}.center{text-align:center;margin:1.5mm 0}.clause{margin:1.7mm 0}.clause b,.number{font-weight:700}p{margin:1.7mm 0}ol{padding-left:5mm;margin:1.5mm 0}li{margin:1.2mm 0}h3{font-size:10px;margin:2mm 0 1mm}table{width:100%;border-collapse:collapse;margin:2mm 0;break-inside:avoid}th,td{border:1px solid #555;padding:2.5px 4px;text-align:left}th{background:#f0f0f0}.party-grid{display:grid;grid-template-columns:1fr 1fr;gap:14mm;margin-top:9mm;break-inside:avoid}.signature-box{min-height:34mm}.vendor-sign{height:20mm;max-width:58mm;object-fit:contain;display:block;margin:1mm 0}.line{border-top:1px solid #222;padding-top:1.5mm}.disclaimer{font-size:8px;border-top:1px solid #777;padding-top:1.5mm;margin-top:4mm}.actions{position:fixed;right:15px;bottom:15px}@media print{.actions{display:none}.stamp,.vendor-sign{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
 <section class="page"><img class="stamp" src="${esc(stamp)}" alt="Agreement stamp paper" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='block';"><div class="stamp-banner-fallback" style="display:none; text-align:center; border:2px dashed #b91c1c; background:#fef2f2; padding:10px; border-radius:8px; margin:0 auto 10px; width:145mm;"><h3 style="margin:0; color:#991b1b; font-size:14px;">GOVERNMENT OF INDIA NON-JUDICIAL STAMP PAPER</h3><p style="margin:2px 0 0; color:#7f1d1d; font-size:11px;">PM SURYA GHAR: MUFT BIJLI YOJANA — OFFICIAL AGREEMENT FORM</p></div><div class="annexure">Annexure 2</div><h1 class="title">Agreement between Consumer &amp; Vendor for installation of grid connected rooftop solar (RTS) project<br>under PM – Surya Ghar: Muft Bijali Yojana</h1>
 <p>This agreement is executed on <b>${day} (Day) - ${month} (Month) - ${year} (Year)</b> for design, supply, installation, commissioning and 5-year comprehensive maintenance of RTS project/system along with warranty under PM Surya Ghar: Muft Bijli Yojana.</p>
  <p class="center"><b>Between</b></p><p><b>${esc(customer.name)} (Name of Consumer)</b> having<br><b>${address}</b> (herein referred to as first Party i.e. Consumer / purchaser / owner of system).</p><p class="center"><b>And</b></p><p><b>A1 SOLAR SOLUTIONS (Name of Vendor)</b> having registered office at <b>VISHNUPUR KAIJU PATEHPUR VAISHALI BIHA</b><br>(hereinafter referred to as second Party i.e. Vendor / contractor / System Integrator).</p>
 <p><b>Whereas</b><br>First Party wishes to install a Grid Connected Rooftop Solar Plant on the rooftop of the residential building of the Consumer under PM Surya Ghar: Muft Bijli Yojana.</p>
 <p><b>And whereas</b><br>Second Party has verified availability of appropriate roof and found it feasible to install a Grid Connected Roof Top Solar plant and that the second party is willing to design, supply, install, test, commission and carry out Operation &amp; Maintenance of the Rooftop Solar plant for 5 year period.</p>
 <p>On this day, the First Party and Second Party agree to the following:</p><p><b>The First Party hereby undertakes to perform the following activities:</b></p>
 <ol><li>Submission of online application at National Portal for installation of RTS project/system, Submission of application for net-metering and system inspection and upload of the relevant documents on the National Portal of the scheme.</li><li>Provide secure storage of the material of the RTS plant delivered at the premises till handover of the system.</li><li>Provide access to the Roof Top during installation of the plant, operation &amp; maintenance, testing of the plant and equipment and for meter reading from solar meter, inverter etc.</li><li>Provide electricity during plant installation and water for cleaning of the panels.</li><li>Report any malfunctioning of the plant to the Vendor during the warranty period.</li><li>Pay the amount as per the payment schedule as mutually agreed with the vendor, including any additional amount to the second party for any additional work / customization required depending upon the building condition.</li></ol>
 <p><b>The Second Party hereby undertakes to perform the following activities:</b></p></section>
 <section class="page"><p>The Vendor must follow all the standards and safety guidelines prescribed under state regulations and technical standards prescribed by MNRE for RTS projects, failing which the vendor is liable for blacklisting from participation in the govt. project/scheme and other penal actions in accordance with the law. The responsibility of supply, installation and commissioning of the rooftop solar project/system in complete compliance with MNRE scheme guidelines lies with the Vendor.</p>
 <p class="clause"><b>Site Survey:</b> Site visit, survey and development of detailed project report for installation of RTS system. This also includes feasibility study of roof, strength of roof and shadow free area. If any additional work or customization is involved for the plant installation as per site condition and requirement of the consumer building, the Vendor shall prepare an estimate and can raise separate invoice including GST in addition to the amount towards standard plant cost. The consumer shall pay the amount for such additional work directly to the Vendor.</p>
 <p class="clause"><b>Design &amp; Engineering:</b> Design of plant along with drawings and selection of components as per standard provided by the DISCOM/SERC/MNRE for best performance and safety of the plant.</p>
 <p class="clause"><b>Module and Inverter:</b> The solar modules, including the solar cells, should be manufactured in India. Both the solar modules and inverters shall conform to the relevant standards and specifications prescribed by MNRE. Any other requirement, viz. star labelling (solar modules), quality control orders and standards &amp; labelling (inverters) etc., shall also be complied.</p>
 <p class="clause"><b>Procurement &amp; Supply:</b> Procurement of complete system as per BIS/IS/IEC standard (whatever applicable) &amp; safety guidelines for installation of rooftop solar plants. The supplied materials should comply with all MNRE standards for release of subsidy.</p>
 <p class="clause"><b>Installation &amp; Civil work:</b> Complete civil work, structure work and electrical work (including drawings) following all the safety and relevant BIS standards.</p>
 <p class="clause"><b>Documentation (Technical Catalogues/Warranty Certificates/BIS certificates/other test reports etc):</b> All such documents shall be provided to the consumer for online uploading and submission of technical specifications, IEC/BIS report, Sr. Nos, Warranty card of Solar Panel &amp; Inverter, Layout &amp; Electrical SLD, Structure Design and Drawing, Cable and other detailed documents.</p>
 <p class="clause"><b>Project completion report (PCR):</b> Assisting the consumer in filling and uploading of signed documents (Consumer &amp; Vendor) on the national portal.</p>
 <p class="clause"><b>Warranty:</b> System warranty certificates should be provided to the consumer. The complete system should be warranted for 5 years from the date of commissioning by DISCOM. Individual component warranty documents provided by the manufacturer shall be provided to the consumer and all possible assistance should be extended to the consumer for claiming the warranty from the manufacturer.</p>
 <p class="clause"><b>NET meter &amp; Grid Connectivity:</b> Net meter supply/procurement, testing and approvals shall be in the scope of vendor. Grid connection of the plant shall be in the scope of the vendor.</p>
 <p class="clause"><b>Testing and Commissioning:</b> The vendor shall be present at the time of testing and commissioning by the DISCOM.</p>
 <p class="clause"><b>Operation &amp; Maintenance:</b> Five (5) years Comprehensive Operation and Maintenance including overhauling, wear and tear and regular checking of healthiness of system at proper interval shall be in the scope of vendor. The vendor shall also educate the consumer on best practices for cleaning of the modules and system maintenance.</p>
 <p class="clause"><b>Insurance:</b> Any insurance cost pertaining to material transfer/storage before commissioning of the system shall be in the scope of the vendor.</p>
 <p class="clause"><b>Applicable Standard:</b> The system must meet the technical standards and specifications notified by MNRE. The vendor is solely responsible to supply component and service which meets the technical standards and specification prescribed by MNRE and State DISCOMs.</p>
 <p class="clause"><b>Project/system cost &amp; payment terms:</b> The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</p></section>
 <section class="page"><p class="clause"><b>Dispute:</b> In-case of any dispute between consumer and vendor (in supply/installation/maintenance of system or payment terms), both parties must settle the same mutually or as per law. MNRE/DISCOM shall not be liable for, and would not be a party to any dispute arising between vendor and consumer.</p>
 <p class="clause"><b>Subsidy / Project Related Documents:</b> Vendor must provide all the documents to consumer and help in uploading the same to National Portal for smooth release of subsidy.</p>
 <p class="clause"><b>Performance of Plant:</b> The Performance Ratio (PR) of Plant must be 75% at the time of commissioning of the project by DISCOM or its authorised agency. Vendor must provide (returnable basis) radiation sensor with valid calibration certificate of any NABL / International laboratory at the time of commissioning/testing of the plant. Vendor must maintain the PR of the plant till warranty of project i.e. 5 years from the date of commissioning.</p>
 <p class="clause"><b>19. Mutually Agreed Terms of Payment:</b></p><p>The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</p>
  <div class="party-grid"><div class="signature-box"><b>First Party (Consumer)</b><p>Name: ${esc(customer.name)}<br>Address: ${address}</p>${customerSigHtml}<div class="line">Signature:<br>Date: ${esc(displayDate)}</div></div><div class="signature-box"><b>Second Party (Vendor)</b><p>Name: A1 SOLAR SOLUTIONS<br>Address: VISHNUPUR KAIJU PATEHPUR<br>VAISHALI BIHA</p><img class="vendor-sign" src="${esc(vendorSign)}" alt="Authorized vendor signature" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='block';"><div class="vendor-sig-banner" style="display:none; border:2px solid #1e3a8a; background:#eff6ff; border-radius:6px; padding:8px; text-align:center; color:#1e40af; font-size:11px; font-weight:700;">A1 SOLAR SOLUTIONS<br><small style="font-weight:normal">Authorized Signatory Stamp</small></div><div class="line">Signature:<br>Date: ${esc(displayDate)}</div></div></div>
 <p class="disclaimer"><b>Disclaimer:</b> This agreement is between Vendor and Consumer. Any dispute related to the same shall not involve any third party including MNRE and Distribution Utilities.</p></section>
 <button class="actions" onclick="window.print()">Print / Save PDF</button></body></html>`;
}
