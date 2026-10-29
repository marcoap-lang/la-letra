import React from "react";
import { createRoot } from "react-dom/client";
import { AuthGate } from "./components/shop/auth-gate";
import { CloudSync } from "./components/shop/cloud-sync";
import { ShopApp } from "./components/shop/app";
import { registerServiceWorker } from "./lib/pwa";
import "./styles.css";

registerServiceWorker();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>
      {(user) => (
        <>
          <ShopApp />
          <CloudSync user={user} />
        </>
      )}
    </AuthGate>
  </React.StrictMode>,
);
