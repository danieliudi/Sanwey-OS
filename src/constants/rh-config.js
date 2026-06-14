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

export const RH_CONTRACT_TYPES = [
  { id: "clt",        label: "CLT" },
  { id: "pj",         label: "PJ" },
  { id: "estagio",    label: "Estágio" },
  { id: "temporario", label: "Temporário" },
  { id: "autonomo",   label: "Autônomo" },
  { id: "socio",      label: "Sócio" },
];

export const RH_EMPLOYEE_STATUSES = [
  { id: "ativo",      label: "Ativo",      color: "#16A34A", bg: "#DCFCE7" },
  { id: "ferias",     label: "Férias",     color: "#1D4ED8", bg: "#DBEAFE" },
  { id: "afastado",   label: "Afastado",   color: "#D97706", bg: "#FEF3C7" },
  { id: "desligado",  label: "Desligado",  color: "#6B7280", bg: "#F3F4F6" },
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
