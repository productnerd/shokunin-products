(() => {
  const PER_PAGE = 48;
  const PRICE_RANGES = [
    { label: 'All', min: 0, max: Infinity },
    { label: 'Under ¥5,000', min: 0, max: 5000 },
    { label: '¥5k – ¥15k', min: 5000, max: 15000 },
    { label: '¥15k – ¥30k', min: 15000, max: 30000 },
    { label: '¥30k – ¥60k', min: 30000, max: 60000 },
    { label: 'Over ¥60k', min: 60000, max: Infinity },
  ];

  let allProducts = [];
  let categories = [];
  let brands = [];

  let state = {
    search: '',
    category: null,
    priceRange: 0,
    brand: null,
    sort: 'price_asc',
    page: 1,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const fmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });

  // ── Init ──
  async function init() {
    const res = await fetch('data/products.json');
    const data = await res.json();
    allProducts = data.products;
    categories = data.categories;
    brands = [...new Set(allProducts.map(p => p.brand))].sort();

    renderCategoryPills();
    renderPricePills();
    renderBrandDropdown();
    bindEvents();
    render();
  }

  // ── Render filter pills ──
  function renderCategoryPills() {
    const row = $('#categoryFilters');
    const allPill = pill('All', state.category === null, () => { state.category = null; state.page = 1; updatePills(); render(); });
    row.appendChild(allPill);
    categories.forEach(cat => {
      row.appendChild(pill(cat, false, () => {
        state.category = state.category === cat ? null : cat;
        state.page = 1;
        updatePills();
        render();
      }));
    });
  }

  function renderPricePills() {
    const row = $('#priceFilters');
    PRICE_RANGES.forEach((range, i) => {
      row.appendChild(pill(range.label, i === 0, () => {
        state.priceRange = state.priceRange === i ? 0 : i;
        state.page = 1;
        updatePills();
        render();
      }));
    });
  }

  function pill(label, active, onclick) {
    const el = document.createElement('button');
    el.className = 'pill' + (active ? ' active' : '');
    el.textContent = label;
    el.addEventListener('click', onclick);
    return el;
  }

  function updatePills() {
    // Category pills
    const catPills = $$('#categoryFilters .pill');
    catPills.forEach((p, i) => {
      if (i === 0) p.classList.toggle('active', state.category === null);
      else p.classList.toggle('active', categories[i - 1] === state.category);
    });
    // Price pills
    const pricePills = $$('#priceFilters .pill');
    pricePills.forEach((p, i) => p.classList.toggle('active', i === state.priceRange));
  }

  // ── Brand dropdown ──
  function renderBrandDropdown() {
    const list = $('#brandList');
    // "All" option
    const allItem = document.createElement('div');
    allItem.className = 'dropdown-item active';
    allItem.textContent = 'All Brands';
    allItem.addEventListener('click', () => { state.brand = null; state.page = 1; closeBrandMenu(); render(); updateBrandToggle(); });
    list.appendChild(allItem);

    brands.forEach(b => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.textContent = b;
      item.dataset.brand = b;
      item.addEventListener('click', () => { state.brand = b; state.page = 1; closeBrandMenu(); render(); updateBrandToggle(); });
      list.appendChild(item);
    });
  }

  function updateBrandToggle() {
    const toggle = $('#brandToggle');
    if (state.brand) {
      toggle.textContent = state.brand;
      toggle.classList.add('has-value');
    } else {
      toggle.innerHTML = 'Brand <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
      toggle.classList.remove('has-value');
    }
    // Update active states
    $$('#brandList .dropdown-item').forEach(item => {
      item.classList.toggle('active', item.dataset.brand === state.brand || (!item.dataset.brand && !state.brand));
    });
  }

  function closeBrandMenu() {
    $('#brandMenu').classList.remove('open');
    $('#brandSearch').value = '';
    filterBrandList('');
  }

  function filterBrandList(query) {
    const q = query.toLowerCase();
    $$('#brandList .dropdown-item').forEach(item => {
      if (!item.dataset.brand) { item.style.display = ''; return; }
      item.style.display = item.dataset.brand.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  // ── Filter + search + sort ──
  function getFiltered() {
    let results = allProducts;

    if (state.search) {
      const q = state.search.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.material.some(m => m.toLowerCase().includes(q))
      );
    }

    if (state.category) results = results.filter(p => p.category === state.category);
    if (state.brand) results = results.filter(p => p.brand === state.brand);

    const range = PRICE_RANGES[state.priceRange];
    if (range.min > 0 || range.max < Infinity) {
      results = results.filter(p => p.price >= range.min && p.price < range.max);
    }

    // Sort
    results.sort((a, b) => {
      if (state.sort === 'price_asc') return a.price - b.price;
      if (state.sort === 'price_desc') return b.price - a.price;
      return a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name);
    });

    return results;
  }

  // ── Render ──
  function render() {
    const filtered = getFiltered();
    const visible = filtered.slice(0, state.page * PER_PAGE);
    const grid = $('#productGrid');
    const empty = $('#emptyState');
    const loadWrap = $('#loadMoreWrap');

    grid.innerHTML = '';

    if (filtered.length === 0) {
      empty.style.display = '';
      loadWrap.style.display = 'none';
    } else {
      empty.style.display = 'none';
      visible.forEach(p => grid.appendChild(card(p)));
      loadWrap.style.display = visible.length < filtered.length ? '' : 'none';
    }

    $('#resultsCount').textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
  }

  function card(p) {
    const a = document.createElement('a');
    a.className = 'product-card';
    a.href = p.url;
    a.target = '_blank';
    a.rel = 'noopener';

    a.innerHTML = `
      <div class="product-image-wrap">
        <img src="${p.image}" alt="${p.name} by ${p.brand}" loading="lazy"
             onerror="this.parentElement.innerHTML='<svg class=\\'placeholder-icon\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><path d=\\'m21 15-5-5L5 21\\'/></svg>'">
      </div>
      <div class="product-info">
        <div class="product-brand">${p.brand}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-meta">
          <span class="product-price">${p.priceMax ? 'from ' + fmt.format(p.price) : fmt.format(p.price)}</span>
          ${p.variants ? `<span class="product-variants">${p.variants.length} options</span>` : `<span class="product-category-tag">${p.category}</span>`}
        </div>
      </div>
    `;
    return a;
  }

  // ── Events ──
  function bindEvents() {
    let debounce;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; render(); }, 250);
    });

    $('#sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

    $('#loadMoreBtn').addEventListener('click', () => { state.page++; render(); });

    // Brand dropdown toggle
    $('#brandToggle').addEventListener('click', (e) => {
      e.stopPropagation();
      $('#brandMenu').classList.toggle('open');
      if ($('#brandMenu').classList.contains('open')) $('#brandSearch').focus();
    });

    $('#brandSearch').addEventListener('input', (e) => filterBrandList(e.target.value));
    $('#brandSearch').addEventListener('click', (e) => e.stopPropagation());

    // Close dropdown on outside click
    document.addEventListener('click', () => closeBrandMenu());
    $('#brandMenu').addEventListener('click', (e) => e.stopPropagation());
  }

  init();
})();
