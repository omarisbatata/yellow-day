// ===== CART FUNCTIONS =====
let cartProducts = [];

async function loadCartProducts() {
    cartProducts = await supabase.getProducts();
}

function getProductById(id) {
    return cartProducts.find(p => p.id === id);
}

function getCart() {
    return JSON.parse(localStorage.getItem('yellowDayCart') || '[]');
}

function saveCart(cart) {
    localStorage.setItem('yellowDayCart', JSON.stringify(cart));
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

function renderCart() {
    const cart = getCart();
    const cartItemsDiv = document.getElementById('cartItems');
    const cartEmpty = document.getElementById('cartEmpty');
    const cartSummary = document.getElementById('cartSummary');
    
    if (!cartItemsDiv) return;
    
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '';
        if (cartEmpty) cartEmpty.style.display = 'block';
        if (cartSummary) cartSummary.style.display = 'none';
        return;
    }
    
    if (cartEmpty) cartEmpty.style.display = 'none';
    if (cartSummary) cartSummary.style.display = 'block';
    
    let total = 0;
    let hasOutOfStock = false;
    
    cartItemsDiv.innerHTML = cart.map(item => {
        const product = getProductById(item.productId);
        if (!product) return '';
        
        const maxStock = product.inStock ? product.stockQuantity : 0;
        const isOverStock = item.quantity > maxStock;
        const isOutOfStock = !product.inStock;
        
        if (isOutOfStock || isOverStock) {
            hasOutOfStock = true;
        }
        
        const subtotal = product.price * item.quantity;
        total += subtotal;
        
        return `
            <div class="cart-item ${isOutOfStock ? 'cart-item-outofstock' : ''} ${isOverStock ? 'cart-item-overstock' : ''}">
                <div class="cart-item-image" style="background: ${product.imageColor}; ${isOutOfStock ? 'opacity:0.4;' : ''}"></div>
                <div class="cart-item-info">
                    <h4>${product.nameAr}</h4>
                    <p style="font-size: 12px; color: #888;">${product.name}</p>
                    <span class="price">${product.price} دولار</span>
                    ${!product.inStock ? '<p style="color:#F44336;font-size:12px;font-weight:700;">❌ هذا المنتج لم يعد متوفراً</p>' : ''}
                    ${product.inStock && isOverStock ? `<p style="color:#E65100;font-size:12px;font-weight:700;">⚠️ الكمية المطلوبة أكثر من المتاح (المتاح: ${maxStock})</p>` : ''}
                    ${product.inStock && product.stockQuantity <= 3 && !isOverStock ? `<p style="color:#E65100;font-size:11px;">⚠️ فقط ${product.stockQuantity} متبقي في المخزون</p>` : ''}
                </div>
                <div class="cart-item-actions">
                    <button class="qty-btn" onclick="updateQuantity(${item.productId}, ${item.quantity - 1})">-</button>
                    <span style="font-weight: 700; min-width: 25px; text-align: center;">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity(${item.productId}, ${item.quantity + 1})">+</button>
                    <button class="remove-btn" onclick="removeItem(${item.productId})">حذف</button>
                </div>
            </div>
        `;
    }).join('');
    
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) {
        totalEl.innerHTML = `${total} <span style="font-size: 14px;">دولار</span>`;
    }
    
    const checkoutBtn = document.querySelector('#cartSummary .btn');
    if (checkoutBtn) {
        if (hasOutOfStock) {
            checkoutBtn.style.opacity = '0.5';
            checkoutBtn.style.cursor = 'not-allowed';
            checkoutBtn.onclick = function(e) {
                e.preventDefault();
                showPopup('⚠️ هناك منتجات في سلتك غير متوفرة أو الكمية المطلوبة أكثر من المتاح. يرجى تعديل السلة قبل المتابعة.', 'warning');
            };
        } else {
            checkoutBtn.style.opacity = '1';
            checkoutBtn.style.cursor = 'pointer';
            checkoutBtn.onclick = proceedToCheckout;
        }
    }
}

function updateQuantity(productId, newQuantity) {
    const product = getProductById(productId);
    
    if (!product) return;
    
    if (!product.inStock) {
        showPopup(`❌ عذراً، ${product.nameAr} غير متوفر حالياً`, 'error');
        return;
    }
    
    if (newQuantity > product.stockQuantity) {
        showPopup(`⚠️ عذراً، الكمية المتاحة من ${product.nameAr} هي ${product.stockQuantity} فقط`, 'warning');
        newQuantity = product.stockQuantity;
    }
    
    if (newQuantity <= 0) {
        removeItem(productId);
        return;
    }
    
    let cart = getCart();
    const item = cart.find(i => i.productId === productId);
    if (item) {
        item.quantity = newQuantity;
        saveCart(cart);
        renderCart();
        updateCartCountGlobal();
    }
}

function removeItem(productId) {
    let cart = getCart();
    const product = getProductById(productId);
    cart = cart.filter(i => i.productId !== productId);
    saveCart(cart);
    renderCart();
    updateCartCountGlobal();
    
    if (product) {
        showPopup(`🗑️ تم حذف ${product.nameAr} من السلة`, 'success');
    }
}

function proceedToCheckout() {
    const cart = getCart();
    
    for (const item of cart) {
        const product = getProductById(item.productId);
        if (!product || !product.inStock) {
            showPopup('❌ أحد المنتجات في سلتك غير متوفر. يرجى تحديث السلة.', 'error');
            return;
        }
        if (item.quantity > product.stockQuantity) {
            showPopup(`⚠️ الكمية المطلوبة من ${product.nameAr} أكثر من المتاح. تم تعديل الكمية تلقائياً.`, 'warning');
            item.quantity = product.stockQuantity;
            saveCart(cart);
            renderCart();
            return;
        }
    }
    
    const user = JSON.parse(localStorage.getItem('yellowDayUser'));
    if (!user) {
        alert('يرجى تسجيل الدخول أولاً');
        window.location.href = 'login.html';
        return;
    }
    window.location.href = 'checkout.html';
}

function updateCartCountGlobal() {
    const cart = getCart();
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('#cartCount').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    await loadCartProducts();
    renderCart();
    updateCartCountGlobal();
});