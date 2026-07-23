import React, { useMemo, useState } from "react";
import { COMPANIES } from "../../../constants/companies";
import { useAutomations } from "../../../hooks/use-automations";
import { CARD_PREVIEW_FIELD_CATALOG, MAX_CARD_PREVIEW_FIELDS } from "../../../constants/pipelines";
import { StageFieldsPanel } from "./StageFieldsPanel";

// Wrapper CRM do StageFieldsPanel — escopa por empresa (accent/badge),
// conta automações vinculadas e liga o preview de card do Kanban.

// Automação "toca" uma etapa se ela dispara a partir dela, chega nela via
// stage_change, mede tempo parado nela, cobra campo pendente nela, ou move
// um card pra ela como ação (then/else).
function automationTouchesStage(rule, stageKey) {
  const t = rule.trigger || {};
  if (t.fromStage === stageKey || t.toStage === stageKey || t.stageId === stageKey) return true;
  const actions = [...(rule.thenActions || []), ...(rule.elseActions || [])];
  return actions.some(a => a.type === "move_stage" && a.targetStage === stageKey);
}

export function CRMStageFieldsPanel({ open, onClose, stage, companyId, stageFields, onUpdateStage }) {
  const { automations } = useAutomations();
  const [previewBusy, setPreviewBusy] = useState(false);

  const automationCount = useMemo(() => {
    if (!open || !stage) return 0;
    return automations.filter(r =>
      r.module === "crm" &&
      (r.companyId === companyId || r.companyId === "all") &&
      automationTouchesStage(r, stage.id)
    ).length;
  }, [automations, open, stage, companyId]);

  if (!open || !stage) return null;

  const company = COMPANIES[companyId];
  const accent  = company?.primary || "var(--text)";
  const fields  = stageFields.getFields(companyId, stage.id);

  const previewFields = Array.isArray(stage.cardPreviewFields) ? stage.cardPreviewFields : [];
  const handleTogglePreviewField = async (key) => {
    if (!onUpdateStage || previewBusy) return;
    const next = previewFields.includes(key)
      ? previewFields.filter(k => k !== key)
      : previewFields.length >= MAX_CARD_PREVIEW_FIELDS ? previewFields : [...previewFields, key];
    if (next === previewFields) return;
    setPreviewBusy(true);
    try {
      await onUpdateStage(companyId, stage.id, { cardPreviewFields: next.length ? next : null });
    } finally {
      setPreviewBusy(false);
    }
  };

  return (
    <StageFieldsPanel
      open={open}
      onClose={onClose}
      stage={stage}
      fields={fields}
      accent={accent}
      showProbability
      headerBadge={company ? (
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded shrink-0"
          style={{ background: accent + "18", color: accent, border: `1px solid ${accent}30` }}
        >
          {company.short}
        </span>
      ) : null}
      automationCount={automationCount}
      cardPreview={onUpdateStage ? {
        selected: previewFields,
        catalog: CARD_PREVIEW_FIELD_CATALOG,
        max: MAX_CARD_PREVIEW_FIELDS,
        onToggle: handleTogglePreviewField,
        busy: previewBusy,
      } : null}
      onSaveStage={onUpdateStage ? (patch) => onUpdateStage(companyId, stage.id, patch) : null}
      onAddField={(payload) => stageFields.addField({ companyId, stageId: stage.id, ...payload })}
      onUpdateField={(id, merged) => stageFields.updateField(id, merged)}
      onDeleteField={(id) => stageFields.deleteField(id)}
      onReorderFields={(ids) => stageFields.reorderFields(companyId, stage.id, ids)}
      onRefetch={() => stageFields.refetch()}
    />
  );
}

export default CRMStageFieldsPanel;
