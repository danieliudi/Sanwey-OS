// Standard field definitions for the lead creation form.
// "locked" fields cannot be removed from the form.

export const FIELD_DEFS = {
  company: {
    id: "company", label: "Empresa", type: "text",
    placeholder: "Nome da empresa", locked: true, group: "Padrão",
  },
  razaoSocial: {
    id: "razaoSocial", label: "Razão social", type: "text",
    placeholder: "Razão social", locked: false, group: "Padrão",
  },
  cnpj: {
    id: "cnpj", label: "CNPJ", type: "text",
    placeholder: "00.000.000/0001-00", locked: false, group: "Padrão",
  },
  sector: {
    id: "sector", label: "Setor", type: "sector",
    placeholder: "Selecione o setor", locked: false, group: "Padrão",
  },
  value: {
    id: "value", label: "Valor (R$)", type: "currency",
    placeholder: "0,00", locked: false, group: "Padrão",
  },
  owner: {
    id: "owner", label: "Responsável", type: "user",
    placeholder: "Selecione", locked: false, group: "Padrão",
  },
  closeDate: {
    id: "closeDate", label: "Data de fechamento", type: "date",
    placeholder: "", locked: false, group: "Padrão",
  },
  contactEmail: {
    id: "contactEmail", label: "E-mail do contato", type: "email",
    placeholder: "email@empresa.com.br", locked: false, group: "Contato",
  },
  phone: {
    id: "phone", label: "Telefone", type: "phone",
    placeholder: "(00) 00000-0000", locked: false, group: "Contato",
  },
  city: {
    id: "city", label: "Cidade", type: "text",
    placeholder: "Cidade", locked: false, group: "Localização",
  },
  state: {
    id: "state", label: "Estado (UF)", type: "state",
    placeholder: "Selecione", locked: false, group: "Localização",
  },
  notes: {
    id: "notes", label: "Observações", type: "textarea",
    placeholder: "Adicione uma observação…", locked: false, group: "Outros",
  },
};

export const FIELD_DEFS_ARRAY = Object.values(FIELD_DEFS);

export const DEFAULT_FORM_CONFIG = [
  { id: "company",  required: true,  locked: true  },
  // Achado real (27/08/2026): sem CNPJ visível, o dedup de cliente cai pro
  // nome digitado batendo EXATO com a razão social cadastrada — nome curto
  // não bate com razão social completa, e um cliente duplicado nasce em
  // silêncio (caso real: Casa Granado). Visível por padrão a partir daqui;
  // não travado, pra quem prospecta sem o CNPJ em mãos ainda poder seguir.
  { id: "cnpj",     required: false, locked: false },
  { id: "value",    required: false, locked: false },
  { id: "sector",   required: true,  locked: false },
  { id: "owner",    required: false, locked: false },
];
