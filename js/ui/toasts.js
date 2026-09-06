// Soft notifications: small toasts (top-center stack) and the big
// NEW DISCOVERY banner.

export function buildToasts(root) {
  const wrap = el('div', 'toasts');
  wrap.id = 'toasts';
  root.append(wrap);
  const banner = el('div', 'banner');
  banner.id = 'banner';
  root.append(banner);
}

export function toast(text, color) {
  const wrap = document.getElementById('toasts');
  if (!wrap) return;
  const t = el('div', 'toast');
  if (color) t.style.borderColor = color;
  t.textContent = text;
  wrap.append(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 400);
  }, 2600);
  while (wrap.children.length > 3) wrap.firstChild.remove();
}

export function banner(title, sub, color = '#ffd98a') {
  const b = document.getElementById('banner');
  if (!b) return;
  b.style.setProperty('--banner-color', color);
  b.querySelector('.banner-title').textContent = title;
  b.querySelector('.banner-sub').textContent = sub;
  b.classList.remove('show');
  // reflow so the animation restarts
  void b.offsetWidth;
  b.classList.add('show');
  clearTimeout(banner._t);
  banner._t = setTimeout(() => b.classList.remove('show'), 3600);
}

function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}
