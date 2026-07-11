import React, { useEffect, useMemo, useState } from "react";
import { X, Plus, GripVertical, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "../ui/Button";
import { FIELD_TYPES, slugifyKey } from "../../hooks/use-stage-fields";

// Modal de configuração de campos de uma etapa.
//
// Props:
//   open         — boolean
//   onClose      — () => void
//   companyId    — id da empresa
//   stageId      — id da etapa
//   stageName    — nome da etapa (display)
//   getFields    — (companyId, stageId) => Field[]
//   addField     — async (field) => Field
//   updateField  — async (id, patch) => void
//   deleteField  — async (id) => void
//   reorderFields— async (companyId, stageId, orderedIds) => void
export function StageFieldsEditor({
  open, onClose, companyId, stageId, stageName,
  getFields, addField, updateField, deleteField, reorderFields,
}) {
  const existing = useMemo(() => getFields(companyId, stageId), [getFields, companyId, stageId]);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) { setDraft(null); setError(null); }
  }, [open]);

  if (!open) return null;

  const startNewField = () => {
    setDraft({
      _new: true,
      companyId, stageId,
      fieldKey: "",
      fieldType: "text",
      label: "",
      required: false,
      options: [],
      orderIdx: existing.length,
      placeholder: "",
      helpText: "",
    });
  };

  const handleSaveField = async () => {
    if (!draft) return;
    setError(null);
    const label = (draft.label || "").trim();
    if (!label) { setError("Informe um rótulo."); return; }
    const key = draft.fieldKey || slugifyKey(label);
    // Evita colisão de chave dentro da mesma etapa.
    const collision = existing.some(f => f.fieldKey === key && f.id !== draft.id);
    if (collision) { setError("Já existe um campo com essa chave nesta etapa."); return; }
    setSaving(true);
    try {
      if (draft._new) {
        await addField({ ...draft, fieldKey: key });
      } else {
        await updateField(draft.id, { ...draft, fieldKey: key });
      }
      setDraft(null);
    } catch (e) {
      setError(e?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remover este campo? Os valores já preenchidos serão preservados nos cards.")) return;
    try { await deleteField(id); }
    catch (e) { setError(e?.message || "Falha ao remover."); }
  };

  const move = async (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= existing.length) return;
    const reordered = [...existing];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(target, 0, item);
    try { await reorderFields(companyId, stageId, reordered.map(f => f.id)); }
    catch (e) { setError(e?.message || "Falha ao reordenar."); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl"
        style={{ background: "#FFFFFF", boxShadow: "var(--shadow-pop)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 border-b flex items-center justify-between"
             style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>
              Campos da etapa
            </h2>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{stageName}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer"
            style={{ color: "var(--text-dim)" }}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="text-xs rounded-md px-3 py-2"
                 style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
              {error}
            </div>
          )}

          {/* Lista de campos existentes */}
          <div className="space-y-2">
            {existing.length === 0 && (
              <div className="text-xs italic py-4 text-center" style={{ color: "var(--text-dim)" }}>
                Nenhum campo configurado ainda. Adicione abaixo.
              </div>
            )}
            {existing.map((f, idx) => (
              <div key={f.id} className="rounded-lg border p-3 flex items-center gap-2"
                   style={{ borderColor: "#E8E8E8", background: "var(--surface-alt)" }}>
                <GripVertical size={14} color="var(--text-dim)" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}>
                    {f.label}
                    {f.required && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded"
                                         style={{ background: "#FEE2E2", color: "#B91C1C" }}>obrigatório</span>}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                    {FIELD_TYPES.find(t => t.value === f.fieldType)?.label || f.fieldType} · chave: <code>{f.fieldKey}</code>
                  </div>
                </div>
                <button onClick={() => move(idx, -1)} disabled={idx === 0}
                        className="p-1.5 rounded disabled:opacity-30 cursor-pointer"
                        style={{ color: "var(--text-dim)" }} title="Subir"><ArrowUp size={14} /></button>
                <button onClick={() => move(idx, +1)} disabled={idx === existing.length - 1}
                        className="p-1.5 rounded disabled:opacity-30 cursor-pointer"
                        style={{ color: "var(--text-dim)" }} title="Descer"><ArrowDown size={14} /></button>
                <button onClick={() => setDraft({ ...f })}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer"
                        style={{ background: "var(--surface-alt)", color: "#1E40AF" }}>Editar</button>
                <button onClick={() => handleDelete(f.id)}
                        className="p-1.5 rounded cursor-pointer"
                        style={{ color: "#B91C1C" }} title="Remover"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          {/* Form de novo/editar */}
          {draft && (
            <div className="rounded-lg border p-4 space-y-3"
                 style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}>
              <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                {draft._new ? "Novo campo" : "Editar campo"}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="Rótulo (visível ao usuário)" required>
                  <input type="text" value={draft.label}
                         onChange={e => setDraft({ ...draft, label: e.target.value })}
                         className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
                         style={{ borderColor: "#E5E7EB" }} />
                </FieldInput>
                <FieldInput label="Tipo">
                  <select value={draft.fieldType}
                          onChange={e => setDraft({ ...draft, fieldType: e.target.value })}
                          className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
                          style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}>
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </FieldInput>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="Placeholder (opcional)">
                  <input type="text" value={draft.placeholder || ""}
                         onChange={e => setDraft({ ...draft, placeholder: e.target.value })}
                         className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
                         style={{ borderColor: "#E5E7EB" }} />
                </FieldInput>
                <FieldInput label="Texto de ajuda (opcional)">
                  <input type="text" value={draft.helpText || ""}
                         onChange={e => setDraft({ ...draft, helpText: e.target.value })}
                         className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
                         style={{ borderColor: "#E5E7EB" }} />
                </FieldInput>
              </div>
              {draft.fieldType === "select" && (
                <FieldInput label="Opções (uma por linha, valor|rótulo opcional)">
                  <textarea rows={4} value={(draft.options || []).map(o => o.label && o.label !== o.value ? `${o.value}|${o.label}` : o.value).join("\n")}
                            onChange={e => {
                              const opts = e.target.value.split("\n").map(line => {
                                const t = line.trim();
                                if (!t) return null;
                                const [value, label] = t.split("|").map(s => s.trim());
                                return { value, label: label || value };
                              }).filter(Boolean);
                              setDraft({ ...draft, options: opts });
                            }}
                            className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
                            style={{ borderColor: "#E5E7EB", fontFamily: "monospace" }} />
                </FieldInput>
              )}
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer"
                     style={{ color: "var(--text)" }}>
                <input type="checkbox" checked={!!draft.required}
                       onChange={e => setDraft({ ...draft, required: e.target.checked })} />
                <span>Obrigatório</span>
              </label>
              <div className="flex items-center gap-2 pt-2">
                <Button variant="primary" onClick={handleSaveField} disabled={saving}>
                  {saving ? "Salvando…" : "Salvar campo"}
                </Button>
                <Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {!draft && (
            <button onClick={startNewField}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold cursor-pointer"
                    style={{ borderColor: "#E5E7EB", borderStyle: "dashed", color: "var(--accent)", background: "#FFFFFF" }}>
              <Plus size={14} />
              Adicionar campo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldInput({ label, required, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>
        {label}{required && <span style={{ color: "#B91C1C", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export default StageFieldsEditor;
