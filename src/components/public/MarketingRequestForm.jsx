import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { COMPANY_IDS } from "../../constants/companies";
import {
  DELIVERABLE_DEPARTMENTS,
  DELIVERABLE_PRIORITIES,
  DELIVERABLE_REQUEST_TYPES,
} from "../../constants/marketing-pipelines";

const ACCENT = "#C7212B";

const shell = {
  minHeight: "100vh",
  background: "#F5F3F0",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "40px 16px 60px",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const card = {
  background: "#FFFFFF",
  borderRadius: 20,
  boxShadow: "var(--shadow-pop)",
  padding: "36px 32px",
  width: "100%",
  maxWidth: 540,
};

const input = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1.5px solid #D1D5DB",
  fontSize: 14,
  color: "#201a1a",
  background: "#FAFAF9",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color .15s",
};

const label = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
};

const hint = {
  fontSize: 11,
  color: "#9CA3AF",
  marginBottom: 4,
};

function Field({ label: lbl, children, hint: h, required }) {
  return (
    <div>
      <label style={label}>
        {lbl}
        {required && <span style={{ color: ACCENT, marginLeft: 3 }}>*</span>}
      </label>
      {h && <p style={hint}>{h}</p>}
      {children}
    </div>
  );
}

const COMPANY_LABELS = {
  industria: "Industria",
  resibag:   "Resibag",
};

export default function MarketingRequestForm() {
  const [form, setForm] = useState({
    title:          "",
    requesterName:  "",
    requesterEmail: "",
    department:     "",
    requestType:    "",
    description:    "",
    priority:       "media",
    deadline:       "",
    companyIds:     [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    document.title = "Solicitar ao Marketing";
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleCompany = (id) =>
    setForm(prev => ({
      ...prev,
      companyIds: prev.companyIds.includes(id)
        ? prev.companyIds.filter(c => c !== id)
        : [...prev.companyIds, id],
    }));

  const canSubmit = useMemo(() => (
    form.title.trim().length >= 3 &&
    form.requesterName.trim().length >= 2 &&
    form.department.trim().length >= 1 &&
    form.requestType.length >= 1 &&
    !submitting
  ), [form, submitting]);

  if (!isSupabaseConfigured) {
    return (
      <div style={shell}>
        <div style={card}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Indisponível</h1>
          <p style={{ color: "#5c5f60", fontSize: 14 }}>
            O sistema está em modo demonstração. Tente novamente em instantes.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase.from("marketing_requests").insert({
        title:           form.title.trim(),
        requester_name:  form.requesterName.trim(),
        requester_email: form.requesterEmail.trim() || null,
        department:      form.department,
        request_type:    form.requestType,
        description:     form.description.trim() || null,
        priority:        form.priority,
        deadline:        form.deadline || null,
        company_ids:     form.companyIds.length > 0 ? form.companyIds : COMPANY_IDS,
        status:          "pendente",
      });
      if (err) throw err;
      setDone(true);
    } catch (err) {
      setError(err.message || "Não foi possível enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={shell}>
        <div style={card}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", padding: "20px 0" }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: "50%",
                background: ACCENT + "1A", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <CheckCircle2 size={32} color={ACCENT} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#201a1a", margin: 0 }}>
              Solicitação enviada!
            </h1>
            <p style={{ color: "#5c5f60", fontSize: 14, maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
              Recebemos seu pedido. A equipe de Marketing irá analisá-lo e você receberá um retorno em breve.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={card}>
        <header style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "4px 12px", borderRadius: 999,
              background: ACCENT + "14", color: ACCENT,
              fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
              marginBottom: 14,
            }}
          >
            Marketing · Sanwey
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#201a1a", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Solicitar ao Marketing
          </h1>
          <p style={{ color: "#5c5f60", fontSize: 14, margin: 0, lineHeight: 1.55 }}>
            Preencha as informações abaixo para abrir uma solicitação de criação de material. A equipe de Marketing irá analisar e dar retorno.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Quem solicita */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Seu nome" required>
              <input
                type="text"
                value={form.requesterName}
                onChange={e => set("requesterName", e.target.value)}
                placeholder="Nome completo"
                style={input}
              />
            </Field>
            <Field label="Seu e-mail">
              <input
                type="email"
                value={form.requesterEmail}
                onChange={e => set("requesterEmail", e.target.value)}
                placeholder="email@empresa.com"
                style={input}
              />
            </Field>
          </div>

          <Field label="Departamento" required>
            <select
              value={form.department}
              onChange={e => set("department", e.target.value)}
              style={{ ...input, cursor: "pointer" }}
            >
              <option value="">Selecione seu departamento…</option>
              {DELIVERABLE_DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>

          <Field label="Tipo de material" required>
            <select
              value={form.requestType}
              onChange={e => set("requestType", e.target.value)}
              style={{ ...input, cursor: "pointer" }}
            >
              <option value="">O que você precisa?</option>
              {DELIVERABLE_REQUEST_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field label="Título da solicitação" required hint="Ex: Banner para campanha de Black Friday">
            <input
              type="text"
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="Descreva brevemente o que precisa…"
              style={input}
            />
          </Field>

          <Field label="Descrição detalhada" hint="Informações extras, referências, objetivos, público-alvo etc.">
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Detalhe sua necessidade aqui…"
              rows={4}
              style={{ ...input, resize: "vertical", lineHeight: 1.5 }}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Prioridade">
              <select
                value={form.priority}
                onChange={e => set("priority", e.target.value)}
                style={{ ...input, cursor: "pointer" }}
              >
                {DELIVERABLE_PRIORITIES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Prazo desejado">
              <input
                type="date"
                value={form.deadline}
                onChange={e => set("deadline", e.target.value)}
                style={{ ...input, cursor: "pointer" }}
              />
            </Field>
          </div>

          <Field label="Empresa" hint="Selecione a(s) empresa(s) para as quais o material será criado">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {COMPANY_IDS.map(id => {
                const selected = form.companyIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCompany(id)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 8,
                      border: `1.5px solid ${selected ? ACCENT : "#D1D5DB"}`,
                      background: selected ? ACCENT + "10" : "#FAFAF9",
                      color: selected ? ACCENT : "#374151",
                      fontSize: 13,
                      fontWeight: selected ? 700 : 500,
                      cursor: "pointer",
                      transition: "all .15s",
                    }}
                  >
                    {COMPANY_LABELS[id] || id}
                  </button>
                );
              })}
            </div>
          </Field>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: "13px 24px",
              borderRadius: 12,
              border: "none",
              background: canSubmit ? ACCENT : "#E5E7EB",
              color: canSubmit ? "#FFFFFF" : "#9CA3AF",
              fontSize: 15,
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "background .15s",
              letterSpacing: "-0.01em",
            }}
          >
            {submitting ? "Enviando…" : "Enviar solicitação"}
          </button>
        </form>
      </div>
    </div>
  );
}
