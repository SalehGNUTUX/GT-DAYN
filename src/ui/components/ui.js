/**
 * GT-DAYN — ui.js
 * أدوات الواجهة المشتركة: toast، modal، confirm، format
 */

// ── Toast ──────────────────────────────────────────────────────────────────

export function toast(msg, type = 'info', duration = 2800) {
  let cont = document.getElementById('toast-container');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'toast-container';
    Object.assign(cont.style, {
      position: 'fixed', top: '20px', left: '50%',
      transform: 'translateX(-50%)', zIndex: '9000',
      display: 'flex', flexDirection: 'column', gap: '8px',
      alignItems: 'center', pointerEvents: 'none',
      width: 'max-content', maxWidth: '92vw'
    });
    document.body.appendChild(cont);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  cont.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; el.style.transition = '.2s'; setTimeout(() => el.remove(), 220); }, duration);
}

/** رسالة تراجع عن الحذف — تعيد Promise<boolean> true = تراجع، false = تأكيد */
export function toastUndo(msg, duration = 5000) {
  return new Promise(resolve => {
    let cont = document.getElementById('toast-container');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'toast-container';
      const hh = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 68;
      Object.assign(cont.style, {
        position: 'fixed', top: (hh + 10) + 'px', left: '50%',
        transform: 'translateX(-50%)', zIndex: '9500',
        display: 'flex', flexDirection: 'column', gap: '8px',
        alignItems: 'center', pointerEvents: 'none',
        width: 'max-content', maxWidth: '92vw'
      });
      document.body.appendChild(cont);
    }
    const el = document.createElement('div');
    el.className = 'toast error';
    el.style.cssText = 'pointer-events:auto;white-space:nowrap;display:flex;align-items:center;gap:10px;';
    el.innerHTML = `<span>${msg}</span><button class="toast-undo-btn" style="background:rgba(255,255,255,.2);border:1px solid currentColor;border-radius:20px;padding:3px 12px;font-family:Cairo,sans-serif;font-size:.78rem;font-weight:800;color:inherit;cursor:pointer;pointer-events:auto;">تراجع</button>`;
    cont.appendChild(el);

    let resolved = false;
    const finish = (undid) => {
      if (resolved) return;
      resolved = true;
      el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; el.style.transition = '.2s';
      setTimeout(() => el.remove(), 220);
      resolve(undid);
    };

    el.querySelector('.toast-undo-btn').addEventListener('click', (e) => { e.stopPropagation(); finish(true); });
    setTimeout(() => finish(false), duration);
  });
}

// ── Modal helpers ──────────────────────────────────────────────────────────

export function openModal(id)  { document.getElementById(id)?.classList.add('active'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

export function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active')
    .forEach(m => m.classList.remove('active'));
}

/** نافذة تأكيد بسيطة */
export function confirm(msg) {
  return new Promise(res => {
    const ov = document.getElementById('confirm-modal-overlay');
    document.getElementById('confirm-msg').textContent = msg;
    ov.classList.add('active');
    const ok  = document.getElementById('confirm-ok');
    const cxl = document.getElementById('confirm-cancel');
    const cleanup = (val) => { ov.classList.remove('active'); ok.onclick = null; cxl.onclick = null; res(val); };
    ok.onclick  = () => cleanup(true);
    cxl.onclick = () => cleanup(false);
  });
}

// ── Format ─────────────────────────────────────────────────────────────────

export function fmt(n, currency = '') {
  const s = Math.round(n).toLocaleString('en-US');
  return currency ? `${s} ${currency}` : s;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('ar-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function initial(name) {
  return (name ?? '').trim().charAt(0).toUpperCase();
}

/** لون أفاتار حسب الاسم */
const AV_COLORS = [
  ['#ede9fe','#4338ca'], ['#d1fae5','#065f46'], ['#fef3c7','#92400e'],
  ['#fee2e2','#991b1b'], ['#e0f2fe','#0369a1'], ['#fce7f3','#9d174d'],
];
export function avatarColor(name) {
  const i = (name ?? '').charCodeAt(0) % AV_COLORS.length;
  return AV_COLORS[i];
}

// ── Keyboard / Visual Viewport fix (mobile) ───────────────────────────────

export function initViewportFix(selectors = ['.modal-overlay']) {
  if (!window.visualViewport) return;
  const sync = () => {
    const vh    = window.visualViewport.height;
    const ratio = vh / window.screen.height;
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (ratio < 0.75) {
          el.style.height     = vh + 'px';
          el.style.alignItems = 'center';
          el.style.paddingTop = '0';
        } else {
          el.style.height     = '';
          el.style.alignItems = 'flex-start';
          el.style.paddingTop = '18%';
        }
      });
    });
  };
  window.visualViewport.addEventListener('resize', sync);
  window.visualViewport.addEventListener('scroll', sync);
  sync();
}

// ── Theme ──────────────────────────────────────────────────────────────────

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// ── Drag & Drop sort ──────────────────────────────────────────────────────

export function initDragSort(container, onReorder) {
  let src = null;
  container.querySelectorAll('[draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', e => {
      src = card; card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging', 'drag-over');
      container.querySelectorAll('[draggable]').forEach(c => c.classList.remove('drag-over'));
      const ids = [...container.querySelectorAll('[data-id]')].map(c => +c.dataset.id);
      onReorder(ids);
    });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      if (!src || card === src) return;
      card.classList.add('drag-over');
      const cards  = [...container.querySelectorAll('[draggable="true"]')];
      const si = cards.indexOf(src), di = cards.indexOf(card);
      if (si < di) container.insertBefore(src, card.nextSibling);
      else         container.insertBefore(src, card);
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => e.preventDefault());
  });
}
