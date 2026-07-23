import {
  Type, AlignLeft, Hash, DollarSign, Calendar, Clock, Mail, Phone,
  Link, CheckSquare, List, RadioTower, ListChecks, User,
} from "lucide-react";

// Catálogo único de tipos de campo customizado por etapa — mesmo conjunto
// pro CRM (pipeline_stage_fields) e pro RH (rh_pipeline_stage_fields).
export const FIELD_TYPES = [
  { value: "text",       label: "Texto curto" },
  { value: "textarea",   label: "Texto longo" },
  { value: "number",     label: "Número" },
  { value: "currency",   label: "Moeda (R$)" },
  { value: "date",       label: "Data" },
  { value: "datetime",   label: "Data e hora" },
  { value: "time",       label: "Hora (HH:MM)" },
  { value: "email",      label: "E-mail" },
  { value: "phone",      label: "Telefone" },
  { value: "url",        label: "URL" },
  { value: "checkbox",   label: "Caixa de seleção" },
  { value: "select",     label: "Lista suspensa" },
  { value: "radio",      label: "Escolha única (radio)" },
  { value: "multicheck", label: "Múltiplas escolhas" },
  { value: "user",       label: "Usuário do sistema" },
];

export const TYPE_ICON = {
  text:       Type,
  textarea:   AlignLeft,
  number:     Hash,
  currency:   DollarSign,
  date:       Calendar,
  datetime:   Calendar,
  time:       Clock,
  email:      Mail,
  phone:      Phone,
  url:        Link,
  checkbox:   CheckSquare,
  select:     List,
  radio:      RadioTower,
  multicheck: ListChecks,
  user:       User,
};

export const OPTION_FIELD_TYPES = ["select", "radio", "multicheck"];
