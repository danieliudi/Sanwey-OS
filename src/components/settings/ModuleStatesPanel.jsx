import React, { useState } from "react";
import { FlaskConical, Eye, EyeOff } from "lucide-react";
import { MODULE_GROUPS } from "../../utils/module-access";
import { useModuleStates } from "../../hooks/use-module-states";
import { AppToast } from "../shared/AppToast";

// Configurações → Módulos. Liga e desliga páginas inteiras pra empresa toda.
//
// Não confundir com "Acesso por módulo" (Configurações → Usuários), que é POR
// PESSOA. Os dois se combinam por E: esta chave decide se a página está
// disponível; o cargo/exceção decide quem vê. Liberar aqui NÃO dá acesso a
// ninguém que já não teria.

const STATES = [
  { id: "off",  label: "Desligada", Icon: EyeOff,       hint: "Ninguém vê, nem admin." },
  { id: "test", label: "Em testes", Icon: FlaskConical, hint: "Só admin e quem estiver marcado como exceção em Usuários." },
  { id: "live", label: "Liberada",  Icon: Eye,          hint: "Vale a regra de cargo de sempre." },
];

const TONE = {
  off:  { fg: "var(--text-dim)", bg: "var(--surface-alt)" },
  test: { fg: "var(--warning)",  bg: "var(--warning-bg)" },
  live: { fg: "var(--success, #1A6E35)", bg: "color-mix(in srgb, var(--success, #1A6E35) 12%, transparent)" },
};

function StateSelector({ value, onChange, disabled }) {
  return (
    <div
      className="flex rounded-lg overflow-hidden shrink-0"
      style={{ border: "1px solid var(--border)" }}
      role="radiogroup"
    >
      {STATES.map((s, i) => {
        const active = value === s.id;
        const tone = TONE[s.id];
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            title={s.hint}
            onClick={() => onChange(s.id)}
            className="px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors"
            style={{
              background: active ? tone.bg : "var(--surface)",
              color: active ? tone.fg : "var(--text-dim)",
              borderLeft: i === 0 ? "none" : "1px solid var(--border)",
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function ModuleStatesPanel() {
  const { states, loading, setModuleState } = useModuleStates();
  const [saving, setSaving] = useState(null);
  const [toast, setToast]   = useState(null);

  const handleChange = async (moduleId, state) => {
    setSaving(moduleId);
    try {
      await setModuleState(moduleId, state);
    } catch (err) {
      // O hook já desfez o estado otimista — aqui só conta pro usuário, em vez
      // de deixar a chave voltar sozinha sem explicação.
      setToast(err.message);
    } finally {
      setSaving(null);
    }
  };

  const desligadas = Object.values(states).filter(s => s === "off").length;
  const emTeste    = Object.values(states).filter(s => s === "test").length;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold" style={{ color: "var(--text)" }}>Módulos</h3>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-dim)", maxWidth: "62ch" }}>
          Liga e desliga páginas inteiras para toda a empresa. Isto <strong>não substitui</strong> o
          acesso por cargo — soma a ele. Liberar uma página não dá acesso a quem já não teria;
          apenas deixa de escondê-la de quem teria.
        </p>
      </div>

      {(desligadas > 0 || emTeste > 0) && (
        <div
          className="rounded-lg px-3.5 py-2.5 text-xs"
          style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
        >
          {[
            desligadas > 0 ? `${desligadas} página${desligadas > 1 ? "s" : ""} desligada${desligadas > 1 ? "s" : ""}` : null,
            emTeste > 0 ? `${emTeste} em teste` : null,
          ].filter(Boolean).join(" · ")} — fora do ar para a equipe.
        </div>
      )}

      {loading ? (
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</p>
      ) : (
        MODULE_GROUPS.map(group => (
          <div key={group.label}>
            <p
              className="text-[10px] font-bold uppercase mb-1.5"
              style={{ color: "var(--text-dim)", letterSpacing: "0.13em" }}
            >
              {group.label}
            </p>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {group.modules.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3.5 py-2.5"
                  style={{
                    borderTop: i === 0 ? "none" : "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <span className="flex-1 text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    {m.label}
                  </span>
                  <StateSelector
                    value={states[m.id] || "live"}
                    disabled={saving === m.id}
                    onChange={(s) => handleChange(m.id, s)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {toast && (
        <AppToast
          variant="danger"
          title="Não foi possível alterar"
          description={toast}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default ModuleStatesPanel;
