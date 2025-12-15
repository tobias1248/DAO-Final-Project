import React from "react";
import ReactDOM from "react-dom/client";
import { ThirdwebProvider } from "@thirdweb-dev/react";
import { Sepolia } from "@thirdweb-dev/chains"; // 指定測試網
import App from "./App";
import "./index.css";

// 從環境變數載入 Thirdweb Client ID（請在 .env 中設定 VITE_THIRDWEB_CLIENT_ID）
const CLIENT_ID = import.meta.env.VITE_THIRDWEB_CLIENT_ID;

if (!CLIENT_ID) {
  console.warn("Missing VITE_THIRDWEB_CLIENT_ID in environment.");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThirdwebProvider 
      activeChain={Sepolia} 
      clientId={CLIENT_ID}
    >
      <App />
    </ThirdwebProvider>
  </React.StrictMode>
);
