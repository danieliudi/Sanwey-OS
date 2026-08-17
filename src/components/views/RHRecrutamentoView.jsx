import React, { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  ChevronRight,
  ChevronLeft,
  Plus,
  Star,
  User,
  X,
  MessageSquare,
  UserPlus,
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
  AlertCircle,
  LayoutGrid,
  List,
  CalendarDays as CalendarIcon,
  Mail,
  ShieldCheck,
  TrendingUp,
  Download,
} from "lucide-react";
import {
  RH_DEPARTMENTS,
  RH_CONTRACT_TYPES,
  RH_ESCALA_TYPES,
} from "../../constants/rh-config";
import { exportVagasToCSV, exportCandidatosToCSV } from "../../utils/export-csv";
import { formatDateBR, daysSince } from "../../utils/date";
import { RHJornadaEditor, formatScheduleBlocks } from "../rh-pipeline/RHJornadaEditor";
import { RHBenefitsPicker } from "../rh-pipeline/RHBenefitsPicker";
import { RH_FRENTES, RH_FRENTE_LABELS, RH_FRENTE_COLORS } from "../../constants/rh-frentes";
import { COMPANIES } from "../../constants/companies";
import { formatBRL } from "../../utils/currency";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";
import { useRHManagerLinks } from "../../hooks/use-rh-manager-links";
import { StageNavigator } from "../shared/StageNavigator";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { MobileTableCards } from "../shared/MobileTableCards";
import { QRCodeButton } from "../shared/QRCodeButton";
import { CopyPublicLinkButton } from "../shared/CopyPublicLinkButton";
import { useRHCargoTemplates } from "../../hooks/use-rh-cargo-templates";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHOnboarding } from "../../hooks/use-rh-onboarding";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useProfiles } from "../../hooks/use-profiles";
import { useAI } from "../../hooks/use-ai";
import { NovoColaboradorModal } from "./NovoColaboradorModal";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHMobileKanbanAccordion } from "../rh-pipeline/RHMobileKanbanAccordion";
import { RHStageListManager } from "../shared/stage-editor/StageListManager";
import { RHStageFieldsPanel } from "../shared/stage-editor/RHStageFieldsPanel";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { RHDetailDrawerShell, RHDetailComments } from "../rh-pipeline/RHDetailDrawerShell";
import { useRecordViews } from "../../hooks/use-record-views";
import { hasUnreadRHComment } from "../../lib/comment-badge";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness, isStageRegression } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { EmptyState } from "../ui/EmptyState";
import { CurrencyInput } from "../ui/CurrencyInput";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AvatarStack } from "../shared/AvatarStack";
import { AppToast } from "../shared/AppToast";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { useKanbanColumnSort } from "../../hooks/use-kanban-sort";
import { sortKanbanItems } from "../../utils/kanban-sort";
import { stageTextColor } from "../../utils/stage-colors";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { KanbanAnalyticsPanel } from "../shared/KanbanAnalyticsPanel";

// ── Ciclo de vida da vaga / candidatos ──────────────────────────────────────
// As etapas (nome/cor/ordem) agora são administráveis via
// useRHPipelineStages("vagas"|"candidatos") — ver RHStageListManager. Estes
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

const TRIAGEM_SYSTEM_PROMPT = `Você é um analista de recrutamento técnico. Receberá a descrição de uma vaga e o currículo de um candidato (anexado como documento PDF, ou como texto extraído de um DOCX). Avalie exclusivamente com base no conteúdo do currículo — não presuma informação não escrita.

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

// DOCX não é aceito nativamente pela Claude API (só PDF/imagem como
// documento) — extrai o texto puro no navegador com mammoth e manda como
// bloco de texto em vez de pular o candidato (R10 do PRD de RH).
async function extractDocxText(blob) {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await blob.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
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
  const [frenteFiltro, setFrenteFiltro] = useState("todas"); // R12: talent pool filtrável por frente
  const [necessidade, setNecessidade] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [attachingId, setAttachingId] = useState(null);
  const [attachedIds, setAttachedIds] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState(null);
  const [resumeUrls, setResumeUrls] = useState({});

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const talentPoolFiltrado = useMemo(() => {
    if (frenteFiltro === "todas") return talentPool;
    return talentPool.filter(c => (c.frente_origem || []).includes(frenteFiltro));
  }, [talentPool, frenteFiltro]);
  // R9: busca livre sobre todo o talent pool (não amarrada a uma vaga) — a
  // vaga só é necessária pra "Adicionar à vaga" depois do resultado.
  const analisaveisCandidatos = useMemo(
    () => talentPoolFiltrado.filter(c => c.resume_ext === "pdf" || c.resume_ext === "docx"),
    [talentPoolFiltrado]
  );
  const semCurriculo = useMemo(() => talentPoolFiltrado.filter(c => !c.resume_ext).length, [talentPoolFiltrado]);

  const handleVagaChange = (id) => {
    setVagaId(id);
    const v = vagas.find(vg => vg.id === id);
    if (v && !necessidade.trim()) {
      setNecessidade([v.title, v.requirements, v.description].filter(Boolean).join(" — "));
    }
  };

  const alreadyLinked = (candidateId) => vagaId && aplicacoesRaw.some(a => a.candidate_id === candidateId && a.vaga_id === vagaId);

  const verCurriculo = async (cand) => {
    const key = cand.id;
    if (resumeUrls[key]) { window.open(resumeUrls[key], "_blank", "noreferrer"); return; }
    const { data, error: err } = await supabase.storage
      .from("rh-curriculos")
      .createSignedUrl(`${cand.id}/curriculo.${cand.resume_ext}`, 3600);
    if (err || !data?.signedUrl) { setErrorMsg("Não foi possível abrir o currículo."); return; }
    setResumeUrls(prev => ({ ...prev, [key]: data.signedUrl }));
    window.open(data.signedUrl, "_blank", "noreferrer");
  };

  const runTriagem = async () => {
    if (!necessidade.trim()) { setErrorMsg("Descreva o que você procura."); return; }
    setErrorMsg(null);
    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: analisaveisCandidatos.length });
    const out = [];
    for (const cand of analisaveisCandidatos) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from("rh-curriculos")
          .download(`${cand.id}/curriculo.${cand.resume_ext}`);
        if (dlErr || !blob) throw new Error("Currículo indisponível");
        const userContent = cand.resume_ext === "pdf"
          ? [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: await blobToBase64(blob) } },
              { type: "text", text: `Vaga: ${necessidade}` },
            ]
          : [
              { type: "text", text: `Vaga: ${necessidade}\n\nCurrículo (texto extraído de DOCX):\n${await extractDocxText(blob)}` },
            ];
        const text = await complete([
          { role: "system", content: TRIAGEM_SYSTEM_PROMPT },
          { role: "user", content: userContent },
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
    if (!vagaId) { setErrorMsg("Selecione uma vaga para vincular o candidato."); return; }
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
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
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
            <div style={{ background: "var(--warning-bg)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)", borderRadius: 10, padding: 14, fontSize: 12, color: "var(--warning)", lineHeight: 1.6 }}>
              Configure uma LLM em <strong>Configurações → Integrações</strong> para usar a triagem por currículo.
            </div>
          ) : provider !== "anthropic" ? (
            <div style={{ background: "var(--warning-bg)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)", borderRadius: 10, padding: 14, fontSize: 12, color: "var(--warning)", lineHeight: 1.6 }}>
              A triagem por currículo requer o provedor <strong>Anthropic (Claude)</strong> configurado — ele lê o PDF diretamente. Troque o provedor em Configurações → Integrações.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 mb-4">
                <div>
                  <label style={labelSt}>Frente</label>
                  <select value={frenteFiltro} onChange={(e) => setFrenteFiltro(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                    <option value="todas">Todas as frentes</option>
                    {RH_FRENTES.map((id) => <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>)}
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
                <div>
                  <label style={labelSt}>Vaga (opcional — só necessária pra "Adicionar à vaga" depois)</label>
                  <select value={vagaId} onChange={(e) => handleVagaChange(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                    <option value="">Sem vincular a uma vaga</option>
                    {vagas.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12 }}>
                {analisaveisCandidatos.length} candidato{analisaveisCandidatos.length !== 1 ? "s" : ""} com currículo (PDF ou DOCX) no talent pool
                {semCurriculo > 0 && ` · ${semCurriculo} sem currículo`}
              </div>

              {errorMsg && (
                <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{errorMsg}</div>
              )}

              <button
                onClick={runTriagem}
                disabled={running || analisaveisCandidatos.length === 0}
                style={{ width: "100%", background: "#7C3AED", color: "#FFF", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", opacity: (running || analisaveisCandidatos.length === 0) ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {running && <Loader2 size={14} className="animate-spin" />}
                {running ? `Analisando ${progress.done}/${progress.total}…` : "Triar com IA"}
              </button>

              {results.length > 0 && (
                <div className="flex flex-col gap-2 mt-4">
                  {results.map((r) => {
                    const cand = analisaveisCandidatos.find(c => c.id === r.candidateId);
                    return (
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
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {cand && (
                              <button
                                onClick={() => verCurriculo(cand)}
                                style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-alt)", color: "var(--text)", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              >
                                Ver currículo
                              </button>
                            )}
                            <button
                              onClick={() => handleAttach(r)}
                              disabled={attachingId === r.candidateId || attachedIds.has(r.candidateId) || alreadyLinked(r.candidateId)}
                              style={{ display: "flex", alignItems: "center", gap: 6, background: attachedIds.has(r.candidateId) || alreadyLinked(r.candidateId) ? "var(--surface-alt)" : "var(--accent-tint)", color: attachedIds.has(r.candidateId) || alreadyLinked(r.candidateId) ? "var(--text-dim)" : "var(--accent)", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: attachedIds.has(r.candidateId) || alreadyLinked(r.candidateId) ? "default" : "pointer" }}
                            >
                              {attachedIds.has(r.candidateId) || alreadyLinked(r.candidateId)
                                ? <><Check size={12} /> Adicionado à vaga</>
                                : attachingId === r.candidateId ? "Adicionando…" : "Adicionar à vaga"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    );
                  })}
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

// Achado da 2ª auditoria: valores brutos concatenados com "—" ("R$ 3000 – R$ —")
// quando só um dos limites era preenchido. Agora usa formatBRL e frases naturais.
function fmtSalaryRange(min, max) {
  const hasMin = min != null && min !== "";
  const hasMax = max != null && max !== "";
  if (!hasMin && !hasMax) return "—";
  if (hasMin && !hasMax) return `A partir de ${formatBRL(min)}`;
  if (!hasMin && hasMax) return `Até ${formatBRL(max)}`;
  return `${formatBRL(min)} – ${formatBRL(max)}`;
}

// ── Kanban/Tabela/Calendário — mesmo padrão de ComprasMarketingView/RHFeriasView ──

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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

function NovaVagaModal({ cargos, initialData, onSave, onManageCargos, onClose, stageId, users, userId }) {
  const targetStage = stageId || initialData?.stage;
  const vagaStageFields = useRHStageFields("vagas");
  const [customValues, setCustomValues] = useState(initialData?.custom_fields || {});
  const visibleFields = resolveVisibleFields(vagaStageFields.getFields(targetStage), customValues);
  const [title, setTitle]           = useState(initialData?.title || "");
  const [companyIds, setCompanyIds] = useState(initialData?.company_ids || []);
  const [cargoId, setCargoId]       = useState(initialData?.cargo_template_id || "");
  const [jobTitle, setJobTitle]     = useState(initialData?.job_title || "");
  const [dept, setDept]             = useState(initialData?.department || "");
  const [contractType, setContractType] = useState(initialData?.contract_type || "");
  const [salaryMin, setSalaryMin]   = useState(initialData?.salary_min != null ? String(initialData.salary_min) : "");
  const [salaryMax, setSalaryMax]   = useState(initialData?.salary_max != null ? String(initialData.salary_max) : "");
  const [benefits, setBenefits]     = useState(initialData?.benefits || []);
  const [scheduleBlocks, setScheduleBlocks] = useState(initialData?.schedule_blocks || []);
  const [escala, setEscala]         = useState(initialData?.escala || "");
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
    if (!cargo) {
      // "Sem cargo padrão — preencher manualmente" (id vazio) não limpava os
      // campos que um cargo escolhido antes tinha preenchido — a vaga saía
      // com cargo_template_id null mas salário/benefícios/turno de um cargo
      // que não é mais o selecionado, sem nenhum aviso. Achado da auditoria
      // de fricção de 18/07.
      setJobTitle("");
      setDept("");
      setContractType("");
      setSalaryMin("");
      setSalaryMax("");
      setBenefits([]);
      setScheduleBlocks([]);
      setEscala("");
      return;
    }
    setJobTitle(cargo.name || "");
    setDept(cargo.department || "");
    setContractType(cargo.contract_type || "");
    setSalaryMin(cargo.salary_min != null ? String(cargo.salary_min) : "");
    setSalaryMax(cargo.salary_max != null ? String(cargo.salary_max) : "");
    setBenefits(cargo.benefits || []);
    setScheduleBlocks(cargo.schedule_blocks || []);
    setEscala(cargo.escala || "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError("Título da vaga é obrigatório."); return; }
    if (companyIds.length === 0) { setError("Selecione ao menos uma frente."); return; }
    if (!dept) { setError("Departamento é obrigatório."); return; }
    if (!jobTitle.trim()) { setError("Cargo é obrigatório."); return; }
    const missing = getMissingRequiredFields(visibleFields, customValues);
    if (missing.length > 0) { setError(`Preencha antes: ${missing.map(f => f.label).join(", ")}.`); return; }
    const invalid = getInvalidFields(visibleFields, customValues);
    if (invalid.length > 0) { setError(`Corrija antes: ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        company_ids: companyIds,
        department: dept,
        job_title: jobTitle.trim(),
        cargo_template_id: cargoId || null,
        contract_type: contractType || null,
        salary_min: salaryMin !== "" ? Number(salaryMin) : null,
        salary_max: salaryMax !== "" ? Number(salaryMax) : null,
        benefits,
        schedule_blocks: scheduleBlocks,
        escala: escala || null,
        hiring_deadline: deadline || null,
        priority,
        description: desc.trim() || null,
        custom_fields: customValues,
      };
      if (stageId) payload.stage = stageId;
      await onSave(payload);
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
      style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "var(--shadow-pop)", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>{initialData ? "Editar Vaga" : "Nova Vaga"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", overflowY: "auto", flex: 1 }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Título da vaga *</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Analista de Marketing" className={inputCls} style={inputSt}
                onFocus={focusBlue} onBlur={blurGray} autoFocus
              />
            </div>

            <div>
              <label style={labelSt}>Frente(s) *</label>
              <div className="flex gap-2 flex-wrap">
                {RH_FRENTES.map((id) => {
                  const selected = companyIds.includes(id);
                  const color = RH_FRENTE_COLORS[id];
                  return (
                    <button
                      key={id} type="button"
                      onClick={() => setCompanyIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id])}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                      style={selected ? { background: color, color: "#fff", borderColor: color } : { background: "var(--surface-alt)", color: "var(--text-dim)", borderColor: "var(--border)" }}
                    >
                      {RH_FRENTE_LABELS[id]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ ...labelSt, marginBottom: 0 }}>Modelo de cargo salvo (opcional — preenche os campos abaixo)</label>
              <button type="button" onClick={onManageCargos} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Settings2 size={11} /> Gerenciar cargos
              </button>
            </div>
            <select value={cargoId} onChange={(e) => applyCargo(e.target.value)} className={inputCls} style={inputSt}>
              <option value="">Sem modelo — preencher manualmente</option>
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
                <CurrencyInput value={salaryMin} onChange={setSalaryMin} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Salário máx. (R$)</label>
                <CurrencyInput value={salaryMax} onChange={setSalaryMax} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Prazo para contratação</label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>

            <div>
              <label style={labelSt}>Jornada</label>
              <RHJornadaEditor value={scheduleBlocks} onChange={setScheduleBlocks} />
            </div>

            <div>
              <label style={labelSt}>Escala</label>
              <select value={escala} onChange={(e) => setEscala(e.target.value)} className={inputCls} style={inputSt}>
                <option value="">Selecionar padrão de escala</option>
                {RH_ESCALA_TYPES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>

            <div>
              <label style={labelSt}>Benefícios</label>
              <RHBenefitsPicker value={benefits} onChange={setBenefits} userId={userId} />
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

          {visibleFields.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Campos desta etapa
              </div>
              <div className="flex flex-col gap-3">
                {visibleFields.map((f) => (
                  <div key={f.id}>
                    <label style={labelSt}>
                      {f.effectiveRequired && <span style={{ color: "var(--danger)", marginRight: 2 }}>*</span>}
                      {f.label}
                    </label>
                    {f.helpText && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{f.helpText}</div>
                    )}
                    <RHStageFieldInput
                      field={f}
                      value={customValues[f.fieldKey]}
                      onChange={(val) => setCustomValues((prev) => ({ ...prev, [f.fieldKey]: val }))}
                      users={users}
                      touched={Boolean(error)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
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

function GerenciarCargosModal({ cargos, onCreate, onDelete, onClose, userId }) {
  const [name, setName]           = useState("");
  const [dept, setDept]           = useState("");
  const [contractType, setContractType] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [benefits, setBenefits]   = useState([]);
  const [scheduleBlocks, setScheduleBlocks] = useState([]);
  const [escala, setEscala]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };
  const inputCls = "w-full text-sm rounded-lg border px-2.5 py-1.5 outline-none";

  const reset = () => {
    setName(""); setDept(""); setContractType(""); setSalaryMin(""); setSalaryMax(""); setBenefits([]); setScheduleBlocks([]); setEscala("");
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
        benefits,
        schedule_blocks: scheduleBlocks,
        escala: escala || null,
      });
      reset();
    } catch (err) {
      setError(err?.message || "Erro ao criar cargo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
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
              <CurrencyInput value={salaryMin} onChange={setSalaryMin} placeholder="Mín." className={inputCls} style={inputSt} />
              <CurrencyInput value={salaryMax} onChange={setSalaryMax} placeholder="Máx." className={inputCls} style={inputSt} />
              <select value={escala} onChange={(e) => setEscala(e.target.value)} className={inputCls} style={inputSt}>
                <option value="">Escala</option>
                {RH_ESCALA_TYPES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Jornada</label>
              <RHJornadaEditor value={scheduleBlocks} onChange={setScheduleBlocks} />
            </div>
            <div>
              <label style={labelSt}>Benefícios</label>
              <RHBenefitsPicker value={benefits} onChange={setBenefits} userId={userId} />
            </div>
          </div>

          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginTop: 10 }}>{error}</div>}

          <button onClick={handleAdd} disabled={saving} style={{ marginTop: 10, width: "100%", background: "var(--accent)", color: "var(--on-accent)", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Adicionando…" : "Adicionar cargo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vaga Kanban Card ──────────────────────────────────────────────────────────

function VagaCard({ vaga, candidatosCount, usersById }) {
  const pri = priorityInfo(vaga.priority);
  const resolvedResponsibles = (vaga.responsible_ids || []).map(id => usersById?.get(id)).filter(Boolean);
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{vaga.title}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 6 }}>{vaga.job_title || vaga.department || "—"}</div>
      {(vaga.company_ids || []).length > 0 && (
        <div className="flex gap-1 flex-wrap" style={{ marginBottom: 6 }}>
          {vaga.company_ids.map((id) => (
            <span key={id} style={{ fontSize: 9, fontWeight: 700, color: RH_FRENTE_COLORS[id] || "var(--text-dim)", background: `${RH_FRENTE_COLORS[id] || "#888"}18`, borderRadius: 99, padding: "1px 7px" }}>
              {RH_FRENTE_LABELS[id] || COMPANIES[id]?.short || id}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: pri.color, background: `${pri.color}18`, borderRadius: 99, padding: "1px 7px", textTransform: "uppercase" }}>
          {pri.name}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{candidatosCount} candidato{candidatosCount !== 1 ? "s" : ""}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        {vaga.hiring_deadline ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-dim)" }}>
            <CalendarClock size={10} /> {formatDateBR(vaga.hiring_deadline)}
          </div>
        ) : <span />}
        {resolvedResponsibles.length > 0 && <AvatarStack users={resolvedResponsibles} size={16} max={3} />}
      </div>
    </div>
  );
}

function VagaKanbanColumn({
  stage, stages, vagasList, candidatosByVaga, onCardClick, canWrite,
  onMoveToStage, onDeleteVaga, onDuplicateVaga, onDragStart, onDragEnd, isDragOver, onDragOver, onDragLeave, onDrop, onEditFields,
  getCompleteness, getUnread, onAddVaga, usersById, boardHeight, getSortCriteria, setSortCriteria,
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="flex flex-col rounded-lg transition-all duration-150"
      style={{
        width: 272, minWidth: 272,
        height: "100%",
        overflow: "hidden",
        borderRight: stage.stageKey !== stages[stages.length - 1]?.stageKey ? "1px solid var(--border)" : "none",
        background: isDragOver ? stage.color + "14" : "var(--surface-alt)",
        boxShadow: isDragOver ? `0 0 0 2px ${stage.color}40` : "none",
      }}
    >
      <KanbanColumnHeader
        color={stage.color}
        name={stage.name}
        count={vagasList.length}
        bandHeight={4}
        letterSpacing="normal"
        nameFontSize={14}
        nameFontWeight={700}
        uppercase={false}
        countFontSize={12}
        actions={
          <div className="flex items-center gap-1 shrink-0">
            <KanbanColumnSortMenu
              criteria={getSortCriteria(stage.stageKey)}
              onChange={(v) => setSortCriteria(stage.stageKey, v)}
              options={["recent", "deadline", "priority", "alpha"]}
              accentColor={stage.color}
            />
            {canWrite && (
              <button
                onClick={onAddVaga}
                title="Adicionar vaga"
                style={{ background: "none", border: "none", cursor: "pointer", color: stage.color, padding: 2, display: "flex" }}
              >
                <Plus size={14} />
              </button>
            )}
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
        }
      />
      <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {vagasList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-dim)", fontSize: 11, opacity: 0.5, display: "flex", flexDirection: "column", gap: 2 }}>
            {isDragOver ? <span style={{ opacity: 0.5 }}>Soltar aqui</span> : (
              <>
                <span style={{ opacity: 0.5 }}>Nenhuma vaga nesta etapa</span>
                {!stage.terminal && <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>}
              </>
            )}
          </div>
        ) : (
          vagasList.map((v) => (
            <RHKanbanCard
              key={v.id}
              id={v.id}
              stage={v.stage}
              stages={stages}
              onClick={() => onCardClick(v)}
              onDragStart={canWrite ? onDragStart : undefined}
              onDragEnd={canWrite ? onDragEnd : undefined}
              onMoveToStage={canWrite ? onMoveToStage : undefined}
              onDeleteCard={canWrite ? onDeleteVaga : undefined}
              onDuplicateCard={canWrite ? onDuplicateVaga : undefined}
              showMoveOptions={false}
              agingDays={daysSince(v.stage_changed_at)}
              completeness={getCompleteness?.(v)}
              unread={getUnread?.(v)}
            >
              <VagaCard vaga={v} candidatosCount={candidatosByVaga[v.id] || 0} usersById={usersById} />
            </RHKanbanCard>
          ))
        )}
      </div>
    </div>
  );
}

// ── Vaga Drawer ───────────────────────────────────────────────────────────────

function VagaDrawer({
  vaga, candidatosCount, canWrite, stages, onStageChange, onEdit, onClose, onVerCandidatos,
  customFields, onCustomFieldChange, onAddActivity, onUpdateActivity, currentUser, users, moveError, notifyMentions, onUpdateResponsibles,
  onDelete, onEditFields,
}) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // Encaminhar candidatos da vaga pro gestor de área avaliar sem login
  // (item 8) — link seguro por e-mail, escopado a essa vaga específica.
  const { links: managerLinks, createLink: createManagerLink, revokeLink: revokeManagerLink } = useRHManagerLinks(vaga.id);
  const [managerModalOpen, setManagerModalOpen] = useState(false);

  const stageInfo = findStage(stages, vaga.stage);
  const pri = priorityInfo(vaga.priority);
  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

  // Campos condicionais: reavalia visibilidade/obrigatoriedade a cada
  // keystroke a partir do valor atual de vaga.custom_fields (mesmo objeto
  // que alimenta o `value` do RHStageFieldInput abaixo).
  const visibleCustomFields = resolveVisibleFields(customFields, vaga.custom_fields || {});

  // Responsáveis (FASE 5) — net-new, sem escalar anterior; default vazio.
  const responsibleIds = vaga.responsible_ids || [];
  const resolvedResponsibles = responsibleIds.map(id => users.find(u => u.id === id)).filter(Boolean);

  const header = (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{vaga.title}</div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{vaga.job_title || "—"} · {vaga.department || "—"}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${stageInfo.color}18`, color: stageTextColor(stageInfo.color), borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageInfo.color, display: "inline-block" }} /> {stageInfo.name}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: pri.color, fontSize: 11, fontWeight: 600 }}>
          <Flag size={11} /> {pri.name}
        </span>
        {(vaga.company_ids || []).map((id) => (
          <span key={id} style={{ fontSize: 11, fontWeight: 600, color: RH_FRENTE_COLORS[id] || "var(--text-dim)", background: `${RH_FRENTE_COLORS[id] || "#888"}18`, borderRadius: 99, padding: "2px 10px" }}>
            {RH_FRENTE_LABELS[id] || COMPANIES[id]?.short || id}
          </span>
        ))}
      </div>
    </div>
  );

  // "Campos desta etapa" vira o centro fixo do drawer (padrão platform-wide,
  // CLAUDE.md regra 3/item 2, rodada de 07/08/2026) — não faz mais parte da
  // aba "Form" junto do resto do conteúdo específico de Vaga (link público,
  // encaminhamento pro gestor).
  const center = visibleCustomFields.length === 0 ? (
    <button
      onClick={() => onEditFields?.(stageInfo)}
      className="text-xs text-center cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--text-dim)", lineHeight: 1.6, padding: "16px 0", textAlign: "center", width: "100%" }}
    >
      Nenhum campo nessa fase. <span style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>Clique aqui para editar essa etapa.</span>
    </button>
  ) : (
    <div>
      <div style={labelSt}>Campos desta etapa</div>
      <div className="flex flex-col gap-3">
        {visibleCustomFields.map((field) => (
          <div key={field.id}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
              {field.label}{field.effectiveRequired && <span style={{ color: "var(--danger)" }}> *</span>}
            </div>
            {field.helpText && (
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{field.helpText}</div>
            )}
            <RHStageFieldInput
              field={field}
              value={vaga.custom_fields?.[field.fieldKey]}
              onChange={(val) => onCustomFieldChange(field.fieldKey, val)}
              users={users}
              touched={Boolean(moveError)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const formContent = (
    <>
      {canWrite && (
        <>
          {vaga.stage === "publicada" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <CopyPublicLinkButton url={`${window.location.origin}/vagas/${vaga.link_slug}`} />
              <a
                href={whatsappShareUrl(vaga)}
                target="_blank"
                rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--success-bg)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--success)", textDecoration: "none" }}
              >
                <MessageSquare size={12} /> WhatsApp
              </a>
              <QRCodeButton url={`${window.location.origin}/vagas/${vaga.link_slug}`} title={vaga.title} buttonLabel="QR" compact />
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => onEdit(vaga)} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
              Editar vaga
            </button>
            <button onClick={() => onVerCandidatos(vaga.id)} style={{ flex: 1, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Ver candidatos
            </button>
          </div>

          {/* Triagem externa por gestor de área (item 8) — link seguro,
              sem login, escopado só a esta vaga. */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={labelSt}>Avaliação do gestor de área</div>
              <button
                onClick={() => setManagerModalOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--text)", cursor: "pointer" }}
              >
                <Mail size={12} /> Encaminhar pro gestor
              </button>
            </div>
            {managerLinks.length > 0 && (
              <div className="flex flex-col gap-2">
                {managerLinks.map((link) => {
                  const revoked = !!link.revoked_at;
                  const expired = !revoked && new Date(link.expires_at).getTime() < Date.now();
                  const status = revoked ? { label: "Revogado", color: "var(--text-dim)" } : expired ? { label: "Expirado", color: "var(--text-dim)" } : { label: "Ativo", color: "var(--success)" };
                  return (
                    <div key={link.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.manager_name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{link.manager_email}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: status.color }}>
                          <ShieldCheck size={11} /> {status.label}
                        </span>
                        {!revoked && !expired && (
                          <button
                            onClick={() => revokeManagerLink(link.id)}
                            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 11, fontWeight: 600 }}
                          >
                            Revogar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {managerModalOpen && (
        <EncaminharGestorModal
          vagaTitle={vaga.title}
          onSave={async (form) => {
            // Só fecha como sucesso se o e-mail realmente saiu — quando
            // emailSent=false o modal mostra o link pra envio manual em vez
            // de fingir que o gestor foi avisado (achado da auditoria).
            const res = await createManagerLink({ ...form, vagaTitle: vaga.title, userId: currentUser?.id });
            if (res?.emailSent) setManagerModalOpen(false);
            return res;
          }}
          onClose={() => setManagerModalOpen(false)}
        />
      )}
    </>
  );

  const left = (
    <>
      <div>
        <div style={labelSt}>Responsáveis</div>
        {canWrite ? (
          <AssigneeMultiSelect
            value={responsibleIds}
            onChange={(ids) => onUpdateResponsibles(ids)}
            options={users}
            placeholder="Selecionar responsáveis…"
          />
        ) : resolvedResponsibles.length > 0 ? (
          <AvatarStack users={resolvedResponsibles} size={22} max={4} />
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Nenhum responsável definido</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Tipo de contrato", value: RH_CONTRACT_TYPES.find((c) => c.id === vaga.contract_type)?.label || "—" },
          { label: "Jornada", value: formatScheduleBlocks(vaga.schedule_blocks) || vaga.schedule || "—" },
          { label: "Escala", value: RH_ESCALA_TYPES.find((e) => e.id === vaga.escala)?.label || vaga.shift || "—" },
          { label: "Prazo para contratação", value: formatDateBR(vaga.hiring_deadline) },
          { label: "Faixa salarial", value: fmtSalaryRange(vaga.salary_min, vaga.salary_max) },
          { label: "Candidatos", value: String(candidatosCount) },
        ].map((f) => (
          <div key={f.label}>
            <div style={labelSt}>{f.label}</div>
            <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{f.value}</div>
          </div>
        ))}
      </div>

      {vaga.benefits?.length > 0 && (
        <div>
          <div style={labelSt}>Benefícios</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {vaga.benefits.map((b, i) => (
              <span key={i} style={{ fontSize: 11, color: "var(--text)", background: "var(--surface-alt)", borderRadius: 99, padding: "3px 10px" }}>{b}</span>
            ))}
          </div>
        </div>
      )}

      {vaga.description && (
        <div>
          <div style={labelSt}>Descrição</div>
          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{vaga.description}</div>
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />

      <RHDetailDrawerShell
        domain="vagas"
        recordId={vaga.id}
        activities={vaga.activities || []}
        onAddActivity={onAddActivity}
        currentUser={currentUser}
        users={users}
        stages={stages}
        formContent={formContent}
        record={{ ...vaga, stageChangedAt: vaga.stage_changed_at }}
        recordTitle={vaga.title}
        domainLabel="Recrutamento"
      />
    </>
  );

  const right = (
    <>
      {canWrite && (
        <div>
          <div style={labelSt}>Mover para</div>
          {moveError && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 11 }}>
              <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              {moveError}
            </div>
          )}
          <StageNavigator
            targets={stages.filter((s) => s.stageKey !== vaga.stage)}
            onMove={(stageKey) => onStageChange(vaga.id, stageKey)}
            getKey={(s) => s.stageKey}
            currentStageKey={vaga.stage}
            allStages={stages}
          />
        </div>
      )}

      {/* Comentários — sempre visíveis na lateral direita, abaixo da
          movimentação de card (não mais escondidos atrás de uma aba). */}
      <RHDetailComments
        activities={vaga.activities || []}
        onAddActivity={onAddActivity}
        onUpdateActivity={onUpdateActivity ? (activityId, patch) => onUpdateActivity(vaga.id, activityId, patch) : undefined}
        currentUser={currentUser}
        users={users}
        notifyMentions={notifyMentions}
        mentionLink={{ module: "rh_vagas", id: vaga.id }}
        mentionContextLabel={vaga.title}
      />

      {canWrite && onEditFields && (
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onEditFields(stageInfo); }}
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--text-dim)", textDecoration: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <Settings2 size={12} />
            Editar campos desta etapa
          </a>
        </div>
      )}
    </>
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
      onDelete={canWrite && onDelete ? () => onDelete(vaga.id) : undefined}
      deleteLabel="Excluir vaga"
    />
  );
}

function EncaminharGestorModal({ vagaTitle, onSave, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [emailFailedLink, setEmailFailedLink] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await onSave({ managerName: name.trim(), managerEmail: email.trim().toLowerCase() });
      if (res && res.emailSent === false && res.link?.token) {
        setEmailFailedLink(`${window.location.origin}/gestor-vaga/${res.link.token}`);
      }
    } catch (err) {
      setError(err.message || "Não foi possível gerar o link.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Encaminhar candidatos pro gestor</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>
          {emailFailedLink ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--warning-bg)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "var(--warning)", lineHeight: 1.5 }}>
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                Link criado, mas o e-mail não foi enviado — copie o link e envie manualmente pro gestor.
              </div>
              <div style={{ marginTop: 12, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "var(--text)", wordBreak: "break-all", userSelect: "all" }}>
                {emailFailedLink}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <CopyPublicLinkButton url={emailFailedLink} label="Copiar link" />
                <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
                  Fechar
                </button>
              </div>
            </>
          ) : (
          <>
          <p style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 16 }}>
            O gestor vai receber um link seguro por e-mail com todos os candidatos da vaga "{vagaTitle}". Ele confirma o próprio e-mail antes de ver qualquer dado — sem precisar de login na plataforma.
          </p>
          <div style={{ marginBottom: 12 }}>
            <div style={labelSt}>Nome do gestor *</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Ana Souza"
              autoFocus
              className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", fontSize: 13 }}
            />
          </div>
          <div style={{ marginBottom: 4 }}>
            <div style={labelSt}>E-mail do gestor *</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="gestor@empresa.com"
              className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", fontSize: 13 }}
            />
          </div>
          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 10px", marginTop: 12, fontSize: 11 }}>
              <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving || !valid}
              style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", opacity: saving || !valid ? 0.6 : 1 }}
            >
              {saving ? "Enviando…" : "Enviar link"}
            </button>
            <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Vaga Tabela ───────────────────────────────────────────────────────────────

function VagaTableView({ vagas, stages, candidatosByVaga, onRowClick }) {
  return (
    <>
    <MobileTableCards
      rows={vagas}
      onRowClick={onRowClick}
      emptyMessage="Nenhuma vaga encontrada."
      title={(vaga) => vaga.title}
      chips={(vaga) => {
        const st = findStage(stages, vaga.stage);
        const pri = priorityInfo(vaga.priority);
        return [
          { label: pri.name, color: pri.color },
          { label: st.name, color: st.color },
        ];
      }}
      right={(vaga) => {
        const count = candidatosByVaga[vaga.id] || 0;
        return (
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {count} candidato{count !== 1 ? "s" : ""}
          </span>
        );
      }}
      meta={(vaga) => [vaga.job_title, vaga.department].filter(Boolean).join(" · ") || "—"}
      metaRight={(vaga) => <span>{formatDateBR(vaga.hiring_deadline)}</span>}
    />
    <div className="hidden md:block rounded-2xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Vaga", "Cargo / Departamento", "Prioridade", "Etapa", "Candidatos", "Prazo"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vagas.length === 0 && (
            <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhuma vaga encontrada.</td></tr>
          )}
          {vagas.map((vaga) => {
            const st = findStage(stages, vaga.stage);
            const pri = priorityInfo(vaga.priority);
            return (
              <tr key={vaga.id} onClick={() => onRowClick(vaga)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)" }}>{vaga.title}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{[vaga.job_title, vaga.department].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase" style={{ background: pri.color + "18", color: pri.color }}>
                    {pri.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.color + "18", color: stageTextColor(st.color), border: `1px solid ${st.color}40` }}>
                    {st.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{candidatosByVaga[vaga.id] || 0}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{formatDateBR(vaga.hiring_deadline)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

// ── Vaga Calendário ───────────────────────────────────────────────────────────
// Agrupa por hiring_deadline — prazo para contratação, único campo de data
// relevante rastreado nas vagas.

function VagaCalendarView({ vagas, stages, onPillClick }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map();
    for (const vaga of vagas) {
      if (!vaga.hiring_deadline) continue;
      const d = new Date(vaga.hiring_deadline.slice ? vaga.hiring_deadline.slice(0, 10) : vaga.hiring_deadline);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(vaga);
    }
    return map;
  }, [vagas]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const today = new Date();
  const month = cursor.getMonth();

  return (
    <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <ChevronRight size={16} />
          </button>
          <h2 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>
            {MONTHS[month]} <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>{cursor.getFullYear()}</span>
          </h2>
        </div>
        <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
          Hoje
        </button>
      </div>
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
        {WEEKDAYS.map(w => (
          <div key={w} className="px-2 py-2 text-[10px] font-bold text-center" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(88px, auto)" }}>
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isToday = sameDay(d, today);
          const k = dayKey(d);
          const items = byDay.get(k) || [];
          return (
            <div key={i} className="p-1.5 border-r border-b flex flex-col gap-1"
              style={{ borderColor: "var(--border)", background: "var(--surface)", opacity: inMonth ? 1 : 0.4 }}>
              <span className="text-xs font-semibold leading-none" style={isToday
                ? { width: 20, height: 20, borderRadius: "50%", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", color: "var(--on-accent)" }
                : { color: inMonth ? "var(--text)" : "var(--text-dim)" }}>
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((vaga) => {
                  const st = findStage(stages, vaga.stage);
                  return (
                    <span key={vaga.id} onClick={() => onPillClick(vaga)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
                      style={{ background: st.color + "18", color: stageTextColor(st.color) }}
                      title={vaga.title}>
                      {vaga.title}
                    </span>
                  );
                })}
                {items.length > 3 && (
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>+{items.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Novo Candidato Modal ──────────────────────────────────────────────────────

function NovoCandidatoModal({ defaultStage, defaultVagaId, vagas, stages, onSave, onClose, users }) {
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [phone, setPhone]   = useState("");
  // Vaga é opcional — sem ela, o candidato só entra no banco de talentos
  // (achado da auditoria de fricção de 18/07). Pré-preenche com a vaga já
  // filtrada em tela (aba Candidatos), quando houver uma.
  const [vagaId, setVagaId] = useState(defaultVagaId || "");
  const [source, setSource] = useState("");
  const [stage]             = useState(defaultStage);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const candStageFields = useRHStageFields("candidatos");
  const [customValues, setCustomValues] = useState({});
  // Campos por etapa só fazem sentido quando há uma aplicação (vaga
  // selecionada) — sem vaga não existe etapa_pipeline pra vincular.
  const visibleFields = vagaId ? resolveVisibleFields(candStageFields.getFields(stage), customValues) : [];

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = getMissingRequiredFields(visibleFields, customValues);
    if (missing.length > 0) { setError(`Preencha antes: ${missing.map(f => f.label).join(", ")}.`); return; }
    const invalid = getInvalidFields(visibleFields, customValues);
    if (invalid.length > 0) { setError(`Corrija antes: ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`); return; }
    if (!name.trim()) { setError("Nome obrigatório."); return; }
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
        customFields: customValues,
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
      style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }}
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
              <label style={labelSt}>Vaga</label>
              <select value={vagaId} onChange={(e) => setVagaId(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                <option value="">Sem vaga — só banco de talentos</option>
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

          {visibleFields.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Campos desta etapa {stageInfo?.name ? `· ${stageInfo.name}` : ""}
              </div>
              <div className="flex flex-col gap-3">
                {visibleFields.map((f) => (
                  <div key={f.id}>
                    <label style={labelSt}>
                      {f.effectiveRequired && <span style={{ color: "var(--danger)", marginRight: 2 }}>*</span>}
                      {f.label}
                    </label>
                    {f.helpText && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{f.helpText}</div>
                    )}
                    <RHStageFieldInput
                      field={f}
                      value={customValues[f.fieldKey]}
                      onChange={(val) => setCustomValues((prev) => ({ ...prev, [f.fieldKey]: val }))}
                      users={users}
                      touched={Boolean(error)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
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
  candidato, vagas, stages, canWrite, onStageChange, onStageMoved, onAddNote, onRatingChange, onClose, onHire,
  customFields, onCustomFieldChange, onAddActivity, onUpdateActivity, currentUser, users, notifyMentions, onDelete, onEditFields,
}) {
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [reprovando, setReprovando] = useState(false);
  const [pendingLostStage, setPendingLostStage] = useState(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [savingStage, setSavingStage] = useState(false);
  const [moveError, setMoveError] = useState(null);

  useEffect(() => {
    setMoveError(null);
  }, [candidato.id]);

  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // (estático ou condicional) vazio — checa ANTES do fluxo de reprovação,
  // que só deve abrir depois que os campos obrigatórios da etapa atual
  // estiverem preenchidos. Reprovação (ou qualquer etapa marcada como
  // "lost") exige motivo — regra de negócio preservada tanto no fluxo por
  // botão quanto no drag-and-drop (ver handleCandDrop na view principal).
  // Antes usava alert() nativo — bloqueante, e trava sessões automatizadas/
  // headless sem handler de diálogo. Banner inline não bloqueia nada.
  const requestStageChange = async (stageKey) => {
    const missing = getMissingRequiredFields(customFields, candidato.customFields || {});
    if (missing.length > 0) {
      setMoveError(`Não dá pra mover "${candidato.name}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(customFields, candidato.customFields || {});
    if (invalid.length > 0) {
      setMoveError(`Não dá pra mover "${candidato.name}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    setMoveError(null);
    const target = stages.find((s) => s.stageKey === stageKey);
    if (target?.lost) { setPendingLostStage(stageKey); setReprovando(true); return; }
    setSavingStage(true);
    try {
      await onStageChange(candidato.id, stageKey);
    } catch (e) {
      setMoveError(e?.message || `Não foi possível mover "${candidato.name}" — tente novamente.`);
      return;
    } finally {
      setSavingStage(false);
    }
    // Fecha o drawer agora (sinal visual de que moveu) e reabre já na etapa
    // nova — em vez de só trocar o conteúdo por baixo do drawer aberto.
    // Só chega aqui se onStageChange não lançou (write realmente persistiu).
    if (onStageMoved) { onClose(); onStageMoved(candidato.id); }
  };

  const confirmReprovacao = async () => {
    if (!motivoReprovacao.trim() || !pendingLostStage) return;
    setSavingStage(true);
    try {
      await onStageChange(candidato.id, pendingLostStage, motivoReprovacao.trim());
      setReprovando(false);
      setMotivoReprovacao("");
      setPendingLostStage(null);
      if (onStageMoved) { onClose(); onStageMoved(candidato.id); }
    } catch (e) {
      setMoveError(e?.message || `Não foi possível reprovar "${candidato.name}" — tente novamente.`);
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
  const days = daysSince(candidato.stage_changed_at);

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

  const header = (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
      <InitialsAvatar name={candidato.name} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>{candidato.name}</div>
        {candidato.email && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{candidato.email}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${stageInfo.color}18`, color: stageTextColor(stageInfo.color), borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageInfo.color, display: "inline-block" }} />
            {stageInfo.name}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{days}d nesta etapa</span>
        </div>
      </div>
    </div>
  );

  // "Campos desta etapa" vira o centro fixo do drawer (padrão platform-wide,
  // CLAUDE.md regra 3/item 2, rodada de 07/08/2026) — não faz mais parte da
  // aba "Form" junto do resto do conteúdo específico de Candidato (motivo de
  // reprovação, contratação, notas).
  const center = visibleCustomFields.length === 0 ? (
    <button
      onClick={() => onEditFields?.(stageInfo)}
      className="text-xs text-center cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--text-dim)", lineHeight: 1.6, padding: "16px 0", textAlign: "center", width: "100%" }}
    >
      Nenhum campo nessa fase. <span style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>Clique aqui para editar essa etapa.</span>
    </button>
  ) : (
    <div>
      <div style={labelSt}>Campos desta etapa</div>
      <div className="flex flex-col gap-3">
        {visibleCustomFields.map((field) => (
          <div key={field.id}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
              {field.label}{field.effectiveRequired && <span style={{ color: "var(--danger)" }}> *</span>}
            </div>
            {field.helpText && (
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{field.helpText}</div>
            )}
            <RHStageFieldInput
              field={field}
              value={candidato.customFields?.[field.fieldKey]}
              onChange={(val) => onCustomFieldChange(field.fieldKey, val)}
              users={users}
              touched={Boolean(moveError)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const formContent = (
    <>
      {/* Motivo de reprovação já registrado */}
      {candidato.stage === "reprovado" && candidato.motivo_reprovacao && (
        <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
          <div style={labelSt}>Motivo da reprovação</div>
          <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{candidato.motivo_reprovacao}</div>
        </div>
      )}

      {/* Já contratado — sinal durável + sem botão de converter de novo */}
      {candidato.hired_at && (
        <div style={{ background: "var(--success-bg)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <Check size={20} style={{ color: "var(--success)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--success)" }}>Contratado</div>
            <div style={{ fontSize: 12, color: "var(--success)", marginTop: 2 }}>
              Convertido em funcionário em {formatDateBR(candidato.hired_at)}.
            </div>
          </div>
        </div>
      )}

      {/* Convert to employee — only when aprovado e ainda não contratado */}
      {canWrite && candidato.stage === "aprovado" && !candidato.hired_at && onHire && (
        <div style={{
          background: "var(--success-bg)",
          border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)",
          borderRadius: 12,
          padding: "14px 16px",
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
              color: "var(--on-success)",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
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
                style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: savingNote ? 0.6 : 1 }}
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
                  {note.created_at ? formatDateBR(note.created_at) : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </>
  );

  const left = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Vaga",    value: vagaTitle },
          { label: "Origem",  value: candidato.source || "—" },
          { label: "Telefone", value: candidato.phone || "—" },
          { label: "Aplicado em", value: formatDateBR(candidato.created_at) },
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

      {candidato.resume_ext && (
        <button
          onClick={async () => {
            const { data, error: err } = await supabase.storage
              .from("rh-curriculos")
              .createSignedUrl(`${candidato.candidateId}/curriculo.${candidato.resume_ext}`, 3600);
            if (!err && data?.signedUrl) window.open(data.signedUrl, "_blank", "noreferrer");
          }}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          Ver currículo ({candidato.resume_ext.toUpperCase()})
        </button>
      )}

      {/* Fit score / justificativa da triagem por IA */}
      {typeof candidato.fit_score === "number" && (
        <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: "#6D28D9" }}>{Math.round(candidato.fit_score)}</span>
            <span style={{ fontSize: 11, color: "#6D28D9", fontWeight: 600 }}>fit score (IA)</span>
          </div>
          {candidato.justificativa && (
            <div style={{ fontSize: 12, color: "#5B21B6", lineHeight: 1.5 }}>{candidato.justificativa}</div>
          )}
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />

      <RHDetailDrawerShell
        domain="candidatos"
        recordId={candidato.id}
        activities={candidato.activities || []}
        onAddActivity={onAddActivity}
        currentUser={currentUser}
        users={users}
        stages={stages}
        formContent={formContent}
        record={{ ...candidato, stageChangedAt: candidato.stage_changed_at }}
        recordTitle={candidato.name}
        domainLabel="Recrutamento"
      />
    </>
  );

  const right = (
    <>
      {/* Stage progression */}
      {canWrite && (
        <div>
          <div style={labelSt}>Mover para</div>
          {moveError && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 11 }}>
              <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              {moveError}
            </div>
          )}
          <StageNavigator
            targets={stages.filter((s) => s.stageKey !== candidato.stage)}
            onMove={requestStageChange}
            getKey={(s) => s.stageKey}
            currentStageKey={candidato.stage}
            allStages={stages}
          />

          {reprovando && (
            <div style={{ marginTop: 10, background: "var(--danger-bg)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)", borderRadius: 10, padding: 12 }}>
              <div style={{ ...labelSt, color: "var(--danger)" }}>Motivo da reprovação *</div>
              <textarea
                value={motivoReprovacao}
                onChange={(e) => setMotivoReprovacao(e.target.value)}
                placeholder="Por que este candidato foi reprovado?"
                rows={2}
                autoFocus
                className="w-full text-sm rounded-lg border px-3 py-2 outline-none resize-none"
                style={{ borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)", color: "var(--text)", background: "var(--surface)", fontSize: 13 }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={confirmReprovacao}
                  disabled={savingStage || !motivoReprovacao.trim()}
                  style={{ background: "var(--danger)", color: "var(--on-danger)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: savingStage || !motivoReprovacao.trim() ? 0.6 : 1 }}
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

      {/* Comentários — sempre visíveis na lateral direita, abaixo da
          movimentação de card (não mais escondidos atrás de uma aba). */}
      <RHDetailComments
        activities={candidato.activities || []}
        onAddActivity={onAddActivity}
        onUpdateActivity={onUpdateActivity ? (activityId, patch) => onUpdateActivity(candidato.id, activityId, patch) : undefined}
        currentUser={currentUser}
        users={users}
        notifyMentions={notifyMentions}
        mentionLink={{ module: "rh_candidatos", id: candidato.id }}
        mentionContextLabel={candidato.name}
      />

      {canWrite && onEditFields && (
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onEditFields(stageInfo); }}
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--text-dim)", textDecoration: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <Settings2 size={12} />
            Editar campos desta etapa
          </a>
        </div>
      )}
    </>
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
      onDelete={canWrite && onDelete ? () => onDelete(candidato.id) : undefined}
      deleteLabel="Excluir candidatura"
    />
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
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
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
            style={{ borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)", color: "var(--text)", background: "var(--surface)", fontSize: 13 }}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleConfirm}
              disabled={saving || !motivo.trim()}
              style={{ background: "var(--danger)", color: "var(--on-danger)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", opacity: saving || !motivo.trim() ? 0.6 : 1 }}
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

// ── Reprovação em massa (Áudio 8) ─────────────────────────────────────────────
// Reprova os candidatos selecionados de uma vez e dispara UM e-mail de retorno
// negativo em cópia oculta pros que têm e-mail. Substitui o "responder um a um
// no WhatsApp".
function BulkReprovarModal({ selectedCandidatos, temEtapaReprovacao, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState("");
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // resultado após confirmar

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const total = selectedCandidatos.length;
  const comEmail = new Set(selectedCandidatos.filter((c) => c.email).map((c) => c.email)).size;
  const semEmail = selectedCandidatos.filter((c) => !c.email).length;

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const res = await onConfirm({ motivo: motivo.trim(), enviarEmail });
      setDone(res || { movidos: total, emails: enviarEmail ? comEmail : 0, semEmail });
    } catch (e) {
      setDone({ erro: e?.message || "Erro ao reprovar." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Reprovar em massa</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div style={{ padding: "24px" }}>
            {done.erro ? (
              <div style={{ fontSize: 14, color: "var(--danger)" }}>{done.erro}</div>
            ) : (
              <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Pronto!</div>
                {done.movidos > 0 && <div>• {done.movidos} candidato(s) movido(s) para reprovado.</div>}
                {enviarEmail && <div>• {done.emailOk ? `${done.emails}` : "0"} e-mail(s) de retorno enviado(s) em cópia oculta.</div>}
                {done.semEmail > 0 && <div style={{ color: "var(--warning)" }}>• {done.semEmail} sem e-mail não receberam retorno.</div>}
                {enviarEmail && !done.emailOk && done.emails === 0 && semEmail < total && (
                  <div style={{ color: "var(--warning)", marginTop: 4 }}>O envio do e-mail pode ter falhado — verifique a configuração de e-mail.</div>
                )}
              </div>
            )}
            <div className="flex mt-4">
              <button onClick={onClose} style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>Fechar</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: "20px 24px 24px" }}>
            <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 14, lineHeight: 1.6 }}>
              Você vai reprovar <strong>{total}</strong> candidato(s).
              {!temEtapaReprovacao && <div style={{ color: "var(--warning)", fontSize: 12, marginTop: 4 }}>Nenhuma etapa de reprovação configurada — os candidatos não serão movidos, só o e-mail será enviado.</div>}
            </div>

            <label className="flex items-center gap-2 mb-3" style={{ cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
              <input type="checkbox" checked={enviarEmail} onChange={(e) => setEnviarEmail(e.target.checked)} style={{ cursor: "pointer" }} />
              Enviar e-mail de retorno negativo (cópia oculta)
            </label>
            {enviarEmail && (
              <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--text-dim)", marginBottom: 14, lineHeight: 1.5 }}>
                {comEmail} candidato(s) receberão o e-mail.
                {semEmail > 0 && <span style={{ color: "var(--warning)" }}> {semEmail} sem e-mail não receberão.</span>}
              </div>
            )}

            <div style={labelSt}>Motivo (interno, opcional)</div>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Registro interno do motivo — não vai no e-mail (que é genérico)."
              rows={2}
              className="w-full text-sm rounded-lg border px-3 py-2 outline-none resize-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", fontSize: 13 }}
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleConfirm}
                disabled={saving || total === 0}
                style={{ background: "var(--danger)", color: "var(--on-danger)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", opacity: saving || total === 0 ? 0.6 : 1 }}
              >
                {saving ? "Processando…" : "Confirmar reprovação"}
              </button>
              <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
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
              background: c.fit_score >= 70 ? "var(--success-bg)" : c.fit_score >= 40 ? "var(--warning-bg)" : "var(--danger-bg)",
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
  onMoveToStage, onDeleteCandidato, onDragStart, onDragEnd, isDragOver, onDragOver, onDragLeave, onDrop, onEditFields,
  getCompleteness, getUnread, boardHeight, getSortCriteria, setSortCriteria,
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="flex flex-col rounded-lg transition-all duration-150"
      style={{
        width: 272, minWidth: 272,
        height: "100%",
        overflow: "hidden",
        borderRight: stage.stageKey !== stages[stages.length - 1]?.stageKey ? "1px solid var(--border)" : "none",
        background: isDragOver ? stage.color + "14" : "var(--surface-alt)",
        boxShadow: isDragOver ? `0 0 0 2px ${stage.color}40` : "none",
      }}
    >
      <KanbanColumnHeader
        color={stage.color}
        name={stage.name}
        count={candidatos.length}
        bandHeight={4}
        letterSpacing="normal"
        nameFontSize={14}
        nameFontWeight={700}
        uppercase={false}
        countFontSize={12}
        actions={
          <div className="flex items-center gap-1 shrink-0">
            <KanbanColumnSortMenu
              criteria={getSortCriteria(stage.stageKey)}
              onChange={(v) => setSortCriteria(stage.stageKey, v)}
              options={["recent", "alpha"]}
              accentColor={stage.color}
            />
            {canWrite && (
              <button
                onClick={onAddCandidato}
                style={{ background: "none", border: "none", cursor: "pointer", color: stage.color, padding: 2, display: "flex" }}
                title="Adicionar candidato"
              >
                <Plus size={14} />
              </button>
            )}
            {canWrite && (
              <button
                onClick={() => onEditFields(stage)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex" }}
                title="Editar campos desta etapa"
              >
                <Settings2 size={12} />
              </button>
            )}
          </div>
        }
      />

      {/* Cards */}
      <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {candidatos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-dim)", fontSize: 11, opacity: 0.5, display: "flex", flexDirection: "column", gap: 2 }}>
            {isDragOver ? <span style={{ opacity: 0.5 }}>Soltar aqui</span> : (
              <>
                <span style={{ opacity: 0.5 }}>Nenhum candidato nesta etapa</span>
                {!stage.terminal && <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>}
              </>
            )}
          </div>
        ) : (
          candidatos.map((c) => (
            <RHKanbanCard
              key={c.id}
              id={c.id}
              stage={c.stage}
              stages={stages}
              onClick={() => onCardClick(c)}
              onDragStart={canWrite ? onDragStart : undefined}
              onDragEnd={canWrite ? onDragEnd : undefined}
              onMoveToStage={canWrite ? onMoveToStage : undefined}
              onDeleteCard={canWrite ? onDeleteCandidato : undefined}
              showMoveOptions={false}
              agingDays={daysSince(c.stage_changed_at)}
              completeness={getCompleteness?.(c)}
              unread={getUnread?.(c)}
            >
              <CandidatoCardBody candidato={c} vagas={vagas} />
            </RHKanbanCard>
          ))
        )}
      </div>
    </div>
  );
}

// ── Candidato Tabela ──────────────────────────────────────────────────────────

function CandidatoTableView({ candidatos, vagas, stages, onRowClick, selectable, selectedIds, onToggleSelect, onToggleAll }) {
  const allSelected = selectable && candidatos.length > 0 && candidatos.every((c) => selectedIds?.has(c.id));
  const baseCols = 6;
  return (
    <>
    <MobileTableCards
      rows={candidatos}
      onRowClick={onRowClick}
      emptyMessage="Nenhum candidato encontrado."
      title={(c) => c.name}
      chips={(c) => {
        const st = findStage(stages, c.stage);
        return [{ label: st.name, color: st.color }];
      }}
      right={(c) => (
        <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <StarRating value={c.rating || 0} />
          {selectable && (
            <input
              type="checkbox"
              checked={selectedIds?.has(c.id) || false}
              onChange={() => onToggleSelect?.(c.id)}
              title={c.email ? `Selecionar ${c.name}` : `${c.name} não tem e-mail`}
              style={{ cursor: "pointer" }}
            />
          )}
        </span>
      )}
      meta={(c) => {
        const vagaTitle = vagas.find((v) => v.id === c.vaga_id)?.title;
        return (
          <>
            <span className="truncate">{[vagaTitle, c.source].filter(Boolean).join(" · ") || "—"}</span>
            {selectable && !c.email && (
              <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--warning-bg)", color: "var(--warning)" }} title="Sem e-mail — não receberá retorno">sem e-mail</span>
            )}
          </>
        );
      }}
      metaRight={(c) => <span>{formatDateBR(c.created_at)}</span>}
    />
    <div className="hidden md:block rounded-2xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {selectable && (
              <th className="px-3 py-2.5" style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll?.(candidatos)}
                  title="Selecionar todos"
                  style={{ cursor: "pointer" }}
                />
              </th>
            )}
            {["Candidato", "Vaga", "Etapa", "Origem", "Aplicado em", "Avaliação"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidatos.length === 0 && (
            <tr><td colSpan={selectable ? baseCols + 1 : baseCols} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhum candidato encontrado.</td></tr>
          )}
          {candidatos.map((c) => {
            const st = findStage(stages, c.stage);
            const vagaTitle = vagas.find((v) => v.id === c.vaga_id)?.title || "—";
            const checked = selectedIds?.has(c.id) || false;
            return (
              <tr key={c.id} onClick={() => onRowClick(c)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: checked ? "var(--surface-alt)" : "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = checked ? "var(--surface-alt)" : "transparent"; }}>
                {selectable && (
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelect?.(c.id)}
                      title={c.email ? `Selecionar ${c.name}` : `${c.name} não tem e-mail`}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <InitialsAvatar name={c.name} size={26} />
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{c.name}</span>
                    {selectable && !c.email && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--warning-bg)", color: "var(--warning)" }} title="Sem e-mail — não receberá retorno">sem e-mail</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{vagaTitle}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.color + "18", color: stageTextColor(st.color), border: `1px solid ${st.color}40` }}>
                    {st.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{c.source || "—"}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{formatDateBR(c.created_at)}</td>
                <td className="px-4 py-3"><StarRating value={c.rating || 0} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

// ── Candidato Calendário ──────────────────────────────────────────────────────
// Agrupa por created_at — data de aplicação, campo de data mais claro por
// candidato (não há data de entrevista rastreada no modelo).

function CandidatoCalendarView({ candidatos, stages, onPillClick }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map();
    for (const c of candidatos) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at.slice ? c.created_at.slice(0, 10) : c.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(c);
    }
    return map;
  }, [candidatos]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const today = new Date();
  const month = cursor.getMonth();

  return (
    <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <ChevronRight size={16} />
          </button>
          <h2 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>
            {MONTHS[month]} <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>{cursor.getFullYear()}</span>
          </h2>
        </div>
        <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
          Hoje
        </button>
      </div>
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
        {WEEKDAYS.map(w => (
          <div key={w} className="px-2 py-2 text-[10px] font-bold text-center" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(88px, auto)" }}>
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isToday = sameDay(d, today);
          const k = dayKey(d);
          const items = byDay.get(k) || [];
          return (
            <div key={i} className="p-1.5 border-r border-b flex flex-col gap-1"
              style={{ borderColor: "var(--border)", background: "var(--surface)", opacity: inMonth ? 1 : 0.4 }}>
              <span className="text-xs font-semibold leading-none" style={isToday
                ? { width: 20, height: 20, borderRadius: "50%", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", color: "var(--on-accent)" }
                : { color: inMonth ? "var(--text)" : "var(--text-dim)" }}>
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((c) => {
                  const st = findStage(stages, c.stage);
                  return (
                    <span key={c.id} onClick={() => onPillClick(c)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
                      style={{ background: st.color + "18", color: stageTextColor(st.color) }}
                      title={c.name}>
                      {c.name}
                    </span>
                  );
                })}
                {items.length > 3 && (
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>+{items.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export function RHRecrutamentoView({ user, canWrite, canTriage, notifyMentions }) {
  const {
    vagas, candidatos, talentPool, aplicacoesRaw, loading,
    createVaga, updateVaga, changeVagaStage, duplicateVaga, deleteVaga, deleteAplicacao, createCandidato, changeStage, bulkReprovarComEmail, bulkMoveStage, updateAplicacao, addNote, changeRating, markHired, attachTriagemToVaga,
  } = useRHRecrutamento({ userId: user?.id });
  const { cargos, createCargo, deleteCargo } = useRHCargoTemplates({ userId: user?.id });
  const { createColaborador } = useRHColaboradores({ userId: user?.id });
  const { templates: onboardingTemplates, applyChecklist } = useRHOnboarding({ userId: user?.id });

  // ── Etapas administráveis (Pipefy-style) + campos customizados por etapa ──
  const { stages: vagaStages, loading: vagaStagesLoading } = useRHPipelineStages("vagas");
  const { stages: candStages, loading: candStagesLoading } = useRHPipelineStages("candidatos");
  const vagaStageFields = useRHStageFields("vagas");
  const candStageFields = useRHStageFields("candidatos");
  // Dois boards nesta tela (Vagas e Candidatos) — cada um com seu próprio
  // mapa de critério por etapa (chaves de localStorage separadas).
  const { getCriteria: getVagaSortCriteria, setCriteria: setVagaSortCriteria } = useKanbanColumnSort("rh-recrutamento-vagas");
  const { getCriteria: getCandSortCriteria, setCriteria: setCandSortCriteria } = useKanbanColumnSort("rh-recrutamento-candidatos");
  const { users: profileUsers } = useProfiles();

  const [viewMode, setViewMode]             = useState("vagas"); // "vagas" | "candidatos"
  const [boardMode, setBoardMode]           = useState("kanban"); // "kanban" | "table" | "calendar" | "analytics" — ortogonal ao viewMode acima
  const [frenteFilter, setFrenteFilter]     = useState("todas"); // "todas" | RH_FRENTES[number]
  const [selectedVaga, setSelectedVaga]     = useState("todas");
  const [selectedCandidatoId, setSelectedCandidatoId] = useState(null);
  const [quickAddVaga, setQuickAddVaga]     = useState(false);
  const [addVagaStage, setAddVagaStage]     = useState(null);
  const [editingVaga, setEditingVaga]       = useState(null);
  const [vagaDrawerId, setVagaDrawerId]     = useState(null);
  const [vagaMoveError, setVagaMoveError]   = useState(null);
  const [candMoveError, setCandMoveError]   = useState(null);
  const [cargosManagerOpen, setCargosManagerOpen] = useState(false);
  const [addCandidatoStage, setAddCandidatoStage] = useState(null);
  const [triagemOpen, setTriagemOpen]       = useState(false);
  const [hiringCandidato, setHiringCandidato] = useState(null);
  // O board (boardRef) fica escondido atrás do "Carregando…" enquanto
  // loading/vagaStagesLoading/candStagesLoading são true (ver render mais
  // abaixo) — nesse primeiro efeito, `el` é null e o hook sai cedo (não
  // arma ResizeObserver nem listener de resize nenhum). viewMode/boardMode
  // não mudam quando o carregamento termina, então sem essas 3 flags aqui
  // o efeito nunca re-executava depois que o board finalmente montava, e
  // `boardHeight` ficava travado no fallback (480) pelo resto da sessão —
  // board sempre mais baixo que o espaço disponível (achado ao vivo, este
  // era exatamente o gap reportado). Mesma lógica documentada no próprio
  // hook ("loading terminando" como exemplo de dep).
  const [boardRef, boardHeight] = useAvailableHeight(16, [viewMode, boardMode, loading, vagaStagesLoading, candStagesLoading]);

  const { viewedAt: vagaViewedAt, markViewed: markVagaViewed } = useRecordViews("rh_vagas", user?.id);
  const { viewedAt: candViewedAt, markViewed: markCandViewed } = useRecordViews("rh_candidatos", user?.id);
  useEffect(() => { if (vagaDrawerId) markVagaViewed(vagaDrawerId); }, [vagaDrawerId]);
  useEffect(() => { if (selectedCandidatoId) markCandViewed(selectedCandidatoId); }, [selectedCandidatoId]);

  // "Ver candidato" (AgentActionsView, sugestão do agente de Sourcing) navega
  // pra cá e abre o candidato já focado — mesmo padrão de handoff via
  // sessionStorage já usado por rhFornecedoresOpenId (RHFornecedoresView).
  useEffect(() => {
    try {
      const id = sessionStorage.getItem("rhRecrutamentoOpenCandidatoId");
      if (id) {
        sessionStorage.removeItem("rhRecrutamentoOpenCandidatoId");
        setViewMode("candidatos");
        setSelectedCandidatoId(id);
      }
    } catch { /* sessionStorage indisponível — segue sem handoff */ }
  }, []);

  // ── Reprovação em massa (Áudio 8): seleção múltipla na tabela de candidatos ──
  const [selectedCandIds, setSelectedCandIds] = useState(() => new Set());
  const [bulkReprovarOpen, setBulkReprovarOpen] = useState(false);

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

  useEffect(() => {
    setVagaMoveError(null);
  }, [vagaDrawerId]);

  const selectedCandidato = useMemo(
    () => candidatos.find((c) => c.id === selectedCandidatoId) || null,
    [candidatos, selectedCandidatoId]
  );
  const vagaEmDrawer = useMemo(() => vagas.find((v) => v.id === vagaDrawerId) || null, [vagas, vagaDrawerId]);

  // ── Reprovação em massa: seleção + etapa de reprovação resolvida ──
  // A etapa de reprovação é a marcada como "lost" no editor (não hardcode).
  const lostCandStage = useMemo(() => candStages.find((s) => s.lost) || null, [candStages]);
  const toggleCandSelect = (id) => setSelectedCandIds((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleCandSelectAll = (list) => setSelectedCandIds((prev) => {
    const allSel = list.length > 0 && list.every((c) => prev.has(c.id));
    return allSel ? new Set() : new Set(list.map((c) => c.id));
  });
  // Limpa a seleção quando sai da tabela de candidatos (evita agir sobre
  // ids que não estão mais visíveis).
  useEffect(() => {
    if (viewMode !== "candidatos" || boardMode !== "table") setSelectedCandIds(new Set());
  }, [viewMode, boardMode, selectedVaga, frenteFilter]);
  const vagaDoCandidatoContratando = useMemo(
    () => (hiringCandidato ? vagas.find((v) => v.id === hiringCandidato.vaga_id) : null),
    [hiringCandidato, vagas]
  );

  // ── Contratação: candidato aprovado → funcionário → onboarding ─────────────
  const handleSaveHired = async (form) => {
    const vaga = vagaDoCandidatoContratando;
    const novo = await createColaborador({ ...form, vagaId: vaga?.id || null });
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
    if (vaga?.id) {
      await changeVagaStage(vaga.id, "encerrada");
    }
    // Marca a aplicação como contratada — dá sinal durável de "já contratado"
    // e trava a 2ª conversão (antes o candidato ficava em "Aprovado" com o CTA
    // "Converter" ativo, gerando cadastro/onboarding em dobro). Achado da auditoria.
    if (hiringCandidato?.id) {
      await markHired(hiringCandidato.id).catch((e) => console.error("markHired falhou:", e));
    }
    return novo;
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCreateVaga = async (data) => { await createVaga(data); };
  const handleDuplicateVaga = async (id) => {
    const source = vagas.find((v) => v.id === id);
    if (!source) return;
    const firstStage = vagaStages.find((s) => !s.terminal) || vagaStages[0];
    await duplicateVaga(source, firstStage?.stageKey);
  };
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
    // Campo obrigatório trava AVANÇAR, não VOLTAR (ver isStageRegression).
    const goingBack = isStageRegression(vagaStages, vaga.stage, newStage);
    const fields = vagaStageFields.getFields(vaga.stage);
    const missing = goingBack ? [] : getMissingRequiredFields(fields, vaga.custom_fields || {});
    if (missing.length > 0) {
      setVagaMoveError(`Não dá pra mover "${vaga.title}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return false;
    }
    const invalid = goingBack ? [] : getInvalidFields(fields, vaga.custom_fields || {});
    if (invalid.length > 0) {
      setVagaMoveError(`Não dá pra mover "${vaga.title}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return false;
    }
    setVagaMoveError(null);
    changeVagaStage(id, newStage).catch((e) => {
      setVagaMoveError(e?.message || `Não foi possível mover "${vaga.title}" — tente novamente.`);
    });
    return true;
  };
  const handleVagaStageChange = (id, newStage) => {
    // Fecha o drawer agora (sinal visual de que moveu) e reabre já na etapa
    // nova — em vez de só trocar o conteúdo por baixo do drawer aberto.
    if (attemptVagaStageChange(id, newStage)) {
      setVagaDrawerId(null);
      reopenAfterMove(setVagaDrawerId, id);
    }
  };
  // Badge "X/Y campos obrigatórios" no card (auditoria 10.3).
  const getVagaCompleteness = (vaga) =>
    getFieldCompleteness(vagaStageFields.getFields(vaga.stage), vaga.custom_fields || {});
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
    // Campo obrigatório trava AVANÇAR, não VOLTAR (ver isStageRegression).
    const goingBackCand = isStageRegression(candStages, candidato.stage, newStage);
    const fields = candStageFields.getFields(candidato.stage);
    const missing = goingBackCand ? [] : getMissingRequiredFields(fields, candidato.customFields || {});
    if (missing.length > 0) {
      setCandMoveError(`Não dá pra mover "${candidato.name}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = goingBackCand ? [] : getInvalidFields(fields, candidato.customFields || {});
    if (invalid.length > 0) {
      setCandMoveError(`Não dá pra mover "${candidato.name}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    setCandMoveError(null);
    const targetStage = candStages.find((s) => s.stageKey === newStage);
    if (targetStage?.lost) {
      setPendingReprovacaoDrop({ aplicacaoId: id, stageKey: newStage, stageName: targetStage.name });
      return;
    }
    changeStage(id, newStage).catch((e) => {
      setCandMoveError(e?.message || `Não foi possível mover "${candidato.name}" — tente novamente.`);
    });
  };
  // Bulk "Mover para…" com a MESMA validação do movimento individual
  // (attemptCandStageChange acima): quem tem campo obrigatório vazio ou
  // inválido na etapa atual NÃO move e é reportado no toast; os limpos
  // movem. Os barrados continuam selecionados pra facilitar a correção.
  const handleBulkMoveStage = async (stageKey) => {
    const cleared = [];
    const blocked = [];
    for (const id of selectedCandIds) {
      const candidato = candidatos.find((c) => c.id === id);
      if (!candidato || candidato.stage === stageKey) continue;
      const fields = candStageFields.getFields(candidato.stage);
      const hasPendencia =
        getMissingRequiredFields(fields, candidato.customFields || {}).length > 0 ||
        getInvalidFields(fields, candidato.customFields || {}).length > 0;
      if (hasPendencia) blocked.push(candidato);
      else cleared.push(id);
    }
    if (cleared.length > 0) await bulkMoveStage({ aplicacaoIds: cleared, stageKey });
    if (blocked.length > 0) {
      setCandMoveError(`${cleared.length} movido(s), ${blocked.length} com campos pendentes: ${blocked.map((c) => c.name).join(", ")}.`);
      setSelectedCandIds(new Set(blocked.map((c) => c.id)));
    } else {
      setCandMoveError(null);
      setSelectedCandIds(new Set());
    }
  };
  // Badge "X/Y campos obrigatórios" no card (auditoria 10.3).
  const getCandCompleteness = (candidato) =>
    getFieldCompleteness(candStageFields.getFields(candidato.stage), candidato.customFields || {});
  const handleCandDrop = (stageKey) => {
    const id = draggedAplicacaoId;
    setDraggedAplicacaoId(null);
    setDragOverCandStage(null);
    if (!id) return;
    attemptCandStageChange(id, stageKey);
  };
  const confirmReprovacaoDrop = async (motivo) => {
    if (!pendingReprovacaoDrop) return;
    try {
      await changeStage(pendingReprovacaoDrop.aplicacaoId, pendingReprovacaoDrop.stageKey, motivo);
    } catch (e) {
      setCandMoveError(e?.message || "Não foi possível reprovar — tente novamente.");
      return;
    }
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
  const handleVagaUpdateActivity = async (vagaId, activityId, patch) => {
    const vaga = vagas.find((v) => v.id === vagaId);
    const activities = (vaga?.activities || []).map((a) => (a.id === activityId ? { ...a, ...patch } : a));
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
  const handleAplicacaoUpdateActivity = async (aplicacaoId, activityId, patch) => {
    const candidato = candidatos.find((c) => c.id === aplicacaoId);
    const activities = (candidato?.activities || []).map((a) => (a.id === activityId ? { ...a, ...patch } : a));
    await updateAplicacao(aplicacaoId, { activities });
  };

  const activeVaga = vagas.find((v) => v.id === selectedVaga) || null;

  // ── Filtro de frente (R12: talent pool/vagas por padrão pode ser filtrado
  //    por frente, com opção explícita "Todas as frentes") ──────────────────
  const vagasFrenteFiltradas = useMemo(() => {
    if (frenteFilter === "todas") return vagas;
    return vagas.filter((v) => (v.company_ids || []).includes(frenteFilter));
  }, [vagas, frenteFilter]);
  const vagaIdsFrenteFiltradas = useMemo(() => new Set(vagasFrenteFiltradas.map((v) => v.id)), [vagasFrenteFiltradas]);

  // ── Filtered candidatos ────────────────────────────────────────────────────
  const filteredCandidatos = useMemo(() => {
    let list = candidatos;
    if (frenteFilter !== "todas") list = list.filter((c) => vagaIdsFrenteFiltradas.has(c.vaga_id));
    if (selectedVaga === "todas") return list;
    return list.filter((c) => c.vaga_id === selectedVaga);
  }, [candidatos, selectedVaga, frenteFilter, vagaIdsFrenteFiltradas]);

  const candByStage = useMemo(() => {
    const map = {};
    candStages.forEach((s) => {
      const list = filteredCandidatos.filter((c) => c.stage === s.stageKey);
      map[s.stageKey] = sortKanbanItems(list, getCandSortCriteria(s.stageKey), {
        name: c => c.name,
        createdAt: c => c.created_at,
      });
    });
    return map;
  }, [filteredCandidatos, candStages, getCandSortCriteria]);

  const candidatosByVaga = useMemo(() => {
    const map = {};
    candidatos.forEach((c) => { map[c.vaga_id] = (map[c.vaga_id] || 0) + 1; });
    return map;
  }, [candidatos]);

  // Responsáveis por vaga (FASE 5) — resolução de ids pra AvatarStack/AssigneeMultiSelect.
  const usersById = useMemo(() => new Map((profileUsers || []).map(u => [u.id, u])), [profileUsers]);

  const vagasByStage = useMemo(() => {
    const map = {};
    vagaStages.forEach((s) => {
      const list = vagasFrenteFiltradas.filter((v) => (v.stage || "rascunho") === s.stageKey);
      map[s.stageKey] = sortKanbanItems(list, getVagaSortCriteria(s.stageKey), {
        deadline: v => v.hiring_deadline,
        priority: v => v.priority,
        name: v => v.name,
        createdAt: v => v.created_at,
      });
    });
    return map;
  }, [vagasFrenteFiltradas, vagaStages, getVagaSortCriteria]);

  const analyticsVagaStages = useMemo(
    () => vagaStages.filter((s) => !s.terminal).map((s) => ({ key: s.stageKey, name: s.name, color: s.color, slaDays: s.slaDays })),
    [vagaStages]
  );
  const analyticsCandStages = useMemo(
    () => candStages.filter((s) => !s.terminal).map((s) => ({ key: s.stageKey, name: s.name, color: s.color, slaDays: s.slaDays })),
    [candStages]
  );

  // Tempo médio de vaga aberta / faixa salarial: só entre as vagas ainda
  // abertas (não-terminais) — vagas encerradas não têm mais "runway" nem
  // representam a faixa salarial atualmente ofertada.
  //
  // Time-to-Fill / Time-to-Hire (estudo de mercado sobre aceleração de R&S,
  // mockup aprovado com o Daniel): métricas distintas, não uma só —
  // Time-to-Fill mede o atraso organizacional (vaga aprovada → aceite,
  // via rh_vagas.approved_at, carimbado automaticamente quando a vaga sai
  // do Rascunho); Time-to-Hire mede só o funil de seleção em si (candidato
  // entra → aceite). Considera todo hired_at dentro das vagas visíveis no
  // filtro atual, não só as abertas.
  const vagaSpecificStats = useMemo(() => {
    const open = vagasFrenteFiltradas.filter((v) => !vagaStages.find((s) => s.stageKey === v.stage)?.terminal);
    const withDeadline = open.filter((v) => v.hiring_deadline);
    const avgDaysToDeadline = withDeadline.length > 0
      ? Math.round(withDeadline.reduce((sum, v) => sum + (new Date(v.hiring_deadline).getTime() - Date.now()) / 86400000, 0) / withDeadline.length)
      : null;
    const withSalary = open.filter((v) => v.salary_min != null || v.salary_max != null);
    const avgMin = withSalary.length > 0 ? withSalary.reduce((s, v) => s + (Number(v.salary_min) || 0), 0) / withSalary.length : null;
    const avgMax = withSalary.length > 0 ? withSalary.reduce((s, v) => s + (Number(v.salary_max) || 0), 0) / withSalary.length : null;

    const fillDays = [];
    const hireDays = [];
    for (const c of candidatos) {
      if (!c.hired_at || !c.vaga_id) continue;
      const vaga = vagasFrenteFiltradas.find((v) => v.id === c.vaga_id);
      if (!vaga) continue;
      if (vaga.approved_at) fillDays.push(Math.round((new Date(c.hired_at) - new Date(vaga.approved_at)) / 86400000));
      if (c.created_at) hireDays.push(Math.round((new Date(c.hired_at) - new Date(c.created_at)) / 86400000));
    }
    const avg = (arr) => (arr.length > 0 ? Math.round(arr.reduce((s, d) => s + d, 0) / arr.length) : null);
    const avgFill = avg(fillDays);
    const avgHire = avg(hireDays);

    return [
      {
        label: "Prazo médio p/ contratação",
        value: avgDaysToDeadline !== null ? `${avgDaysToDeadline}d` : "—",
        color: avgDaysToDeadline !== null && avgDaysToDeadline < 0 ? "var(--danger)" : undefined,
      },
      { label: "Faixa salarial média", value: withSalary.length > 0 ? fmtSalaryRange(avgMin, avgMax) : "—" },
      { label: "Time-to-Fill médio", value: avgFill !== null ? `${avgFill}d` : "—" },
      { label: "Time-to-Hire médio", value: avgHire !== null ? `${avgHire}d` : "—" },
    ];
  }, [vagasFrenteFiltradas, vagaStages, candidatos]);

  // Funil de conversão: % de candidatos que já chegaram a cada etapa
  // não-terminal ou além (orderIdx da etapa atual >= orderIdx da etapa do
  // funil) — sem histórico de transições, "chegou em" é aproximado pela
  // posição corrente; candidatos numa etapa "lost" (reprovado) não contam
  // como tendo avançado além do ponto em que saíram.
  const candSpecificStats = useMemo(() => {
    const total = filteredCandidatos.length;
    if (total === 0 || candStages.length === 0) return [];
    const orderByKey = new Map(candStages.map((s) => [s.stageKey, s.orderIdx]));
    const nonTerminal = candStages.filter((s) => !s.terminal);
    return nonTerminal.map((stage) => {
      const reached = filteredCandidatos.filter((c) => {
        const cs = candStages.find((s) => s.stageKey === c.stage);
        if (!cs || cs.lost) return false;
        return (orderByKey.get(c.stage) ?? -1) >= stage.orderIdx;
      }).length;
      const rate = Math.round((reached / total) * 100);
      return { label: `Chegou em ${stage.name}`, value: `${rate}%` };
    });
  }, [filteredCandidatos, candStages]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {candMoveError && (
        <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => setCandMoveError(null)}>
          {candMoveError}
        </AppToast>
      )}
      {/* Header */}
      <KanbanBoardHeader>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Briefcase size={22} style={{ color: "var(--text)" }} />
              <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
                Recrutamento
              </h1>
            </div>
            {/* Troca de modo primária (Vagas/Candidatos) — perto do título, já que é
                o que decide o que a tela inteira mostra; Kanban/Tabela/Calendário
                à direita são só a forma de exibir o modo já escolhido. */}
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
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            {viewMode === "vagas"
              ? `${vagasFrenteFiltradas.length} vaga${vagasFrenteFiltradas.length !== 1 ? "s" : ""}`
              : `${filteredCandidatos.length} candidato${filteredCandidatos.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={frenteFilter}
            onChange={(e) => setFrenteFilter(e.target.value)}
            className="text-xs rounded-xl border px-3 py-1.5 outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
          >
            <option value="todas">Todas as frentes</option>
            {RH_FRENTES.map((id) => (
              <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>
            ))}
          </select>
          {/* Toggle Kanban / Tabela / Calendário — como exibir o modo (Vagas/
              Candidatos) já escolhido no título, não o quê exibir. */}
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
            <ViewToggleButton active={boardMode === "kanban"}   onClick={() => setBoardMode("kanban")}   icon={LayoutGrid}   label="Kanban" iconOnlyMobile />
            <ViewToggleButton active={boardMode === "table"}    onClick={() => setBoardMode("table")}    icon={List}         label="Tabela" iconOnlyMobile />
            <ViewToggleButton active={boardMode === "calendar"} onClick={() => setBoardMode("calendar")} icon={CalendarIcon} label="Calendário" iconOnlyMobile />
            <ViewToggleButton active={boardMode === "analytics"} onClick={() => setBoardMode("analytics")} icon={TrendingUp} label="Análise" iconOnlyMobile />
          </div>

          <button
            onClick={() => {
              if (viewMode === "vagas") {
                exportVagasToCSV(vagasFrenteFiltradas, { stages: vagaStages });
              } else {
                const vagasById = new Map(vagas.map((v) => [v.id, v]));
                exportCandidatosToCSV(filteredCandidatos, { vagasById, stages: candStages });
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
            title={viewMode === "vagas" ? "Exportar vagas filtradas como CSV" : "Exportar candidatos filtrados como CSV"}
          >
            <Download size={13} /> <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          {canWrite && (
            <button
              onClick={() => setStageEditorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
            >
              <Pencil size={13} /> Editar etapas
            </button>
          )}
          {canWrite && viewMode === "vagas" && (
            <button
              onClick={() => setQuickAddVaga(true)}
              className="flex items-center gap-1.5 font-semibold"
              style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "6px 16px", fontSize: 13, border: "none", cursor: "pointer" }}
            >
              <Plus size={14} /> Nova vaga
            </button>
          )}
          {canTriage && viewMode === "candidatos" && (
            <button
              onClick={() => setTriagemOpen(true)}
              style={{ background: "#7C3AED", color: "#FFF", borderRadius: 10, padding: "6px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Sparkles size={14} /> Triar com IA
            </button>
          )}
        </div>
      </div>
      </KanbanBoardHeader>

      {!isSupabaseConfigured ? (
        <EmptyState icon={Briefcase} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar o módulo de recrutamento" />
      ) : loading || (viewMode === "vagas" ? vagaStagesLoading : candStagesLoading) ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : viewMode === "vagas" ? (
        <>
        {/* ═══ VAGAS ═══ */}
        {boardMode === "table" ? (
          <VagaTableView
            vagas={vagasFrenteFiltradas}
            stages={vagaStages}
            candidatosByVaga={candidatosByVaga}
            onRowClick={(v) => setVagaDrawerId(v.id)}
          />
        ) : boardMode === "calendar" ? (
          <VagaCalendarView
            vagas={vagasFrenteFiltradas}
            stages={vagaStages}
            onPillClick={(v) => setVagaDrawerId(v.id)}
          />
        ) : boardMode === "analytics" ? (
          <KanbanAnalyticsPanel
            stages={analyticsVagaStages}
            records={vagasFrenteFiltradas}
            getStageKey={(v) => v.stage}
            getStageEnteredAt={(v) => v.stage_changed_at}
            specificStats={vagaSpecificStats}
            getOwnerIds={(v) => v.responsible_ids || []}
            usersById={usersById}
          />
        ) : (
          <>
            <RHMobileKanbanAccordion
              stages={vagaStages}
              itemsByStage={vagasByStage}
              getSortCriteria={getVagaSortCriteria}
              setSortCriteria={setVagaSortCriteria}
              sortOptions={["recent", "deadline", "priority", "alpha"]}
              renderCard={(v) => (
                <RHKanbanCard
                  key={v.id}
                  id={v.id}
                  stage={v.stage}
                  stages={vagaStages}
                  onClick={() => setVagaDrawerId(v.id)}
                  onDragStart={canWrite ? handleVagaDragStart : undefined}
                  onDragEnd={canWrite ? handleVagaDragEnd : undefined}
                  onMoveToStage={canWrite ? attemptVagaStageChange : undefined}
                  onDeleteCard={canWrite ? (id) => deleteVaga(id) : undefined}
                  onDuplicateCard={canWrite ? handleDuplicateVaga : undefined}
                  agingDays={daysSince(v.stage_changed_at)}
                  completeness={getVagaCompleteness?.(v)}
                  unread={hasUnreadRHComment(v, vagaViewedAt, user?.id)}
                >
                  <VagaCard vaga={v} candidatosCount={candidatosByVaga[v.id] || 0} usersById={usersById} />
                </RHKanbanCard>
              )}
              onAdd={canWrite ? (stageKey) => setAddVagaStage(stageKey) : undefined}
              addLabel="Nova vaga"
              emptyLabel="Nenhuma vaga"
            />
            <div className="hidden lg:block">
              <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
                <div className="flex gap-2 h-full" style={{ minWidth: `${vagaStages.length * 280}px` }}>
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
                      onDeleteVaga={(id) => deleteVaga(id)}
                      onDuplicateVaga={canWrite ? handleDuplicateVaga : undefined}
                      onDragStart={handleVagaDragStart}
                      onDragEnd={handleVagaDragEnd}
                      isDragOver={dragOverVagaStage === stage.stageKey}
                      onDragOver={(e) => handleVagaDragOver(e, stage.stageKey)}
                      onDragLeave={handleVagaDragLeave}
                      onDrop={() => handleVagaDrop(stage.stageKey)}
                      onEditFields={(s) => setFieldEditorStage({ domain: "vagas", stageKey: s.stageKey, stageName: s.name })}
                      getCompleteness={getVagaCompleteness}
                      getUnread={(v) => hasUnreadRHComment(v, vagaViewedAt, user?.id)}
                      onAddVaga={() => setAddVagaStage(stage.stageKey)}
                      usersById={usersById}
                      boardHeight={boardHeight}
                      getSortCriteria={getVagaSortCriteria}
                      setSortCriteria={setVagaSortCriteria}
                    />
                  ))}
                </div>
              </KanbanBoardScrollArea>
            </div>
          </>
        )}
        {canWrite && <KanbanFab label="Nova vaga" onClick={() => setQuickAddVaga(true)} />}
        </>
      ) : (
        /* ═══ Kanban de CANDIDATOS (existente) ═══ */
        <>
          {/* Banco de talentos (Onda 2, item 5): link/QR público de candidatura
              espontânea — sempre disponível, independente de vaga aberta. */}
          {canWrite && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)" }}>Banco de talentos:</span>
              <CopyPublicLinkButton url={`${window.location.origin}/trabalhe-conosco`} title="Copiar link de candidatura espontânea" />
              <QRCodeButton url={`${window.location.origin}/trabalhe-conosco`} title="Trabalhe conosco" buttonLabel="QR code" />
            </div>
          )}

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
              <CopyPublicLinkButton url={`${window.location.origin}/vagas/${activeVaga.link_slug}`} label="Copiar link da vaga" />
              <a
                href={whatsappShareUrl(activeVaga)}
                target="_blank"
                rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--success-bg)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--success)", textDecoration: "none" }}
              >
                <MessageSquare size={12} /> Compartilhar no WhatsApp
              </a>
              <QRCodeButton url={`${window.location.origin}/vagas/${activeVaga.link_slug}`} title={activeVaga.title} buttonLabel="QR code" />
            </div>
          )}

          {activeVaga && activeVaga.stage !== "publicada" && (
            <div style={{ background: "var(--warning-bg)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "var(--warning)" }}>
              Essa vaga está em <strong>{findStage(vagaStages, activeVaga.stage).name}</strong> — mova para "Publicada" na aba Vagas pra liberar o link de candidatura.
            </div>
          )}

          {boardMode === "table" ? (
            <>
              {canWrite && selectedCandIds.size > 0 && (
                <div
                  className="flex items-center justify-between gap-3 flex-wrap mb-3 rounded-xl border"
                  style={{ background: "var(--surface)", borderColor: "var(--accent)", padding: "10px 14px", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="text-sm" style={{ color: "var(--text)" }}>
                    <strong>{selectedCandIds.size}</strong> candidato(s) selecionado(s)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedCandIds(new Set())}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer"
                      style={{ background: "var(--surface)", color: "var(--text-dim)", borderColor: "var(--border)" }}
                    >
                      Limpar
                    </button>
                    <select
                      value=""
                      onChange={async (e) => {
                        const stageKey = e.target.value;
                        if (!stageKey) return;
                        await handleBulkMoveStage(stageKey);
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer"
                      style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                      title="Mover os selecionados para uma etapa"
                    >
                      <option value="">Mover para…</option>
                      {candStages.filter((s) => !s.lost).map((s) => (
                        <option key={s.stageKey} value={s.stageKey}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setBulkReprovarOpen(true)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5"
                      style={{ background: "var(--danger)", color: "var(--on-danger)", border: "none" }}
                    >
                      <Mail size={13} /> Reprovar e enviar retorno
                    </button>
                  </div>
                </div>
              )}
              <CandidatoTableView
                candidatos={filteredCandidatos}
                vagas={vagas}
                stages={candStages}
                onRowClick={(c) => setSelectedCandidatoId(c.id)}
                selectable={canWrite}
                selectedIds={selectedCandIds}
                onToggleSelect={toggleCandSelect}
                onToggleAll={toggleCandSelectAll}
              />
            </>
          ) : boardMode === "calendar" ? (
            <CandidatoCalendarView
              candidatos={filteredCandidatos}
              stages={candStages}
              onPillClick={(c) => setSelectedCandidatoId(c.id)}
            />
          ) : boardMode === "analytics" ? (
            <KanbanAnalyticsPanel
              stages={analyticsCandStages}
              records={filteredCandidatos}
              getStageKey={(c) => c.stage}
              getStageEnteredAt={(c) => c.stage_changed_at}
              specificStats={candSpecificStats}
              getOwnerIds={(c) => c.responsible_ids || []}
              usersById={usersById}
            />
          ) : (
            <>
              <RHMobileKanbanAccordion
                stages={candStages}
                itemsByStage={candByStage}
                getSortCriteria={getCandSortCriteria}
                setSortCriteria={setCandSortCriteria}
                sortOptions={["recent", "alpha"]}
                renderCard={(c) => (
                  <RHKanbanCard
                    key={c.id}
                    id={c.id}
                    stage={c.stage}
                    stages={candStages}
                    onClick={() => setSelectedCandidatoId(c.id)}
                    onDragStart={canWrite ? handleCandDragStart : undefined}
                    onDragEnd={canWrite ? handleCandDragEnd : undefined}
                    onMoveToStage={canWrite ? attemptCandStageChange : undefined}
                    onDeleteCard={canWrite ? (id) => deleteAplicacao(id) : undefined}
                    agingDays={daysSince(c.stage_changed_at)}
                    completeness={getCandCompleteness?.(c)}
                    unread={hasUnreadRHComment(c, candViewedAt, user?.id)}
                  >
                    <CandidatoCardBody candidato={c} vagas={vagas} />
                  </RHKanbanCard>
                )}
                onAdd={canWrite ? (stageKey) => setAddCandidatoStage(stageKey) : undefined}
                addLabel="Novo candidato"
                emptyLabel="Nenhum candidato"
              />
              <div className="hidden lg:block">
                <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
                  <div className="flex gap-2 h-full" style={{ minWidth: `${candStages.length * 280}px` }}>
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
                        onDeleteCandidato={(id) => deleteAplicacao(id)}
                        onDragStart={handleCandDragStart}
                        onDragEnd={handleCandDragEnd}
                        isDragOver={dragOverCandStage === stage.stageKey}
                        onDragOver={(e) => handleCandDragOver(e, stage.stageKey)}
                        onDragLeave={handleCandDragLeave}
                        onDrop={() => handleCandDrop(stage.stageKey)}
                        onEditFields={(s) => setFieldEditorStage({ domain: "candidatos", stageKey: s.stageKey, stageName: s.name })}
                        getCompleteness={getCandCompleteness}
                        getUnread={(c) => hasUnreadRHComment(c, candViewedAt, user?.id)}
                        boardHeight={boardHeight}
                        getSortCriteria={getCandSortCriteria}
                        setSortCriteria={setCandSortCriteria}
                      />
                    ))}
                  </div>
                </KanbanBoardScrollArea>
              </div>
            </>
          )}
          {canWrite && <KanbanFab label="Novo candidato" onClick={() => setAddCandidatoStage(candStages[0]?.stageKey || null)} />}
        </>
      )}

      {/* Modals */}
      {quickAddVaga && (
        <NovaVagaModal
          cargos={cargos}
          onSave={handleCreateVaga}
          onManageCargos={() => setCargosManagerOpen(true)}
          onClose={() => setQuickAddVaga(false)}
          users={profileUsers}
          userId={user?.id}
        />
      )}

      {addVagaStage && (
        <NovaVagaModal
          cargos={cargos}
          stageId={addVagaStage}
          onSave={handleCreateVaga}
          onManageCargos={() => setCargosManagerOpen(true)}
          onClose={() => setAddVagaStage(null)}
          users={profileUsers}
          userId={user?.id}
        />
      )}

      {editingVaga && (
        <NovaVagaModal
          cargos={cargos}
          initialData={editingVaga}
          onSave={handleUpdateVaga}
          onManageCargos={() => setCargosManagerOpen(true)}
          onClose={() => setEditingVaga(null)}
          users={profileUsers}
          userId={user?.id}
        />
      )}

      {cargosManagerOpen && (
        <GerenciarCargosModal
          cargos={cargos}
          onCreate={createCargo}
          onDelete={deleteCargo}
          onClose={() => setCargosManagerOpen(false)}
          userId={user?.id}
        />
      )}

      {vagaEmDrawer && (
        <VagaDrawer
          vaga={vagaEmDrawer}
          candidatosCount={candidatosByVaga[vagaEmDrawer.id] || 0}
          canWrite={canWrite}
          stages={vagaStages}
          onStageChange={handleVagaStageChange}
          moveError={vagaMoveError}
          onEdit={(v) => { setEditingVaga(v); setVagaDrawerId(null); }}
          onVerCandidatos={handleVerCandidatos}
          onClose={() => setVagaDrawerId(null)}
          customFields={vagaStageFields.getFields(vagaEmDrawer.stage)}
          onCustomFieldChange={(fieldKey, value) => handleVagaCustomFieldChange(vagaEmDrawer.id, fieldKey, value)}
          onAddActivity={(entry) => handleVagaAddActivity(vagaEmDrawer.id, entry)}
          onUpdateActivity={handleVagaUpdateActivity}
          currentUser={user}
          users={profileUsers}
          notifyMentions={notifyMentions}
          onUpdateResponsibles={(ids) => updateVaga(vagaEmDrawer.id, { responsible_ids: ids })}
          onDelete={deleteVaga}
          onEditFields={(s) => setFieldEditorStage({ domain: "vagas", stageKey: s.stageKey, stageName: s.name })}
        />
      )}

      {addCandidatoStage && (
        <NovoCandidatoModal
          defaultStage={addCandidatoStage}
          defaultVagaId={selectedVaga !== "todas" ? selectedVaga : ""}
          vagas={vagas}
          stages={candStages}
          onSave={handleCreateCandidato}
          onClose={() => setAddCandidatoStage(null)}
          users={profileUsers}
        />
      )}

      {selectedCandidato && (
        <CandidatoDrawer
          candidato={selectedCandidato}
          vagas={vagas}
          stages={candStages}
          canWrite={canWrite}
          onStageChange={handleStageChange}
          onStageMoved={(id) => reopenAfterMove(setSelectedCandidatoId, id)}
          onAddNote={handleAddNote}
          onRatingChange={handleRatingChange}
          onClose={() => setSelectedCandidatoId(null)}
          onHire={(c) => setHiringCandidato(c)}
          customFields={candStageFields.getFields(selectedCandidato.stage)}
          onCustomFieldChange={(fieldKey, value) => handleAplicacaoCustomFieldChange(selectedCandidato.id, fieldKey, value)}
          onAddActivity={(entry) => handleAplicacaoAddActivity(selectedCandidato.id, entry)}
          onUpdateActivity={handleAplicacaoUpdateActivity}
          currentUser={user}
          users={profileUsers}
          notifyMentions={notifyMentions}
          onDelete={deleteAplicacao}
          onEditFields={(s) => setFieldEditorStage({ domain: "candidatos", stageKey: s.stageKey, stageName: s.name })}
        />
      )}

      {stageEditorOpen && (
        <RHStageListManager
          open={stageEditorOpen}
          onClose={() => setStageEditorOpen(false)}
          domain={viewMode}
          domainLabel={viewMode === "vagas" ? "Vagas" : "Candidatos"}
          records={viewMode === "vagas" ? vagas : candidatos}
          stageField="stage"
        />
      )}

      {fieldEditorStage && (
        <RHStageFieldsPanel
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

      {bulkReprovarOpen && (
        <BulkReprovarModal
          selectedCandidatos={candidatos.filter((c) => selectedCandIds.has(c.id))}
          temEtapaReprovacao={Boolean(lostCandStage)}
          onConfirm={async ({ motivo, enviarEmail }) => {
            const res = await bulkReprovarComEmail({
              aplicacaoIds: [...selectedCandIds],
              lostStageKey: lostCandStage?.stageKey,
              motivo,
              enviarEmail,
            });
            setSelectedCandIds(new Set());
            return res;
          }}
          onClose={() => setBulkReprovarOpen(false)}
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
