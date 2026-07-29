import React from "react";
import { CalendarClock } from "lucide-react";
import { RecordAIPanel } from "../shared/RecordAIPanel";
import {
  briefingPrompt, emailDraftPrompt, nextStepPrompt, objectionPrompt, scorePrompt,
  genericCardSummaryPrompt,
} from "../../constants/ai-prompts";

const TONES = [
  { value: "profissional", label: "Profissional" },
  { value: "amigável",     label: "Amigável" },
  { value: "direto",       label: "Direto" },
];

function ToneSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium" style={{ color: "var(--text-dim)" }}>Tom:</span>
      {TONES.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className="text-xs px-2.5 py-1 rounded-full border transition-all duration-150"
          style={{
            background: value === t.value ? "var(--text)" : "var(--surface)",
            color: value === t.value ? "#FFFFFF" : "var(--text)",
            borderColor: value === t.value ? "var(--text)" : "var(--border)",
            cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ObjectionInput({ value, onChange }) {
  return (
    <textarea
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder="Descreva a objeção do cliente..."
      rows={3}
      className="w-full text-sm rounded-lg border px-3 py-2 resize-none outline-none transition-colors"
      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "inherit" }}
    />
  );
}

export function LeadAIPanel({
  lead, currentUser, activities, linkedEmails, onUpdate, onAddActivity,
  stageName, slaDays, stageFieldValues = [],
}) {
  const daysInStage = lead.stageChangedAt
    ? Math.floor((Date.now() - new Date(lead.stageChangedAt)) / 86400000)
    : 0;

  const recentComments = (activities || []).slice(-5).map(a => a.body).filter(Boolean);

  const features = [
    {
      id: "summary",
      label: "Resumo & Próximo passo",
      buildMessages: () => genericCardSummaryPrompt({
        title: lead.company,
        domainLabel: "Funil de Vendas",
        // Nome legível da etapa, não a chave crua ("Negociação", não
        // "negociacao") — e o SLA, que é o que destrava o bloco "Risco ou
        // bloqueio" do prompt genérico.
        stageName: stageName || lead.stage,
        slaDays,
        daysInStage,
        customFields: stageFieldValues,
        recentComments,
      }),
    },
    {
      id: "score",
      label: "Calcular Fit Score",
      resultType: "score",
      buildMessages: () => scorePrompt(lead, activities),
      onScoreApply: (score) => onUpdate?.(lead.id, { fitScore: score }),
    },
    {
      id: "briefing",
      label: "Briefing de reunião",
      buildMessages: () => briefingPrompt(lead, activities, linkedEmails),
    },
    {
      id: "email",
      label: "Rascunho de e-mail IA",
      initialExtra: "profissional",
      renderExtra: (value, setValue) => <ToneSelector value={value} onChange={setValue} />,
      buildMessages: (tone) => emailDraftPrompt(lead, tone),
    },
    {
      id: "nextstep",
      label: "Próximo passo",
      buildMessages: () => nextStepPrompt(lead, activities),
      actions: onUpdate ? [{
        id: "schedule-followup",
        label: "Agendar follow-up p/ amanhã",
        doneLabel: "Follow-up agendado",
        icon: CalendarClock,
        onRun: () => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          onUpdate(lead.id, { nextFollowUp: tomorrow.toISOString().slice(0, 10) });
        },
      }] : undefined,
    },
    {
      id: "objection",
      label: "Análise de objeção",
      initialExtra: "",
      renderExtra: (value, setValue) => <ObjectionInput value={value} onChange={setValue} />,
      validateExtra: (value) => (!value || !value.trim()) ? "Digite a objeção antes de gerar." : null,
      buildMessages: (objectionText) => objectionPrompt(lead, objectionText),
    },
  ];

  const onSaveNote = onAddActivity
    ? (text, featureLabel) => onAddActivity(lead.id, {
        type: "note",
        userId: currentUser?.id || null,
        userName: currentUser?.name || null,
        body: `[${featureLabel}] ${text}`,
      })
    : undefined;

  return (
    <RecordAIPanel
      currentUser={currentUser}
      features={features}
      defaultFeatureId="summary"
      onSaveNote={onSaveNote}
    />
  );
}
