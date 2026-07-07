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
  Sparkles,
  Loader2,
  Settings2,
  Trash2,
  CalendarClock,
  Flag,
  Wallet,
  Gift,
  Users as UsersIcon,
  Pencil,
} from "lucide-react";
import {
  RH_DEPARTMENTS,
  RH_CONTRACT_TYPES,
} from "../../constants/rh-config";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";
import { useRHCargoTemplates } from "../../hooks/use-rh-cargo-templates";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHOnboarding } from "../../hooks/use-rh-onboarding";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useProfiles } from "../../hooks/use-profiles";
import { useAI } from "../../hooks/use-ai";
import { NovoColaboradorModal } from "./NovoColaboradorModal";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHStageEditorModal } from "../rh-pipeline/RHStageEditorModal";
import { RHStageFieldEditorModal } from "../rh-pipeline/RHStageFieldEditorModal";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { RHDetailDrawerShell } from "../rh-pipeline/RHDetailDrawerShell";
import { resolveVisibleFields, getMissingRequiredFields } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";

// ── Ciclo de vida da vaga / candidatos ──────────────────────────────────────
// As etapas (nome/cor/ordem) agora são administráveis via
// useRHPipelineStages("vagas"|"candidatos") — ver RHStageEditorModal. Estes
// helpers viram simples lookups sobre o array vindo do hook, com fallback
// pra não quebrar a UI enquanto os stages ainda estão carregando.
function findStage(stages, key) {
  return (stages || []).find((s) => s.stageKey === key) || { stageKey: key, name: key || "—", color: "#8A8680" };
}

const PRIORITY_OPTIONS = [
  { id: "baixa",   name: "Baixa",   color: "#8A8680" },
  { id: "media",   name: "Média",   color: "#0EA5E9" },
  { id: "alta",    name: "Alta",    color: "#D97706" },
  { id: "urgente", name: "Urgente", color: "#DC2626" },
];

function priorityInfo(id) {
  return PRIORITY_OPTIONS.find((p) => p.id === id) || PRIORITY_OPTIONS[1];
}

function whatsappShareUrl(vaga) {
  const link = `${window.location.origin}/vagas/${vaga.link_slug}`;
  const text = `Vaga aberta: ${vaga.title}! Envie seu currículo por aqui: ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const TRIAGEM_SYSTEM_PROMPT = `Você é um analista de recrutamento técnico. Receberá a descrição de uma vaga e o currículo de um candidato (anexado como documento PDF). Avalie exclusivamente com base no conteúdo do currículo — não presuma informação não escrita.

Retorne APENAS um JSON no formato abaixo, sem texto adicional, sem markdown, sem explicações fora do JSON:
{"fit_score": <número de 0 a 100>, "justificativa": "<2-3 frases objetivas>", "pontos_fortes": ["...", "..."], "gaps": ["...", "..."]}`;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function parseTriagemResponse(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta da IA não trouxe um JSON válido.");
  const parsed = JSON.parse(match[0]);
  return {
    fitScore: Math.max(0, Math.min(100, Number(parsed.fit_score) || 0)),
    justificativa: parsed.justificativa || "",
    pontosFortes: Array.isArray(parsed.pontos_fortes) ? parsed.pontos_fortes : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
  };
}

// ── Triagem por IA Modal ──────────────────────────────────────────────────────

function TriagemIAModal({ vagas, talentPool, aplicacoesRaw, user, onAttach, onClose }) {
  const { complete, isConfigured, provider } = useAI(user);
  const [vagaId, setVagaId] = useState("");
  const [necessidade, setNecessidade] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [attachingId, setAttachingId] = useState(null);
  const [attachedIds, setAttachedIds] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const pdfCandidatos = useMemo(() => talentPool.filter(c => c.resume_ext === "pdf"), [talentPool]);
  const docxSkipped    = useMemo(() => talentPool.filter(c => c.resume_ext && c.resume_ext !== "pdf").length, [talentPool]);

  const handleVagaChange = (id) => {
    setVagaId(id);
    const v = vagas.find(vg => vg.id === id);
    if (v && !necessidade.trim()) {
      setNecessidade([v.title, v.requirements, v.description].filter(Boolean).join(" — "));
    }
  };

  const alreadyLinked = (candidateId) => aplicacoesRaw.some(a => a.candidate_id === candidateId && a.vaga_id === vagaId);

  const runTriagem = async () => {
    if (!necessidade.trim()) { setErrorMsg("Descreva o que você procura."); return; }
    setErrorMsg(null);
    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: pdfCandidatos.length });
    const out = [];
    for (const cand of pdfCandidatos) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from("rh-curriculos")
          .download(`${cand.id}/curriculo.pdf`);
        if (dlErr || !blob) throw new Error("Currículo indisponível");
        const base64 = await blobToBase64(blob);
        const text = await complete([
          { role: "system", content: TRIAGEM_SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: `Vaga: ${necessidade}` },
          ] },
        ], { maxTokens: 500 });
        const triagem = parseTriagemResponse(text);
        out.push({ candidateId: cand.id, name: cand.name, ...triagem });
      } catch (err) {
        out.push({ candidateId: cand.id, name: cand.name, error: err.message || "Falha na análise" });
      }
      setProgress(p => ({ ...p, done: p.done + 1 }));
    }
    out.sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1));
    setResults(out);
    setRunning(false);
  };

  const handleAttach = async (result) => {
    setAttachingId(result.candidateId);
    try {
      await onAttach(result.candidateId, vagaId, result);
      setAttachedIds(prev => new Set(prev).add(result.candidateId));
    } catch (err) {
      setErrorMsg(err.message || "Erro ao vincular candidato à vaga.");
    } finally {
      setAttachingId(null);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} style={{ color: "#7C3AED" }} />
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>Triagem por IA</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {!isConfigured ? (
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: 14, fontSize: 12, color: "var(--warning)", lineHeight: 1.6 }}>
              Configure uma LLM em <strong>Configurações → Integrações de IA</strong> para usar a triagem por currículo.
            </div>
          ) : provider !== "anthropic" ? (
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: 14, fontSize: 12, color: "var(--warning)", lineHeight: 1.6 }}>
              A triagem por currículo requer o provedor <strong>Anthropic (Claude)</strong> configurado — ele lê o PDF diretamente. Troque o provedor em Configurações → Integrações de IA.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 mb-4">
                <div>
                  <label style={labelSt}>Vaga (para vincular os resultados) *</label>
                  <select value={vagaId} onChange={(e) => handleVagaChange(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                    <option value="">Selecionar vaga</option>
                    {vagas.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>O que você procura?</label>
                  <textarea
                    value={necessidade}
                    onChange={(e) => setNecessidade(e.target.value)}
                    placeholder="Ex: vendedor B2B industrial, experiência em compliance ambiental…"
                    rows={3}
                    className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none"
                    style={inputSt}
                  />
                </div>
              </div>

              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12 }}>
                {pdfCandidatos.length} candidato{pdfCandidatos.length !== 1 ? "s" : ""} com currículo PDF no talent pool
                {docxSkipped > 0 && ` · ${docxSkipped} em DOCX ignorado${docxSkipped !== 1 ? "s" : ""} nesta versão`}
              </div>

              {errorMsg && (
                <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{errorMsg}</div>
              )}

              <button
                onClick={runTriagem}
                disabled={running || !vagaId || pdfCandidatos.length === 0}
                style={{ width: "100%", background: "#7C3AED", color: "#FFF", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", opacity: (running || !vagaId || pdfCandidatos.length === 0) ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {running && <Loader2 size={14} className="animate-spin" />}
                {running ? `Analisando ${progress.done}/${progress.total}…` : "Triar com IA"}
              </button>

              {results.length > 0 && (
                <div className="flex flex-col gap-2 mt-4">
                  {results.map((r) => (
                    <div key={r.candidateId} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{r.name}</span>
                        {typeof r.fitScore === "number" && (
                          <span style={{ fontWeight: 800, fontSize: 14, color: r.fitScore >= 70 ? "var(--success)" : r.fitScore >= 40 ? "var(--warning)" : "var(--danger)" }}>{r.fitScore}</span>
                        )}
                      </div>
                      {r.error ? (
                        <div style={{ fontSize: 12, color: "var(--danger)" }}>{r.error}</div>
                      ) : (
                        <>
                          <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 8 }}>{r.justificativa}</div>
                          <button
                            onClick={() => handleAttach(r)}
                            disabled={attachingId === r.candidateId || attachedIds.has(r.candidateId) || alreadyLinked(r.candidateId)}
                            style={{ display: "flex", alignItems: "center", gap: 6, background: attachedIds.has(r.candidateId) || alreadyLinked(r.candidateId) ? "var(--surface-alt)" : "var(--accent-tint)", color: attachedIds.has(r.candidateId) || alreadyLinked(r.candidateId) ? "var(--text-dim)" : "var(--accent)", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: attachedIds.has(r.candidateId) || alreadyLinked(r.candidateId) ? "default" : "pointer" }}
                          >
                            {attachedIds.has(r.candidateId) || alreadyLinked(r.candidateId)
                              ? <><Check size={12} /> Adicionado à vaga</>
                              : attachingId === r.candidateId ? "Adicionando…" : "Adicionar à vaga"}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
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
        background: "var(--color-industria)",
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
          fill={i < value ? "var(--amber)" : "none"}
          stroke={i < value ? "var(--amber)" : "var(--border-strong)"}
          style={{ cursor: onChange ? "pointer" : "default", flexShrink: 0 }}
          onClick={() => onChange && onChange(i + 1)}
        />
      ))}
    </div>
  );
}

// ── Nova Vaga Modal ───────────────────────────────────────────────────────────

function NovaVagaModal({ cargos, initialData, onSave, onManageCargos, onClose }) {
  const [title, setTitle]           = useState(initialData?.title || "");
  const [cargoId, setCargoId]       = useState(initialData?.cargo_template_id || "");
  const [jobTitle, setJobTitle]     = useState(initialData?.job_title || "");
  const [dept, setDept]             = useState(initialData?.department || "");
  const [contractType, setContractType] = useState(initialData?.contract_type || "");
  const [salaryMin, setSalaryMin]   = useState(initialData?.salary_min != null ? String(initialData.salary_min) : "");
  const [salaryMax, setSalaryMax]   = useState(initialData?.salary_max != null ? String(initialData.salary_max) : "");
  const [benefits, setBenefits]     = useState((initialData?.benefits || []).join(", "));
  const [schedule, setSchedule]     = useState(initialData?.schedule || "");
  const [shift, setShift]           = useState(initialData?.shift || "");
  const [deadline, setDeadline]     = useState(initialData?.hiring_deadline ? initialData.hiring_deadline.slice(0, 10) : "");
  const [priority, setPriority]     = useState(initialData?.priority || "media");
  const [desc, setDesc]             = useState(initialData?.description || "");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const applyCargo = (id) => {
    setCargoId(id);
    const cargo = cargos.find((c) => c.id === id);
    if (!cargo) return;
    setJobTitle(cargo.name || "");
    setDept(cargo.department || "");
    setContractType(cargo.contract_type || "");
    setSalaryMin(cargo.salary_min != null ? String(cargo.salary_min) : "");
    setSalaryMax(cargo.salary_max != null ? String(cargo.salary_max) : "");
    setBenefits((cargo.benefits || []).join(", "));
    setSchedule(cargo.schedule || "");
    setShift(cargo.shift || "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError("Título da vaga é obrigatório."); return; }
    if (!dept) { setError("Departamento é obrigatório."); return; }
    if (!jobTitle.trim()) { setError("Cargo é obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        department: dept,
        job_title: jobTitle.trim(),
        cargo_template_id: cargoId || null,
        contract_type: contractType || null,
        salary_min: salaryMin !== "" ? Number(salaryMin) : null,
        salary_max: salaryMax !== "" ? Number(salaryMax) : null,
        benefits: benefits.split(",").map((b) => b.trim()).filter(Boolean),
        schedule: schedule.trim() || null,
        shift: shift.trim() || null,
        hiring_deadline: deadline || null,
        priority,
        description: desc.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar vaga.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };
  const focusBlue = (e) => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = (e) => { e.target.style.borderColor = "var(--border-strong)"; };
  const inputCls = "w-full text-sm rounded-xl border px-3 py-2 outline-none";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>{initialData ? "Editar Vaga" : "Nova Vaga"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Título da vaga *</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Analista de Marketing" className={inputCls} style={inputSt}
                onFocus={focusBlue} onBlur={blurGray} autoFocus
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ ...labelSt, marginBottom: 0 }}>Cargo (preenche o resto automaticamente)</label>
              <button type="button" onClick={onManageCargos} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Settings2 size={11} /> Gerenciar cargos
              </button>
            </div>
            <select value={cargoId} onChange={(e) => applyCargo(e.target.value)} className={inputCls} style={inputSt}>
              <option value="">Sem cargo padrão — preencher manualmente</option>
              {cargos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Cargo *</label>
                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Ex: Vendedor Externo" className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Departamento *</label>
                <select value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls} style={inputSt}>
                  <option value="">Selecionar departamento</option>
                  {RH_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Tipo de contrato</label>
                <select value={contractType} onChange={(e) => setContractType(e.target.value)} className={inputCls} style={inputSt}>
                  <option value="">Selecionar</option>
                  {RH_CONTRACT_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Prioridade</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls} style={inputSt}>
                  {PRIORITY_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Salário mín. (R$)</label>
                <input type="number" min="0" step="0.01" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Salário máx. (R$)</label>
                <input type="number" min="0" step="0.01" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Jornada</label>
                <input type="text" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Ex: 44h semanais, seg-sex" className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Escala</label>
                <input type="text" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="Ex: 12x36, comercial" className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Prazo para contratação</label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>

            <div>
              <label style={labelSt}>Benefícios (separados por vírgula)</label>
              <input type="text" value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder="VT, VR, Plano de saúde" className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
            </div>

            <div>
              <label style={labelSt}>Descrição</label>
              <textarea
                value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="Descreva os requisitos e responsabilidades…" rows={3}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt}
                onFocus={focusBlue} onBlur={blurGray}
              />
            </div>
          </div>

          {error && (
            <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Salvando…" : initialData ? "Salvar alterações" : "Criar vaga"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Gerenciar Cargos Modal ────────────────────────────────────────────────────

function GerenciarCargosModal({ cargos, onCreate, onDelete, onClose }) {
  const [name, setName]           = useState("");
  const [dept, setDept]           = useState("");
  const [contractType, setContractType] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [benefits, setBenefits]   = useState("");
  const [schedule, setSchedule]   = useState("");
  const [shift, setShift]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };
  const inputCls = "w-full text-sm rounded-lg border px-2.5 py-1.5 outline-none";

  const reset = () => {
    setName(""); setDept(""); setContractType(""); setSalaryMin(""); setSalaryMax(""); setBenefits(""); setSchedule(""); setShift("");
  };

  const handleAdd = async () => {
    if (!name.trim()) { setError("Nome do cargo é obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        department: dept || null,
        contract_type: contractType || null,
        salary_min: salaryMin !== "" ? Number(salaryMin) : null,
        salary_max: salaryMax !== "" ? Number(salaryMax) : null,
        benefits: benefits.split(",").map((b) => b.trim()).filter(Boolean),
        schedule: schedule.trim() || null,
        shift: shift.trim() || null,
      });
      reset();
    } catch (err) {
      setError(err?.message || "Erro ao criar cargo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Gerenciar cargos</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>

        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          {cargos.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>Nenhum cargo cadastrado ainda.</div>
          ) : (
            <div className="flex flex-col gap-2" style={{ marginBottom: 20 }}>
              {cargos.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {[c.department, c.contract_type].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Novo cargo</div>
          <div className="flex flex-col gap-2">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cargo *" className={inputCls} style={inputSt} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls} style={inputSt}>
                <option value="">Departamento</option>
                {RH_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={contractType} onChange={(e) => setContractType(e.target.value)} className={inputCls} style={inputSt}>
                <option value="">Tipo de contrato</option>
                {RH_CONTRACT_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="Salário mín." className={inputCls} style={inputSt} />
              <input type="number" min="0" step="0.01" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="Salário máx." className={inputCls} style={inputSt} />
              <input type="text" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Jornada" className={inputCls} style={inputSt} />
              <input type="text" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="Escala" className={inputCls} style={inputSt} />
            </div>
            <input type="text" value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder="Benefícios (separados por vírgula)" className={inputCls} style={inputSt} />
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginTop: 10 }}>{error}</div>}

          <button onClick={handleAdd} disabled={saving} style={{ marginTop: 10, width: "100%", background: "var(--accent)", color: "#FFF", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Adicionando…" : "Adicionar cargo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vaga Kanban Card ──────────────────────────────────────────────────────────

function VagaCard({ vaga, candidatosCount }) {
  const pri = priorityInfo(vaga.priority);
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{vaga.title}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 6 }}>{vaga.job_title || vaga.department || "—"}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: pri.color, background: `${pri.color}18`, borderRadius: 99, padding: "1px 7px", textTransform: "uppercase" }}>
          {pri.name}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{candidatosCount} candidato{candidatosCount !== 1 ? "s" : ""}</span>
      </div>
      {vaga.hiring_deadline && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 10, color: "var(--text-dim)" }}>
          <CalendarClock size={10} /> {fmt(vaga.hiring_deadline)}
        </div>
      )}
    </div>
  );
}

function VagaKanbanColumn({
  stage, stages, vagasList, candidatosByVaga, onCardClick, canWrite,
  onMoveToStage, onDragStart, onDragEnd, isDragOver, onDragOver, onDragLeave, onDrop, onEditFields,
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        background: "var(--surface-alt)",
        border: `1px solid ${isDragOver ? stage.color + "70" : "var(--border)"}`,
        boxShadow: isDragOver ? `0 0 0 2px ${stage.color}30` : "none",
        borderRadius: 14, minWidth: 240, width: 240, flexShrink: 0,
        display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 260px)",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
    >
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0, display: "inline-block" }} />
        <span style={{ flex: 1, fontWeight: 700, fontSize: 12, color: "var(--text)" }}>{stage.name}</span>
        <span style={{ background: `${stage.color}22`, color: stage.color, borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{vagasList.length}</span>
        {canWrite && (
          <button
            onClick={() => onEditFields(stage)}
            title="Editar campos desta etapa"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex" }}
          >
            <Settings2 size={12} />
          </button>
        )}
      </div>
      <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {vagasList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-dim)", fontSize: 11, opacity: 0.5 }}>
            {isDragOver ? "Soltar aqui" : "Nenhuma vaga"}
          </div>
        ) : (
          vagasList.map((v) => (
            <RHKanbanCard
              key={v.id}
              id={v.id}
              stage={v.stage}
              stages={stages}
              onClick={() => onCardClick(v)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onMoveToStage={onMoveToStage}
              agingDays={daysInStage(v.stage_changed_at)}
            >
              <VagaCard vaga={v} candidatosCount={candidatosByVaga[v.id] || 0} />
            </RHKanbanCard>
          ))
        )}
      </div>
    </div>
  );
}

// ── Vaga Drawer ───────────────────────────────────────────────────────────────

function VagaDrawer({
  vaga, candidatosCount, canWrite, stages, onStageChange, onEdit, onCopyLink, onClose, onVerCandidatos, copiedSlug,
  customFields, onCustomFieldChange, onAddActivity, currentUser, users,
}) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const stageInfo = findStage(stages, vaga.stage);
  const pri = priorityInfo(vaga.priority);
  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

  // Campos condicionais: reavalia visibilidade/obrigatoriedade a cada
  // keystroke a partir do valor atual de vaga.custom_fields (mesmo objeto
  // que alimenta o `value` do RHStageFieldInput abaixo).
  const visibleCustomFields = resolveVisibleFields(customFields, vaga.custom_fields || {});

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "var(--surface)", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{vaga.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{vaga.job_title || "—"} · {vaga.department || "—"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${stageInfo.color}18`, color: stageInfo.color, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageInfo.color, display: "inline-block" }} /> {stageInfo.name}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: pri.color, fontSize: 11, fontWeight: 600 }}>
                <Flag size={11} /> {pri.name}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Tipo de contrato", value: RH_CONTRACT_TYPES.find((c) => c.id === vaga.contract_type)?.label || "—" },
              { label: "Jornada", value: vaga.schedule || "—" },
              { label: "Escala", value: vaga.shift || "—" },
              { label: "Prazo para contratação", value: fmt(vaga.hiring_deadline) },
              { label: "Faixa salarial", value: (vaga.salary_min || vaga.salary_max) ? `R$ ${vaga.salary_min || "0"} – R$ ${vaga.salary_max || "—"}` : "—" },
              { label: "Candidatos", value: String(candidatosCount) },
            ].map((f) => (
              <div key={f.label}>
                <div style={labelSt}>{f.label}</div>
                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
          </div>

          {vaga.benefits?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Benefícios</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {vaga.benefits.map((b, i) => (
                  <span key={i} style={{ fontSize: 11, color: "var(--text)", background: "var(--surface-alt)", borderRadius: 99, padding: "3px 10px" }}>{b}</span>
                ))}
              </div>
            </div>
          )}

          {vaga.description && (
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Descrição</div>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{vaga.description}</div>
            </div>
          )}

          {/* Campos customizados desta etapa (RHStageEditorModal → RHStageFieldEditorModal) */}
          {visibleCustomFields.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Campos desta etapa</div>
              <div className="flex flex-col gap-3">
                {visibleCustomFields.map((field) => (
                  <div key={field.id}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                      {field.label}{field.effectiveRequired && <span style={{ color: "var(--danger)" }}> *</span>}
                    </div>
                    <RHStageFieldInput
                      field={field}
                      value={vaga.custom_fields?.[field.fieldKey]}
                      onChange={(val) => onCustomFieldChange(field.fieldKey, val)}
                      users={users}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {canWrite && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={labelSt}>Mover para</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {stages.filter((s) => s.stageKey !== vaga.stage).map((s) => (
                    <button
                      key={s.stageKey}
                      onClick={() => onStageChange(vaga.id, s.stageKey)}
                      style={{ background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}44`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <ArrowRight size={10} /> {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {vaga.stage === "publicada" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  <button
                    onClick={() => onCopyLink(vaga)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--text)", cursor: "pointer" }}
                  >
                    {copiedSlug === vaga.id ? <Check size={12} color="var(--success)" /> : <Link2 size={12} />}
                    {copiedSlug === vaga.id ? "Link copiado!" : "Copiar link"}
                  </button>
                  <a
                    href={whatsappShareUrl(vaga)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--success)", textDecoration: "none" }}
                  >
                    <MessageSquare size={12} /> WhatsApp
                  </a>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => onEdit(vaga)} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
                  Editar vaga
                </button>
                <button onClick={() => onVerCandidatos(vaga.id)} style={{ flex: 1, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Ver candidatos
                </button>
              </div>
            </>
          )}

          {/* Anexos / Checklists / Atividades / Comentários */}
          <div style={{ marginTop: 20 }}>
            <RHDetailDrawerShell
              domain="vagas"
              recordId={vaga.id}
              activities={vaga.activities || []}
              onAddActivity={onAddActivity}
              currentUser={currentUser}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Novo Candidato Modal ──────────────────────────────────────────────────────

function NovoCandidatoModal({ defaultStage, vagas, stages, onSave, onClose }) {
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

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };
  const focusBlue = (e) => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = (e) => { e.target.style.borderColor = "var(--border-strong)"; };

  const stageInfo = findStage(stages, stage);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>Novo Candidato</div>
            {stageInfo && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stageInfo.color, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{stageInfo.name}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}>
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
            <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Adicionando…" : "Adicionar candidato"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Candidato Drawer ──────────────────────────────────────────────────────────

function CandidatoDrawer({
  candidato, vagas, stages, canWrite, onStageChange, onAddNote, onRatingChange, onClose, onHire,
  customFields, onCustomFieldChange, onAddActivity, currentUser, users,
}) {
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [reprovando, setReprovando] = useState(false);
  const [pendingLostStage, setPendingLostStage] = useState(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [savingStage, setSavingStage] = useState(false);

  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // (estático ou condicional) vazio — checa ANTES do fluxo de reprovação,
  // que só deve abrir depois que os campos obrigatórios da etapa atual
  // estiverem preenchidos. Reprovação (ou qualquer etapa marcada como
  // "lost") exige motivo — regra de negócio preservada tanto no fluxo por
  // botão quanto no drag-and-drop (ver handleCandDrop na view principal).
  const requestStageChange = (stageKey) => {
    const missing = getMissingRequiredFields(customFields, candidato.customFields || {});
    if (missing.length > 0) {
      alert(`Não dá pra mover "${candidato.name}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(customFields, candidato.customFields || {});
    if (invalid.length > 0) {
      alert(`Não dá pra mover "${candidato.name}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    const target = stages.find((s) => s.stageKey === stageKey);
    if (target?.lost) { setPendingLostStage(stageKey); setReprovando(true); return; }
    onStageChange(candidato.id, stageKey);
  };

  const confirmReprovacao = async () => {
    if (!motivoReprovacao.trim() || !pendingLostStage) return;
    setSavingStage(true);
    try {
      await onStageChange(candidato.id, pendingLostStage, motivoReprovacao.trim());
      setReprovando(false);
      setMotivoReprovacao("");
      setPendingLostStage(null);
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

  const stageInfo = findStage(stages, candidato.stage);
  const days = daysInStage(candidato.stage_changed_at);

  // Campos condicionais: reavalia visibilidade/obrigatoriedade a cada
  // keystroke a partir do valor atual de candidato.customFields (mesmo
  // objeto que alimenta o `value` do RHStageFieldInput abaixo).
  const visibleCustomFields = resolveVisibleFields(customFields, candidato.customFields || {});

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

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

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
          background: "var(--surface)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <InitialsAvatar name={candidato.name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>{candidato.name}</div>
            {candidato.email && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{candidato.email}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${stageInfo.color}18`, color: stageInfo.color, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageInfo.color, display: "inline-block" }} />
                {stageInfo.name}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{days}d nesta etapa</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex", flexShrink: 0 }}>
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
                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{f.value}</div>
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

          {/* Campos customizados desta etapa (RHStageEditorModal → RHStageFieldEditorModal) */}
          {visibleCustomFields.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Campos desta etapa</div>
              <div className="flex flex-col gap-3">
                {visibleCustomFields.map((field) => (
                  <div key={field.id}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                      {field.label}{field.effectiveRequired && <span style={{ color: "var(--danger)" }}> *</span>}
                    </div>
                    <RHStageFieldInput
                      field={field}
                      value={candidato.customFields?.[field.fieldKey]}
                      onChange={(val) => onCustomFieldChange(field.fieldKey, val)}
                      users={users}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Motivo de reprovação já registrado */}
          {candidato.stage === "reprovado" && candidato.motivo_reprovacao && (
            <div style={{ marginBottom: 20, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={labelSt}>Motivo da reprovação</div>
              <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{candidato.motivo_reprovacao}</div>
            </div>
          )}

          {/* Stage progression */}
          {canWrite && (
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Mover para</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {stages.filter((s) => s.stageKey !== candidato.stage).map((s) => (
                  <button
                    key={s.stageKey}
                    onClick={() => requestStageChange(s.stageKey)}
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
                  <div style={{ ...labelSt, color: "var(--danger)" }}>Motivo da reprovação *</div>
                  <textarea
                    value={motivoReprovacao}
                    onChange={(e) => setMotivoReprovacao(e.target.value)}
                    placeholder="Por que este candidato foi reprovado?"
                    rows={2}
                    autoFocus
                    className="w-full text-sm rounded-lg border px-3 py-2 outline-none resize-none"
                    style={{ borderColor: "#FCA5A5", color: "var(--text)", background: "var(--surface)", fontSize: 13 }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={confirmReprovacao}
                      disabled={savingStage || !motivoReprovacao.trim()}
                      style={{ background: "var(--danger)", color: "#FFF", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: savingStage || !motivoReprovacao.trim() ? 0.6 : 1 }}
                    >
                      {savingStage ? "Salvando…" : "Confirmar reprovação"}
                    </button>
                    <button
                      onClick={() => { setReprovando(false); setMotivoReprovacao(""); }}
                      style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Convert to employee — only when aprovado */}
          {canWrite && candidato.stage === "aprovado" && onHire && (
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
              <UserPlus size={20} style={{ color: "var(--success)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--success)" }}>Candidato aprovado!</div>
                <div style={{ fontSize: 12, color: "var(--success)", marginTop: 2 }}>
                  Converta para funcionário e preencha os dados de admissão.
                </div>
              </div>
              <button
                onClick={() => { onHire(candidato); onClose(); }}
                style={{
                  background: "var(--success)",
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
                onMouseEnter={e => { e.currentTarget.style.background = "var(--success)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--success)"; }}
              >
                Converter
              </button>
            </div>
          )}

          {/* Notes */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
                <MessageSquare size={12} /> Notas
              </div>
              {canWrite && !addingNote && (
                <button
                  onClick={() => setAddingNote(true)}
                  style={{ background: "var(--accent-tint)", border: "none", color: "var(--accent)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
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
                  style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAddNote}
                    disabled={savingNote || !noteText.trim()}
                    style={{ background: "var(--accent)", color: "#FFF", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: savingNote ? 0.6 : 1 }}
                  >
                    {savingNote ? "Salvando…" : "Salvar"}
                  </button>
                  <button
                    onClick={() => { setAddingNote(false); setNoteText(""); }}
                    style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {(candidato.notes || []).length === 0 && !addingNote ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-dim)", fontSize: 12, opacity: 0.6 }}>
                Nenhuma nota registrada
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[...(candidato.notes || [])].reverse().map((note, i) => (
                  <div
                    key={i}
                    style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}
                  >
                    <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{note.text}</div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
                      {note.created_at ? fmt(note.created_at) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Anexos / Checklists / Atividades / Comentários */}
          <div style={{ marginTop: 20 }}>
            <RHDetailDrawerShell
              domain="candidatos"
              recordId={candidato.id}
              activities={candidato.activities || []}
              onAddActivity={onAddActivity}
              currentUser={currentUser}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Modal de motivo de reprovação (drag-and-drop pra etapa "lost") ───────────
// Mesma regra de negócio do fluxo por botão (requestStageChange no
// CandidatoDrawer): mover pra uma etapa marcada como "lost" sempre exige
// motivo — aqui cobre o caminho de soltar o card direto na coluna.
function ReprovacaoDropModal({ info, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

  const handleConfirm = async () => {
    if (!motivo.trim()) return;
    setSaving(true);
    try {
      await onConfirm(motivo.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.22)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Mover para "{info.stageName}"</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ ...labelSt, color: "var(--danger)" }}>Motivo da reprovação *</div>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por que este candidato foi reprovado?"
            rows={3}
            autoFocus
            className="w-full text-sm rounded-lg border px-3 py-2 outline-none resize-none"
            style={{ borderColor: "#FCA5A5", color: "var(--text)", background: "var(--surface)", fontSize: 13 }}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleConfirm}
              disabled={saving || !motivo.trim()}
              style={{ background: "var(--danger)", color: "#FFF", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", opacity: saving || !motivo.trim() ? 0.6 : 1 }}
            >
              {saving ? "Salvando…" : "Confirmar"}
            </button>
            <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function CandidatoCardBody({ candidato: c, vagas }) {
  const vagaTitle = vagas.find((v) => v.id === c.vaga_id)?.title;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <InitialsAvatar name={c.name} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.name}
          </div>
          {vagaTitle && (
            <div style={{ fontSize: 10, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {vagaTitle}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <StarRating value={c.rating || 0} />
        {typeof c.fit_score === "number" && (
          <span
            title="Fit score (triagem por IA)"
            style={{
              fontSize: 10, fontWeight: 700,
              color: c.fit_score >= 70 ? "var(--success)" : c.fit_score >= 40 ? "var(--warning)" : "var(--danger)",
              background: c.fit_score >= 70 ? "#DCFCE7" : c.fit_score >= 40 ? "#FEF3C7" : "#FEE2E2",
              borderRadius: 99, padding: "1px 7px",
            }}
          >
            {Math.round(c.fit_score)}
          </span>
        )}
      </div>
      {c.source && (
        <div style={{ marginTop: 5 }}>
          <span style={{ fontSize: 10, color: "var(--text-dim)", background: "var(--surface-alt)", borderRadius: 99, padding: "1px 7px" }}>
            {c.source}
          </span>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  stage, stages, candidatos, vagas, canWrite, onCardClick, onAddCandidato,
  onMoveToStage, onDragStart, onDragEnd, isDragOver, onDragOver, onDragLeave, onDrop, onEditFields,
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        background: "var(--surface-alt)",
        border: `1px solid ${isDragOver ? stage.color + "70" : "var(--border)"}`,
        boxShadow: isDragOver ? `0 0 0 2px ${stage.color}30` : "none",
        borderRadius: 14,
        minWidth: 240,
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        maxHeight: "calc(100vh - 220px)",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
    >
      {/* Column header */}
      <div
        style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0, display: "inline-block" }} />
        <span style={{ flex: 1, fontWeight: 700, fontSize: 12, color: "var(--text)", letterSpacing: "-0.01em" }}>
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
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex" }}
        >
          <ChevronDown size={14} style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }} />
        </button>
        {canWrite && (
          <button
            onClick={() => onEditFields(stage)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex" }}
            title="Editar campos desta etapa"
          >
            <Settings2 size={12} />
          </button>
        )}
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
            <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-dim)", fontSize: 11, opacity: 0.5 }}>
              {isDragOver ? "Soltar aqui" : "Nenhum candidato"}
            </div>
          ) : (
            candidatos.map((c) => (
              <RHKanbanCard
                key={c.id}
                id={c.id}
                stage={c.stage}
                stages={stages}
                onClick={() => onCardClick(c)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onMoveToStage={onMoveToStage}
                agingDays={daysInStage(c.stage_changed_at)}
              >
                <CandidatoCardBody candidato={c} vagas={vagas} />
              </RHKanbanCard>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export function RHRecrutamentoView({ user, canWrite }) {
  const {
    vagas, candidatos, talentPool, aplicacoesRaw, loading,
    createVaga, updateVaga, changeVagaStage, createCandidato, changeStage, updateAplicacao, addNote, changeRating, attachTriagemToVaga,
  } = useRHRecrutamento({ userId: user?.id });
  const { cargos, createCargo, deleteCargo } = useRHCargoTemplates({ userId: user?.id });
  const { createColaborador } = useRHColaboradores({ userId: user?.id });
  const { templates: onboardingTemplates, applyChecklist } = useRHOnboarding({ userId: user?.id });

  // ── Etapas administráveis (Pipefy-style) + campos customizados por etapa ──
  const { stages: vagaStages, loading: vagaStagesLoading } = useRHPipelineStages("vagas");
  const { stages: candStages, loading: candStagesLoading } = useRHPipelineStages("candidatos");
  const vagaStageFields = useRHStageFields("vagas");
  const candStageFields = useRHStageFields("candidatos");
  const { users: profileUsers } = useProfiles();

  const [viewMode, setViewMode]             = useState("vagas"); // "vagas" | "candidatos"
  const [selectedVaga, setSelectedVaga]     = useState("todas");
  const [selectedCandidatoId, setSelectedCandidatoId] = useState(null);
  const [quickAddVaga, setQuickAddVaga]     = useState(false);
  const [editingVaga, setEditingVaga]       = useState(null);
  const [vagaDrawerId, setVagaDrawerId]     = useState(null);
  const [cargosManagerOpen, setCargosManagerOpen] = useState(false);
  const [addCandidatoStage, setAddCandidatoStage] = useState(null);
  const [copiedSlug, setCopiedSlug]         = useState(null);
  const [triagemOpen, setTriagemOpen]       = useState(false);
  const [hiringCandidato, setHiringCandidato] = useState(null);

  // ── Drag-and-drop (Vagas) ──────────────────────────────────────────────────
  const [draggedVagaId, setDraggedVagaId]   = useState(null);
  const [dragOverVagaStage, setDragOverVagaStage] = useState(null);

  // ── Drag-and-drop (Candidatos) ─────────────────────────────────────────────
  const [draggedAplicacaoId, setDraggedAplicacaoId] = useState(null);
  const [dragOverCandStage, setDragOverCandStage]   = useState(null);
  const [pendingReprovacaoDrop, setPendingReprovacaoDrop] = useState(null); // { aplicacaoId, stageKey, stageName }

  // ── Etapas / campos customizados (admin) ──────────────────────────────────
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const [fieldEditorStage, setFieldEditorStage] = useState(null); // { domain, stageKey, stageName }

  const selectedCandidato = useMemo(
    () => candidatos.find((c) => c.id === selectedCandidatoId) || null,
    [candidatos, selectedCandidatoId]
  );
  const vagaEmDrawer = useMemo(() => vagas.find((v) => v.id === vagaDrawerId) || null, [vagas, vagaDrawerId]);
  const vagaDoCandidatoContratando = useMemo(
    () => (hiringCandidato ? vagas.find((v) => v.id === hiringCandidato.vaga_id) : null),
    [hiringCandidato, vagas]
  );

  // ── Contratação: candidato aprovado → funcionário → onboarding ─────────────
  const handleSaveHired = async (form) => {
    const { _closeVaga, ...colaboradorData } = form;
    const vaga = vagaDoCandidatoContratando;
    const novo = await createColaborador({ ...colaboradorData, vagaId: vaga?.id || null });
    if (vaga?.job_title && novo?.id) {
      const template = onboardingTemplates.find(
        (t) => t.cargo && t.cargo.toLowerCase() === vaga.job_title.toLowerCase()
      );
      if (template && Array.isArray(template.checklist_padrao) && template.checklist_padrao.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        await applyChecklist(
          novo.id,
          template.checklist_padrao.map((i) => ({ titulo: i.titulo, dataLimite: addDays(today, i.dias_prazo) })),
          template.id
        );
      }
    }
    if (_closeVaga && vaga?.id) {
      await changeVagaStage(vaga.id, "encerrada");
    }
    return novo;
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCreateVaga = async (data) => { await createVaga(data); };
  const handleUpdateVaga = async (data) => {
    if (!editingVaga) return;
    await updateVaga(editingVaga.id, data);
    setEditingVaga(null);
  };
  const handleCreateCandidato = async (data) => { await createCandidato(data); };
  const handleStageChange = async (id, newStage, motivo) => { await changeStage(id, newStage, motivo); };
  const handleAddNote = async (id, note) => { await addNote(id, note); };
  const handleRatingChange = async (id, rating) => { await changeRating(id, rating); };
  // Enforcement real: bloqueia mover vaga com campo obrigatório (estático ou
  // condicional) da etapa atual vazio — antes disso "required" era só o
  // asterisco visual, confirmado ao vivo que não travava nada. Único ponto
  // compartilhado por drag-and-drop, "Mover para" do menu do card (ver
  // onMoveToStage abaixo) e do drawer (handleVagaStageChange), reusando
  // getMissingRequiredFields — mesmo mecanismo do CRM (CRMView) e do
  // onboarding (RHOnboardingView).
  const attemptVagaStageChange = (id, newStage) => {
    const vaga = vagas.find((v) => v.id === id);
    if (!vaga || vaga.stage === newStage) return false;
    const fields = vagaStageFields.getFields(vaga.stage);
    const missing = getMissingRequiredFields(fields, vaga.custom_fields || {});
    if (missing.length > 0) {
      alert(`Não dá pra mover "${vaga.title}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return false;
    }
    const invalid = getInvalidFields(fields, vaga.custom_fields || {});
    if (invalid.length > 0) {
      alert(`Não dá pra mover "${vaga.title}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return false;
    }
    changeVagaStage(id, newStage);
    return true;
  };
  const handleVagaStageChange = (id, newStage) => {
    if (attemptVagaStageChange(id, newStage)) setVagaDrawerId(null);
  };
  const handleVerCandidatos = (vagaId) => {
    setSelectedVaga(vagaId);
    setViewMode("candidatos");
    setVagaDrawerId(null);
  };

  // ── Drag-and-drop: Vagas ───────────────────────────────────────────────────
  const handleVagaDragStart = (id) => setDraggedVagaId(id);
  const handleVagaDragEnd   = () => { setDraggedVagaId(null); setDragOverVagaStage(null); };
  const handleVagaDragOver  = (e, stageKey) => { e.preventDefault(); setDragOverVagaStage(stageKey); };
  const handleVagaDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverVagaStage(null); };
  const handleVagaDrop = (stageKey) => {
    const id = draggedVagaId;
    setDraggedVagaId(null);
    setDragOverVagaStage(null);
    if (!id) return;
    attemptVagaStageChange(id, stageKey);
  };

  // ── Drag-and-drop: Candidatos ──────────────────────────────────────────────
  // Preserva a regra de negócio do fluxo por botão (requestStageChange no
  // CandidatoDrawer): soltar num stage "lost" (ex.: Reprovado) exige motivo,
  // não pode ser uma troca silenciosa.
  const handleCandDragStart = (id) => setDraggedAplicacaoId(id);
  const handleCandDragEnd   = () => { setDraggedAplicacaoId(null); setDragOverCandStage(null); };
  const handleCandDragOver  = (e, stageKey) => { e.preventDefault(); setDragOverCandStage(stageKey); };
  const handleCandDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCandStage(null); };
  // Enforcement real: bloqueia mover candidato com campo obrigatório
  // (estático ou condicional) da etapa atual vazio — mesmo mecanismo
  // compartilhado (getMissingRequiredFields) do vaga/onboarding/CRM. Roda
  // ANTES do fluxo de reprovação: só abre o modal de motivo (etapa "lost")
  // depois que os campos obrigatórios já estiverem preenchidos. Único ponto
  // usado por drag-and-drop e pelo "Mover para" do menu do card (ver
  // onMoveToStage abaixo) — o drawer tem seu próprio check equivalente em
  // requestStageChange (CandidatoDrawer), no mesmo espírito do
  // LeadDetailDrawer.
  const attemptCandStageChange = (id, newStage) => {
    const candidato = candidatos.find((c) => c.id === id);
    if (!candidato || candidato.stage === newStage) return;
    const fields = candStageFields.getFields(candidato.stage);
    const missing = getMissingRequiredFields(fields, candidato.customFields || {});
    if (missing.length > 0) {
      alert(`Não dá pra mover "${candidato.name}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(fields, candidato.customFields || {});
    if (invalid.length > 0) {
      alert(`Não dá pra mover "${candidato.name}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    const targetStage = candStages.find((s) => s.stageKey === newStage);
    if (targetStage?.lost) {
      setPendingReprovacaoDrop({ aplicacaoId: id, stageKey: newStage, stageName: targetStage.name });
      return;
    }
    changeStage(id, newStage);
  };
  const handleCandDrop = (stageKey) => {
    const id = draggedAplicacaoId;
    setDraggedAplicacaoId(null);
    setDragOverCandStage(null);
    if (!id) return;
    attemptCandStageChange(id, stageKey);
  };
  const confirmReprovacaoDrop = async (motivo) => {
    if (!pendingReprovacaoDrop) return;
    await changeStage(pendingReprovacaoDrop.aplicacaoId, pendingReprovacaoDrop.stageKey, motivo);
    setPendingReprovacaoDrop(null);
  };

  // ── Campos customizados por etapa + timeline de atividades ─────────────────
  const handleVagaCustomFieldChange = async (vagaId, fieldKey, value) => {
    const vaga = vagas.find((v) => v.id === vagaId);
    const custom_fields = { ...(vaga?.custom_fields || {}), [fieldKey]: value };
    await updateVaga(vagaId, { custom_fields });
  };
  const handleVagaAddActivity = async (vagaId, entry) => {
    const vaga = vagas.find((v) => v.id === vagaId);
    const activities = [...(vaga?.activities || []), { id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...entry }];
    await updateVaga(vagaId, { activities });
  };
  const handleAplicacaoCustomFieldChange = async (aplicacaoId, fieldKey, value) => {
    const candidato = candidatos.find((c) => c.id === aplicacaoId);
    const custom_fields = { ...(candidato?.customFields || {}), [fieldKey]: value };
    await updateAplicacao(aplicacaoId, { custom_fields });
  };
  const handleAplicacaoAddActivity = async (aplicacaoId, entry) => {
    const candidato = candidatos.find((c) => c.id === aplicacaoId);
    const activities = [...(candidato?.activities || []), { id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...entry }];
    await updateAplicacao(aplicacaoId, { activities });
  };

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
    candStages.forEach((s) => {
      map[s.stageKey] = filteredCandidatos.filter((c) => c.stage === s.stageKey);
    });
    return map;
  }, [filteredCandidatos, candStages]);

  const candidatosByVaga = useMemo(() => {
    const map = {};
    candidatos.forEach((c) => { map[c.vaga_id] = (map[c.vaga_id] || 0) + 1; });
    return map;
  }, [candidatos]);

  const vagasByStage = useMemo(() => {
    const map = {};
    vagaStages.forEach((s) => { map[s.stageKey] = vagas.filter((v) => (v.stage || "rascunho") === s.stageKey); });
    return map;
  }, [vagas, vagaStages]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase size={22} style={{ color: "var(--text)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
              Recrutamento
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            {viewMode === "vagas"
              ? `${vagas.length} vaga${vagas.length !== 1 ? "s" : ""}`
              : `${candidatos.length} candidato${candidatos.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Toggle Vagas / Candidatos */}
          <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 3 }}>
            <button
              onClick={() => setViewMode("vagas")}
              style={{ background: viewMode === "vagas" ? "var(--surface)" : "transparent", color: viewMode === "vagas" ? "var(--text)" : "var(--text-dim)", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: viewMode === "vagas" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}
            >
              Vagas
            </button>
            <button
              onClick={() => setViewMode("candidatos")}
              style={{ background: viewMode === "candidatos" ? "var(--surface)" : "transparent", color: viewMode === "candidatos" ? "var(--text)" : "var(--text-dim)", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: viewMode === "candidatos" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}
            >
              Candidatos
            </button>
          </div>

          {canWrite && (
            <button
              onClick={() => setStageEditorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
            >
              <Pencil size={11} /> Editar etapas
            </button>
          )}
          {canWrite && viewMode === "vagas" && (
            <button
              onClick={() => setQuickAddVaga(true)}
              style={{ background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} /> Nova vaga
            </button>
          )}
          {canWrite && viewMode === "candidatos" && (
            <button
              onClick={() => setTriagemOpen(true)}
              style={{ background: "#7C3AED", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Sparkles size={14} /> Triar com IA
            </button>
          )}
        </div>
      </div>

      {!isSupabaseConfigured ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Briefcase size={48} style={{ color: "var(--text-dim)", opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: "var(--text-dim)", fontWeight: 500 }}>Supabase não configurado</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", opacity: 0.6, marginTop: 4 }}>Configure as variáveis de ambiente para usar o módulo de recrutamento</div>
        </div>
      ) : loading || (viewMode === "vagas" ? vagaStagesLoading : candStagesLoading) ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : viewMode === "vagas" ? (
        /* ═══ Kanban de VAGAS ═══ */
        vagas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Briefcase size={48} style={{ color: "var(--text-dim)", opacity: 0.3, margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, color: "var(--text-dim)", fontWeight: 500 }}>Nenhuma vaga cadastrada</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", opacity: 0.6, marginTop: 4 }}>Clique em "Nova vaga" para começar</div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, flex: 1 }} className="flex-col md:flex-row">
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }} className="hidden md:flex">
              {vagaStages.map((stage) => (
                <VagaKanbanColumn
                  key={stage.stageKey}
                  stage={stage}
                  stages={vagaStages}
                  vagasList={vagasByStage[stage.stageKey] || []}
                  candidatosByVaga={candidatosByVaga}
                  canWrite={canWrite}
                  onCardClick={(v) => setVagaDrawerId(v.id)}
                  onMoveToStage={attemptVagaStageChange}
                  onDragStart={handleVagaDragStart}
                  onDragEnd={handleVagaDragEnd}
                  isDragOver={dragOverVagaStage === stage.stageKey}
                  onDragOver={(e) => handleVagaDragOver(e, stage.stageKey)}
                  onDragLeave={handleVagaDragLeave}
                  onDrop={() => handleVagaDrop(stage.stageKey)}
                  onEditFields={(s) => setFieldEditorStage({ domain: "vagas", stageKey: s.stageKey, stageName: s.name })}
                />
              ))}
            </div>
            <div className="md:hidden flex flex-col gap-3">
              {vagaStages.map((stage) => (
                <VagaKanbanColumn
                  key={stage.stageKey}
                  stage={stage}
                  stages={vagaStages}
                  vagasList={vagasByStage[stage.stageKey] || []}
                  candidatosByVaga={candidatosByVaga}
                  canWrite={canWrite}
                  onCardClick={(v) => setVagaDrawerId(v.id)}
                  onMoveToStage={attemptVagaStageChange}
                  onDragStart={handleVagaDragStart}
                  onDragEnd={handleVagaDragEnd}
                  isDragOver={dragOverVagaStage === stage.stageKey}
                  onDragOver={(e) => handleVagaDragOver(e, stage.stageKey)}
                  onDragLeave={handleVagaDragLeave}
                  onDrop={() => handleVagaDrop(stage.stageKey)}
                  onEditFields={(s) => setFieldEditorStage({ domain: "vagas", stageKey: s.stageKey, stageName: s.name })}
                />
              ))}
            </div>
          </div>
        )
      ) : (
        /* ═══ Kanban de CANDIDATOS (existente) ═══ */
        <>
          {/* Vaga selector */}
          {vagas.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {[{ id: "todas", title: "Todas as vagas" }, ...vagas].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVaga(v.id)}
                  style={{
                    background: selectedVaga === v.id ? "var(--color-industria)" : "var(--surface)",
                    color: selectedVaga === v.id ? "#FFF" : "var(--text)",
                    border: `1px solid ${selectedVaga === v.id ? "var(--color-industria)" : "var(--border)"}`,
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
          {activeVaga?.link_slug && activeVaga.stage === "publicada" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <button
                onClick={() => handleCopyLink(activeVaga)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--text)", cursor: "pointer" }}
              >
                {copiedSlug === activeVaga.id ? <Check size={12} color="var(--success)" /> : <Link2 size={12} />}
                {copiedSlug === activeVaga.id ? "Link copiado!" : "Copiar link da vaga"}
              </button>
              <a
                href={whatsappShareUrl(activeVaga)}
                target="_blank"
                rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--success)", textDecoration: "none" }}
              >
                <MessageSquare size={12} /> Compartilhar no WhatsApp
              </a>
            </div>
          )}

          {activeVaga && activeVaga.stage !== "publicada" && (
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "var(--warning)" }}>
              Essa vaga está em <strong>{findStage(vagaStages, activeVaga.stage).name}</strong> — mova para "Publicada" na aba Vagas pra liberar o link de candidatura.
            </div>
          )}

          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, flex: 1 }} className="flex-col md:flex-row">
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }} className="hidden md:flex">
              {candStages.map((stage) => (
                <KanbanColumn
                  key={stage.stageKey}
                  stage={stage}
                  stages={candStages}
                  candidatos={candByStage[stage.stageKey] || []}
                  vagas={vagas}
                  canWrite={canWrite}
                  onCardClick={(c) => setSelectedCandidatoId(c.id)}
                  onAddCandidato={() => setAddCandidatoStage(stage.stageKey)}
                  onMoveToStage={attemptCandStageChange}
                  onDragStart={handleCandDragStart}
                  onDragEnd={handleCandDragEnd}
                  isDragOver={dragOverCandStage === stage.stageKey}
                  onDragOver={(e) => handleCandDragOver(e, stage.stageKey)}
                  onDragLeave={handleCandDragLeave}
                  onDrop={() => handleCandDrop(stage.stageKey)}
                  onEditFields={(s) => setFieldEditorStage({ domain: "candidatos", stageKey: s.stageKey, stageName: s.name })}
                />
              ))}
            </div>
            {/* Mobile: vertical */}
            <div className="md:hidden flex flex-col gap-3">
              {candStages.map((stage) => (
                <KanbanColumn
                  key={stage.stageKey}
                  stage={stage}
                  stages={candStages}
                  candidatos={candByStage[stage.stageKey] || []}
                  vagas={vagas}
                  canWrite={canWrite}
                  onCardClick={(c) => setSelectedCandidatoId(c.id)}
                  onAddCandidato={() => setAddCandidatoStage(stage.stageKey)}
                  onMoveToStage={attemptCandStageChange}
                  onDragStart={handleCandDragStart}
                  onDragEnd={handleCandDragEnd}
                  isDragOver={dragOverCandStage === stage.stageKey}
                  onDragOver={(e) => handleCandDragOver(e, stage.stageKey)}
                  onDragLeave={handleCandDragLeave}
                  onDrop={() => handleCandDrop(stage.stageKey)}
                  onEditFields={(s) => setFieldEditorStage({ domain: "candidatos", stageKey: s.stageKey, stageName: s.name })}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {quickAddVaga && (
        <NovaVagaModal
          cargos={cargos}
          onSave={handleCreateVaga}
          onManageCargos={() => setCargosManagerOpen(true)}
          onClose={() => setQuickAddVaga(false)}
        />
      )}

      {editingVaga && (
        <NovaVagaModal
          cargos={cargos}
          initialData={editingVaga}
          onSave={handleUpdateVaga}
          onManageCargos={() => setCargosManagerOpen(true)}
          onClose={() => setEditingVaga(null)}
        />
      )}

      {cargosManagerOpen && (
        <GerenciarCargosModal
          cargos={cargos}
          onCreate={createCargo}
          onDelete={deleteCargo}
          onClose={() => setCargosManagerOpen(false)}
        />
      )}

      {vagaEmDrawer && (
        <VagaDrawer
          vaga={vagaEmDrawer}
          candidatosCount={candidatosByVaga[vagaEmDrawer.id] || 0}
          canWrite={canWrite}
          stages={vagaStages}
          copiedSlug={copiedSlug}
          onStageChange={handleVagaStageChange}
          onEdit={(v) => { setEditingVaga(v); setVagaDrawerId(null); }}
          onCopyLink={handleCopyLink}
          onVerCandidatos={handleVerCandidatos}
          onClose={() => setVagaDrawerId(null)}
          customFields={vagaStageFields.getFields(vagaEmDrawer.stage)}
          onCustomFieldChange={(fieldKey, value) => handleVagaCustomFieldChange(vagaEmDrawer.id, fieldKey, value)}
          onAddActivity={(entry) => handleVagaAddActivity(vagaEmDrawer.id, entry)}
          currentUser={user}
          users={profileUsers}
        />
      )}

      {addCandidatoStage && (
        <NovoCandidatoModal
          defaultStage={addCandidatoStage}
          vagas={vagas}
          stages={candStages}
          onSave={handleCreateCandidato}
          onClose={() => setAddCandidatoStage(null)}
        />
      )}

      {selectedCandidato && (
        <CandidatoDrawer
          candidato={selectedCandidato}
          vagas={vagas}
          stages={candStages}
          canWrite={canWrite}
          onStageChange={handleStageChange}
          onAddNote={handleAddNote}
          onRatingChange={handleRatingChange}
          onClose={() => setSelectedCandidatoId(null)}
          onHire={(c) => setHiringCandidato(c)}
          customFields={candStageFields.getFields(selectedCandidato.stage)}
          onCustomFieldChange={(fieldKey, value) => handleAplicacaoCustomFieldChange(selectedCandidato.id, fieldKey, value)}
          onAddActivity={(entry) => handleAplicacaoAddActivity(selectedCandidato.id, entry)}
          currentUser={user}
          users={profileUsers}
        />
      )}

      {stageEditorOpen && (
        <RHStageEditorModal
          open={stageEditorOpen}
          onClose={() => setStageEditorOpen(false)}
          domain={viewMode}
          domainLabel={viewMode === "vagas" ? "Vagas" : "Candidatos"}
          records={viewMode === "vagas" ? vagas : candidatos}
          stageField="stage"
        />
      )}

      {fieldEditorStage && (
        <RHStageFieldEditorModal
          open={Boolean(fieldEditorStage)}
          onClose={() => setFieldEditorStage(null)}
          domain={fieldEditorStage.domain}
          stageKey={fieldEditorStage.stageKey}
          stageName={fieldEditorStage.stageName}
        />
      )}

      {pendingReprovacaoDrop && (
        <ReprovacaoDropModal
          info={pendingReprovacaoDrop}
          onConfirm={confirmReprovacaoDrop}
          onClose={() => setPendingReprovacaoDrop(null)}
        />
      )}

      {hiringCandidato && (
        <NovoColaboradorModal
          currentUser={user}
          hireContext={{ vagaId: vagaDoCandidatoContratando?.id, vagaTitle: vagaDoCandidatoContratando?.title }}
          initialData={{
            fullName: hiringCandidato.name || "",
            email: hiringCandidato.email || "",
            phone: hiringCandidato.phone || "",
            jobTitle: vagaDoCandidatoContratando?.job_title || "",
            department: vagaDoCandidatoContratando?.department || "",
            contractType: vagaDoCandidatoContratando?.contract_type || "",
            salary: vagaDoCandidatoContratando?.salary_min != null ? String(vagaDoCandidatoContratando.salary_min) : "",
          }}
          onSave={handleSaveHired}
          onClose={() => setHiringCandidato(null)}
        />
      )}

      {triagemOpen && (
        <TriagemIAModal
          vagas={vagas}
          talentPool={talentPool}
          aplicacoesRaw={aplicacoesRaw}
          user={user}
          onAttach={attachTriagemToVaga}
          onClose={() => setTriagemOpen(false)}
        />
      )}
    </div>
  );
}
