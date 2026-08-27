import React, { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { EntityMultiSelect } from "../shared/EntityMultiSelect";
import { TASK_TYPE_TAGS } from "../../constants/personal-tasks";

// Decisão B do mockup "Lista Pessoal — ajustes pedidos": etiqueta deixa de
// ser texto livre e vira escolha num catálogo fixo (EntityMultiSelect, já
// compartilhado). "+ nova etiqueta" fica fora do dropdown de propósito — o
// EntityMultiSelect em si não sabe criar opção nova, e mexer nele pra isso
// afetaria os outros consumidores dele.
//
// "+ Tipos sugeridos" (27/08/2026, mockup "Etiquetas que puxam campos"): o
// catálogo padrão só é semeado na PRIMEIRA vez que o usuário abre um catálogo
// vazio (ver use-personal-task-tags.js) — quem já tem catálogo próprio nunca
// receberia os tipos novos. Este botão fecha esse buraco: aparece só enquanto
// falta algum tipo, e acrescenta apenas os que faltam, sem tocar no que já
// existe nem reordenar nada.
export function PersonalTagsPicker({ value = [], onChange, tagsHook }) {
  const { options, addTag } = tagsHook;
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [seeding, setSeeding] = useState(false);

  const existing = new Set(options.map(o => o.label.toLowerCase()));
  const missingTypes = TASK_TYPE_TAGS.filter(t => !existing.has(t.toLowerCase()));

  const handleSeedTypes = async () => {
    setSeeding(true);
    try {
      // Sequencial de propósito: addTag faz insert + setState a cada chamada,
      // e disparar tudo em paralelo faria as atualizações de estado
      // competirem entre si (a última sobrescreveria as anteriores).
      for (const label of missingTypes) await addTag(label);
    } finally {
      setSeeding(false);
    }
  };

  const handleCreate = async () => {
    const label = newLabel.trim();
    setNewLabel("");
    setAdding(false);
    if (!label) return;
    const created = await addTag(label);
    if (created) onChange([...value, created.label]);
  };

  return (
    <div>
      <EntityMultiSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Selecionar etiquetas…"
        emptyLabel="Nenhuma etiqueta no catálogo ainda."
      />
      {adding ? (
        <input
          autoFocus
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onBlur={handleCreate}
          onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setNewLabel(""); setAdding(false); } }}
          placeholder="Nome da nova etiqueta…"
          style={{ marginTop: 6, width: "100%", fontSize: 12, borderRadius: 6, border: "1px solid var(--accent)", padding: "5px 8px", background: "var(--surface)", color: "var(--text)", outline: "none" }}
        />
      ) : (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <Plus size={11} /> Nova etiqueta
          </button>
          {missingTypes.length > 0 && (
            <button
              type="button"
              onClick={handleSeedTypes}
              disabled={seeding}
              title={`Adiciona ao seu catálogo: ${missingTypes.join(", ")}. Etiquetas de tipo podem puxar campos próprios no formulário da etapa.`}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-dim)", background: "none", border: "none", cursor: seeding ? "default" : "pointer", padding: 0, opacity: seeding ? 0.6 : 1 }}
              onMouseEnter={e => { if (!seeding) e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
            >
              <Sparkles size={11} /> {seeding ? "Adicionando…" : `Tipos sugeridos (${missingTypes.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default PersonalTagsPicker;
