// ===== SIGNUP =====
document.getElementById('signupForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const user = {
        name: document.getElementById('fullName').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        governorate: document.getElementById('governorate').value,
        address: document.getElementById('address').value.trim(),
        password: document.getElementById('password').value
    };
    
    // Validate Syrian phone number
    if (!user.phone.match(/^09\d{8}$/)) {
        alert('يرجى إدخال رقم هاتف سوري صحيح (09XXXXXXXX)');
        return;
    }
    
    // Check if user exists
    const users = JSON.parse(localStorage.getItem('yellowDayUsers') || '[]');
    if (users.find(u => u.phone === user.phone)) {
        alert('هذا الرقم مسجل مسبقاً');
        return;
    }
    
    users.push(user);
    localStorage.setItem('yellowDayUsers', JSON.stringify(users));
    localStorage.setItem('yellowDayUser', JSON.stringify(user));
    
    alert('تم إنشاء الحساب بنجاح!');
    window.location.href = 'index.html';
});

// ===== LOGIN =====
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    const users = JSON.parse(localStorage.getItem('yellowDayUsers') || '[]');
    const user = users.find(u => u.phone === phone && u.password === password);
    
    if (user) {
        localStorage.setItem('yellowDayUser', JSON.stringify(user));
        alert('مرحباً ' + user.name);
        window.location.href = 'index.html';
    } else {
        alert('رقم الهاتف أو كلمة المرور غير صحيحة');
    }
});

// ===== LOGOUT =====
function logout() {
    localStorage.removeItem('yellowDayUser');
    window.location.href = 'index.html';
}

// Update cart count on auth pages
document.addEventListener('DOMContentLoaded', function() {
    const cart = JSON.parse(localStorage.getItem('yellowDayCart') || '[]');
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) {
        cartCountEl.textContent = count;
        cartCountEl.style.display = count > 0 ? 'flex' : 'none';
    }
});