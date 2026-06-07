import { db, getDoc, doc, collection, getDocs, query, where, limit }
      from './js/firebase-client.js';
    import { CATEGORY_LABELS } from './js/constants.js';

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
      document.getElementById('productContent').innerHTML =
        '<div style="text-align:center;padding:100px 20px;color:rgba(255,255,255,.4);font-family:Jost,sans-serif;">Товар не знайдено</div>';
    } else {
      loadProduct(id);
    }

    /* ── LOAD PRODUCT ── */
    async function loadProduct(id) {
      try {
        const snap = await getDoc(doc(db, 'products', id));
        if (!snap.exists()) throw new Error('Товар не знайдено');
        const p = { id: snap.id, ...snap.data() };
        document.title = `${p.name} — Beauty Black Room`;
        renderProduct(p);
        loadRelated(p);
      } catch (err) {
        document.getElementById('productContent').innerHTML =
          `<div style="text-align:center;padding:100px 20px;color:rgba(255,255,255,.4);font-family:Jost,sans-serif;">${err.message}</div>`;
      }
    }

    /* ── PRICE HELPER ── */
    function formatPrice(price) {
      if (!price || price <= 0) return '<span class="no-price">Уточнюйте ціну</span>';
      return `${Number(price).toLocaleString('uk-UA')} <span>₴</span>`;
    }
    function priceText(price) {
      if (!price || price <= 0) return 'Уточнюйте ціну';
      return Number(price).toLocaleString('uk-UA') + ' ₴';
    }

    /* ── RENDER PRODUCT ── */
    function renderProduct(p) {
      const images = p.images?.length ? p.images : ['images/hero.jpg'];
      const cat = CATEGORY_LABELS[p.category] || p.category || '';
      const reviews = loadReviews(p.id);
      const avgRating = reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : 0;

      document.getElementById('productContent').innerHTML = `
        <div class="product-breadcrumb">
          <a href="/products.html">← Каталог</a>
          ${p.category ? ` / <a href="/products.html?category=${p.category}">${cat}</a>` : ''}
          / ${p.name}
        </div>
        <div class="product-layout">
          <div class="product-gallery">
            <div class="product-main-img">
              <img id="mainImg" src="${images[0]}" alt="${p.name}" />
            </div>
            ${images.length > 1 ? `<div class="product-thumbs">
              ${images.map((img,i) => `<div class="product-thumb ${i===0?'active':''}" data-img="${img}">
                <img src="${img}" alt="${p.name} ${i+1}" loading="lazy"/>
              </div>`).join('')}
            </div>` : ''}
          </div>
          <div class="product-info">
            ${p.brand ? `<div class="product-brand">Бренд: <span>${p.brand}</span></div>` : ''}
            <div class="product-category">${cat}</div>
            <h1 class="product-name">${p.name}</h1>
            ${reviews.length ? `<div class="stars" style="margin-top:-8px">${starsHTML(avgRating)}<span style="font-family:'Jost',sans-serif;font-size:.75rem;color:rgba(255,255,255,.3);margin-left:8px;">${avgRating} (${reviews.length})</span></div>` : ''}
            <div class="product-divider"></div>
            ${(() => {
              // Парфум з об'ємами — показуємо ціну першого вибраного
              if (p.category === 'perfumes' && p.volumes && p.volumes.length > 0) {
                const volBtns = p.volumes.map((v, i) => `
                  <button class="vol-btn${i===0?' active':''}" data-price="${v.price}" data-label="${v.label}">
                    <span>${v.label}</span>
                    <span class="vol-price">${v.price.toLocaleString('uk-UA')} ₴</span>
                  </button>`).join('');
                return `
                  <div class="product-price" id="productPrice">${p.volumes[0].price.toLocaleString('uk-UA')} <span>₴</span></div>
                  <div style="margin-top:-8px;">
                    <div class="volume-label">Оберіть об'єм</div>
                    <div class="volume-options" id="volumeOptions">${volBtns}</div>
                  </div>`;
              }
              // Звичайний товар
              return `<div class="product-price ${!p.price || p.price<=0 ? 'no-price' : ''}" id="productPrice">${formatPrice(p.price)}</div>`;
            })()}
            <div class="product-stock">
              <div class="stock-dot ${p.inStock!==false?'in':'out'}"></div>
              <span style="color:rgba(255,255,255,.5);font-family:'Jost',sans-serif;font-size:.8rem;letter-spacing:1px;">
                ${p.inStock!==false ? 'В наявності' : 'Немає в наявності'}
              </span>
            </div>
            ${p.description ? `<div class="product-desc">${p.description}</div>` : ''}
            <div class="product-actions">
              <button class="btn-cart-big" id="addToCartBtn">+ Додати до кошика</button>
              <a href="tel:+380995566006" class="btn-call">📞 Подзвонити</a>
            </div>
          </div>
        </div>`;

      /* Thumbs */
      document.querySelectorAll('.product-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          document.querySelectorAll('.product-thumb').forEach(t=>t.classList.remove('active'));
          thumb.classList.add('active');
          document.getElementById('mainImg').src = thumb.dataset.img;
        });
      });

      /* Volume selector */
      let selectedPrice = p.price || 0;
      let selectedLabel = '';
      const volOptions = document.getElementById('volumeOptions');
      if (volOptions) {
        // Init from first active button
        const firstBtn = volOptions.querySelector('.vol-btn.active');
        if (firstBtn) {
          selectedPrice = +firstBtn.dataset.price;
          selectedLabel = firstBtn.dataset.label;
        }
        volOptions.addEventListener('click', e => {
          const btn = e.target.closest('.vol-btn');
          if (!btn) return;
          volOptions.querySelectorAll('.vol-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedPrice = +btn.dataset.price;
          selectedLabel = btn.dataset.label;
          const priceEl = document.getElementById('productPrice');
          if (priceEl) priceEl.innerHTML = `${selectedPrice.toLocaleString('uk-UA')} <span>₴</span>`;
        });
      }

      /* Cart */
      document.getElementById('addToCartBtn').addEventListener('click', () => {
        if (typeof addToCart === 'function') {
          const label = selectedLabel ? ` (${selectedLabel})` : '';
          addToCart({ id: p.id, name: p.name + label, price: selectedPrice, img: images[0] });
        }
      });

      /* Reviews section */
      renderReviewsSection(p.id);
    }

    /* ── RELATED PRODUCTS ── */
    async function loadRelated(p) {
      if (!p.category) return;
      try {
        const q = query(collection(db,'products'), where('category','==',p.category), limit(8));
        const snap = await getDocs(q);
        const related = snap.docs
          .map(d=>({id:d.id,...d.data()}))
          .filter(r=>r.id!==p.id)
          .slice(0,4);
        if (!related.length) return;

        document.getElementById('relatedSection').innerHTML = `
          <div class="product-section-title">Супутні товари <span>(${related.length})</span></div>
          <div class="related-grid">
            ${related.map(r=>{
              const img = r.images?.[0]||'images/hero.jpg';
              const hasPrice = r.price && r.price > 0;
              return `<div class="related-card" onclick="location.href='/product.html?id=${r.id}'">
                <div class="related-card-img"><img src="${img}" alt="${r.name}" loading="lazy"/></div>
                <div class="related-card-body">
                  <div class="related-card-name">${r.name}</div>
                  <div class="related-card-price ${hasPrice?'':'no-price'}">${hasPrice?Number(r.price).toLocaleString('uk-UA')+' ₴':'Уточнюйте ціну'}</div>
                </div>
              </div>`;
            }).join('')}
          </div>`;
      } catch(e) { /* silent */ }
    }

    /* ── REVIEWS (localStorage) ── */
    function loadReviews(pid) {
      try { return JSON.parse(localStorage.getItem('reviews_'+pid)||'[]'); } catch{ return []; }
    }
    function saveReviews(pid, reviews) {
      localStorage.setItem('reviews_'+pid, JSON.stringify(reviews));
    }

    function starsHTML(rating, clickable=false) {
      return [1,2,3,4,5].map(i=>`<span class="star${i<=Math.round(rating)?' filled':''}${clickable?' clickable':''}" data-val="${i}">★</span>`).join('');
    }

    function renderReviewsSection(pid) {
      const reviews = loadReviews(pid);
      const avg = reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length) : 0;
      const counts = [5,4,3,2,1].map(s=>reviews.filter(r=>r.rating===s).length);

      document.getElementById('reviewsSection').innerHTML = `
        <div class="product-section-title">Відгуки <span>(${reviews.length})</span></div>

        <div class="reviews-summary">
          <div class="reviews-score">
            <div class="reviews-score-num">${reviews.length ? avg.toFixed(1) : '0.0'}</div>
            <div class="stars" style="justify-content:center;margin:6px 0">${starsHTML(avg)}</div>
            <div class="reviews-score-label">На основі ${reviews.length} відгуків</div>
          </div>
          <div class="reviews-bars">
            ${[5,4,3,2,1].map((s,i)=>{
              const cnt = counts[i];
              const pct = reviews.length ? Math.round(cnt/reviews.length*100) : 0;
              return `<div class="reviews-bar-row">
                <span style="width:12px">${s}</span>
                <div class="reviews-bar-track"><div class="reviews-bar-fill" style="width:${pct}%"></div></div>
                <span style="width:28px;text-align:right">${pct}%</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="reviews-list" id="reviewsList">
          ${reviews.length ? reviews.slice().reverse().map(r=>`
            <div class="review-item">
              <div class="review-header">
                <div class="stars">${starsHTML(r.rating)}</div>
                <div class="review-author">${r.name}</div>
                <div class="review-date">${r.date}</div>
              </div>
              <div class="review-text">${r.text}</div>
            </div>`).join('') : '<div class="reviews-empty">Поки що відгуків немає. Будьте першим!</div>'}
        </div>

        <div class="review-form">
          <div class="review-form-title">Залишити відгук</div>
          <div class="review-form-stars" id="ratingStars">${starsHTML(0, true)}</div>
          <input type="hidden" id="ratingVal" value="0">
          <div class="review-form-row">
            <div class="review-field"><label>Ім'я *</label><input type="text" id="rName" placeholder="Ваше ім'я"></div>
            <div class="review-field"><label>Email</label><input type="email" id="rEmail" placeholder="email@example.com"></div>
          </div>
          <div class="review-field"><label>Відгук *</label><textarea id="rText" placeholder="Ваш відгук про товар..."></textarea></div>
          <button class="review-submit" id="reviewSubmit">Надіслати відгук</button>
          <div id="reviewMsg" style="margin-top:12px;font-family:'Jost',sans-serif;font-size:.82rem;color:#4fff9d;display:none;">✓ Дякуємо за відгук!</div>
        </div>`;

      /* Star click */
      let selectedRating = 0;
      document.querySelectorAll('#ratingStars .star').forEach(star => {
        star.addEventListener('mouseenter', ()=>{
          document.querySelectorAll('#ratingStars .star').forEach(s=>s.classList.toggle('filled', +s.dataset.val<=+star.dataset.val));
        });
        star.addEventListener('mouseleave', ()=>{
          document.querySelectorAll('#ratingStars .star').forEach(s=>s.classList.toggle('filled', +s.dataset.val<=selectedRating));
        });
        star.addEventListener('click', ()=>{
          selectedRating = +star.dataset.val;
          document.getElementById('ratingVal').value = selectedRating;
        });
      });

      /* Submit */
      document.getElementById('reviewSubmit').addEventListener('click', ()=>{
        const name = document.getElementById('rName').value.trim();
        const text = document.getElementById('rText').value.trim();
        const rating = +document.getElementById('ratingVal').value;
        if (!name || !text || !rating) { alert('Заповніть ім\'я, оцінку та відгук'); return; }

        const reviews = loadReviews(pid);
        reviews.push({
          name, text, rating,
          date: new Date().toLocaleDateString('uk-UA')
        });
        saveReviews(pid, reviews);
        document.getElementById('reviewMsg').style.display = 'block';
        document.getElementById('reviewSubmit').disabled = true;
        setTimeout(()=>renderReviewsSection(pid), 1200);
      });
    }
  