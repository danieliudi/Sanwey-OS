import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import LeadCaptureForm from "./components/public/LeadCaptureForm";
import JobApplicationForm from "./components/public/JobApplicationForm";
import TalentPoolForm from "./components/public/TalentPoolForm";
import MarketingRequestForm from "./components/public/MarketingRequestForm";
import PurchaseRequestForm from "./components/public/PurchaseRequestForm";
import ManagerVagaReviewPage from "./components/public/ManagerVagaReviewPage";
import PesquisaPublicaForm from "./components/public/PesquisaPublicaForm";
import BemEstarPublicaForm from "./components/public/BemEstarPublicaForm";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/captura/:slug" element={<LeadCaptureForm />} />
        <Route path="/vagas/:slug" element={<JobApplicationForm />} />
        <Route path="/trabalhe-conosco" element={<TalentPoolForm />} />
        <Route path="/solicitar-marketing" element={<MarketingRequestForm />} />
        <Route path="/solicitar-compra" element={<PurchaseRequestForm />} />
        <Route path="/gestor-vaga/:token" element={<ManagerVagaReviewPage />} />
        <Route path="/pesquisa/:id" element={<PesquisaPublicaForm />} />
        <Route path="/bem-estar/:id" element={<BemEstarPublicaForm />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
