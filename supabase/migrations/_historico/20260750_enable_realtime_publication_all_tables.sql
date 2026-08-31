-- Achado ao investigar "card de Compras não aparece sem dar refresh":
-- a publicação supabase_realtime existe mas está com 0 tabelas — nenhum dos
-- ~40 hooks que usam supabase.channel(...).on("postgres_changes", ...) pra
-- sincronizar em tempo real (Leads, Compras, Entregas, Solicitações, RH
-- inteiro, Clientes, Automações, Convites, Notificações etc.) de fato recebe
-- evento nenhum do banco — o replication slot nunca publicou nada pra essas
-- tabelas. O que parecia funcionar em várias telas era só a atualização
-- otimista local de quem fez a própria ação (não sincroniza com outra aba/
-- outro usuário, e nem toda ação faz esse update local — a de Compras não
-- fazia, por isso o sintoma reportado).
alter publication supabase_realtime add table
  public.clients,
  public.leads,
  public.rh_pesquisas,
  public.rh_beneficios_catalogo,
  public.rh_colaborador_beneficios,
  public.rh_movimentacoes,
  public.rh_bemestar_sessoes,
  public.rh_bemestar_fila,
  public.rh_cargo_templates,
  public.pipeline_stage_transitions,
  public.rh_signature_requests,
  public.rh_onboarding_templates,
  public.rh_onboarding_tarefas,
  public.rh_treinamentos,
  public.rh_treinamento_atribuicoes,
  public.pipeline_stage_fields,
  public.invitations,
  public.rh_colaboradores,
  public.automations,
  public.crm_viagem_despesas,
  public.profiles,
  public.rh_fornecedores,
  public.rh_fornecedor_contratos,
  public.rh_fornecedor_contrato_eventos,
  public.rh_avaliacoes,
  public.crm_viagem_categorias,
  public.crm_viagem_registros,
  public.rh_vagas,
  public.rh_candidatos,
  public.rh_aplicacoes,
  public.rh_pipeline_stages,
  public.marketing_supplier_quotes,
  public.marketing_purchase_requests,
  public.marketing_campaigns,
  public.marketing_deliverables,
  public.marketing_suppliers,
  public.marketing_requests,
  public.marketing_expenses,
  public.notifications,
  public.rh_pipeline_stage_fields,
  public.rh_ferias;
