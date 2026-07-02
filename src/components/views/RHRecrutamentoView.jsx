import React, { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Plus,
  Star,
  User,
  X,
  MessageSquare,
  ArrowRight,
  UserPlus,
  Link2,
  Check,
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import {
  RH_DEPARTMENTS,
  RH_RECRUITMENT_STAGES,
} from "../../constants/rh-config";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";

function whatsappShareUrl(vaga) {
  const link = `${window.location.origin}/vagas/${vaga.link_slug}`;
  const text = `Vaga aberta: ${vaga.title}! Envie seu currículo por aqui: ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function daysInStage(dateStr) {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

// ── Avatar circle ─────────────────────────────────────────────────────────────

function InitialsAvatar({ name, size = 32 }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: NEUTRAL.red,
        color: "#FFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ value = 0, max = 5, onChange }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={12}
          fill={i < value ? "#F59E0B" : "none"}
          stroke={i < value ? "#F59E0B" : "#D1D5DB"}
          style={{ cursor: onChange ? "pointer" : "default", flexShrink: 0 }}
          onClick={() => onChange && onChange(i + 1)}
        />
      ))}
    </div>
  );
}

// ── Nova Vaga Modal ───────────────────────────────────────────────────────────

function NovaVagaModal({ onSave, onClose }) {
  const [title, setTitle]       = useState("");
  const [dept, setDept]         = useState("");
  const [desc, setDesc]         = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError("Título obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), department: dept || null, description: desc.trim() || null });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar vaga.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", fontSize: 13 };
  const focusBlue = (e) => { e.target.style.borderColor = "#1E4D8C"; };
  const blurGray  = (e) => { e.target.style.borderColor = "#D1D5DB"; };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>Nova Vaga</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Título da vaga *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Analista de Marketing"
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt}
                onFocus={focusBlue}
                onBlur={blurGray}
                autoFocus
              />
            </div>
            <div>
              <label style={labelSt}>Departamento</label>
              <select
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                style={inputSt}
              >
                <option value="">Selecionar departamento</option>
                {RH_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelSt}>Descrição</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Descreva os requisitos e responsabilidades…"
                rows={4}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none"
                style={inputSt}
                onFocus={focusBlue}
                onBlur={blurGray}
              />
            </div>
          </div>

          {error && (
            <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              style={{ flex: 1, background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Criando…" : "Criar vaga"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Novo Candidato Modal ──────────────────────────────────────────────────────

function NovoCandidatoModal({ defaultStage, vagas, onSave, onClose }) {
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [phone, setPhone]   = useState("");
  const [vagaId, setVagaId] = useState("");
  const [source, setSource] = useState("");
  const [stage]             = useState(defaultStage);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Nome obrigatório."); return; }
    if (!vagaId) { setError("Selecione a vaga."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        vaga_id: vagaId,
        source: source.trim() || null,
        stage,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao adicionar candidato.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", fontSize: 13 };
  const focusBlue = (e) => { e.target.style.borderColor = "#1E4D8C"; };
  const blurGray  = (e) => { e.target.style.borderColor = "#D1D5DB"; };

  const stageInfo = RH_RECRUITMENT_STAGES.find((s) => s.id === stage);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>Novo Candidato</div>
            {stageInfo && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stageInfo.color, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: NEUTRAL.slate, fontWeight: 500 }}>{stageInfo.name}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelSt}>Nome *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} onFocus={focusBlue} onBlur={blurGray} autoFocus />
            </div>
            <div>
              <label style={labelSt}>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div>
              <label style={labelSt}>Telefone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-0000" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div>
              <label style={labelSt}>Vaga *</label>
              <select value={vagaId} onChange={(e) => setVagaId(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                <option value="">Selecionar vaga</option>
                {vagas.map((v) => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelSt}>Origem</label>
              <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="LinkedIn, Indicação…" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
            </div>
          </div>

          {error && (
            <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Adicionando…" : "Adicionar candidato"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Candidato Drawer ──────────────────────────────────────────────────────────

function CandidatoDrawer({ candidato, vagas, canWrite, onStageChange, onAddNote, onRatingChange, onClose, onConvertToEmployee }) {
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [reprovando, setReprovando] = useState(false);
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [savingStage, setSavingStage] = useState(false);

  const requestStageChange = (stageId) => {
    if (stageId === "reprovado") { setReprovando(true); return; }
    onStageChange(candidato.id, stageId);
  };

  const confirmReprovacao = async () => {
    if (!motivoReprovacao.trim()) return;
    setSavingStage(true);
    try {
      await onStageChange(candidato.id, "reprovado", motivoReprovacao.trim());
      setReprovando(false);
      setMotivoReprovacao("");
    } finally {
      setSavingStage(false);
    }
  };

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const vagaTitle = useMemo(() => {
    if (!candidato.vaga_id) return "—";
    return vagas.find((v) => v.id === candidato.vaga_id)?.title || "—";
  }, [candidato.vaga_id, vagas]);

  const currentStageIdx = RH_RECRUITMENT_STAGES.findIndex((s) => s.id === candidato.stage);
  const stageInfo = RH_RECRUITMENT_STAGES[currentStageIdx] || RH_RECRUITMENT_STAGES[0];
  const days = daysInStage(candidato.stage_changed_at);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const note = { text: noteText.trim(), created_at: new Date().toISOString() };
      await onAddNote(candidato.id, note);
      setNoteText("");
      setAddingNote(false);
    } finally {
      setSavingNote(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100vw)",
          background: "#FFFFFF",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <InitialsAvatar name={candidato.name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>{candidato.name}</div>
            {candidato.email && <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 2 }}>{candidato.email}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${stageInfo.color}18`, color: stageInfo.color, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageInfo.color, display: "inline-block" }} />
                {stageInfo.name}
              </span>
              <span style={{ fontSize: 11, color: NEUTRAL.slate }}>{days}d nesta etapa</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, borderRadius: 8, display: "flex", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto" }}>
          {/* Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Vaga",    value: vagaTitle },
              { label: "Origem",  value: candidato.source || "—" },
              { label: "Telefone", value: candidato.phone || "—" },
              { label: "Aplicado em", value: fmt(candidato.created_at) },
            ].map((f) => (
              <div key={f.label}>
                <div style={labelSt}>{f.label}</div>
                <div style={{ fontSize: 13, color: NEUTRAL.graphite, fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
            <div>
              <div style={labelSt}>Avaliação</div>
              <StarRating
                value={candidato.rating || 0}
                onChange={canWrite ? (v) => onRatingChange(candidato.id, v) : undefined}
              />
            </div>
          </div>

          {/* Fit score / justificativa da triagem por IA */}
          {typeof candidato.fit_score === "number" && (
            <div style={{ marginBottom: 20, background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#6D28D9" }}>{Math.round(candidato.fit_score)}</span>
                <span style={{ fontSize: 11, color: "#6D28D9", fontWeight: 600 }}>fit score (IA)</span>
              </div>
              {candidato.justificativa && (
                <div style={{ fontSize: 12, color: "#5B21B6", lineHeight: 1.5 }}>{candidato.justificativa}</div>
              )}
            </div>
          )}

          {/* Motivo de reprovação já registrado */}
          {candidato.stage === "reprovado" && candidato.motivo_reprovacao && (
            <div style={{ marginBottom: 20, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 14px" }}>
              <div style={labelSt}>Motivo da reprovação</div>
              <div style={{ fontSize: 12, color: NEUTRAL.graphite, lineHeight: 1.5 }}>{candidato.motivo_reprovacao}</div>
            </div>
          )}

          {/* Stage progression */}
          {canWrite && (
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Mover para</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {RH_RECRUITMENT_STAGES.filter((s) => s.id !== candidato.stage).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => requestStageChange(s.id)}
                    style={{
                      background: `${s.color}18`,
                      color: s.color,
                      border: `1px solid ${s.color}44`,
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <ArrowRight size={10} /> {s.name}
                  </button>
                ))}
              </div>

              {reprovando && (
                <div style={{ marginTop: 10, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: 12 }}>
                  <div style={{ ...labelSt, color: "#B91C1C" }}>Motivo da reprovação *</div>
                  <textarea
                    value={motivoReprovacao}
                    onChange={(e) => setMotivoReprovacao(e.target.value)}
                    placeholder="Por que este candidato foi reprovado?"
                    rows={2}
                    autoFocus
                    className="w-full text-sm rounded-lg border px-3 py-2 outline-none resize-none"
                    style={{ borderColor: "#FCA5A5", color: NEUTRAL.graphite, background: "#FFF", fontSize: 13 }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={confirmReprovacao}
                      disabled={savingStage || !motivoReprovacao.trim()}
                      style={{ background: "#DC2626", color: "#FFF", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: savingStage || !motivoReprovacao.trim() ? 0.6 : 1 }}
                    >
                      {savingStage ? "Salvando…" : "Confirmar reprovação"}
                    </button>
                    <button
                      onClick={() => { setReprovando(false); setMotivoReprovacao(""); }}
                      style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Convert to employee — only when aprovado */}
          {canWrite && candidato.stage === "aprovado" && onConvertToEmployee && (
            <div style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <UserPlus size={20} style={{ color: "#16A34A", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#15803D" }}>Candidato aprovado!</div>
                <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
                  Converta para funcionário e preencha os dados de admissão.
                </div>
              </div>
              <button
                onClick={() => { onConvertToEmployee(candidato); onClose(); }}
                style={{
                  background: "#16A34A",
                  color: "#FFF",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#15803D"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#16A34A"; }}
              >
                Converter
              </button>
            </div>
          )}

          {/* Notes */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
                <MessageSquare size={12} /> Notas
              </div>
              {canWrite && !addingNote && (
                <button
                  onClick={() => setAddingNote(true)}
                  style={{ background: "#EFF6FF", border: "none", color: "#1E4D8C", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Plus size={11} /> Nota
                </button>
              )}
            </div>

            {addingNote && (
              <div style={{ marginBottom: 12 }}>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Escreva uma nota sobre este candidato…"
                  rows={3}
                  autoFocus
                  className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none"
                  style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", fontSize: 13 }}
                  onFocus={(e) => { e.target.style.borderColor = "#1E4D8C"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#D1D5DB"; }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAddNote}
                    disabled={savingNote || !noteText.trim()}
                    style={{ background: "#1E4D8C", color: "#FFF", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: savingNote ? 0.6 : 1 }}
                  >
                    {savingNote ? "Salvando…" : "Salvar"}
                  </button>
                  <button
                    onClick={() => { setAddingNote(false); setNoteText(""); }}
                    style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {(candidato.notes || []).length === 0 && !addingNote ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: NEUTRAL.slate, fontSize: 12, opacity: 0.6 }}>
                Nenhuma nota registrada
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[...(candidato.notes || [])].reverse().map((note, i) => (
                  <div
                    key={i}
                    style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px" }}
                  >
                    <div style={{ fontSize: 12, color: NEUTRAL.graphite, lineHeight: 1.5 }}>{note.text}</div>
                    <div style={{ fontSize: 10, color: NEUTRAL.slate, marginTop: 4 }}>
                      {note.created_at ? fmt(note.created_at) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ stage, candidatos, vagas, canWrite, onCardClick, onAddCandidato }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: 14,
        minWidth: 240,
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        maxHeight: "calc(100vh - 220px)",
      }}
    >
      {/* Column header */}
      <div
        style={{ padding: "10px 12px 8px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0, display: "inline-block" }} />
        <span style={{ flex: 1, fontWeight: 700, fontSize: 12, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>
          {stage.name}
        </span>
        <span
          style={{
            background: `${stage.color}22`,
            color: stage.color,
            borderRadius: 99,
            padding: "1px 7px",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {candidatos.length}
        </span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="md:hidden"
          style={{ background: "none", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 2, display: "flex" }}
        >
          <ChevronDown size={14} style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }} />
        </button>
        {canWrite && (
          <button
            onClick={onAddCandidato}
            style={{ background: "none", border: "none", cursor: "pointer", color: stage.color, padding: 2, display: "flex" }}
            title="Adicionar candidato"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Cards */}
      {!collapsed && (
        <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {candidatos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 8px", color: NEUTRAL.slate, fontSize: 11, opacity: 0.5 }}>
              Nenhum candidato
            </div>
          ) : (
            candidatos.map((c) => {
              const vagaTitle = vagas.find((v) => v.id === c.vaga_id)?.title;
              const days = daysInStage(c.stage_changed_at);
              return (
                <div
                  key={c.id}
                  onClick={() => onCardClick(c)}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    transition: "box-shadow 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <InitialsAvatar name={c.name} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: NEUTRAL.graphite, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.name}
                      </div>
                      {vagaTitle && (
                        <div style={{ fontSize: 10, color: NEUTRAL.slate, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {vagaTitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <StarRating value={c.rating || 0} />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {typeof c.fit_score === "number" && (
                        <span
                          title="Fit score (triagem por IA)"
                          style={{
                            fontSize: 10, fontWeight: 700,
                            color: c.fit_score >= 70 ? "#16A34A" : c.fit_score >= 40 ? "#D97706" : "#DC2626",
                            background: c.fit_score >= 70 ? "#DCFCE7" : c.fit_score >= 40 ? "#FEF3C7" : "#FEE2E2",
                            borderRadius: 99, padding: "1px 7px",
                          }}
                        >
                          {Math.round(c.fit_score)}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: NEUTRAL.slate }}>{days}d</span>
                    </div>
                  </div>
                  {c.source && (
                    <div style={{ marginTop: 5 }}>
                      <span style={{ fontSize: 10, color: NEUTRAL.slate, background: "#F3F4F6", borderRadius: 99, padding: "1px 7px" }}>
                        {c.source}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function RHRecrutamentoView({ user, canWrite, onConvertToEmployee }) {
  const {
    vagas, candidatos, loading,
    createVaga, createCandidato, changeStage, addNote, changeRating,
  } = useRHRecrutamento({ userId: user?.id });
  const [selectedVaga, setSelectedVaga]     = useState("todas");
  const [selectedCandidatoId, setSelectedCandidatoId] = useState(null);
  const [quickAddVaga, setQuickAddVaga]     = useState(false);
  const [addCandidatoStage, setAddCandidatoStage] = useState(null);
  const [copiedSlug, setCopiedSlug]         = useState(null);

  const selectedCandidato = useMemo(
    () => candidatos.find((c) => c.id === selectedCandidatoId) || null,
    [candidatos, selectedCandidatoId]
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCreateVaga = async (data) => { await createVaga(data); };
  const handleCreateCandidato = async (data) => { await createCandidato(data); };
  const handleStageChange = async (id, newStage, motivo) => { await changeStage(id, newStage, motivo); };
  const handleAddNote = async (id, note) => { await addNote(id, note); };
  const handleRatingChange = async (id, rating) => { await changeRating(id, rating); };

  const handleCopyLink = async (vaga) => {
    const link = `${window.location.origin}/vagas/${vaga.link_slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedSlug(vaga.id);
      setTimeout(() => setCopiedSlug((s) => (s === vaga.id ? null : s)), 2000);
    } catch {
      window.prompt("Copie o link da vaga:", link);
    }
  };

  const activeVaga = vagas.find((v) => v.id === selectedVaga) || null;

  // ── Filtered candidatos ────────────────────────────────────────────────────
  const filteredCandidatos = useMemo(() => {
    if (selectedVaga === "todas") return candidatos;
    return candidatos.filter((c) => c.vaga_id === selectedVaga);
  }, [candidatos, selectedVaga]);

  const candByStage = useMemo(() => {
    const map = {};
    RH_RECRUITMENT_STAGES.forEach((s) => {
      map[s.id] = filteredCandidatos.filter((c) => c.stage === s.id);
    });
    return map;
  }, [filteredCandidatos]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase size={22} style={{ color: NEUTRAL.graphite }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em", margin: 0 }}>
              Recrutamento
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            Kanban de candidatos · {candidatos.length} candidato{candidatos.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setQuickAddVaga(true)}
            style={{
              background: "#1E4D8C",
              color: "#FFF",
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={14} /> Nova vaga
          </button>
        )}
      </div>

      {/* Vaga selector */}
      {vagas.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {[{ id: "todas", title: "Todas as vagas" }, ...vagas].map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVaga(v.id)}
              style={{
                background: selectedVaga === v.id ? NEUTRAL.red : "#FFFFFF",
                color: selectedVaga === v.id ? "#FFF" : NEUTRAL.graphite,
                border: `1px solid ${selectedVaga === v.id ? NEUTRAL.red : "#E5E7EB"}`,
                borderRadius: 99,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.1s",
              }}
            >
              {v.title}
            </button>
          ))}
        </div>
      )}

      {/* Link público / WhatsApp da vaga selecionada */}
      {activeVaga?.link_slug && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => handleCopyLink(activeVaga)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: NEUTRAL.graphite, cursor: "pointer" }}
          >
            {copiedSlug === activeVaga.id ? <Check size={12} color="#16A34A" /> : <Link2 size={12} />}
            {copiedSlug === activeVaga.id ? "Link copiado!" : "Copiar link da vaga"}
          </button>
          <a
            href={whatsappShareUrl(activeVaga)}
            target="_blank"
            rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "#15803D", textDecoration: "none" }}
          >
            <MessageSquare size={12} /> Compartilhar no WhatsApp
          </a>
        </div>
      )}

      {/* Kanban board */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: NEUTRAL.slate, fontSize: 13 }}>
          Carregando…
        </div>
      ) : !isSupabaseConfigured ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Briefcase size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Supabase não configurado</div>
          <div style={{ fontSize: 12, color: NEUTRAL.slate, opacity: 0.6, marginTop: 4 }}>Configure as variáveis de ambiente para usar o módulo de recrutamento</div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 16,
            flex: 1,
          }}
          className="flex-col md:flex-row"
        >
          <div style={{ display: "flex", gap: 12, flexShrink: 0 }} className="hidden md:flex">
            {RH_RECRUITMENT_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                candidatos={candByStage[stage.id] || []}
                vagas={vagas}
                canWrite={canWrite}
                onCardClick={(c) => setSelectedCandidatoId(c.id)}
                onAddCandidato={() => setAddCandidatoStage(stage.id)}
              />
            ))}
          </div>
          {/* Mobile: vertical */}
          <div className="md:hidden flex flex-col gap-3">
            {RH_RECRUITMENT_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                candidatos={candByStage[stage.id] || []}
                vagas={vagas}
                canWrite={canWrite}
                onCardClick={(c) => setSelectedCandidatoId(c.id)}
                onAddCandidato={() => setAddCandidatoStage(stage.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {quickAddVaga && (
        <NovaVagaModal
          onSave={handleCreateVaga}
          onClose={() => setQuickAddVaga(false)}
        />
      )}

      {addCandidatoStage && (
        <NovoCandidatoModal
          defaultStage={addCandidatoStage}
          vagas={vagas}
          onSave={handleCreateCandidato}
          onClose={() => setAddCandidatoStage(null)}
        />
      )}

      {selectedCandidato && (
        <CandidatoDrawer
          candidato={selectedCandidato}
          vagas={vagas}
          canWrite={canWrite}
          onStageChange={handleStageChange}
          onAddNote={handleAddNote}
          onRatingChange={handleRatingChange}
          onClose={() => setSelectedCandidatoId(null)}
          onConvertToEmployee={onConvertToEmployee}
        />
      )}
    </div>
  );
}
