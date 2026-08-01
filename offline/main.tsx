import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@xyflow/react/dist/style.css";
import "@/app/globals.css";
import { FamilyTreeApp } from "@/components/FamilyTreeApp";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Offline application root is missing.");
}

const mode = new URLSearchParams(window.location.search).has("admin")
  ? "admin"
  : "visitor";

createRoot(root).render(
  <StrictMode>
    <FamilyTreeApp mode={mode} />
  </StrictMode>,
);
