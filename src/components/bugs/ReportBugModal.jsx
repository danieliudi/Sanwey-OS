import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { BUG_PRIORITIES } from "../../constants/bug-reports";
import { moduloDaRota, montarContexto, tituloAutomatico } from "../../utils/bug-context";

const MODULOS = [
  "Funil de Vendas", "Explorador", "Sinais", "Pedidos", "Catálogo", "Pós-venda",
  "Viagens & Despesas", "Comex", "Marketing", "Compras", "RH", "Lista Pessoal", "Chat", "Outro",
];

// Formulário de report de bug (mockup aprovado 17/08/2026, reduzido a um campo
// no mockup de 02/09/2026).
//
// O que mudou e por quê: a 1ª versão pedia título, descrição, módulo e
// prioridade — quatro preenchimentos, alcançáveis só pela página Central de
// Bugs. O time de Marketing parou de reportar. Agora:
//   · o título nasce da 1ª linha do relato (`title` é NOT NULL no schema)
//   · "Onde" vem da rota, editável — era o "vira contextual" que o comentário
//     desta 1ª versão já previa e deixou pra "quando/se for pedido"
//   · prioridade vira três botões, não um <select> que esconde as opções
//   · o contexto técnico viaja anexado, no lugar do print
//
// `erro` preenchido = veio da tela de erro (camada 1): aí nem o relato é
// obrigatório, porque a mensagem técnica já diz o que aconteceu.
export function ReportBugModal({ open, onClose, onSubmit, rota, empresa, erro = null, origem = "central" }) {
  const [relato, setRelato] = useState("");
  const [module, setModule] = useState(() => moduloDaRota(rota));
  const [priority, setPriority] = useState("media");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // A rota muda enquanto o modal está fechado (a pessoa navega e só depois
  // abre o report). Sem isto, "Onde" ficaria travado na rota do 1º render.
  useEffect(() => {
    if (open) setModule(moduloDaRota(rota));
  }, [open, rota]);

  // Vindo da tela de erro não há o que exigir: o erro é o relato.
  const canSubmit = (erro ? true : relato.trim().length > 0) && !submitting;

  const handleClose = () => {
    setRelato(""); setPriority("media"); setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: tituloAutomatico({ relato, erro, rota }),
        // `description` também é NOT NULL. Sem relato (report de 1 clique na
        // tela de erro), a própria mensagem do erro ocupa o lugar em vez de
        // gravar string vazia e perder a informação.
        description: relato.trim() || (erro?.message || String(erro) || "Reportado sem descrição."),
        module,
        priority,
        origem,
        contexto: montarContexto({ rota, empresa, erro }),
      });
      handleClose();
    } catch (e) {
      setError(e?.message || "Não foi possível enviar — tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={erro ? "Reportar este erro" : "Reportar um problema"} width={520}>
      <div className="p-6 flex flex-col gap-4">
        <div
          className="text-xs rounded-lg px-3 py-2.5 flex items-start gap-2"
          style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}
        >
          <span style={{ color: "var(--accent)", fontWeight: 700, lineHeight: 1.4 }}>✓</span>
          <span>
            Já anexamos <b style={{ color: "var(--text)" }}>a tela, o navegador e o erro técnico</b> — você não precisa tirar print.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            O que aconteceu? {erro && <span style={{ fontWeight: 400 }}>(opcional — o erro já foi anexado)</span>}
          </label>
          <textarea
            autoFocus
            value={relato}
            onChange={(e) => setRelato(e.target.value)}
            rows={4}
            placeholder={erro
              ? "Se quiser, conte o que você estava fazendo quando isso apareceu."
              : "Ex.: escrevi um comentário, devolvi o card pra agência, e o comentário sumiu"}
            className="rounded-lg border px-3 py-2 text-sm outline-none resize-none"
            style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>O quanto atrapalha</label>
          <div className="flex gap-2 flex-wrap">
            {BUG_PRIORITIES.map(p => {
              const on = priority === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  aria-pressed={on}
                  className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{
                    // `--warning` = precisa de atenção e não é o usuário que
                    // resolve, que é exatamente o caso de um bug reportado.
                    // `--danger` fica reservado a erro/bloqueio de input.
                    background: on ? "var(--warning-bg)" : "transparent",
                    color: on ? "var(--warning)" : "var(--text-dim)",
                    border: `1px solid ${on ? "var(--warning)" : "var(--border)"}`,
                    cursor: "pointer",
                  }}
                >
                  {p.pill}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>Onde</label>
          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
          >
            {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {error && (
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border)", cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: canSubmit ? "pointer" : "default", opacity: canSubmit ? 1 : 0.5 }}
          >
            {submitting ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ReportBugModal;
