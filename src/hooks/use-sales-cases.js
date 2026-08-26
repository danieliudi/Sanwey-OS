import { useCallback } from "react";
import { supabase } from "../lib/supabase";

// Aprendizado de venda ("sales_cases" no banco) — caso de prospecção
// (ganhamos/perdemos/andamento) registrado pelo time comercial, pra virar
// munição de playbook. Escrita simples via cliente normal do usuário (RLS
// decide o que pode ser gravado) — nunca service_role, mesmo padrão de
// use-leads.js/use-client-contacts.js. A IA (edge function
// caso-prospeccao-voz) só propõe o rascunho; é este hook que grava, sempre
// com aceite explícito do usuário na tela.
export function useSalesCases() {
  const insertCase = useCallback(async ({
    companyId, clientId, leadId, clienteNome, setor, resultado, situacao,
    sinais, objecaoPrincipal, concorrente, licao, categoriaLicao,
    rawTranscript, source, createdBy,
  }) => {
    const { data, error } = await supabase
      .from("sales_cases")
      .insert({
        company_id: companyId,
        client_id: clientId || null,
        lead_id: leadId || null,
        cliente_nome: clienteNome,
        setor: setor || null,
        resultado: resultado || null,
        situacao: situacao || null,
        sinais: sinais || null,
        objecao_principal: objecaoPrincipal || null,
        concorrente: concorrente || null,
        licao: licao || null,
        categoria_licao: categoriaLicao || [],
        raw_transcript: rawTranscript || null,
        source: source || "voz",
        created_by: createdBy || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }, []);

  return { insertCase };
}

export default useSalesCases;
