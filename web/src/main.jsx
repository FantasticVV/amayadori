import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { BRAND } from "./config/brand";
import "./style.css";

// 店名单一真源：页面标题也从 brand.ts 来（index.html 里不写店名）
document.title = BRAND.displayName;

createRoot(document.getElementById("root")).render(<App />);
