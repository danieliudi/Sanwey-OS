import React, { useMemo, useRef, useState, useEffect } from "react";
import { Search, Plus, X, RotateCcw, Building2, MapPin, FileText, Calendar } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { clientCategoryLabel, clientCategoryColor } from "../../constants/client-categories";
import { formatDateBR } from "../../utils/date";

// Seletor de cliente em 3 estados: vazio → busca → selecionado (mini-card).
// Usa a base central de clientes (Configurações → Clientes).
//
// Props:
//   value         id do cliente selecionado (ou null)
//   client        objeto do cliente já resolvido (opcional; senão resolve por value)
//   clients       lista completa de clientes
//   onChange(id)  callback ao selecionar/limpar
//   onCreate()    abre o cadastro de novo cliente (opcional)
//   disabled      somente leitura
export function ClientSelector({ value, client, clients = [], onChange, onCreate, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  const selected = client || clients.find(c => c.id === value) || null;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? clients.filter(c =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.city || "").toLowerCase().includes(q) ||
          (c.cnpj || "").includes(q))
      : clients;
    return list.slice(0, 30);
  }, [clients, query]);

  const pick = (c) => {
    onChange?.(c.id);
    setOpen(false);
    setQuery("");
  };

  // ── Estado C: selecionado ──
  if (selected && !open) {
    const cat = selected.category;
    return (
      <div
        className="rounded-xl border bg-white p-3.5"
        style={{ borderColor: "#E5E7EB", borderLeft: `3px solid ${cat ? clientCategoryColor(cat) : "var(--color-industria)"}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="font-bold leading-snug" style={{ fontSize: 15, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {selected.name}
          </div>
          {!disabled && (
            <button
              onClick={() => onChange?.(null)}
              title="Remover cliente"
              className="shrink-0"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", lineHeight: 1 }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1.5 mt-2.5">
          {cat && (
            <div className="flex items-center gap-2 text-xs">
              <Building2 size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{ fontSize: 10, background: clientCategoryColor(cat) + "1A", color: clientCategoryColor(cat) }}
              >
                {clientCategoryLabel(cat)}
              </span>
            </div>
          )}
          {(selected.city || selected.state) && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
              <MapPin size={13} style={{ flexShrink: 0 }} />
              <b style={{ color: "var(--text)", fontWeight: 600 }}>
                {[selected.city, selected.state].filter(Boolean).join(" / ")}
              </b>
            </div>
          )}
          {selected.cnpj && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
              <FileText size={13} style={{ flexShrink: 0 }} />
              <span className="font-mono">{selected.cnpj}</span>
            </div>
          )}
          {selected.createdAt && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
              <Calendar size={13} style={{ flexShrink: 0 }} />
              Criado em <b style={{ color: "var(--text)", fontWeight: 600 }}>{formatDateBR(selected.createdAt)}</b>
            </div>
          )}
        </div>
        {!disabled && (
          <button
            onClick={() => { setOpen(true); }}
            className="flex items-center gap-1 mt-3 text-xs font-semibold"
            style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <RotateCcw size={12} /> Trocar cliente
          </button>
        )}
      </div>
    );
  }

  // ── Estado B: buscando ──
  if (open) {
    return (
      <div ref={boxRef} className="rounded-xl bg-white overflow-hidden" style={{ border: "1.5px solid var(--accent)" }}>
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: "1px solid #E5E7EB" }}>
          <Search size={15} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar cliente…"
            className="flex-1 text-sm outline-none"
            style={{ border: "none", color: "var(--text)", background: "transparent" }}
          />
          <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1" }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ maxHeight: 240, overflowY: "auto" }}>
          {filtered.length === 0 && (
            <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>
              {query ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
            </div>
          )}
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              className="w-full text-left px-3 py-2.5 transition-colors"
              style={{ borderBottom: "1px solid #F1F1F1", background: c.id === value ? NEUTRAL.redTint : "transparent", border: "none", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = NEUTRAL.redTint; }}
              onMouseLeave={e => { e.currentTarget.style.background = c.id === value ? NEUTRAL.redTint : "transparent"; }}
            >
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{c.name}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                {[clientCategoryLabel(c.category), [c.city, c.state].filter(Boolean).join("/")].filter(v => v && v !== "—").join(" · ")}
              </div>
            </button>
          ))}
          {onCreate && (
            <button
              onClick={() => { setOpen(false); onCreate(query.trim()); }}
              className="w-full text-left flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold"
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
            >
              <Plus size={13} /> Cadastrar novo cliente
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Estado A: vazio ──
  return (
    <button
      onClick={() => !disabled && setOpen(true)}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-colors"
      style={{
        border: "1.5px dashed #CBD5E1",
        background: "#FFFFFF",
        color: disabled ? "var(--text-dim)" : "var(--accent)",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <Plus size={15} /> Selecionar cliente
    </button>
  );
}
