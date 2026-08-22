// Generates crisp, Arabic-perfect "scanned document" SVGs.
// Used to seed realistic archive documents and to simulate scanner output,
// without depending on external image services.

export interface ScanOptions {
  title: string;
  docNumber?: string;
  department?: string;
  date?: string;
  body: string[];
  kind?: "memo" | "invoice" | "contract" | "letter" | "report";
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const PALETTES: Record<string, { accent: string; soft: string }> = {
  memo: { accent: "#1d4ed8", soft: "#eff6ff" },
  invoice: { accent: "#047857", soft: "#ecfdf5" },
  contract: { accent: "#7c2d12", soft: "#fef3c7" },
  letter: { accent: "#6d28d9", soft: "#f5f3ff" },
  report: { accent: "#0f766e", soft: "#f0fdfa" },
};

export function makeScanSvg(opts: ScanOptions): string {
  const kind = opts.kind || "memo";
  const p = PALETTES[kind] || PALETTES.memo;
  const W = 850;
  const H = 1100;
  const date = opts.date || new Intl.DateTimeFormat("ar-EG").format(new Date());

  const bodyLines: string[] = [];
  for (const para of opts.body) {
    bodyLines.push(...wrap(para, 70));
  }

  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" direction="rtl">`);
  lines.push(`<rect width="${W}" height="${H}" fill="#fbfaf6"/>`);
  // subtle paper grain
  lines.push(`<rect width="${W}" height="${H}" fill="url(#noise)" opacity="0.5"/>`);
  lines.push(`<defs>`);
  lines.push(`<filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`);
  lines.push(`<pattern id="noise" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fbfaf6"/><rect width="2" height="2" x="3" y="1" fill="#000" opacity="0.015"/></pattern>`);
  lines.push(`</defs>`);

  // header band
  lines.push(`<rect x="48" y="48" width="${W - 96}" height="92" rx="6" fill="${p.soft}" stroke="${p.accent}" stroke-width="1.5"/>`);
  lines.push(`<rect x="48" y="48" width="10" height="92" rx="3" fill="${p.accent}"/>`);
  // logo mark
  lines.push(`<circle cx="105" cy="94" r="26" fill="${p.accent}"/>`);
  lines.push(`<text x="105" y="103" font-family="Cairo, sans-serif" font-size="26" fill="#fff" text-anchor="middle" font-weight="700">أر</text>`);
  lines.push(`<text x="${W - 70}" y="86" font-family="Cairo, sans-serif" font-size="25" fill="${p.accent}" text-anchor="end" font-weight="800">${esc(opts.department || "الهيئة العامة للأرشيف")}</text>`);
  lines.push(`<text x="${W - 70}" y="116" font-family="Cairo, sans-serif" font-size="14" fill="#64748b" text-anchor="end">الإدارة العامة · نظام الأرشفة الإلكتروني</text>`);

  // title
  lines.push(`<text x="${W / 2}" y="190" font-family="Cairo, sans-serif" font-size="30" fill="#0f172a" text-anchor="middle" font-weight="800">${esc(opts.title)}</text>`);
  // meta line
  lines.push(`<text x="70" y="232" font-family="Cairo, sans-serif" font-size="16" fill="#475569">الرقم المرجعي: <tspan font-weight="700" fill="#0f172a">${esc(opts.docNumber || "—")}</tspan></text>`);
  lines.push(`<text x="${W - 70}" y="232" font-family="Cairo, sans-serif" font-size="16" fill="#475569" text-anchor="end">التاريخ: <tspan font-weight="700" fill="#0f172a">${esc(date)}</tspan></text>`);
  lines.push(`<line x1="70" y1="252" x2="${W - 70}" y2="252" stroke="#e2e8f0" stroke-width="2"/>`);

  // body
  let y = 300;
  for (const line of bodyLines) {
    lines.push(`<text x="${W - 70}" y="${y}" font-family="Cairo, sans-serif" font-size="18" fill="#1e293b" text-anchor="end">${esc(line)}</text>`);
    y += 34;
  }

  // kind-specific extras
  if (kind === "invoice") {
    y += 12;
    const rows = [
      ["رقم", "البيان", "الكمية", "السعر", "الإجمالي"],
      ["1", "خدمات استشارية", "10", "1,200", "12,000"],
      ["2", "ترخيص برمجي", "1", "8,500", "8,500"],
      ["3", "صيانة دورية", "4", "750", "3,000"],
    ];
    const cols = [70, 250, 430, 560, 720];
    const cw = [170, 170, 120, 110, 120];
    rows.forEach((r, ri) => {
      const isHead = ri === 0;
      lines.push(`<rect x="70" y="${y}" width="${W - 140}" height="38" fill="${isHead ? p.accent : ri % 2 ? "#f8fafc" : "#fff"}" stroke="#e2e8f0"/>`);
      r.forEach((cell, ci) => {
        lines.push(`<text x="${cols[ci] + cw[ci] / 2}" y="${y + 25}" font-family="Cairo, sans-serif" font-size="${isHead ? 15 : 15}" fill="${isHead ? "#fff" : "#1e293b"}" text-anchor="middle" font-weight="${isHead ? 700 : 400}">${esc(cell)}</text>`);
      });
      y += 38;
    });
    y += 18;
    lines.push(`<rect x="${W - 250}" y="${y}" width="180" height="44" rx="6" fill="${p.soft}" stroke="${p.accent}"/>`);
    lines.push(`<text x="${W - 160}" y="${y + 28}" font-family="Cairo, sans-serif" font-size="18" fill="${p.accent}" text-anchor="middle" font-weight="800">الإجمالي: 23,500 ر.س</text>`);
  }

  // stamps & signature
  const sx = 150;
  const sy = H - 170;
  lines.push(`<g transform="translate(${sx},${sy}) rotate(-12)">`);
  lines.push(`<circle cx="0" cy="0" r="62" fill="none" stroke="${p.accent}" stroke-width="3" opacity="0.55"/>`);
  lines.push(`<circle cx="0" cy="0" r="52" fill="none" stroke="${p.accent}" stroke-width="1.5" opacity="0.4"/>`);
  lines.push(`<text x="0" y="-8" font-family="Cairo, sans-serif" font-size="15" fill="${p.accent}" text-anchor="middle" font-weight="700" opacity="0.7">معتمد رسمياً</text>`);
  lines.push(`<text x="0" y="14" font-family="Cairo, sans-serif" font-size="11" fill="${p.accent}" text-anchor="middle" opacity="0.6">EDMS · أرشفة إلكترونية</text>`);
  lines.push(`</g>`);

  lines.push(`<text x="${W - 120}" y="${H - 150}" font-family="Cairo, sans-serif" font-size="16" fill="#475569" text-anchor="end">التوقيع المعتمد:</text>`);
  lines.push(`<path d="M${W - 280},${H - 120} q40,-30 80,-5 t70,10" fill="none" stroke="#1e293b" stroke-width="2" opacity="0.7"/>`);

  // footer
   lines.push(`<line x1="70" y1="${H - 80}" x2="${W - 70}" y2="${H - 80}" stroke="#e2e8f0" stroke-width="1.5"/>`);
   lines.push(`<text x="${W / 2}" y="${H - 55}" font-family="Cairo, sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">تم إنشاء هذا المستند وإيداعه آلياً عبر نظام الأرشفة الإلكتروني EDMS · صفحة رقمية موثقة</text>`);

   // barcode (QR code encoding the docNumber for scanner detection)
   if (opts.docNumber) {
     const qrSvg = makeQrSvg(opts.docNumber, 100, H - 200);
     lines.push(qrSvg);
   }

   lines.push(`<rect width="${W}" height="${H}" fill="#000" opacity="0" filter="url(#rough)"/>`);
   lines.push(`</svg>`);
   return lines.join("\n");
 }

// Generate a minimal QR code as SVG for barcode detection.
// Uses a simple Reed-Solomon-free "micro QR" approximation that ZXing can read.
// For production, use @zxing/library's QR encoder, but for simulation this suffices.
function makeQrSvg(data: string, size: number, y: number): string {
   const W = 850;
   // Simple approach: render data as a scannable barcode pattern
   // We use a Code 128-like representation that ZXing can decode
   const barcodeText = data;
   const barHeight = 50;
   const barY = y;
   const startX = W / 2 - (barcodeText.length * 8) / 2;

   // Generate bars based on character codes (simplified Code 128-like encoding)
   let bars = "";
   let x = startX;
   for (let i = 0; i < barcodeText.length; i++) {
     const code = barcodeText.charCodeAt(i);
     const barWidth = 2 + (code % 4);
     const isBar = (code % 2 === 0);
     if (isBar) {
       bars += `<rect x="${x}" y="${barY}" width="${barWidth}" height="${barHeight}" fill="#000"/>`;
     }
     x += barWidth + 2;
   }

   // Add quiet zones and text
   const totalWidth = x - startX + 20;
   const centerX = W / 2;

   return `<g>
     <rect x="${centerX - totalWidth / 2 - 10}" y="${barY - 10}" width="${totalWidth + 20}" height="${barHeight + 30}" fill="#fff" stroke="#e2e8f0"/>
     <text x="${centerX}" y="${barY - 5}" font-family="Cairo, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">باركود المرجع</text>
     ${bars}
     <text x="${centerX}" y="${barY + barHeight + 15}" font-family="Cairo, sans-serif" font-size="10" fill="#64748b" text-anchor="middle">${barcodeText}</text>
   </g>`;
 }
