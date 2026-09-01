import React from "react";
import { stageTextColor } from "../../utils/stage-colors";

/**
 * Shell of a Kanban board column header — reused across every board
 * (Pipeline, Campanhas, Entregas, Compras, and the RH boards): a colored
 * band on top, the uppercase stage name + card count, and two slots the
 * board itself decides what (if anything) to fill:
 *
 *   - `children` — optional secondary aggregate line under the name/count
 *     row (e.g. money total, SLA figure, or both). Purely a per-board
 *     business decision — Pipeline shows money, Entregas shows SLA,
 *     Campanhas shows both, Compras/Onboarding/Recrutamento show neither.
 *   - `actions`  — the edit-stage / add-card affordance(s) that board
 *     already renders in its header (button, pair of buttons, or a
 *     wrapping div around them). Rendered as-is, no change to their
 *     styling/behavior.
 *
 * This component owns only the repeated container/structure (band height,
 * header padding/border, name truncation, count formatting) — it does not
 * unify what each board actually shows in those slots.
 */
export function KanbanColumnHeader({
  color,
  name,
  // Descrição da etapa (rh_pipeline_stages.description, migration
  // 20260901180000): "o que precisa acontecer nesta fase", escrita pelo
  // gerente/admin no editor de etapas. Aparece como `title` nativo no nome —
  // ZERO pixel de layout, que é a única forma de caber depois da rodada de
  // densidade (a 2ª linha do cabeçalho foi cortada justamente pra economizar
  // ~19px por coluna, e a coluna se repete 5-6 vezes na largura da tela).
  // `title` em elemento que já existe é o padrão de facto da plataforma pra
  // esse tipo de hint — CLAUDE.md, regra 1, ~90 ocorrências.
  description = null,
  count,
  bandHeight = 8,
  letterSpacing = "0.08em",
  truncateName = true,
  actions = null,
  children = null,
  // Props novas (Redesign v2, ver plano do Kanban) — todas opcionais, default
  // = comportamento de sempre, pra não mudar nada nos 7 boards que ainda não
  // passaram por essa revisão (Marketing, Compras de Marketing, RH ×5). Só
  // Funil de Vendas/Entregas/Pós-venda passam os valores "modo Pipefy".
  nameColor = "var(--text)",
  nameFontSize = 11,
  nameFontWeight = 600,
  uppercase = true,
  countFontSize = null,
  // Rodada de densidade (01/09/2026, aprovada com o Daniel): `children` na
  // MESMA linha do nome, empurrado pra direita, em vez de numa segunda linha
  // própria. Corta ~19px por coluna — e a coluna se repete 5 ou 6 vezes na
  // largura da tela, então é a faixa que mais rende. Só serve pra conteúdo
  // curto (um "SLA 3d"): quem mostra dinheiro + SLA junto (Funil, Campanhas,
  // Pós-venda) continua com a segunda linha. CONFIRMADO no rollout do padrão
  // pros outros 11 boards (01/09/2026, mesma sessão): além de "R$ 340k · SLA
  // 5d" não caber sem truncar, o `children` da coluna do Funil vira "Transição
  // bloqueada" em `var(--danger)` quando a transição está travada — e o
  // `<span>` de 10.5px/400/`--text-dim` daqui achataria justamente o aviso que
  // precisa saltar aos olhos. Não é "ainda não fizemos": é para ficar assim.
  secondaryInline = false,
}) {
  return (
    <>
      {/* Top color band — mais grosso pra dar mais peso visual à identidade
          de cor da etapa. */}
      <div style={{ height: bandHeight, background: color, flexShrink: 0 }} />
      <div
        className="px-3 py-2 flex items-center justify-between gap-2"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-1.5"
            // stageTextColor aplicado aqui (e não nos 13 chamadores) pra
            // centralizar a decisão 1A; com o default var(--text) o mix
            // resolve pro próprio var(--text), sem mudança visual.
            style={{ color: stageTextColor(nameColor), fontSize: nameFontSize, fontWeight: nameFontWeight, letterSpacing, textTransform: uppercase ? "uppercase" : "none" }}
          >
            {truncateName ? (
              <span
                title={description ? `${name} — ${description}` : name}
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" }}
              >
                {name}
              </span>
            ) : (
              // Sem truncagem o `title` precisa de um elemento próprio pra
              // segurar a descrição — antes o nome era texto solto.
              description ? <span title={`${name} — ${description}`}>{name}</span> : name
            )}
            {/* Sem parênteses: o número já é o número, e o par de parênteses
                é ruído que se repete uma vez por coluna. */}
            <span style={{ color: "var(--text-dim)", fontWeight: 500, flexShrink: 0, ...(countFontSize ? { fontSize: countFontSize } : {}) }}>{count}</span>
            {secondaryInline && children ? (
              <span
                style={{
                  marginLeft: "auto", flexShrink: 0, whiteSpace: "nowrap",
                  fontSize: 10.5, fontWeight: 400, letterSpacing: "normal",
                  textTransform: "none", color: "var(--text-dim)",
                }}
              >
                {children}
              </span>
            ) : null}
          </div>
          {secondaryInline ? null : children}
        </div>
        {actions}
      </div>
    </>
  );
}
