import React, { useState, useEffect } from "react";
import {
  X, ArrowRight, ArrowLeft, Trash2,
  FileText, Activity, Paperclip, CheckSquare, MessageSquare,
  Send,
} from "lucide-react";
import { NEUTRAL, COMPANIES } from "../../constants/companies";
import {
  DELIVERABLE_STAGES,
  DELIVERABLE_REQUEST_TYPES,
  DELIVERABLE_DEPARTMENTS,
} from "../../constants/marketing-pipelines";
import { formatDateBR } from "../../utils/date";

/* ── Priority helpers ───────────────────────────────────────── */
const PRIORITY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_COLORS = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };

/* ── Stage-specific field configs ───────────────────────────── */
const STAGE_FIELDS = {
  solicitacao: [
    { key: "request_type",   label: "Tipo de Solicitação",          hint: "Selecione o tipo de solicitação...",           type: "select",     options: DELIVERABLE_REQUEST_TYPES, required: true },
    { key: "request_date",   label: "Data de Solicitação",          hint: "Informe a data em que a solicitação foi feita.", type: "date",      required: true },
    { key: "assignee",       label: "Responsável pela Solicitação", hint: "Selecione o responsável por esta solicitação.", type: "user",      required: true },
    { key: "request_status", label: "Status da Solicitação",        hint: "Informe o status atual da solicitação.",        type: "radio",     options: [{v:"pendente",l:"Pendente"},{v:"em_andamento",l:"Em andamento"},{v:"concluido",l:"Concluído"}] },
    { key: "observations",   label: "Observações",                  hint: "Adicione quaisquer observações adicionais.",    type: "textarea" },
  ],
  em_producao: [
    { key: "production_stage",     label: "Etapa Atual",                  hint: "Identifique a etapa atual do processo de produção.",       type: "select",     options: ["Planejamento","Desenvolvimento","Finalização"], required: true },
    { key: "production_start_date",label: "Data de Início da Produção",   hint: "Informe a data em que a produção foi iniciada.",            type: "date",       required: true },
    { key: "production_resources", label: "Recursos Alocados",            hint: "Liste os recursos alocados para esta fase.",                type: "textarea" },
    { key: "production_progress",  label: "Progresso Atual (%)",          hint: "Informe o progresso atual da produção em porcentagem.",     type: "number",     required: true },
    { key: "production_risks",     label: "Riscos Identificados",         hint: "Identifique possíveis riscos que podem impactar a produção.",type: "multicheck", options: ["Falta de materiais","Problemas técnicos","Atrasos na entrega","Outros"] },
  ],
  revisao: [
    { key: "revision_needed",   label: "Revisão Necessária",        hint: "Indique se a revisão é necessária para esta etapa.",      type: "radio_bool", required: true },
    { key: "revision_date",     label: "Data de Revisão",           hint: "Informe a data em que a revisão será realizada.",          type: "date",       required: true },
    { key: "revision_assignee", label: "Responsável pela Revisão",  hint: "Selecione o responsável por realizar a revisão.",          type: "user",       required: true },
    { key: "revision_comments", label: "Comentários da Revisão",    hint: "Adicione comentários ou observações sobre a revisão.",     type: "textarea" },
    { key: "revision_status",   label: "Status da Revisão",         hint: "Informe o status atual da revisão.",                       type: "select",     options: ["Aprovado","Reprovado","Pendente de aprovação"], required: true },
  ],
  entregue: [
    { key: "delivery_date",        label: "Data de Entrega",      hint: "Informe a data em que foi entregue.",          type: "date",  required: true },
    { key: "delivery_assignee",    label: "Responsável pela Entrega", hint: "Selecione o responsável pela entrega.",    type: "user" },
    { key: "delivery_approved_by", label: "Aprovado por",         hint: "Nome de quem aprovou a entrega.",              type: "text" },
    { key: "delivery_comments",    label: "Comentários Finais",   hint: "Observações finais sobre a entrega.",          type: "textarea" },
  ],
};

/* ── Tab definitions ────────────────────────────────────────── */
const TABS = [
  { id: "form",       label: "Form",       Icon: FileText },
  { id: "atividades", label: "Atividades", Icon: Activity },
  { id: "anexos",     label: "Anexos",     Icon: Paperclip },
  { id: "checklists", label: "Checklists", Icon: CheckSquare },
  { id: "comentarios",label: "Comentários",Icon: MessageSquare },
];

/* ── Shared input style ─────────────────────────────────────── */
const inputBase = {
  width: "100%", fontSize: 13, borderRadius: 6,
  border: "1px solid #D1D5DB", padding: "7px 10px",
  background: "#FAFAFA", color: NEUTRAL.graphite, outline: "none",
};
const focusBorder = e => { e.target.style.borderColor = "#1E4D8C"; };
const blurBorder  = e => { e.target.style.borderColor = "#D1D5DB"; };

/* ── Small primitives ───────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
      {children}
    </div>
  );
}

function FieldRow({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {required && <span style={{ color: "#DC2626", marginRight: 2 }}>*</span>}
        {label}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: NEUTRAL.slate, marginBottom: 5, lineHeight: 1.4 }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

function ReadValue({ value, empty = "—" }) {
  return (
    <div style={{ fontSize: 13, color: value ? NEUTRAL.graphite : NEUTRAL.slate, lineHeight: 1.5 }}>
      {value || empty}
    </div>
  );
}

/* ── Dynamic field renderer ─────────────────────────────────── */
function StageFieldInput({ field, value, onChange, canWrite, users }) {
  const disabled = !canWrite;
  const st = { ...inputBase };

  if (field.type === "text") {
    return (
      <input type="text" value={value || ""} placeholder={field.hint}
        onChange={e => onChange(e.target.value)} disabled={disabled}
        style={st} onFocus={focusBorder} onBlur={blurBorder} />
    );
  }

  if (field.type === "date") {
    return (
      <input type="date" value={value ? value.slice(0, 10) : ""}
        onChange={e => onChange(e.target.value)} disabled={disabled}
        style={st} onFocus={focusBorder} onBlur={blurBorder} />
    );
  }

  if (field.type === "number") {
    return (
      <input type="number" min={0} max={100} value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        disabled={disabled} placeholder={field.hint}
        style={st} onFocus={focusBorder} onBlur={blurBorder} />
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea value={value || ""} rows={3} placeholder={field.hint}
        onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...st, resize: "vertical" }} onFocus={focusBorder} onBlur={blurBorder} />
    );
  }

  if (field.type === "select") {
    const opts = field.options || [];
    return (
      <select value={value || ""} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...st, color: value ? NEUTRAL.graphite : NEUTRAL.slate }}
        onFocus={focusBorder} onBlur={blurBorder}>
        <option value="">Escolha uma opção</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (field.type === "user") {
    return (
      <select value={value || ""} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...st, color: value ? NEUTRAL.graphite : NEUTRAL.slate }}
        onFocus={focusBorder} onBlur={blurBorder}>
        <option value="">Selecione um responsável</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    );
  }

  if (field.type === "radio") {
    const opts = field.options || [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {opts.map(o => (
          <label key={o.v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer", fontSize: 13, color: NEUTRAL.graphite }}>
            <input type="radio" name={field.key} value={o.v} checked={value === o.v}
              onChange={() => !disabled && onChange(o.v)} disabled={disabled}
              style={{ accentColor: "#1E4D8C" }} />
            {o.l}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "radio_bool") {
    return (
      <div style={{ display: "flex", gap: 16 }}>
        {[{v:true,l:"Sim"},{v:false,l:"Não"}].map(o => (
          <label key={String(o.v)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: disabled ? "default" : "pointer", fontSize: 13, color: NEUTRAL.graphite }}>
            <input type="radio" name={field.key} value={String(o.v)} checked={value === o.v}
              onChange={() => !disabled && onChange(o.v)} disabled={disabled}
              style={{ accentColor: "#1E4D8C" }} />
            {o.l}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "multicheck") {
    const opts = field.options || [];
    const checked = Array.isArray(value) ? value : [];
    const toggle = opt => {
      if (disabled) return;
      onChange(checked.includes(opt) ? checked.filter(x => x !== opt) : [...checked, opt]);
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {opts.map(opt => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer", fontSize: 13, color: NEUTRAL.graphite }}>
            <input type="checkbox" checked={checked.includes(opt)} onChange={() => toggle(opt)} disabled={disabled}
              style={{ accentColor: "#1E4D8C", width: 14, height: 14 }} />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  return null;
}

/* ── Comentários tab ────────────────────────────────────────── */
function ComentariosTab({ item, onUpdate, canWrite }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const notes = Array.isArray(item.notes) ? item.notes : [];

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !canWrite) return;
    setSending(true);
    try {
      const note = { text: trimmed, createdAt: new Date().toISOString() };
      await onUpdate(item.id, { notes: [...notes, note] });
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 12 }}>
        {notes.length === 0 ? (
          <div style={{ fontSize: 12, color: NEUTRAL.slate, textAlign: "center", marginTop: 32 }}>Nenhum comentário ainda.</div>
        ) : (
          notes.map((n, i) => (
            <div key={i} style={{ marginBottom: 12, padding: "10px 12px", background: "#F3F4F6", borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: NEUTRAL.graphite, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.text}</div>
              {n.createdAt && (
                <div style={{ fontSize: 10, color: NEUTRAL.slate, marginTop: 4 }}>
                  {new Date(n.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {canWrite && (
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid #E5E7EB", paddingTop: 12, flexShrink: 0 }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Escreva um comentário..."
            rows={2}
            style={{ ...inputBase, flex: 1, resize: "none" }}
            onFocus={focusBorder}
            onBlur={blurBorder}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            style={{ background: "#1E4D8C", color: "#FFF", border: "none", borderRadius: 6, padding: "0 14px", cursor: sending ? "default" : "pointer", opacity: (sending || !text.trim()) ? 0.5 : 1, display: "flex", alignItems: "center" }}
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function PlaceholderTab({ label }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px", color: NEUTRAL.slate }}>
      <div style={{ fontSize: 13 }}>{label} — em breve</div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export function DeliverableDetailDrawer({ item, onClose, onUpdate, onDelete, users = [], canWrite }) {
  const [activeTab, setActiveTab]   = useState("form");
  const [fieldValues, setFieldValues] = useState(() => item.stageData?.[item.stage] ?? {});
  const [dirty, setDirty]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  /* Re-initialise fields when the item stage changes externally */
  useEffect(() => {
    setFieldValues(item.stageData?.[item.stage] ?? {});
    setDirty(false);
  }, [item.id, item.stage]);

  /* Escape key */
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  /* Stage meta */
  const stageInfo  = DELIVERABLE_STAGES.find(s => s.id === item.stage);
  const stageOrder = DELIVERABLE_STAGES.map(s => s.id);
  const currentIdx = stageOrder.indexOf(item.stage);
  const nextStages = DELIVERABLE_STAGES.slice(currentIdx + 1);
  const prevStages = DELIVERABLE_STAGES.slice(0, currentIdx).reverse();
  const fields     = STAGE_FIELDS[item.stage] || [];

  /* Priority */
  const priorityColor  = PRIORITY_COLORS[item.priority] || NEUTRAL.slate;
  const priorityLabel  = PRIORITY_LABELS[item.priority] || item.priority;
  const companyLabels  = (item.companyIds || []).map(id => COMPANIES[id]?.short || id).join(", ");

  /* Field change */
  const handleFieldChange = (key, val) => {
    setFieldValues(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  /* Save stage data */
  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const patch = {
        stageData: { ...(item.stageData || {}), [item.stage]: fieldValues },
      };
      /* Also sync top-level assignee from solicitacao fields */
      if (item.stage === "solicitacao" && fieldValues.assignee !== undefined) {
        patch.assignee = fieldValues.assignee || null;
      }
      await onUpdate(item.id, patch);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  /* Move stage */
  const handleMoveStage = async stageId => {
    await onUpdate(item.id, { stage: stageId, stageChangedAt: new Date().toISOString() });
    onClose();
  };

  /* Delete */
  const handleDelete = async () => {
    if (!window.confirm("Remover esta entrega?")) return;
    setDeleting(true);
    try { await onDelete(item.id); onClose(); }
    finally { setDeleting(false); }
  };

  /* User name helper */
  const userName = id => users.find(u => u.id === id)?.name || id || "—";

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200 }} onClick={onClose} />

      {/* Drawer */}
      <div
        style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(960px, 98vw)", background: "#F3F4F6", zIndex: 201, display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: NEUTRAL.graphite, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
              {companyLabels && <span style={{ fontSize: 11, color: NEUTRAL.slate }}>{companyLabels}</span>}
              {stageInfo && (
                <span style={{ fontSize: 10, fontWeight: 700, color: stageInfo.color, background: stageInfo.color + "18", border: `1px solid ${stageInfo.color}40`, borderRadius: 4, padding: "1px 6px" }}>
                  {stageInfo.name}
                </span>
              )}
              {item.priority && (
                <span style={{ fontSize: 10, fontWeight: 700, color: priorityColor, background: priorityColor + "18", border: `1px solid ${priorityColor}40`, borderRadius: 4, padding: "1px 6px" }}>
                  {priorityLabel}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 6, borderRadius: 6, display: "flex" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 220px", flex: 1, minHeight: 0 }}>

          {/* ── Col 1: Tabs + content ── */}
          <div style={{ background: "#FFFFFF", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column" }}>
            {/* Tab bar */}
            <div style={{ borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      width: "100%", padding: "10px 16px",
                      background: active ? "#EFF6FF" : "transparent",
                      border: "none",
                      borderLeft: active ? "3px solid #1E4D8C" : "3px solid transparent",
                      cursor: "pointer",
                      fontSize: 12, fontWeight: active ? 700 : 500,
                      color: active ? "#1E4D8C" : NEUTRAL.slate,
                      textAlign: "left",
                      transition: "all 0.1s",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F9FAFB"; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <tab.Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column" }}>
              {activeTab === "form" && (
                <>
                  <SectionLabel>Formulário Inicial</SectionLabel>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Título</div>
                    <ReadValue value={item.title} />
                  </div>

                  {item.requesterName && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Solicitante</div>
                      <ReadValue value={item.requesterName} />
                    </div>
                  )}

                  {item.department && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Departamento</div>
                      <ReadValue value={item.department} />
                    </div>
                  )}

                  {item.description && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Descrição</div>
                      <div style={{ fontSize: 12, color: NEUTRAL.graphite, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{item.description}</div>
                    </div>
                  )}

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Prazo</div>
                    {item.deadline ? (
                      <span style={{ fontSize: 13, fontWeight: 600, color: new Date(item.deadline) < new Date() ? "#DC2626" : NEUTRAL.graphite }}>
                        {formatDateBR(item.deadline)}
                      </span>
                    ) : <ReadValue value={null} />}
                  </div>

                  {item.priority && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Prioridade</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor, background: priorityColor + "18", border: `1px solid ${priorityColor}40`, borderRadius: 5, padding: "2px 8px", display: "inline-block" }}>
                        {priorityLabel}
                      </span>
                    </div>
                  )}

                  {/* Histórico placeholder */}
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #E5E7EB" }}>
                    <SectionLabel>Histórico</SectionLabel>
                    <div style={{ fontSize: 11, color: NEUTRAL.slate }}>Nenhum histórico registrado.</div>
                  </div>
                </>
              )}

              {activeTab === "atividades"  && <PlaceholderTab label="Atividades" />}
              {activeTab === "anexos"      && <PlaceholderTab label="Anexos" />}
              {activeTab === "checklists"  && <PlaceholderTab label="Checklists" />}
              {activeTab === "comentarios" && (
                <ComentariosTab item={item} onUpdate={onUpdate} canWrite={canWrite} />
              )}
            </div>

            {/* Delete at bottom of col 1 */}
            {canWrite && (
              <div style={{ padding: "12px 16px", borderTop: "1px solid #E5E7EB", flexShrink: 0 }}>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#DC2626", background: "transparent", border: "none", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.5 : 1, padding: "2px 0" }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                >
                  <Trash2 size={13} />
                  Remover entrega
                </button>
              </div>
            )}
          </div>

          {/* ── Col 2: Stage-specific fields ── */}
          <div style={{ background: "#FFFFFF", borderRight: "1px solid #E5E7EB", overflowY: "auto", padding: "24px 24px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <SectionLabel>Fase atual</SectionLabel>
              {stageInfo && (
                <span style={{ fontSize: 11, fontWeight: 600, color: stageInfo.color, background: stageInfo.color + "18", border: `1px solid ${stageInfo.color}40`, borderRadius: 5, padding: "2px 8px", marginTop: -14 }}>
                  {stageInfo.name}
                </span>
              )}
            </div>

            {fields.length === 0 ? (
              <div style={{ fontSize: 12, color: NEUTRAL.slate }}>Nenhum campo configurado para esta fase.</div>
            ) : (
              fields.map(field => (
                <FieldRow key={field.key} label={field.label} required={field.required} hint={field.hint}>
                  <StageFieldInput
                    field={field}
                    value={fieldValues[field.key]}
                    onChange={val => handleFieldChange(field.key, val)}
                    canWrite={canWrite}
                    users={users}
                  />
                </FieldRow>
              ))
            )}

            {canWrite && dirty && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ background: "#1E4D8C", color: "#FFF", border: "none", borderRadius: 6, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            )}
          </div>

          {/* ── Col 3: Move stage ── */}
          <div style={{ background: "#F9FAFB", overflowY: "auto", padding: "24px 16px" }}>
            <SectionLabel>Mover card para fase</SectionLabel>

            {nextStages.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: NEUTRAL.slate, fontWeight: 600, marginBottom: 6, letterSpacing: "0.04em" }}>PRÓXIMAS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {nextStages.map(s => (
                    <button
                      key={s.id}
                      onClick={() => canWrite && handleMoveStage(s.id)}
                      disabled={!canWrite}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "9px 10px",
                        background: s.color + "14",
                        border: `1px solid ${s.color}50`,
                        borderRadius: 7,
                        cursor: canWrite ? "pointer" : "default",
                        fontSize: 12, fontWeight: 600, color: s.color,
                        textAlign: "left", transition: "all 0.12s",
                        opacity: canWrite ? 1 : 0.5,
                      }}
                      onMouseEnter={e => { if (canWrite) { e.currentTarget.style.background = s.color + "28"; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = s.color + "14"; }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {prevStages.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: NEUTRAL.slate, fontWeight: 600, marginBottom: 6, letterSpacing: "0.04em" }}>ANTERIORES</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {prevStages.map(s => (
                    <button
                      key={s.id}
                      onClick={() => canWrite && handleMoveStage(s.id)}
                      disabled={!canWrite}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "9px 10px",
                        background: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        borderRadius: 7,
                        cursor: canWrite ? "pointer" : "default",
                        fontSize: 12, fontWeight: 500, color: NEUTRAL.slate,
                        textAlign: "left", transition: "all 0.12s",
                        opacity: canWrite ? 1 : 0.5,
                      }}
                      onMouseEnter={e => { if (canWrite) { e.currentTarget.style.background = "#F3F4F6"; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}
                    >
                      <ArrowLeft size={12} />
                      <span style={{ flex: 1 }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
