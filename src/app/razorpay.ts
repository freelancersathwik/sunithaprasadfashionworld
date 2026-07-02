const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

let loadPromise: Promise<boolean> | null = null;

/** Ensure Razorpay checkout.js is loaded (idempotent). */
export function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(!!window.Razorpay));
      existing.addEventListener('error', () => resolve(false));
      // Script tag exists but Razorpay not ready yet — poll briefly
      const deadline = Date.now() + 8000;
      const poll = () => {
        if (window.Razorpay) return resolve(true);
        if (Date.now() > deadline) return resolve(false);
        setTimeout(poll, 100);
      };
      poll();
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function isRazorpayReady(): boolean {
  return !!window.Razorpay;
}
