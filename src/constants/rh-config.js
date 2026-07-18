// ── RH Module Constants ───────────────────────────────────────────────────────

export const RH_DEPARTMENTS = [
  "Comercial",
  "Marketing",
  "Operações",
  "Logística",
  "Financeiro",
  "Recursos Humanos",
  "TI",
  "Jurídico",
  "Diretoria",
  "Produção",
  "Qualidade",
  "Atendimento",
];

// Departamentos operacionais/chão-de-fábrica — usado tanto pra tornar
// currículo opcional na candidatura pública (candidato de produção
// raramente tem currículo formatado) quanto, futuramente, pra exigir
// turno só de quem realmente trabalha em escala.
export const RH_OPERATIONAL_DEPARTMENTS = ["Operações", "Logística", "Produção", "Qualidade"];

export const RH_CONTRACT_TYPES = [
  { id: "clt",        label: "CLT" },
  { id: "pj",         label: "PJ" },
  { id: "estagio",    label: "Estágio" },
  { id: "aprendiz",   label: "Jovem Aprendiz" },
  { id: "temporario", label: "Temporário" },
  { id: "autonomo",   label: "Autônomo" },
  { id: "socio",      label: "Sócio" },
];

// Cota de jovens aprendizes (Áudio 6 do RH). A Lei do Aprendiz exige um
// percentual do quadro — o número exato varia por empresa, então o RH define
// a meta aqui. 0 = "não definida" (o painel só mostra a contagem de ativos).
// Futuro (Onda 2+): mover pra uma tela de configuração de RH.
export const RH_APRENDIZ_COTA_ALVO = 0;

export const RH_EMPLOYEE_STATUSES = [
  { id: "ativo",      label: "Ativo",      color: "#16A34A", bg: "#DCFCE7" },
  { id: "ferias",     label: "Férias",     color: "#1D4ED8", bg: "#DBEAFE" },
  { id: "afastado",   label: "Afastado",   color: "#D97706", bg: "#FEF3C7" },
  { id: "desligado",  label: "Desligado",  color: "#6B7280", bg: "#F3F4F6" },
];

// Offboarding (Onda 3, item 10) — tipo do desligamento (bate com o CHECK da
// coluna rh_colaboradores.desligamento_tipo) e as perguntas da entrevista de
// saída (respostas gravadas em desligamento_meta por chave `key`).
export const RH_DESLIGAMENTO_TIPOS = [
  { id: "voluntario",   label: "Voluntário (pediu demissão)", voluntario: true },
  { id: "involuntario", label: "Involuntário (demitido)",     voluntario: false },
  { id: "fim_contrato", label: "Fim de contrato",             voluntario: false },
  { id: "justa_causa",  label: "Justa causa",                 voluntario: false },
  { id: "acordo",       label: "Acordo",                      voluntario: null },
];

export const RH_ENTREVISTA_SAIDA_PERGUNTAS = [
  { key: "motivo_principal", label: "Motivo principal da saída" },
  { key: "pontos_positivos", label: "O que a empresa faz bem" },
  { key: "pontos_melhoria",  label: "O que a empresa poderia melhorar" },
  { key: "recontrataria",    label: "Recontrataria / recomendaria a empresa?" },
];

export const RH_RECRUITMENT_STAGES = [
  { id: "triagem",     name: "Triagem",          color: "#6366F1", order: 1 },
  { id: "entrevista1", name: "Entrevista RH",     color: "#0EA5E9", order: 2 },
  { id: "entrevista2", name: "Entrevista Gestor", color: "#8B5CF6", order: 3 },
  { id: "tecnico",     name: "Teste Técnico",     color: "#F59E0B", order: 4 },
  { id: "proposta",    name: "Proposta",          color: "#10B981", order: 5 },
  { id: "aprovado",    name: "Aprovado",          color: "#16A34A", order: 6 },
  { id: "reprovado",   name: "Reprovado",         color: "#6B7280", order: 7 },
];

export const RH_LEAVE_TYPES = [
  { id: "ferias",         label: "Férias" },
  { id: "licenca_medica", label: "Licença Médica" },
  { id: "licenca_maternidade", label: "Licença Maternidade" },
  { id: "licenca_paternidade", label: "Licença Paternidade" },
  { id: "folga",          label: "Folga Compensatória" },
  { id: "luto",           label: "Licença Luto" },
  { id: "outros",         label: "Outros" },
];
