import React, { useState } from "react";
import { FileText, LogOut, Check } from "lucide-react";
import { Button } from "../ui/Button";

// Bloqueio de tela cheia até aceitar os termos de uso vigentes — proteção
// jurídica pra empresa (ver migration terms_acceptances). O TEXTO abaixo é
// um rascunho, não foi revisado por advogado — precisa passar pelo
// jurídico antes de valer como termo real. Trocar o texto sem incrementar
// CURRENT_TERMS_VERSION (use-terms-acceptance.js) não obriga reaceite de
// quem já aceitou a versão anterior.
export function TermsGateScreen({ currentUser, onAccept, onLogout }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleAccept = async () => {
    setSaving(true);
    setError(null);
    const err = await onAccept?.();
    setSaving(false);
    if (err) setError("Não foi possível registrar o aceite. Tente de novo.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border p-8"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-pop)" }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: "var(--accent-tint)" }}
        >
          <FileText size={22} style={{ color: "var(--text)" }} />
        </div>

        <h1 className="font-bold leading-tight mb-3" style={{ fontSize: 22, color: "var(--text)", letterSpacing: "-0.01em" }}>
          Termos de uso da plataforma
        </h1>

        <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
          Olá, {currentUser?.name?.split(" ")[0] || "tudo bem"}. Antes de continuar, leia e aceite os termos abaixo.
        </p>

        <div
          className="text-xs mb-4 p-4 rounded-xl leading-relaxed"
          style={{ background: "var(--surface-alt)", color: "var(--text)", maxHeight: 220, overflowY: "auto" }}
        >
          <p style={{ marginBottom: 8 }}>
            <strong>Rascunho — pendente de revisão jurídica.</strong> Este texto ainda não foi validado por um
            advogado; a versão final deve substituí-lo antes de valer como termo vinculante.
          </p>
          <p style={{ marginBottom: 8 }}>
            Ao usar esta plataforma, você concorda que as informações que acessar aqui — dados de colaboradores,
            clientes, leads, contratos, valores e demais informações internas do Grupo Sanwey — são confidenciais
            e de uso exclusivamente interno. Não devem ser compartilhadas, copiadas ou repassadas a terceiros,
            incluindo concorrentes, sem autorização expressa da empresa.
          </p>
          <p style={{ marginBottom: 8 }}>
            Dados pessoais de colaboradores (nome, CPF, remuneração, documentos, endereço e afins) são tratados
            conforme a Lei Geral de Proteção de Dados (LGPD) e só devem ser acessados na medida em que forem
            necessários pra sua função.
          </p>
          <p>
            O uso indevido dessas informações pode resultar em medidas administrativas e legais cabíveis.
          </p>
        </div>

        <label className="flex items-start gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span className="text-xs" style={{ color: "var(--text)" }}>
            Li e concordo com os termos de uso e com a confidencialidade das informações acessadas nesta plataforma.
          </span>
        </label>

        {error && (
          <div className="text-xs mb-4" style={{ color: "var(--danger)" }}>{error}</div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            size="md"
            icon={Check}
            onClick={handleAccept}
            disabled={!checked || saving}
            className="w-full justify-center"
          >
            {saving ? "Registrando…" : "Aceitar e continuar"}
          </Button>
          <Button
            variant="ghost"
            size="md"
            icon={LogOut}
            onClick={onLogout}
            className="w-full justify-center"
          >
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TermsGateScreen;
