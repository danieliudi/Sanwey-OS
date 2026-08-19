import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileEdit, ShoppingCart } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { friendlyError } from "../../utils/friendly-error";
import { MARKETING_UNIT_IDS, MARKETING_UNIT_LABELS } from "../../constants/companies";
import { CurrencyInput } from "../ui/CurrencyInput";
import {
  DELIVERABLE_DEPARTMENTS,
  DELIVERABLE_PRIORITIES,
  DELIVERABLE_REQUEST_TYPES,
} from "../../constants/marketing-pipelines";

const ACCENT = "#CC2936";

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
  maxWidth: 560,
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

// Duas frentes de solicitação num só formulário (pedido do Daniel,
// 30/07/2026) — antes eram duas rotas/tabelas completamente separadas
// (/solicitar-marketing -> marketing_requests, /solicitar-compra ->
// marketing_purchase_requests direto, sem nenhum gate de aprovação). Os dois
// tipos agora entram como 'pendente' em marketing_requests (coluna `category`)
// e passam pela mesma fila de Solicitações — Compra só ganha a linha em
// marketing_purchase_requests quando aprovada (ver approve_marketing_request_
// as_purchase), sem escolha de destino nenhuma (isso só existe pra Material).
function TypeToggle({ category, onChange }) {
  const opts = [
    { id: "material", icon: FileEdit, title: "Material de Marketing", desc: "Criação de peça: banner, arte, vídeo, post, impresso…" },
    { id: "compra",   icon: ShoppingCart, title: "Compra", desc: "Um item já pronto: brinde, uniforme, material impresso de terceiro…" },
  ];
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
      {opts.map(opt => {
        const selected = category === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            style={{
              flex: 1, padding: "14px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
              border: `1.5px solid ${selected ? ACCENT : "#D1D5DB"}`,
              background: selected ? ACCENT + "0D" : "#FAFAF9",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 800, color: selected ? ACCENT : "#201a1a" }}>
              <Icon size={15} />
              {opt.title}
            </div>
            <div style={{ fontSize: 11.5, color: "#6B7280", marginTop: 3, lineHeight: 1.4 }}>{opt.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

export default function MarketingRequestForm({ defaultCategory = "material" }) {
  const [category, setCategory] = useState(defaultCategory);
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
    budget:         "",
    approverName:   "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [requestNumber, setRequestNumber] = useState(null);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    document.title = category === "compra" ? "Solicitar Compra ao Marketing" : "Solicitar ao Marketing";
  }, [category]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleCompany = (id) =>
    setForm(prev => ({
      ...prev,
      companyIds: prev.companyIds.includes(id)
        ? prev.companyIds.filter(c => c !== id)
        : [...prev.companyIds, id],
    }));

  // O que ainda falta preencher. Antes isso era só um booleano: o botão ficava
  // cinza e clicar não fazia nada, sem dizer por quê — e como "Material" exige
  // 3 campos a mais que "Compra", dava a impressão de que só Compra funcionava
  // (foi exatamente assim que o problema chegou, 11/08/2026).
  const missing = useMemo(() => {
    const m = [];
    if (form.requesterName.trim().length < 2) m.push("seu nome");
    if (category === "compra") {
      if (form.title.trim().length < 2) m.push("o que você precisa comprar");
    } else {
      if (form.department.trim().length < 1) m.push("departamento");
      if (form.requestType.length < 1) m.push("tipo de material");
      if (form.title.trim().length < 3) m.push("título da solicitação");
    }
    return m;
  }, [form, category]);

  const canSubmit = !submitting && missing.length === 0;

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
      // Gera o id no cliente pra poder buscar o número do protocolo depois —
      // um .select() após o insert falharia (RLS de leitura exige papel de
      // marketing, o formulário aqui é anônimo); ver get_marketing_request_number.
      const id = crypto.randomUUID();
      const { error: err } = await supabase.from("marketing_requests").insert({
        id,
        category:        category,
        title:            form.title.trim(),
        requester_name:   form.requesterName.trim(),
        requester_email:  form.requesterEmail.trim() || null,
        department:       category === "material" ? form.department : null,
        request_type:     category === "material" ? form.requestType : null,
        description:      form.description.trim() || null,
        priority:         category === "material" ? form.priority : "media",
        deadline:         form.deadline || null,
        company_ids:      form.companyIds.length > 0 ? form.companyIds : MARKETING_UNIT_IDS,
        budget:           category === "material" && form.budget !== "" ? form.budget : null,
        approver_name:    category === "material" ? (form.approverName.trim() || null) : null,
        status:           "pendente",
      });
      if (err) throw err;
      const { data: numberData } = await supabase.rpc("get_marketing_request_number", { p_id: id });
      setRequestNumber(numberData || null);
      setDone(true);
    } catch (err) {
      setError(friendlyError(err, "Não foi possível enviar. Tente novamente."));
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
            {requestNumber && (
              <div
                style={{
                  fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: ACCENT,
                  background: ACCENT + "14", borderRadius: 10, padding: "8px 18px", letterSpacing: "0.02em",
                }}
              >
                {requestNumber}
              </div>
            )}
            <p style={{ color: "#5c5f60", fontSize: 14, maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
              {category === "compra"
                ? `Recebemos sua solicitação de compra${requestNumber ? ` (protocolo ${requestNumber})` : ""}. A equipe de Marketing irá analisar e cuidar de toda a compra até a entrega.`
                : `Recebemos sua solicitação${requestNumber ? ` (protocolo ${requestNumber})` : ""}. A equipe de Marketing irá analisá-la e você receberá um retorno em breve.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={card}>
        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "4px 12px", borderRadius: 999,
              background: ACCENT + "14", color: ACCENT,
              fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
              marginBottom: 14,
            }}
          >
            {/* Achado U-03/U-04 da auditoria funcional (19/08/2026): rótulo e
                badge ficavam fixos em "Marketing · Sanwey"/"Solicitar ao
                Marketing" mesmo na rota de Compra e mesmo o formulário
                atendendo Sanwey, Resibag e Monte Mor — "Sanwey" sozinho
                sugeria a página errada pra quem solicitava das outras duas
                unidades. */}
            Marketing · Grupo Sanwey
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#201a1a", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {category === "compra" ? "Solicitar Compra" : "Solicitar ao Marketing"}
          </h1>
          <p style={{ color: "#5c5f60", fontSize: 14, margin: 0, lineHeight: 1.55 }}>
            O que você precisa? Escolha o tipo abaixo — o formulário se ajusta automaticamente.
          </p>
        </header>

        <TypeToggle category={category} onChange={setCategory} />

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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

          {category === "material" ? (
            <>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Orçamento (se aplicável)">
                  <CurrencyInput
                    value={form.budget}
                    onChange={v => set("budget", v)}
                    style={input}
                  />
                </Field>
                <Field label="Aprovação necessária de quem?" hint="Nome/cargo do aprovador interno">
                  <input
                    type="text"
                    value={form.approverName}
                    onChange={e => set("approverName", e.target.value)}
                    placeholder="Ex: Maria Silva, Gerente Financeiro"
                    style={input}
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="O que você precisa comprar?" required hint="Ex: Brinde personalizado para feira, uniforme, banner impresso já pronto">
                <input
                  type="text"
                  value={form.title}
                  onChange={e => set("title", e.target.value)}
                  placeholder="Nome do item"
                  style={input}
                />
              </Field>

              <Field label="Descrição detalhada" hint="Quantidade estimada, especificações, referências, onde será usado etc.">
                <textarea
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="Detalhe sua necessidade aqui…"
                  rows={4}
                  style={{ ...input, resize: "vertical", lineHeight: 1.5 }}
                />
              </Field>

              <Field label="Prazo desejado">
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => set("deadline", e.target.value)}
                  style={{ ...input, cursor: "pointer" }}
                />
              </Field>
            </>
          )}

          <Field label="Empresa / unidade" hint={category === "compra" ? "Selecione a(s) empresa(s) ou unidade para as quais a compra será feita" : "Selecione a(s) empresa(s) ou unidade para as quais o material será criado"}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {MARKETING_UNIT_IDS.map(id => {
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
                    {MARKETING_UNIT_LABELS[id] || id}
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

          {missing.length > 0 && !submitting && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FFFBEB", color: "#92400E", fontSize: 13 }}>
              Falta preencher: <strong>{missing.join(", ")}</strong>.
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
