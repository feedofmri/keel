import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/style.css";
import "./styles/app.css";
import "./styles/stages.css";
import "./styles/pages.css";
import "./styles/platform.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
