import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, X, ChevronDown, ChevronUp, Info, AlertTriangle, Mail, Zap, ShieldCheck, Briefcase } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAutomations } from "../../hooks/use-automations";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { ROUTES } from "../../constants/routes";
import { friendlyAiErrorMessage } from "../../utils/ai-errors";

// Assistente guiado de 6 passos pra criar/editar um Agente de IA (Agent
// Builder, PRD docs/prd-agent-builder.md seção 3). Fase 1: piloto
// Fornecedores RH. Fase 2 (29/07/2026): piloto Vaga parada — Recrutamento,
// mesmo assistente, 2º conjunto de dados escolhível no passo 1.
// Totalmente separado do AutomationBuilder técnico (AutomationsView.jsx):
// aquele continua servindo só automações comuns, sem ramificar pra IA.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const STEPS = [
  "O que observar",
  "Quando agir",
  "O que preparar",
  "Quem aprova",
  "Testar",
  "Nome",
];

const DRAFT_TYPES = [
  { id: "email_fornecedor", label: "E-mail pro fornecedor" },
  { id: "aviso_interno",    label: "Aviso interno pro time" },
];

const TONES = [
  { id: "formal",  label: "Formal" },
  { id: "direto",  label: "Direto" },
  { id: "cordial", label: "Cordial" },
];

const SUGGESTED_ACTIONS = [
  { id: "iniciar_renovacao", label: "Iniciar renovação" },
  { id: "buscar_cotacao",    label: "Buscar cotação alternativa" },
  { id: "so_monitorar",      label: "Só monitorar" },
];

const VAGA_SUGGESTED_ACTIONS = [
  { id: "reabrir_divulgacao", label: "Reabrir divulgação" },
  { id: "escalar_gestor",     label: "Escalar pro gestor" },
  { id: "revisar_requisitos", label: "Revisar requisitos" },
  { id: "so_monitorar",       label: "Só monitorar" },
];

const DATASET_DEFAULT_DAYS = { fornecedores: 15, vagas: 7 };

function suggestedName(dataset, draftType) {
  if (dataset === "vagas") return "Vaga parada — Recrutamento";
  return draftType === "email_fornecedor"
    ? "Aviso de renovação — Fornecedores RH"
    : "Aviso interno — Fornecedores RH";
}

const labelSt = { fontSize: 12, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 6 };
const inputCls = "w-full text-sm rounded-xl border px-3.5 py-2.5 outline-none";
const inputSt = { borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" };

function DatasetCard({ active, icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border px-4 py-3.5 flex items-start gap-3"
      style={{ borderColor: active ? "var(--accent)" : "var(--border)", background: active ? "var(--accent-tint)" : "var(--surface-alt)", cursor: "pointer" }}
    >
      {icon}
      <div>
        <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</div>
        <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{description}</p>
      </div>
    </button>
  );
}

export function AgentBuilderWizard({ currentUser, initialRule = null, onClose, onSaved }) {
  const { addAutomation, updateAutomation } = useAutomations({ userId: currentUser?.id });
  const navigate = useNavigate();
  useEscToClose(onClose);

  const [step, setStep] = useState(0);

  const initialThen = initialRule?.thenActions?.[0] || {};
  const initialCondition = initialRule?.conditionGroups?.[0]?.conditions?.[0];

  const [dataset, setDataset] = useState(initialRule?.module === "rh-vagas" ? "vagas" : "fornecedores");
  const [days, setDays] = useState(initialRule?.trigger?.days ?? DATASET_DEFAULT_DAYS[dataset]);
  const [showAdvanced, setShowAdvanced] = useState(Boolean(initialCondition));
  const [tipoOptions, setTipoOptions] = useState([]);
  const [tipoFilter, setTipoFilter] = useState(initialCondition?.value ?? "");
  const [draftType, setDraftType] = useState(initialThen.draftType || "email_fornecedor");
  const [tone, setTone] = useState(initialThen.tone || "cordial");
  const [customInstruction, setCustomInstruction] = useState(initialThen.customInstruction || "");
  const [followUpDays, setFollowUpDays] = useState(initialThen.followUpDays ?? 5);
  const [suggestedAction, setSuggestedAction] = useState(initialThen.suggestedAction || "iniciar_renovacao");
  const [name, setName] = useState(initialRule?.name || suggestedName(dataset, initialThen.draftType || "email_fornecedor"));
  const [nameEdited, setNameEdited] = useState(Boolean(initialRule?.name));

  const [previewLoading, setPreviewLoading] = useState(false);
  // attempted: pelo menos uma chamada de preview terminou (sucesso ou erro);
  // blocked: erro genuíno (rede/500/502) — impede ativar; missingKey: erro
  // 400 de chave de IA ausente — NÃO bloqueia (PRD: "deixa terminar e ativar
  // mesmo assim"), só mostra o aviso com link pra Configurações.
  const [preview, setPreview] = useState({ attempted: false, blocked: false, missingKey: false, result: null, error: null });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!nameEdited) setName(suggestedName(dataset, draftType));
  }, [dataset, draftType, nameEdited]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const table = dataset === "vagas" ? "rh_vagas" : "rh_fornecedores";
    const column = dataset === "vagas" ? "department" : "tipo";
    supabase.from(table).select(column).then(({ data, error }) => {
      if (error || !active) return;
      const unique = Array.from(new Set((data || []).map(r => r[column]).filter(Boolean)));
      setTipoOptions(unique);
    });
    return () => { active = false; };
  }, [dataset]);

  const selectDataset = (next) => {
    setDataset(next);
    setTipoFilter("");
    if (!initialRule) setDays(DATASET_DEFAULT_DAYS[next]);
  };

  const trigger = dataset === "vagas"
    ? { type: "stage_stale", field: "stage_changed_at", days: Number(days) || 0 }
    : { type: "date_approaching", field: "vigencia_fim", days: Number(days) || 0 };
  const conditionGroups = tipoFilter
    ? [{ logic: "AND", conditions: [{ field: dataset === "vagas" ? "department" : "tipo", operator: "eq", value: tipoFilter }] }]
    : [];
  const thenActions = dataset === "vagas"
    ? [{
        type: "suggest_with_ai",
        draftType: "aviso_interno_vaga",
        tone,
        customInstruction: customInstruction.trim(),
        suggestedAction,
      }]
    : [{
        type: "suggest_with_ai",
        draftType,
        tone,
        customInstruction: customInstruction.trim(),
        followUpDays: draftType === "email_fornecedor" ? (Number(followUpDays) || 5) : undefined,
        suggestedAction: draftType === "aviso_interno" ? suggestedAction : undefined,
      }];

  const canNext = () => {
    if (step === 1) return Number(days) > 0;
    if (step === 2) return dataset === "vagas" ? Boolean(tone) : Boolean(draftType) && Boolean(tone);
    return true;
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const session = isSupabaseConfigured ? (await supabase.auth.getSession()).data.session : null;
      const token = session?.access_token;
      const module = dataset === "vagas" ? "rh-vagas" : "rh-fornecedores";
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-runner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "preview", rule: { module, trigger, conditionGroups, thenActions } }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const missingKey = res.status === 400;
        setPreview({ attempted: true, blocked: !missingKey, missingKey, result: null, error: body.error || `HTTP ${res.status}` });
      } else {
        setPreview({ attempted: true, blocked: false, missingKey: false, result: body, error: null });
      }
    } catch (e) {
      setPreview({ attempted: true, blocked: true, missingKey: false, result: null, error: e.message || "Erro de rede ao gerar preview." });
    } finally {
      setPreviewLoading(false);
    }
  };

  const canActivate = preview.attempted && !preview.blocked;

  const handleSave = async () => {
    if (!canActivate) return;
    setSaving(true);
    setSaveError(null);
    try {
      const rule = {
        name: name.trim() || suggestedName(dataset, draftType),
        companyId: "all",
        module: dataset === "vagas" ? "rh-vagas" : "rh-fornecedores",
        enabled: true,
        trigger,
        conditionGroups,
        thenActions,
        elseActions: [],
        pausedReason: preview.missingKey ? preview.error : null,
      };
      if (initialRule) await updateAutomation(initialRule.id, rule);
      else await addAutomation(rule);
      onSaved?.(rule);
      onClose();
    } catch (e) {
      setSaveError(e.message || "Erro ao salvar o agente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--overlay-scrim)" }}
    >
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl flex flex-col"
        style={{ background: "var(--surface)", maxHeight: "90vh" }}
      >
        {/* Modal header */}
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--surface-alt)" }}>
          <div className="flex items-center gap-2">
            <Bot size={18} style={{ color: "var(--accent)" }} />
            <span className="font-bold text-sm" style={{ color: "var(--text)" }}>
              {initialRule ? "Editar agente de IA" : "Novo agente de IA"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 flex items-center gap-0 flex-wrap">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <button
                onClick={() => i < step && setStep(i)}
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{
                  color: i === step ? "var(--accent)" : i < step ? "var(--text-dim)" : "var(--border-strong)",
                  cursor: i < step ? "pointer" : "default",
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: i === step ? "var(--accent)" : i < step ? "var(--border)" : "var(--surface-alt)",
                    color: i === step ? "#FFFFFF" : i < step ? "var(--text-dim)" : "var(--border-strong)",
                  }}
                >
                  {i + 1}
                </span>
                {s}
              </button>
              {i < STEPS.length - 1 && (
                <span className="mx-2 text-xs" style={{ color: "var(--border)" }}>›</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 0 && (
            <div className="space-y-2.5">
              <DatasetCard
                active={dataset === "fornecedores"}
                icon={<Bot size={16} style={{ color: "var(--accent)", marginTop: 1 }} />}
                title="Contratos de fornecedores (RH)"
                description="O assistente monitora os contratos cadastrados em Fornecedores (RH) e a data de vencimento de cada um."
                onClick={() => !initialRule && selectDataset("fornecedores")}
              />
              <DatasetCard
                active={dataset === "vagas"}
                icon={<Briefcase size={16} style={{ color: "var(--accent)", marginTop: 1 }} />}
                title="Vaga parada (Recrutamento)"
                description="O assistente monitora as vagas publicadas ou em triagem e quanto tempo cada uma está sem avançar de etapa."
                onClick={() => !initialRule && selectDataset("vagas")}
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label style={labelSt}>
                  {dataset === "vagas"
                    ? "Avisar quando a vaga estiver parada há quantos dias?"
                    : "Avisar quantos dias antes do contrato vencer?"}
                </label>
                <input
                  type="number"
                  min="1"
                  value={days}
                  onChange={e => setDays(e.target.value)}
                  className={inputCls}
                  style={inputSt}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
              >
                {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Adicionar filtro avançado
              </button>
              {showAdvanced && (
                <div>
                  <label style={labelSt}>{dataset === "vagas" ? "Departamento" : "Tipo de fornecedor"}</label>
                  <select
                    value={tipoFilter}
                    onChange={e => setTipoFilter(e.target.value)}
                    className={inputCls}
                    style={inputSt}
                  >
                    <option value="">{dataset === "vagas" ? "Qualquer departamento" : "Qualquer tipo"}</option>
                    {tipoOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {step === 2 && dataset === "vagas" && (
            <div className="space-y-3">
              <div>
                <label style={labelSt}>Tom</label>
                <select value={tone} onChange={e => setTone(e.target.value)} className={inputCls} style={inputSt}>
                  {TONES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Ação sugerida</label>
                <select value={suggestedAction} onChange={e => setSuggestedAction(e.target.value)} className={inputCls} style={inputSt}>
                  {VAGA_SUGGESTED_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Algo específico que a IA deve sempre mencionar (opcional)</label>
                <input
                  type="text"
                  value={customInstruction}
                  onChange={e => setCustomInstruction(e.target.value)}
                  placeholder="Ex: sempre pedir posição sobre o prazo de contratação"
                  className={inputCls}
                  style={inputSt}
                />
              </div>
            </div>
          )}

          {step === 2 && dataset === "fornecedores" && (
            <div className="space-y-3">
              <div>
                <label style={labelSt}>Tipo de rascunho</label>
                <select value={draftType} onChange={e => setDraftType(e.target.value)} className={inputCls} style={inputSt}>
                  {DRAFT_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
              {draftType === "email_fornecedor" && (
                <div
                  className="rounded-xl border px-3.5 py-3 flex items-start gap-2.5"
                  style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
                >
                  <Info size={13} style={{ color: "var(--text-dim)", marginTop: 1 }} className="shrink-0" />
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                    O e-mail vai usar o contato cadastrado em Fornecedores (nome, e-mail e telefone) —
                    quem aprovar a sugestão vê pra quem vai antes de confirmar.
                  </p>
                </div>
              )}
              <div>
                <label style={labelSt}>Tom</label>
                <select value={tone} onChange={e => setTone(e.target.value)} className={inputCls} style={inputSt}>
                  {TONES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              {draftType === "email_fornecedor" && (
                <div>
                  <label style={labelSt}>Pedir confirmação em até quantos dias?</label>
                  <input
                    type="number"
                    min="1"
                    value={followUpDays}
                    onChange={e => setFollowUpDays(e.target.value)}
                    className={inputCls}
                    style={inputSt}
                  />
                </div>
              )}
              {draftType === "aviso_interno" && (
                <div>
                  <label style={labelSt}>Ação sugerida</label>
                  <select value={suggestedAction} onChange={e => setSuggestedAction(e.target.value)} className={inputCls} style={inputSt}>
                    {SUGGESTED_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={labelSt}>Algo específico que a IA deve sempre mencionar (opcional)</label>
                <input
                  type="text"
                  value={customInstruction}
                  onChange={e => setCustomInstruction(e.target.value)}
                  placeholder="Ex: sempre pedir confirmação por escrito"
                  className={inputCls}
                  style={inputSt}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div
              className="rounded-xl border px-4 py-3.5 flex items-start gap-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
            >
              <ShieldCheck size={16} style={{ color: "var(--accent)", marginTop: 1 }} />
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                {dataset === "vagas"
                  ? "Qualquer gerente de RH vê e aprova esta sugestão antes do aviso chegar ao gestor da vaga (quando houver um link de triagem gerado pra ela)."
                  : "Qualquer gerente de RH vê e aprova esta sugestão antes de qualquer coisa sair da plataforma."}
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <button
                onClick={handlePreview}
                disabled={previewLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--accent)", color: "#FFFFFF", opacity: previewLoading ? 0.6 : 1 }}
              >
                <Zap size={13} />
                {previewLoading ? "Gerando preview…" : "Gerar preview"}
              </button>

              {preview.result?.usandoExemplo && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
                >
                  <Info size={12} className="shrink-0" />
                  {dataset === "vagas"
                    ? "Nenhuma vaga parada disponível ainda — mostrando um exemplo."
                    : "Nenhum contrato real disponível ainda — mostrando um exemplo."}
                </div>
              )}

              {preview.result && (
                <div className="rounded-xl border p-3.5 space-y-2" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
                  {preview.result.fornecedorNome && (
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                      Fornecedor: <b style={{ color: "var(--text)" }}>{preview.result.fornecedorNome}</b>
                      {preview.result.diasParaVencer != null && ` · vence em ${preview.result.diasParaVencer} dia(s)`}
                    </div>
                  )}
                  {preview.result.vagaTitulo && (
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                      Vaga: <b style={{ color: "var(--text)" }}>{preview.result.vagaTitulo}</b>
                      {preview.result.diasParado != null && ` · parada há ${preview.result.diasParado} dia(s)`}
                    </div>
                  )}
                  {preview.result.isEmail ? (
                    <>
                      {preview.result.subject && (
                        <div className="flex items-center gap-2 text-xs">
                          <Mail size={12} style={{ color: "var(--accent)" }} />
                          <span className="font-semibold" style={{ color: "var(--text)" }}>{preview.result.subject}</span>
                        </div>
                      )}
                      {preview.result.draftEmail && (
                        <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text)" }}>
                          {preview.result.draftEmail}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {preview.result.title && (
                        <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>{preview.result.title}</div>
                      )}
                      {preview.result.recommendedAction && (
                        <p className="text-xs" style={{ color: "var(--text)" }}>{preview.result.recommendedAction}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {preview.attempted && preview.missingKey && (
                <div
                  className="rounded-xl px-3.5 py-3 text-xs space-y-1.5"
                  style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle size={13} />
                    Nenhuma chave de IA configurada
                  </div>
                  <p>
                    {preview.error} — o agente pode ser ativado mesmo assim; ele fica pausado até uma chave
                    ser configurada.
                  </p>
                  <button
                    onClick={() => navigate(ROUTES.settings)}
                    className="font-semibold underline"
                    style={{ background: "none", border: "none", color: "var(--warning)", cursor: "pointer", padding: 0 }}
                  >
                    Ir para Configurações → Integrações de IA
                  </button>
                </div>
              )}

              {preview.attempted && preview.blocked && (
                <div
                  className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-xs"
                  style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
                >
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  {friendlyAiErrorMessage(preview.error)}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-2">
              <label style={labelSt}>Nome do agente</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setNameEdited(true); }}
                className={inputCls}
                style={inputSt}
              />
              {!canActivate && (
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                  Volte ao passo "Testar" e gere um preview antes de ativar.
                </p>
              )}
              {saveError && (
                <p className="text-xs" style={{ color: "var(--danger)" }}>{saveError}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--surface-alt)" }}>
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="px-4 py-2 rounded-xl text-sm border font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            {step === 0 ? "Cancelar" : "Voltar"}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: canNext() ? "var(--accent)" : "var(--border)",
                color: canNext() ? "#FFFFFF" : "var(--text-faint)",
              }}
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!canActivate || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: canActivate ? "var(--accent)" : "var(--border)",
                color: canActivate ? "#FFFFFF" : "var(--text-faint)",
                opacity: saving ? 0.7 : 1,
              }}
            >
              <Bot size={13} />
              {saving ? "Salvando…" : initialRule ? "Salvar alterações" : "Ativar agente"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentBuilderWizard;
