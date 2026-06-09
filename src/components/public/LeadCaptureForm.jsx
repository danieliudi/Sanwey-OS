import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";

const PRIORITIES = ["Alta", "Média", "Baixa"];

// Pequena lista padrão. Em uma evolução, pode vir de uma tabela por empresa.
const DEFAULT_PRODUCTS = [
  "Big Bag",
  "Embalagem industrial",
  "Logística reversa",
  "Produto especial",
  "Outros",
];

function formatPhone(digits) {
  const d = (digits || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function LeadCaptureForm() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const source = params.get("src") || "site";

  const companyId = COMPANY_IDS.includes(slug) ? slug : null;
  const company = companyId ? COMPANIES[companyId] : null;
  const accent = company?.primary || "#b5000b";

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    email: "",
    product: "",
    priority: "",
    prospectDate: todayISO(),
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = company
      ? `${company.name} · Contato comercial`
      : "Sanwey · Contato comercial";
  }, [company]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const canSubmit = useMemo(() => (
    form.customerName.trim().length >= 2 &&
    form.phone.replace(/\D/g, "").length >= 10 &&
    form.prospectDate &&
    !submitting
  ), [form, submitting]);

  if (!companyId) {
    return (
      <ShellCard>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Link inválido</h1>
        <p style={{ color: "#5c5f60", fontSize: 14 }}>
          O endereço deste formulário não corresponde a nenhuma empresa do grupo.
        </p>
      </ShellCard>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <ShellCard>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Indisponível</h1>
        <p style={{ color: "#5c5f60", fontSize: 14 }}>
          O sistema está em modo demonstração. Tente novamente em instantes.
        </p>
      </ShellCard>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc("submit_lead_capture", {
        p_company_id: companyId,
        p_customer_name: form.customerName.trim(),
        p_contact_phone: form.phone.replace(/\D/g, ""),
        p_contact_email: form.email.trim() || null,
        p_product_interest: form.product || null,
        p_priority: form.priority || null,
        p_prospect_date: form.prospectDate,
        p_notes: form.notes.trim() || null,
        p_source: source,
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
      <ShellCard accent={accent}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: "50%",
              background: accent + "1A", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <CheckCircle2 size={28} color={accent} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#201a1a", margin: 0 }}>
            Recebido!
          </h1>
          <p style={{ color: "#5c5f60", fontSize: 14, maxWidth: 360, margin: 0 }}>
            Obrigado pelo contato. Um consultor da <strong>{company.name}</strong> entrará em contato em breve pelos dados informados.
          </p>
        </div>
      </ShellCard>
    );
  }

  return (
    <ShellCard accent={accent}>
      <header style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "4px 10px", borderRadius: 999,
            background: accent + "14", color: accent,
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
            marginBottom: 12,
          }}
        >
          {company.name}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#201a1a", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Fale com a {company.name}
        </h1>
        <p style={{ color: "#5c5f60", fontSize: 14, margin: 0, lineHeight: 1.55 }}>
          Preencha as informações abaixo. Um consultor entra em contato para entender sua necessidade.
        </p>
      </header>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Nome do Cliente" hint="Nome do cliente ou empresa" required>
          <input
            type="text"
            value={form.customerName}
            onChange={e => set("customerName", e.target.value)}
            placeholder="Digite aqui …"
            style={input}
          />
        </Field>

        <Field label="Contato" hint="Telefone ou celular do cliente" required>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              border: "1px solid #D1D5DB", borderRadius: 6, padding: "8px 10px",
              background: "#F9FAFB", fontSize: 13, color: "#201a1a", flexShrink: 0,
            }}>
              🇧🇷 +55
            </div>
            <input
              type="tel"
              value={form.phone}
              onChange={e => set("phone", formatPhone(e.target.value))}
              placeholder="(99) 99999-9999"
              style={{ ...input, flex: 1 }}
            />
          </div>
        </Field>

        <Field label="E-mail" hint="E-mail do cliente">
          <input
            type="email"
            value={form.email}
            onChange={e => set("email", e.target.value)}
            placeholder="email@dominio.com"
            style={input}
          />
        </Field>

        <Field label="Produto de Interesse" hint="Produto ou serviço de interesse">
          <select
            value={form.product}
            onChange={e => set("product", e.target.value)}
            style={{
              ...input, appearance: "none", paddingRight: 32,
              backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
              backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "14px",
            }}
          >
            <option value="">Escolha uma opção</option>
            {DEFAULT_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <Field label="Prioridade" hint="Nível de prioridade">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRIORITIES.map(p => {
              const selected = form.priority === p;
              const color = p === "Alta" ? "#DC2626" : p === "Média" ? "#E8920A" : "#16A34A";
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("priority", selected ? "" : p)}
                  style={{
                    padding: "6px 14px", borderRadius: 999,
                    border: `1px solid ${selected ? color : "#D1D5DB"}`,
                    background: selected ? color + "14" : "#FFFFFF",
                    color: selected ? color : "#5c5f60",
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Data de Prospecção" hint="Data inicial de contato" required>
          <input
            type="date"
            value={form.prospectDate}
            onChange={e => set("prospectDate", e.target.value)}
            style={input}
          />
        </Field>

        <Field label="Mensagem (opcional)" hint="Conte um pouco sobre sua necessidade">
          <textarea
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder="Digite aqui …"
            rows={4}
            style={{ ...input, resize: "vertical", fontFamily: "inherit" }}
          />
        </Field>

        {error && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: 12, borderRadius: 8,
            background: "#FEF2F2", color: "#B91C1C",
            fontSize: 13, border: "1px solid #FECACA",
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            marginTop: 4,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: canSubmit ? accent : "#D1D5DB",
            color: "#FFFFFF",
            border: "none", borderRadius: 8,
            padding: "12px 20px", fontSize: 14, fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? "Enviando…" : "Enviar"}
        </button>

        <p style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.5, marginTop: 8 }}>
          Nunca envie senhas ou dados confidenciais por meio de formulários
          desconhecidos. Ao enviar, você concorda em ser contatado pela {company.name}.
        </p>
      </form>
    </ShellCard>
  );
}

const input = {
  width: "100%",
  fontSize: 14,
  borderRadius: 6,
  border: "1px solid #D1D5DB",
  padding: "10px 12px",
  color: "#201a1a",
  background: "#FFFFFF",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 2 }}>
        {required && <span style={{ color: "#b5000b", marginRight: 4 }}>*</span>}
        {label}
      </label>
      {hint && <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{hint}</div>}
      {children}
    </div>
  );
}

function ShellCard({ children, accent = "#b5000b" }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F9FAFB",
      padding: "32px 16px",
      fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        maxWidth: 560,
        margin: "0 auto",
        background: "#FFFFFF",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        border: "1px solid #E5E7EB",
        padding: 32,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: accent,
        }} />
        {children}
      </div>
      <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 11, marginTop: 16 }}>
        © Grupo Sanwey · Commercial Intelligence
      </p>
    </div>
  );
}
