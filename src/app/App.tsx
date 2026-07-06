import { useState, useEffect } from "react";
import {
  Search, Heart, ShoppingCart, User, Menu, X, ChevronRight, ChevronLeft,
  Shield, CreditCard, RefreshCcw, Truck, Headphones, Award, Star,
  Phone, Mail, MapPin, TrendingUp, Package, Users, Clock, LogOut, Bell,
  BarChart2, MessageSquare, Settings, LayoutDashboard, Layers,
  ArrowLeft, CheckCircle, Download, RotateCcw, Image as ImageIcon,
  Plus, Edit, Trash2, Calendar, AlertTriangle, Instagram
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { useAuth } from "./AuthContext";
import {
  productsAPI,
  categoriesAPI,
  ordersAPI,
  paymentAPI,
  reviewsAPI,
  usersAPI,
  adminProductsAPI,
  adminCategoriesAPI,
  bannersAPI,
  uploadAPI
} from "./api";
import { loadRazorpay } from "./razorpay";
import { getCheckoutSummary, getItemsSubtotalFromOrder } from "./checkoutPricing";

type View = "store" | "collections" | "product" | "checkout" | "orderDetails" | "wishlist" | "dashboard" | "profile" | "adminLogin" | "myOrders";

const INSTAGRAM_PROFILE_URL =
  "https://www.instagram.com/sunithaprasad_official?igsh=bG5kdmxzdzk0b3Q0";

export default function App() {
  const {
    user,
    token,
    login,
    register,
    logout,
    cart,
    addToCart,
    updateCartItem,
    removeFromCart,
    cartTotal,
    wishlist,
    wishlistItems,
    toggleWishlist,
    isInWishlist,
    refreshCart,
    clearCart,
    refreshWishlist
  } = useAuth();

  // Navigation
  const [view, setView] = useState<View>("store");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetailsSource, setOrderDetailsSource] = useState<"myOrders" | "admin">("myOrders");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("newest");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [filterPrice, setFilterPrice] = useState("");
  const [filterFabric, setFilterFabric] = useState("");
  const [filterOccasion, setFilterOccasion] = useState("");
  const [filterWorkType, setFilterWorkType] = useState("");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showAdminSidebar, setShowAdminSidebar] = useState(false);

  // App Data State
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Active Product Detail
  const [activeProduct, setActiveProduct] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedThumbnailImg, setSelectedThumbnailImg] = useState<string>("");
  const [activeProductReviews, setActiveProductReviews] = useState<any[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Checkout State
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    name: "",
    email: "",
    mobile: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    is_default: false
  });
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [showOrderThankYou, setShowOrderThankYou] = useState(false);

  // Auth Modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", mobile: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Listen for admin path in URL
  useEffect(() => {
    const handleUrlCheck = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === "/admin" || path.endsWith("/admin") || hash === "#/admin" || hash === "#admin" || hash.endsWith("/admin")) {
        if (token && user?.role === "admin") {
          setView("dashboard");
        } else {
          setView("adminLogin");
        }
      }
    };
    handleUrlCheck();
    
    window.addEventListener("popstate", handleUrlCheck);
    window.addEventListener("hashchange", handleUrlCheck);
    return () => {
      window.removeEventListener("popstate", handleUrlCheck);
      window.removeEventListener("hashchange", handleUrlCheck);
    };
  }, [token, user]);

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await login(authForm.email, authForm.password);
      if (res.success) {
        const storedUser = localStorage.getItem('spfw_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser.role === "admin") {
            triggerNotification("Admin login successful!");
            setAuthForm({ name: "", email: "", mobile: "", password: "" });
            setView("dashboard");
            return;
          }
        }
        logout();
        setAuthError("Unauthorized. This portal is for administrators only.");
      } else {
        setAuthError(res.error || "Invalid admin credentials.");
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || "Login failed. Please check credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Admin Dashboard State
  const [adminKPIs, setAdminKPIs] = useState<any>({
    todaySales: 0,
    weeklySales: 0,
    monthlySales: 0,
    totalRevenue: 0,
    totalFees: 0,
    totalOrders: 0,
    lowStockCount: 0,
    pendingOrdersCount: 0,
    razorpayFeePercent: 2,
    razorpayFeeGstPercent: 18
  });
  const [adminSalesData, setAdminSalesData] = useState<any[]>([]);
  const [adminBestSellers, setAdminBestSellers] = useState<any[]>([]);
  const [adminOrderStatusData, setAdminOrderStatusData] = useState<any[]>([]);
  const [adminTab, setAdminTab] = useState<"dashboard" | "products" | "categories" | "orders" | "customers" | "reviews">(() => {
    try {
      const saved = localStorage.getItem('spfw_admin_tab');
      return saved ? JSON.parse(saved) : "dashboard";
    } catch { return "dashboard"; }
  });
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminCustomers, setAdminCustomers] = useState<any[]>([]);
  const [adminReviews, setAdminReviews] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any>({ products: [], variants: [] });

  // Persist admin tab to localStorage
  useEffect(() => {
    localStorage.setItem('spfw_admin_tab', JSON.stringify(adminTab));
  }, [adminTab]);

  // Admin CRUD Form State
  const [showProductModal, setShowProductModal] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [categoryImageUploading, setCategoryImageUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [productForm, setProductForm] = useState({
    id: "",
    name: "",
    description: "",
    category_id: "",
    original_price: "",
    sale_price: "",
    stock: "",
    featured: false,
    image_urls: [] as string[],
    image_public_ids: [] as string[],
    fabric: "",
    occasion: "",
    work_type: "",
    blouse_included: true,
    length: "5.5 meters",
    care_instructions: "Dry clean only",
    color: "",
    weight: "500g",
    blouse: "80cm blouse piece included",
    variants: [] as any[]
  });
  const [newVariant, setNewVariant] = useState({ color: "", stock: "", original_price: "", sale_price: "" });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: "", name: "", image: "" });

  // Notifications Toast
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const triggerNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Auto-refresh once when the website is opened (per browser tab session)
  useEffect(() => {
    const REFRESH_KEY = "spfw_site_opened";
    if (!sessionStorage.getItem(REFRESH_KEY)) {
      sessionStorage.setItem(REFRESH_KEY, "1");
      window.location.reload();
    }
  }, []);

  // ─── Fetch Core Data ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCore = async () => {
      setCategoriesLoading(true);
      try {
        const catRes = await categoriesAPI.getAll();
        setCategories(catRes.data);
      } catch (err) {
        console.error("Failed to load categories:", err);
      } finally {
        setCategoriesLoading(false);
      }

      try {
        const bannerRes = await bannersAPI.getAll();
        setBanners(bannerRes.data);
      } catch (err) {
        console.error("Failed to load banners:", err);
      }
    };
    fetchCore();
  }, []);

  // Fetch products when filters change
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const params: any = {};
        if (selectedCategory) params.category = selectedCategory;
        if (searchQuery) params.search = searchQuery;
        if (sortBy) params.sort = sortBy;
        if (featuredOnly) params.featured = true;

        if (filterFabric) params.fabric = filterFabric;
        if (filterOccasion) params.occasion = filterOccasion;
        if (filterWorkType) params.work_type = filterWorkType;
        if (filterPrice) {
          if (filterPrice === "under_2000") {
            params.max_price = 2000;
          } else if (filterPrice === "2000_5000") {
            params.min_price = 2000;
            params.max_price = 5000;
          } else if (filterPrice === "5000_10000") {
            params.min_price = 5000;
            params.max_price = 10000;
          } else if (filterPrice === "above_10000") {
            params.min_price = 10000;
          }
        }

        const res = await productsAPI.getAll(params);
        setProducts(res.data.products || []);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, [selectedCategory, searchQuery, sortBy, featuredOnly, filterPrice, filterFabric, filterOccasion, filterWorkType]);

  // Load product detail & reviews
  useEffect(() => {
    if (selectedProductId) {
      const fetchDetail = async () => {
        try {
          const res = await productsAPI.getById(selectedProductId);
          setActiveProduct(res.data);
          // Reset thumbnail selection to first image
          setSelectedThumbnailImg(res.data.image_urls?.[0] || "");
          // Set default variant if available
          if (res.data.variants && res.data.variants.length > 0) {
            setSelectedVariant(res.data.variants[0]);
          } else {
            setSelectedVariant(null);
          }

          // Fetch reviews
          const revRes = await reviewsAPI.getByProduct(selectedProductId);
          setActiveProductReviews(revRes.data);
        } catch (err) {
          triggerNotification("Failed to load product details.", "error");
        }
      };
      fetchDetail();
    }
  }, [selectedProductId]);

  // Fetch Admin analytics & alerts
  const loadAdminData = async () => {
    if (user?.role !== "admin") return;
    try {
      const analyticsRes = await ordersAPI.getAnalytics();
      const { kpis, salesData, bestSellers, orderStatusData } = analyticsRes.data;
      setAdminKPIs(kpis);
      setAdminSalesData(salesData);
      setAdminBestSellers(bestSellers);
      setAdminOrderStatusData(orderStatusData);

      const ordersRes = await ordersAPI.getAllAdmin();
      setAdminOrders(ordersRes.data);

      const custRes = await usersAPI.getAllUsers();
      setAdminCustomers(custRes.data);

      const stockRes = await adminProductsAPI.getLowStock();
      setLowStockAlerts(stockRes.data);

      const reviewsRes = await reviewsAPI.getAllAdmin();
      setAdminReviews(reviewsRes.data);
    } catch (err) {
      console.error("Failed to load admin dashboard statistics:", err);
    }
  };

  useEffect(() => {
    if (view === "dashboard" && user?.role === "admin") {
      loadAdminData();
    }
  }, [view, adminTab, user]);

  useEffect(() => {
    if (!token && view === "checkout") {
      setView("store");
      setAuthMode("login");
      setAuthError("Please login to proceed to checkout.");
      setShowAuthModal(true);
      return;
    }

    if (token && view === "checkout") {
      const fetchAddresses = async () => {
        try {
          const res = await usersAPI.getAddresses();
          setAddresses(res.data);
          const defaultAddr = res.data.find((a: any) => a.is_default) || res.data[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
            setNewAddress({
              name: defaultAddr.name || "",
              email: user?.email || "",
              mobile: defaultAddr.mobile || "",
              address: defaultAddr.address || "",
              city: defaultAddr.city || "",
              state: defaultAddr.state || "",
              pincode: defaultAddr.pincode || "",
              is_default: defaultAddr.is_default || false
            });
          } else {
            setNewAddress({
              name: user?.name || "",
              email: user?.email || "",
              mobile: user?.mobile || "",
              address: "",
              city: "",
              state: "",
              pincode: "",
              is_default: false
            });
          }
        } catch (err) {
          console.error("Failed to fetch addresses:", err);
        }
      };
      fetchAddresses();
    } else if (!token) {
      setAddresses([]);
      setSelectedAddressId(null);
      setNewAddress({
        name: "",
        email: "",
        mobile: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        is_default: false
      });
    }
  }, [token, view, user]);

  // ─── Auth Logic ─────────────────────────────────────────────────────────────
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(authForm.email.toLowerCase().trim())) {
      setAuthError("Please enter a valid email address.");
      setAuthLoading(false);
      return;
    }

    if (authMode === "register") {
      if (!authForm.name.trim()) {
        setAuthError("Full name is required.");
        setAuthLoading(false);
        return;
      }
      const mobileRegex = /^[6-9]\d{9}$/;
      if (!mobileRegex.test(authForm.mobile.trim())) {
        setAuthError("Please enter a valid 10-digit mobile number.");
        setAuthLoading(false);
        return;
      }
      if (authForm.password.length < 6) {
        setAuthError("Password must be at least 6 characters long.");
        setAuthLoading(false);
        return;
      }
    }

    try {
      if (authMode === "login") {
        const res = await login(authForm.email, authForm.password);
        if (res.success) {
          triggerNotification("Successfully logged in.");
          setShowAuthModal(false);
        } else {
          setAuthError(res.error || "Login failed");
        }
      } else {
        const res = await register(authForm.name, authForm.email, authForm.mobile, authForm.password);
        if (res.success) {
          triggerNotification("Account created successfully!");
          setShowAuthModal(false);
        } else {
          setAuthError(res.error || "Registration failed");
        }
      }
    } catch (err: any) {
      setAuthError("Auth failed. Please check credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  // ─── Review Logic ───────────────────────────────────────────────────────────
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (!reviewText.trim()) return;

    setReviewSubmitting(true);
    try {
      await reviewsAPI.create({
        product_id: selectedProductId!,
        rating: reviewRating,
        review: reviewText
      });
      triggerNotification("Review submitted successfully!");
      setReviewText("");
      // Refresh reviews
      const revRes = await reviewsAPI.getByProduct(selectedProductId!);
      setActiveProductReviews(revRes.data);
    } catch (err) {
      triggerNotification("Failed to submit review.", "error");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // ─── Address Logic ──────────────────────────────────────────────────────────
  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await usersAPI.addAddress(newAddress);
      setAddresses(prev => [...prev, res.data]);
      setSelectedAddressId(res.data.id);
      setShowAddressForm(false);
      setNewAddress({
        name: "",
        mobile: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        is_default: false
      });
      triggerNotification("Address saved successfully.");
    } catch (err) {
      triggerNotification("Failed to save address.", "error");
    }
  };

  // ─── Order & Razorpay Checkout Flow ─────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!newAddress.name.trim() || !newAddress.email.trim() || !newAddress.mobile.trim() || !newAddress.address.trim() || !newAddress.city.trim() || !newAddress.state.trim() || !newAddress.pincode.trim()) {
      triggerNotification("Please fill in all shipping details.", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAddress.email.trim())) {
      triggerNotification("Please enter a valid email address.", "error");
      return;
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(newAddress.mobile.trim())) {
      triggerNotification("Please enter a valid 10-digit mobile number.", "error");
      return;
    }

    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(newAddress.pincode.trim())) {
      triggerNotification("Please enter a valid 6-digit pincode.", "error");
      return;
    }

    if (newAddress.address.trim().length < 10) {
      triggerNotification("Please enter a full shipping address (at least 10 characters).", "error");
      return;
    }

    const cityStateRegex = /^[a-zA-Z\s]{2,50}$/;
    if (!cityStateRegex.test(newAddress.city.trim())) {
      triggerNotification("Please enter a valid city (letters and spaces only).", "error");
      return;
    }

    if (!cityStateRegex.test(newAddress.state.trim())) {
      triggerNotification("Please enter a valid state (letters and spaces only).", "error");
      return;
    }

    setCheckoutSubmitting(true);

    // Validate cart items before checkout
    try {
      const validCart = await Promise.all(
        cart.map(async (item) => {
          try {
            const prodRes = await productsAPI.getById(item.product_id);
            const product = prodRes.data;
            if (!product || !product.is_active) {
              return null;
            }
            return item;
          } catch {
            return null;
          }
        })
      );

      const filteredCart = validCart.filter((item): item is typeof cart[0] => item !== null);
      if (filteredCart.length !== cart.length) {
        triggerNotification("One or more products in your cart are no longer available. Please refresh your cart.", "error");
        await refreshCart();
        setCheckoutSubmitting(false);
        return;
      }
    } catch (err) {
      triggerNotification("Failed to validate cart items. Please try again.", "error");
      setCheckoutSubmitting(false);
      return;
    }

    const checkoutItems = cart.map(item => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity
    }));

    let pendingOrderId: string | null = null;

    const abandonPendingCheckout = async () => {
      if (!pendingOrderId) return;
      try {
        await ordersAPI.abandonCheckout(pendingOrderId);
      } catch (err) {
        console.error('Failed to abandon checkout:', err);
      } finally {
        pendingOrderId = null;
      }
    };

    try {
      const orderRes = await ordersAPI.create({
        customer_name: newAddress.name,
        mobile: newAddress.mobile,
        email: newAddress.email,
        address: newAddress.address,
        city: newAddress.city,
        state: newAddress.state,
        pincode: newAddress.pincode,
        items: checkoutItems
      });

      const orderData = orderRes.data;
      pendingOrderId = orderData.order_id;

      triggerNotification("Initiating payment gateway...");
      
      const razorpayOrderRes = await paymentAPI.createOrder({
        amount: Math.round(orderData.total_amount * 100),
        order_id: orderData.order_id
      });

      const razorpayOrder = razorpayOrderRes.data;

      const completeMockPayment = async () => {
        const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(2, 11)}`;
        const mockSignature = `sig_mock_${Math.random().toString(36).substring(2, 11)}`;

        await paymentAPI.verifyPayment({
          razorpay_order_id: razorpayOrder.id,
          razorpay_payment_id: mockPaymentId,
          razorpay_signature: mockSignature,
          order_id: orderData.order_id
        });

        pendingOrderId = null;
        triggerNotification("Payment successful! Order confirmed.");
        await clearCart();
        setSelectedOrderId(orderData.order_id);
        setOrderDetailsSource("myOrders");
        setShowOrderThankYou(true);
        setView("orderDetails");
      };

      // Backend fell back to mock because Razorpay API keys failed
      if (razorpayOrder.is_mock) {
        triggerNotification(
          razorpayOrder.razorpay_error
            ? `Razorpay keys invalid (${razorpayOrder.razorpay_error}). Using test payment — regenerate keys in Razorpay dashboard.`
            : "Using test payment mode.",
          "error"
        );
        await completeMockPayment();
        return;
      }

      const sdkReady = await loadRazorpay();
      if (!sdkReady) {
        triggerNotification("Razorpay checkout script failed to load. Using test payment mode.", "error");
        await completeMockPayment();
        return;
      }

      const options = {
        key: razorpayOrder.key || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: "Sunithaprasad Fashion World",
        description: `Order Payment for ${orderData.order_id}`,
        order_id: razorpayOrder.id,
        handler: async (response: any) => {
          try {
            triggerNotification("Verifying payment transaction...");
            const verifyRes = await paymentAPI.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_id: orderData.order_id
            });

            if (verifyRes.data?.verified) {
              pendingOrderId = null;
              triggerNotification("Payment successful! Order confirmed.");
              await clearCart();
              setSelectedOrderId(orderData.order_id);
              setOrderDetailsSource("myOrders");
              setShowOrderThankYou(true);
              setView("orderDetails");
            } else {
              triggerNotification("Payment verification failed.", "error");
            }
          } catch (err) {
            console.error("Verification failed:", err);
            triggerNotification("Payment verification encountered an error.", "error");
          }
        },
        modal: {
          ondismiss: async () => {
            await abandonPendingCheckout();
          }
        },
        prefill: {
          name: newAddress.name,
          email: newAddress.email,
          contact: newAddress.mobile
        },
        theme: {
          color: "#7D1C1C"
        }
      };

      const rzp = new window.Razorpay!(options);
      rzp.on('payment.failed', function (resp: any) {
        triggerNotification(`Payment failed: ${resp.error.description}`, "error");
      });
      rzp.open();
    } catch (err: any) {
      console.error(err);
      await abandonPendingCheckout();
      triggerNotification(err.response?.data?.error || "Checkout failed. Please try again.", "error");
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  // ─── Admin CRUD Handlers ───────────────────────────────────────────────────

  // Saree attributes helper options
  const fabricOptions = ["Kanchipuram Silk", "Banarasi Silk", "Soft Silk", "Organza", "Chiffon", "Georgette", "Cotton", "Linen"];
  const occasionOptions = ["Wedding Wear", "Festive wear", "Bridal Wear", "Party wear", "Casual wear", "Office wear"];
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...productForm,
        original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
        sale_price: parseFloat(productForm.sale_price),
        stock: parseInt(productForm.stock || "0", 10),
        variants: productForm.variants.map((v: any) => ({
          color: v.color,
          stock: parseInt(String(v.stock || "0"), 10),
          original_price: v.original_price ? parseFloat(v.original_price) : null,
          sale_price: v.sale_price ? parseFloat(v.sale_price) : null,
          image_urls: v.image_urls || [],
          image_public_ids: v.image_public_ids || []
        }))
      };

      if (productForm.id) {
        await adminProductsAPI.update(productForm.id, payload);
        triggerNotification("Product updated successfully.");
      } else {
        await adminProductsAPI.create(payload);
        triggerNotification("Product created successfully.");
      }
      setShowProductModal(false);
      // Only reload admin data if on products tab
      if (adminTab === "products") {
        loadAdminData();
      }
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Failed to save product.", "error");
    }
  };

  const handleImageDelete = async (idx: number, publicId: string) => {
    try {
      // Only delete from ImageKit if it's a new ImageKit upload (has fileId)
      if (publicId) {
        await uploadAPI.deleteImage(publicId);
      }
      
      setProductForm(prev => {
        const newUrls = prev.image_urls.filter((_, i) => i !== idx);
        const newPublicIds = prev.image_public_ids ? prev.image_public_ids.filter((_, i) => i !== idx) : [];
        return { ...prev, image_urls: newUrls, image_public_ids: newPublicIds };
      });
    } catch (err: any) {
      console.error('Failed to delete image:', err);
      triggerNotification('Failed to delete image from server', 'error');
      // Still remove from form state even if server deletion fails
      setProductForm(prev => {
        const newUrls = prev.image_urls.filter((_, i) => i !== idx);
        const newPublicIds = prev.image_public_ids ? prev.image_public_ids.filter((_, i) => i !== idx) : [];
        return { ...prev, image_urls: newUrls, image_public_ids: newPublicIds };
      });
    }
  };

  const handleImageUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    
    setImageUploading(true);
    triggerNotification("Uploading image(s)...");
    
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append("images", file);
      });
      
      const res = await uploadAPI.uploadImages(formData);
      const uploadedImages = res.data.images;
      
      const newUrls = uploadedImages.map((img: any) => img.url);
      const newPublicIds = uploadedImages.map((img: any) => img.public_id);
      
      setProductForm(prev => ({
        ...prev,
        image_urls: [...(prev.image_urls || []), ...newUrls],
        image_public_ids: [...(prev.image_public_ids || []), ...newPublicIds]
      }));
      
      triggerNotification("Image(s) uploaded successfully!");
    } catch (err: any) {
      console.error(err);
      triggerNotification("Failed to upload image(s).", "error");
    } finally {
      setImageUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    handleImageUpload(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleImageUpload(files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    
    const items = e.clipboardData?.items;
    if (!items) return;
    
    const files: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    
    if (files.length > 0) {
      handleImageUpload(files);
    }
  };

  const handleEditProductClick = (prod: any) => {
    setProductForm({
      id: prod.id,
      name: prod.name,
      description: prod.description || "",
      category_id: prod.category_id || "",
      original_price: prod.original_price ? String(prod.original_price) : "",
      sale_price: String(prod.sale_price),
      stock: prod.stock.toString(),
      featured: !!prod.featured,
      image_urls: prod.image_urls || [],
      image_public_ids: prod.image_public_ids || [],
      fabric: prod.fabric || "",
      occasion: prod.occasion || "",
      work_type: prod.work_type || "",
      blouse_included: prod.blouse_included !== false,
      length: prod.length || "5.5 meters",
      care_instructions: prod.care_instructions || "Dry clean only",
      color: prod.color || "",
      weight: prod.weight || "500g",
      blouse: prod.blouse || "80cm blouse piece included",
      variants: (prod.variants || []).map((v: any) => ({
        ...v,
        color: v.color || "",
        stock: v.stock != null ? v.stock.toString() : "0",
        original_price: v.original_price != null
          ? String(v.original_price)
          : (prod.original_price ? String(prod.original_price) : ""),
        sale_price: v.sale_price != null
          ? String(v.sale_price)
          : String(prod.sale_price),
        image_urls: v.image_urls || [],
        image_public_ids: v.image_public_ids || []
      }))
    });
    setNewVariant({ color: "", stock: "", original_price: "", sale_price: "" });
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to soft delete this product?")) return;
    try {
      await adminProductsAPI.delete(id);
      triggerNotification("Product soft deleted successfully.");
      // Only reload admin data if on products tab
      if (adminTab === "products") {
        loadAdminData();
      }
    } catch (err) {
      triggerNotification("Failed to delete product.", "error");
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (categoryForm.id) {
        await adminCategoriesAPI.update(categoryForm.id, categoryForm);
        triggerNotification("Category updated successfully.");
      } else {
        await adminCategoriesAPI.create(categoryForm);
        triggerNotification("Category created successfully.");
      }
      setShowCategoryModal(false);
      // reload categories
      const catRes = await categoriesAPI.getAll();
      setCategories(catRes.data);
      // Only reload admin data if on categories tab
      if (adminTab === "categories") {
        loadAdminData();
      }
    } catch (err) {
      triggerNotification("Failed to save category.", "error");
    }
  };

  const handleEditCategoryClick = (cat: any) => {
    setCategoryForm({
      id: cat.id,
      name: cat.name,
      image: cat.image
    });
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (id: string) => {
    const category = categories.find(c => c.id === id);
    const productCount = category?.product_count || 0;
    
    console.log('DEBUG - Frontend Category Deletion:');
    console.log('Category ID:', id);
    console.log('Category Name:', category?.name);
    console.log('Product Count:', productCount);
    
    if (productCount > 0) {
      triggerNotification(`This category contains ${productCount} product${productCount > 1 ? 's' : ''} and cannot be deleted.`, "error");
      return;
    }
    
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await adminCategoriesAPI.delete(id);
      triggerNotification("Category deleted successfully.");
      // Optimistic UI update - remove from local state
      setCategories(prev => prev.filter(c => c.id !== id));
      // Reload categories from server to sync
      const catRes = await categoriesAPI.getAll();
      setCategories(catRes.data);
      // Only reload admin data if on categories tab
      if (adminTab === "categories") {
        loadAdminData();
      }
    } catch (err: any) {
      console.error('Frontend Category Deletion Error:', err);
      const errorMsg = err.response?.data?.error || err.message || "Failed to delete category.";
      console.error('Error Message:', errorMsg);
      triggerNotification(errorMsg, "error");
      // Reload categories on error to revert optimistic update
      const catRes = await categoriesAPI.getAll();
      setCategories(catRes.data);
    }
  };

  const handleOrderStatusUpdate = async (orderId: string, status: string) => {
    try {
      await ordersAPI.updateStatus(orderId, status);
      triggerNotification(`Order ${orderId} updated to ${status}.`);
      // Only reload admin data if on orders tab
      if (adminTab === "orders") {
        loadAdminData();
      }
    } catch (err) {
      triggerNotification("Failed to update status.", "error");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      return;
    }
    try {
      await ordersAPI.deleteOrder(orderId);
      triggerNotification("Order deleted successfully.");
      // Optimistic UI update - remove from local state
      setAdminOrders(prev => prev.filter(o => o.order_id !== orderId));
      // Only reload admin data if on orders tab
      if (adminTab === "orders") {
        loadAdminData();
      }
    } catch (err) {
      triggerNotification("Failed to delete order.", "error");
      // Reload orders on error to revert optimistic update
      if (adminTab === "orders") {
        loadAdminData();
      }
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!window.confirm("Delete this customer review? This cannot be undone.")) {
      return;
    }
    try {
      await reviewsAPI.delete(id);
      setAdminReviews(prev => prev.filter(r => r.id !== id));
      triggerNotification("Review deleted successfully.");
      // Only reload admin data if on reviews tab
      if (adminTab === "reviews") {
        loadAdminData();
      }
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Failed to delete review.", "error");
      // Reload reviews on error to revert optimistic update
      if (adminTab === "reviews") {
        loadAdminData();
      }
    }
  };

  const handleDeleteCustomer = async (customerId: string, customerName: string) => {
    if (!window.confirm(`Are you sure you want to delete customer "${customerName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await usersAPI.deleteUser(customerId);
      triggerNotification("Customer deleted successfully.");
      // Optimistic UI update - remove from local state
      setAdminCustomers(prev => prev.filter(c => c.id !== customerId));
      // Only reload admin data if on customers tab
      if (adminTab === "customers") {
        loadAdminData();
      }
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Failed to delete customer.", "error");
      // Reload customers on error to revert optimistic update
      if (adminTab === "customers") {
        loadAdminData();
      }
    }
  };

  const handleOrderDetailsBack = () => {
    setShowOrderThankYou(false);
    if (orderDetailsSource === "admin") {
      setView("dashboard");
      setAdminTab("orders");
    } else {
      setView("myOrders");
    }
  };

  const openOrderDetails = (orderId: string, source: "myOrders" | "admin") => {
    setSelectedOrderId(orderId);
    setOrderDetailsSource(source);
    setShowOrderThankYou(false);
    setView("orderDetails");
  };

  const handleCheckoutDecrease = async (item: (typeof cart)[0]) => {
    try {
      if (item.quantity <= 1) {
        await removeFromCart(item.id);
      } else {
        await updateCartItem(item.id, item.quantity - 1);
      }
    } catch {
      triggerNotification("Could not update quantity. Try removing the item.", "error");
    }
  };

  const handleCheckoutIncrease = async (item: (typeof cart)[0]) => {
    if (item.stock <= 0 || item.quantity >= item.stock) {
      triggerNotification("Cannot add more — item is out of stock.", "error");
      return;
    }
    try {
      await updateCartItem(item.id, item.quantity + 1);
    } catch {
      triggerNotification("Could not increase quantity.", "error");
    }
  };

  const handleCheckoutRemove = async (itemId: string) => {
    try {
      await removeFromCart(itemId);
      triggerNotification("Item removed from cart.");
    } catch {
      triggerNotification("Could not remove item.", "error");
    }
  };

  const openNewProductForm = () => {
    setProductForm({
      id: "",
      name: "",
      description: "",
      category_id: categories[0]?.id || "",
      original_price: "",
      sale_price: "",
      stock: "10",
      featured: false,
      image_urls: [],
      image_public_ids: [],
      fabric: "Kanchipuram Silk",
      occasion: "Wedding Wear",
      work_type: "Zari embroidery",
      blouse_included: true,
      length: "5.5 meters",
      care_instructions: "Dry clean only",
      color: "Deep Maroon",
      weight: "600g",
      blouse: "80cm silk blouse piece",
      variants: []
    });
    setShowProductModal(true);
  };

  return (
    <div className="min-h-screen bg-[#FDF8F2] text-[#1C0806] font-sans selection:bg-[#7D1C1C] selection:text-white flex flex-col">
      {/* Dynamic Notification Toast */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border text-sm transition-all transform animate-bounce ${
          notification.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          {notification.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span className="font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Luxury Header Strip */}
      <div className="bg-[#7D1C1C] text-white text-center text-xs py-2 px-4 font-semibold tracking-wide flex items-center justify-center gap-1.5 shadow-inner">
        <span>🚚 Free Premium Insured Shipping above ₹1,999! Celebrate this season with luxury.</span>
      </div>

      {/* Main Luxury Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-40 border-b border-[#F5EFE6]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          
          {/* Symmetrical Luxury Logo */}
          <div
            onClick={() => setView("store")}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 bg-[#7D1C1C] rounded-full flex items-center justify-center shadow-md border border-[#F5D08A]/40 transition-transform group-hover:scale-105">
              <span className="text-[#F5D08A] font-bold text-sm font-serif">SF</span>
            </div>
            <div className="leading-none hidden sm:block">
              <h1 className="text-[#7D1C1C] font-serif font-bold text-base tracking-wide uppercase">Sunithaprasad</h1>
              <p className="text-[#C4913A] text-[9px] tracking-[0.22em] uppercase font-bold mt-0.5">Fashion World</p>
            </div>
          </div>

          {/* Search Box */}
          <div className="flex-1 max-w-lg relative">
            <input
              type="text"
              placeholder="Search by silk, border style, color or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-5 pr-12 py-2.5 border border-[#E9DCC9] rounded-full text-xs bg-[#FDF8F2] focus:outline-none focus:border-[#7D1C1C] focus:ring-1 focus:ring-[#7D1C1C] transition-all sm:text-sm"
            />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7D1C1C]">
              <Search size={16} />
            </button>
          </div>

          {/* Header Action Menu */}
          <div className="flex items-center gap-3 sm:gap-5">
            {user?.role === "admin" && (
              <button
                onClick={() => setView("dashboard")}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 border border-[#7D1C1C]/30 text-[#7D1C1C] text-[11px] font-bold rounded-lg hover:bg-[#7D1C1C] hover:text-white transition-all shadow-sm"
              >
                <LayoutDashboard size={14} />
                ADMIN DASHBOARD
              </button>
            )}

             <button
              onClick={() => setView("wishlist")}
              className="flex flex-col items-center text-[#1C0806] hover:text-[#7D1C1C] transition-colors relative"
            >
              <Heart size={18} className={wishlist.length > 0 ? "fill-[#7D1C1C] text-[#7D1C1C]" : ""} />
              <span className="text-[9px] font-medium mt-0.5 hidden sm:block">Wishlist</span>
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-[#7D1C1C] text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {wishlist.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                if (!token) {
                  setAuthMode("login");
                  setAuthError("Please login to proceed to checkout.");
                  setShowAuthModal(true);
                } else {
                  setView("checkout");
                }
              }}
              className="flex flex-col items-center text-[#1C0806] hover:text-[#7D1C1C] transition-colors relative"
            >
              <ShoppingCart size={18} />
              <span className="text-[9px] font-medium mt-0.5 hidden sm:block">Cart</span>
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-[#7D1C1C] text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              )}
            </button>

            {token && user ? (
              <div className="relative">
                <button 
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex flex-col items-center text-[#1C0806] hover:text-[#7D1C1C] transition-colors"
                >
                  <User size={18} />
                  <span className="text-[9px] font-medium mt-0.5 hidden sm:block truncate max-w-[50px]">{user?.name}</span>
                </button>
                <div className={`absolute right-0 top-full mt-2 w-48 sm:w-52 bg-white border border-[#F5EFE6] rounded-xl shadow-xl py-2 transition-all duration-200 z-50 ${showProfileDropdown ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                  <div className="px-4 py-2.5 border-b border-[#F5EFE6] text-xs font-semibold text-[#7D1C1C]">
                    Hi, {user?.name}
                  </div>
                  {user?.role === "admin" && (
                    <button
                      onClick={() => { setView("dashboard"); setShowProfileDropdown(false); }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-[#FDF8F2] flex items-center gap-2"
                    >
                      <LayoutDashboard size={13} /> Admin Panel
                    </button>
                  )}
                  <button
                    onClick={() => { setView("profile"); setShowProfileDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-[#FDF8F2] flex items-center gap-2"
                  >
                    <User size={13} /> My Profile
                  </button>
                  <button
                    onClick={() => { setView("myOrders"); setShowProfileDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-[#FDF8F2] flex items-center gap-2"
                  >
                    <Package size={13} /> My Orders
                  </button>
                  <button
                    onClick={() => { setView("wishlist"); setShowProfileDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-[#FDF8F2] flex items-center gap-2"
                  >
                    <Heart size={13} /> My Wishlist
                  </button>
                  <button
                    onClick={() => { logout(); setView("store"); triggerNotification("Logged out successfully."); setShowProfileDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2 border-t border-[#F5EFE6] mt-1 pt-2"
                  >
                    <LogOut size={13} /> Logout
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowAuthModal(true); setAuthMode("login"); setAuthError(""); }}
                className="flex flex-col items-center text-[#1C0806] hover:text-[#7D1C1C] transition-colors"
              >
                <User size={20} />
                <span className="text-[10px] font-medium mt-0.5 hidden sm:block">Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        <nav className="border-t border-[#F5EFE6] bg-[#FCFAF7] hidden sm:block">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => { setSelectedCategory(null); setView("store"); }}
              className={`py-3 px-4 text-xs font-bold tracking-wider transition-colors border-b-2 ${
                !selectedCategory ? "border-[#7D1C1C] text-[#7D1C1C]" : "border-transparent text-[#7A5F50] hover:text-[#7D1C1C]"
              }`}
            >
              ALL COLLECTIONS
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setView("store"); }}
                className={`py-3 px-4 text-xs font-bold tracking-wider transition-colors border-b-2 ${
                  selectedCategory === cat.id ? "border-[#7D1C1C] text-[#7D1C1C]" : "border-transparent text-[#7A5F50] hover:text-[#7D1C1C]"
                }`}
              >
                {cat.name.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* ─── View Routing ───────────────────────────────────────────────────────── */}
      <main className="flex-grow">
        
        {/* ─── VIEW: Storefront ─── */}
        {view === "store" && (
          <div>
            {/* Hero Banner — mobile uses separate crop/gradient; desktop unchanged */}
            <div className="relative h-[240px] sm:h-[280px] md:h-[380px] lg:h-[450px] bg-[#1C0806] overflow-hidden shadow-md">
              <img
                src="/saree_hero_banner.jpeg"
                alt="Elegance in Every Drape"
                className="absolute inset-0 w-full h-full object-cover object-center md:object-top opacity-100"
              />
              <div className="absolute inset-0 md:hidden bg-gradient-to-t from-[#1C0806]/90 via-[#1C0806]/40 to-transparent" />
              <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-black/65 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex items-end pb-5 sm:pb-6 md:items-center md:pb-0">
                  <div className="max-w-7xl mx-auto px-4 md:px-6 w-full">
                    <div className="max-w-xl text-white max-md:max-w-[85%]">
                      <h2 className="font-serif text-2xl md:text-6xl font-bold leading-[1.15] mb-2 md:mb-3 tracking-wide text-[#F5D08A] drop-shadow-sm">
                        ELEGANCE IN EVERY DRAPE
                      </h2>
                      <p className="text-xs md:text-base font-normal leading-relaxed mb-3 md:mb-5 text-gray-200 line-clamp-2 md:line-clamp-none max-md:text-[11px] max-md:leading-snug">
                        Discover our exclusive collection of premium sarees for every occasion.
                      </p>
                      <button
                        onClick={() => setView("collections")}
                        className="bg-[#C4913A] hover:bg-[#B28231] text-white px-5 py-2 md:px-8 md:py-3.5 text-[10px] md:text-xs font-bold tracking-widest uppercase transition-all shadow-lg rounded-sm border border-[#F5D08A]/35"
                      >
                        SHOP NOW
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            {/* Sub-features bar */}
            <div className="bg-[#7D1C1C] text-white py-1.5 md:py-3 shadow-sm border-t border-b border-[#F5D08A]/20">
              <div className="max-w-7xl mx-auto px-2 md:px-4 flex items-center justify-center gap-3 sm:gap-6 md:gap-10 text-[8px] sm:text-[9px] md:text-sm font-bold tracking-wide md:tracking-wider uppercase text-center">
                <span className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
                  🏅 PREMIUM QUALITY
                </span>

                <span className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
                  🔒 SECURE PAYMENTS
                </span>

                <span className="flex items-center gap-1 md:gap-2 text-[#F5D08A] whitespace-nowrap">
                  📦 DAMAGE EXCHANGE ONLY
                </span>
              </div>
            </div>

            {/* Shop by Category circles */}
            <section className="py-12 bg-white">
              <div className="max-w-7xl mx-auto px-4">
                <div className="text-center mb-8">
                  <p className="text-[#C4913A] text-[10px] font-bold tracking-[0.25em] uppercase mb-1">Traditional Weaves</p>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-[#1C0806]">SHOP BY MASTERPIECE</h3>
                  <div className="w-12 h-0.5 bg-[#C4913A] mx-auto mt-3" />
                </div>
                <div className="flex gap-6 md:gap-10 overflow-x-auto pb-4 justify-start md:justify-center scrollbar-thin scrollbar-thumb-gray-200">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => { setSelectedCategory(cat.id); setView("store"); }}
                      className="flex-shrink-0 flex flex-col items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-[#E9DCC9] group-hover:border-[#7D1C1C] transition-all shadow-sm">
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <span className="text-xs font-bold text-[#1C0806] group-hover:text-[#7D1C1C] transition-colors uppercase tracking-wider">
                        {cat.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Products grid */}
            <section id="luxury-collection" className="py-12 max-w-7xl mx-auto px-4 scroll-mt-24">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-[#1C0806]">
                    {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name.toUpperCase() : "THE LUXURY COLLECTION"}
                  </h3>
                  <p className="text-xs text-[#7A5F50] mt-1.5">Intricately detailed works woven for your biggest moments.</p>
                </div>
                
                {/* Sort tools */}
                <div className="flex items-center gap-3 self-start md:self-auto text-xs">
                  <span className="text-[#7A5F50] font-semibold">SORT:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border border-[#E9DCC9] rounded-md px-3 py-1.5 bg-white text-xs font-semibold focus:outline-none focus:border-[#7D1C1C]"
                  >
                    <option value="newest">New Arrivals</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {/* Collapsible Filter Panel Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-[#F5EFE6]">
                <button
                  onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                  className="flex items-center gap-2 text-xs font-bold text-[#7D1C1C] border border-[#7D1C1C]/30 px-4 py-2 rounded-lg hover:bg-[#7D1C1C]/5 transition-colors"
                >
                  {showFiltersPanel ? "Hide Filters" : "Show Filters & Designs"}
                  <Settings size={14} className={showFiltersPanel ? "rotate-90 transition-transform" : "transition-transform"} />
                </button>
                
                {/* Active Filter Indicators */}
                <div className="flex flex-wrap gap-2 items-center">
                  {(filterPrice || filterFabric || filterOccasion || filterWorkType) && (
                    <button
                      onClick={() => {
                        setFilterPrice("");
                        setFilterFabric("");
                        setFilterOccasion("");
                        setFilterWorkType("");
                      }}
                      className="text-[10px] bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded font-bold uppercase hover:bg-rose-100 transition-colors"
                    >
                      Clear All Filters ✕
                    </button>
                  )}
                  {filterPrice && (
                    <span className="text-[10px] bg-[#FCFAF7] border border-[#E9DCC9] px-2.5 py-1 rounded text-[#7A5F50] font-semibold">
                      Price: {filterPrice.replace("_", " to ").replace("under", "Under").replace("above", "Above")}
                    </span>
                  )}
                  {filterFabric && (
                    <span className="text-[10px] bg-[#FCFAF7] border border-[#E9DCC9] px-2.5 py-1 rounded text-[#7A5F50] font-semibold">
                      Fabric: {filterFabric}
                    </span>
                  )}
                  {filterOccasion && (
                    <span className="text-[10px] bg-[#FCFAF7] border border-[#E9DCC9] px-2.5 py-1 rounded text-[#7A5F50] font-semibold">
                      Occasion: {filterOccasion}
                    </span>
                  )}
                  {filterWorkType && (
                    <span className="text-[10px] bg-[#FCFAF7] border border-[#E9DCC9] px-2.5 py-1 rounded text-[#7A5F50] font-semibold">
                      Work: {filterWorkType}
                    </span>
                  )}
                </div>
              </div>

              {/* Expandable filters dropdown block */}
              {showFiltersPanel && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-[#FCFAF7] border border-[#E9DCC9] rounded-2xl mb-8 animate-fadeIn text-xs">
                  {/* Price Filter */}
                  <div>
                    <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-2">Price Range</label>
                    <select
                      value={filterPrice}
                      onChange={(e) => setFilterPrice(e.target.value)}
                      className="w-full border border-[#E9DCC9] rounded px-2.5 py-2 bg-white focus:outline-none focus:border-[#7D1C1C]"
                    >
                      <option value="">All Prices</option>
                      <option value="under_2000">Under ₹2,000</option>
                      <option value="2000_5000">₹2,000 - ₹5,000</option>
                      <option value="5000_10000">₹5,000 - ₹10,000</option>
                      <option value="above_10000">Above ₹10,000</option>
                    </select>
                  </div>

                  {/* Fabric Filter */}
                  <div>
                    <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-2">Fabric / Design</label>
                    <select
                      value={filterFabric}
                      onChange={(e) => setFilterFabric(e.target.value)}
                      className="w-full border border-[#E9DCC9] rounded px-2.5 py-2 bg-white focus:outline-none focus:border-[#7D1C1C]"
                    >
                      <option value="">All Fabrics</option>
                      {fabricOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {/* Occasion Filter */}
                  <div>
                    <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-2">Occasion</label>
                    <select
                      value={filterOccasion}
                      onChange={(e) => setFilterOccasion(e.target.value)}
                      className="w-full border border-[#E9DCC9] rounded px-2.5 py-2 bg-white focus:outline-none focus:border-[#7D1C1C]"
                    >
                      <option value="">All Occasions</option>
                      {occasionOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  {/* Work Type Filter */}
                  <div>
                    <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-2">Work Type</label>
                    <select
                      value={filterWorkType}
                      onChange={(e) => setFilterWorkType(e.target.value)}
                      className="w-full border border-[#E9DCC9] rounded px-2.5 py-2 bg-white focus:outline-none focus:border-[#7D1C1C]"
                    >
                      <option value="">All Work Types</option>
                      {["Zari Work", "Embroidery", "Printed", "Handloom", "Zardosi"].map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {productsLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <div className="w-10 h-10 border-4 border-[#7D1C1C]/30 border-t-[#7D1C1C] rounded-full animate-spin" />
                  <span className="text-xs font-bold text-[#7A5F50] tracking-wider uppercase">Loading Saree Catalogs...</span>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-[#F5EFE6]">
                  {selectedCategory ? (
                    <>
                      <Package size={48} className="mx-auto text-[#7A5F50]/40 mb-3" />
                      <p className="text-sm font-semibold text-[#7A5F50] mb-2">Collections Coming Soon</p>
                      <p className="text-xs text-[#7A5F50]/80 mb-4">We're curating beautiful sarees for this category.</p>
                      <button
                        onClick={() => { setSelectedCategory(null); setView("store"); }}
                        className="bg-[#7D1C1C] hover:bg-[#631414] text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors"
                      >
                        Browse Other Categories
                      </button>
                    </>
                  ) : (
                    <>
                      <Package size={48} className="mx-auto text-[#7A5F50]/40 mb-3" />
                      <p className="text-sm font-semibold text-[#7A5F50]">No products found matching the criteria.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                  {products.map((prod) => (
                    <div
                      key={prod.id}
                      className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-[#F5EFE6] group flex flex-col justify-between"
                    >
                      <div
                        onClick={() => { setSelectedProductId(prod.id); setView("product"); }}
                        className="relative overflow-hidden cursor-pointer aspect-[3/4] bg-[#F5ECD7]"
                      >
                        <img
                          src={prod.image_urls[0]}
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                        />
                        {prod.featured && (
                          <span className="absolute top-2 left-2 bg-[#C4913A] text-white text-[9px] font-bold px-2 py-0.5 rounded shadow">
                            FEATURED
                          </span>
                        )}
                        {prod.stock === 0 && (
                          <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold tracking-wider">
                            OUT OF STOCK
                          </span>
                        )}
                      </div>

                      <div className="p-3 sm:p-4 flex-grow flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] text-[#C4913A] font-bold uppercase tracking-wider">{prod.category_name}</span>
                            {prod.review_count > 0 && prod.rating ? (
                              <div className="flex items-center gap-1 text-[10px] text-[#C4913A] font-bold">
                                <Star size={10} className="fill-[#C4913A]" />
                                <span>{parseFloat(prod.rating).toFixed(1)}</span>
                              </div>
                            ) : null}
                          </div>
                          <h4
                            onClick={() => { setSelectedProductId(prod.id); setView("product"); }}
                            className="font-semibold text-xs md:text-sm text-[#1C0806] hover:text-[#7D1C1C] cursor-pointer line-clamp-1 transition-colors"
                          >
                            {prod.name}
                          </h4>
                          <p className="text-[11px] text-[#7A5F50] line-clamp-1 mt-1">{prod.fabric} | {prod.work_type}</p>
                        </div>

                        <div className="mt-4">
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-[#7D1C1C] font-bold text-sm md:text-base">₹{parseFloat(prod.sale_price).toLocaleString("en-IN")}</span>
                            {prod.original_price && (
                              <span className="text-[11px] text-[#7A5F50] line-through">₹{parseFloat(prod.original_price).toLocaleString("en-IN")}</span>
                            )}
                          </div>
                          
                          <div className="flex items-stretch gap-2 w-full">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (prod.stock === 0) return;
                                addToCart(prod.id, undefined, 1);
                                triggerNotification("Added to Cart!");
                              }}
                              disabled={prod.stock === 0}
                              className="flex-1 min-w-0 bg-[#7D1C1C] hover:bg-[#631414] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-[9px] min-[360px]:text-[10px] sm:text-xs md:text-sm lg:text-base font-bold px-1.5 min-[360px]:px-2 sm:px-4 h-11 md:h-12 lg:h-14 rounded-lg uppercase tracking-tight sm:tracking-wide transition-all flex items-center justify-center leading-none text-center"
                            >
                              ADD TO CART
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await toggleWishlist(prod.id);
                                triggerNotification(isInWishlist(prod.id) ? "Removed from Wishlist" : "Saved to Wishlist!");
                              }}
                              className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 border border-[#E9DCC9] rounded-lg flex items-center justify-center hover:bg-rose-50 transition-colors"
                            >
                              <Heart size={16} className={isInWishlist(prod.id) ? "fill-[#7D1C1C] text-[#7D1C1C]" : "text-[#7A5F50]"} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* New Collection — Instagram */}
            <section className="py-10 md:py-12 bg-white">
              <div className="max-w-7xl mx-auto px-4">
                <div className="max-w-lg mx-auto bg-[#FCFAF7] rounded-3xl border border-[#E9DCC9] shadow-sm px-6 py-10 md:px-10 md:py-12 text-center">
                  <p className="inline-flex items-center justify-center gap-2 text-[#C4913A] text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
                    <Instagram size={14} strokeWidth={2.5} />
                    @sunithaprasad_official
                  </p>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-[#1C0806] mb-3">New Collection</h3>
                  <p className="text-xs md:text-sm text-[#7A5F50] leading-relaxed mb-7 max-w-sm mx-auto">
                    Explore our newest saree collections, exclusive launches, and styling reels on Instagram.
                  </p>
                  <div className="flex flex-col gap-3 max-w-xs mx-auto">
                    <a
                      href={INSTAGRAM_PROFILE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-[#7D1C1C] hover:bg-[#631414] text-white text-xs font-bold px-6 py-3.5 rounded-full transition-colors shadow-sm"
                    >
                      <Instagram size={16} />
                      Follow on Instagram
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(null);
                        setSortBy("newest");
                        document.getElementById("luxury-collection")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="inline-flex items-center justify-center bg-white hover:bg-[#FDF8F2] text-[#7D1C1C] border border-[#E9DCC9] text-xs font-bold px-6 py-3.5 rounded-full transition-colors"
                    >
                      Shop New Arrivals
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ─── VIEW: Collections List page ─── */}
        {view === "collections" && (
          <div className="max-w-7xl mx-auto px-4 py-12">
            <h2 className="font-serif text-3xl font-bold text-center text-[#7D1C1C] mb-3">CURATED MASTERPIECES</h2>
            <p className="text-center text-xs text-[#7A5F50] max-w-lg mx-auto mb-10">Hand-selected fabrics woven directly by master craftsmen across India.</p>
            <div className="grid md:grid-cols-3 gap-8">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setView("store"); }}
                  className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-md"
                  style={{ height: "380px" }}
                >
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700" style={{ objectPosition: "center top" }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute bottom-6 left-6 text-white">
                    <h4 className="font-serif text-xl font-bold tracking-wide uppercase">{cat.name} Collection</h4>
                    <span className="text-[10px] text-[#F5D08A] font-bold uppercase tracking-widest mt-1 block group-hover:underline">VIEW MASTERPIECES →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── VIEW: Product Detail Page ─── */}
        {view === "product" && activeProduct && (
          <div className="max-w-7xl mx-auto px-4 sm:px-4 py-4 md:py-8 overflow-x-hidden">
            <button
              onClick={() => setView("store")}
              className="flex items-center gap-1.5 text-xs font-bold text-[#7D1C1C] hover:underline mb-4 md:mb-6"
            >
              <ArrowLeft size={14} /> BACK TO STOREFRONT
            </button>

            <div className="grid md:grid-cols-2 gap-4 md:gap-6 lg:gap-12">
              {/* Product Media Gallery */}
              <div className="space-y-3 w-full min-w-0">
                {/* Main large image */}
                <div className="rounded-2xl overflow-hidden border border-[#F5EFE6] bg-white aspect-[3/4] md:aspect-[3/4] h-[52vh] md:h-auto relative group">
                  <img
                    src={selectedThumbnailImg || (selectedVariant ? (selectedVariant.image_urls?.[0] || activeProduct.image_urls[0]) : activeProduct.image_urls[0])}
                    alt={activeProduct.name}
                    className="w-full h-full object-cover object-center md:object-top transition-all duration-300"
                  />
                  {/* Zoom hint */}
                  <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[9px] px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity font-bold tracking-wider">
                    {activeProduct.image_urls.indexOf(selectedThumbnailImg) + 1} / {activeProduct.image_urls.length}
                  </div>
                </div>
                {/* Thumbnails — click to change main image */}
                {activeProduct.image_urls.length > 1 && (
                  <div className="w-full overflow-x-auto pb-2 -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
                    <div className="flex gap-2 w-max">
                      {activeProduct.image_urls.map((img: string, i: number) => {
                        const isActive = selectedThumbnailImg === img;
                        return (
                          <div
                            key={i}
                            onClick={() => setSelectedThumbnailImg(img)}
                            className={`flex-shrink-0 w-14 h-14 sm:w-20 sm:h-24 rounded-lg overflow-hidden border-2 cursor-pointer transition-all duration-200 ${
                              isActive
                                ? "border-[#7D1C1C] shadow-md scale-[1.04]"
                                : "border-[#E9DCC9] hover:border-[#C4913A] opacity-70 hover:opacity-100"
                            }`}
                          >
                            <img src={img} alt={`View ${i + 1}`} className="w-full h-full object-cover object-center" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Product Purchase & Meta panel */}
              <div className="space-y-4 md:space-y-6">
                <div>
                  <span className="text-[10px] bg-[#7D1C1C]/10 text-[#7D1C1C] px-2.5 py-1 rounded font-bold uppercase tracking-widest">
                    {activeProduct.category_name}
                  </span>
                  <h2 className="font-serif text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mt-3 text-[#1C0806] leading-tight">{activeProduct.name}</h2>
                  
                  {/* Reviews Star summary */}
                  <div className="flex items-center gap-2 mt-2">
                    {activeProduct.reviewCount > 0 ? (
                      <>
                        <div className="flex text-[#C4913A]">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={13}
                              className={i < Math.floor(activeProduct.rating || 0) ? "fill-[#C4913A]" : "text-gray-300"}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-[#7A5F50] font-semibold">{activeProduct.rating?.toFixed(1) || 0} ({activeProduct.reviewCount} review{activeProduct.reviewCount !== 1 ? 's' : ''})</span>
                      </>
                    ) : (
                      <span className="text-xs text-[#7A5F50] font-semibold italic">No reviews yet</span>
                    )}
                  </div>
                </div>

                <div className="border-t border-b border-[#F5EFE6] py-4 flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-[#7D1C1C]">
                    ₹{parseFloat(selectedVariant?.sale_price ?? activeProduct.sale_price).toLocaleString("en-IN")}
                  </span>
                  {(selectedVariant?.original_price ?? activeProduct.original_price) && (
                    <span className="text-sm line-through text-[#7A5F50]">
                      ₹{parseFloat(selectedVariant?.original_price ?? activeProduct.original_price).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>

                {/* Saree attributes metadata */}
                <div>
                  <h4 className="text-xs font-bold text-[#1C0806] uppercase tracking-wider mb-2">Heritage Details</h4>
                  <div className="grid grid-cols-2 gap-2 md:gap-3 text-xs bg-white p-3 md:p-4 rounded-xl border border-[#F5EFE6]">
                    <div><span className="text-[#7A5F50]">Fabric:</span> <strong className="text-[#1C0806]">{activeProduct.fabric || "Pure Silk"}</strong></div>
                    <div><span className="text-[#7A5F50]">Occasion:</span> <strong className="text-[#1C0806]">{activeProduct.occasion || "Bridal"}</strong></div>
                    <div><span className="text-[#7A5F50]">Work Type:</span> <strong className="text-[#1C0806]">{activeProduct.work_type || "Traditional Zari"}</strong></div>
                    <div><span className="text-[#7A5F50]">Blouse Included:</span> <strong className="text-[#1C0806]">{activeProduct.blouse_included ? "Yes" : "No"}</strong></div>
                    <div><span className="text-[#7A5F50]">Saree Length:</span> <strong className="text-[#1C0806]">{activeProduct.length || "5.5 Meters"}</strong></div>
                    <div><span className="text-[#7A5F50]">Product Weight:</span> <strong className="text-[#1C0806]">{activeProduct.weight || "550g"}</strong></div>
                  </div>
                </div>

                {/* Variant Color Selector */}
                {activeProduct.variants && activeProduct.variants.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-[#1C0806] uppercase tracking-wider mb-2">Select Color</h4>
                    <div className="flex flex-wrap gap-2">
                      {activeProduct.variants.map((v: any) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariant(v)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border shrink-0 ${
                            selectedVariant?.id === v.id
                              ? "border-[#7D1C1C] bg-[#7D1C1C] text-white"
                              : "border-[#E9DCC9] bg-white text-[#7A5F50]"
                          }`}
                        >
                          {v.color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stock Checker */}
                <div className="text-[11px] sm:text-xs">
                  {selectedVariant ? (
                    selectedVariant.stock > 0 ? (
                      <span className="text-emerald-700 font-bold">✓ In stock ({selectedVariant.color} variant - {selectedVariant.stock} available)</span>
                    ) : (
                      <span className="text-rose-700 font-bold">✗ Selected Color Out of Stock</span>
                    )
                  ) : activeProduct.stock > 0 ? (
                    <span className="text-emerald-700 font-bold">✓ In stock ({activeProduct.stock} available)</span>
                  ) : (
                    <span className="text-rose-700 font-bold">✗ Currently Out of Stock</span>
                  )}
                </div>

                {/* Purchase Triggers */}
                <div className="flex items-stretch gap-2 sm:gap-3 md:gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      const stockAvailable = selectedVariant ? selectedVariant.stock : activeProduct.stock;
                      if (stockAvailable === 0) {
                        triggerNotification("Selected variant is out of stock.", "error");
                        return;
                      }
                      addToCart(activeProduct.id, selectedVariant?.id, 1);
                      triggerNotification("Added to Cart!");
                    }}
                    disabled={selectedVariant ? selectedVariant.stock === 0 : activeProduct.stock === 0}
                    className="flex-1 min-w-0 bg-[#7D1C1C] hover:bg-[#631414] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs sm:text-sm md:text-base lg:text-lg py-3 sm:py-4 md:py-5 min-h-[44px] sm:min-h-[48px] md:min-h-[60px] rounded-xl font-bold tracking-wider uppercase transition-all shadow-md flex items-center justify-center"
                  >
                    ADD TO MY CART
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await toggleWishlist(activeProduct.id);
                      triggerNotification(isInWishlist(activeProduct.id) ? "Removed from Wishlist" : "Saved to Wishlist!");
                    }}
                    className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 border border-[#E9DCC9] rounded-xl flex items-center justify-center hover:bg-rose-50 transition-colors"
                  >
                    <Heart size={18} className={isInWishlist(activeProduct.id) ? "fill-[#7D1C1C] text-[#7D1C1C]" : "text-[#7A5F50]"} />
                  </button>
                </div>

                {/* Saree Description */}
                <div className="border-t border-[#F5EFE6] pt-4 md:pt-5">
                  <h4 className="text-xs font-bold text-[#1C0806] uppercase tracking-wider mb-2 md:mb-2.5">Woven Description</h4>
                  <p className="text-xs text-[#7A5F50] leading-relaxed">{activeProduct.description}</p>
                </div>

                {/* Care & Dry Clean */}
                <div className="bg-[#FCFAF7] p-3 rounded-lg border border-[#F5EFE6] text-[10px] sm:text-[11px] text-[#7A5F50]">
                  💡 <strong>Care Instructions:</strong> {activeProduct.care_instructions || "Dry clean is recommended. Protect zari work from direct humidity."}
                </div>

                {/* Return & Exchange Policy Alert */}
                <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100 text-[10px] sm:text-[11px] text-rose-800 space-y-1">
                  ⚠️ <strong>Return & Exchange Policy:</strong>
                  <p className="leading-relaxed">No returns are accepted. Exchanges are only allowed for damaged products. To claim an exchange, an uncut box opening video proof must be sent to our WhatsApp number <strong>6281120225</strong> with your order details.</p>
                </div>
              </div>
            </div>

            {/* Saree Reviews Section */}
            <div className="mt-16 grid md:grid-cols-3 gap-8 border-t border-[#F5EFE6] pt-12">
              <div className="md:col-span-1 space-y-4">
                <h4 className="font-serif text-xl font-bold">Customer Ratings</h4>
                <div className="bg-[#FCFAF7] p-5 rounded-2xl border border-[#F5EFE6] text-center">
                  <span className="text-4xl font-bold text-[#7D1C1C]">{parseFloat(activeProduct.rating).toFixed(1)}</span>
                  <p className="text-xs text-[#7A5F50] mt-1 font-semibold">Out of 5 Stars</p>
                  <div className="flex justify-center text-[#C4913A] mt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={15}
                        className={i < Math.floor(activeProduct.rating) ? "fill-[#C4913A]" : "text-gray-300"}
                      />
                    ))}
                  </div>
                </div>

                {/* Write Review Form */}
                <form onSubmit={handleReviewSubmit} className="space-y-3 pt-4">
                  <h5 className="text-xs font-bold uppercase tracking-wider">Leave a Review</h5>
                  <div>
                    <label className="block text-[11px] text-[#7A5F50] mb-1 font-semibold">RATING:</label>
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="w-full text-xs border border-[#E9DCC9] rounded p-2 bg-white"
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (Excellent)</option>
                      <option value={4}>⭐⭐⭐⭐ (Very Good)</option>
                      <option value={3}>⭐⭐⭐ (Average)</option>
                      <option value={2}>⭐⭐ (Fair)</option>
                      <option value={1}>⭐ (Poor)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#7A5F50] mb-1 font-semibold">COMMENTS:</label>
                    <textarea
                      rows={3}
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Write your experience with the weave texture, color, and border work..."
                      className="w-full text-xs border border-[#E9DCC9] rounded p-2.5 bg-white focus:outline-none focus:border-[#7D1C1C]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="w-full bg-[#7D1C1C] hover:bg-[#631414] text-white text-[11px] py-2 rounded font-bold uppercase tracking-wider transition-colors"
                  >
                    SUBMIT REVIEW
                  </button>
                </form>
              </div>

              {/* Reviews Listing */}
              <div className="md:col-span-2 space-y-4">
                <h4 className="font-serif text-xl font-bold">Buyer Reviews</h4>
                {activeProductReviews.length === 0 ? (
                  <p className="text-xs text-[#7A5F50] italic">No reviews yet. Be the first to share your purchase experience.</p>
                ) : (
                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                    {activeProductReviews.map((rev: any) => (
                      <div key={rev.id} className="bg-white p-4 rounded-xl border border-[#F5EFE6] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <strong className="text-[#1C0806]">{rev.user_name}</strong>
                          <span className="text-[10px] text-[#7A5F50]">
                            {new Date(rev.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex text-[#C4913A]">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={10}
                              className={i < rev.rating ? "fill-[#C4913A]" : "text-gray-200"}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-[#7A5F50] leading-relaxed">{rev.review}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── VIEW: User Wishlist ─── */}
        {view === "wishlist" && (
          <div className="max-w-7xl mx-auto px-4 py-12">
            <h2 className="font-serif text-3xl font-bold text-center text-[#7D1C1C] mb-8">MY SAVED SAREES</h2>
            {wishlistItems.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-[#F5EFE6]">
                <Heart size={44} className="mx-auto text-[#7A5F50]/30 mb-3" />
                <p className="text-sm font-semibold text-[#7A5F50] mb-4">Your wishlist is empty.</p>
                <button
                  onClick={() => setView("store")}
                  className="bg-[#7D1C1C] text-white text-xs font-bold px-6 py-2.5 rounded-lg"
                >
                  BROWSE SAREES
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {wishlistItems.map((item) => (
                  <div key={item.id} className="bg-white border border-[#F5EFE6] rounded-xl overflow-hidden shadow-sm flex flex-col justify-between group">
                    <div
                      onClick={() => { setSelectedProductId(item.product_id); setView("product"); }}
                      className="relative overflow-hidden cursor-pointer aspect-[3/4] bg-[#F5ECD7]"
                    >
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-3.5 space-y-3">
                      <h4
                        onClick={() => { setSelectedProductId(item.product_id); setView("product"); }}
                        className="font-semibold text-xs text-[#1C0806] hover:text-[#7D1C1C] cursor-pointer line-clamp-1 transition-colors"
                      >
                        {item.product_name}
                      </h4>
                      <p className="text-[#7D1C1C] font-bold text-xs">₹{item.sale_price.toLocaleString("en-IN")}</p>
                      <div className="flex items-stretch gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            addToCart(item.product_id, undefined, 1);
                            triggerNotification("Added to Cart!");
                          }}
                          className="flex-1 min-w-0 bg-[#7D1C1C] hover:bg-[#631414] text-white text-[11px] sm:text-xs md:text-sm font-bold h-11 md:h-12 rounded-lg uppercase tracking-wide flex items-center justify-center"
                        >
                          ADD TO CART
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleWishlist(item.product_id)}
                          className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 px-2 border border-[#E9DCC9] rounded-lg text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── VIEW: Cart Drawer / Checkout Page ─── */}
        {view === "checkout" && (
          <div className="max-w-7xl mx-auto px-4 py-12">
            <h2 className="font-serif text-3xl font-bold text-center text-[#7D1C1C] mb-8">SECURE CHECKOUT</h2>

            {cart.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-[#F5EFE6]">
                <ShoppingCart size={44} className="mx-auto text-[#7A5F50]/30 mb-3" />
                <p className="text-sm font-semibold text-[#7A5F50] mb-4">Your Shopping Cart is empty.</p>
                <button onClick={() => setView("store")} className="bg-[#7D1C1C] text-white text-xs font-bold px-6 py-2.5 rounded-lg">
                  SHOP SAREES
                </button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-8">
                
                {/* Cart Items List & Address Book */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Cart Items List */}
                  <div className="bg-white p-6 rounded-2xl border border-[#F5EFE6] shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#7D1C1C] mb-4 flex items-center gap-2">
                      <ShoppingCart size={16} /> 1. REVIEW YOUR DRAPES
                    </h3>
                    <div className="divide-y divide-[#F5EFE6]">
                      {cart.map((item) => (
                        <div key={item.id} className="py-4 flex gap-4 first:pt-0 last:pb-0">
                          <img src={item.product_image} alt={item.product_name} className="w-16 h-20 object-cover rounded-lg border border-[#E9DCC9]" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-semibold text-xs md:text-sm text-[#1C0806] truncate">{item.product_name}</h4>
                                {item.variant_color && (
                                  <p className="text-[10px] text-[#7A5F50] mt-0.5">Color: {item.variant_color}</p>
                                )}
                                {item.stock <= 0 && (
                                  <p className="text-[10px] font-bold text-rose-600 mt-0.5 uppercase">Out of stock</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="font-bold text-xs text-[#7D1C1C] block">₹{(item.sale_price * item.quantity).toLocaleString("en-IN")}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCheckoutRemove(item.id)}
                                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline mt-1 uppercase tracking-wide"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center mt-3">
                              <div className="flex items-center border border-[#E9DCC9] rounded overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => handleCheckoutDecrease(item)}
                                  className="px-2.5 py-1 hover:bg-[#FDF8F2] text-xs font-bold text-[#1C0806]"
                                  aria-label="Decrease quantity"
                                >
                                  −
                                </button>
                                <span className="px-3 py-1 text-xs bg-[#FCFAF7] font-semibold min-w-[2rem] text-center">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCheckoutIncrease(item)}
                                  disabled={item.stock <= 0 || item.quantity >= item.stock}
                                  className="px-2.5 py-1 hover:bg-[#FDF8F2] text-xs font-bold text-[#1C0806] disabled:opacity-40 disabled:cursor-not-allowed"
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping Address Selection */}
                  <div className="bg-white p-6 rounded-2xl border border-[#F5EFE6] shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#7D1C1C] flex items-center gap-2 mb-4">
                      <MapPin size={16} /> 2. DELIVERY & CUSTOMER DETAILS
                    </h3>

                    {/* Saved Addresses List (only for logged-in users who have addresses) */}
                    {token && addresses.length > 0 && (
                      <div className="mb-6 pb-6 border-b border-[#F5EFE6]">
                        <span className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-2">Autofill from Saved Addresses:</span>
                        <div className="flex flex-wrap gap-2">
                          {addresses.map((addr) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => {
                                setNewAddress({
                                  name: addr.name || "",
                                  email: user?.email || "",
                                  mobile: addr.mobile || "",
                                  address: addr.address || "",
                                  city: addr.city || "",
                                  state: addr.state || "",
                                  pincode: addr.pincode || "",
                                  is_default: addr.is_default || false
                                });
                                triggerNotification("Shipping details auto-filled.");
                              }}
                              className="text-[11px] border border-[#E9DCC9] hover:border-[#7D1C1C] rounded-lg p-2.5 text-left bg-[#FCFAF7] hover:bg-[#FDF8F2] transition-all max-w-[200px]"
                            >
                              <strong className="block text-[#1C0806] truncate">{addr.name}</strong>
                              <span className="block text-[#7A5F50] truncate text-[10px] mt-0.5">{addr.address}, {addr.city}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Direct input fields */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-1">Receiver Name:</label>
                          <input
                            type="text"
                            required
                            value={newAddress.name}
                            onChange={(e) => setNewAddress(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full text-xs border border-[#E9DCC9] rounded p-2 focus:outline-none focus:border-[#7D1C1C]"
                            placeholder="e.g. Lakshmi Devi"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-1">Mobile Number:</label>
                          <input
                            type="text"
                            required
                            value={newAddress.mobile}
                            onChange={(e) => setNewAddress(prev => ({ ...prev, mobile: e.target.value }))}
                            className="w-full text-xs border border-[#E9DCC9] rounded p-2 focus:outline-none focus:border-[#7D1C1C]"
                            placeholder="10-digit mobile number"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-1">Email Address:</label>
                          <input
                            type="email"
                            required
                            value={newAddress.email}
                            onChange={(e) => setNewAddress(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full text-xs border border-[#E9DCC9] rounded p-2 focus:outline-none focus:border-[#7D1C1C]"
                            placeholder="name@example.com (for invoices & alerts)"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-1">Pincode:</label>
                          <input
                            type="text"
                            required
                            value={newAddress.pincode}
                            onChange={(e) => setNewAddress(prev => ({ ...prev, pincode: e.target.value }))}
                            className="w-full text-xs border border-[#E9DCC9] rounded p-2 focus:outline-none focus:border-[#7D1C1C]"
                            placeholder="6-digit PIN code"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-1">Full Shipping Street Address:</label>
                        <textarea
                          required
                          value={newAddress.address}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full text-xs border border-[#E9DCC9] rounded p-2 focus:outline-none focus:border-[#7D1C1C]"
                          placeholder="Flat/House number, Floor, Street, Colony..."
                          rows={2.5}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-1">City:</label>
                          <input
                            type="text"
                            required
                            value={newAddress.city}
                            onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                            className="w-full text-xs border border-[#E9DCC9] rounded p-2 focus:outline-none focus:border-[#7D1C1C]"
                            placeholder="e.g. Hyderabad"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#7A5F50] font-bold uppercase mb-1">State:</label>
                          <input
                            type="text"
                            required
                            value={newAddress.state}
                            onChange={(e) => setNewAddress(prev => ({ ...prev, state: e.target.value }))}
                            className="w-full text-xs border border-[#E9DCC9] rounded p-2 focus:outline-none focus:border-[#7D1C1C]"
                            placeholder="e.g. Telangana"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Tax Invoice Summary */}
                <div className="lg:col-span-1">
                  <div className="bg-white p-6 rounded-2xl border border-[#F5EFE6] shadow-sm sticky top-24 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C] mb-4 flex items-center gap-1.5">
                      <CreditCard size={15} /> PAYMENT SUMMARY
                    </h3>
                    
                    {(() => {
                      const { subtotal, deliveryCharge, weekendDiscount, gatewayCharge, finalTotal } = getCheckoutSummary(cartTotal);

                      return (
                        <div className="space-y-3 text-xs text-[#7A5F50]">
                          <div className="flex justify-between">
                            <span>Saree Items Subtotal</span>
                            <span className="font-semibold text-[#1C0806]">₹{subtotal.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Delivery Charges</span>
                            <span className="font-semibold text-[#1C0806]">₹{deliveryCharge.toLocaleString("en-IN")}</span>
                          </div>
                          {weekendDiscount > 0 && (
                            <div className="flex justify-between text-emerald-700">
                              <span>Weekend Offer</span>
                              <span className="font-semibold">-₹{weekendDiscount.toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          {gatewayCharge > 0 && (
                            <div className="flex justify-between">
                              <span>Payment gateway charges</span>
                              <span className="font-semibold text-[#1C0806]">₹{gatewayCharge.toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          
                          <div className="border-t border-[#F5EFE6] pt-3 flex justify-between text-sm">
                            <span className="font-bold text-[#1C0806]">Final Amount</span>
                            <span className="font-bold text-[#7D1C1C]">₹{finalTotal.toLocaleString("en-IN")}</span>
                          </div>

                          <div className="bg-[#FCFAF7] p-3 rounded-lg border border-[#F5EFE6] text-[10px] space-y-1 mt-4">
                            <span className="block font-bold text-[#7D1C1C] uppercase tracking-wider">🔒 Premium Secure Checkout</span>
                            <p className="leading-relaxed">Payments are processed securely via Razorpay gateway. We accept cards, UPI, net banking, and luxury wallets.</p>
                          </div>

                          <button
                            onClick={handlePlaceOrder}
                            disabled={checkoutSubmitting}
                            className="w-full bg-[#7D1C1C] hover:bg-[#631414] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs py-3.5 rounded-xl font-bold uppercase tracking-widest transition-all shadow-md mt-6"
                          >
                            {checkoutSubmitting ? "PROCESSING TRANSACTION..." : "PROCEED TO SECURE PAYMENT"}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ─── VIEW: Order Detail / Timeline Tracking ─── */}
        {view === "orderDetails" && (
          <OrderDetailsView
            selectedOrderId={selectedOrderId}
            setView={setView}
            token={token}
            triggerNotification={triggerNotification}
            isAdminView={orderDetailsSource === "admin"}
            showThankYou={showOrderThankYou}
            onBack={handleOrderDetailsBack}
            backLabel={orderDetailsSource === "admin" ? "BACK TO ORDER REGISTRY" : "BACK TO MY ORDERS"}
          />
        )}

        {/* ─── VIEW: My Orders (User) ─── */}
        {view === "myOrders" && (
          <MyOrdersView
            token={token}
            setView={setView}
            setSelectedOrderId={setSelectedOrderId}
            setShowAuthModal={setShowAuthModal}
            setAuthMode={setAuthMode}
            setAuthError={setAuthError}
            triggerNotification={triggerNotification}
            onTrackOrder={(orderId) => openOrderDetails(orderId, "myOrders")}
          />
        )}

        {/* ─── VIEW: User Profile ─── */}
        {view === "profile" && (
          <ProfileView
            token={token}
            user={user}
            setView={setView}
            setSelectedProductId={setSelectedProductId}
            setShowAuthModal={setShowAuthModal}
            setAuthMode={setAuthMode}
            setAuthError={setAuthError}
            triggerNotification={triggerNotification}
          />
        )}

        {/* ─── VIEW: Admin Login ─── */}
        {view === "adminLogin" && (
          <div className="min-h-[65vh] flex items-center justify-center bg-[#FDF8F2] py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 p-10 bg-white border border-[#E9DCC9] rounded-2xl shadow-xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#7D1C1C] rounded-full flex items-center justify-center mx-auto shadow-md border border-[#F5D08A]/40 mb-4">
                  <span className="text-[#F5D08A] font-bold text-lg font-serif">SF</span>
                </div>
                <h2 className="font-serif text-3xl font-bold text-[#7D1C1C]">Admin Access Portal</h2>
                <p className="text-xs text-[#7A5F50] mt-2 font-medium">Sunithaprasad Fashion World Studio Administration</p>
              </div>

              {authError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl font-semibold">
                  ⚠ {authError}
                </div>
              )}

              <form onSubmit={handleAdminLoginSubmit} className="mt-8 space-y-5 text-xs">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[#7A5F50] font-bold mb-1.5 uppercase tracking-wider">Email Address</label>
                    <input
                      type="email"
                      required
                      value={authForm.email}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full border border-[#E9DCC9] rounded-xl p-3 focus:outline-none focus:border-[#7D1C1C] text-xs bg-[#FDF8F2]"
                      placeholder="admin@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[#7A5F50] font-bold mb-1.5 uppercase tracking-wider">Password</label>
                    <input
                      type="password"
                      required
                      value={authForm.password}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full border border-[#E9DCC9] rounded-xl p-3 focus:outline-none focus:border-[#7D1C1C] text-xs bg-[#FDF8F2]"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent text-xs font-bold rounded-xl text-white bg-[#7D1C1C] hover:bg-[#631414] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7D1C1C] transition-all uppercase tracking-wider disabled:bg-gray-300"
                  >
                    {authLoading ? "Logging in..." : "Access Dashboard"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── VIEW: Admin Dashboard Panel ─── */}
        {view === "dashboard" && user?.role === "admin" && (
          <div className="flex flex-col md:flex-row h-[calc(100vh-108px)] overflow-hidden bg-[#F5EFE6]">
            
            {/* Mobile Header */}
            <div className="md:hidden bg-[#7D1C1C] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#C4913A] rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold">AD</span>
                </div>
                <div>
                  <h5 className="font-bold text-xs font-serif leading-none">Admin Suite</h5>
                  <span className="text-[9px] text-[#F5D08A] font-semibold mt-1 block tracking-wider">LIVELY RUNNING</span>
                </div>
              </div>
              <button
                onClick={() => setShowAdminSidebar(!showAdminSidebar)}
                className="text-white p-2"
              >
                {showAdminSidebar ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

            {/* Sidebar navigation */}
            <aside className={`fixed md:relative inset-y-0 left-0 z-50 md:z-auto w-56 bg-[#7D1C1C] text-white flex flex-col justify-between flex-shrink-0 shadow-lg border-r border-[#C4913A]/20 transition-transform duration-300 ${showAdminSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
              <div className="py-4">
                <div className="hidden md:flex px-4 pb-4 border-b border-white/10 items-center gap-2">
                  <div className="w-8 h-8 bg-[#C4913A] rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold">AD</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-xs font-serif leading-none">Admin Suite</h5>
                    <span className="text-[9px] text-[#F5D08A] font-semibold mt-1 block tracking-wider">LIVELY RUNNING</span>
                  </div>
                </div>

                <nav className="mt-4 space-y-1">
                  {[
                    { key: "dashboard", label: "KPIs & Analytics", icon: LayoutDashboard },
                    { key: "products", label: "Saree Catalog", icon: Package },
                    { key: "categories", label: "Weaving Styles", icon: Layers },
                    { key: "orders", label: "Order Registry", icon: Clock },
                    { key: "customers", label: "Customer List", icon: Users },
                    { key: "reviews", label: "Buyer Reviews", icon: MessageSquare }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => { setAdminTab(tab.key as any); setShowAdminSidebar(false); }}
                      className={`w-full text-left px-5 py-3 text-xs font-semibold tracking-wider transition-all flex items-center gap-3 border-r-2 ${
                        adminTab === tab.key
                          ? "bg-white/10 text-[#F5D08A] border-[#C4913A]"
                          : "text-white/70 hover:bg-white/5 hover:text-white border-transparent"
                      }`}
                    >
                      <tab.icon size={15} />
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-4 border-t border-white/10">
                <button
                  onClick={() => setView("store")}
                  className="w-full text-center bg-[#C4913A] hover:bg-[#B28231] text-white text-[10px] font-bold py-2 rounded uppercase tracking-wider transition-colors"
                >
                  Return to Store
                </button>
              </div>
            </aside>

            {/* Overlay for mobile sidebar */}
            {showAdminSidebar && (
              <div
                onClick={() => setShowAdminSidebar(false)}
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
              />
            )}

            {/* Admin view panels */}
            <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
              
              {/* Dashboard tab: KPIs & Charts */}
              {adminTab === "dashboard" && (
                <div className="space-y-4 md:space-y-6">
                  
                  {/* KPI Cards — net revenue after Razorpay gateway fees */}
                  <div className="bg-[#FCFAF7] border border-[#E9DCC9] rounded-xl px-4 py-3 text-[10px] md:text-xs text-[#7A5F50]">
                    Revenue figures are <strong className="text-[#1C0806]">net after Razorpay fees</strong> ({adminKPIs.razorpayFeePercent || 2}% + {adminKPIs.razorpayFeeGstPercent || 18}% GST on fee).
                    {(adminKPIs.totalFees || 0) > 0 && (
                      <span className="ml-1">
                        Total Razorpay deductions: <strong className="text-rose-700">₹{(adminKPIs.totalFees || 0).toLocaleString("en-IN")}</strong>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                    {[
                      { label: "Today's Revenue", sub: "Net", val: `₹${(adminKPIs.todaySales || 0).toLocaleString("en-IN")}`, icon: TrendingUp, color: "text-[#7D1C1C]" },
                      { label: "Weekly Revenue", sub: "Net", val: `₹${(adminKPIs.weeklySales || 0).toLocaleString("en-IN")}`, icon: BarChart2, color: "text-blue-600" },
                      { label: "Monthly Revenue", sub: "Net", val: `₹${(adminKPIs.monthlySales || 0).toLocaleString("en-IN")}`, icon: Shield, color: "text-emerald-600" },
                      { label: "Total Revenue", sub: "Net", val: `₹${(adminKPIs.totalRevenue || 0).toLocaleString("en-IN")}`, icon: CreditCard, color: "text-[#7D1C1C]" },
                      { label: "Total Orders Paid", sub: "", val: adminKPIs.totalOrders || 0, icon: Package, color: "text-[#C4913A]" }
                    ].map((k) => (
                      <div key={k.label} className="bg-white p-3 md:p-5 rounded-xl border border-[#E9DCC9] shadow-sm flex items-center justify-between">
                        <div>
                          <span className="text-[9px] md:text-[10px] text-[#7A5F50] font-bold uppercase tracking-wider">{k.label}</span>
                          {k.sub && <span className="block text-[8px] text-[#7A5F50]/80 font-semibold uppercase">{k.sub}</span>}
                          <h4 className="text-base md:text-xl font-bold mt-1 md:mt-1.5">{k.val}</h4>
                        </div>
                        <div className={`p-2 md:p-2.5 bg-[#FCFAF7] rounded-lg ${k.color}`}>
                          <k.icon size={16} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Low Stock Alerts warning box */}
                  {(lowStockAlerts.products.length > 0 || lowStockAlerts.variants.length > 0) && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3 md:p-4 rounded-xl flex items-start gap-2 md:gap-3">
                      <AlertTriangle className="text-rose-700 mt-0.5 flex-shrink-0" size={16} md:size={18} />
                      <div className="text-[10px] md:text-xs">
                        <span className="font-bold">LOW STOCK NOTIFICATION ALERT!</span>
                        <p className="mt-1">The following sarees or variants have less than 5 units left. Restock soon to prevent client order cancellations:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-rose-800">
                          {lowStockAlerts.products.map((p: any) => (
                            <li key={p.id}>Product: {p.name} - ({p.stock} units remaining)</li>
                          ))}
                          {lowStockAlerts.variants.map((v: any) => (
                            <li key={v.id}>Color Variant: {v.product_name} ({v.color}) - ({v.stock} units remaining)</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Recharts Analytics Section */}
                  <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
                    {/* Area Chart: Weekly Sales */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#E9DCC9] shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C] mb-1">SALES OVER TIME (LAST 7 DAYS)</h4>
                      <p className="text-[10px] text-[#7A5F50] mb-4">Net revenue after Razorpay gateway fees</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={adminSalesData}>
                          <defs>
                            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#7D1C1C" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#7D1C1C" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F5EFE6" />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, 'Net Revenue']} />
                          <Area type="monotone" dataKey="revenue" stroke="#7D1C1C" fillOpacity={1} fill="url(#salesGrad)" strokeWidth={2.5} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Pie Chart: Sales breakdown by Category style */}
                    <div className="bg-white p-5 rounded-2xl border border-[#E9DCC9] shadow-sm text-xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C] mb-4">WEAVING CATEGORY POPULARITY</h4>
                      {adminOrderStatusData.length === 0 ? (
                        <p className="text-center py-10 text-gray-400">No category purchases recorded yet.</p>
                      ) : (
                        <div className="space-y-4">
                          <ResponsiveContainer width="100%" height={150}>
                            <PieChart>
                              <Pie
                                data={adminOrderStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                dataKey="value"
                              >
                                {adminOrderStatusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="grid grid-cols-2 gap-2 mt-4 text-[10px]">
                            {adminOrderStatusData.map((entry) => (
                              <div key={entry.name} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="font-semibold text-gray-700 truncate max-w-[80px]">{entry.name} ({entry.value})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Best Sellers side listing */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E9DCC9] shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C] mb-4">BEST SELLING APPARELS</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      {adminBestSellers.map((item, index) => (
                        <div key={index} className="flex items-center gap-3.5 border-b border-[#F5EFE6] pb-3 last:border-0 last:pb-0">
                          <img src={item.image} alt={item.name} className="w-10 h-14 object-cover rounded border" />
                          <div className="text-xs">
                            <span className="font-bold text-[#1C0806] block">{item.name}</span>
                            <span className="text-[#7A5F50]">{item.orders} overall purchases</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Saree Catalog Manager */}
              {adminTab === "products" && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-4 rounded-xl border border-[#E9DCC9]">
                    <span className="text-xs font-bold uppercase text-[#7D1C1C]">Products Catalog Manager</span>
                    <button
                      onClick={openNewProductForm}
                      className="bg-[#7D1C1C] hover:bg-[#631414] text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-1.5 w-full md:w-auto"
                    >
                      <Plus size={14} /> ADD SAREE
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-[#E9DCC9] overflow-x-auto">
                    <table className="w-full text-xs min-w-[600px]">
                      <thead className="bg-[#FCFAF7] border-b border-[#E9DCC9]">
                        <tr>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">SAREE IMAGE</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">NAME</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">PRICE</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">STOCK</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">FEATURED</th>
                          <th className="text-center p-3 font-bold text-[#7A5F50]">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <tr key={p.id} className="border-b border-[#F5EFE6] last:border-0 hover:bg-[#FCFAF7] transition-colors">
                            <td className="p-3">
                              <img src={p.image_urls[0]} alt={p.name} className="w-10 h-14 object-cover rounded border" />
                            </td>
                            <td className="p-3">
                              <span className="font-bold block text-[#1C0806]">{p.name}</span>
                              <span className="text-[10px] text-[#7A5F50]">{p.fabric} | {p.category_name}</span>
                            </td>
                            <td className="p-3 font-bold text-[#7D1C1C]">₹{parseFloat(p.sale_price).toLocaleString("en-IN")}</td>
                            <td className="p-3 font-semibold">{p.stock} units</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                p.featured ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-800"
                              }`}>
                                {p.featured ? "YES" : "NO"}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-2.5">
                                <button
                                  onClick={() => handleEditProductClick(p)}
                                  className="text-[#7D1C1C] hover:text-[#C4913A] p-1"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.id)}
                                  className="text-rose-600 hover:text-rose-800 p-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Saree styles Category manager */}
              {adminTab === "categories" && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-4 rounded-xl border border-[#E9DCC9]">
                    <span className="text-xs font-bold uppercase text-[#7D1C1C]">Styles Category manager</span>
                    <button
                      onClick={() => { setCategoryForm({ id: "", name: "", image: "" }); setShowCategoryModal(true); }}
                      className="bg-[#7D1C1C] hover:bg-[#631414] text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-1.5 w-full md:w-auto"
                    >
                      <Plus size={14} /> ADD STYLE
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {categories.map((cat) => (
                      <div key={cat.id} className="bg-white rounded-xl border border-[#E9DCC9] overflow-hidden flex flex-col justify-between">
                        <img src={cat.image} alt={cat.name} className="h-32 md:h-40 w-full object-cover" />
                        <div className="p-3 md:p-4 flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="font-bold text-xs uppercase tracking-wider text-[#1C0806]">{cat.name}</span>
                            <span className="text-[10px] text-[#7A5F50] mt-0.5">{cat.product_count || 0} product{cat.product_count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditCategoryClick(cat)}
                              className="text-[#7D1C1C] hover:text-[#C4913A] p-1"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="text-rose-600 hover:text-rose-800 p-1"
                              title={cat.product_count > 0 ? `Cannot delete: ${cat.product_count} products` : 'Delete category'}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Status Timeline manager */}
              {adminTab === "orders" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C]">Client Orders History Log</h4>
                  <div className="bg-white rounded-xl border border-[#E9DCC9] overflow-x-auto">
                    <table className="w-full text-xs min-w-[800px]">
                      <thead className="bg-[#FCFAF7] border-b border-[#E9DCC9]">
                        <tr>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">ORDER ID</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">BUYER</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">TOTAL AMOUNT</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">PAYMENT STATUS</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">TIMELINE STATUS</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">DATE</th>
                          <th className="text-center p-3 font-bold text-[#7A5F50]">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminOrders.filter(ord => ord.payment_status === 'paid' && ord.order_status !== 'Cancelled').map((ord) => (
                          <tr key={ord.id} className="border-b border-[#F5EFE6] last:border-0 hover:bg-[#FCFAF7] transition-colors">
                            <td className="p-3 font-bold text-[#7D1C1C]">
                              <button
                                onClick={() => openOrderDetails(ord.order_id, "admin")}
                                className="hover:underline text-left font-bold"
                              >
                                {ord.order_id}
                              </button>
                            </td>
                            <td className="p-3">
                              <span className="font-semibold block text-[#1C0806]">{ord.customer_name}</span>
                              <span className="text-[10px] text-[#7A5F50]">{ord.email} | {ord.mobile}</span>
                            </td>
                            <td className="p-3 font-bold text-[#1C0806]">₹{parseFloat(ord.total_amount).toLocaleString("en-IN")}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ord.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                              }`}>
                                {ord.payment_status.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-3">
                              <select
                                value={ord.order_status}
                                onChange={(e) => handleOrderStatusUpdate(ord.order_id, e.target.value)}
                                className="border border-[#E9DCC9] rounded px-2 py-1 bg-white text-[11px] font-semibold"
                              >
                                <option value="Ordered">Ordered</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Cancellation Requested">Cancellation Requested</option>
                                <option value="Packed">Packed</option>
                                <option value="Shipped">Shipped</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                              {ord.cancellation_reason && (
                                <p className="text-[10px] text-rose-600 mt-1 max-w-[180px]">
                                  Reason: {ord.cancellation_reason}
                                </p>
                              )}
                            </td>
                            <td className="p-3 text-gray-500">
                              {new Date(ord.created_at).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteOrder(ord.order_id)}
                                className="text-rose-600 hover:text-rose-800 p-1"
                                title="Delete Order"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cancelled Orders Section */}
              {adminTab === "orders" && adminOrders.filter(ord => ord.order_status === 'Cancelled').length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700">Cancelled Orders</h4>
                  <div className="bg-white rounded-xl border border-rose-200 overflow-x-auto">
                    <table className="w-full text-xs min-w-[800px]">
                      <thead className="bg-rose-50 border-b border-rose-200">
                        <tr>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">ORDER ID</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">BUYER</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">TOTAL AMOUNT</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">CANCELLATION REASON</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">DATE</th>
                          <th className="text-center p-3 font-bold text-[#7A5F50]">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminOrders.filter(ord => ord.order_status === 'Cancelled').map((ord) => (
                          <tr key={ord.id} className="border-b border-rose-100 last:border-0 hover:bg-rose-50 transition-colors">
                            <td className="p-3 font-bold text-[#7D1C1C]">
                              <button
                                onClick={() => openOrderDetails(ord.order_id, "admin")}
                                className="hover:underline text-left font-bold"
                              >
                                {ord.order_id}
                              </button>
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-[#1C0806]">{ord.customer_name}</span>
                            </td>
                            <td className="p-3 font-bold text-[#7D1C1C]">₹{parseFloat(ord.total_amount).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-[#7A5F50] max-w-[200px]">
                              {ord.cancellation_reason || <span className="text-gray-400 italic">Not provided</span>}
                            </td>
                            <td className="p-3 text-gray-500">
                              {new Date(ord.created_at).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteOrder(ord.order_id)}
                                className="text-rose-600 hover:text-rose-800 p-1"
                                title="Delete Order"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Buyer Reviews Manager */}
              {adminTab === "reviews" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C]">Customer Reviews Manager</h4>
                  <div className="bg-white rounded-xl border border-[#E9DCC9] overflow-x-auto">
                    <table className="w-full text-xs min-w-[800px]">
                      <thead className="bg-[#FCFAF7] border-b border-[#E9DCC9]">
                        <tr>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">SAREE</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">CUSTOMER</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">RATING</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">REVIEW</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">DATE</th>
                          <th className="text-center p-3 font-bold text-[#7A5F50]">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminReviews.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-[#7A5F50] italic">
                              No customer reviews yet.
                            </td>
                          </tr>
                        ) : (
                          adminReviews.map((rev) => (
                            <tr key={rev.id} className="border-b border-[#F5EFE6] last:border-0 hover:bg-[#FCFAF7] transition-colors">
                              <td className="p-3 font-bold text-[#1C0806] max-w-[160px]">
                                <span className="line-clamp-2">{rev.product_name || "Unknown Saree"}</span>
                              </td>
                              <td className="p-3 font-semibold text-[#7A5F50]">{rev.user_name}</td>
                              <td className="p-3">
                                <span className="inline-flex items-center gap-0.5 text-[#C4913A] font-bold">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      size={11}
                                      className={i < rev.rating ? "fill-[#C4913A]" : "text-gray-300"}
                                    />
                                  ))}
                                </span>
                              </td>
                              <td className="p-3 text-[#7A5F50] max-w-[280px]">
                                <span className="line-clamp-3">{rev.review}</span>
                              </td>
                              <td className="p-3 text-gray-500 whitespace-nowrap">
                                {new Date(rev.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => handleDeleteReview(rev.id)}
                                  className="text-rose-600 hover:text-rose-800 p-1"
                                  title="Delete Review"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Customer List Registry */}
              {adminTab === "customers" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C]">Client registry database</h4>
                  <div className="bg-white rounded-xl border border-[#E9DCC9] overflow-x-auto">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead className="bg-[#FCFAF7] border-b border-[#E9DCC9]">
                        <tr>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">CUSTOMER NAME</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">EMAIL ADDRESS</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">MOBILE</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">TOTAL ORDERS</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">TOTAL PURCHASED</th>
                          <th className="text-left p-3 font-bold text-[#7A5F50]">REGISTRATION DATE</th>
                          <th className="text-center p-3 font-bold text-[#7A5F50]">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminCustomers.map((cust) => (
                          <tr key={cust.id} className="border-b border-[#F5EFE6] last:border-0 hover:bg-[#FCFAF7] transition-colors">
                            <td className="p-3 font-bold text-[#1C0806]">{cust.name}</td>
                            <td className="p-3 text-gray-600 font-semibold">{cust.email}</td>
                            <td className="p-3 text-gray-600">{cust.mobile}</td>
                            <td className="p-3 font-semibold text-center">{cust.total_orders || 0}</td>
                            <td className="p-3 font-bold text-[#7D1C1C]">₹{(cust.total_spent || 0).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-gray-500">
                              {new Date(cust.created_at).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                                className="text-rose-600 hover:text-rose-800 p-1"
                                title="Delete Customer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </main>

      {/* Modern Luxury footer */}
      <footer className="bg-[#1C0806] text-white pt-12 pb-6 border-t border-[#C4913A]/25">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10 text-xs">
            
            {/* Logo block */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#C4913A] rounded-full flex items-center justify-center">
                  <span className="text-[#7D1C1C] font-bold text-xs font-serif">SF</span>
                </div>
                <div>
                  <p className="font-serif font-bold text-sm">Sunithaprasad</p>
                  <p className="text-[#C4913A] text-[8px] tracking-[0.2em] uppercase font-bold">Fashion World</p>
                </div>
              </div>
              <p className="text-white/60 leading-relaxed max-w-[200px]">
                Woven with heritage, worn with pride. Premium authentic handloom silk sarees crafted for generations.
              </p>
            </div>

            <div>
              <h5 className="font-bold text-[#C4913A] uppercase tracking-wider mb-4">Masterpiece collections</h5>
              <ul className="space-y-2 text-white/50">
                {categories.slice(0, 4).map(cat => (
                  <li key={cat.id}>
                    <button onClick={() => { setSelectedCategory(cat.id); setView("store"); }} className="hover:text-[#F5D08A] transition-colors uppercase">
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-[#C4913A] uppercase tracking-wider mb-4">Customer Care</h5>
              <div className="space-y-2 text-white/50">
                <p>🚚 Insured Delivery Tracker</p>
                <p>🤝 Handloom Certification</p>
                <p>📦 Damage-Only Exchange (Video Required)</p>
                <p>💬 Real-Time Inquiries</p>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-[#C4913A] uppercase tracking-wider mb-4">Contact Studio</h5>
              <div className="space-y-3 text-white/50 text-xs">
                <a
                  href="mailto:Punchprasad2m@gmail.com"
                  className="flex items-center gap-2 hover:text-[#F5D08A] transition-colors"
                >
                  <Mail size={12} className="text-[#C4913A] flex-shrink-0" />
                  <span>Punchprasad2m@gmail.com</span>
                </a>
                <a
                  href="https://api.whatsapp.com/send?phone=916281120225"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-[#F5D08A] transition-colors"
                >
                  <Phone size={12} className="text-[#C4913A] flex-shrink-0" />
                  <span>WhatsApp Only: 6281120225</span>
                </a>
                <a
                  href={INSTAGRAM_PROFILE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-[#F5D08A] transition-colors"
                >
                  <Instagram size={12} className="text-[#C4913A] flex-shrink-0" />
                  <span>@sunithaprasad_official</span>
                </a>
              </div>
            </div>

          </div>

          <div className="border-t border-white/10 pt-5 text-center text-[10px] text-white/45">
            <span>© 2026 Sunithaprasad Fashion World. Designed for traditional luxury.</span>
          </div>
        </div>
      </footer>

      {/* ─── MODAL: Login & Sign Up ─── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-[#E9DCC9] shadow-2xl relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-black"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <h4 className="font-serif text-2xl font-bold text-[#7D1C1C]">
                {authMode === "login" ? "Welcome Back" : "Register Studio Account"}
              </h4>
              <p className="text-xs text-[#7A5F50] mt-1.5">Celebrate traditional sarees with secure checkout.</p>
            </div>

            {authError && (
              <div className="bg-rose-50 text-rose-800 text-xs p-3 rounded-lg border border-rose-200 mb-4 font-semibold">
                ⚠ {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
              {authMode === "register" && (
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase tracking-wider">Your Full Name:</label>
                  <input
                    type="text"
                    required
                    value={authForm.name}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2.5 focus:outline-none focus:border-[#7D1C1C]"
                    placeholder="e.g. Lakshmi Devi"
                  />
                </div>
              )}

              <div>
                <label className="block text-[#7A5F50] font-bold mb-1 uppercase tracking-wider">Email Address:</label>
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-[#E9DCC9] rounded p-2.5 focus:outline-none focus:border-[#7D1C1C]"
                  placeholder="e.g. lakshmi@example.com"
                />
              </div>

              {authMode === "register" && (
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase tracking-wider">Mobile Number:</label>
                  <input
                    type="text"
                    required
                    value={authForm.mobile}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, mobile: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2.5 focus:outline-none focus:border-[#7D1C1C]"
                    placeholder="e.g. 9876543210"
                  />
                </div>
              )}

              <div>
                <label className="block text-[#7A5F50] font-bold mb-1 uppercase tracking-wider">Password:</label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full border border-[#E9DCC9] rounded p-2.5 focus:outline-none focus:border-[#7D1C1C]"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-[#7D1C1C] hover:bg-[#631414] disabled:bg-gray-300 text-white py-3 rounded-lg font-bold uppercase tracking-wider transition-colors shadow-md"
              >
                {authLoading ? "AUTHENTICATING ACCOUNT..." : authMode === "login" ? "SECURE LOG IN" : "CREATE STUDIO ACCOUNT"}
              </button>
            </form>

            <div className="text-center mt-5 text-[11px]">
              {authMode === "login" ? (
                <p className="text-[#7A5F50]">
                  New to Sunithaprasad?{" "}
                  <button onClick={() => setAuthMode("register")} className="text-[#7D1C1C] font-bold hover:underline">
                    Create Studio Account
                  </button>
                </p>
              ) : (
                <p className="text-[#7A5F50]">
                  Already have an account?{" "}
                  <button onClick={() => setAuthMode("login")} className="text-[#7D1C1C] font-bold hover:underline">
                    Log in here
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Admin Product Editor ─── */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-[#E9DCC9] shadow-2xl relative my-8">
            <button
              onClick={() => setShowProductModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-black"
            >
              <X size={18} />
            </button>

            <h4 className="font-serif text-xl font-bold text-[#7D1C1C] mb-4">
              {productForm.id ? "Edit Saree Masterpiece" : "Wove New Saree into Catalog"}
            </h4>

            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Saree Name:</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Category Style:</label>
                  <select
                    value={productForm.category_id}
                    onChange={(e) => setProductForm(prev => ({ ...prev, category_id: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2 bg-white"
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Woven Saree Description:</label>
                <textarea
                  required
                  rows={2}
                  value={productForm.description}
                  onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-[#E9DCC9] rounded p-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Sale Price (₹):</label>
                  <input
                    type="number"
                    required
                    value={productForm.sale_price}
                    onChange={(e) => setProductForm(prev => ({ ...prev, sale_price: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Original Price (₹):</label>
                  <input
                    type="number"
                    value={productForm.original_price}
                    onChange={(e) => setProductForm(prev => ({ ...prev, original_price: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">General Stock:</label>
                  <input
                    type="number"
                    required
                    value={productForm.stock}
                    onChange={(e) => setProductForm(prev => ({ ...prev, stock: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Fabric Type:</label>
                  <select
                    value={productForm.fabric}
                    onChange={(e) => setProductForm(prev => ({ ...prev, fabric: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2 bg-white"
                  >
                    {fabricOptions.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Occasion Wear:</label>
                  <select
                    value={productForm.occasion}
                    onChange={(e) => setProductForm(prev => ({ ...prev, occasion: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2 bg-white"
                  >
                    {occasionOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Color (Primary):</label>
                  <input
                    type="text"
                    value={productForm.color}
                    onChange={(e) => setProductForm(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Work Type:</label>
                  <input
                    type="text"
                    value={productForm.work_type}
                    onChange={(e) => setProductForm(prev => ({ ...prev, work_type: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Saree Length:</label>
                  <input
                    type="text"
                    value={productForm.length}
                    onChange={(e) => setProductForm(prev => ({ ...prev, length: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Blouse Piece Included:</label>
                  <select
                    value={productForm.blouse_included ? "true" : "false"}
                    onChange={(e) => setProductForm(prev => ({ ...prev, blouse_included: e.target.value === "true" }))}
                    className="w-full border border-[#E9DCC9] rounded p-2 bg-white"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[#7A5F50] font-bold mb-1 uppercase text-xs">Saree Images:</label>
                
                {/* File Upload Selector */}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={imageUploading}
                    onChange={handleInputChange}
                    className="hidden"
                    id="cloudinary-image-picker"
                  />
                  <label
                    htmlFor="cloudinary-image-picker"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onPaste={handlePaste}
                    className={`w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 px-4 bg-[#FDF8F2] hover:bg-[#FDF8F2]/60 cursor-pointer transition-all ${
                      imageUploading ? "opacity-50 cursor-not-allowed border-[#E9DCC9]" : isDragging ? "border-[#7D1C1C] bg-[#FDF8F2]" : "border-[#E9DCC9] hover:border-[#7D1C1C]"
                    }`}
                  >
                    <ImageIcon className="text-[#C4913A] w-6 h-6 animate-pulse" />
                    <span className="font-bold text-xs text-[#7D1C1C]">
                      {imageUploading ? "Uploading..." : isDragging ? "Drop images here" : "Drag & Drop, Paste, or Click to Upload"}
                    </span>
                    <span className="text-[10px] text-[#7A5F50]">Supports JPG, PNG, WEBP (Ctrl+V to paste)</span>
                  </label>
                </div>

                {/* Uploaded Images Gallery Preview */}
                {productForm.image_urls.length > 0 && (
                  <div className="bg-[#FCFAF7] border border-[#E9DCC9] p-3 rounded-xl">
                    <p className="text-[10px] text-[#7A5F50] font-bold uppercase mb-2">Uploaded Images Preview ({productForm.image_urls.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {productForm.image_urls.map((url, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-lg border border-[#E9DCC9] overflow-hidden group shadow-sm bg-white">
                          <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleImageDelete(idx, productForm.image_public_ids?.[idx] || '')}
                            className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.featured}
                    onChange={(e) => setProductForm(prev => ({ ...prev, featured: e.target.checked }))}
                    className="accent-[#7D1C1C]"
                  />
                  Featured Masterpiece
                </label>
              </div>

              {/* Variants Builder */}
              <div className="border-t border-[#F5EFE6] pt-4">
                <h5 className="font-bold text-xs uppercase text-[#7D1C1C] mb-2">Color Variants</h5>
                <p className="text-[10px] text-[#7A5F50] mb-3">
                  Edit stock and pricing for each color variant below, or add a new one.
                </p>

                {/* Form to add a color variant */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end mb-4 bg-[#FCFAF7] p-3 rounded border border-[#E9DCC9]">
                  <div>
                    <label className="block text-[10px] text-[#7A5F50] mb-0.5">VARIANT COLOR</label>
                    <input
                      type="text"
                      placeholder="e.g. Mustard Gold"
                      value={newVariant.color}
                      onChange={(e) => setNewVariant(prev => ({ ...prev, color: e.target.value }))}
                      className="w-full border border-[#E9DCC9] rounded p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#7A5F50] mb-0.5">STOCK</label>
                    <input
                      type="number"
                      placeholder="5"
                      value={newVariant.stock}
                      onChange={(e) => setNewVariant(prev => ({ ...prev, stock: e.target.value }))}
                      className="w-full border border-[#E9DCC9] rounded p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#7A5F50] mb-0.5">ORIGINAL PRICE (₹)</label>
                    <input
                      type="number"
                      placeholder={productForm.original_price || "MRP"}
                      value={newVariant.original_price}
                      onChange={(e) => setNewVariant(prev => ({ ...prev, original_price: e.target.value }))}
                      className="w-full border border-[#E9DCC9] rounded p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#7A5F50] mb-0.5">OUR PRICE (₹)</label>
                    <input
                      type="number"
                      placeholder={productForm.sale_price || "Sale price"}
                      value={newVariant.sale_price}
                      onChange={(e) => setNewVariant(prev => ({ ...prev, sale_price: e.target.value }))}
                      className="w-full border border-[#E9DCC9] rounded p-2 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newVariant.color || !newVariant.stock) return;
                      setProductForm(prev => ({
                        ...prev,
                        variants: [...prev.variants, {
                          color: newVariant.color,
                          stock: newVariant.stock,
                          original_price: newVariant.original_price || prev.original_price,
                          sale_price: newVariant.sale_price || prev.sale_price,
                          image_urls: prev.image_urls.length > 0 ? [prev.image_urls[0]] : [],
                          image_public_ids: prev.image_public_ids.length > 0 ? [prev.image_public_ids[0]] : []
                        }]
                      }));
                      setNewVariant({ color: "", stock: "", original_price: "", sale_price: "" });
                    }}
                    className="bg-[#C4913A] text-white text-xs px-3 py-2 rounded font-bold h-[34px]"
                  >
                    ADD VARIANT
                  </button>
                </div>

                {/* Editable variant rows */}
                <div className="space-y-3">
                  {productForm.variants.length === 0 && (
                    <p className="text-[10px] text-[#7A5F50] italic">No color variants yet.</p>
                  )}
                  {productForm.variants.map((v: any, index: number) => (
                    <div key={v.id || index} className="bg-[#FCFAF7] p-3 rounded border border-[#E9DCC9] space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] text-[#7A5F50] mb-0.5">COLOR</label>
                          <input
                            type="text"
                            value={v.color}
                            onChange={(e) => {
                              const value = e.target.value;
                              setProductForm(prev => ({
                                ...prev,
                                variants: prev.variants.map((variant, i) =>
                                  i === index ? { ...variant, color: value } : variant
                                )
                              }));
                            }}
                            className="w-full border border-[#E9DCC9] rounded p-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#7A5F50] mb-0.5">STOCK</label>
                          <input
                            type="number"
                            value={v.stock}
                            onChange={(e) => {
                              const value = e.target.value;
                              setProductForm(prev => ({
                                ...prev,
                                variants: prev.variants.map((variant, i) =>
                                  i === index ? { ...variant, stock: value } : variant
                                )
                              }));
                            }}
                            className="w-full border border-[#E9DCC9] rounded p-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#7A5F50] mb-0.5">ORIGINAL PRICE (₹)</label>
                          <input
                            type="number"
                            value={v.original_price ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setProductForm(prev => ({
                                ...prev,
                                variants: prev.variants.map((variant, i) =>
                                  i === index ? { ...variant, original_price: value } : variant
                                )
                              }));
                            }}
                            className="w-full border border-[#E9DCC9] rounded p-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#7A5F50] mb-0.5">OUR PRICE (₹)</label>
                          <input
                            type="number"
                            value={v.sale_price ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setProductForm(prev => ({
                                ...prev,
                                variants: prev.variants.map((variant, i) =>
                                  i === index ? { ...variant, sale_price: value } : variant
                                )
                              }));
                            }}
                            className="w-full border border-[#E9DCC9] rounded p-2 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setProductForm(prev => ({
                              ...prev,
                              variants: prev.variants.filter((_, i) => i !== index)
                            }));
                          }}
                          className="text-rose-600 text-xs font-bold hover:underline"
                        >
                          Remove Variant
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#F5EFE6] flex gap-3">
                <button
                  type="submit"
                  className="bg-[#7D1C1C] text-white font-bold px-6 py-2.5 rounded"
                >
                  SAVE MASTERPIECE
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="border border-[#E9DCC9] font-bold px-6 py-2.5 rounded"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Admin Category Editor ─── */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-[#E9DCC9] shadow-2xl relative">
            <button
              onClick={() => setShowCategoryModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-black"
            >
              <X size={18} />
            </button>

            <h4 className="font-serif text-lg font-bold text-[#7D1C1C] mb-4">
              {categoryForm.id ? "Edit Style Category" : "Add Weaving Style Category"}
            </h4>

            <form onSubmit={handleCategorySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Style Category Name:</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-[#E9DCC9] rounded p-2"
                  placeholder="e.g. Cotton Silk"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[#7A5F50] font-bold mb-1 uppercase">Cover Image:</label>

                {/* File upload → Cloudinary */}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={categoryImageUploading}
                    onChange={async (e) => {
                      if (!e.target.files || e.target.files.length === 0) return;
                      setCategoryImageUploading(true);
                      triggerNotification("Uploading category image to Cloudinary...");
                      try {
                        const formData = new FormData();
                        formData.append("images", e.target.files[0]);
                        const res = await uploadAPI.uploadImages(formData);
                        const url = res.data.images[0]?.url;
                        if (url) {
                          setCategoryForm(prev => ({ ...prev, image: url }));
                          triggerNotification("Category image uploaded!");
                        }
                      } catch {
                        triggerNotification("Failed to upload category image.", "error");
                      } finally {
                        setCategoryImageUploading(false);
                      }
                    }}
                    className="hidden"
                    id="category-image-picker"
                  />
                  <label
                    htmlFor="category-image-picker"
                    className={`w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#E9DCC9] rounded-xl py-5 px-4 bg-[#FDF8F2] hover:bg-[#FDF8F2]/60 hover:border-[#7D1C1C] cursor-pointer transition-all ${
                      categoryImageUploading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <ImageIcon className="text-[#C4913A] w-5 h-5" />
                    <span className="font-bold text-[10px] text-[#7D1C1C]">
                      {categoryImageUploading ? "Uploading..." : "Upload Category Photo"}
                    </span>
                    <span className="text-[9px] text-[#7A5F50]">JPG, PNG, WEBP</span>
                  </label>
                </div>

                {/* Preview / current URL */}
                {categoryForm.image && (
                  <div className="flex items-center gap-3 bg-[#FCFAF7] border border-[#E9DCC9] rounded-lg p-2">
                    <img
                      src={categoryForm.image}
                      alt="Category preview"
                      className="w-14 h-14 rounded object-cover flex-shrink-0"
                      style={{ objectPosition: "center top" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] text-[#7A5F50] font-bold uppercase mb-0.5">Uploaded Image</p>
                      <p className="text-[9px] text-[#7A5F50] truncate">{categoryForm.image}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCategoryForm(prev => ({ ...prev, image: "" }))}
                      className="text-rose-500 hover:text-rose-700 flex-shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button type="submit" className="bg-[#7D1C1C] text-white font-bold px-5 py-2 rounded">
                  SAVE STYLE
                </button>
                <button type="button" onClick={() => setShowCategoryModal(false)} className="border border-[#E9DCC9] font-bold px-5 py-2 rounded">
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: User Login / Register ─── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 border border-[#E9DCC9] shadow-2xl relative">
            <button
              onClick={() => { setShowAuthModal(false); setAuthError(""); }}
              className="absolute right-4 top-4 text-gray-400 hover:text-black"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-[#7D1C1C] rounded-full flex items-center justify-center mx-auto shadow-md border border-[#F5D08A]/40 mb-3">
                <span className="text-[#F5D08A] font-bold text-base font-serif">SF</span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#7D1C1C]">
                {authMode === "login" ? "Welcome Back" : "Create Account"}
              </h3>
              <p className="text-xs text-[#7A5F50] mt-1.5 font-medium">
                {authMode === "login" ? "Login to access your orders & wishlist" : "Join us for an exclusive shopping experience"}
              </p>
            </div>

            {authError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl font-semibold mb-4">
                ⚠ {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
              {authMode === "register" && (
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1.5 uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    required
                    value={authForm.name}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded-xl p-3 focus:outline-none focus:border-[#7D1C1C] text-xs bg-[#FDF8F2]"
                    placeholder="e.g. Lakshmi Devi"
                  />
                </div>
              )}

              <div>
                <label className="block text-[#7A5F50] font-bold mb-1.5 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-[#E9DCC9] rounded-xl p-3 focus:outline-none focus:border-[#7D1C1C] text-xs bg-[#FDF8F2]"
                  placeholder="name@example.com"
                />
              </div>

              {authMode === "register" && (
                <div>
                  <label className="block text-[#7A5F50] font-bold mb-1.5 uppercase tracking-wider">Mobile Number</label>
                  <input
                    type="text"
                    required
                    value={authForm.mobile}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, mobile: e.target.value }))}
                    className="w-full border border-[#E9DCC9] rounded-xl p-3 focus:outline-none focus:border-[#7D1C1C] text-xs bg-[#FDF8F2]"
                    placeholder="10-digit mobile number"
                  />
                </div>
              )}

              <div>
                <label className="block text-[#7A5F50] font-bold mb-1.5 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full border border-[#E9DCC9] rounded-xl p-3 focus:outline-none focus:border-[#7D1C1C] text-xs bg-[#FDF8F2]"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 text-xs font-bold rounded-xl text-white bg-[#7D1C1C] hover:bg-[#631414] transition-all uppercase tracking-wider disabled:bg-gray-300 shadow-md"
              >
                {authLoading ? "Please wait..." : authMode === "login" ? "Login" : "Create Account"}
              </button>
            </form>

            <div className="text-center mt-5 text-xs text-[#7A5F50]">
              {authMode === "login" ? (
                <p>
                  Don't have an account?{" "}
                  <button
                    onClick={() => { setAuthMode("register"); setAuthError(""); }}
                    className="text-[#7D1C1C] font-bold hover:underline"
                  >
                    Register Here
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button
                    onClick={() => { setAuthMode("login"); setAuthError(""); }}
                    className="text-[#7D1C1C] font-bold hover:underline"
                  >
                    Login Here
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── SUBCOMPONENTS: Profile, My Orders & Order Details Tracking ───

interface ProfileViewProps {
  token: string | null;
  user: { name?: string; email?: string; mobile?: string } | null;
  setView: (view: View) => void;
  setSelectedProductId: (id: string | null) => void;
  setShowAuthModal: (show: boolean) => void;
  setAuthMode: (mode: "login" | "register") => void;
  setAuthError: (err: string) => void;
  triggerNotification: (message: string, type?: "success" | "error") => void;
}

function ProfileView({
  token,
  user,
  setView,
  setSelectedProductId,
  setShowAuthModal,
  setAuthMode,
  setAuthError,
  triggerNotification
}: ProfileViewProps) {
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editText, setEditText] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    if (!token) {
      setReviewsLoading(false);
      return;
    }
    const fetchReviews = async () => {
      try {
        const res = await reviewsAPI.getMine();
        setMyReviews(res.data);
      } catch (err) {
        console.error("Failed to load your reviews:", err);
      } finally {
        setReviewsLoading(false);
      }
    };
    fetchReviews();
  }, [token]);

  const handleStartEdit = (review: any) => {
    setEditingReviewId(review.id);
    setEditRating(review.rating);
    setEditText(review.review);
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setEditRating(5);
    setEditText("");
  };

  const handleSaveEdit = async (reviewId: string) => {
    if (!editText.trim()) return;
    setSavingReview(true);
    try {
      await reviewsAPI.update(reviewId, { rating: editRating, review: editText.trim() });
      setMyReviews(prev => prev.map(r => 
        r.id === reviewId 
          ? { ...r, rating: editRating, review: editText.trim() }
          : r
      ));
      setEditingReviewId(null);
      triggerNotification("Review updated successfully!");
    } catch (err) {
      triggerNotification("Failed to update review.", "error");
    } finally {
      setSavingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Delete this review? This cannot be undone.")) {
      return;
    }
    try {
      await reviewsAPI.delete(reviewId);
      setMyReviews(prev => prev.filter(r => r.id !== reviewId));
      triggerNotification("Review deleted successfully.");
    } catch (err) {
      triggerNotification("Failed to delete review.", "error");
    }
  };

  if (!token) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <button
          onClick={() => setView("store")}
          className="flex items-center gap-1.5 text-xs font-bold text-[#7D1C1C] hover:underline mb-6"
        >
          <ArrowLeft size={14} /> BACK TO STOREFRONT
        </button>
        <div className="text-center py-20 bg-white rounded-2xl border border-[#F5EFE6]">
          <User size={44} className="mx-auto text-[#7A5F50]/30 mb-3" />
          <p className="text-sm font-semibold text-[#7A5F50] mb-4">Please login to view your profile.</p>
          <button
            onClick={() => { setShowAuthModal(true); setAuthMode("login"); setAuthError(""); }}
            className="bg-[#7D1C1C] text-white text-xs font-bold px-6 py-2.5 rounded-lg"
          >
            LOGIN / REGISTER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <button
        onClick={() => setView("store")}
        className="flex items-center gap-1.5 text-xs font-bold text-[#7D1C1C] hover:underline mb-6"
      >
        <ArrowLeft size={14} /> BACK TO STOREFRONT
      </button>

      <h2 className="font-serif text-3xl font-bold text-center text-[#7D1C1C] mb-2">MY PROFILE</h2>
      <p className="text-center text-xs text-[#7A5F50] mb-8">Your account details and saree reviews.</p>

      {/* Account summary */}
      <div className="bg-white rounded-2xl border border-[#F5EFE6] p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#7D1C1C] flex items-center justify-center text-[#F5D08A] font-serif font-bold text-xl flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-[#1C0806] text-sm truncate">{user?.name}</h3>
            <p className="text-xs text-[#7A5F50] truncate">{user?.email}</p>
            {user?.mobile && (
              <p className="text-xs text-[#7A5F50] mt-0.5">+91 {user.mobile}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-[#F5EFE6]">
          <button
            onClick={() => setView("myOrders")}
            className="inline-flex items-center gap-1.5 bg-[#7D1C1C] hover:bg-[#631414] text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <Package size={12} /> My Orders
          </button>
          <button
            onClick={() => setView("wishlist")}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-[#FDF8F2] text-[#7D1C1C] border border-[#E9DCC9] text-[10px] font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <Heart size={12} /> My Wishlist
          </button>
        </div>
      </div>

      {/* My Reviews */}
      <div className="bg-white rounded-2xl border border-[#F5EFE6] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[#F5EFE6]">
          <MessageSquare size={16} className="text-[#7D1C1C]" />
          <h3 className="font-serif text-lg font-bold text-[#1C0806]">My Reviews</h3>
          <span className="ml-auto text-[10px] font-bold text-[#7A5F50] bg-[#FCFAF7] px-2 py-1 rounded-full border border-[#E9DCC9]">
            {myReviews.length} review{myReviews.length !== 1 ? "s" : ""}
          </span>
        </div>

        {reviewsLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-4 border-[#7D1C1C]/30 border-t-[#7D1C1C] rounded-full animate-spin" />
            <span className="text-xs font-bold text-[#7A5F50] uppercase tracking-wider">Loading reviews...</span>
          </div>
        ) : myReviews.length === 0 ? (
          <div className="text-center py-10">
            <Star size={36} className="mx-auto text-[#7A5F50]/25 mb-3" />
            <p className="text-sm font-semibold text-[#7A5F50] mb-1">No reviews yet</p>
            <p className="text-xs text-[#7A5F50]/80 mb-4">Purchase a saree and share your experience on the product page.</p>
            <button
              onClick={() => setView("store")}
              className="bg-[#7D1C1C] hover:bg-[#631414] text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors"
            >
              BROWSE SAREES
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myReviews.map((rev) => (
              <div
                key={rev.id}
                className="flex gap-4 p-4 bg-[#FCFAF7] rounded-xl border border-[#E9DCC9] hover:border-[#7D1C1C]/30 transition-colors"
              >
                {rev.product_image && (
                  <img
                    src={rev.product_image}
                    alt={rev.product_name}
                    className="w-14 h-[72px] object-cover rounded-lg border border-[#E9DCC9] flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId(rev.product_id);
                        setView("product");
                      }}
                      className="font-bold text-xs text-[#7D1C1C] hover:underline text-left line-clamp-1"
                    >
                      {rev.product_name || "Saree"}
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleStartEdit(rev)}
                        className="text-[#7A5F50] hover:text-[#7D1C1C] p-1 transition-colors"
                        title="Edit review"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteReview(rev.id)}
                        className="text-rose-600 hover:text-rose-800 p-1 transition-colors"
                        title="Delete review"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  
                  {editingReviewId === rev.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(rev.id); }} className="mt-3 space-y-3">
                      <div>
                        <label className="block text-[10px] text-[#7A5F50] font-bold uppercase tracking-wider mb-1">
                          Your Rating
                        </label>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setEditRating(i + 1)}
                              className="p-0.5 transition-transform hover:scale-110"
                            >
                              <Star
                                size={18}
                                className={i < editRating ? "fill-[#C4913A] text-[#C4913A]" : "text-gray-300"}
                              />
                            </button>
                          ))}
                          <span className="text-[10px] text-[#7A5F50] ml-2 font-semibold">
                            {editRating} / 5
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#7A5F50] font-bold uppercase tracking-wider mb-1">
                          Your Review
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          placeholder="How was the fabric, color, and border work?"
                          className="w-full text-xs border border-[#E9DCC9] rounded-lg p-2.5 bg-white focus:outline-none focus:border-[#7D1C1C]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={savingReview}
                          className="bg-[#7D1C1C] hover:bg-[#631414] disabled:opacity-60 text-white text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider transition-colors"
                        >
                          {savingReview ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="bg-white hover:bg-[#FDF8F2] text-[#7A5F50] border border-[#E9DCC9] text-[10px] font-bold px-4 py-2 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 my-1.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={11}
                            className={i < rev.rating ? "fill-[#C4913A] text-[#C4913A]" : "text-gray-300"}
                          />
                        ))}
                        <span className="text-[10px] text-[#7A5F50] ml-1">
                          {new Date(rev.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <p className="text-xs text-[#7A5F50] leading-relaxed line-clamp-3">{rev.review}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface MyOrdersViewProps {
  token: string | null;
  setView: (view: View) => void;
  setSelectedOrderId: (id: string | null) => void;
  setShowAuthModal: (show: boolean) => void;
  setAuthMode: (mode: "login" | "register") => void;
  setAuthError: (err: string) => void;
  triggerNotification: (message: string, type?: "success" | "error") => void;
  onTrackOrder: (orderId: string) => void;
}

const CANCELLATION_REASONS = [
  "Changed my mind",
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Delivery is taking too long",
  "Other",
];

function MyOrdersView({
  token,
  setView,
  setSelectedOrderId,
  setShowAuthModal,
  setAuthMode,
  setAuthError,
  triggerNotification,
  onTrackOrder
}: MyOrdersViewProps) {
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOtherReason, setCancelOtherReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const fetchMyOrders = async () => {
    try {
      const res = await ordersAPI.getMyOrders();
      setUserOrders(res.data);
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setOrdersLoading(false);
      return;
    }
    fetchMyOrders();
  }, [token]);

  const openCancelModal = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReason("");
    setCancelOtherReason("");
  };

  const closeCancelModal = () => {
    if (cancelSubmitting) return;
    setCancelOrderId(null);
    setCancelReason("");
    setCancelOtherReason("");
  };

  const handleSubmitCancellation = async () => {
    if (!cancelOrderId) return;

    const finalReason = cancelReason === "Other" ? cancelOtherReason.trim() : cancelReason;
    if (!cancelReason) {
      triggerNotification("Please select a cancellation reason.", "error");
      return;
    }
    if (cancelReason === "Other" && !finalReason) {
      triggerNotification("Please describe your reason for cancellation.", "error");
      return;
    }

    setCancelSubmitting(true);
    try {
      await ordersAPI.requestCancellation(cancelOrderId, finalReason);
      triggerNotification("Cancellation request submitted. Admin will review your request.");
      setCancelOrderId(null);
      setCancelReason("");
      setCancelOtherReason("");
      setOrdersLoading(true);
      await fetchMyOrders();
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Failed to submit cancellation request.", "error");
    } finally {
      setCancelSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <button
          onClick={() => setView("store")}
          className="flex items-center gap-1.5 text-xs font-bold text-[#7D1C1C] hover:underline mb-6"
        >
          <ArrowLeft size={14} /> BACK TO STOREFRONT
        </button>
        <h2 className="font-serif text-3xl font-bold text-center text-[#7D1C1C] mb-3">MY ORDERS</h2>
        <p className="text-center text-xs text-[#7A5F50] mb-8">Track and manage all your orders in one place.</p>
        <div className="text-center py-20 bg-white rounded-2xl border border-[#F5EFE6]">
          <User size={44} className="mx-auto text-[#7A5F50]/30 mb-3" />
          <p className="text-sm font-semibold text-[#7A5F50] mb-4">Please login to view your orders.</p>
          <button
            onClick={() => { setShowAuthModal(true); setAuthMode("login"); setAuthError(""); }}
            className="bg-[#7D1C1C] text-white text-xs font-bold px-6 py-2.5 rounded-lg"
          >
            LOGIN / REGISTER
          </button>
        </div>
      </div>
    );
  }

  if (ordersLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <button
          onClick={() => setView("store")}
          className="flex items-center gap-1.5 text-xs font-bold text-[#7D1C1C] hover:underline mb-6"
        >
          <ArrowLeft size={14} /> BACK TO STOREFRONT
        </button>
        <h2 className="font-serif text-3xl font-bold text-center text-[#7D1C1C] mb-3">MY ORDERS</h2>
        <p className="text-center text-xs text-[#7A5F50] mb-8">Track and manage all your orders in one place.</p>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 border-4 border-[#7D1C1C]/30 border-t-[#7D1C1C] rounded-full animate-spin" />
          <span className="text-xs font-bold text-[#7A5F50] tracking-wider uppercase">Loading Your Orders...</span>
        </div>
      </div>
    );
  }

  if (userOrders.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <button
          onClick={() => setView("store")}
          className="flex items-center gap-1.5 text-xs font-bold text-[#7D1C1C] hover:underline mb-6"
        >
          <ArrowLeft size={14} /> BACK TO STOREFRONT
        </button>
        <h2 className="font-serif text-3xl font-bold text-center text-[#7D1C1C] mb-3">MY ORDERS</h2>
        <p className="text-center text-xs text-[#7A5F50] mb-8">Track and manage all your orders in one place.</p>
        <div className="text-center py-20 bg-white rounded-2xl border border-[#F5EFE6]">
          <Package size={44} className="mx-auto text-[#7A5F50]/30 mb-3" />
          <p className="text-sm font-semibold text-[#7A5F50] mb-4">You haven't placed any orders yet.</p>
          <button
            onClick={() => setView("store")}
            className="bg-[#7D1C1C] text-white text-xs font-bold px-6 py-2.5 rounded-lg"
          >
            START SHOPPING
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <button
        onClick={() => setView("store")}
        className="flex items-center gap-1.5 text-xs font-bold text-[#7D1C1C] hover:underline mb-6"
      >
        <ArrowLeft size={14} /> BACK TO STOREFRONT
      </button>
      <h2 className="font-serif text-3xl font-bold text-center text-[#7D1C1C] mb-3">MY ORDERS</h2>
      <p className="text-center text-xs text-[#7A5F50] mb-8">Track and manage all your orders in one place.</p>
      
      <div className="space-y-4">
        {userOrders.map((order: any) => {
          const statusColors: Record<string, string> = {
            Ordered: "bg-blue-100 text-blue-800 border-blue-200",
            Confirmed: "bg-blue-100 text-blue-800 border-blue-200",
            "Cancellation Requested": "bg-amber-100 text-amber-800 border-amber-200",
            Packed: "bg-indigo-100 text-indigo-800 border-indigo-200",
            Shipped: "bg-purple-100 text-purple-800 border-purple-200",
            Delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
            Cancelled: "bg-rose-100 text-rose-800 border-rose-200",
          };
          const statusClass = statusColors[order.order_status] || "bg-gray-100 text-gray-600 border-gray-200";

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-[#F5EFE6] shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Order Header */}
              <div className="bg-[#FCFAF7] px-6 py-4 border-b border-[#F5EFE6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-sm text-[#7D1C1C] font-serif">{order.order_id}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusClass}`}>
                      {order.order_status}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#7A5F50] flex items-center gap-1.5">
                    <Calendar size={11} />
                    {new Date(order.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {order.cancellation_reason && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      Cancellation reason: {order.cancellation_reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-[#7D1C1C]">₹{parseFloat(order.total_amount).toLocaleString("en-IN")}</span>
                  {(order.order_status === "Ordered" || order.order_status === "Confirmed") && (
                    <button
                      onClick={() => openCancelModal(order.order_id)}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-3 py-2 rounded-lg uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      <X size={11} /> CANCEL ORDER
                    </button>
                  )}
                  <button
                    onClick={() => onTrackOrder(order.order_id)}
                    className="bg-[#7D1C1C] hover:bg-[#631414] text-white text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider transition-colors flex items-center gap-1.5"
                  >
                    <Clock size={11} /> TRACK ORDER
                  </button>
                </div>
              </div>

              {/* Order Items */}
              <div className="px-6 py-4">
                <div className="flex flex-wrap gap-4">
                  {order.items && order.items.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 bg-[#FCFAF7] px-3 py-2 rounded-lg border border-[#F5EFE6]">
                      {item.product_image && (
                        <img src={item.product_image} alt={item.product_name} className="w-10 h-12 object-cover rounded border border-[#E9DCC9]" />
                      )}
                      <div className="text-xs">
                        <p className="font-semibold text-[#1C0806] line-clamp-1 max-w-[140px]">{item.product_name}</p>
                        {item.category_name && <p className="text-[10px] text-[#C4913A] font-bold uppercase tracking-wider">{item.category_name}</p>}
                        <p className="text-[10px] text-[#7A5F50] mt-0.5">Qty: {item.quantity} × ₹{parseFloat(item.price).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shipping address summary */}
                <div className="mt-3 pt-3 border-t border-[#F5EFE6] flex items-center gap-2 text-[11px] text-[#7A5F50]">
                  <MapPin size={12} className="text-[#7D1C1C] flex-shrink-0" />
                  <span className="truncate">
                    {order.address}, {order.city}, {order.state} - {order.pincode}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {cancelOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-[#E9DCC9] shadow-xl w-full max-w-md p-6">
            <h3 className="font-serif text-xl font-bold text-[#7D1C1C] mb-1">Cancel Order</h3>
            <p className="text-xs text-[#7A5F50] mb-5">
              Please tell us why you want to cancel order <span className="font-bold">{cancelOrderId}</span>.
            </p>

            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7A5F50] mb-2">
              Reason for cancellation *
            </label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full border border-[#E9DCC9] rounded-lg px-3 py-2.5 text-sm bg-white mb-4 focus:outline-none focus:ring-2 focus:ring-[#7D1C1C]/30"
            >
              <option value="">Select a reason</option>
              {CANCELLATION_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>

            {cancelReason === "Other" && (
              <textarea
                value={cancelOtherReason}
                onChange={(e) => setCancelOtherReason(e.target.value)}
                placeholder="Please describe your reason..."
                rows={3}
                className="w-full border border-[#E9DCC9] rounded-lg px-3 py-2.5 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-[#7D1C1C]/30"
              />
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeCancelModal}
                disabled={cancelSubmitting}
                className="px-4 py-2 text-xs font-bold text-[#7A5F50] border border-[#E9DCC9] rounded-lg hover:bg-[#FCFAF7] disabled:opacity-50"
              >
                KEEP ORDER
              </button>
              <button
                onClick={handleSubmitCancellation}
                disabled={cancelSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {cancelSubmitting ? "SUBMITTING..." : "SUBMIT CANCELLATION"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface OrderDetailsViewProps {
  selectedOrderId: string | null;
  setView: (view: View) => void;
  token: string | null;
  triggerNotification: (msg: string, type?: "success" | "error" | "info") => void;
  isAdminView: boolean;
  showThankYou?: boolean;
  onBack: () => void;
  backLabel: string;
}

function OrderDetailsView({
  selectedOrderId,
  setView,
  token,
  triggerNotification,
  isAdminView,
  showThankYou = false,
  onBack,
  backLabel
}: OrderDetailsViewProps) {
  const [trackOrder, setTrackOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [helpItem, setHelpItem] = useState<any>(null);
  const [problemDescription, setProblemDescription] = useState("");
  const [reviewedProductIds, setReviewedProductIds] = useState<Set<string>>(new Set());
  const [pendingReviews, setPendingReviews] = useState<Record<string, { rating: number; text: string }>>({});
  const [submittingReviewFor, setSubmittingReviewFor] = useState<string | null>(null);

  const handleHelpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemDescription.trim()) return;

    const waNumber = "916281120225";
    const text = `Hello Sunithaprasad Fashion World,\n\nI need help/replacement for my order.\n\n*Order Details*:\n- Order ID: ${trackOrder.order_id}\n- Product: ${helpItem.product_name}${helpItem.variant_color ? ` (Color: ${helpItem.variant_color})` : ""}\n- Price: ₹${parseFloat(helpItem.price).toLocaleString("en-IN")}\n\n*Problem Description*:\n${problemDescription.trim()}\n\nNote: I will share the uncut opening video proof for the damage.`;
    
    const waUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(text)}`;
    
    setHelpItem(null);
    setProblemDescription("");
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (selectedOrderId) {
      const fetchOrder = async () => {
        try {
          const res = await ordersAPI.getById(selectedOrderId);
          setTrackOrder(res.data);
        } catch (err) {
          triggerNotification("Failed to load order timeline tracking details.", "error");
        } finally {
          setLoading(false);
        }
      };
      fetchOrder();
    }
  }, [selectedOrderId]);

  useEffect(() => {
    if (!trackOrder || isAdminView || trackOrder.order_status !== "Delivered" || !token) return;

    const loadReviewStatus = async () => {
      try {
        const res = await reviewsAPI.getMine();
        const reviewed = new Set<string>(res.data.map((r: any) => r.product_id));
        setReviewedProductIds(reviewed);

        const initial: Record<string, { rating: number; text: string }> = {};
        trackOrder.items?.forEach((item: any) => {
          if (!reviewed.has(item.product_id)) {
            initial[item.product_id] = { rating: 5, text: "" };
          }
        });
        setPendingReviews(initial);
      } catch (err) {
        console.error("Failed to load review status:", err);
      }
    };
    loadReviewStatus();
  }, [trackOrder, token, isAdminView]);

  const handleItemReviewSubmit = async (productId: string, e: React.FormEvent) => {
    e.preventDefault();
    const pending = pendingReviews[productId];
    if (!pending?.text.trim()) return;
    if (!token) {
      triggerNotification("Please login to submit a review.", "error");
      return;
    }

    setSubmittingReviewFor(productId);
    try {
      await reviewsAPI.create({
        product_id: productId,
        rating: pending.rating,
        review: pending.text.trim()
      });
      setReviewedProductIds((prev) => new Set([...prev, productId]));
      triggerNotification("Thank you for your review!");
    } catch (err) {
      triggerNotification("Failed to submit review.", "error");
    } finally {
      setSubmittingReviewFor(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-[#7D1C1C]/30 border-t-[#7D1C1C] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-[#7A5F50] mt-3 uppercase tracking-wider">Querying Order Registry...</p>
        </div>
      </div>
    );
  }

  if (!trackOrder) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-[#7D1C1C] hover:underline mb-6"
        >
          <ArrowLeft size={14} /> {backLabel}
        </button>
        <p className="text-center py-10">Order timeline could not be found.</p>
      </div>
    );
  }

  const getShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const year = date.getFullYear().toString().slice(-2);
    const day = date.getDate();
    let suffix = "th";
    if (day === 1 || day === 21 || day === 31) suffix = "st";
    else if (day === 2 || day === 22) suffix = "nd";
    else if (day === 3 || day === 23) suffix = "rd";
    return `${weekday}, ${day}${suffix} ${month} '${year}`;
  };

  const getFullDateTime = (dateStr: string) => {
    const short = getShortDate(dateStr);
    const date = new Date(dateStr);
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).toLowerCase();
    return `${short} - ${timeStr}`;
  };

  const currentStatus = trackOrder.order_status;
  const isOrdered = trackOrder.payment_status === 'paid' || !['Pending'].includes(currentStatus);
  const isPacked = ["Packed", "Shipped", "Delivered"].includes(currentStatus);
  const isShipped = ["Shipped", "Delivered"].includes(currentStatus);
  const isDelivered = currentStatus === "Delivered";

  const steps = [
    {
      title: "Ordered",
      isCompleted: isOrdered,
      date: trackOrder.created_at ? getShortDate(trackOrder.created_at) : "",
      desc: isOrdered ? "Your order has been placed and payment confirmed." : "Awaiting payment confirmation.",
      timeDesc: trackOrder.created_at ? getFullDateTime(trackOrder.created_at) : ""
    },
    {
      title: "Packed",
      isCompleted: isPacked,
      date: isPacked && trackOrder.packed_at ? getShortDate(trackOrder.packed_at) : "",
      desc: isPacked ? "Seller has processed your order." : "Seller processing your order.",
      timeDesc: isPacked && trackOrder.packed_at ? getFullDateTime(trackOrder.packed_at) : ""
    },
    {
      title: "Shipped",
      isCompleted: isShipped,
      date: (isShipped && trackOrder.shipped_at) ? getShortDate(trackOrder.shipped_at) : "",
      desc: isShipped 
        ? "Ekart Logistics - FMPC0877873442\nYour item has been shipped."
        : "Item yet to be shipped.",
      timeDesc: (isShipped && trackOrder.shipped_at) ? getFullDateTime(trackOrder.shipped_at) : ""
    },
    {
      title: isDelivered ? "Delivered" : "Delivery Expected",
      isCompleted: isDelivered,
      date: trackOrder.delivered_at 
        ? getShortDate(trackOrder.delivered_at) 
        : getShortDate(new Date(new Date(trackOrder.created_at).getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()),
      desc: isDelivered ? "Your item has been delivered." : "Item yet to be delivered.",
      timeDesc: trackOrder.delivered_at ? getFullDateTime(trackOrder.delivered_at) : ""
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-bold text-[#7D1C1C] hover:underline mb-6"
      >
        <ArrowLeft size={14} /> {backLabel}
      </button>

      <div className="space-y-6">
        {/* Post-payment thank you confirmation */}
        {showThankYou && !isAdminView && (
          <div className="relative overflow-hidden rounded-2xl border border-[#E9DCC9] shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-[#7D1C1C] via-[#631414] to-[#4a0f0f]" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#C4913A]/25 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#F5D08A]/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

            <div className="relative px-6 py-8 md:px-10 md:py-10 text-white">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full bg-[#C4913A]/20 border-2 border-[#C4913A]/60 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <CheckCircle size={36} className="text-[#F5D08A]" strokeWidth={2} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[#F5D08A] text-[10px] font-bold uppercase tracking-[0.25em] mb-2">
                    Payment Successful
                  </p>
                  <h2 className="font-serif text-2xl md:text-[1.75rem] font-bold leading-tight mb-3">
                    Thank you for your order!
                  </h2>
                  <p className="text-white/90 text-sm md:text-[15px] leading-relaxed max-w-2xl">
                    Your order has been confirmed. The expected delivery date will be communicated to you via email shortly.
                  </p>
                  <p className="text-white/75 text-sm leading-relaxed mt-3 max-w-2xl">
                    If you have any questions or concerns, please feel free to reach out to us via the help section on this page.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-6">
                    <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-[11px] font-bold px-3.5 py-2 rounded-full tracking-wide">
                      <Package size={13} className="text-[#F5D08A]" />
                      {trackOrder.order_id}
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-[11px] font-semibold px-3.5 py-2 rounded-full">
                      <Mail size={13} className="text-[#F5D08A]" />
                      Confirmation sent to {trackOrder.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById("order-help-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="inline-flex items-center gap-1.5 bg-[#C4913A] hover:bg-[#b0822f] text-white text-[11px] font-bold px-4 py-2.5 rounded-lg transition-colors shadow-md"
                    >
                      <Headphones size={14} />
                      Get Help
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative h-1 bg-gradient-to-r from-transparent via-[#C4913A] to-transparent" />
          </div>
        )}

        {/* Timeline progress card styled like the user request */}
        <div className="bg-white p-8 rounded-2xl border border-[#F5EFE6] shadow-sm">
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#F5EFE6]">
            <div>
              <span className="text-[10px] text-[#7A5F50] uppercase tracking-wider font-semibold">Timeline Tracking</span>
              <h3 className="font-serif text-xl font-bold text-[#7D1C1C]">Order Reference: {trackOrder.order_id}</h3>
            </div>
            <span className="bg-[#7D1C1C]/10 text-[#7D1C1C] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-[#7D1C1C]/20">
              {trackOrder.order_status}
            </span>
          </div>

          {/* Vertical Stepper timeline */}
          <div className="max-w-md mx-auto py-4">
            <div className="relative pl-8 space-y-8">
              {steps.map((step, idx) => {
                const isCompleted = step.isCompleted;
                return (
                  <div key={idx} className="relative pb-2 last:pb-0">
                    {/* Line segment to next step */}
                    {idx < steps.length - 1 && (
                      <div className={`absolute left-[-21px] top-5 bottom-[-34px] w-0.5 ${
                        isCompleted ? 'bg-emerald-500' : 'bg-gray-200'
                      }`} />
                    )}

                    {/* Circle Node indicator */}
                    <div className={`absolute left-[-29px] top-1 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isCompleted 
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow' 
                        : 'bg-white border-gray-300'
                    }`} style={{ width: '18px', height: '18px' }}>
                      {isCompleted && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pl-1">
                      <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                        <h4 className={`text-sm font-bold tracking-wide ${
                          isCompleted ? 'text-[#1C0806]' : 'text-gray-400'
                        }`}>
                          {step.title}
                        </h4>
                      </div>
                      
                      {/* Sub-details (Ekart log info, etc) */}
                      <p className={`text-xs mt-1 leading-relaxed ${
                        isCompleted ? 'text-[#7A5F50]' : 'text-gray-400'
                      }`} style={{ whiteSpace: 'pre-line' }}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Post-delivery: rate products & need help */}
          {isDelivered && !isAdminView && trackOrder.items?.length > 0 && (
            <div className="mt-8 pt-8 border-t border-[#F5EFE6]">
              <div className="flex items-center gap-2 mb-1">
                <Star size={15} className="text-[#C4913A] fill-[#C4913A]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C]">Rate Your Purchase</h4>
              </div>
              <p className="text-xs text-[#7A5F50] mb-5">
                Your order has been delivered! Share your experience or reach out if you need help.
              </p>

              <div className="space-y-4">
                {trackOrder.items.map((item: any) => (
                  <div key={item.id} className="border border-[#E9DCC9] rounded-xl p-4 bg-[#FCFAF7]">
                    <div className="flex gap-4 items-start">
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="w-14 h-[72px] object-cover rounded-lg border border-[#E9DCC9] flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-xs text-[#1C0806]">{item.product_name}</span>
                            {item.variant_color && (
                              <p className="text-[10px] text-[#7A5F50] mt-0.5">Color: {item.variant_color}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setHelpItem(item);
                              setProblemDescription("");
                            }}
                            className="inline-flex items-center gap-1 bg-white hover:bg-[#7D1C1C]/10 border border-[#7D1C1C]/25 text-[#7D1C1C] text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                          >
                            <Headphones size={12} />
                            Need Help?
                          </button>
                        </div>

                        {reviewedProductIds.has(item.product_id) ? (
                          <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-700 font-semibold">
                            <CheckCircle size={14} />
                            You already reviewed this saree. Thank you!
                          </div>
                        ) : (
                          <form
                            onSubmit={(e) => handleItemReviewSubmit(item.product_id, e)}
                            className="mt-3 space-y-3"
                          >
                            <div>
                              <label className="block text-[10px] text-[#7A5F50] font-bold uppercase tracking-wider mb-1">
                                Your Rating
                              </label>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() =>
                                      setPendingReviews((prev) => ({
                                        ...prev,
                                        [item.product_id]: {
                                          ...prev[item.product_id],
                                          rating: i + 1
                                        }
                                      }))
                                    }
                                    className="p-0.5 transition-transform hover:scale-110"
                                  >
                                    <Star
                                      size={20}
                                      className={
                                        i < (pendingReviews[item.product_id]?.rating ?? 5)
                                          ? "fill-[#C4913A] text-[#C4913A]"
                                          : "text-gray-300"
                                      }
                                    />
                                  </button>
                                ))}
                                <span className="text-[10px] text-[#7A5F50] ml-2 font-semibold">
                                  {pendingReviews[item.product_id]?.rating ?? 5} / 5
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] text-[#7A5F50] font-bold uppercase tracking-wider mb-1">
                                Your Review
                              </label>
                              <textarea
                                required
                                rows={2}
                                value={pendingReviews[item.product_id]?.text ?? ""}
                                onChange={(e) =>
                                  setPendingReviews((prev) => ({
                                    ...prev,
                                    [item.product_id]: {
                                      rating: prev[item.product_id]?.rating ?? 5,
                                      text: e.target.value
                                    }
                                  }))
                                }
                                placeholder="How was the fabric, color, and border work?"
                                className="w-full text-xs border border-[#E9DCC9] rounded-lg p-2.5 bg-white focus:outline-none focus:border-[#7D1C1C]"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={submittingReviewFor === item.product_id}
                              className="bg-[#7D1C1C] hover:bg-[#631414] disabled:opacity-60 text-white text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider transition-colors"
                            >
                              {submittingReviewFor === item.product_id ? "Submitting..." : "Submit Review"}
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Order Details & Summary Card */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            
            {/* Products purchased */}
            <div id="order-help-section" className="bg-white p-6 rounded-2xl border border-[#F5EFE6] shadow-sm scroll-mt-24">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C] mb-4">Woven Masterpieces</h4>
              <div className="divide-y divide-[#F5EFE6]">
                {trackOrder.items && trackOrder.items.map((item: any) => (
                  <div key={item.id} className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="flex gap-4">
                      <img src={item.product_image} alt={item.product_name} className="w-12 h-16 object-cover rounded-lg border border-[#E9DCC9]" />
                      <div className="text-xs">
                        <span className="font-bold text-[#1C0806]">{item.product_name}</span>
                        {item.category_name && <p className="text-[10px] text-[#C4913A] font-bold uppercase tracking-wider mt-0.5">{item.category_name}</p>}
                        <p className="text-[10px] text-[#7A5F50] mt-0.5">Color: {item.variant_color || 'N/A'}</p>
                        <p className="text-[#7A5F50] mt-1">₹{parseFloat(item.price).toLocaleString("en-IN")} × {item.quantity}</p>
                      </div>
                    </div>
                    {!isAdminView && !isDelivered && (
                      <button
                        onClick={() => {
                          setHelpItem(item);
                          setProblemDescription("");
                        }}
                        className="bg-[#7D1C1C]/5 hover:bg-[#7D1C1C]/15 border border-[#7D1C1C]/25 text-[#7D1C1C] text-[10px] font-bold px-3 py-1.5 rounded transition-colors"
                      >
                        Need Help?
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white p-6 rounded-2xl border border-[#F5EFE6] shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C] mb-3">Delivery Information</h4>
              <div className="text-xs text-[#7A5F50] leading-relaxed">
                <strong className="text-[#1C0806]">{trackOrder.customer_name}</strong>
                <p className="mt-1">{trackOrder.address}, {trackOrder.city}, {trackOrder.state} - {trackOrder.pincode}</p>
                <p className="mt-1">📞 {trackOrder.mobile}</p>
              </div>
            </div>
          </div>

          {/* Bill Invoice Summary */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-[#F5EFE6] shadow-sm text-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7D1C1C] mb-4">Invoice Breakdown</h4>
              <div className="space-y-2.5 text-[#7A5F50]">
                <div className="flex justify-between">
                  <span>Product Cost</span>
                  <span className="font-semibold text-[#1C0806]">
                    ₹{getItemsSubtotalFromOrder(trackOrder).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charges</span>
                  <span className="font-semibold text-[#1C0806]">₹{parseFloat(trackOrder.delivery_charge || 100).toLocaleString("en-IN")}</span>
                </div>
                {parseFloat(trackOrder.weekend_discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Weekend Offer</span>
                    <span className="font-semibold">-₹{parseFloat(trackOrder.weekend_discount).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {parseFloat(trackOrder.gateway_charge || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Payment gateway charges</span>
                    <span className="font-semibold text-[#1C0806]">₹{parseFloat(trackOrder.gateway_charge).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Total Amount</span>
                  <span className="font-bold text-[#7D1C1C] text-sm">₹{parseFloat(trackOrder.total_amount).toLocaleString("en-IN")}</span>
                </div>
                <div className="border-t border-[#F5EFE6] pt-3">
                  <span className="block text-[10px] text-[#7A5F50] font-bold">PAYMENT TYPE:</span>
                  <span className="text-[#1C0806] font-semibold">Razorpay Online Gateway</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Help Problem Form Modal — users only */}
      {!isAdminView && helpItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-[#E9DCC9] shadow-2xl relative">
            <button
              onClick={() => { setHelpItem(null); setProblemDescription(""); }}
              className="absolute right-4 top-4 text-gray-400 hover:text-black"
            >
              <X size={18} />
            </button>
            <div className="text-center mb-4">
              <h4 className="font-serif text-lg font-bold text-[#7D1C1C]">
                Request Replacement
              </h4>
              <p className="text-[11px] text-[#7A5F50] mt-1">
                For order item: <strong>{helpItem.product_name}</strong>
              </p>
            </div>
            
            <form onSubmit={handleHelpSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#7A5F50] font-bold mb-1 uppercase tracking-wider">
                  Describe the issue:
                </label>
                <textarea
                  required
                  rows={4}
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder="Explain the damage or issue. Please note: exchanges are only accepted for damage. An uncut opening video proof is required."
                  className="w-full border border-[#E9DCC9] rounded p-2 focus:outline-none focus:border-[#7D1C1C]"
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-[#7D1C1C] hover:bg-[#631414] text-white text-xs py-2.5 rounded font-bold uppercase tracking-wider transition-colors shadow-sm"
              >
                Submit & Open WhatsApp
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
