import React, { useCallback, useRef, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { PERSONAL_TASK_PRIORITIES, RECURRENCE_OPTIONS } from "../../constants/personal-tasks";
import { parseQuickAddText } from "../../utils/quick-add-date-parser";

// Mirror de TaskCreateModal (src/components/views/MarketingTarefasView.jsx,
// ~linha 306) pra chrome/estrutura — mesmo overlay, header com título + X,
// footer Cancelar/Criar, useEscToClose, guarda de fechar-com-dados-
// preenchidos. Escopo reduzido: sem Responsáveis/Empresa/Campanha (não fazem
// sentido pra uma tarefa privada de um usuário só).
//
// Nível 2 do redesenho (ago/2026): o campo Título agora também funciona como
// quick-add — "Ligar fornecedor amanhã 15h" detecta prazo+hora sozinho ao
// sair do campo, só quando Prazo/Hora ainda estão vazios (nunca sobrescreve
// o que o usuário já preencheu manualmente).
export function PersonalTaskCreateModal({ onAdd, onClose }) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  // Prazo começa VAZIO de propósito — é um alvo que o usuário escolhe (ou
  // deixa em branco), nunca um default silencioso de "hoje".
  const [dueDate,     setDueDate]     = useState("");
  const [dueTime,     setDueTime]     = useState("");
  const [priority,    setPriority]    = useState("media");
  const [tagsText,    setTagsText]    = useState("");
  const [recurrence,  setRecurrence]  = useState("none");
  const [detected,    setDetected]    = useState(null); // { dueDate, dueTime } | null — só pra feedback visual
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  // Mesmo guard-close de TaskCreateModal: fechar (X/ESC/clique fora) com o
  // formulário sujo pede confirmação antes de descartar.
  const initialSnapshotRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = JSON.stringify({ title, description, dueDate, dueTime, priority, tagsText, recurrence });
  if (initialSnapshotRef.current === null) initialSnapshotRef.current = stateRef.current;
  const guardedClose = useCallback(() => {
    if (stateRef.current !== initialSnapshotRef.current
        && !window.confirm("Descartar os dados preenchidos? As informações não salvas serão perdidas.")) return;
    onClose();
  }, [onClose]);
  useEscToClose(guardedClose);

  const handleTitleBlur = () => {
    if (dueDate || dueTime) return; // usuário já preencheu manualmente — não sobrescreve
    const parsed = parseQuickAddText(title);
    if (!parsed.dueDate && !parsed.dueTime) return;
    if (parsed.title !== title) setTitle(parsed.title);
    if (parsed.dueDate) setDueDate(parsed.dueDate);
    if (parsed.dueTime) setDueTime(parsed.dueTime);
    setDetected({ dueDate: parsed.dueDate, dueTime: parsed.dueTime });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true); setError(null);
    try {
      await onAdd({
        title:       title.trim(),
        description: description.trim() || null,
        priority,
        // due_date é `date`, não timestamptz — grava o "AAAA-MM-DD" do
        // input direto, sem conversão de fuso (ver personal_tasks migration).
        dueDate:     dueDate || null,
        dueTime:     dueTime || null,
        tags:        tagsText.split(",").map(t => t.trim()).filter(Boolean),
        recurrence,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar tarefa.");
    } finally {
      setSaving(false);
    }
  };

  const focusBlue = e => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = e => { e.target.style.borderColor = "var(--border-strong)"; };
  const labelSt   = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };
  const inputSt   = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova Tarefa Pessoal</div>
          <button type="button" onClick={guardedClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 6, borderRadius: 8, display: "flex" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div style={{ marginBottom: 6 }}>
            <label style={labelSt}>* Título</label>
            <input autoFocus type="text" placeholder="Ex: Ligar fornecedor amanhã 15h"
              value={title} onChange={e => { setTitle(e.target.value); setDetected(null); }}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt} onFocus={focusBlue} onBlur={e => { blurGray(e); handleTitleBlur(); }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 16, minHeight: 16 }}>
            <Sparkles size={11} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
              {detected
                ? `Prazo detectado${detected.dueDate ? ` — ${detected.dueDate.split("-").reverse().slice(0, 2).join("/")}` : ""}${detected.dueTime ? ` às ${detected.dueTime}` : ""}`
                : "Escreva com data/hora (\"amanhã 15h\", \"sexta\", \"dia 15\") pra preencher o prazo sozinho."}
            </span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Descrição</label>
            <textarea placeholder="Detalhes (opcional)"
              value={description} onChange={e => setDescription(e.target.value)}
              rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ ...inputSt, resize: "vertical" }} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Prazo</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div>
              <label style={labelSt}>Hora</label>
              <input type="time" value={dueTime} disabled={!dueDate} onChange={e => setDueTime(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={{ ...inputSt, opacity: dueDate ? 1 : 0.5 }} onFocus={focusBlue} onBlur={blurGray} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>* Prioridade</label>
              <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
                {PERSONAL_TASK_PRIORITIES.map(p => (
                  <button key={p.id} type="button" onClick={() => setPriority(p.id)}
                    style={{ flex: 1, padding: "5px 0", borderRadius: 8, fontSize: 11, fontWeight: 700, border: `1px solid ${priority === p.id ? p.color : "var(--border)"}`, background: priority === p.id ? p.color + "18" : "var(--surface)", color: priority === p.id ? p.color : "var(--text-dim)", cursor: "pointer" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelSt}>Repetir</label>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt}>
                {RECURRENCE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelSt}>Etiquetas (separadas por vírgula)</label>
            <input type="text" placeholder="ex: financeiro, cliente-x"
              value={tagsText} onChange={e => setTagsText(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          {error && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={guardedClose}
              className="flex-1 font-semibold py-2.5 rounded-xl text-sm"
              style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || !title.trim()}
              className="flex-1 font-semibold py-2.5 rounded-xl text-sm"
              style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: (saving || !title.trim()) ? 0.5 : 1, border: "none", cursor: (saving || !title.trim()) ? "default" : "pointer" }}>
              {saving ? "Criando…" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PersonalTaskCreateModal;
