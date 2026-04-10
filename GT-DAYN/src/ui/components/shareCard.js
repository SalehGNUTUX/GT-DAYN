/**
 * GT-DAYN — shareCard.js
 * رسم بطاقة مشاركة أنيقة على Canvas 2D API (بدون html2canvas)
 * تُعيد Blob جاهزة للتنزيل أو المشاركة
 */

const W = 900, H = 520;

const THEMES = {
  receivable: {
    bg1: '#1e1b4b', bg2: '#312e81',
    accent: '#818cf8', accentLt: '#c7d2fe',
    label: 'لي',
  },
  payable: {
    bg1: '#064e3b', bg2: '#065f46',
    accent: '#34d399', accentLt: '#a7f3d0',
    label: 'عليّ',
  },
};

/**
 * @param {Object} debt  - سجل الدين من DebtService
 * @param {string} personName
 * @param {string} currency - e.g. 'ر.س'
 * @returns {Promise<Blob>}
 */
export async function generateShareCard(debt, personName, currency = 'ر.س') {
  const canvas  = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx     = canvas.getContext('2d');

  const theme = THEMES[debt.type] ?? THEMES.receivable;
  const pct   = Math.min(100, Math.round(((debt.amount - debt.remaining) / debt.amount) * 100));
  const paid  = debt.amount - debt.remaining;

  // ── خلفية ─────────────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme.bg1);
  grad.addColorStop(1, theme.bg2);
  ctx.fillStyle = grad;
  _roundRect(ctx, 0, 0, W, H, 32);
  ctx.fill();

  // ── دوائر زخرفية ──────────────────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(W - 80, 60, 160, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W - 30, 160, 90, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ── شعار GT-DAYN ───────────────────────────────────────────────────────────
  await _loadFont(ctx);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.font      = 'bold 22px Cairo, sans-serif';
  ctx.textAlign = 'right';
  ctx.direction = 'rtl';
  ctx.fillText('GT-DAYN', W - 50, 58);

  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.font      = '16px Cairo, sans-serif';
  ctx.fillText(theme.label, W - 50, 82);

  // ── أفاتار + اسم ──────────────────────────────────────────────────────────
  const av = personName.trim().charAt(0);
  ctx.fillStyle = theme.accent + '33'; // شفاف
  _roundRect(ctx, 50, 40, 72, 72, 18);
  ctx.fill();
  ctx.fillStyle = theme.accentLt;
  ctx.font      = 'bold 32px Cairo, sans-serif';
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  ctx.fillText(av, 86, 87);

  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 38px Cairo, sans-serif';
  ctx.textAlign = 'right';
  ctx.direction = 'rtl';
  ctx.fillText(personName, W - 50, 115);

  if (debt.title) {
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font      = '18px Cairo, sans-serif';
    ctx.fillText(debt.title, W - 50, 143);
  }

  // ── حلقة النسبة (Arc) ─────────────────────────────────────────────────────
  const cx = 160, cy = 310, r = 100, lw = 14;
  const startAngle = -Math.PI * 0.75;
  const endAngle   = Math.PI * 0.25;
  const fillAngle  = startAngle + (endAngle - startAngle + Math.PI * 1.5) * (pct / 100);

  // خلفية الحلقة
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth   = lw;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle + Math.PI * 1.5);
  ctx.stroke();

  // الجزء المكتمل
  const arcGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  arcGrad.addColorStop(0, theme.accent);
  arcGrad.addColorStop(1, theme.accentLt);
  ctx.strokeStyle = arcGrad;
  ctx.lineWidth   = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, fillAngle);
  ctx.stroke();

  // النسبة بالداخل
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 52px Cairo, sans-serif';
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  ctx.fillText(`${pct}%`, cx, cy + 14);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font      = '18px Cairo, sans-serif';
  ctx.fillText('مسدّد', cx, cy + 40);

  // ── خلايا الأرقام ─────────────────────────────────────────────────────────
  const cells = [
    { label: 'المبلغ الكلي', value: _fmt(debt.amount), color: '#ffffff', x: 330 },
    { label: 'المدفوع',      value: _fmt(paid),         color: theme.accentLt, x: 530 },
    { label: 'المتبقي',      value: _fmt(debt.remaining), color: pct===100 ? '#6ee7b7' : '#fca5a5', x: 730 },
  ];

  cells.forEach(c => {
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    _roundRect(ctx, c.x - 80, 230, 160, 80, 14);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font      = '15px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.direction = 'ltr';
    ctx.fillText(c.label, c.x, 270);

    ctx.fillStyle = c.color;
    ctx.font      = 'bold 26px Cairo, sans-serif';
    ctx.fillText(`${c.value} ${currency}`, c.x, 298);
  });

  // ── شريط تقدم سفلي ────────────────────────────────────────────────────────
  const barX = 50, barY = 380, barW = W - 100, barH = 8;
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  _roundRect(ctx, barX, barY, barW, barH, 4);
  ctx.fill();
  const fillW = (barW * pct) / 100;
  const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  barGrad.addColorStop(0, theme.accent);
  barGrad.addColorStop(1, theme.accentLt);
  ctx.fillStyle = barGrad;
  _roundRect(ctx, barX, barY, fillW, barH, 4);
  ctx.fill();

  // ── التاريخ + التوقيع ─────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('ar-u-nu-latn', { year:'numeric', month:'long', day:'numeric' });
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.font      = '15px Cairo, sans-serif';
  ctx.textAlign = 'right';
  ctx.direction = 'rtl';
  ctx.fillText(today, W - 50, 430);

  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.font      = '14px Cairo, sans-serif';
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  ctx.fillText('GT-DAYN • سجل الديون الذكي', W / 2, 480);

  return new Promise(res => canvas.toBlob(res, 'image/png'));
}

// ── helpers ───────────────────────────────────────────────────────────────────

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function _fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

// تحميل خط Cairo (تستغرق أول مرة فقط)
let _fontLoaded = false;
async function _loadFont(ctx) {
  if (_fontLoaded) return;
  try {
    await document.fonts.load('bold 32px Cairo');
    _fontLoaded = true;
  } catch { /* يتابع بخط النظام */ }
}

/**
 * تنزيل الصورة مباشرة (Web)
 */
export async function downloadShareCard(debt, personName, currency) {
  const blob = await generateShareCard(debt, personName, currency);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${personName}_${new Date().toISOString().slice(0,10)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/**
 * مشاركة عبر Web Share API (موبايل)
 */
export async function shareCard(debt, personName, currency) {
  const blob = await generateShareCard(debt, personName, currency);
  const file = new File([blob], `GT-DAYN-${personName}.png`, { type: 'image/png' });

  // محاولة Web Share API مع ملف (Android Chrome 76+)
  if (navigator.share) {
    try {
      // جرّب مشاركة مع ملف أولاً
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `GT-DAYN — ${personName}` });
        return;
      }
    } catch(e) {
      if (e.name === 'AbortError') return;  // المستخدم أغلق
      // fallthrough إلى المشاركة بدون ملف
    }
    // مشاركة بدون ملف (رابط blob)
    try {
      const url = URL.createObjectURL(blob);
      await navigator.share({ url, title: `GT-DAYN — ${personName}` });
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return;
    } catch(e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Fallback: تنزيل مباشر
  downloadShareCard(debt, personName, currency);
}
