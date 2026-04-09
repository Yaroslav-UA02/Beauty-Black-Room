/* ══════════════════════════════════════════
   BEAUTY BLACK ROOM — MAIN (cursor, preloader, burger)
   ══════════════════════════════════════════ */

/* ── PRELOADER ── */
const pre = document.getElementById('pre');
const preFill = document.getElementById('preFill');
const prePct = document.getElementById('prePct');
let pn = 0;
const pT = setInterval(() => {
  pn += Math.floor(Math.random() * 12) + 4;
  if (pn >= 100) { pn = 100; clearInterval(pT); }
  preFill.style.width = pn + '%';
  prePct.textContent = pn + ' %';
  if (pn === 100) setTimeout(() => {
    pre.classList.add('gone');
    document.body.style.overflow = '';
    if (typeof initScrollAnimations === 'function') initScrollAnimations();
  }, 400);
}, 50);
document.body.style.overflow = 'hidden';

/* ── CURSOR ── */
const dot = document.getElementById('cur-dot');
const ring = document.getElementById('cur-ring');
const curLabel = document.getElementById('curLabel');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  dot.style.left = mx + 'px'; dot.style.top = my + 'px';
});
(function raf() {
  rx += (mx - rx) * .12;
  ry += (my - ry) * .12;
  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  requestAnimationFrame(raf);
})();

/* cursor states */
document.querySelectorAll('a, button, .cat-card, .ig-item, .mq-item, .p-card').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('cur-hover'));
  el.addEventListener('mouseleave', () => { document.body.classList.remove('cur-hover'); document.body.classList.remove('cur-view'); curLabel.textContent = ''; });
});
document.querySelectorAll('.cur-view').forEach(el => {
  el.addEventListener('mouseenter', () => { document.body.classList.remove('cur-hover'); document.body.classList.add('cur-view'); curLabel.textContent = 'VIEW'; });
  el.addEventListener('mouseleave', () => { document.body.classList.remove('cur-view'); curLabel.textContent = ''; });
});

/* ── MAGNETIC BUTTONS ── */
document.querySelectorAll('.mag').forEach(b => {
  b.addEventListener('mousemove', e => {
    const r = b.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    b.style.transform = `translate(${x * .22}px,${y * .22}px)`;
  });
  b.addEventListener('mouseleave', () => { b.style.transform = ''; });
});

/* ── HEADER ── */
const hdr = document.getElementById('header');
let lastY = 0;
window.addEventListener('scroll', () => {
  const sy = scrollY;
  hdr.classList.toggle('glow', sy > 50);
  hdr.classList.toggle('shrink', sy > 120);
  lastY = sy;
}, { passive: true });

/* ── BURGER ── */
const burger = document.getElementById('burger');
const mobMenu = document.getElementById('mobMenu');
if (burger) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    mobMenu.classList.toggle('open');
    document.body.style.overflow = mobMenu.classList.contains('open') ? 'hidden' : '';
  });
  mobMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    burger.classList.remove('open');
    mobMenu.classList.remove('open');
    document.body.style.overflow = '';
  }));
}

/* ── 3D TILT (categories) ── */
document.querySelectorAll('.tilt').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const cx = (e.clientX - r.left) / r.width - .5;
    const cy = (e.clientY - r.top) / r.height - .5;
    card.style.transform = `perspective(600px) rotateX(${cy * -12}deg) rotateY(${cx * 12}deg) scale(1.02)`;
  });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; });
});

/* ── PRODUCTS DRAG ── */
const track = document.getElementById('productsTrack');
if (track) {
  let isDown = false, startX, sl;
  track.addEventListener('mousedown', e => { isDown = true; track.style.cursor = 'grabbing'; startX = e.pageX - track.offsetLeft; sl = track.scrollLeft; });
  track.addEventListener('mouseleave', () => { isDown = false; track.style.cursor = 'grab'; });
  track.addEventListener('mouseup', () => { isDown = false; track.style.cursor = 'grab'; });
  track.addEventListener('mousemove', e => { if (!isDown) return; e.preventDefault(); track.scrollLeft = sl - (e.pageX - track.offsetLeft - startX) * 1.5; });
}
