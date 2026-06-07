import {
      db, auth, storage,
      collection, getDocs, doc, getDoc, orderBy, query, limit, where,
      signInWithEmailAndPassword, signOut, onAuthStateChanged,
      ref, uploadBytes, getDownloadURL
    } from './js/firebase-client.js';
    import {
      addDoc, updateDoc, deleteDoc, serverTimestamp
    } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
    import { CATEGORY_LABELS } from './js/constants.js';

    let products = [];
    let categories = [];
    let uploadedImages = []; // URLs після завантаження

    // ─── AUTH ────────────────────────────────────────────────
    onAuthStateChanged(auth, user => {
      if (user) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminApp').style.display = 'block';
        loadDashboard();
        loadProducts();
        loadCategories();
      } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminApp').style.display = 'none';
      }
    });

    document.getElementById('loginBtn').addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      const pass  = document.getElementById('loginPassword').value;
      document.getElementById('loginErr').textContent = '';
      try {
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (err) {
        document.getElementById('loginErr').textContent = 'Невірний email або пароль';
      }
    });

    document.getElementById('loginPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('loginBtn').click();
    });

    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

    // ─── NAVIGATION ──────────────────────────────────────────
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
      });
    });

    // ─── DASHBOARD ───────────────────────────────────────────
    async function loadDashboard() {
      try {
        // Рахуємо тільки перші 1000 для швидкості
        const [pSnap, cSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), limit(1000))),
          getDocs(collection(db, 'categories')),
        ]);
        const prods = pSnap.docs.map(d => d.data());
        document.getElementById('statTotal').textContent = pSnap.size + (pSnap.size === 1000 ? '+' : '');
        document.getElementById('statInStock').textContent = prods.filter(p => p.inStock !== false).length;
        document.getElementById('statFeatured').textContent = prods.filter(p => p.featured).length;
        document.getElementById('statCats').textContent = cSnap.size;
      } catch(err) { console.error(err); }
    }

    // ─── PRODUCTS ─────────────────────────────────────────────
    let adminSearchTerm = '';
    let adminCatFilter = '';
    const PAGE_SIZE = 50;

    async function loadProducts() {
      const tbody = document.getElementById('productsTableBody');
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading"><div class="spinner"></div></td></tr>';
      try {
        let q = query(collection(db, 'products'), limit(PAGE_SIZE));
        if (adminCatFilter) q = query(collection(db, 'products'), where('category', '==', adminCatFilter), limit(PAGE_SIZE));
        const snap = await getDocs(q);
        products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderProductsTable();
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Помилка: ${err.message}</td></tr>`;
        console.error(err);
      }
    }

    function renderProductsTable() {
      const tbody = document.getElementById('productsTableBody');
      let filtered = products;
      if (adminSearchTerm) filtered = filtered.filter(p => p.name?.toLowerCase().includes(adminSearchTerm));
      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Товарів не знайдено</td></tr>';
        return;
      }
      tbody.innerHTML = filtered.map(p => `
        <tr>
          <td><img class="td-img" src="${p.images?.[0] || ''}" alt="${p.name}" onerror="this.style.display='none'" /></td>
          <td class="td-name">${p.name}</td>
          <td class="td-cat" data-label="Кат.">${CATEGORY_LABELS[p.category] || p.category || '—'}</td>
          <td class="td-price" data-label="Ціна">${(p.price || 0).toLocaleString('uk-UA')} ₴</td>
          <td data-label="Наявн."><span class="${p.inStock !== false ? 'badge-in' : 'badge-out'}">${p.inStock !== false ? 'Є' : 'Немає'}</span></td>
          <td><div class="td-actions">
            <button class="btn-edit" onclick="editProduct('${p.id}')">Редагувати</button>
            <button class="btn-danger" onclick="deleteProduct('${p.id}','${p.name?.replace(/'/g,&quot;′&quot;)}')">Видалити</button>
          </div></td>
        </tr>`).join('');
    }

    // ─── PRODUCT MODAL ────────────────────────────────────────
    function openProductModal(p = null) {
      uploadedImages = p?.images ? [...p.images] : [];
      document.getElementById('editId').value = p?.id || '';
      document.getElementById('modalTitle').textContent = p ? 'Редагувати товар' : 'Новий товар';
      document.getElementById('pName').value = p?.name || '';
      document.getElementById('pPrice').value = p?.price || '';
      document.getElementById('pCategory').value = p?.category || '';
      document.getElementById('pDesc').value = p?.description || '';
      document.getElementById('pInStock').checked = p?.inStock !== false;
      document.getElementById('pFeatured').checked = p?.featured || false;
      renderUploadPreview();
      document.getElementById('productModal').classList.add('open');
    }

    function closeProductModal() {
      document.getElementById('productModal').classList.remove('open');
      uploadedImages = [];
      document.getElementById('uploadPreview').innerHTML = '';
      document.getElementById('uploadProgress').textContent = '';
    }

    document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());

    document.getElementById('adminSearch').addEventListener('input', e => {
      adminSearchTerm = e.target.value.toLowerCase().trim();
      renderProductsTable();
    });

    document.getElementById('adminCatSelect').addEventListener('change', e => {
      adminCatFilter = e.target.value;
      loadProducts();
    });
    document.getElementById('modalCancel').addEventListener('click', closeProductModal);
    document.getElementById('productModal').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeProductModal();
    });

    window.editProduct = id => {
      const p = products.find(x => x.id === id);
      if (p) openProductModal(p);
    };

    window.deleteProduct = async (id, name) => {
      if (!confirm(`Видалити "${name}"?`)) return;
      try {
        await deleteDoc(doc(db, 'products', id));
        toast('Товар видалено', 'success');
        loadProducts();
        loadDashboard();
      } catch (err) {
        toast(err.message, 'error');
      }
    };

    // ─── FILE UPLOAD ──────────────────────────────────────────
    document.getElementById('uploadArea').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', e => {
      handleFiles(Array.from(e.target.files));
    });

    document.getElementById('uploadArea').addEventListener('dragover', e => {
      e.preventDefault();
      e.currentTarget.style.borderColor = 'rgba(255,79,163,.6)';
    });
    document.getElementById('uploadArea').addEventListener('dragleave', e => {
      e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)';
    });
    document.getElementById('uploadArea').addEventListener('drop', e => {
      e.preventDefault();
      e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)';
      handleFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
    });

    async function handleFiles(files) {
      const prog = document.getElementById('uploadProgress');
      prog.textContent = `Завантаження ${files.length} фото...`;
      for (const file of files) {
        try {
          const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
          const snap = await uploadBytes(storageRef, file);
          const url = await getDownloadURL(snap.ref);
          uploadedImages.push(url);
          renderUploadPreview();
        } catch (err) {
          toast(`Помилка: ${err.message}`, 'error');
        }
      }
      prog.textContent = '';
    }

    function renderUploadPreview() {
      document.getElementById('uploadPreview').innerHTML = uploadedImages.map((url, i) => `
        <div class="upload-preview-item">
          <img src="${url}" alt="preview" />
          <button onclick="removeImage(${i})">✕</button>
        </div>`).join('');
    }

    window.removeImage = i => {
      uploadedImages.splice(i, 1);
      renderUploadPreview();
    };

    // ─── SAVE PRODUCT ─────────────────────────────────────────
    document.getElementById('modalSave').addEventListener('click', async () => {
      const id = document.getElementById('editId').value;
      const name = document.getElementById('pName').value.trim();
      const price = document.getElementById('pPrice').value;
      const category = document.getElementById('pCategory').value;
      if (!name || !price || !category) {
        toast('Заповніть всі обовʼязкові поля', 'error'); return;
      }
      const data = {
        name, price: Number(price), category,
        description: document.getElementById('pDesc').value.trim(),
        images: uploadedImages,
        inStock: document.getElementById('pInStock').checked,
        featured: document.getElementById('pFeatured').checked,
      };
      try {
        if (id) {
          await updateDoc(doc(db, 'products', id), { ...data, updatedAt: new Date().toISOString() });
          toast('Товар оновлено', 'success');
        } else {
          data.createdAt = new Date().toISOString();
          await addDoc(collection(db, 'products'), data);
          toast('Товар додано', 'success');
        }
        closeProductModal();
        loadProducts();
        loadDashboard();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // ─── CATEGORIES ───────────────────────────────────────────
    async function loadCategories() {
      try {
        const snap = await getDocs(query(collection(db, 'categories'), orderBy('order')));
        categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch {
        categories = [];
      }
      renderCatsTable();
    }

    function renderCatsTable() {
      const tbody = document.getElementById('catsTableBody');
      if (!categories.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Категорій ще немає</td></tr>'; return;
      }
      tbody.innerHTML = categories.map(c => `
        <tr>
          <td style="font-weight:500;">${c.name}</td>
          <td class="td-cat" data-label="Slug">${c.slug}</td>
          <td data-label="Порядок">${c.order ?? 0}</td>
          <td><div class="td-actions">
            <button class="btn-edit" onclick="editCat('${c.id}')">Редагувати</button>
            <button class="btn-danger" onclick="deleteCat('${c.id}','${c.name}')">Видалити</button>
          </div></td>
        </tr>`).join('');
    }

    function openCatModal(c = null) {
      document.getElementById('catEditId').value = c?.id || '';
      document.getElementById('catModalTitle').textContent = c ? 'Редагувати категорію' : 'Нова категорія';
      document.getElementById('cName').value = c?.name || '';
      document.getElementById('cSlug').value = c?.slug || '';
      document.getElementById('cOrder').value = c?.order ?? 0;
      document.getElementById('catModal').classList.add('open');
    }

    document.getElementById('addCatBtn').addEventListener('click', () => openCatModal());
    document.getElementById('catModalCancel').addEventListener('click', () => document.getElementById('catModal').classList.remove('open'));
    document.getElementById('catModal').addEventListener('click', e => {
      if (e.target === e.currentTarget) document.getElementById('catModal').classList.remove('open');
    });

    window.editCat = id => { const c = categories.find(x => x.id === id); if (c) openCatModal(c); };

    window.deleteCat = async (id, name) => {
      if (!confirm(`Видалити категорію "${name}"?`)) return;
      await deleteDoc(doc(db, 'categories', id));
      toast('Категорію видалено', 'success');
      loadCategories();
      loadDashboard();
    };

    document.getElementById('catModalSave').addEventListener('click', async () => {
      const id = document.getElementById('catEditId').value;
      const name = document.getElementById('cName').value.trim();
      const slug = document.getElementById('cSlug').value.trim();
      if (!name || !slug) { toast('Назва та slug обовʼязкові', 'error'); return; }
      const data = { name, slug, order: Number(document.getElementById('cOrder').value) || 0 };
      try {
        if (id) {
          await updateDoc(doc(db, 'categories', id), data);
          toast('Категорію оновлено', 'success');
        } else {
          await addDoc(collection(db, 'categories'), data);
          toast('Категорію додано', 'success');
        }
        document.getElementById('catModal').classList.remove('open');
        loadCategories();
        loadDashboard();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // ─── TOAST ────────────────────────────────────────────────
    function toast(msg, type = 'success') {
      const el = document.getElementById('adminToast');
      el.textContent = msg;
      el.className = `admin-toast show ${type}`;
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('show'), 3000);
    }
  