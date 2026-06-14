import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X, ArrowRight, ArrowLeft, Trash2, Star,
  FileText, Activity, Paperclip, CheckSquare, MessageSquare,
  Mail, FileDown, Sparkles,
  Upload, File, FileImage, Download, Plus,
  Check, Send, Loader2, AlertCircle, RotateCcw, Copy,
} from "lucide-react";
import { NEUTRAL, COMPANIES } from "../../constants/companies";
import {
  DELIVERABLE_STAGES,
  DELIVERABLE_REQUEST_TYPES,
} from "../../constants/marketing-pipelines";
import { formatDateBR } from "../../utils/date";
import { useDeliverableAttachments }  from "../../hooks/use-deliverable-attachments";
import { useDeliverableChecklists }   from "../../hooks/use-deliverable-checklists";
import { useAI }                      from "../../hooks/use-ai";
import { deliverableStageSuggestionPrompt } from "../../constants/ai-prompts";

/* ── Priority helpers ───────────────────────────────────────── */
const PRIORITY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_COLORS = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };
const PURPLE = "#7C3AED";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.zip";

/* ── Stage-specific field configs ───────────────────────────── */
const STAGE_FIELDS = {
  solicitacao: [
    { key: "request_type",   label: "Tipo de Solicitação",          hint: "Selecione o tipo de solicitação.",             type: "select",     options: DELIVERABLE_REQUEST_TYPES, required: true },
    { key: "request_date",   label: "Data de Solicitação",          hint: "Data em que a solicitação foi feita.",          type: "date",       required: true },
    { key: "assignee",       label: "Responsável pela Solicitação", hint: "Selecione o responsável.",                      type: "user",       required: true },
    { key: "request_status", label: "Status da Solicitação",        hint: "Status atual da solicitação.",                  type: "radio",      options: [{v:"pendente",l:"Pendente"},{v:"em_andamento",l:"Em andamento"},{v:"concluido",l:"Concluído"}] },
    { key: "observations",   label: "Observações",                  hint: "Observações adicionais.",                       type: "textarea" },
  ],
  em_producao: [
    { key: "production_stage",      label: "Etapa Atual",                   hint: "Etapa atual do processo de produção.",        type: "select",    options: ["Planejamento","Desenvolvimento","Finalização"], required: true },
    { key: "production_start_date", label: "Data de Início da Produção",    hint: "Data em que a produção foi iniciada.",         type: "date",      required: true },
    { key: "production_resources",  label: "Recursos Alocados",             hint: "Liste os recursos alocados.",                  type: "textarea" },
    { key: "production_progress",   label: "Progresso Atual (%)",           hint: "Progresso atual em porcentagem.",              type: "number",    required: true },
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
  { id: "comentarios", label: "Comentários", icon: MessageSquare },
  { id: "email",       label: "Email",       icon: Mail },
  { id: "pdf",         label: "PDF",         icon: FileDown },
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
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", fontSize: 11, fontWeight: 500,
              borderRadius: 9999,
              background:  active ? "#FFFFFF" : "transparent",
              color:       active ? "var(--accent)" : NEUTRAL.slate,
              border:      active ? "1px solid var(--accent)" : "1px solid transparent",
              boxShadow:   active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer", transition: "all 0.1s",
            }}
          >
            <Icon size={11} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Placeholder panel ─────────────────────────────────────── */
function PlaceholderPanel({ label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: NEUTRAL.slate }}>{label}</div>
      <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 9999, background: "var(--surface-alt)", color: NEUTRAL.slate }}>em breve</span>
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
            color: !isConfigured ? NEUTRAL.slate : "#FFFFFF",
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
          <div style={{ fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-line", padding: 12, borderRadius: 10, border: "1px solid #DDD6FE", background: "#FFFFFF", color: NEUTRAL.graphite }}>
            {result}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleGenerate}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 9999, border: "1px solid #E5E7EB", background: "#FFFFFF", color: NEUTRAL.slate, cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = PURPLE; e.currentTarget.style.color = PURPLE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = NEUTRAL.slate; }}
            >
              <RotateCcw size={10} />
              Regenerar
            </button>
            <button
              onClick={handleCopy}
              style={{
                display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "4px 10px",
                borderRadius: 9999, border: `1px solid ${copied ? "#BBF7D0" : "#E5E7EB"}`,
                background: copied ? "#F0FDF4" : "#FFFFFF", color: copied ? "#16A34A" : NEUTRAL.slate, cursor: "pointer",
              }}
              onMouseEnter={e => { if (!copied) { e.currentTarget.style.borderColor = NEUTRAL.graphite; e.currentTarget.style.color = NEUTRAL.graphite; } }}
              onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = NEUTRAL.slate; } }}
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
  background: "var(--surface)", color: NEUTRAL.graphite, outline: "none",
};
const focusBorder = e => { e.target.style.borderColor = "var(--accent)"; };
const blurBorder  = e => { e.target.style.borderColor = "#D1D5DB"; };

/* ── Small primitives ───────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
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
      {hint && <div style={{ fontSize: 11, color: NEUTRAL.slate, marginBottom: 5, lineHeight: 1.4 }}>{hint}</div>}
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
  if (field.type === "textarea") {
    return <textarea value={value || ""} rows={3} placeholder={field.hint}
      onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{ ...inputBase, resize: "vertical" }} onFocus={focusBorder} onBlur={blurBorder} />;
  }
  if (field.type === "select") {
    return (
      <select value={value || ""} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...inputBase, color: value ? NEUTRAL.graphite : NEUTRAL.slate }}
        onFocus={focusBorder} onBlur={blurBorder}>
        <option value="">Escolha uma opção</option>
        {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "user") {
    return (
      <select value={value || ""} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...inputBase, color: value ? NEUTRAL.graphite : NEUTRAL.slate }}
        onFocus={focusBorder} onBlur={blurBorder}>
        <option value="">Selecione um responsável</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    );
  }
  if (field.type === "radio") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {(field.options || []).map(o => (
          <label key={o.v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer", fontSize: 13, color: NEUTRAL.graphite }}>
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
          <label key={String(o.v)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: disabled ? "default" : "pointer", fontSize: 13, color: NEUTRAL.graphite }}>
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
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer", fontSize: 13, color: NEUTRAL.graphite }}>
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
    return <div style={{ fontSize: 12, color: NEUTRAL.slate, textAlign: "center", marginTop: 32 }}>Nenhuma atividade registrada.</div>;
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
            <div style={{ fontSize: 12, color: NEUTRAL.graphite, lineHeight: 1.5 }}>{a.description}</div>
            <div style={{ fontSize: 10, color: NEUTRAL.slate, marginTop: 2 }}>
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
          <Upload size={18} style={{ color: dragOver ? "var(--accent)" : NEUTRAL.slate, margin: "0 auto 6px" }} />
          <div style={{ fontSize: 12, color: NEUTRAL.slate, fontWeight: 500 }}>
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
          <Loader2 size={16} style={{ color: NEUTRAL.slate }} className="animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <div style={{ fontSize: 12, color: NEUTRAL.slate, textAlign: "center", padding: "16px 0" }}>Nenhum anexo ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {attachments.map(att => {
            const Icon = fileIconFn(att.mime_type);
            return (
              <div key={att.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                <Icon size={16} style={{ color: NEUTRAL.slate, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: NEUTRAL.graphite, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.file_name}</div>
                  {att.file_size && <div style={{ fontSize: 10, color: NEUTRAL.slate }}>{humanSize(att.file_size)}</div>}
                </div>
                <button onClick={() => handleDownload(att)} title="Baixar"
                  style={{ background: "none", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, borderRadius: 4, display: "flex" }}
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

  if (loading) return <div style={{ fontSize: 12, color: NEUTRAL.slate, textAlign: "center", padding: 20 }}>Carregando…</div>;

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
                <div style={{ fontWeight: 600, fontSize: 12, color: NEUTRAL.graphite }}>{cl.title}</div>
                <div style={{ fontSize: 10, color: NEUTRAL.slate, marginTop: 2 }}>{done}/{total} concluídos</div>
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
                  <span style={{ fontSize: 12, flex: 1, color: it.done ? NEUTRAL.slate : NEUTRAL.graphite, textDecoration: it.done ? "line-through" : "none" }}>
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
        <div style={{ fontSize: 12, color: NEUTRAL.slate, textAlign: "center", padding: "16px 0" }}>Nenhuma checklist ainda.</div>
      )}
    </div>
  );
}

/* ── Comentários tab ────────────────────────────────────────── */
function ComentariosTab({ item, onUpdate, canWrite }) {
  const [text,    setText]   = useState("");
  const [sending, setSending] = useState(false);
  const notes = Array.isArray(item.notes) ? item.notes : [];

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !canWrite) return;
    setSending(true);
    try {
      const note     = { text: trimmed, createdAt: new Date().toISOString() };
      const activity = { type: "note_added", description: "Comentário adicionado", at: new Date().toISOString() };
      await onUpdate(item.id, {
        notes:      [...notes, note],
        activities: [...(item.activities || []), activity],
      });
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {notes.length === 0
          ? <div style={{ fontSize: 12, color: NEUTRAL.slate, textAlign: "center", marginTop: 20 }}>Nenhum comentário ainda.</div>
          : [...notes].reverse().map((n, i) => (
            <div key={i} style={{ marginBottom: 10, padding: "10px 12px", background: "var(--surface-alt)", borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: NEUTRAL.graphite, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.text}</div>
              {n.createdAt && (
                <div style={{ fontSize: 10, color: NEUTRAL.slate, marginTop: 4 }}>
                  {new Date(n.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </div>
              )}
            </div>
          ))
        }
      </div>
      {canWrite && (
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            placeholder="Escreva um comentário…" rows={2}
            style={{ ...inputBase, flex: 1, resize: "none" }}
            onFocus={focusBorder} onBlur={blurBorder}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button onClick={handleSend} disabled={sending || !text.trim()}
            style={{ background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 6, padding: "0 14px", cursor: (sending || !text.trim()) ? "default" : "pointer", opacity: (sending || !text.trim()) ? 0.5 : 1, display: "flex", alignItems: "center" }}>
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export function DeliverableDetailDrawer({ item, onClose, onUpdate, onDelete, users = [], canWrite, userId, currentUser }) {
  const [sideTab,      setSideTab]     = useState("form");
  const [mobileTab,    setMobileTab]   = useState("info");
  const [fieldValues,  setFieldValues] = useState(() => item.stageData?.[item.stage] ?? {});
  const [saveStatus,   setSaveStatus]  = useState(null); // 'saving' | 'saved' | null
  const [confirmDel,   setConfirmDel]  = useState(false);
  const [deleting,     setDeleting]    = useState(false);

  const fieldValuesRef = useRef(fieldValues);
  const itemRef        = useRef(item);
  const saveTimerRef   = useRef(null);
  useEffect(() => { fieldValuesRef.current = fieldValues; }, [fieldValues]);
  useEffect(() => { itemRef.current = item; }, [item]);

  useEffect(() => {
    setFieldValues(item.stageData?.[item.stage] ?? {});
    fieldValuesRef.current = item.stageData?.[item.stage] ?? {};
    setSaveStatus(null);
    setSideTab("form");
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
  }, [item.id, item.stage]);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const stageInfo  = DELIVERABLE_STAGES.find(s => s.id === item.stage);
  const stageOrder = DELIVERABLE_STAGES.map(s => s.id);
  const currentIdx = stageOrder.indexOf(item.stage);
  const nextStages = DELIVERABLE_STAGES.slice(currentIdx + 1);
  const prevStages = DELIVERABLE_STAGES.slice(0, currentIdx).reverse();
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
          patch.assignee = fieldValuesRef.current.assignee || null;
        }
        await onUpdate(it.id, patch);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2500);
      } catch {
        setSaveStatus(null);
      }
    }, 600);
  }, [onUpdate]);

  const handleMoveStage = async (stageId) => {
    const stageName = DELIVERABLE_STAGES.find(s => s.id === stageId)?.name || stageId;
    await onUpdate(item.id, {
      stage:          stageId,
      stageChangedAt: new Date().toISOString(),
      activities: [
        ...(item.activities || []),
        { type: "stage_change", description: `Movido para ${stageName}`, at: new Date().toISOString() },
      ],
    });
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(item.id); onClose(); }
    finally { setDeleting(false); }
  };

  // ── Left tab content ──────────────────────────────────────────────────────
  function LeftTabContent() {
    if (sideTab === "form") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionLabel>Formulário Inicial</SectionLabel>
          {[
            { label: "Título",       val: item.title },
            { label: "Solicitante",  val: item.requesterName },
            { label: "Departamento", val: item.department },
          ].map(({ label, val }) => val ? (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
              <ReadValue value={val} />
            </div>
          ) : null)}
          {item.description && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Descrição</div>
              <div style={{ fontSize: 12, color: NEUTRAL.graphite, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{item.description}</div>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Prazo</div>
            {item.deadline
              ? <span style={{ fontSize: 13, fontWeight: 600, color: new Date(item.deadline) < new Date() ? "#DC2626" : NEUTRAL.graphite }}>{formatDateBR(item.deadline)}</span>
              : <ReadValue value={null} />}
          </div>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #E5E7EB" }}>
            <SectionLabel>Histórico de Etapas</SectionLabel>
            {(item.activities || []).filter(a => a.type === "stage_change").length === 0
              ? <div style={{ fontSize: 11, color: NEUTRAL.slate }}>Nenhuma transição registrada.</div>
              : [...(item.activities || [])].filter(a => a.type === "stage_change").reverse().map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 11 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: NEUTRAL.graphite }}>{a.description}</div>
                    <div style={{ color: NEUTRAL.slate, fontSize: 10 }}>{new Date(a.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div>
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
    if (sideTab === "comentarios") return <ComentariosTab item={item} onUpdate={onUpdate} canWrite={canWrite} />;
    if (sideTab === "email") return <PlaceholderPanel label="Integração de e-mail" />;
    if (sideTab === "pdf")   return <PlaceholderPanel label="Exportar PDF" />;
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex lg:items-center lg:justify-center lg:p-6"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full flex-1 flex flex-col lg:flex-none lg:max-w-6xl lg:rounded-2xl lg:max-h-[92vh]"
        style={{ background: "#FFFFFF", boxShadow: "0 24px 64px rgba(32,26,26,0.18)", overflow: "hidden", height: "100%" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-10 flex flex-col shrink-0" style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}>
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer" style={{ background: "none", border: "none", color: NEUTRAL.slate }}>
              <X size={20} />
            </button>
            <div className="flex-1 mx-3 text-center min-w-0">
              <div className="font-bold text-sm truncate" style={{ color: NEUTRAL.graphite }}>{item.title}</div>
              {stageInfo && <div className="text-xs font-semibold" style={{ color: stageInfo.color }}>{stageInfo.name}</div>}
            </div>
            {item.priority && (
              <span style={{ fontSize: 10, fontWeight: 700, color: priorityColor, background: priorityColor + "18", border: `1px solid ${priorityColor}40`, borderRadius: 4, padding: "2px 8px" }}>
                {priorityLabel}
              </span>
            )}
          </div>
          <div className="flex border-t" style={{ borderColor: "#E5E7EB" }}>
            {[{ id: "info", label: "INFORMAÇÕES" }, { id: "stage", label: "FASE ATUAL" }].map(t => (
              <button
                key={t.id}
                onClick={() => setMobileTab(t.id)}
                className="flex-1 py-2.5 text-xs font-bold tracking-wider cursor-pointer"
                style={{ background: "none", border: "none", borderBottom: `2px solid ${mobileTab === t.id ? "var(--accent)" : "transparent"}`, color: mobileTab === t.id ? "var(--accent)" : NEUTRAL.slate }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop header */}
        <div
          className="hidden lg:flex sticky top-0 z-10 px-5 py-3.5 border-b items-center justify-between shrink-0"
          style={{ background: "rgba(255,255,255,0.97)", borderColor: "#E5E7EB", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
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
                style={{ background: "var(--surface-alt)", color: NEUTRAL.graphite, border: "1px solid #E5E7EB" }}>
                {companyLabels}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canWrite && (
              <button
                onClick={() => setConfirmDel(v => !v)}
                title="Excluir entrega"
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: NEUTRAL.slate, background: "none", border: "none" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#B91C1C"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NEUTRAL.slate; }}
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: NEUTRAL.slate, background: "none", border: "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Confirm delete bar */}
        {confirmDel && canWrite && (
          <div className="shrink-0 px-5 py-2.5 flex items-center gap-3 border-b" style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
            <span className="text-xs font-semibold flex-1" style={{ color: "#B91C1C" }}>Confirmar exclusão desta entrega?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl"
              style={{ background: "#DC2626", color: "#FFF", border: "none", cursor: "pointer" }}
            >
              {deleting ? "Excluindo…" : "Sim, excluir"}
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="px-3 py-1.5 text-xs rounded-xl border"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate, background: "#FFF", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* ── BODY ── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

          {/* ── LEFT sidebar ── */}
          <aside
            className={`w-full lg:w-[300px] flex-1 min-h-0 lg:flex-none lg:shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r p-5 space-y-4${mobileTab !== "info" ? " hidden lg:flex lg:flex-col" : ""}`}
            style={{ borderColor: "#E5E7EB", background: "var(--surface)" }}
          >
            {/* Item header */}
            <div>
              <h2 className="font-bold mb-1" style={{ fontSize: 17, color: NEUTRAL.graphite, letterSpacing: "-0.01em", wordBreak: "break-word" }}>
                {item.title}
              </h2>
              {companyLabels && <div className="text-xs" style={{ color: NEUTRAL.slate }}>{companyLabels}</div>}
            </div>

            {/* Company + priority pills */}
            <div className="flex flex-wrap gap-1.5">
              {(item.companyIds || []).map(id => {
                const co = COMPANIES[id];
                if (!co) return null;
                return (
                  <span key={id} className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: co.primary + "18", color: co.primary, border: `1px solid ${co.primary}30` }}>
                    {co.short}
                  </span>
                );
              })}
              {item.priority && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: priorityColor + "18", color: priorityColor, border: `1px solid ${priorityColor}40` }}>
                  {priorityLabel}
                </span>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-2" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: NEUTRAL.slate }}>Prazo</div>
                <div className="text-xs font-bold mt-0.5" style={{ color: item.deadline && new Date(item.deadline) < new Date() ? "#DC2626" : NEUTRAL.graphite }}>
                  {item.deadline ? formatDateBR(item.deadline) : "—"}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: NEUTRAL.slate }}>Etapa</div>
                <div className="text-xs font-bold mt-0.5 truncate" style={{ color: stageInfo?.color || NEUTRAL.graphite }}>
                  {stageInfo?.name || "—"}
                </div>
              </div>
              {item.department && (
                <div className="col-span-2 rounded-lg p-2" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: NEUTRAL.slate }}>Departamento</div>
                  <div className="text-xs font-bold mt-0.5 truncate" style={{ color: NEUTRAL.graphite }}>{item.department}</div>
                </div>
              )}
            </div>

            {/* ── Pill SideTabs ── */}
            <div className="pt-1 border-t" style={{ borderColor: "#E5E7EB" }}>
              <SideTabs activeId={sideTab} onChange={setSideTab} />
            </div>

            {/* ── Tab content ── */}
            <div className="flex-1">
              <LeftTabContent />
            </div>
          </aside>

          {/* ── CENTER: stage bar + stage fields ── */}
          <main
            className={`flex-1 min-h-0 overflow-y-auto p-5 space-y-5${mobileTab !== "stage" ? " hidden lg:block" : ""}`}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <SectionLabel>Fase atual</SectionLabel>
                {stageInfo && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: stageInfo.color, background: stageInfo.color + "18", border: `1px solid ${stageInfo.color}40`, borderRadius: 5, padding: "2px 8px", marginTop: -14 }}>
                    {stageInfo.name}
                  </span>
                )}
                {saveStatus && (
                  <span style={{ fontSize: 10, color: saveStatus === "saved" ? "#16A34A" : NEUTRAL.slate, marginTop: -14, marginLeft: "auto" }}>
                    {saveStatus === "saving" ? "Salvando…" : "✓ Salvo"}
                  </span>
                )}
              </div>
              {fields.length === 0
                ? <div style={{ fontSize: 12, color: NEUTRAL.slate }}>Nenhum campo para esta fase.</div>
                : fields.map(field => (
                  <FieldRow key={field.key} label={field.label} required={field.required} hint={field.hint}>
                    <StageFieldInput field={field} value={fieldValues[field.key]} onChange={val => handleFieldChange(field.key, val)} canWrite={canWrite} users={users} />
                  </FieldRow>
                ))
              }
            </div>
          </main>

          {/* ── RIGHT sidebar ── */}
          <aside
            className="hidden lg:flex lg:flex-col w-full lg:w-[220px] shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l p-5 gap-4"
            style={{ borderColor: "#E5E7EB", background: "var(--surface)" }}
          >
            <div>
              <div className="text-xs font-semibold mb-3" style={{ color: NEUTRAL.graphite, letterSpacing: "0.02em" }}>
                Mover entrega para fase
              </div>
              <div className="space-y-2">
                {nextStages.map(s => (
                  <button key={s.id}
                    onClick={() => canWrite && handleMoveStage(s.id)}
                    disabled={!canWrite}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                    style={{ background: s.color + "14", color: s.color, border: `1px solid ${s.color}30`, opacity: canWrite ? 1 : 0.5 }}
                    onMouseEnter={e => { if (canWrite) e.currentTarget.style.background = s.color + "22"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = s.color + "14"; }}
                  >
                    <span>{s.name}</span>
                    <ArrowRight size={14} />
                  </button>
                ))}
                {prevStages.map(s => (
                  <button key={s.id}
                    onClick={() => canWrite && handleMoveStage(s.id)}
                    disabled={!canWrite}
                    className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    style={{ background: "#FFFFFF", color: NEUTRAL.graphite, border: "1px solid #E5E7EB", opacity: canWrite ? 1 : 0.5 }}
                    onMouseEnter={e => { if (canWrite) e.currentTarget.style.background = "var(--surface-alt)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}
                  >
                    <ArrowLeft size={13} />
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI move link */}
            <div className="border-t pt-3" style={{ borderColor: "#E5E7EB" }}>
              <button
                onClick={() => setSideTab("ia")}
                className="flex items-center gap-1.5 text-xs w-full cursor-pointer"
                style={{ background: "none", border: "none", color: NEUTRAL.slate, padding: 0, textAlign: "left" }}
                onMouseEnter={e => { e.currentTarget.style.color = PURPLE; }}
                onMouseLeave={e => { e.currentTarget.style.color = NEUTRAL.slate; }}
              >
                <Sparkles size={12} />
                Mover cards com IA
              </button>
            </div>
          </aside>
        </div>

        {/* Mobile sticky footer */}
        <div className="lg:hidden shrink-0 border-t px-4 py-3" style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}>
          {nextStages.length > 0 && canWrite ? (
            <button
              onClick={() => handleMoveStage(nextStages[0].id)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm cursor-pointer"
              style={{ background: nextStages[0].color, color: "#FFFFFF", border: "none" }}
            >
              Avançar para {nextStages[0].name}
              <ArrowRight size={16} />
            </button>
          ) : (
            <div className="text-xs text-center py-3" style={{ color: NEUTRAL.slate }}>
              {currentIdx >= DELIVERABLE_STAGES.length - 1 ? "Entrega concluída" : "Fase atual"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
