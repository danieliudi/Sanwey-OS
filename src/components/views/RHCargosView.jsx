import React, { useEffect, useMemo, useState } from "react";
import {
  Briefcase, Plus, X, Pencil, Sparkles, Loader2, TrendingUp, ArrowRight,
  Check, XCircle, Clock, DollarSign,
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHCargoTemplates } from "../../hooks/use-rh-cargo-templates";
import { useRHMovimentacoes } from "../../hooks/use-rh-movimentacoes";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useAI } from "../../hooks/use-ai";
import { cargoDescriptionPrompt } from "../../constants/ai-prompts";
import { RH_DEPARTMENTS, RH_CONTRACT_TYPES } from "../../constants/rh-config";
import { formatBRL } from "../../utils/currency";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { CurrencyInput } from "../ui/CurrencyInput";

const TIPO_MOV = [
  { id: "promocao", label: "Promoção" },
  { id: "merito", label: "Mérito" },
  { id: "transferencia", label: "Transferência" },
  { id: "rebaixamento", label: "Rebaixamento" },
  { id: "ajuste", label: "Ajuste" },
];
const tipoMovLabel = (id) => TIPO_MOV.find((t) => t.id === id)?.label || id;

const STATUS_INFO = {
  pendente: { label: "Pendente", color: "var(--warning)", bg: "#FEF3C7", icon: Clock },
  aprovado: { label: "Aprovado", color: "var(--success)", bg: "#DCFCE7", icon: Check },
  recusado: { label: "Recusado", color: "var(--danger)", bg: "#FEE2E2", icon: XCircle },
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function fmtBanda(min, max) {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${formatBRL(min)} – ${formatBRL(max)}`;
  return min != null ? `A partir de ${formatBRL(min)}` : `Até ${formatBRL(max)}`;
}

// Turno vira "HH:MM às HH:MM" a partir de dois <input type="time">. Ao editar
// um cargo salvo antes dessa mudança (turno como texto livre, ex: "Comercial"),
// tenta recuperar os dois horários se o texto já tiver esse formato; senão os
// campos nascem vazios e o usuário preenche do zero — não dá pra migrar um
// texto arbitrário em horário.
function parseShiftRange(raw) {
  const matches = String(raw || "").match(/\d{1,2}:\d{2}/g);
  if (!matches || matches.length < 2) return { start: "", end: "" };
  return { start: matches[0], end: matches[1] };
}

// ── Modal: cargo (criar/editar) com descrição por IA ──────────────────────────

function CargoModal({ initialData, currentUser, onSave, onClose }) {
  const [name, setName]               = useState(initialData?.name || "");
  const [department, setDepartment]   = useState(initialData?.department || "");
  const [contractType, setContractType] = useState(initialData?.contract_type || "");
  const [salaryMin, setSalaryMin]     = useState(initialData?.salary_min ?? "");
  const [salaryMax, setSalaryMax]     = useState(initialData?.salary_max ?? "");
  const [schedule, setSchedule]       = useState(initialData?.schedule || "");
  const initialShift = useMemo(() => parseShiftRange(initialData?.shift), [initialData]);
  const [shiftStart, setShiftStart]   = useState(initialShift.start);
  const [shiftEnd, setShiftEnd]       = useState(initialShift.end);
  const [description, setDescription] = useState(initialData?.description || "");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiError, setAiError]         = useState(null);

  const { complete, isConfigured: aiConfigured } = useAI(currentUser);
  const shift = shiftStart && shiftEnd ? `${shiftStart} às ${shiftEnd}` : "";

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleGenerate = async () => {
    if (!name.trim()) { setAiError("Preencha ao menos o nome do cargo."); return; }
    setAiLoading(true);
    setAiError(null);
    try {
      const cargoCtx = {
        name: name.trim(), department, contract_type: contractType,
        salary_min: salaryMin !== "" ? Number(salaryMin) : null,
        salary_max: salaryMax !== "" ? Number(salaryMax) : null,
        schedule, shift, benefits: initialData?.benefits || [],
      };
      const out = await complete(cargoDescriptionPrompt(cargoCtx), { maxTokens: 900 });
      setDescription((out || "").trim());
    } catch (err) {
      setAiError(err?.message || "Não foi possível gerar a descrição.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Nome do cargo é obrigatório."); return; }
    if (!department) { setError("Departamento é obrigatório."); return; }
    if (!contractType) { setError("Tipo de contrato é obrigatório."); return; }
    if (salaryMin === "" || salaryMax === "") { setError("Informe a faixa salarial completa (mínimo e máximo)."); return; }
    if (Number(salaryMin) > Number(salaryMax)) { setError("O salário mínimo não pode ser maior que o máximo."); return; }
    if (!schedule.trim()) { setError("Jornada é obrigatória."); return; }
    if (!shiftStart || !shiftEnd) { setError("Informe o horário completo do turno (início e fim)."); return; }
    if (!description.trim()) { setError("Descrição do cargo é obrigatória — preencha à mão ou gere com IA."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        department: department || null,
        contract_type: contractType || null,
        salary_min: salaryMin !== "" ? Number(salaryMin) : null,
        salary_max: salaryMax !== "" ? Number(salaryMax) : null,
        schedule: schedule.trim() || null,
        shift: shift.trim() || null,
        description: description.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao salvar cargo.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 540, boxShadow: "var(--shadow-pop)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{initialData ? "Editar cargo" : "Novo cargo"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Nome do cargo *</label>
              <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Analista de RH Pleno" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Departamento *</label>
                <select required value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="">Selecione…</option>
                  {RH_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Tipo de contrato *</label>
                <select required value={contractType} onChange={(e) => setContractType(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="">Selecione…</option>
                  {RH_CONTRACT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Salário mínimo (faixa) *</label>
                <CurrencyInput required value={salaryMin} onChange={setSalaryMin} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Salário máximo (faixa) *</label>
                <CurrencyInput required value={salaryMax} onChange={setSalaryMax} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Jornada *</label>
                <input required type="text" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Ex: 44h semanais" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Turno *</label>
                <div className="flex items-center gap-1.5">
                  <input required type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className="w-full text-sm rounded-xl border px-2 py-2 outline-none" style={inputSt} />
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>às</span>
                  <input required type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className="w-full text-sm rounded-xl border px-2 py-2 outline-none" style={inputSt} />
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={labelSt}>Descrição do cargo *</label>
                <button
                  type="button" onClick={handleGenerate}
                  disabled={aiLoading || !aiConfigured}
                  title={aiConfigured ? "Gerar responsabilidades e requisitos com IA" : "Configure a IA em Configurações → Integrações de IA"}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: aiConfigured ? "var(--accent)" : "var(--text-dim)", background: "none", border: "none", cursor: aiLoading || !aiConfigured ? "default" : "pointer", opacity: aiLoading ? 0.6 : 1 }}
                >
                  {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {aiLoading ? "Gerando…" : "Gerar com IA"}
                </button>
              </div>
              <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={7} placeholder="Responsabilidades, requisitos e resumo do cargo… (ou gere com IA)" className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-y" style={inputSt} />
              {aiError && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{aiError}</div>}
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : initialData ? "Salvar alterações" : "Criar cargo"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: nova movimentação ──────────────────────────────────────────────────

function MovimentacaoModal({ colaboradores, cargos, onCreate, onClose }) {
  const [colaboradorId, setColaboradorId] = useState("");
  const [tipo, setTipo]           = useState("promocao");
  const [cargoNovo, setCargoNovo] = useState("");
  const [departmentNovo, setDepartmentNovo] = useState("");
  const [salarioNovo, setSalarioNovo] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [motivo, setMotivo]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const colaborador = colaboradores.find((c) => c.id === colaboradorId) || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!colaboradorId) { setError("Selecione o colaborador."); return; }
    if (salarioNovo !== "" && !(Number(salarioNovo) >= 0)) { setError("Salário inválido."); return; }
    const semMudanca = !cargoNovo.trim() && !departmentNovo && salarioNovo === "";
    if (semMudanca) { setError("Informe ao menos uma mudança (cargo, departamento ou salário)."); return; }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        colaboradorId,
        tipo,
        cargoAnterior: colaborador?.jobTitle ?? null,
        cargoNovo: cargoNovo.trim() || null,
        departmentAnterior: colaborador?.department ?? null,
        departmentNovo: departmentNovo || null,
        salarioAnterior: colaborador?.salary ?? null,
        salarioNovo: salarioNovo !== "" ? Number(salarioNovo) : null,
        effectiveDate: effectiveDate || null,
        motivo: motivo.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar movimentação.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-pop)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova movimentação</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>Vai pra aprovação da diretoria antes de valer.</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Colaborador *</label>
              <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                <option value="">Selecione…</option>
                {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.fullName}{c.jobTitle ? ` · ${c.jobTitle}` : ""}</option>)}
              </select>
            </div>
            {colaborador && (
              <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "var(--text-dim)" }}>
                Atual: <b style={{ color: "var(--text)" }}>{colaborador.jobTitle || "—"}</b>
                {colaborador.department ? ` · ${colaborador.department}` : ""} · {colaborador.salary != null ? formatBRL(colaborador.salary) : "salário não informado"}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  {TIPO_MOV.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Vigência (opcional)</label>
                <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Novo cargo</label>
                <input type="text" list="cargos-list" value={cargoNovo} onChange={(e) => setCargoNovo(e.target.value)} placeholder="Deixe vazio se não muda" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
                <datalist id="cargos-list">
                  {cargos.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div>
                <label style={labelSt}>Novo departamento</label>
                <select value={departmentNovo} onChange={(e) => setDepartmentNovo(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="">Não muda</option>
                  {RH_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelSt}>Novo salário</label>
              <CurrencyInput value={salarioNovo} onChange={setSalarioNovo} placeholder="Opcional" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Justificativa</label>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Por que essa movimentação?" className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Enviando…" : "Enviar para aprovação"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Card de movimentação ──────────────────────────────────────────────────────

function MovimentacaoCard({ mov, colaborador, isDirector, onAprovar, onRecusar, busy }) {
  const st = STATUS_INFO[mov.status] || STATUS_INFO.pendente;
  const StatusIcon = st.icon;
  const salChange = mov.salario_novo != null && mov.salario_novo !== mov.salario_anterior;
  const cargoChange = mov.cargo_novo && mov.cargo_novo !== mov.cargo_anterior;
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{colaborador?.fullName || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>{tipoMovLabel(mov.tipo)} · {fmt(mov.created_at)}{mov.effective_date ? ` · vigência ${fmt(mov.effective_date)}` : ""}</div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 99, padding: "2px 10px" }}>
          <StatusIcon size={11} /> {st.label}
        </span>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
        {cargoChange && (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cargo</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text)" }}>
              <span style={{ color: "var(--text-dim)" }}>{mov.cargo_anterior || "—"}</span>
              <ArrowRight size={12} style={{ color: "var(--text-dim)" }} />
              <b>{mov.cargo_novo}</b>
            </div>
          </div>
        )}
        {salChange && (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Salário</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text)" }}>
              <span style={{ color: "var(--text-dim)" }}>{mov.salario_anterior != null ? formatBRL(mov.salario_anterior) : "—"}</span>
              <ArrowRight size={12} style={{ color: "var(--text-dim)" }} />
              <b style={{ color: "var(--success)" }}>{formatBRL(mov.salario_novo)}</b>
            </div>
          </div>
        )}
        {mov.department_novo && mov.department_novo !== mov.department_anterior && (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Departamento</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text)" }}>
              <span style={{ color: "var(--text-dim)" }}>{mov.department_anterior || "—"}</span>
              <ArrowRight size={12} style={{ color: "var(--text-dim)" }} />
              <b>{mov.department_novo}</b>
            </div>
          </div>
        )}
      </div>

      {mov.motivo && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8, fontStyle: "italic" }}>“{mov.motivo}”</div>}
      {mov.status === "recusado" && mov.motivo_recusa && (
        <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>Recusa: {mov.motivo_recusa}</div>
      )}

      {mov.status === "pendente" && isDirector && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => onAprovar(mov)} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--success)", color: "#FFF", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            <Check size={13} /> Aprovar
          </button>
          <button onClick={() => onRecusar(mov)} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--surface)", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            <XCircle size={13} /> Recusar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHCargosView({ currentUser, canWrite, isDirector, users = [], notifyMentions }) {
  const { cargos, loading: loadingCargos, createCargo, updateCargo, deleteCargo } = useRHCargoTemplates({ userId: currentUser?.id });
  const { movimentacoes, loading: loadingMov, createMovimentacao, aprovar, recusar } = useRHMovimentacoes({ userId: currentUser?.id });
  const { colaboradores } = useRHColaboradores({ userId: currentUser?.id });

  const [tab, setTab] = useState("cargos"); // "cargos" | "movimentacoes"
  const [cargoModal, setCargoModal] = useState(null); // { data } | { new: true }
  const [movModalOpen, setMovModalOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const colaboradoresById = useMemo(() => new Map(colaboradores.map((c) => [c.id, c])), [colaboradores]);
  const colaboradoresAtivos = useMemo(() => colaboradores.filter((c) => c.employeeStatus === "ativo"), [colaboradores]);

  const pendentes = useMemo(() => movimentacoes.filter((m) => m.status === "pendente"), [movimentacoes]);
  const decididas = useMemo(() => movimentacoes.filter((m) => m.status !== "pendente"), [movimentacoes]);

  const directorIds = useMemo(
    () => (users || []).filter((u) => (u.roles?.length ? u.roles : [u.role]).includes("admin")).map((u) => u.id),
    [users]
  );

  const handleCreateMov = async (data) => {
    const mov = await createMovimentacao(data);
    // Notifica a diretoria que há uma movimentação aguardando decisão.
    if (directorIds.length && notifyMentions) {
      const colaborador = colaboradoresById.get(data.colaboradorId);
      notifyMentions(directorIds, {
        title: "Movimentação aguardando aprovação",
        body: `${colaborador?.fullName || "Colaborador"} · ${tipoMovLabel(data.tipo)}`,
        link: { module: "rh_movimentacoes", id: mov?.id },
      }).catch(() => {});
    }
    return mov;
  };

  const handleAprovar = async (mov) => {
    setBusyId(mov.id);
    setActionError(null);
    try { await aprovar(mov.id); }
    catch (e) { setActionError(e?.message || "Erro ao aprovar."); }
    finally { setBusyId(null); }
  };

  const handleRecusar = async (mov) => {
    const motivo = window.prompt("Motivo da recusa (opcional):", "");
    if (motivo === null) return;
    setBusyId(mov.id);
    setActionError(null);
    try { await recusar(mov.id, motivo.trim() || null); }
    catch (e) { setActionError(e?.message || "Erro ao recusar."); }
    finally { setBusyId(null); }
  };

  if (!isSupabaseConfigured) {
    return <EmptyState icon={Briefcase} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />;
  }

  const loading = loadingCargos || loadingMov;

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase size={22} style={{ color: "var(--text)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Cargos & Salários</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Catálogo de cargos, faixas salariais e movimentações</p>
        </div>
        {canWrite && (
          tab === "cargos"
            ? <Button icon={Plus} onClick={() => setCargoModal({ new: true })}>Novo cargo</Button>
            : <Button icon={Plus} onClick={() => setMovModalOpen(true)}>Nova movimentação</Button>
        )}
      </div>

      <div className="inline-flex rounded-lg border overflow-hidden mb-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
        {[{ id: "cargos", label: "Cargos" }, { id: "movimentacoes", label: `Movimentações${pendentes.length ? ` (${pendentes.length})` : ""}` }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} role="tab" aria-selected={tab === t.id}
            className="px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
            style={{ background: tab === t.id ? "var(--accent)" : "var(--surface)", color: tab === t.id ? "#FFF" : "var(--text-dim)", border: "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {actionError && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{actionError}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : tab === "cargos" ? (
        cargos.length === 0 ? (
          <EmptyState icon={Briefcase} title="Nenhum cargo cadastrado" description="Cadastre os cargos com suas faixas salariais para padronizar contratações e movimentações." />
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {cargos.map((c) => (
              <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{c.name}</div>
                  {canWrite && (
                    <button onClick={() => setCargoModal({ data: c })} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex", flexShrink: 0 }}><Pencil size={14} /></button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {[c.department, c.contract_type].filter(Boolean).join(" · ") || "—"}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
                  <DollarSign size={13} /> {fmtBanda(c.salary_min, c.salary_max)}
                </div>
                {c.description && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {c.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {pendentes.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Aguardando aprovação {isDirector ? "· você é diretoria" : "· só a diretoria decide"}
              </div>
              <div className="flex flex-col gap-2">
                {pendentes.map((m) => (
                  <MovimentacaoCard key={m.id} mov={m} colaborador={colaboradoresById.get(m.colaborador_id)} isDirector={isDirector} onAprovar={handleAprovar} onRecusar={handleRecusar} busy={busyId === m.id} />
                ))}
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              <TrendingUp size={12} style={{ display: "inline", marginRight: 4 }} /> Histórico
            </div>
            {decididas.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-dim)", padding: "8px 0" }}>Nenhuma movimentação decidida ainda.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {decididas.map((m) => (
                  <MovimentacaoCard key={m.id} mov={m} colaborador={colaboradoresById.get(m.colaborador_id)} isDirector={isDirector} onAprovar={handleAprovar} onRecusar={handleRecusar} busy={busyId === m.id} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {cargoModal && (
        <CargoModal
          initialData={cargoModal.data || null}
          currentUser={currentUser}
          onSave={(data) => cargoModal.data ? updateCargo(cargoModal.data.id, data) : createCargo(data)}
          onClose={() => setCargoModal(null)}
        />
      )}
      {movModalOpen && (
        <MovimentacaoModal
          colaboradores={colaboradoresAtivos}
          cargos={cargos}
          onCreate={handleCreateMov}
          onClose={() => setMovModalOpen(false)}
        />
      )}
    </div>
  );
}

export default RHCargosView;
