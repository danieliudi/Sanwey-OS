import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import LeadCaptureForm from "./components/public/LeadCaptureForm";
import JobApplicationForm from "./components/public/JobApplicationForm";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/captura/:slug" element={<LeadCaptureForm />} />
        <Route path="/vagas/:slug" element={<JobApplicationForm />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
