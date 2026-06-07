import { db, collection, getDocs, query, where, limit }
      from './firebase-client.js';

    async function loadFeaturedProducts() {
      const track = document.getElementById('productsTrack');
      try {
        // Завантажуємо 12 товарів (featured або просто перші)
        let snap = await getDocs(query(
          collection(db, 'products'),
          where('featured', '==', true),
          limit(12)
        ));
        // Якщо featured немає — беремо перші 12
        if (snap.empty) {
          snap = await getDocs(query(collection(db, 'products'), limit(12)));
        }
        if (snap.empty) {
          track.innerHTML = '<p style="color:rgba(255,255,255,.3);padding:40px;font-family:Jost,sans-serif;">Товари завантажуються...</p>';
          return;
        }
        track.innerHTML = snap.docs.map(d => {
          const p = d.data();
          const img = p.images?.[0] || 'images/hero.jpg';
          const name = p.name || '';
          const brand = p.brand || '';
          const shortName = name.replace(brand, '').replace('–', '').trim().slice(0, 30) || name.slice(0, 30);
          return `
            <div class="p-card" data-price="${p.price}" data-name="${name}" data-img="${img}" onclick="location.href='/product.html?id=${d.id}'">
              <div class="p-card-img cur-view"><img src="${img}" alt="${name}" loading="lazy" onerror="this.src='images/hero.jpg'"/></div>
              <div class="p-card-body">
                ${brand ? `<span class="p-brand">${brand}</span>` : ''}
                <h3>${shortName}</h3>
                <span class="p-price">${p.price ? p.price.toLocaleString('uk-UA') + ' ₴' : ''}</span>
                <button class="btn btn-pink btn-sm mag add-to-cart" data-id="${d.id}" data-name="${name}" data-price="${p.price}" data-img="${img}">В кошик</button>
              </div>
            </div>`;
        }).join('');

        // Підключаємо кнопки кошика
        track.querySelectorAll('.add-to-cart').forEach(btn => {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            if (typeof addToCart === 'function') {
              addToCart({ id: btn.dataset.id, name: btn.dataset.name, price: Number(btn.dataset.price), img: btn.dataset.img });
            }
          });
        });

      } catch (err) {
        track.innerHTML = '<p style="color:rgba(255,255,255,.3);padding:40px;font-family:Jost,sans-serif;">Не вдалось завантажити товари</p>';
        console.error(err);
      }
    }

    // Фото категорій з Unsplash
    const CAT_IMAGES = {
      face:     'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80',
      perfumes: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80',
      body:     'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&q=80',
      hair:     'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
      men:      'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80',
    };
    const catOrder = ['face','perfumes','body','hair','men'];
    document.querySelectorAll('.cat-card').forEach((card, i) => {
      const bg = card.querySelector('.cat-bg');
      if (!bg) return;
      const img = CAT_IMAGES[catOrder[i]];
      if (img) {
        bg.style.cssText += `background-image:url('${img}');background-size:cover;background-position:center;`;
      }
    });

    loadFeaturedProducts().then(() => {
      // Стрілки каруселі
      const track = document.getElementById('productsTrack');
      const prev  = document.getElementById('carouselPrev');
      const next  = document.getElementById('carouselNext');
      const scrollBy = 320;

      prev?.addEventListener('click', () => track.scrollBy({ left: -scrollBy, behavior: 'smooth' }));
      next?.addEventListener('click', () => track.scrollBy({ left:  scrollBy, behavior: 'smooth' }));
    });
  