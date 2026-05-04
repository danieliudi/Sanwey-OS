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
      style={{
        background: NEUTRAL.warmWhite,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
      }}
    >
      <div
        className="w-full max-w-md rounded-sm border p-8"
        style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}
      >
        <div
          className="w-12 h-12 rounded-sm flex items-center justify-center mb-5"
          style={{ background: NEUTRAL.gold + "20" }}
        >
          <Clock size={22} color={NEUTRAL.gold} />
        </div>

        <div
          className="text-[10px] uppercase font-bold tracking-widest mb-2"
          style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
        >
          Acesso pendente
        </div>

        <h1 className="font-bold leading-tight mb-3" style={{ fontSize: 22, color: NEUTRAL.graphite }}>
          Aguardando liberação do administrador
        </h1>

        <p className="text-sm mb-5" style={{ color: NEUTRAL.slate, lineHeight: 1.5 }}>
          Sua conta foi criada com sucesso, mas ainda não foi atribuída a nenhuma
          empresa do grupo. Assim que o administrador liberar seu acesso, você
          poderá ver os leads e o pipeline da sua carteira.
        </p>

        <div
          className="p-3 rounded-sm mb-5 text-xs space-y-1"
          style={{ background: NEUTRAL.warmWhite, color: NEUTRAL.graphite }}
        >
          <div className="flex items-center gap-2">
            <Mail size={12} color={NEUTRAL.slate} />
            <span style={{ color: NEUTRAL.slate }}>Email:</span>
            <span className="font-semibold">{currentUser?.email || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}>
              Papel
            </span>
            <span
              className="px-1.5 py-0.5 rounded-sm text-[10px] uppercase font-semibold"
              style={{ background: "#EFEFEF", color: NEUTRAL.graphite }}
            >
              {currentUser?.role || "vendedor"}
            </span>
            <span className="text-[10px]" style={{ color: NEUTRAL.slate }}>
              · sem empresas atribuídas
            </span>
          </div>
        </div>

        <div
          className="text-[11px] mb-5 p-3 rounded-sm"
          style={{ background: "#FEF9E7", color: "#8A6A00" }}
        >
          <strong>Dica:</strong> peça ao administrador para abrir <em>Usuários</em> e
          atribuir pelo menos uma empresa (Indústria, Resibag ou Monte Mor)
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
