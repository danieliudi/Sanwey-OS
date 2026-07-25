import React, { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { ZONE_LABELS } from "../../constants/visao-geral-widgets";

// Rótulo de seção do modal — mesmo CSS do `Eyebrow` (PanelHeading.jsx), sem
// o componente inteiro (aqui não tem ação "ver mais" ao lado).
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

// Mesmo recipe visual de `ToggleRow`, hoje local em `SettingsView.jsx:65-87`
// — 2ª ocorrência, não reescreve um 2º estilo de linha de toggle.
function ToggleRow({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer">
      <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 cursor-pointer"
        style={{ accentColor: "var(--text)" }}
      />
    </label>
  );
}

// Modal de Personalizar — 1 botão no header da página, cobrindo as 3 zonas
// de uma vez (docs/design-spec-visao-geral-grau3-zonas.md §4.3). Mudanças só
// persistem ao clicar "Salvar" — sem confirmação otimista por checkbox.
export function WidgetPrefsModal({ open, onClose, title, widgets, toggles, zone4Title, onSave }) {
  const [localToggles, setLocalToggles] = useState(toggles || {});
  const [localTitle, setLocalTitle] = useState(zone4Title || "");

  useEffect(() => {
    if (open) {
      setLocalToggles(toggles || {});
      setLocalTitle(zone4Title || "");
    }
  }, [open, toggles, zone4Title]);

  if (!open) return null;

  const zones = [1, 2, 3].filter(z => widgets.some(w => w.zone === z));

  const toggle = (id) => setLocalToggles(t => ({ ...t, [id]: t[id] === false ? true : false }));

  const handleSave = () => {
    onSave({ widgets: localToggles, zone4Title: localTitle });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title} width={560}>
      <div className="px-6 py-4">
        {zones.map(zone => (
          <div key={zone} style={{ marginTop: zone === zones[0] ? 0 : 18 }}>
            <SectionLabel>{ZONE_LABELS[zone]}</SectionLabel>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {widgets.filter(w => w.zone === zone).map(w => (
                <ToggleRow
                  key={w.id}
                  label={w.label}
                  checked={localToggles[w.id] !== false}
                  onChange={() => toggle(w.id)}
                />
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 18 }}>
          <SectionLabel>Seção livre</SectionLabel>
          <input
            type="text"
            value={localTitle}
            onChange={e => setLocalTitle(e.target.value)}
            placeholder="Nome da seção (opcional)"
            style={{
              width: "100%", border: "1px solid var(--border)", padding: "8px 10px",
              borderRadius: 8, fontSize: 13, color: "var(--text)", background: "var(--surface)",
            }}
          />
        </div>
      </div>
      <div
        className="flex items-center justify-end gap-2 px-6 py-4 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" onClick={handleSave}>Salvar</Button>
      </div>
    </Modal>
  );
}

export default WidgetPrefsModal;
