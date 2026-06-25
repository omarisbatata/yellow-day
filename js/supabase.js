// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://ydjuatvywfjfcrycwsdu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkanVhdHZ5d2ZqZmNyeWN3c2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzQxNTYsImV4cCI6MjA5NjYxMDE1Nn0.iaEuRQ28YsqBXM8GfApUFkJFhyn_Oj-hIUjnrxdCx6k';

// Must match the email used to create the admin user in the Supabase
// dashboard (Authentication → Users) and the is_admin() check in
// supabase-migration-3-security.sql.
const ADMIN_EMAIL = 'admin@yellowday.local';

// Admin-gated requests must send the logged-in admin's access token (so
// the database can verify who's calling); everyone else just uses the
// public anon key. See adminLogin/ensureAdminToken below.
function authHeader() {
    const token = sessionStorage.getItem('adminAccessToken');
    return token || SUPABASE_KEY;
}

// ===== SUPABASE API =====
const supabase = {

    async getProducts() {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*,brands(id,name,name_ar,logo_color,logo_url)&order=id`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                }
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.map(p => ({
                id: p.id,
                name: p.name,
                nameAr: p.name_ar,
                price: p.price,
                category: p.category,
                desc: p.desc_short,
                fullDesc: p.desc_full,
                imageColor: p.image_color,
                imageUrl: p.image_url || null,
                inStock: p.in_stock !== false,
                stockQuantity: p.stock_quantity || 0,
                brandId: p.brand_id,
                brand: p.brands ? { id: p.brands.id, name: p.brands.name, nameAr: p.brands.name_ar, logoColor: p.brands.logo_color, logoUrl: p.brands.logo_url } : null
            }));
        } catch (e) {
            console.error('Error fetching products:', e);
            return [];
        }
    },

    async addProduct(product) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/products`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + authHeader(),
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    name: product.name,
                    name_ar: product.nameAr,
                    price: product.price,
                    category: product.category,
                    desc_short: product.desc,
                    desc_full: product.fullDesc || '',
                    image_color: product.imageColor,
                    image_url: product.imageUrl || null,
                    in_stock: product.inStock !== false,
                    stock_quantity: product.stockQuantity || 10,
                    brand_id: product.brandId || null
                })
            });
        } catch (e) {
            console.error('Error adding product:', e);
        }
    },

    async updateProduct(id, product) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + authHeader(),
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    name: product.name,
                    name_ar: product.nameAr,
                    price: product.price,
                    category: product.category,
                    desc_short: product.desc,
                    desc_full: product.fullDesc || '',
                    image_color: product.imageColor,
                    image_url: product.imageUrl || null,
                    in_stock: product.inStock !== false,
                    stock_quantity: product.stockQuantity || 0,
                    brand_id: product.brandId || null
                })
            });
        } catch (e) {
            console.error('Error updating product:', e);
        }
    },

    async deleteProduct(id) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + authHeader()
                }
            });
        } catch (e) {
            console.error('Error deleting product:', e);
        }
    },

    // Public RPC: safely decrement stock during checkout without granting
    // full write access to the product row. See decrement_stock() in
    // supabase-migration-3-security.sql.
    async decrementStock(productId, qty) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/rpc/decrement_stock`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ p_product_id: productId, p_qty: qty })
            });
        } catch (e) {
            console.error('Error decrementing stock:', e);
        }
    },

    async getOrders() {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?order=created_at.desc`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + authHeader()
                }
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.map(o => ({
                id: o.id,
                date: o.date,
                customer: {
                    name: o.customer_name,
                    phone: o.customer_phone,
                    governorate: o.governorate,
                    address: o.address
                },
                items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
                total: o.total,
                notes: o.notes,
                status: o.status
            }));
        } catch (e) {
            console.error('Error fetching orders:', e);
            return [];
        }
    },

    // Public RPC: fetch only the orders matching a given phone number,
    // instead of downloading every customer's orders and filtering
    // client-side. See get_orders_by_phone() in supabase-migration-3-security.sql.
    async getOrdersByPhone(phone) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_orders_by_phone`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ p_phone: phone })
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.map(o => ({
                id: o.id,
                date: o.date,
                customer: {
                    name: o.customer_name,
                    phone: o.customer_phone,
                    governorate: o.governorate,
                    address: o.address
                },
                items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
                total: o.total,
                notes: o.notes,
                status: o.status
            }));
        } catch (e) {
            console.error('Error fetching orders by phone:', e);
            return [];
        }
    },

    async addOrder(order) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    id: order.id,
                    date: order.date,
                    customer_name: order.customer.name,
                    customer_phone: order.customer.phone,
                    governorate: order.customer.governorate,
                    address: order.customer.address,
                    items: order.items,
                    total: order.total,
                    notes: order.notes || '',
                    status: order.status
                })
            });
        } catch (e) {
            console.error('Error adding order:', e);
        }
    },

    async updateOrderStatus(id, status) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + authHeader(),
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ status: status })
            });
        } catch (e) {
            console.error('Error updating order:', e);
        }
    },

    async deleteAllOrders() {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/orders?id=gt.0`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + authHeader()
                }
            });
        } catch (e) {
            console.error('Error deleting orders:', e);
        }
    },

    // ===== BRANDS =====
    async getBrands() {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/brands?order=id`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                }
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.map(b => ({
                id: b.id,
                name: b.name,
                nameAr: b.name_ar,
                logoColor: b.logo_color,
                logoUrl: b.logo_url || null
            }));
        } catch (e) {
            console.error('Error fetching brands:', e);
            return [];
        }
    },

    async addBrand(brand) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/brands`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + authHeader(),
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    name: brand.name,
                    name_ar: brand.nameAr,
                    logo_color: brand.logoColor,
                    logo_url: brand.logoUrl || null
                })
            });
        } catch (e) {
            console.error('Error adding brand:', e);
        }
    },

    async updateBrand(id, brand) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/brands?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + authHeader(),
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    name: brand.name,
                    name_ar: brand.nameAr,
                    logo_color: brand.logoColor,
                    logo_url: brand.logoUrl || null
                })
            });
        } catch (e) {
            console.error('Error updating brand:', e);
        }
    },

    async deleteBrand(id) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/brands?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + authHeader()
                }
            });
        } catch (e) {
            console.error('Error deleting brand:', e);
        }
    },

    // ===== VISITS (admin analytics) =====
    async recordVisit(page) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/visits`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ page: page || 'unknown' })
            });
        } catch (e) {
            console.error('Error recording visit:', e);
        }
    },

    async getVisitStats() {
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const [totalRes, todayRes] = await Promise.all([
                fetch(`${SUPABASE_URL}/rest/v1/visits?select=id`, {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': 'Bearer ' + authHeader(),
                        'Prefer': 'count=exact',
                        'Range': '0-0'
                    }
                }),
                fetch(`${SUPABASE_URL}/rest/v1/visits?select=id&created_at=gte.${todayStart.toISOString()}`, {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': 'Bearer ' + authHeader(),
                        'Prefer': 'count=exact',
                        'Range': '0-0'
                    }
                })
            ]);

            const parseCount = (res) => {
                const range = res.headers.get('content-range');
                if (!range) return 0;
                const total = range.split('/')[1];
                return total === '*' ? 0 : parseInt(total, 10) || 0;
            };

            return { total: parseCount(totalRes), today: parseCount(todayRes) };
        } catch (e) {
            console.error('Error fetching visit stats:', e);
            return { total: 0, today: 0 };
        }
    },

    // ===== ADMIN AUTH (real Supabase Auth, replaces the old hardcoded password) =====
    async adminLogin(email, password) {
        try {
            const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            if (!response.ok) return false;
            const data = await response.json();
            if (!data.access_token) return false;
            sessionStorage.setItem('adminAccessToken', data.access_token);
            sessionStorage.setItem('adminRefreshToken', data.refresh_token);
            sessionStorage.setItem('adminTokenExpiry', String(Date.now() + (data.expires_in * 1000)));
            return true;
        } catch (e) {
            console.error('Error logging in:', e);
            return false;
        }
    },

    async refreshAdminToken() {
        try {
            const refreshToken = sessionStorage.getItem('adminRefreshToken');
            if (!refreshToken) return false;
            const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            if (!response.ok) return false;
            const data = await response.json();
            if (!data.access_token) return false;
            sessionStorage.setItem('adminAccessToken', data.access_token);
            sessionStorage.setItem('adminRefreshToken', data.refresh_token);
            sessionStorage.setItem('adminTokenExpiry', String(Date.now() + (data.expires_in * 1000)));
            return true;
        } catch (e) {
            console.error('Error refreshing admin session:', e);
            return false;
        }
    },

    // Call before doing admin work on a page load: makes sure the stored
    // token is still valid (refreshing it if it's about to expire), and
    // reports false if the admin needs to log in again.
    async ensureAdminToken() {
        const token = sessionStorage.getItem('adminAccessToken');
        if (!token) return false;
        const expiry = parseInt(sessionStorage.getItem('adminTokenExpiry') || '0', 10);
        if (Date.now() > expiry - 30000) {
            return await this.refreshAdminToken();
        }
        return true;
    },

    isAdminLoggedIn() {
        return !!sessionStorage.getItem('adminAccessToken');
    },

    async adminLogout() {
        const token = sessionStorage.getItem('adminAccessToken');
        sessionStorage.removeItem('adminAccessToken');
        sessionStorage.removeItem('adminRefreshToken');
        sessionStorage.removeItem('adminTokenExpiry');
        if (token) {
            try {
                await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': 'Bearer ' + token
                    }
                });
            } catch (e) {
                // best-effort — local session is already cleared above
            }
        }
    }
};