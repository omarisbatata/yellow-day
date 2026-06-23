let products = [];
let brands = [];
let activeCategory = 'all';
let activeBrandId = 'all';
let activeSearch = '';

async function loadProducts() {
    products = await supabase.getProducts();
    renderCategoryFilters();
    applyFilters();
}

async function loadBrands() {
    brands = await supabase.getBrands();
    renderBrands();
}

function renderBrands() {
    const grid = document.getElementById('brandsGrid');
    if (!grid) return;
    if (brands.length === 0) {
        grid.innerHTML = '<p style="text-align:center;grid-column:1/-1;padding:20px;color:#888;">لا توجد ماركات حالياً</p>';
        return;
    }
    grid.innerHTML = brands.map(b => `
        <div class="brand-card ${activeBrandId === b.id ? 'active-brand' : ''}" data-brand-id="${b.id}" onclick="filterByBrand(${b.id})">
            <div class="brand-logo" style="background:${b.logoColor};">
                ${b.logoUrl ? `<img src="${b.logoUrl}" alt="${b.name}">` : `<span>${b.name}</span>`}
            </div>
            <h4>${b.nameAr}</h4>
        </div>
    `).join('');
}

function renderCategoryFilters() {
    const bar = document.getElementById('categoryFilterBar');
    if (!bar) return;
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    bar.innerHTML = `
        <button class="filter-btn ${activeCategory === 'all' ? 'active-filter' : ''}" onclick="filterByCategory('all')">الكل</button>
        ${categories.map(c => `
            <button class="filter-btn ${activeCategory === c ? 'active-filter' : ''}" onclick="filterByCategory('${c}')">${c}</button>
        `).join('')}
    `;
}

function filterByCategory(category) {
    activeCategory = category;
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
    renderCategoryFilters();
    applyFilters();
}

function filterByBrand(brandId) {
    activeBrandId = activeBrandId === brandId ? 'all' : brandId;
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
    renderBrands();
    applyFilters();
}

function clearBrandFilter() {
    activeBrandId = 'all';
    renderBrands();
    applyFilters();
}

function applyFilters() {
    let filtered = products;
    if (activeCategory !== 'all') {
        filtered = filtered.filter(p => p.category === activeCategory);
    }
    if (activeBrandId !== 'all') {
        filtered = filtered.filter(p => p.brandId === activeBrandId);
    }
    if (activeSearch) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(activeSearch) || p.nameAr.includes(activeSearch) || (p.desc && p.desc.includes(activeSearch)));
    }
    renderActiveFilters();
    renderProducts(filtered);
}

function renderActiveFilters() {
    const el = document.getElementById('activeFilters');
    if (!el) return;
    const chips = [];
    if (activeCategory !== 'all') {
        chips.push(`<span class="active-filter-chip">${activeCategory} <button onclick="filterByCategory('all')">✕</button></span>`);
    }
    if (activeBrandId !== 'all') {
        const brand = brands.find(b => b.id === activeBrandId);
        chips.push(`<span class="active-filter-chip">${brand ? brand.nameAr : 'ماركة'} <button onclick="clearBrandFilter()">✕</button></span>`);
    }
    el.innerHTML = chips.join('');
}

// ===== POPUP MESSAGE =====
function showPopup(message, type) {
    const existing = document.querySelector('.stock-popup');
    if (existing) existing.remove();
    
    const popup = document.createElement('div');
    popup.className = 'stock-popup';
    popup.innerHTML = `
        <div class="stock-popup-content ${type}">
            <div class="popup-icon">${type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅'}</div>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add('show'), 10);
    setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 300);
    }, 3000);
}

// ===== CART =====
function getCart() {
    return JSON.parse(localStorage.getItem('yellowDayCart') || '[]');
}

function saveCart(cart) {
    localStorage.setItem('yellowDayCart', JSON.stringify(cart));
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    
    if (!product || !product.inStock) {
        showPopup(`❌ عذراً، ${product ? product.nameAr : 'هذا المنتج'} غير متوفر حالياً`, 'error');
        return;
    }
    
    let cart = getCart();
    const existing = cart.find(item => item.productId === productId);
    const currentQty = existing ? existing.quantity : 0;
    
    if (currentQty + 1 > product.stockQuantity) {
        showPopup(`⚠️ عذراً، لا يمكن إضافة المزيد. الكمية المتاحة من ${product.nameAr} هي ${product.stockQuantity} فقط`, 'warning');
        return;
    }
    
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ productId: productId, quantity: 1 });
    }
    saveCart(cart);
    updateCartCount();
    
    const btn = document.querySelector(`.add-to-cart[data-id="${productId}"]`);
    if (btn) {
        btn.textContent = '✓ تمت الإضافة';
        btn.classList.add('added');
        setTimeout(() => {
            btn.textContent = 'أضف للسلة';
            btn.classList.remove('added');
        }, 1500);
    }
}

function updateCartCount() {
    const cart = getCart();
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    const el = document.getElementById('cartCount');
    if (el) {
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
    }
}

function getStockLabel(product) {
    if (!product.inStock) {
        return '<span class="stock-badge out-of-stock">❌ غير متوفر</span>';
    }
    if (product.stockQuantity <= 3) {
        return `<span class="stock-badge low-stock">⚠️ فقط ${product.stockQuantity} متبقي</span>`;
    }
    return '<span class="stock-badge in-stock">✅ متوفر</span>';
}

function renderProducts(productList) {
    const list = productList || products;
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    if (list.length === 0) {
        grid.innerHTML = '<p style="text-align:center;grid-column:1/-1;padding:40px;color:#888;">لا توجد منتجات</p>';
        return;
    }
    grid.innerHTML = list.map(p => `
        <div class="product-card ${!p.inStock ? 'out-of-stock-card' : ''}" onclick="${p.inStock ? `window.location.href='product.html?id=${p.id}'` : ''}">
            <div class="product-image" style="background:${p.imageColor}; ${!p.inStock ? 'opacity:0.5;' : ''}">
                ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}">` : `<span style="font-size:22px;color:white;text-shadow:0 2px 4px rgba(0,0,0,0.2);">${p.name}</span>`}
                ${!p.inStock ? '<div class="sold-out-overlay">نفذت الكمية</div>' : ''}
            </div>
            <div class="product-info">
                ${p.brand ? `<span class="product-brand-tag">${p.brand.nameAr}</span>` : ''}
                <h3>${p.nameAr}</h3>
                <p class="desc">${p.desc}</p>
                <div class="stock-row">${getStockLabel(p)}</div>
                <div class="price-row">
                    <span class="price">${p.price} <span>دولار</span></span>
                    <button class="add-to-cart ${!p.inStock ? 'disabled-btn' : ''}" data-id="${p.id}" 
                        onclick="event.stopPropagation(); addToCart(${p.id})"
                        ${!p.inStock ? 'disabled' : ''}>
                        ${!p.inStock ? 'غير متوفر' : 'أضف للسلة'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function runSplashScreen() {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;
    if (sessionStorage.getItem('yellowDaySplashShown')) {
        splash.remove();
        return;
    }
    sessionStorage.setItem('yellowDaySplashShown', '1');
    setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 700);
    }, 1800);
}

document.addEventListener('DOMContentLoaded', async function() {
    runSplashScreen();
    await Promise.all([loadProducts(), loadBrands()]);
    updateCartCount();
    supabase.recordVisit('home');
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        searchBar.addEventListener('input', function(e) {
            activeSearch = e.target.value.toLowerCase();
            applyFilters();
        });
    }
    const user = JSON.parse(localStorage.getItem('yellowDayUser'));
    const display = document.getElementById('userNameDisplay');
    if (display && user) {
        display.textContent = '👤 ' + user.name;
        display.href = 'account.html';
    }
});