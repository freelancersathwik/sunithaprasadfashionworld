  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { AuthProvider } from "./app/AuthContext.tsx";
  import { loadRazorpay } from "./app/razorpay.ts";

  // Preload Razorpay checkout SDK early so it's ready at payment time
  loadRazorpay();

  createRoot(document.getElementById("root")!).render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );