import React, { useEffect, useMemo, useState } from "react";
import {
  GraduationCap, Plus, X, Check, ExternalLink, ChevronDown, ChevronRight, Users,
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHTreinamentos } from "../../hooks/use-rh-treinamentos";

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

// ── Modal: novo treinamento ────────────────────────────────────────────────────

function NovoTreinamentoModal({ onSave, onClose }) {
  const [titulo, setTitulo]     = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo]         = useState("opcional");
  const [link, setLink]         = useState("");
  const [frente, setFrente]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titulo.trim()) { setError("Título obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        tipo,
        link_conteudo: link.trim() || null,
        frente: frente.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar treinamento.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>Novo treinamento</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Título *</label>
              <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Compliance ambiental" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} autoFocus />
            </div>
            <div>
              <label style={labelSt}>Descrição</label>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="opcional">Opcional</option>
                  <option value="obrigatorio">Obrigatório</option>
                </select>
              </div>
              <div>
                <label style={labelSt}>Frente</label>
                <input type="text" value={frente} onChange={(e) => setFrente(e.target.value)} placeholder="Ex: Indústria" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
            </div>
            <div>
              <label style={labelSt}>Link do conteúdo</label>
              <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Criando…" : "Criar treinamento"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: atribuir a colaboradores ──────────────────────────────────────────

function AtribuirModal({ treinamento, users, onAssign, onClose }) {
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectByFrente = () => {
    if (!treinamento.frente) return;
    const matches = users.filter(u => (u.companies || []).includes(treinamento.frente) || u.department === treinamento.frente);
    setSelected(new Set(matches.map(u => u.id)));
  };

  const handleSubmit = async () => {
    if (selected.size === 0) { setError("Selecione ao menos um colaborador."); return; }
    setSaving(true);
    setError(null);
    try {
      await onAssign(treinamento.id, Array.from(selected));
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao atribuir.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>Atribuir treinamento</div>
            <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 2 }}>{treinamento.titulo}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        {treinamento.frente && (
          <div style={{ padding: "10px 24px 0" }}>
            <button onClick={selectByFrente} style={{ fontSize: 11, color: "#1E4D8C", background: "#EFF6FF", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
              Selecionar todos de "{treinamento.frente}"
            </button>
          </div>
        )}
        <div style={{ padding: "12px 24px", overflowY: "auto", flex: 1 }}>
          {users.map(u => (
            <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
              <span style={{ fontSize: 13, color: NEUTRAL.graphite }}>{u.name}</span>
            </label>
          ))}
        </div>
        {error && <div style={{ margin: "0 24px 12px", background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
        <div style={{ padding: "12px 24px 20px", display: "flex", gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Atribuindo…" : `Atribuir a ${selected.size}`}
          </button>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHTreinamentosView({ currentUser, users, canWrite, isRHUser }) {
  const { treinamentos, atribuicoes, loading, createTreinamento, assignToUsers, updateAtribuicaoStatus } = useRHTreinamentos({ userId: currentUser?.id });
  const [novoOpen, setNovoOpen]         = useState(false);
  const [atribuindoTo, setAtribuindoTo] = useState(null);
  const [expanded, setExpanded]         = useState(new Set());

  const usersById = useMemo(() => new Map((users || []).map(u => [u.id, u])), [users]);

  const atribuicoesByTreinamento = useMemo(() => {
    const map = new Map();
    atribuicoes.forEach(a => {
      if (!map.has(a.treinamento_id)) map.set(a.treinamento_id, []);
      map.get(a.treinamento_id).push(a);
    });
    return map;
  }, [atribuicoes]);

  const myAtribuicoes = useMemo(() => atribuicoes.filter(a => a.colaborador_id === currentUser?.id), [atribuicoes, currentUser?.id]);

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (!isSupabaseConfigured) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <GraduationCap size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Supabase não configurado</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap size={22} style={{ color: NEUTRAL.graphite }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em", margin: 0 }}>Treinamentos</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            {isRHUser ? "Cadastro, atribuição e compliance" : "Seus treinamentos atribuídos"}
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setNovoOpen(true)} style={{ background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Novo treinamento
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: NEUTRAL.slate, fontSize: 13 }}>Carregando…</div>
      ) : isRHUser ? (
        treinamentos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <GraduationCap size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Nenhum treinamento cadastrado</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {treinamentos.map(t => {
              const atribs = atribuicoesByTreinamento.get(t.id) || [];
              const concluidos = atribs.filter(a => a.status === "concluido").length;
              return (
                <div key={t.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#F9FAFB" }}>
                    <button onClick={() => toggleExpand(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexShrink: 0 }}>
                      {expanded.has(t.id) ? <ChevronDown size={14} color={NEUTRAL.slate} /> : <ChevronRight size={14} color={NEUTRAL.slate} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: NEUTRAL.graphite }}>{t.titulo}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: t.tipo === "obrigatorio" ? "#B91C1C" : NEUTRAL.slate, background: t.tipo === "obrigatorio" ? "#FEE2E2" : "#F3F4F6", borderRadius: 99, padding: "1px 8px" }}>
                          {t.tipo === "obrigatorio" ? "Obrigatório" : "Opcional"}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 2 }}>
                        {atribs.length} atribuído{atribs.length !== 1 ? "s" : ""} · {concluidos} concluído{concluidos !== 1 ? "s" : ""}
                        {t.frente && ` · ${t.frente}`}
                      </div>
                    </div>
                    {t.link_conteudo && (
                      <a href={t.link_conteudo} target="_blank" rel="noreferrer" style={{ color: "#1E4D8C", display: "flex", flexShrink: 0 }}><ExternalLink size={14} /></a>
                    )}
                    {canWrite && (
                      <button onClick={() => setAtribuindoTo(t)} style={{ display: "flex", alignItems: "center", gap: 4, background: "#EFF6FF", color: "#1E4D8C", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                        <Users size={11} /> Atribuir
                      </button>
                    )}
                  </div>
                  {expanded.has(t.id) && (
                    <div style={{ padding: "8px 16px 12px" }}>
                      {atribs.length === 0 ? (
                        <div style={{ fontSize: 12, color: NEUTRAL.slate, padding: "8px 0" }}>Ninguém atribuído ainda.</div>
                      ) : atribs.map(a => (
                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
                          <span style={{ flex: 1, fontSize: 12, color: NEUTRAL.graphite }}>{usersById.get(a.colaborador_id)?.name || "—"}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: a.status === "concluido" ? "#16A34A" : "#D97706", background: a.status === "concluido" ? "#DCFCE7" : "#FEF3C7", borderRadius: 99, padding: "2px 9px" }}>
                            {a.status === "concluido" ? `Concluído em ${fmt(a.data_conclusao)}` : "Pendente"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : myAtribuicoes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <GraduationCap size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Nenhum treinamento atribuído a você</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {myAtribuicoes.map(a => {
            const t = treinamentos.find(tr => tr.id === a.treinamento_id);
            if (!t) return null;
            return (
              <div key={a.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={() => updateAtribuicaoStatus(a.id, a.status === "concluido" ? "pendente" : "concluido")}
                  style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${a.status === "concluido" ? "#16A34A" : "#D1D5DB"}`, background: a.status === "concluido" ? "#16A34A" : "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  {a.status === "concluido" && <Check size={12} color="#FFF" />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: NEUTRAL.graphite }}>{t.titulo}</div>
                  {t.descricao && <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 2 }}>{t.descricao}</div>}
                </div>
                {t.link_conteudo && (
                  <a href={t.link_conteudo} target="_blank" rel="noreferrer" style={{ color: "#1E4D8C", display: "flex", flexShrink: 0 }}><ExternalLink size={14} /></a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {novoOpen && <NovoTreinamentoModal onSave={createTreinamento} onClose={() => setNovoOpen(false)} />}
      {atribuindoTo && <AtribuirModal treinamento={atribuindoTo} users={users || []} onAssign={assignToUsers} onClose={() => setAtribuindoTo(null)} />}
    </div>
  );
}
