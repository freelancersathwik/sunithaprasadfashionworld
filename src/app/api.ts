import axios from 'axios';

// In dev, use Vite proxy (/api) — works for localhost and frontend ngrok tunnel.
// Set VITE_API_URL to your backend ngrok URL when not using the Vite proxy.
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
  ?? (import.meta.env.DEV ? '' : 'http://localhost:5000');

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach JWT token and ngrok bypass header to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('spfw_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (API_BASE.includes('ngrok')) {
    config.headers['ngrok-skip-browser-warning'] = 'true';
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('spfw_token');
      localStorage.removeItem('spfw_user');
    }
    return Promise.reject(err);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { name: string; email: string; mobile: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
};

// ─── Products ────────────────────────────────────────────────────────────────
export const productsAPI = {
  getAll: (params?: { category_id?: string; featured?: boolean; search?: string; limit?: number; offset?: number }) =>
    api.get('/products', { params }),
  getBySlug: (slug: string) =>
    api.get(`/products/${slug}`),
  getById: (id: string) =>
    api.get(`/products/id/${id}`),
};

// ─── Categories ──────────────────────────────────────────────────────────────
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
};

// ─── Cart ────────────────────────────────────────────────────────────────────
export const cartAPI = {
  get: () => api.get('/users/cart'),
  add: (data: { product_id: string; variant_id?: string; quantity?: number }) =>
    api.post('/users/cart', data),
  update: (itemId: string, quantity: number) =>
    api.put(`/users/cart/${itemId}`, { quantity }),
  remove: (itemId: string) =>
    api.delete(`/users/cart/${itemId}`),
  clear: () => api.delete('/users/cart'),
};

// ─── Wishlist ────────────────────────────────────────────────────────────────
export const wishlistAPI = {
  get: () => api.get('/users/wishlist'),
  toggle: (product_id: string) =>
    api.post('/users/wishlist', { product_id }),
  remove: (product_id: string) =>
    api.delete(`/users/wishlist/${product_id}`),
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const ordersAPI = {
  create: (data: any) => api.post('/orders', data),
  getAll: () => api.get('/orders'),
  getById: (orderId: string) => api.get(`/orders/${orderId}`),
  getMyOrders: () => api.get('/orders/my-orders'),
  abandonCheckout: (orderId: string) => api.delete(`/orders/${orderId}/abandon`),
  requestCancellation: (orderId: string, reason: string) =>
    api.put(`/orders/${orderId}/cancel`, { reason }),
  // Admin
  getAllAdmin: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/orders/admin/all', { params }),
  updateStatus: (orderId: string, status: string) =>
    api.put(`/orders/${orderId}/status`, { order_status: status }),
  deleteOrder: (orderId: string) => api.delete(`/orders/${orderId}`),
  getAnalytics: () => api.get('/orders/admin/analytics'),
};

// ─── Payment ─────────────────────────────────────────────────────────────────
export const paymentAPI = {
  createOrder: (data: { amount: number; order_id: string }) =>
    api.post('/payment/create-order', data),
  verifyPayment: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; order_id: string }) =>
    api.post('/payment/verify', data),
};

// ─── Reviews ─────────────────────────────────────────────────────────────────
export const reviewsAPI = {
  getByProduct: (productId: string) =>
    api.get(`/reviews/product/${productId}`),
  getMine: () => api.get('/reviews/my-reviews'),
  create: (data: { product_id: string; rating: number; review: string }) =>
    api.post('/reviews', data),
  getAllAdmin: () => api.get('/reviews'),
  delete: (id: string) => api.delete(`/reviews/${id}`),
  update: (id: string, data: { rating: number; review: string }) =>
    api.put(`/reviews/${id}`, data),
};

// ─── Users (Admin) ───────────────────────────────────────────────────────────
export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  getAddresses: () => api.get('/users/addresses'),
  addAddress: (data: any) => api.post('/users/addresses', data),
  // Admin
  getAllUsers: () => api.get('/users'),
  deleteUser: (id: string) => api.delete(`/users/${id}`),
};

// ─── Admin Products ──────────────────────────────────────────────────────────
export const adminProductsAPI = {
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  getLowStock: () => api.get('/products/admin/low-stock'),
};

// ─── Admin Categories ────────────────────────────────────────────────────────
export const adminCategoriesAPI = {
  create: (data: { name: string; image: string }) => api.post('/categories', data),
  update: (id: string, data: { name: string; image: string }) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// ─── Banners ─────────────────────────────────────────────────────────────────
export const bannersAPI = {
  getAll: () => api.get('/categories/banners'),
};

// ─── Upload (Admin) ─────────────────────────────────────────────────────────
export const uploadAPI = {
  uploadImages: (formData: FormData) =>
    api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteImage: (fileId: string) =>
    api.delete(`/upload/${fileId}`),
};

export default api;
