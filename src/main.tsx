import React from "react";
import { createRoot } from "react-dom/client";
import { ShopApp } from "./components/shop/app";
import { CloudBackup } from "./components/shop/cloud-backup";
import "./styles.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><ShopApp /><CloudBackup /></React.StrictMode>);
