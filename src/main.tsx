import React from "react";
import { createRoot } from "react-dom/client";
import { ShopApp } from "./components/shop/app";
import "./styles.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><ShopApp /></React.StrictMode>);
