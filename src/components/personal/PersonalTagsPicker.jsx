import React, { useState } from "react";
import { Plus } from "lucide-react";
import { EntityMultiSelect } from "../shared/EntityMultiSelect";

// Decisão B do mockup "Lista Pessoal — ajustes pedidos": etiqueta deixa de
// ser texto livre e vira escolha num catálogo fixo (EntityMultiSelect, já
// compartilhado). "+ nova etiqueta" fica fora do dropdown de propósito — o
// EntityMultiSelect em si não sabe criar opção nova, e mexer nele pra isso
// afetaria os outros consumidores dele.
export function PersonalTagsPicker({ value = [], onChange, tagsHook }) {
  const { options, addTag } = tagsHook;
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

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
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
        >
          <Plus size={11} /> Nova etiqueta
        </button>
      )}
    </div>
  );
}

export default PersonalTagsPicker;
