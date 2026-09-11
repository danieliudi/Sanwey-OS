import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

// Página pública do botão "Confirmei a leitura" do e-mail de comunicado.
//
// Sem login de propósito: o link chega por e-mail e a pessoa clica no celular,
// deslogada. O segredo é o token, que é pessoal por destinatário — o link de
// uma pessoa não confirma pela outra.
//
// A RPC devolve o mesmo resultado para token inválido e token inexistente, pra
// a página não virar um oráculo de "este comunicado existe".

const CASCA = {
  minHeight: "100vh", background: "#F9F5F1", display: "flex",
  alignItems: "center", justifyContent: "center", padding: 20,
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};
const CARTAO = {
  background: "#fff", border: "1px solid #E5E0DA", borderRadius: 16,
  padding: "36px 32px", maxWidth: 440, width: "100%", textAlign: "center",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

export default function ComunicadoConfirmacao() {
  const { token } = useParams();
  const [estado, setEstado] = useState("carregando"); // carregando | ok | ja | invalido | erro
  const [titulo, setTitulo] = useState("");

  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!isSupabaseConfigured) { if (ativo) setEstado("erro"); return; }
      try {
        const { data, error } = await supabase.rpc("confirmar_leitura_por_token", { p_token: token });
        if (!ativo) return;
        if (error) { setEstado("erro"); return; }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.ok) { setEstado("invalido"); return; }
        setTitulo(row.titulo || "");
        setEstado(row.ja_confirmado ? "ja" : "ok");
      } catch {
        if (ativo) setEstado("erro");
      }
    })();
    return () => { ativo = false; };
  }, [token]);

  const logo = (
    <img
      src="/sanwey-logo.png" alt="Grupo Sanwey" width={150}
      style={{ display: "block", height: "auto", margin: "0 auto 26px" }}
    />
  );

  if (estado === "carregando") {
    return (
      <div style={CASCA}><div style={CARTAO}>{logo}
        <Loader2 size={22} className="animate-spin" style={{ color: "#8A8680", margin: "0 auto" }} />
      </div></div>
    );
  }

  if (estado === "ok" || estado === "ja") {
    return (
      <div style={CASCA}><div style={CARTAO}>{logo}
        <CheckCircle2 size={40} style={{ color: "#16A34A", margin: "0 auto 14px", display: "block" }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#201a1a", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
          {estado === "ja" ? "Você já tinha confirmado" : "Leitura confirmada"}
        </h1>
        {titulo && (
          <p style={{ fontSize: 15, color: "#201a1a", margin: "0 0 10px", fontWeight: 600 }}>{titulo}</p>
        )}
        <p style={{ fontSize: 13, color: "#6f6763", margin: 0, lineHeight: 1.6 }}>
          O RH registrou que você recebeu e reconheceu este comunicado. Pode fechar esta página.
        </p>
      </div></div>
    );
  }

  // Inválido e erro dizem coisas diferentes de propósito: um é link gasto ou
  // errado, o outro é a plataforma fora do ar. Misturar os dois faria a pessoa
  // procurar um link novo quando o problema era nosso.
  return (
    <div style={CASCA}><div style={CARTAO}>{logo}
      <AlertCircle size={40} style={{ color: estado === "invalido" ? "#E8920A" : "#C7212B", margin: "0 auto 14px", display: "block" }} />
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#201a1a", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
        {estado === "invalido" ? "Este link não confere" : "Não deu para confirmar agora"}
      </h1>
      <p style={{ fontSize: 13, color: "#6f6763", margin: 0, lineHeight: 1.6 }}>
        {estado === "invalido"
          ? "O link pode ter sido copiado pela metade, ou ser de um comunicado que não existe mais. Você ainda pode confirmar a leitura abrindo o comunicado na plataforma."
          : "Tente de novo em alguns minutos. Se continuar, confirme a leitura direto na plataforma."}
      </p>
    </div></div>
  );
}
