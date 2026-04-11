/* ══════════════════════════════════════════
   BEAUTY BLACK ROOM — CART (localStorage)
   ══════════════════════════════════════════ */
const Cart = {
  items: JSON.parse(localStorage.getItem('bbr-cart') || '[]'),
  save() { localStorage.setItem('bbr-cart', JSON.stringify(this.items)); this.updateUI(); },
  add(p) {
    const ex = this.items.find(i => i.name === p.name);
    if (ex) ex.qty++; else this.items.push({ ...p, qty: 1 });
    this.save(); this.showToast(p.name);
  },
  remove(i) { this.items.splice(i, 1); this.save(); },
  getTotal() { return this.items.reduce((s, i) => s + i.price * i.qty, 0); },
  getCount() { return this.items.reduce((s, i) => s + i.qty, 0); },
  updateUI() {
    const countEl = document.getElementById('cartCount');
    const itemsEl = document.getElementById('cartItems');
    const footerEl = document.getElementById('cartFooter');
    const totalEl = document.getElementById('cartTotal');
    const cnt = this.getCount();
    if (countEl) { countEl.textContent = cnt; countEl.classList.toggle('show', cnt > 0); }
    if (!itemsEl) return;
    if (!this.items.length) {
      itemsEl.innerHTML = '<p class="cart-empty">Кошик порожній</p>';
      if (footerEl) footerEl.style.display = 'none';
    } else {
      itemsEl.innerHTML = this.items.map((it, i) => `
        <div class="cart-item">
          <div class="cart-item-img"><img src="${it.img}" alt="${it.name}"/></div>
          <div class="cart-item-info"><div class="cart-item-name">${it.name}</div><div class="cart-item-price">${it.price} ₴ × ${it.qty}</div></div>
          <button class="cart-item-remove" data-i="${i}">Видалити</button>
        </div>`).join('');
      if (footerEl) footerEl.style.display = 'block';
      if (totalEl) totalEl.textContent = this.getTotal().toLocaleString('uk-UA') + ' ₴';
      itemsEl.querySelectorAll('.cart-item-remove').forEach(b => b.addEventListener('click', () => this.remove(+b.dataset.i)));
    }
  },
  showToast(name) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.innerHTML = `<span style="color:var(--pink);font-weight:500">+</span> ${name} додано`;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
};
Cart.updateUI();

/* Global helper called from inline module scripts */
window.addToCart = p => Cart.add(p);

/* Static .add-to-cart buttons (index.html hardcoded cards, if any) */
document.addEventListener('click', e => {
  const btn = e.target.closest('.add-to-cart');
  if (!btn) return;
  e.preventDefault();
  const c = btn.closest('.p-card');
  if (c) Cart.add({ name: c.dataset.name, price: +c.dataset.price, img: c.dataset.img || '' });
});

const cartToggle = document.getElementById('cartToggle');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const cartClose = document.getElementById('cartClose');
function openCart() { cartSidebar.classList.add('open'); cartOverlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeCart() { cartSidebar.classList.remove('open'); cartOverlay.classList.remove('open'); document.body.style.overflow = ''; }
if (cartToggle) cartToggle.addEventListener('click', openCart);
if (cartClose) cartClose.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);
