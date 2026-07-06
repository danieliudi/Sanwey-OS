import React, { useEffect, useMemo, useState } from "react";
import {
  GraduationCap, Plus, X, Check, ExternalLink, ChevronDown, ChevronRight, Users, AlertTriangle, RefreshCw,
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { RH_DEPARTMENTS } from "../../constants/rh-config";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHTreinamentos } from "../../hooks/use-rh-treinamentos";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

// ── Validade / revalidação ────────────────────────────────────────────────────

function vencimentoDate(atribuicao, treinamento) {
  if (!treinamento?.validade_dias || !atribuicao?.data_conclusao) return null;
  const d = new Date(atribuicao.data_conclusao);
  d.setDate(d.getDate() + Number(treinamento.validade_dias));
  return d;
}

function isVencido(atribuicao, treinamento) {
  if (atribuicao?.status !== "concluido") return false;
  const venc = vencimentoDate(atribuicao, treinamento);
  return Boolean(venc && venc.getTime() < Date.now());
}

function atribuicaoStatusInfo(atribuicao, treinamento) {
  if (isVencido(atribuicao, treinamento)) {
    return { label: `Vencido em ${fmt(vencimentoDate(atribuicao, treinamento))}`, color: "#DC2626", bg: "#FEE2E2" };
  }
  if (atribuicao.status === "concluido") {
    const venc = vencimentoDate(atribuicao, treinamento);
    return { label: venc ? `Concluído em ${fmt(atribuicao.data_conclusao)} · vence ${fmt(venc)}` : `Concluído em ${fmt(atribuicao.data_conclusao)}`, color: "#16A34A", bg: "#DCFCE7" };
  }
  return { label: "Pendente", color: "#D97706", bg: "#FEF3C7" };
}

// ── Modal: novo/editar treinamento ────────────────────────────────────────────

function NovoTreinamentoModal({ initialData, onSave, onClose }) {
  const [titulo, setTitulo]           = useState(initialData?.titulo || "");
  const [descricao, setDescricao]     = useState(initialData?.descricao || "");
  const [tipo, setTipo]               = useState(initialData?.tipo || "opcional");
  const [link, setLink]               = useState(initialData?.link_conteudo || "");
  const [cargoAlvo, setCargoAlvo]     = useState(initialData?.cargo_alvo || "");
  const [departamentoAlvo, setDepartamentoAlvo] = useState(initialData?.departamento_alvo || "");
  const [validadeDias, setValidadeDias] = useState(initialData?.validade_dias ?? "");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

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
        cargo_alvo: cargoAlvo.trim() || null,
        departamento_alvo: departamentoAlvo || null,
        validade_dias: validadeDias !== "" ? Number(validadeDias) : null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao salvar treinamento.");
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
          <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>{initialData ? "Editar treinamento" : "Novo treinamento"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Título *</label>
              <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: NR-35 — Trabalho em altura" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} autoFocus />
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
                <label style={labelSt}>Validade (dias)</label>
                <input type="number" min="0" value={validadeDias} onChange={(e) => setValidadeDias(e.target.value)} placeholder="Ex: 365" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
            </div>
            <p style={{ fontSize: 10, color: NEUTRAL.slate, marginTop: -6 }}>Deixe a validade em branco se o treinamento não expira. Ex: NR anual = 365.</p>

            <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Atribuição automática (opcional)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Cargo alvo</label>
                <input type="text" value={cargoAlvo} onChange={(e) => setCargoAlvo(e.target.value)} placeholder="Ex: Operador de produção" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Departamento alvo</label>
                <select value={departamentoAlvo} onChange={(e) => setDepartamentoAlvo(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="">Nenhum</option>
                  {RH_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <p style={{ fontSize: 10, color: NEUTRAL.slate, marginTop: -6 }}>
              Se obrigatório e o cargo ou departamento bater, o treinamento é atribuído sozinho quando o colaborador entra em "Integração" no onboarding.
            </p>

            <div>
              <label style={labelSt}>Link do conteúdo</label>
              <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : initialData ? "Salvar alterações" : "Criar treinamento"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: atribuir a colaboradores ──────────────────────────────────────────

function AtribuirModal({ treinamento, colaboradores, onAssign, onClose }) {
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const temAlvo = Boolean(treinamento.cargo_alvo || treinamento.departamento_alvo);
  const selectByAlvo = () => {
    const cargoAlvo = (treinamento.cargo_alvo || "").toLowerCase().trim();
    const deptoAlvo = treinamento.departamento_alvo || "";
    const matches = colaboradores.filter(c =>
      (cargoAlvo && (c.jobTitle || "").toLowerCase().trim() === cargoAlvo) ||
      (deptoAlvo && c.department === deptoAlvo)
    );
    setSelected(new Set(matches.map(c => c.id)));
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
        {temAlvo && (
          <div style={{ padding: "10px 24px 0" }}>
            <button onClick={selectByAlvo} style={{ fontSize: 11, color: "#1E4D8C", background: "#EFF6FF", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
              Selecionar todos do cargo/departamento alvo
            </button>
          </div>
        )}
        <div style={{ padding: "12px 24px", overflowY: "auto", flex: 1 }}>
          {colaboradores.length === 0 ? (
            <div style={{ fontSize: 12, color: NEUTRAL.slate }}>Nenhum colaborador cadastrado ainda.</div>
          ) : colaboradores.map(c => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <span style={{ fontSize: 13, color: NEUTRAL.graphite }}>{c.fullName}</span>
              {c.jobTitle && <span style={{ fontSize: 11, color: NEUTRAL.slate }}>· {c.jobTitle}</span>}
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

// ── Painel de conformidade ────────────────────────────────────────────────────

function ComplianceStats({ atribuicoes, treinamentosById }) {
  const stats = useMemo(() => {
    let ok = 0, vencidos = 0, pendentes = 0;
    atribuicoes.forEach((a) => {
      const t = treinamentosById.get(a.treinamento_id);
      if (isVencido(a, t)) vencidos++;
      else if (a.status === "concluido") ok++;
      else pendentes++;
    });
    const total = atribuicoes.length;
    return { total, ok, vencidos, pendentes, pct: total > 0 ? Math.round((ok / total) * 100) : 100 };
  }, [atribuicoes, treinamentosById]);

  if (stats.total === 0) return null;

  const tiles = [
    { label: "Conformidade", value: `${stats.pct}%`, color: stats.pct >= 80 ? "#16A34A" : stats.pct >= 50 ? "#D97706" : "#DC2626" },
    { label: "Concluídos",   value: stats.ok,         color: NEUTRAL.graphite },
    { label: "Pendentes",    value: stats.pendentes,  color: NEUTRAL.graphite },
    { label: "Vencidos",     value: stats.vencidos,   color: stats.vencidos > 0 ? "#DC2626" : NEUTRAL.graphite },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {tiles.map((t) => (
        <div key={t.label} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 14px", background: "#FAFAFA" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.color, lineHeight: 1 }}>{t.value}</div>
          <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 4 }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHTreinamentosView({ currentUser, canWrite, isRHUser }) {
  const { treinamentos, atribuicoes, loading: loadingTreinamentos, createTreinamento, updateTreinamento, assignToUsers, updateAtribuicaoStatus } = useRHTreinamentos({ userId: currentUser?.id });
  const { colaboradores, loading: loadingColaboradores } = useRHColaboradores({ userId: currentUser?.id });
  const [novoOpen, setNovoOpen]         = useState(false);
  const [editingTreinamento, setEditingTreinamento] = useState(null);
  const [atribuindoTo, setAtribuindoTo] = useState(null);
  const [expanded, setExpanded]         = useState(new Set());

  const loading = loadingTreinamentos || loadingColaboradores;

  const colaboradoresById = useMemo(() => new Map(colaboradores.map(c => [c.id, c])), [colaboradores]);
  const treinamentosById  = useMemo(() => new Map(treinamentos.map(t => [t.id, t])), [treinamentos]);

  const atribuicoesByTreinamento = useMemo(() => {
    const map = new Map();
    atribuicoes.forEach(a => {
      if (!map.has(a.treinamento_id)) map.set(a.treinamento_id, []);
      map.get(a.treinamento_id).push(a);
    });
    return map;
  }, [atribuicoes]);

  const meuColaborador = useMemo(
    () => colaboradores.find(c => c.profileId === currentUser?.id) || null,
    [colaboradores, currentUser?.id]
  );
  const myAtribuicoes = useMemo(
    () => meuColaborador ? atribuicoes.filter(a => a.colaborador_id === meuColaborador.id) : [],
    [atribuicoes, meuColaborador]
  );

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
            {isRHUser ? "Catálogo, atribuição e conformidade" : "Seus treinamentos atribuídos"}
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
        <>
          <ComplianceStats atribuicoes={atribuicoes} treinamentosById={treinamentosById} />
          {treinamentos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <GraduationCap size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Nenhum treinamento cadastrado</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {treinamentos.map(t => {
                const atribs = atribuicoesByTreinamento.get(t.id) || [];
                const concluidos = atribs.filter(a => a.status === "concluido" && !isVencido(a, t)).length;
                const vencidos = atribs.filter(a => isVencido(a, t)).length;
                return (
                  <div key={t.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#F9FAFB" }}>
                      <button onClick={() => toggleExpand(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexShrink: 0 }}>
                        {expanded.has(t.id) ? <ChevronDown size={14} color={NEUTRAL.slate} /> : <ChevronRight size={14} color={NEUTRAL.slate} />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: NEUTRAL.graphite }}>{t.titulo}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: t.tipo === "obrigatorio" ? "#B91C1C" : NEUTRAL.slate, background: t.tipo === "obrigatorio" ? "#FEE2E2" : "#F3F4F6", borderRadius: 99, padding: "1px 8px" }}>
                            {t.tipo === "obrigatorio" ? "Obrigatório" : "Opcional"}
                          </span>
                          {t.validade_dias && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#1E4D8C", background: "#DBEAFE", borderRadius: 99, padding: "1px 8px" }}>
                              Válido {t.validade_dias}d
                            </span>
                          )}
                          {vencidos > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#DC2626", background: "#FEE2E2", borderRadius: 99, padding: "1px 8px" }}>
                              <AlertTriangle size={9} /> {vencidos} vencido{vencidos !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 2 }}>
                          {atribs.length} atribuído{atribs.length !== 1 ? "s" : ""} · {concluidos} em dia
                          {(t.cargo_alvo || t.departamento_alvo) && ` · alvo: ${[t.cargo_alvo, t.departamento_alvo].filter(Boolean).join(" / ")}`}
                        </div>
                      </div>
                      {t.link_conteudo && (
                        <a href={t.link_conteudo} target="_blank" rel="noreferrer" style={{ color: "#1E4D8C", display: "flex", flexShrink: 0 }}><ExternalLink size={14} /></a>
                      )}
                      {canWrite && (
                        <>
                          <button onClick={() => setEditingTreinamento(t)} style={{ fontSize: 11, color: NEUTRAL.slate, background: "#F3F4F6", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                            Editar
                          </button>
                          <button onClick={() => setAtribuindoTo(t)} style={{ display: "flex", alignItems: "center", gap: 4, background: "#EFF6FF", color: "#1E4D8C", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                            <Users size={11} /> Atribuir
                          </button>
                        </>
                      )}
                    </div>
                    {expanded.has(t.id) && (
                      <div style={{ padding: "8px 16px 12px" }}>
                        {atribs.length === 0 ? (
                          <div style={{ fontSize: 12, color: NEUTRAL.slate, padding: "8px 0" }}>Ninguém atribuído ainda.</div>
                        ) : atribs.map(a => {
                          const info = atribuicaoStatusInfo(a, t);
                          const vencido = isVencido(a, t);
                          return (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
                              <span style={{ flex: 1, fontSize: 12, color: NEUTRAL.graphite }}>{colaboradoresById.get(a.colaborador_id)?.fullName || "—"}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: info.color, background: info.bg, borderRadius: 99, padding: "2px 9px" }}>
                                {info.label}
                              </span>
                              {canWrite && vencido && (
                                <button
                                  onClick={() => updateAtribuicaoStatus(a.id, "pendente")}
                                  style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#1E4D8C", background: "none", border: "none", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
                                >
                                  <RefreshCw size={10} /> Revalidar
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : !meuColaborador ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <GraduationCap size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Nenhum treinamento atribuído a você</div>
        </div>
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
            const vencido = isVencido(a, t);
            return (
              <div key={a.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={() => updateAtribuicaoStatus(a.id, a.status === "concluido" && !vencido ? "pendente" : "concluido")}
                  style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${vencido ? "#DC2626" : a.status === "concluido" ? "#16A34A" : "#D1D5DB"}`, background: vencido ? "#FFF" : a.status === "concluido" ? "#16A34A" : "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  title={vencido ? "Vencido — clique para revalidar" : undefined}
                >
                  {a.status === "concluido" && !vencido && <Check size={12} color="#FFF" />}
                  {vencido && <AlertTriangle size={11} color="#DC2626" />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: NEUTRAL.graphite }}>{t.titulo}</div>
                  {t.descricao && <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 2 }}>{t.descricao}</div>}
                  {vencido && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 2, fontWeight: 600 }}>Vencido em {fmt(vencimentoDate(a, t))} — clique pra revalidar</div>}
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
      {editingTreinamento && (
        <NovoTreinamentoModal
          initialData={editingTreinamento}
          onSave={(patch) => updateTreinamento(editingTreinamento.id, patch)}
          onClose={() => setEditingTreinamento(null)}
        />
      )}
      {atribuindoTo && <AtribuirModal treinamento={atribuindoTo} colaboradores={colaboradores} onAssign={assignToUsers} onClose={() => setAtribuindoTo(null)} />}
    </div>
  );
}

export default RHTreinamentosView;
