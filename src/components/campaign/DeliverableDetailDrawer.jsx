import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X, ArrowRight, ArrowLeft, Trash2,
  FileText, Activity, Paperclip, CheckSquare, MessageSquare,
  Send, Upload, File, FileImage, Download, Plus, Loader,
  Check, Star,
} from "lucide-react";
import { NEUTRAL, COMPANIES } from "../../constants/companies";
import {
  DELIVERABLE_STAGES,
  DELIVERABLE_REQUEST_TYPES,
} from "../../constants/marketing-pipelines";
import { formatDateBR } from "../../utils/date";
import { useDeliverableAttachments } from "../../hooks/use-deliverable-attachments";
import { useDeliverableChecklists }  from "../../hooks/use-deliverable-checklists";

/* ── Priority helpers ───────────────────────────────────────── */
const PRIORITY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_COLORS = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };

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

/* ── Tab definitions ────────────────────────────────────────── */
const TABS = [
  { id: "form",        label: "Form",        Icon: FileText },
  { id: "atividades",  label: "Atividades",  Icon: Activity },
  { id: "anexos",      label: "Anexos",      Icon: Paperclip },
  { id: "checklists",  label: "Checklists",  Icon: CheckSquare },
  { id: "comentarios", label: "Comentários", Icon: MessageSquare },
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
    const checked = Array.isArray(value) ? value : [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {(field.options || []).map(opt => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer", fontSize: 13, color: NEUTRAL.graphite }}>
            <input type="checkbox" checked={checked.includes(opt)}
              onChange={() => { if (!disabled) onChange(checked.includes(opt) ? checked.filter(x => x !== opt) : [...checked, opt]); }}
              disabled={disabled} style={{ accentColor: "#1E4D8C", width: 14, height: 14 }} />
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
  const typeColor = { stage_change: "#1E4D8C", field_save: "#16A34A", note_added: "#7C3AED", created: "#D97706" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {sorted.map((a, i) => (
        <div key={i} style={{ display: "flex", gap: 10, paddingBottom: 14, position: "relative" }}>
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
function fileIcon(mime) {
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
            borderRadius: 10, border: `2px dashed ${dragOver ? "#1E4D8C" : "#D1D5DB"}`,
            background: dragOver ? "#EFF6FF" : "#FAFAFA",
            padding: "20px 12px", textAlign: "center", cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <Upload size={18} style={{ color: dragOver ? "#1E4D8C" : NEUTRAL.slate, margin: "0 auto 6px" }} />
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
        <div style={{ textAlign: "center", padding: 16 }}><Loader size={16} style={{ color: NEUTRAL.slate, animation: "spin 1s linear infinite" }} /></div>
      ) : attachments.length === 0 ? (
        <div style={{ fontSize: 12, color: NEUTRAL.slate, textAlign: "center", padding: "16px 0" }}>Nenhum anexo ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {attachments.map(att => {
            const Icon = fileIcon(att.mime_type);
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
  const [newTexts, setNewTexts]       = useState({});
  const [creating, setCreating]       = useState(false);

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
                  <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#16A34A" : "#1E4D8C", transition: "width 0.3s" }} />
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
                    style={{ background: "#1E4D8C", border: "none", borderRadius: 6, color: "#FFF", padding: "0 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
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
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#1E4D8C", background: "transparent", border: "1px dashed #BFDBFE", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 500, justifyContent: "center" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; }}
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 12 }}>
        {notes.length === 0
          ? <div style={{ fontSize: 12, color: NEUTRAL.slate, textAlign: "center", marginTop: 32 }}>Nenhum comentário ainda.</div>
          : [...notes].reverse().map((n, i) => (
            <div key={i} style={{ marginBottom: 10, padding: "10px 12px", background: "#F3F4F6", borderRadius: 8 }}>
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
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid #E5E7EB", paddingTop: 12, flexShrink: 0 }}>
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            placeholder="Escreva um comentário…" rows={2}
            style={{ ...inputBase, flex: 1, resize: "none" }}
            onFocus={focusBorder} onBlur={blurBorder}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button onClick={handleSend} disabled={sending || !text.trim()}
            style={{ background: "#1E4D8C", color: "#FFF", border: "none", borderRadius: 6, padding: "0 14px", cursor: (sending || !text.trim()) ? "default" : "pointer", opacity: (sending || !text.trim()) ? 0.5 : 1, display: "flex", alignItems: "center" }}>
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export function DeliverableDetailDrawer({ item, onClose, onUpdate, onDelete, users = [], canWrite, userId }) {
  const [activeTab,    setActiveTab]   = useState("form");
  const [mobileTab,    setMobileTab]   = useState("info");
  const [fieldValues,  setFieldValues] = useState(() => item.stageData?.[item.stage] ?? {});
  const [saveStatus,   setSaveStatus]  = useState(null); // 'saving' | 'saved' | null
  const [deleting,     setDeleting]    = useState(false);

  /* Refs to avoid stale closures in debounce */
  const fieldValuesRef = useRef(fieldValues);
  const itemRef        = useRef(item);
  const saveTimerRef   = useRef(null);
  useEffect(() => { fieldValuesRef.current = fieldValues; }, [fieldValues]);
  useEffect(() => { itemRef.current = item; }, [item]);

  /* Re-init fields when stage or item changes externally */
  useEffect(() => {
    setFieldValues(item.stageData?.[item.stage] ?? {});
    fieldValuesRef.current = item.stageData?.[item.stage] ?? {};
    setSaveStatus(null);
    setMobileTab("info");
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
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

  /* Priority / companies */
  const priorityColor = PRIORITY_COLORS[item.priority] || NEUTRAL.slate;
  const priorityLabel = PRIORITY_LABELS[item.priority] || item.priority;
  const companyLabels = (item.companyIds || []).map(id => COMPANIES[id]?.short || id).join(", ");

  /* ── Field change with debounce auto-save ── */
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
        const activity = {
          type: "field_save",
          description: `Campos de "${it.stage}" atualizados`,
          at: new Date().toISOString(),
        };
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

  /* Move stage */
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

  /* Delete */
  const handleDelete = async () => {
    if (!window.confirm("Remover esta entrega?")) return;
    setDeleting(true);
    try { await onDelete(item.id); onClose(); }
    finally { setDeleting(false); }
  };

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200 }} onClick={onClose} />

      {/* Drawer */}
      <div
        className="flex flex-col"
        style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(960px, 100vw)", background: "#F3F4F6", zIndex: 201, boxShadow: "-8px 0 40px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Mobile header ────────────────────────────────────────── */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b shrink-0" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, borderRadius: 6, display: "flex", flexShrink: 0 }}>
            <X size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: NEUTRAL.graphite, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
            {stageInfo && <div style={{ fontSize: 11, color: stageInfo.color, marginTop: 2 }}>{stageInfo.name}</div>}
          </div>
          {item.priority && (
            <span style={{ fontSize: 10, fontWeight: 700, color: priorityColor, background: priorityColor + "18", border: `1px solid ${priorityColor}40`, borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>
              {priorityLabel}
            </span>
          )}
        </div>

        {/* ── Mobile tab bar ────────────────────────────────────────── */}
        <div className="lg:hidden flex border-b shrink-0" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
          {[{ id: "info", label: "INFORMAÇÕES" }, { id: "stage", label: "FASE ATUAL" }].map(t => (
            <button
              key={t.id}
              onClick={() => setMobileTab(t.id)}
              style={{
                flex: 1, padding: "12px 0", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                background: "transparent", border: "none", cursor: "pointer",
                color: mobileTab === t.id ? "#1E4D8C" : NEUTRAL.slate,
                borderBottom: `2px solid ${mobileTab === t.id ? "#1E4D8C" : "transparent"}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Desktop header ────────────────────────────────────────── */}
        <div className="hidden lg:flex items-center gap-3 shrink-0" style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", padding: "14px 20px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              {item.starred && <Star size={14} fill="#F59E0B" color="#F59E0B" />}
              <div style={{ fontWeight: 700, fontSize: 15, color: NEUTRAL.graphite, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
        <div className={`flex-1 min-h-0 flex flex-col lg:grid lg:[grid-template-columns:240px_1fr_220px]`}>

          {/* ── Col 1: Tabs (INFORMAÇÕES on mobile) ── */}
          <div className={`${mobileTab !== "info" ? "hidden lg:flex" : "flex"} flex-col`} style={{ background: "#FFFFFF", borderRight: "1px solid #E5E7EB" }}>
            {/* Tab bar */}
            <div style={{ borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      width: "100%", padding: "10px 16px",
                      background: active ? "#EFF6FF" : "transparent",
                      border: "none",
                      borderLeft: active ? "3px solid #1E4D8C" : "3px solid transparent",
                      cursor: "pointer",
                      fontSize: 12, fontWeight: active ? 700 : 500,
                      color: active ? "#1E4D8C" : NEUTRAL.slate,
                      textAlign: "left", transition: "all 0.1s",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F9FAFB"; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                    <tab.Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column" }}>
              {activeTab === "form" && (
                <>
                  <SectionLabel>Formulário Inicial</SectionLabel>
                  {[
                    { label: "Título",       val: item.title },
                    { label: "Solicitante",  val: item.requesterName },
                    { label: "Departamento", val: item.department },
                  ].map(({ label, val }) => val ? (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                      <ReadValue value={val} />
                    </div>
                  ) : null)}

                  {item.description && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Descrição</div>
                      <div style={{ fontSize: 12, color: NEUTRAL.graphite, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{item.description}</div>
                    </div>
                  )}

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Prazo</div>
                    {item.deadline
                      ? <span style={{ fontSize: 13, fontWeight: 600, color: new Date(item.deadline) < new Date() ? "#DC2626" : NEUTRAL.graphite }}>{formatDateBR(item.deadline)}</span>
                      : <ReadValue value={null} />
                    }
                  </div>

                  {item.priority && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Prioridade</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor, background: priorityColor + "18", border: `1px solid ${priorityColor}40`, borderRadius: 5, padding: "2px 8px", display: "inline-block" }}>
                        {priorityLabel}
                      </span>
                    </div>
                  )}

                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #E5E7EB" }}>
                    <SectionLabel>Histórico de Etapas</SectionLabel>
                    {(item.activities || []).filter(a => a.type === "stage_change").length === 0
                      ? <div style={{ fontSize: 11, color: NEUTRAL.slate }}>Nenhuma transição registrada.</div>
                      : [...(item.activities || [])].filter(a => a.type === "stage_change").reverse().map((a, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 11 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1E4D8C", marginTop: 4, flexShrink: 0 }} />
                          <div>
                            <div style={{ color: NEUTRAL.graphite }}>{a.description}</div>
                            <div style={{ color: NEUTRAL.slate, fontSize: 10 }}>{new Date(a.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </>
              )}
              {activeTab === "atividades"  && <AtividadesTab activities={item.activities} />}
              {activeTab === "anexos"      && <AnexosTab deliverableId={item.id} canWrite={canWrite} userId={userId} />}
              {activeTab === "checklists"  && <ChecklistsTab deliverableId={item.id} canWrite={canWrite} userId={userId} />}
              {activeTab === "comentarios" && <ComentariosTab item={item} onUpdate={onUpdate} canWrite={canWrite} />}
            </div>

            {/* Delete at bottom */}
            {canWrite && (
              <div style={{ padding: "12px 16px", borderTop: "1px solid #E5E7EB", flexShrink: 0 }}>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#DC2626", background: "transparent", border: "none", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.5 : 1, padding: "2px 0" }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
                  <Trash2 size={13} />
                  Remover entrega
                </button>
              </div>
            )}
          </div>

          {/* ── Col 2: Stage fields (FASE ATUAL on mobile) ── */}
          <div className={mobileTab !== "stage" ? "hidden lg:block" : "block"} style={{ background: "#FFFFFF", borderRight: "1px solid #E5E7EB", overflowY: "auto", padding: "24px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
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
                  <StageFieldInput
                    field={field}
                    value={fieldValues[field.key]}
                    onChange={val => handleFieldChange(field.key, val)}
                    canWrite={canWrite}
                    users={users}
                  />
                </FieldRow>
              ))
            }
          </div>

          {/* ── Col 3: Move stage (desktop only) ── */}
          <div className="hidden lg:block" style={{ background: "#F9FAFB", overflowY: "auto", padding: "24px 16px" }}>
            <SectionLabel>Mover card para fase</SectionLabel>

            {nextStages.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: NEUTRAL.slate, fontWeight: 600, marginBottom: 6, letterSpacing: "0.04em" }}>PRÓXIMAS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {nextStages.map(s => (
                    <button key={s.id} onClick={() => canWrite && handleMoveStage(s.id)} disabled={!canWrite}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: s.color + "14", border: `1px solid ${s.color}50`, borderRadius: 7, cursor: canWrite ? "pointer" : "default", fontSize: 12, fontWeight: 600, color: s.color, textAlign: "left", transition: "all 0.12s", opacity: canWrite ? 1 : 0.5 }}
                      onMouseEnter={e => { if (canWrite) e.currentTarget.style.background = s.color + "28"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = s.color + "14"; }}>
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
                    <button key={s.id} onClick={() => canWrite && handleMoveStage(s.id)} disabled={!canWrite}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 7, cursor: canWrite ? "pointer" : "default", fontSize: 12, fontWeight: 500, color: NEUTRAL.slate, textAlign: "left", transition: "all 0.12s", opacity: canWrite ? 1 : 0.5 }}
                      onMouseEnter={e => { if (canWrite) e.currentTarget.style.background = "#F3F4F6"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}>
                      <ArrowLeft size={12} />
                      <span style={{ flex: 1 }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Mobile sticky footer: Avançar ────────────────────────── */}
        <div className="lg:hidden shrink-0 border-t px-4 py-3" style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}>
          {nextStages.length > 0 ? (
            <button
              onClick={() => canWrite && handleMoveStage(nextStages[0].id)}
              disabled={!canWrite}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm"
              style={{
                background: canWrite ? nextStages[0].color : "#D1D5DB",
                color: "#FFFFFF",
                border: "none",
                cursor: canWrite ? "pointer" : "default",
              }}
            >
              Avançar para {nextStages[0].name}
              <ArrowRight size={16} />
            </button>
          ) : (
            <div className="text-xs text-center py-3" style={{ color: NEUTRAL.slate }}>
              Etapa final atingida
            </div>
          )}
        </div>
      </div>
    </>
  );
}
