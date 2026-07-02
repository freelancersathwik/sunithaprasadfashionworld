import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authAPI, usersAPI, cartAPI, wishlistAPI, productsAPI } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: 'admin' | 'user';
}

export interface CartItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  product_name: string;
  product_image: string;
  sale_price: number;
  original_price: number | null;
  variant_color: string | null;
  stock: number;
}

export interface WishlistItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  sale_price: number;
  original_price: number | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, mobile: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  // Cart
  cart: CartItem[];
  cartLoading: boolean;
  addToCart: (product_id: string, variant_id?: string, quantity?: number) => Promise<void>;
  updateCartItem: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  cartTotal: number;
  // Wishlist
  wishlist: string[]; // array of product_ids
  wishlistItems: WishlistItem[];
  toggleWishlist: (product_id: string) => Promise<void>;
  isInWishlist: (product_id: string) => boolean;
  refreshWishlist: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('spfw_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('spfw_token'));
  const [isLoading, setIsLoading] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);

  // Wishlist state
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);

  // ─── Auth Functions ──────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      const { token: jwt, user: userData } = res.data;
      localStorage.setItem('spfw_token', jwt);
      localStorage.setItem('spfw_user', JSON.stringify(userData));
      setToken(jwt);
      setUser(userData);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, mobile: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authAPI.register({ name, email, mobile, password });
      const { token: jwt, user: userData } = res.data;
      localStorage.setItem('spfw_token', jwt);
      localStorage.setItem('spfw_user', JSON.stringify(userData));
      setToken(jwt);
      setUser(userData);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Registration failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('spfw_token');
    localStorage.removeItem('spfw_user');
    setToken(null);
    setUser(null);
    setCart([]);
    setWishlist([]);
    setWishlistItems([]);
  };

  // ─── Cart Functions ──────────────────────────────────────────────────────
  const refreshCart = useCallback(async () => {
    if (!token) {
      try {
        const savedCart = localStorage.getItem('spfw_guest_cart');
        const guestCart = savedCart ? JSON.parse(savedCart) : [];
        
        // Validate guest cart items against database
        const validCart = await Promise.all(
          guestCart.map(async (item: CartItem) => {
            try {
              const prodRes = await productsAPI.getById(item.product_id);
              const product = prodRes.data;
              if (!product || !product.is_active) {
                return null; // Remove deleted/inactive products
              }
              return item;
            } catch {
              return null; // Remove products that don't exist
            }
          })
        );
        
        const filteredCart = validCart.filter((item): item is CartItem => item !== null);
        if (filteredCart.length !== guestCart.length) {
          localStorage.setItem('spfw_guest_cart', JSON.stringify(filteredCart));
        }
        setCart(filteredCart);
      } catch {
        setCart([]);
      }
      return;
    }
    setCartLoading(true);
    try {
      const res = await cartAPI.get();
      const cartItems = res.data.items || [];
      
      // Validate cart items against database
      const validCart = await Promise.all(
        cartItems.map(async (item: CartItem) => {
          try {
            const prodRes = await productsAPI.getById(item.product_id);
            const product = prodRes.data;
            if (!product || !product.is_active) {
              return null; // Remove deleted/inactive products
            }
            return item;
          } catch {
            return null; // Remove products that don't exist
          }
        })
      );
      
      const filteredCart = validCart.filter((item): item is CartItem => item !== null);
      if (filteredCart.length !== cartItems.length) {
        // Update server cart if items were removed
        await cartAPI.clear();
        for (const item of filteredCart) {
          await cartAPI.add({ product_id: item.product_id, variant_id: item.variant_id || undefined, quantity: item.quantity });
        }
      }
      setCart(filteredCart);
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    } finally {
      setCartLoading(false);
    }
  }, [token]);

  const addToCart = async (product_id: string, variant_id?: string, quantity = 1) => {
    if (!token) {
      setCartLoading(true);
      try {
        const prodRes = await productsAPI.getById(product_id);
        const product = prodRes.data;
        
        let stock = product.stock;
        let variantColor = null;
        if (variant_id && product.variants) {
          const v = product.variants.find((v: any) => v.id === variant_id);
          if (v) {
            stock = v.stock;
            variantColor = v.color;
          }
        }

        const newCartItem: CartItem = {
          id: `guest_${product_id}_${variant_id || 'base'}`,
          product_id,
          variant_id: variant_id || null,
          quantity,
          product_name: product.name,
          product_image: product.image_urls?.[0] || '',
          sale_price: parseFloat(product.sale_price),
          original_price: product.original_price ? parseFloat(product.original_price) : null,
          variant_color: variantColor,
          stock
        };

        setCart(prev => {
          const existing = prev.find(item => item.product_id === product_id && item.variant_id === (variant_id || null));
          let updated;
          if (existing) {
            updated = prev.map(item => item.product_id === product_id && item.variant_id === (variant_id || null)
              ? { ...item, quantity: Math.min(item.quantity + quantity, stock) }
              : item
            );
          } else {
            updated = [...prev, newCartItem];
          }
          localStorage.setItem('spfw_guest_cart', JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.error('Failed to add guest cart item:', err);
      } finally {
        setCartLoading(false);
      }
      return;
    }
    await cartAPI.add({ product_id, variant_id, quantity });
    await refreshCart();
  };

  const updateCartItem = async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      await removeFromCart(itemId);
      return;
    }
    if (!token) {
      setCart(prev => {
        const updated = prev.map(item => {
          if (item.id !== itemId) return item;
          const isIncreasing = quantity > item.quantity;
          const newQty = isIncreasing ? Math.min(quantity, Math.max(item.stock, 1)) : quantity;
          return { ...item, quantity: Math.max(1, newQty) };
        });
        localStorage.setItem('spfw_guest_cart', JSON.stringify(updated));
        return updated;
      });
      return;
    }
    await cartAPI.update(itemId, quantity);
    await refreshCart();
  };

  const removeFromCart = async (itemId: string) => {
    if (!token) {
      setCart(prev => {
        const updated = prev.filter(item => item.id !== itemId);
        localStorage.setItem('spfw_guest_cart', JSON.stringify(updated));
        return updated;
      });
      return;
    }
    await cartAPI.remove(itemId);
    await refreshCart();
  };

  const clearCart = useCallback(async () => {
    setCart([]);
    if (!token) {
      localStorage.removeItem('spfw_guest_cart');
      return;
    }
    try {
      await cartAPI.clear();
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }
  }, [token]);

  // ─── Wishlist Functions ──────────────────────────────────────────────────
  const refreshWishlist = useCallback(async () => {
    if (!token) {
      try {
        const savedIds = localStorage.getItem('spfw_guest_wishlist_ids');
        const savedItems = localStorage.getItem('spfw_guest_wishlist_items');
        setWishlist(savedIds ? JSON.parse(savedIds) : []);
        setWishlistItems(savedItems ? JSON.parse(savedItems) : []);
      } catch {
        setWishlist([]);
        setWishlistItems([]);
      }
      return;
    }
    try {
      const res = await wishlistAPI.get();
      const items = res.data.items || [];
      setWishlistItems(items);
      setWishlist(items.map((i: WishlistItem) => i.product_id));
    } catch (err) {
      console.error('Failed to fetch wishlist:', err);
    }
  }, [token]);

  const toggleWishlist = async (product_id: string) => {
    if (!token) {
      try {
        const isFav = wishlist.includes(product_id);
        let updatedIds: string[];
        let updatedItems: WishlistItem[];
        
        if (isFav) {
          updatedIds = wishlist.filter(id => id !== product_id);
          updatedItems = wishlistItems.filter(item => item.product_id !== product_id);
        } else {
          const prodRes = await productsAPI.getById(product_id);
          const product = prodRes.data;
          const newItem: WishlistItem = {
            id: `guest_${product_id}`,
            product_id,
            product_name: product.name,
            product_image: product.image_urls?.[0] || '',
            sale_price: parseFloat(product.sale_price),
            original_price: product.original_price ? parseFloat(product.original_price) : null
          };
          updatedIds = [...wishlist, product_id];
          updatedItems = [...wishlistItems, newItem];
        }
        
        setWishlist(updatedIds);
        setWishlistItems(updatedItems);
        localStorage.setItem('spfw_guest_wishlist_ids', JSON.stringify(updatedIds));
        localStorage.setItem('spfw_guest_wishlist_items', JSON.stringify(updatedItems));
      } catch (err) {
        console.error('Failed to toggle guest wishlist:', err);
      }
      return;
    }
    await wishlistAPI.toggle(product_id);
    await refreshWishlist();
  };

  const isInWishlist = (product_id: string) => wishlist.includes(product_id);

  // Load cart & wishlist when token/user changes or on mount
  useEffect(() => {
    refreshCart();
    refreshWishlist();
  }, [token, user, refreshCart, refreshWishlist]);

  return (
    <AuthContext.Provider
      value={{
        user, token, isLoading, login, register, logout,
        cart, cartLoading, addToCart, updateCartItem, removeFromCart, clearCart, refreshCart, cartTotal,
        wishlist, wishlistItems, toggleWishlist, isInWishlist, refreshWishlist,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
