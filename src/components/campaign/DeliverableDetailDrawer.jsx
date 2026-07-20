import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Trash2,
  FileText, Activity, Paperclip, CheckSquare,
  Sparkles,
  Upload, File, FileImage, Download, Plus,
  Check, Loader2, AlertCircle, RotateCcw, Copy,
} from "lucide-react";
import { NEUTRAL, COMPANIES } from "../../constants/companies";
import {
  DELIVERABLE_STAGES,
  DELIVERABLE_REQUEST_TYPES,
} from "../../constants/marketing-pipelines";
import { formatDateBR } from "../../utils/date";
import { useDeliverableAttachments }  from "../../hooks/use-deliverable-attachments";
import { useDeliverableChecklists }   from "../../hooks/use-deliverable-checklists";
import { useRHStageFields }           from "../../hooks/use-rh-stage-fields";
import { RHStageFieldInput }          from "../rh-pipeline/RHStageFieldInput";
import { resolveVisibleFields }       from "../../utils/field-conditions";
import { useAI }                      from "../../hooks/use-ai";
import { deliverableStageSuggestionPrompt } from "../../constants/ai-prompts";
import { CommentsPanel }              from "../shared/CommentsPanel";
import { getMentionableUsers }        from "../../utils/mentionable-users";
import { AssigneeMultiSelect }        from "../shared/AssigneeMultiSelect";
import { EditableProtocolNumber }     from "../shared/EditableProtocolNumber";
import { StageNavigator }             from "../shared/StageNavigator";
import { SplitPanelDrawer }           from "../shared/SplitPanelDrawer";

/* ── Priority helpers ───────────────────────────────────────── */
const PRIORITY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_COLORS = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };
const PURPLE = "#7C3AED";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.zip";

/* ── Stage-specific field configs ───────────────────────────── */
export const STAGE_FIELDS = {
  solicitacao: [
    { key: "request_type",   label: "Tipo de Solicitação",          hint: "Selecione o tipo de solicitação.",             type: "select",     options: DELIVERABLE_REQUEST_TYPES, required: true },
    { key: "request_date",   label: "Data de Solicitação",          hint: "Data em que a solicitação foi feita.",          type: "date",       required: true },
    { key: "assignee",       label: "Responsável pela Solicitação", hint: "Selecione o(s) responsável(is).",               type: "user_multi", required: true },
    { key: "request_status", label: "Status da Solicitação",        hint: "Status atual da solicitação.",                  type: "radio",      options: [{v:"pendente",l:"Pendente"},{v:"em_andamento",l:"Em andamento"},{v:"concluido",l:"Concluído"}] },
    { key: "observations",   label: "Observações",                  hint: "Observações adicionais.",                       type: "textarea" },
  ],
  em_producao: [
    { key: "production_stage",      label: "Etapa Atual",                   hint: "Etapa atual do processo de produção.",        type: "select",    options: ["Planejamento","Desenvolvimento","Finalização"], required: true },
    { key: "production_start_date", label: "Data de Início da Produção",    hint: "Data em que a produção foi iniciada.",         type: "date",      required: true },
    { key: "production_resources",  label: "Recursos Alocados",             hint: "Liste os recursos alocados.",                  type: "textarea" },
    { key: "production_progress",   label: "Progresso Atual (%)",           hint: "Progresso atual em porcentagem.",              type: "percent_steps", steps: [0, 20, 40, 60, 80, 100], required: true },
    { key: "production_risks",      label: "Riscos Identificados",          hint: "Riscos que podem impactar a produção.",        type: "multicheck", options: ["Falta de materiais","Problemas técnicos","Atrasos na entrega","Outros"] },
  ],
  revisao: [
    { key: "revision_needed",   label: "Revisão Necessária",        hint: "A revisão é necessária para esta etapa?",     type: "radio_bool", required: true },
    { key: "revision_date",     label: "Data de Revisão",           hint: "Data em que a revisão será realizada.",        type: "date",       required: true },
    { key: "revision_assignee", label: "Responsável pela Revisão",  hint: "Selecione o responsável pela revisão.",        type: "user",       required: true },
    { key: "revision_comments", label: "Comentários da Revisão",    hint: "Comentários ou observações sobre a revisão.",  type: "textarea" },
    { key: "revision_status",   label: "Status da Revisão",         hint: "Status atual da revisão.",                     type: "select",     options: ["Aprovado","Reprovado","Pendente de aprovação"], required: true },
  ],
  entregue: [
    { key: "delivery_date",        label: "Data de Entrega",         hint: "Data em que foi entregue.",           type: "date",  required: true },
    { key: "delivery_assignee",    label: "Responsável pela Entrega",hint: "Responsável pela entrega.",           type: "user" },
    { key: "delivery_approved_by", label: "Aprovado por",            hint: "Nome de quem aprovou a entrega.",     type: "text" },
    { key: "delivery_comments",    label: "Comentários Finais",      hint: "Observações finais sobre a entrega.", type: "textarea" },
  ],
};

/* ── Pill SideTabs ──────────────────────────────────────────── */
const SIDE_TABS = [
  { id: "form",        label: "Form",        icon: FileText },
  { id: "atividades",  label: "Atividades",  icon: Activity },
  { id: "ia",          label: "IA",          icon: Sparkles },
  { id: "anexos",      label: "Anexos",      icon: Paperclip },
  { id: "checklists",  label: "Checklists",  icon: CheckSquare },
];

function SideTabs({ activeId, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {SIDE_TABS.map(t => {
        const active = t.id === activeId;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px", fontSize: 11, fontWeight: 600,
              borderRadius: 9999,
              background:  active ? "var(--surface)" : "transparent",
              color:       active ? "var(--accent)" : "var(--text-dim)",
              border:      `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              cursor: "pointer", transition: "background 0.1s",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
          >
            <Icon size={11} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Deliverable AI panel ───────────────────────────────────── */
function DeliverableAIPanel({ item, currentUser }) {
  const { complete, isConfigured } = useAI(currentUser);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [copied,  setCopied]  = useState(false);

  const handleGenerate = async () => {
    if (!isConfigured) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setCopied(false);
    try {
      const text = await complete(deliverableStageSuggestionPrompt(item));
      setResult(text);
    } catch (err) {
      setError(err.message || "Erro ao gerar resposta.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ padding: 12, borderRadius: 12, border: "1px solid #DDD6FE", background: "#F5F3FF" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Sparkles size={13} style={{ color: PURPLE }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: PURPLE }}>Sugestão de próxima etapa</span>
          {!isConfigured && (
            <span style={{ fontSize: 10, fontWeight: 500, padding: "1px 8px", borderRadius: 9999, background: "#FEF3C7", color: "#92400E", marginLeft: "auto" }}>
              configure nas Configurações
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: "#5B21B6", marginBottom: 10, lineHeight: 1.5 }}>
          A IA analisa etapa, prazo, prioridade e progresso para recomendar a próxima ação.
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading || !isConfigured}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600,
            background: !isConfigured ? "#E5E7EB" : PURPLE,
            color: !isConfigured ? "var(--text-dim)" : "#FFFFFF",
            border: "none", cursor: loading || !isConfigured ? "not-allowed" : "pointer",
            opacity: loading ? 0.8 : 1, transition: "all 0.15s",
          }}
          title={!isConfigured ? "Configure sua LLM nas Configurações → Integrações de IA" : undefined}
          onMouseEnter={e => { if (!loading && isConfigured) e.currentTarget.style.filter = "brightness(0.9)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? "Analisando…" : "Analisar entrega"}
        </button>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px", borderRadius: 10, background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA", fontSize: 11 }}>
          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-line", padding: 12, borderRadius: 10, border: "1px solid #DDD6FE", background: "#FFFFFF", color: "var(--text)" }}>
            {result}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleGenerate}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 9999, border: "1px solid #E5E7EB", background: "#FFFFFF", color: "var(--text-dim)", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = PURPLE; e.currentTarget.style.color = PURPLE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "var(--text-dim)"; }}
            >
              <RotateCcw size={10} />
              Regenerar
            </button>
            <button
              onClick={handleCopy}
              style={{
                display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "4px 10px",
                borderRadius: 9999, border: `1px solid ${copied ? "#BBF7D0" : "#E5E7EB"}`,
                background: copied ? "#F0FDF4" : "#FFFFFF", color: copied ? "#16A34A" : "var(--text-dim)", cursor: "pointer",
              }}
              onMouseEnter={e => { if (!copied) { e.currentTarget.style.borderColor = "var(--text)"; e.currentTarget.style.color = "var(--text)"; } }}
              onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "var(--text-dim)"; } }}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared input style ─────────────────────────────────────── */
const inputBase = {
  width: "100%", fontSize: 13, borderRadius: 6,
  border: "1px solid #D1D5DB", padding: "7px 10px",
  background: "var(--surface)", color: "var(--text)", outline: "none",
};
const focusBorder = e => { e.target.style.borderColor = "var(--accent)"; };
const blurBorder  = e => { e.target.style.borderColor = "#D1D5DB"; };

/* ── Small primitives ───────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
      {children}
    </div>
  );
}

function FieldRow({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {required && <span style={{ color: "#DC2626", marginRight: 2 }}>*</span>}
        {label}
      </div>
      {hint && <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 5, lineHeight: 1.4 }}>{hint}</div>}
      {children}
    </div>
  );
}

function ReadValue({ value, empty = "—" }) {
  return (
    <div style={{ fontSize: 13, color: value ? "var(--text)" : "var(--text-dim)", lineHeight: 1.5 }}>
      {value || empty}
    </div>
  );
}

// Formata valor de campo customizado (rh_pipeline_stage_fields) pra exibição
// somente-leitura, quando o usuário não pode escrever.
function formatCustomFieldValue(v) {
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

/* ── Dynamic field renderer ─────────────────────────────────── */
function StageFieldInput({ field, value, onChange, canWrite, users }) {
  const disabled = !canWrite;

  if (field.type === "text") {
    return <input type="text" value={value || ""} placeholder={field.hint}
      onChange={e => onChange(e.target.value)} disabled={disabled}
      style={inputBase} onFocus={focusBorder} onBlur={blurBorder} />;
  }
  if (field.type === "date") {
    return <input type="date" value={value ? value.slice(0, 10) : ""}
      onChange={e => onChange(e.target.value)} disabled={disabled}
      style={inputBase} onFocus={focusBorder} onBlur={blurBorder} />;
  }
  if (field.type === "number") {
    return <input type="number" min={0} max={100} value={value ?? ""} placeholder={field.hint}
      onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      disabled={disabled} style={inputBase} onFocus={focusBorder} onBlur={blurBorder} />;
  }
  if (field.type === "percent_steps") {
    const steps = field.steps || [0, 20, 40, 60, 80, 100];
    const current = value === "" || value === null || value === undefined ? null : Number(value);
    return (
      <div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden", marginBottom: 10 }}>
          <div style={{
            width: `${current || 0}%`, height: "100%", borderRadius: 999,
            background: current >= 100 ? "var(--success)" : "var(--accent)",
            transition: "width 0.2s ease",
          }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {steps.map(s => {
            const active = current === s;
            return (
              <button
                key={s} type="button" disabled={disabled}
                onClick={() => onChange(s)}
                style={{
                  padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent)" : "var(--surface)",
                  color: active ? "#fff" : "var(--text-dim)",
                  cursor: disabled ? "default" : "pointer",
                }}
              >
                {s}%
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (field.type === "textarea") {
    return <textarea value={value || ""} rows={3} placeholder={field.hint}
      onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{ ...inputBase, resize: "vertical" }} onFocus={focusBorder} onBlur={blurBorder} />;
  }
  if (field.type === "select") {
    return (
      <select value={value || ""} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...inputBase, color: value ? "var(--text)" : "var(--text-dim)" }}
        onFocus={focusBorder} onBlur={blurBorder}>
        <option value="">Escolha uma opção</option>
        {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "user") {
    return (
      <select value={value || ""} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...inputBase, color: value ? "var(--text)" : "var(--text-dim)" }}
        onFocus={focusBorder} onBlur={blurBorder}>
        <option value="">Selecione um responsável</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    );
  }
  // FASE 5: mais de um responsável — só o campo solicitacao.assignee usa
  // este tipo (ver STAGE_FIELDS acima); revision_assignee/delivery_assignee
  // continuam type "user" (escalar, sem coluna própria no banco).
  if (field.type === "user_multi") {
    return (
      <AssigneeMultiSelect
        value={Array.isArray(value) ? value : (value ? [value] : [])}
        onChange={onChange}
        options={users}
        placeholder="Selecione o(s) responsável(is)"
        disabled={disabled}
      />
    );
  }
  if (field.type === "radio") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {(field.options || []).map(o => (
          <label key={o.v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer", fontSize: 13, color: "var(--text)" }}>
            <input type="radio" name={field.key} value={o.v} checked={value === o.v}
              onChange={() => !disabled && onChange(o.v)} disabled={disabled}
              style={{ accentColor: "var(--accent)" }} />
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
          <label key={String(o.v)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: disabled ? "default" : "pointer", fontSize: 13, color: "var(--text)" }}>
            <input type="radio" name={field.key} value={String(o.v)} checked={value === o.v}
              onChange={() => !disabled && onChange(o.v)} disabled={disabled}
              style={{ accentColor: "var(--accent)" }} />
            {o.l}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "multicheck") {
    const checked = Array.isArray(value) ? value : [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {(field.options || []).map(opt => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer", fontSize: 13, color: "var(--text)" }}>
            <input type="checkbox" checked={checked.includes(opt)}
              onChange={() => { if (!disabled) onChange(checked.includes(opt) ? checked.filter(x => x !== opt) : [...checked, opt]); }}
              disabled={disabled} style={{ accentColor: "var(--accent)", width: 14, height: 14 }} />
            {opt}
          </label>
        ))}
      </div>
    );
  }
  return null;
}

/* ── Atividades tab ─────────────────────────────────────────── */
function AtividadesTab({ activities }) {
  const sorted = [...(activities || [])].reverse();
  if (sorted.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", marginTop: 32 }}>Nenhuma atividade registrada.</div>;
  }
  const typeColor = { stage_change: "var(--accent)", field_save: "#16A34A", note_added: "#7C3AED", created: "#D97706" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {sorted.map((a, i) => (
        <div key={i} style={{ display: "flex", gap: 10, paddingBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: typeColor[a.type] || "#9CA3AF", marginTop: 3 }} />
            {i < sorted.length - 1 && <div style={{ width: 1, flex: 1, background: "#E5E7EB", marginTop: 4 }} />}
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{a.description}</div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
              {new Date(a.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Anexos tab ─────────────────────────────────────────────── */
function fileIconFn(mime) {
  if (!mime) return File;
  if (mime.startsWith("image/")) return FileImage;
  return FileText;
}
function humanSize(b) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function AnexosTab({ deliverableId, canWrite, userId }) {
  const { attachments, loading, uploading, error, upload, remove, getSignedUrl } =
    useDeliverableAttachments(deliverableId);
  const inputRef  = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileErr,  setFileErr]  = useState(null);

  const doUpload = useCallback(async (file) => {
    if (file.size > MAX_FILE_BYTES) { setFileErr("Arquivo muito grande (máx 50 MB)"); return; }
    setFileErr(null);
    await upload(file, { uploadedBy: userId });
  }, [upload, userId]);

  const handleFiles = (files) => { for (const f of Array.from(files)) doUpload(f); };

  const handleDownload = async (att) => {
    const url = await getSignedUrl(att.file_path);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = att.file_name; a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {canWrite && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => inputRef.current?.click()}
          style={{
            borderRadius: 10, border: `2px dashed ${dragOver ? "var(--accent)" : "#D1D5DB"}`,
            background: dragOver ? "var(--surface-alt)" : "var(--surface)",
            padding: "20px 12px", textAlign: "center", cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <Upload size={18} style={{ color: dragOver ? "var(--accent)" : "var(--text-dim)", margin: "0 auto 6px" }} />
          <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>
            {uploading ? "Enviando…" : "Arraste ou clique para enviar"}
          </div>
          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>PDF, Word, imagens, vídeos — máx 50 MB</div>
          <input ref={inputRef} type="file" accept={ACCEPTED} multiple style={{ display: "none" }}
            onChange={e => { handleFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
        </div>
      )}

      {(fileErr || error) && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 6, padding: "7px 10px", fontSize: 11 }}>
          {fileErr || error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 16 }}>
          <Loader2 size={16} style={{ color: "var(--text-dim)" }} className="animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", padding: "16px 0" }}>Nenhum anexo ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {attachments.map(att => {
            const Icon = fileIconFn(att.mime_type);
            return (
              <div key={att.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                <Icon size={16} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.file_name}</div>
                  {att.file_size && <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{humanSize(att.file_size)}</div>}
                </div>
                <button onClick={() => handleDownload(att)} title="Baixar"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 4, display: "flex" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#E5E7EB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                  <Download size={14} />
                </button>
                {canWrite && (
                  <button onClick={() => remove(att)} title="Remover"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 4, borderRadius: 4, display: "flex" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Checklists tab ─────────────────────────────────────────── */
function ChecklistsTab({ deliverableId, canWrite, userId }) {
  const { checklists, loading, createChecklist, deleteChecklist, addItem, toggleItem, removeItem } =
    useDeliverableChecklists(deliverableId);
  const [newTexts, setNewTexts] = useState({});
  const [creating, setCreating] = useState(false);

  const handleAddItem = async (cid) => {
    const text = (newTexts[cid] || "").trim();
    if (!text) return;
    await addItem(cid, text);
    setNewTexts(prev => ({ ...prev, [cid]: "" }));
  };

  if (loading) return <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", padding: 20 }}>Carregando…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {checklists.map(cl => {
        const done  = (cl.items || []).filter(it => it.done).length;
        const total = (cl.items || []).length;
        const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div key={cl.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: "#F9FAFB", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text)" }}>{cl.title}</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{done}/{total} concluídos</div>
              </div>
              {total > 0 && (
                <div style={{ width: 40, height: 4, background: "#E5E7EB", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#16A34A" : "var(--accent)", transition: "width 0.3s" }} />
                </div>
              )}
              {canWrite && (
                <button onClick={() => deleteChecklist(cl.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 3, borderRadius: 4, display: "flex" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              {(cl.items || []).map(it => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => canWrite && toggleItem(cl.id, it.id)}
                    style={{
                      width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${it.done ? "#16A34A" : "#D1D5DB"}`,
                      background: it.done ? "#16A34A" : "#FFF",
                      cursor: canWrite ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      transition: "all 0.15s",
                    }}>
                    {it.done && <Check size={10} color="#FFF" strokeWidth={3} />}
                  </button>
                  <span style={{ fontSize: 12, flex: 1, color: it.done ? "var(--text-dim)" : "var(--text)", textDecoration: it.done ? "line-through" : "none" }}>
                    {it.text}
                  </span>
                  {canWrite && (
                    <button onClick={() => removeItem(cl.id, it.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 2, display: "flex" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#DC2626"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; }}>
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
              {canWrite && (
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <input
                    value={newTexts[cl.id] || ""}
                    onChange={e => setNewTexts(prev => ({ ...prev, [cl.id]: e.target.value }))}
                    placeholder="Novo item…"
                    style={{ ...inputBase, fontSize: 12, padding: "5px 8px", flex: 1 }}
                    onFocus={focusBorder} onBlur={blurBorder}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(cl.id); } }}
                  />
                  <button onClick={() => handleAddItem(cl.id)}
                    style={{ background: "var(--accent)", border: "none", borderRadius: 6, color: "#FFF", padding: "0 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <Plus size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {canWrite && (
        <button
          onClick={async () => { setCreating(true); await createChecklist({ createdBy: userId }); setCreating(false); }}
          disabled={creating}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent)", background: "transparent", border: "1px dashed #BFDBFE", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 500, justifyContent: "center" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
          <Plus size={13} />
          {creating ? "Criando…" : "Nova checklist"}
        </button>
      )}
      {checklists.length === 0 && !canWrite && (
        <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", padding: "16px 0" }}>Nenhuma checklist ainda.</div>
      )}
    </div>
  );
}

// FASE 5: mais de um responsável na etapa "solicitacao" — o campo
// STAGE_FIELDS.solicitacao.assignee agora guarda um array de ids em vez de
// um id escalar. Ao inicializar/trocar de item, semeia esse campo a partir
// de assigneeIds (com fallback pro assignee escalar em entregas legadas)
// quando o stageData ainda não tiver um array salvo ali.
function seedStageFieldValues(it) {
  const base = it.stageData?.[it.stage] ?? {};
  if (it.stage === "solicitacao" && !Array.isArray(base.assignee)) {
    const seededAssignee = it.assigneeIds?.length ? it.assigneeIds : (it.assignee ? [it.assignee] : []);
    return { ...base, assignee: seededAssignee };
  }
  return base;
}

/* ── Main component ─────────────────────────────────────────── */
export function DeliverableDetailDrawer({ item, onClose, onStageMoved, onUpdate, onMoveToStage, onDelete, users = [], canWrite, userId, currentUser, notifyMentions }) {
  const [sideTab,      setSideTab]     = useState("form");
  const [fieldValues,  setFieldValues] = useState(() => seedStageFieldValues(item));
  const [saveStatus,   setSaveStatus]  = useState(null); // 'saving' | 'saved' | null
  const [moveError,    setMoveError]   = useState(null);

  // Campos customizados configurados pelo admin via "Editar campos desta
  // etapa" (rh_pipeline_stage_fields, domain="marketing_deliverables") —
  // persistidos em item.custom_fields, separado do stageData/fieldValues
  // acima (que é o formulário fixo por etapa). Mesmo padrão de draft +
  // debounce do OnboardingDrawer (RHOnboardingView.jsx).
  const stageFieldsHook = useRHStageFields("marketing_deliverables");
  const customDefs = stageFieldsHook.getFields(item.stage);
  const [customDraft, setCustomDraft] = useState({});
  const customDebounceRef = useRef(null);
  // Ref espelha o rascunho ACUMULADO — o timer precisa mesclar todos os campos
  // tocados, não só o último (senão editar A e B em <600ms grava só B). Flush
  // no cleanup pra não perder a edição ao fechar em <600ms. Achado da auditoria.
  const customDraftRef = useRef({});

  useEffect(() => {
    setCustomDraft({});
    customDraftRef.current = {};
    setMoveError(null);
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    return () => {
      if (customDebounceRef.current) { clearTimeout(customDebounceRef.current); customDebounceRef.current = null; }
      if (Object.keys(customDraftRef.current).length > 0) {
        onUpdate(item.id, { customFields: { ...(item.customFields || {}), ...customDraftRef.current } });
      }
    };
  }, [item.id]);

  const getCustomValue = (fieldKey) =>
    fieldKey in customDraft ? customDraft[fieldKey] : (item.customFields?.[fieldKey] ?? "");

  const handleCustomChange = (fieldKey, value) => {
    const next = { ...customDraftRef.current, [fieldKey]: value };
    customDraftRef.current = next;
    setCustomDraft(next);
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    customDebounceRef.current = setTimeout(() => {
      const merged = { ...(item.customFields || {}), ...customDraftRef.current };
      onUpdate(item.id, { customFields: merged });
      customDebounceRef.current = null;
    }, 600);
  };

  const customValuesByKey = { ...(item.customFields || {}), ...customDraft };
  const visibleCustomDefs = resolveVisibleFields(customDefs, customValuesByKey);

  // Quem pode ser @mencionado nos comentários desta entrega — mesmo escopo
  // usado no CampaignDetailDrawer (domain "marketing", incluindo agência,
  // que já tem acesso de leitura a entregas).
  const mentionableUsers = useMemo(() => (
    getMentionableUsers(users, { domain: "marketing", includeAgencia: true })
  ), [users]);

  // Normaliza item.notes ({text, createdAt}, sem autor nas entradas antigas)
  // pro formato que CommentsPanel espera — nunca inventamos um autor pras
  // entradas antigas que não tinham authorId.
  const comments = useMemo(() => {
    const notes = Array.isArray(item?.notes) ? item.notes : [];
    const resolveMentionNames = (ids) => (ids || [])
      .map(id => (users || []).find(u => u.id === id)?.name)
      .filter(Boolean);
    return [...notes].reverse().map((n, i) => {
      const author = n.authorId ? (users || []).find(u => u.id === n.authorId) : null;
      return {
        id: n.id || `note-${i}-${n.createdAt || ""}`,
        authorId: n.authorId || null,
        authorName: n.authorName || author?.name || null,
        avatarBg: author?.avatarBg,
        avatarUrl: author?.avatarUrl,
        initials: author?.initials,
        text: n.text,
        mentionedNames: resolveMentionNames(n.mentionedIds),
        createdAt: n.createdAt,
      };
    });
  }, [item?.notes, users]);

  const onAddComment = useCallback(async (text, mentionedIds) => {
    if (!item) return;
    const newNote = {
      id: crypto.randomUUID(),
      authorId: currentUser?.id || null,
      authorName: currentUser?.name || null,
      avatarBg: currentUser?.avatarBg,
      text,
      mentionedIds,
      createdAt: new Date().toISOString(),
    };
    const updatedNotes = [...(item.notes || []), newNote];
    await onUpdate(item.id, { notes: updatedNotes });
    if (mentionedIds?.length > 0 && notifyMentions) {
      notifyMentions(mentionedIds, {
        title: `${currentUser?.name || "Alguém"} te mencionou`,
        body: `Em um comentário na entrega "${item.title}"`,
        link: { module: "deliverables", id: item.id },
      });
    }
  }, [item, onUpdate, currentUser, notifyMentions]);

  const fieldValuesRef = useRef(fieldValues);
  const itemRef        = useRef(item);
  const saveTimerRef   = useRef(null);
  useEffect(() => { fieldValuesRef.current = fieldValues; }, [fieldValues]);
  useEffect(() => { itemRef.current = item; }, [item]);

  useEffect(() => {
    const seeded = seedStageFieldValues(item);
    setFieldValues(seeded);
    fieldValuesRef.current = seeded;
    setSaveStatus(null);
    setSideTab("form");
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
  }, [item.id, item.stage]);

  const stageInfo  = DELIVERABLE_STAGES.find(s => s.id === item.stage);
  const fields     = STAGE_FIELDS[item.stage] || [];

  const priorityColor = PRIORITY_COLORS[item.priority] || NEUTRAL.slate;
  const priorityLabel = PRIORITY_LABELS[item.priority] || item.priority;
  const companyLabels = (item.companyIds || []).map(id => COMPANIES[id]?.short || id).join(", ");

  const handleFieldChange = useCallback((key, val) => {
    const newValues = { ...fieldValuesRef.current, [key]: val };
    setFieldValues(newValues);
    fieldValuesRef.current = newValues;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus(null);
    saveTimerRef.current = setTimeout(async () => {
      const it = itemRef.current;
      setSaveStatus("saving");
      try {
        const activity = { type: "field_save", description: `Campos de "${it.stage}" atualizados`, at: new Date().toISOString() };
        const patch = {
          stageData:  { ...(it.stageData || {}), [it.stage]: fieldValuesRef.current },
          activities: [...(it.activities || []), activity],
        };
        if (it.stage === "solicitacao" && fieldValuesRef.current.assignee !== undefined) {
          // FASE 5: campo agora é um array (AssigneeMultiSelect) — escreve
          // o escalar assignee (1º da lista, pro trigger/colunas legadas) E
          // o array completo assigneeIds, ambos chegando ao onUpdate/hook.
          const rawAssignee = fieldValuesRef.current.assignee;
          const assigneeIds = Array.isArray(rawAssignee) ? rawAssignee : (rawAssignee ? [rawAssignee] : []);
          patch.assignee = assigneeIds[0] || null;
          patch.assigneeIds = assigneeIds;
        }
        await onUpdate(it.id, patch);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2500);
      } catch {
        // Falha real de gravação (RLS/rede/constraint) — sem isso o usuário
        // via "Salvando…" sumir sem virar "✓ Salvo" e achava que tinha
        // salvo; os campos ficavam só no estado local, perdidos ao reabrir.
        setSaveStatus("error");
      }
    }, 600);
  }, [onUpdate]);

  const handleMoveStage = async (stageId) => {
    // Passa pela mesma validação de campo obrigatório (estático + dinâmico)
    // do drag-and-drop/"Mover para" do board — antes esse botão chamava
    // onUpdate direto e contornava a checagem por completo.
    if (onMoveToStage) {
      const ok = await onMoveToStage(item.id, stageId);
      if (ok === false) return;
      setMoveError(null);
      onClose();
      onStageMoved?.(item.id);
      return;
    }
    const stageName = DELIVERABLE_STAGES.find(s => s.id === stageId)?.name || stageId;
    try {
      await onUpdate(item.id, {
        stage:          stageId,
        stageChangedAt: new Date().toISOString(),
        activities: [
          ...(item.activities || []),
          { type: "stage_change", description: `Movido para ${stageName}`, at: new Date().toISOString() },
        ],
      });
      setMoveError(null);
      onClose();
      onStageMoved?.(item.id);
    } catch (err) {
      // Antes usava alert() nativo — bloqueante, e trava sessões
      // automatizadas/headless sem handler de diálogo. Banner inline não
      // bloqueia nada.
      setMoveError(`Não foi possível mover "${item.title}": ${err?.message || "erro desconhecido"}.`);
    }
  };

  // ── Left tab content ──────────────────────────────────────────────────────
  function LeftTabContent() {
    if (sideTab === "form") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionLabel>Formulário Inicial</SectionLabel>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Nº da Solicitação</div>
            <EditableProtocolNumber
              value={item.requestNumber}
              canWrite={canWrite}
              onSave={(next) => onUpdate(item.id, { requestNumber: next })}
            />
          </div>
          {[
            { label: "Título",       val: item.title },
            { label: "Solicitante",  val: item.requesterName },
            { label: "Departamento", val: item.department },
          ].map(({ label, val }) => val ? (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
              <ReadValue value={val} />
            </div>
          ) : null)}
          {item.description && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Descrição</div>
              <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{item.description}</div>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Prazo</div>
            {item.deadline
              ? <span style={{ fontSize: 13, fontWeight: 600, color: new Date(item.deadline) < new Date() ? "#DC2626" : "var(--text)" }}>{formatDateBR(item.deadline)}</span>
              : <ReadValue value={null} />}
          </div>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #E5E7EB" }}>
            <SectionLabel>Histórico de Etapas</SectionLabel>
            {(item.activities || []).filter(a => a.type === "stage_change").length === 0
              ? <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Nenhuma transição registrada.</div>
              : [...(item.activities || [])].filter(a => a.type === "stage_change").reverse().map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 11 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: "var(--text)" }}>{a.description}</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 10 }}>{new Date(a.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      );
    }
    if (sideTab === "atividades")  return <AtividadesTab activities={item.activities} />;
    if (sideTab === "ia")          return <DeliverableAIPanel item={item} currentUser={currentUser} />;
    if (sideTab === "anexos")      return <AnexosTab deliverableId={item.id} canWrite={canWrite} userId={userId || currentUser?.id} />;
    if (sideTab === "checklists")  return <ChecklistsTab deliverableId={item.id} canWrite={canWrite} userId={userId || currentUser?.id} />;
    return null;
  }

  const header = (
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        {stageInfo && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: stageInfo.color + "22", color: stageInfo.color, border: `1px solid ${stageInfo.color}44` }}>
            {stageInfo.name}
          </span>
        )}
        {item.priority && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: priorityColor + "18", color: priorityColor, border: `1px solid ${priorityColor}40` }}>
            {priorityLabel}
          </span>
        )}
        {companyLabels && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)" }}>
            {companyLabels}
          </span>
        )}
      </div>
      <h2 className="font-bold" style={{ fontSize: 18, color: "var(--text)", letterSpacing: "-0.01em", wordBreak: "break-word" }}>
        {item.title}
      </h2>
    </div>
  );

  const left = (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Prazo</div>
          <div className="text-xs font-bold mt-0.5" style={{ color: item.deadline && new Date(item.deadline) < new Date() ? "#DC2626" : "var(--text)" }}>
            {item.deadline ? formatDateBR(item.deadline) : "—"}
          </div>
        </div>
        <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Etapa</div>
          <div className="text-xs font-bold mt-0.5 truncate" style={{ color: stageInfo?.color || "var(--text)" }}>
            {stageInfo?.name || "—"}
          </div>
        </div>
        {item.department && (
          <div className="col-span-2 rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Departamento</div>
            <div className="text-xs font-bold mt-0.5 truncate" style={{ color: "var(--text)" }}>{item.department}</div>
          </div>
        )}
      </div>

      {/* ── Pill SideTabs ── */}
      <div className="pt-1 border-t" style={{ borderColor: "var(--border)" }}>
        <SideTabs activeId={sideTab} onChange={setSideTab} />
      </div>

      {/* ── Tab content ── */}
      <div>
        <LeftTabContent />
      </div>
    </>
  );

  const center = (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <SectionLabel>Fase atual</SectionLabel>
        {stageInfo && (
          <span style={{ fontSize: 11, fontWeight: 600, color: stageInfo.color, background: stageInfo.color + "18", border: `1px solid ${stageInfo.color}40`, borderRadius: 5, padding: "2px 8px", marginTop: -14 }}>
            {stageInfo.name}
          </span>
        )}
        {saveStatus && (
          <span
            style={{
              fontSize: 10, marginTop: -14, marginLeft: "auto",
              color: saveStatus === "saved" ? "#16A34A" : saveStatus === "error" ? "#DC2626" : "var(--text-dim)",
              fontWeight: saveStatus === "error" ? 700 : 400,
            }}
          >
            {saveStatus === "saving" ? "Salvando…" : saveStatus === "error" ? "✗ Falha ao salvar — tente de novo" : "✓ Salvo"}
          </span>
        )}
      </div>
      {fields.length === 0
        ? <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Nenhum campo para esta fase.</div>
        : fields.map(field => (
          <FieldRow key={field.key} label={field.label} required={field.required} hint={field.hint}>
            <StageFieldInput field={field} value={fieldValues[field.key]} onChange={val => handleFieldChange(field.key, val)} canWrite={canWrite} users={users} />
          </FieldRow>
        ))
      }

      {/* Campos adicionais configurados via "Editar campos desta
          etapa" (rh_pipeline_stage_fields) — além do formulário fixo
          acima, que continua intacto. */}
      {visibleCustomDefs.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <SectionLabel>Campos adicionais da etapa</SectionLabel>
          {visibleCustomDefs.map(f => (
            <FieldRow key={f.id} label={f.label} required={f.effectiveRequired} hint={f.helpText}>
              {canWrite ? (
                <RHStageFieldInput
                  field={f}
                  value={getCustomValue(f.fieldKey)}
                  onChange={val => handleCustomChange(f.fieldKey, val)}
                  users={users}
                />
              ) : (
                <ReadValue value={formatCustomFieldValue(getCustomValue(f.fieldKey))} />
              )}
            </FieldRow>
          ))}
        </div>
      )}
    </div>
  );

  const right = (
    <>
      <div>
        <div className="text-xs font-semibold mb-3" style={{ color: "var(--text)", letterSpacing: "0.02em" }}>
          Mover entrega para fase
        </div>
        {moveError && (
          <div className="flex items-start gap-2 p-2.5 mb-2 rounded-lg text-xs" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            {moveError}
          </div>
        )}
        {canWrite && (
          <StageNavigator
            targets={DELIVERABLE_STAGES.filter(s => s.id !== item.stage)}
            onMove={handleMoveStage}
            getKey={(s) => s.id}
          />
        )}
      </div>

      <CommentsPanel
        comments={comments}
        currentUser={currentUser}
        mentionableUsers={mentionableUsers}
        onAddComment={onAddComment}
      />

      {/* AI move link */}
      <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setSideTab("ia")}
          className="flex items-center gap-1.5 text-xs w-full cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--text-dim)", padding: 0, textAlign: "left" }}
          onMouseEnter={e => { e.currentTarget.style.color = PURPLE; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
        >
          <Sparkles size={12} />
          Mover cards com IA
        </button>
      </div>
    </>
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
      onDelete={canWrite && onDelete ? () => onDelete(item.id) : undefined}
      deleteLabel="Excluir entrega"
    />
  );
}
