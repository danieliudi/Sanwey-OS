import React, { useState, useEffect } from "react";
import { X, ArrowRight, Trash2 } from "lucide-react";
import { NEUTRAL, COMPANIES } from "../../constants/companies";
import {
  DELIVERABLE_STAGES,
  DELIVERABLE_REQUEST_TYPES,
} from "../../constants/marketing-pipelines";
import { formatDateBR } from "../../utils/date";

const PRIORITY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_COLORS = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };
const STATUS_OPTIONS  = ["Pendente", "Em andamento", "Concluído"];

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
        {label}
      </div>
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

export function DeliverableDetailDrawer({ item, onClose, onUpdate, onDelete, users = [], canWrite }) {
  const [saving, setSaving]           = useState(false);
  const [requestType, setRequestType] = useState(item.requestType || "");
  const [requestDate, setRequestDate] = useState(item.requestDate ? item.requestDate.slice(0, 10) : "");
  const [assignee, setAssignee]       = useState(item.assignee || "");
  const [requestStatus, setStatus]    = useState(item.requestStatus || "pendente");
  const [observations, setObs]        = useState(item.observations || "");
  const [dirty, setDirty]             = useState(false);
  const [deleting, setDeleting]       = useState(false);

  const stage = DELIVERABLE_STAGES.find(s => s.id === item.stage);
  const moveTargets = DELIVERABLE_STAGES.filter(s => s.id !== item.stage && !s.terminal);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const markDirty = setter => val => { setter(val); setDirty(true); };

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await onUpdate(item.id, {
        requestType:   requestType || null,
        requestDate:   requestDate ? new Date(requestDate).toISOString() : null,
        assignee:      assignee || null,
        requestStatus,
        observations:  observations || null,
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = async (stageId) => {
    await onUpdate(item.id, { stage: stageId, stageChangedAt: new Date().toISOString() });
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm("Remover esta entrega?")) return;
    setDeleting(true);
    try { await onDelete(item.id); onClose(); }
    finally { setDeleting(false); }
  };

  const priorityColor = PRIORITY_COLORS[item.priority] || NEUTRAL.slate;
  const companyLabels = (item.companyIds || []).map(id => COMPANIES[id]?.short || id).join(", ");

  const inputSt  = { borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", width: "100%", fontSize: 13, borderRadius: 8, border: "1px solid #D1D5DB", padding: "7px 10px", outline: "none" };
  const focusSt  = e => { e.target.style.borderColor = "#1E4D8C"; };
  const blurSt   = e => { e.target.style.borderColor = "#D1D5DB"; };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0, right: 0, bottom: 0,
          width: "min(900px, 96vw)",
          background: "#F9FAFB",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.18)",
          overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: NEUTRAL.graphite, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
              {companyLabels && (
                <span style={{ fontSize: 11, color: NEUTRAL.slate }}>{companyLabels}</span>
              )}
              {item.priority && (
                <span style={{ fontSize: 10, fontWeight: 700, color: priorityColor, background: priorityColor + "18", border: `1px solid ${priorityColor}40`, borderRadius: 4, padding: "1px 6px" }}>
                  {PRIORITY_LABELS[item.priority] || item.priority}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 6, borderRadius: 8, display: "flex" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — 3 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 220px", flex: 1, minHeight: 0, gap: 0 }}>

          {/* Col 1 — Formulário Inicial */}
          <div style={{ padding: "24px 20px", borderRight: "1px solid #E5E7EB", background: "#FFFFFF", overflowY: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>
              Formulário Inicial
            </div>

            <FieldRow label="Título">
              <ReadValue value={item.title} />
            </FieldRow>

            {item.requesterName && (
              <FieldRow label="Nome do Solicitante">
                <ReadValue value={item.requesterName} />
              </FieldRow>
            )}

            {item.department && (
              <FieldRow label="Departamento">
                <ReadValue value={item.department} />
              </FieldRow>
            )}

            {item.description && (
              <FieldRow label="Descrição do Entregável">
                <div style={{ fontSize: 13, color: NEUTRAL.graphite, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {item.description}
                </div>
              </FieldRow>
            )}

            <FieldRow label="Prazo">
              {item.deadline ? (
                <span style={{ fontSize: 13, color: new Date(item.deadline) < new Date() ? "#DC2626" : NEUTRAL.graphite, fontWeight: 600 }}>
                  {formatDateBR(item.deadline)}
                </span>
              ) : <ReadValue value={null} />}
            </FieldRow>

            {item.priority && (
              <FieldRow label="Prioridade">
                <span style={{ fontSize: 12, fontWeight: 700, color: priorityColor, background: priorityColor + "18", border: `1px solid ${priorityColor}40`, borderRadius: 6, padding: "3px 10px", display: "inline-block" }}>
                  {PRIORITY_LABELS[item.priority] || item.priority}
                </span>
              </FieldRow>
            )}
          </div>

          {/* Col 2 — Fase atual */}
          <div style={{ padding: "24px 20px", borderRight: "1px solid #E5E7EB", background: "#FFFFFF", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Fase atual
              </div>
              {stage && (
                <span style={{ fontSize: 11, fontWeight: 600, color: stage.color, background: stage.color + "18", border: `1px solid ${stage.color}40`, borderRadius: 6, padding: "2px 8px" }}>
                  {stage.name}
                </span>
              )}
            </div>

            <FieldRow label="* Tipo de Solicitação">
              <select
                value={requestType}
                onChange={e => markDirty(setRequestType)(e.target.value)}
                style={{ ...inputSt, color: requestType ? NEUTRAL.graphite : NEUTRAL.slate }}
                onFocus={focusSt}
                onBlur={blurSt}
                disabled={!canWrite}
              >
                <option value="">Escolha uma opção</option>
                {DELIVERABLE_REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FieldRow>

            <FieldRow label="* Data de Solicitação">
              <input
                type="date"
                value={requestDate}
                onChange={e => markDirty(setRequestDate)(e.target.value)}
                style={inputSt}
                onFocus={focusSt}
                onBlur={blurSt}
                disabled={!canWrite}
              />
            </FieldRow>

            <FieldRow label="* Responsável pela Solicitação">
              <select
                value={assignee}
                onChange={e => markDirty(setAssignee)(e.target.value)}
                style={{ ...inputSt, color: assignee ? NEUTRAL.graphite : NEUTRAL.slate }}
                onFocus={focusSt}
                onBlur={blurSt}
                disabled={!canWrite}
              >
                <option value="">Adicionar responsável</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FieldRow>

            <FieldRow label="Status da Solicitação">
              <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                {STATUS_OPTIONS.map(opt => {
                  const val = opt.toLowerCase().replace(" ", "_");
                  const active = requestStatus === val || requestStatus === opt.toLowerCase();
                  return (
                    <label
                      key={opt}
                      style={{ display: "flex", alignItems: "center", gap: 8, cursor: canWrite ? "pointer" : "default", fontSize: 13, color: NEUTRAL.graphite }}
                    >
                      <input
                        type="radio"
                        name="request_status"
                        value={val}
                        checked={active}
                        onChange={() => markDirty(setStatus)(val)}
                        disabled={!canWrite}
                        style={{ accentColor: "#1E4D8C" }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </FieldRow>

            <FieldRow label="Observações">
              <textarea
                value={observations}
                onChange={e => markDirty(setObs)(e.target.value)}
                placeholder="Digite aqui ..."
                rows={4}
                style={{ ...inputSt, resize: "vertical" }}
                onFocus={focusSt}
                onBlur={blurSt}
                disabled={!canWrite}
              />
            </FieldRow>

            {canWrite && dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background: "#1E4D8C", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
            )}
          </div>

          {/* Col 3 — Mover fase + ações */}
          <div style={{ padding: "24px 16px", background: "#F9FAFB", overflowY: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Mover card para fase
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {DELIVERABLE_STAGES.filter(s => s.id !== item.stage).map(s => (
                <button
                  key={s.id}
                  onClick={() => canWrite && handleMoveStage(s.id)}
                  disabled={!canWrite}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    cursor: canWrite ? "pointer" : "default",
                    fontSize: 12,
                    fontWeight: 600,
                    color: NEUTRAL.graphite,
                    textAlign: "left",
                    transition: "all 0.1s",
                    opacity: canWrite ? 1 : 0.5,
                  }}
                  onMouseEnter={e => { if (canWrite) { e.currentTarget.style.background = s.color + "12"; e.currentTarget.style.borderColor = s.color + "60"; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{s.name}</span>
                  <ArrowRight size={11} style={{ opacity: 0.4 }} />
                </button>
              ))}
            </div>

            {canWrite && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #E5E7EB" }}>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#DC2626", background: "transparent", border: "none", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.5 : 1, padding: "4px 0" }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                >
                  <Trash2 size={13} />
                  Remover entrega
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
