import React, { useCallback, useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, AlertTriangle, Check, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Modal } from "../ui/Modal";
import { lerPlanilha, mapearColunas, celula, EXTENSOES_ACEITAS } from "../../utils/planilha-import";

// Importar pessoas por planilha (e-mail · Departamento · Nome), decidido com
// o Daniel em 11/09/2026 sobre mockup.
//
// A PRÉVIA e a GRAVAÇÃO chamam a MESMA função do banco, com `p_aplicar`
// decidindo só se escreve. É o ponto do desenho: prévia calculada aqui em
// JavaScript e gravação feita lá em SQL divergem com o tempo — a tela diz 12
// atualizações, o banco faz 11, e ninguém descobre.

const ESQUEMA = {
  // Ordem importa: o primeiro candidato que casar vence. "nome" vem depois de
  // "nomecompleto" pra uma planilha com as duas colunas não pegar a errada.
  email:        ["e-mail", "email", "e mail", "endereco de e-mail"],
  departamento: ["departamento", "setor", "area", "depto"],
  nome:         ["nome completo", "nome"],
};

const ACOES = {
  criar:       { rotulo: "cria",        cor: "var(--success)",  bg: "var(--success-bg)" },
  atualizar:   { rotulo: "atualiza",    cor: "var(--amber)",    bg: "var(--amber-bg)" },
  sem_mudanca: { rotulo: "nada muda",   cor: "var(--text-dim)", bg: "var(--surface-alt)" },
  ignorada:    { rotulo: "fora",        cor: "var(--danger)",   bg: "var(--danger-bg)" },
};


export function ColaboradorImportModal({ open, onClose, onImported }) {
  const fileRef = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [linhas, setLinhas] = useState([]);      // payload pro banco
  const [previa, setPrevia] = useState(null);    // resultado da simulação
  const [faltando, setFaltando] = useState([]);  // colunas não encontradas
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [feito, setFeito] = useState(null);

  const limpar = useCallback(() => {
    setArquivo(null); setLinhas([]); setPrevia(null);
    setFaltando([]); setErro(""); setFeito(null);
  }, []);

  const fechar = () => { limpar(); onClose(); };

  const simular = useCallback(async (payload) => {
    const { data, error } = await supabase.rpc("importar_colaboradores", {
      p_linhas: payload, p_aplicar: false,
    });
    if (error) throw new Error(error.message);
    return data || [];
  }, []);

  const handleArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    limpar();
    setArquivo(file);
    setLendo(true);
    try {
      const r = await lerPlanilha(file);
      if (r.erro) { setErro(r.erro); return; }

      const mapa = mapearColunas(r.cabecalhos, ESQUEMA);
      // `nome` e `email` são as duas que a importação não consegue inventar.
      // Departamento pode faltar — a planilha ainda serve pra cadastrar gente.
      const faltas = ["email", "nome"].filter((k) => mapa[k] === undefined);
      setFaltando(faltas);
      if (faltas.length) return;

      const payload = r.linhas.map((l) => ({
        linha: l.numero,
        email: celula(l, mapa.email),
        nome: celula(l, mapa.nome),
        departamento: celula(l, mapa.departamento),
      }));
      setLinhas(payload);
      setPrevia(await simular(payload));
    } catch (ex) {
      setErro(ex?.message || "Não foi possível ler a planilha.");
    } finally {
      setLendo(false);
    }
  };

  const confirmar = async () => {
    setGravando(true); setErro("");
    try {
      const { data, error } = await supabase.rpc("importar_colaboradores", {
        p_linhas: linhas, p_aplicar: true,
      });
      if (error) throw new Error(error.message);
      setFeito(data || []);
      onImported?.();
    } catch (ex) {
      setErro(ex?.message || "Não foi possível importar.");
    } finally {
      setGravando(false);
    }
  };

  const resultado = feito || previa;

  // Origem dos números (CLAUDE.md regra 14): cada contagem é o número de
  // linhas da planilha cuja ação o BANCO decidiu — não uma conta paralela
  // feita aqui. Linha descartada aparece contada, com o motivo, em vez de
  // sumir do total.
  const contagem = useMemo(() => {
    const c = { criar: 0, atualizar: 0, sem_mudanca: 0, ignorada: 0 };
    for (const r of resultado || []) if (r.acao in c) c[r.acao] += 1;
    return c;
  }, [resultado]);

  const temAlgoPraFazer = contagem.criar + contagem.atualizar > 0;

  return (
    <Modal open={open} onClose={fechar} title="Importar pessoas" width={720}>
      <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>

        {!feito && (
          <>
            <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
              A planilha precisa ter uma coluna de <strong style={{ color: "var(--text)" }}>e-mail</strong> e uma de{" "}
              <strong style={{ color: "var(--text)" }}>nome</strong>. <strong style={{ color: "var(--text)" }}>Departamento</strong> é opcional.
              Quem já existe é encontrado pelo e-mail e atualizado; quem não existe é criado como ficha, sem login.
            </div>

            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={lendo}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--surface-alt)", border: "1px dashed var(--border-strong)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "var(--text)", cursor: lendo ? "default" : "pointer" }}
              >
                {lendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {lendo ? "Lendo…" : arquivo ? "Escolher outra planilha" : "Escolher planilha"}
              </button>
              {arquivo && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 10, fontSize: 12, color: "var(--text-dim)" }}>
                  <FileSpreadsheet size={12} /> {arquivo.name}
                </span>
              )}
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                Aceita .xlsx, .xls e .csv · até 5 MB
              </div>
              <input ref={fileRef} type="file" accept={EXTENSOES_ACEITAS} onChange={handleArquivo} style={{ display: "none" }} />
            </div>
          </>
        )}

        {faltando.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--warning-bg)", color: "var(--warning)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Não achei {faltando.length === 1 ? "a coluna" : "as colunas"} de{" "}
              <strong>{faltando.map((f) => (f === "email" ? "e-mail" : "nome")).join(" e ")}</strong> no cabeçalho da planilha.
              O cabeçalho precisa estar na primeira linha.
            </span>
          </div>
        )}

        {erro && (
          <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5 }}>{erro}</div>
        )}

        {resultado && resultado.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
              {feito ? <Check size={14} style={{ color: "var(--success)" }} /> : null}
              <span>
                <strong>{contagem.criar}</strong> {feito ? "criadas" : "cria"} ·{" "}
                <strong>{contagem.atualizar}</strong> {feito ? "atualizadas" : "atualiza"} ·{" "}
                <strong>{contagem.sem_mudanca}</strong> sem mudança ·{" "}
                <strong>{contagem.ignorada}</strong> fora
              </span>
              <span style={{ color: "var(--text-dim)" }}>de {resultado.length} linha{resultado.length !== 1 ? "s" : ""}</span>
            </div>

            <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    {["Linha", "Nome", "E-mail", "O que acontece"].map((h, i) => (
                      <th key={h} style={{ position: "sticky", top: 0, background: "var(--surface-alt)", textAlign: "left", padding: "7px 10px", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", width: i === 0 ? 56 : undefined }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.map((r) => {
                    const a = ACOES[r.acao] || ACOES.ignorada;
                    return (
                      <tr key={r.linha} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 10px", color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>{r.linha}</td>
                        <td style={{ padding: "6px 10px", color: "var(--text)" }}>{r.nome || <span style={{ color: "var(--text-dim)" }}>—</span>}</td>
                        <td style={{ padding: "6px 10px", color: "var(--text-dim)", wordBreak: "break-all" }}>{r.email || "—"}</td>
                        <td style={{ padding: "6px 10px" }}>
                          <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: a.cor, background: a.bg, borderRadius: 99, padding: "2px 8px" }}>{a.rotulo}</span>
                          {r.detalhe && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>{r.detalhe}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {resultado && resultado.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>A planilha não tem nenhuma linha preenchida abaixo do cabeçalho.</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {feito ? (
            <button onClick={fechar} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Fechar
            </button>
          ) : (
            <>
              <button onClick={fechar} style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={!temAlgoPraFazer || gravando}
                title={!temAlgoPraFazer ? "Nenhuma linha cria ou atualiza alguém" : undefined}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: temAlgoPraFazer && !gravando ? "pointer" : "default", opacity: temAlgoPraFazer && !gravando ? 1 : 0.5 }}
              >
                {gravando && <Loader2 size={13} className="animate-spin" />}
                {gravando ? "Importando…" : "Confirmar importação"}
              </button>
            </>
          )}
        </div>

        {!feito && resultado && (
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: -6 }}>
            Nada foi gravado ainda. A prévia acima é calculada pelo mesmo cálculo que vai gravar.
          </div>
        )}
      </div>
    </Modal>
  );
}

export default ColaboradorImportModal;
