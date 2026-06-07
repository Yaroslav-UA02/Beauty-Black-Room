import { db, collection, getDocs, query, where, limit }
      from './firebase-client.js';
    import { CATEGORY_LABELS } from './constants.js';

    let allProducts = [];
    let activeCategory = new URLSearchParams(window.location.search).get('category') || '';
    let searchTerm = '';
    let sortMode = '';
    let priceMin = 0;
    let priceMax = 99999;
    let inStockOnly = false;
    let viewMode = 'grid';

    /* ── LOAD ── */
    async function loadProducts() {
      document.getElementById('catalogContent').innerHTML =
        '<div class="catalog-loading"><div class="spinner"></div><p>Завантаження товарів...</p></div>';
      try {
        let q = activeCategory
          ? query(collection(db, 'products'), where('category', '==', activeCategory), limit(200))
          : query(collection(db, 'products'), limit(100));
        const snap = await getDocs(q);
        allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        /* Set slider max from actual data */
        const maxP = Math.max(...allProducts.map(p => p.price || 0), 1000);
        const roundedMax = Math.ceil(maxP / 1000) * 1000;
        ['priceMin', 'priceMax'].forEach(id => document.getElementById(id).max = roundedMax);
        document.getElementById('priceMax').value = roundedMax;
        priceMax = roundedMax;
        document.getElementById('priceMaxLabel').textContent = roundedMax.toLocaleString('uk-UA') + ' ₴';
        updateSliderFill();

        renderProducts();
      } catch (err) {
        document.getElementById('catalogContent').innerHTML =
          `<div class="catalog-empty">Помилка: ${err.message}</div>`;
      }
    }

    /* ── SORT ── */
    function getSorted(arr) {
      const r = [...arr];
      if (sortMode === 'price-asc')  r.sort((a, b) => (a.price||0) - (b.price||0));
      if (sortMode === 'price-desc') r.sort((a, b) => (b.price||0) - (a.price||0));
      if (sortMode === 'name-asc')   r.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
      if (sortMode === 'name-desc')  r.sort((a, b) => b.name.localeCompare(a.name, 'uk'));
      return r;
    }

    /* ── RENDER ── */
    function renderProducts() {
      let filtered = allProducts;
      if (activeCategory) filtered = filtered.filter(p => p.category === activeCategory);
      if (searchTerm)     filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        (p.description || '').toLowerCase().includes(searchTerm));
      filtered = filtered.filter(p => (p.price || 0) >= priceMin && (p.price || 0) <= priceMax);
      if (inStockOnly)    filtered = filtered.filter(p => p.inStock);
      filtered = getSorted(filtered);

      document.getElementById('productCount').textContent =
        filtered.length + ' ' + plural(filtered.length, 'товар', 'товари', 'товарів');

      if (!filtered.length) {
        document.getElementById('catalogContent').innerHTML =
          '<div class="catalog-empty">Товарів не знайдено</div>';
        return;
      }

      document.getElementById('catalogContent').innerHTML =
        `<div class="catalog-grid${viewMode === 'list' ? ' list-view' : ''}">${filtered.map(cardHTML).join('')}</div>`;

      document.querySelectorAll('.btn-add-cart').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const { id, name, price, img } = btn.dataset;
          if (typeof addToCart === 'function') addToCart({ id, name, price: Number(price), img });
        });
      });
      document.querySelectorAll('.catalog-card').forEach(card => {
        card.addEventListener('click', () => { window.location.href = `/product.html?id=${card.dataset.id}`; });
      });
    }

    function plural(n, one, few, many) {
      const mod10 = n % 10, mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return n + ' ' + one;
      if ([2,3,4].includes(mod10) && ![12,13,14].includes(mod100)) return n + ' ' + few;
      return n + ' ' + many;
    }

    function cardHTML(p) {
      const img = p.images?.[0] || 'images/hero.jpg';
      const cat = CATEGORY_LABELS[p.category] || p.category || '';

      // Ціна: діапазон для парфумів, звичайна для решти
      let priceHTML;
      if (p.priceMin && p.priceMax && p.priceMax > p.priceMin) {
        priceHTML = `від ${p.priceMin.toLocaleString('uk-UA')} <span>₴</span>`;
      } else {
        const price = (p.price || 0).toLocaleString('uk-UA');
        priceHTML = `${price} <span>₴</span>`;
      }

      // Короткий опис (обрізаємо до 90 символів)
      const desc = p.description ? p.description.slice(0, 90) + (p.description.length > 90 ? '…' : '') : '';

      return `
        <div class="catalog-card" data-id="${p.id}">
          <div class="catalog-card-img">
            <img src="${img}" alt="${p.name}" loading="lazy"/>
            ${p.featured ? '<span class="catalog-card-badge">Хіт</span>' : ''}
          </div>
          <div class="catalog-card-body">
            <div class="catalog-card-cat">${cat}</div>
            <div class="catalog-card-name">${p.name}</div>
            <div class="catalog-card-desc">${desc}</div>
            <div class="catalog-card-footer">
              <div class="catalog-card-price">${priceHTML}</div>
              <button class="btn-add-cart" data-id="${p.id}" data-name="${p.name}" data-price="${p.price||0}" data-img="${img}">+ Кошик</button>
            </div>
          </div>
        </div>`;
    }

    /* ── PRICE SLIDER ── */
    function updateSliderFill() {
      const maxVal = +document.getElementById('priceMax').max || 20000;
      const pct1 = (+document.getElementById('priceMin').value / maxVal) * 100;
      const pct2 = (+document.getElementById('priceMax').value / maxVal) * 100;
      document.getElementById('priceRangeFill').style.left = pct1 + '%';
      document.getElementById('priceRangeFill').style.width = Math.max(0, pct2 - pct1) + '%';
    }

    document.getElementById('priceMin').addEventListener('input', function() {
      if (+this.value > +document.getElementById('priceMax').value)
        this.value = document.getElementById('priceMax').value;
      priceMin = +this.value;
      document.getElementById('priceMinLabel').textContent = priceMin.toLocaleString('uk-UA') + ' ₴';
      updateSliderFill();
      renderProducts();
    });
    document.getElementById('priceMax').addEventListener('input', function() {
      if (+this.value < +document.getElementById('priceMin').value)
        this.value = document.getElementById('priceMin').value;
      priceMax = +this.value;
      document.getElementById('priceMaxLabel').textContent = priceMax.toLocaleString('uk-UA') + ' ₴';
      updateSliderFill();
      renderProducts();
    });
    updateSliderFill();

    /* ── IN STOCK ── */
    document.getElementById('inStockOnly').addEventListener('change', function() {
      inStockOnly = this.checked;
      renderProducts();
    });

    /* ── RESET ── */
    document.getElementById('resetFilters').addEventListener('click', () => {
      priceMin = 0;
      priceMax = +document.getElementById('priceMax').max;
      document.getElementById('priceMin').value = 0;
      document.getElementById('priceMax').value = priceMax;
      document.getElementById('priceMinLabel').textContent = '0 ₴';
      document.getElementById('priceMaxLabel').textContent = priceMax.toLocaleString('uk-UA') + ' ₴';
      document.getElementById('inStockOnly').checked = false;
      inStockOnly = false;
      updateSliderFill();
      renderProducts();
    });

    /* ── SORT ── */
    document.getElementById('sortSelect').addEventListener('change', function() {
      sortMode = this.value;
      renderProducts();
    });

    /* ── VIEW TOGGLE ── */
    document.getElementById('viewGrid').addEventListener('click', () => {
      viewMode = 'grid';
      document.getElementById('viewGrid').classList.add('active');
      document.getElementById('viewList').classList.remove('active');
      renderProducts();
    });
    document.getElementById('viewList').addEventListener('click', () => {
      viewMode = 'list';
      document.getElementById('viewList').classList.add('active');
      document.getElementById('viewGrid').classList.remove('active');
      renderProducts();
    });

    /* ── FILTER PANEL TOGGLE ── */
    document.getElementById('toggleFilters').addEventListener('click', () => {
      const sidebar = document.getElementById('catalogSidebar');
      const btn = document.getElementById('toggleFilters');
      sidebar.classList.toggle('open');
      btn.classList.toggle('active');
    });

    /* ── CATEGORY BUTTONS ── */
    document.getElementById('filterBtns').addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      loadProducts();
    });

    /* ── SEARCH ── */
    document.getElementById('searchInput').addEventListener('input', e => {
      searchTerm = e.target.value.toLowerCase().trim();
      renderProducts();
    });

    /* ── INIT ── */
    document.querySelectorAll('.filter-btn').forEach(btn => {
      if (btn.dataset.cat === activeCategory) btn.classList.add('active');
    });
    if (!activeCategory) document.querySelector('.filter-btn[data-cat=""]').classList.add('active');

    loadProducts();
  