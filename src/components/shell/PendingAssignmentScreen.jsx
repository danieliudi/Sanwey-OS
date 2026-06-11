import React, { useState } from "react";
import { Clock, LogOut, RefreshCw, Mail } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { Button } from "../ui/Button";

export function PendingAssignmentScreen({ currentUser, onRefresh, onLogout }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh?.(); } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#F5F5F3" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-8"
        style={{ background: "#FFFFFF", borderColor: "#E8E8E8", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: (NEUTRAL.gold || "#F59E0B") + "20" }}
        >
          <Clock size={22} color={NEUTRAL.gold || "#F59E0B"} />
        </div>

        <p className="text-xs font-semibold mb-2" style={{ color: NEUTRAL.slate }}>
          Acesso pendente
        </p>

        <h1 className="font-bold leading-tight mb-3" style={{ fontSize: 22, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>
          Aguardando liberação do administrador
        </h1>

        <p className="text-sm mb-5 leading-relaxed" style={{ color: NEUTRAL.slate }}>
          Sua conta foi criada com sucesso, mas ainda não foi atribuída a nenhuma
          empresa do grupo. Assim que o administrador liberar seu acesso, você
          poderá ver os leads e o pipeline da sua carteira.
        </p>

        <div
          className="p-3.5 rounded-xl mb-5 text-xs space-y-2"
          style={{ background: "#F5F5F3", color: NEUTRAL.graphite }}
        >
          <div className="flex items-center gap-2">
            <Mail size={12} color={NEUTRAL.slate} />
            <span style={{ color: NEUTRAL.slate }}>Email:</span>
            <span className="font-semibold">{currentUser?.email || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: NEUTRAL.slate }}>Papel</span>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: "#E8E8E8", color: NEUTRAL.graphite }}
            >
              {currentUser?.role || "vendedor"}
            </span>
            <span className="text-[10px]" style={{ color: NEUTRAL.slate }}>
              · sem empresas atribuídas
            </span>
          </div>
        </div>

        <div
          className="text-xs mb-5 p-3.5 rounded-xl leading-relaxed"
          style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}
        >
          <strong>Dica:</strong> peça ao administrador para abrir <em>Usuários</em> e
          atribuir pelo menos uma empresa (Sanwey ou Resibag)
          ao seu email. Depois clique em "Já fui liberado" abaixo.
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            size="md"
            icon={RefreshCw}
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full justify-center"
          >
            {refreshing ? "Verificando…" : "Já fui liberado · verificar"}
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

export default PendingAssignmentScreen;
