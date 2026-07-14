import React, { useMemo, useState } from "react";
import { X, ChevronDown, Check } from "lucide-react";

// Seletor de múltiplos responsáveis (FASE 5) — substitui o <select> de
// responsável único em todo drawer que agora aceita mais de uma pessoa.
// `value` é um array de ids; `options` é a lista de usuários elegíveis
// (já filtrada pelo chamador, ex. via getMentionableUsers ou um filtro de
// role próprio do módulo). Renderiza os selecionados como chips com "x"
// pra remover, e um dropdown de checkbox pra adicionar mais.
export function AssigneeMultiSelect({ value = [], onChange, options = [], placeholder = "Selecionar responsáveis…", disabled = false }) {
  const [open, setOpen] = useState(false);

  const selectedUsers = useMemo(
    () => value.map(id => options.find(u => u.id === id)).filter(Boolean),
    [value, options]
  );

  const toggle = (id) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  const remove = (id) => {
    if (disabled) return;
    onChange(value.filter(v => v !== id));
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => !disabled && setOpen(v => !v)}
        className="flex items-center flex-wrap gap-1.5 rounded-lg border px-2 py-1.5"
        style={{ borderColor: "var(--border)", background: "var(--surface)", cursor: disabled ? "default" : "pointer", minHeight: 34 }}
      >
        {selectedUsers.length === 0 ? (
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>{placeholder}</span>
        ) : (
          selectedUsers.map(u => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: "var(--surface-alt)", color: "var(--text)" }}
            >
              <span
                className="flex items-center justify-center rounded-full font-bold shrink-0"
                style={{ width: 15, height: 15, fontSize: 8, background: u.avatarBg || "#1D4ED8", color: "#FFF" }}
              >
                {u.initials || u.name?.slice(0, 2)?.toUpperCase() || "?"}
              </span>
              {u.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(u.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex" }}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))
        )}
        {!disabled && <ChevronDown size={13} style={{ color: "var(--text-dim)", marginLeft: "auto" }} />}
      </div>

      {open && !disabled && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 20 }} onClick={() => setOpen(false)} />
          <div
            className="rounded-lg border overflow-hidden"
            style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-pop)", zIndex: 21, maxHeight: 220, overflowY: "auto" }}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--text-dim)" }}>Nenhum usuário disponível.</div>
            ) : (
              options.map(u => {
                const checked = value.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer"
                    style={{ background: checked ? "var(--surface-alt)" : "none", border: "none" }}
                    onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--surface-alt)"; }}
                    onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "none"; }}
                  >
                    <span
                      className="flex items-center justify-center rounded-full font-bold shrink-0"
                      style={{ width: 18, height: 18, fontSize: 9, background: u.avatarBg || "#1D4ED8", color: "#FFF" }}
                    >
                      {u.initials || u.name?.slice(0, 2)?.toUpperCase() || "?"}
                    </span>
                    <span className="text-xs font-medium flex-1" style={{ color: "var(--text)" }}>{u.name}</span>
                    {checked && <Check size={13} style={{ color: "var(--accent)" }} />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AssigneeMultiSelect;
