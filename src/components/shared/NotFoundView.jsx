import React from "react";
import { SearchX } from "lucide-react";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";

// N-02 da auditoria funcional (19/08/2026): rota inexistente/renomeada caía
// em silêncio na tela de login/dashboard, sem nenhum aviso — mockup
// aprovado 20/08/2026. Só cobre o usuário autenticado (ver catch-all em
// App.jsx); deslogado continua indo pra tela de login normalmente.
export function NotFoundView({ onBack }) {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
      <EmptyState
        icon={SearchX}
        title="Essa página não existe (mais)"
        description="O endereço pode ter sido digitado errado, ou a tela mudou de lugar numa atualização recente. Confira o menu ao lado ou volte pro painel."
        action={<Button variant="primary" onClick={onBack}>Voltar ao painel</Button>}
      />
    </div>
  );
}

export default NotFoundView;
