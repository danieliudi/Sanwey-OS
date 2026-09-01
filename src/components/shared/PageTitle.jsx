import React, { createContext, useContext, useState } from "react";
import { Pencil, Check, X } from "lucide-react";

// Título da página do board, com a descrição na MESMA linha em vez de numa
// linha própria embaixo. Rodada de densidade de 01/09/2026, decidida com o
// Daniel a partir dos prints do Pipefy: o header gastava 131px, dos quais uma
// linha inteira era o subtítulo.
//
// Extraído porque o bloco "ícone + h1 de 26px + <p> de subtítulo" estava
// escrito à mão em 14 views de board (e o h1 de 26px em 35 lugares no total).
// Passa do limiar da regra 4 do CLAUDE.md com folga — e é o arquivo único que
// vai receber a descrição editável quando a coluna `module_states.description`
// for aprovada, sem precisar tocar em view nenhuma de novo.
//
// ---------------------------------------------------------------------------
// ATENÇÃO — dois tipos de "subtítulo", não misturar (achado de 01/09/2026)
//
// O que hoje se parece com subtítulo em toda view na verdade é uma de duas
// coisas bem diferentes:
//
//   1. DESCRIÇÃO estática — "Kanban de entregas de campanha". Texto fixo,
//      escrito no código, que não muda com o dado. É este que vem pra cá, na
//      prop `description`, e é este que vira editável no futuro.
//
//   2. RESUMO ao vivo — "12 oportunidades · R$ 340k em aberto · 3 ganhos"
//      (CRMView, PosVendaView). É dado calculado, muda a cada filtro, e é
//      longo. NÃO é descrição e não deve virar uma; a prop `summary` existe
//      pra isso e continua renderizando na linha de baixo, onde cabe.
//
// Uma view pode ter as duas, uma, ou nenhuma.
// ---------------------------------------------------------------------------

// Descrição EDITÁVEL da página (migration 20260901180000, mockup aprovado com
// o Daniel 01/09/2026: "ao invés de eliminar o subtítulo, eu deixaria ao lado,
// mas editável"). Chega por contexto, não por prop, de propósito: o App já
// sabe qual seção está aberta e quem está logado, enquanto as 14 views que
// renderizam um PageTitle não sabem o próprio `module_id` nem deveriam
// precisar saber. Sem provider (teste, Storybook, tela fora do App), o valor
// default deixa tudo exatamente como era antes — texto estático, sem lápis.
const PageDescriptionContext = createContext({ moduleId: null, description: null, canEdit: false, onSave: null });

export function PageDescriptionProvider({ value, children }) {
  return <PageDescriptionContext.Provider value={value}>{children}</PageDescriptionContext.Provider>;
}

const MAX_DESC = 120;  // espelha o CHECK de module_states no banco

// A descrição customizada VENCE a estática escrita na view. É o ponto todo da
// feature: quem desenha o processo reescreve o que a tela significa sem
// depender de deploy. Sem customizada, cai na estática de sempre.
function EditablePageDescription({ estatica }) {
  const { moduleId, description: custom, canEdit, onSave } = useContext(PageDescriptionContext);
  const efetiva = custom ?? estatica ?? null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const podeEditar = canEdit && !!moduleId && typeof onSave === "function";

  if (!podeEditar) {
    return efetiva ? <DescriptionText text={efetiva} /> : null;
  }

  if (editing) {
    const salvar = async () => {
      setSaving(true); setError(null);
      try {
        await onSave(moduleId, draft);
        setEditing(false);
      } catch (err) {
        setError(err?.message || "Erro ao salvar.");
      } finally {
        setSaving(false);
      }
    };
    return (
      <span className="flex items-center gap-1 min-w-0" style={{ flex: "1 1 0" }}>
        <input
          autoFocus
          value={draft}
          maxLength={MAX_DESC}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setEditing(false); }}
          placeholder="O que esta página faz…"
          className="text-xs"
          style={{ flex: "1 1 0", minWidth: 0, maxWidth: 360, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", color: "var(--text)", background: "var(--surface)" }}
        />
        <button onClick={salvar} disabled={saving} title={error || "Salvar"}
          style={{ background: "none", border: "none", cursor: saving ? "wait" : "pointer", color: error ? "var(--danger)" : "var(--success)", padding: 2, display: "inline-flex", flexShrink: 0 }}>
          <Check size={14} />
        </button>
        <button onClick={() => setEditing(false)} title="Cancelar"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "inline-flex", flexShrink: 0 }}>
          <X size={14} />
        </button>
      </span>
    );
  }

  const abrir = () => { setDraft(efetiva || ""); setError(null); setEditing(true); };

  // Lápis SEMPRE visível, não só no hover — mesma decisão do EditableTitle
  // (CLAUDE.md, regra 1): sinaliza "isto é editável" sem depender de mouse e
  // funciona em touch.
  return (
    <span className="flex items-center gap-1 min-w-0">
      {efetiva
        ? <DescriptionText text={efetiva} />
        : <button onClick={abrir} className="text-xs" style={{ color: "var(--text-faint)", background: "none", border: "none", padding: 0, cursor: "pointer", whiteSpace: "nowrap" }}>+ descrição</button>}
      {efetiva && (
        <button onClick={abrir} title="Editar a descrição desta página"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "inline-flex", flexShrink: 0 }}>
          <Pencil size={11} />
        </button>
      )}
    </span>
  );
}

function DescriptionText({ text }) {
  return (
    <span title={text} className="text-xs truncate" style={{ color: "var(--text-dim)", minWidth: 0 }}>
      {text}
    </span>
  );
}

export function PageTitle({ icon: Icon, title, description, summary, dataTour }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {Icon ? <Icon size={18} style={{ color: "var(--text)", flexShrink: 0 }} /> : null}
        <h1
          className="font-bold leading-tight"
          style={{ fontSize: 19, color: "var(--text)", letterSpacing: "-0.02em", flexShrink: 0 }}
        >
          {title}
        </h1>
        <PageDescriptionSlot estatica={description} dataTour={dataTour} />
      </div>
      {summary ? (
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>{summary}</p>
      ) : null}
    </div>
  );
}

// O divisor vertical só aparece quando há algo do lado direito dele — e pro
// admin "algo" inclui o botão "+ descrição" numa página que ainda não tem
// nenhuma, que é justamente como ele descobre que dá pra escrever uma.
function PageDescriptionSlot({ estatica, dataTour }) {
  const { moduleId, description: custom, canEdit, onSave } = useContext(PageDescriptionContext);
  const podeEditar = canEdit && !!moduleId && typeof onSave === "function";
  const temTexto = !!(custom ?? estatica);
  if (!temTexto && !podeEditar) return null;
  return (
    <>
      <span aria-hidden="true" style={{ width: 1, height: 15, background: "var(--border)", flexShrink: 0 }} />
      {/* Id estável pro tour guiado (FEATURE_SPOTLIGHTS). Nenhuma view passa
          `dataTour` hoje; a prop fica como escape hatch se alguma precisar
          apontar pra própria descrição um dia. */}
      <span data-tour={dataTour || "page-description"} className="min-w-0 flex items-center">
        <EditablePageDescription estatica={estatica} />
      </span>
    </>
  );
}

export default PageTitle;
