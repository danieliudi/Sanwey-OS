import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import LeadCaptureForm from "./components/public/LeadCaptureForm";
import JobApplicationForm from "./components/public/JobApplicationForm";
import MarketingRequestForm from "./components/public/MarketingRequestForm";
import PurchaseRequestForm from "./components/public/PurchaseRequestForm";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/captura/:slug" element={<LeadCaptureForm />} />
        <Route path="/vagas/:slug" element={<JobApplicationForm />} />
        <Route path="/solicitar-marketing" element={<MarketingRequestForm />} />
        <Route path="/solicitar-compra" element={<PurchaseRequestForm />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
