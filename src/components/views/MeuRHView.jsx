import React, { useMemo, useState } from "react";
import {
  Home, Megaphone, ClipboardCheck, GraduationCap, MessageSquareText,
  CalendarCheck, FileText, User, Plus, Loader2, Pencil, X, Check,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useMyColaborador } from "../../hooks/use-my-colaborador";
import { RHOnboardingView } from "./RHOnboardingView";
import { RHTreinamentosView } from "./RHTreinamentosView";
import { RHFeedbackView } from "./RHFeedbackView";
import { RHAttachmentsPanel } from "../rh-pipeline/RHDetailDrawerShell";
import { RH_LEAVE_TYPES } from "../../constants/rh-config";
import { formatDateBR } from "../../utils/date";
import { computeFeriasSaldo } from "../../utils/rh-ferias-saldo";
import { EmptyState } from "../ui/EmptyState";

// Painel do colaborador (/meu-rh) — pra quem tem login mas nenhum cargo
// operacional (papel "portal", ver migration 20260740) e, opcionalmente,
// pra qualquer colaborador comum acessar as próprias telas num só lugar.
// Reaproveita as telas "self" que RHOnboardingView/RHTreinamentosView/
// RHFeedbackView já tinham (isRHUser=false) em vez de duplicar UI.

// Onboarding/Treinamentos/Avaliação só entram aqui como aba pra quem não tem
// outro jeito de chegar nelas (papel "portal", único item de menu é este) —
// achado do Daniel 10/08/2026: pra todo mundo com "Meu Desenvolvimento" na
// sidebar, essas 3 abas duplicavam exatamente os itens soltos do menu (mesmo
// componente, isRHUser=false, reaproveitado nos dois lugares). Ver
// `isPortalOnly` abaixo — filtra as abas condicionalmente, não remove o
// código das telas em si (Portal ainda depende delas).
const TABS_FULL = [
  { id: "comunicados",   label: "Comunicados",   icon: Megaphone },
  { id: "onboarding",    label: "Onboarding",     icon: ClipboardCheck },
  { id: "treinamentos",  label: "Treinamentos",   icon: GraduationCap },
  { id: "avaliacao",     label: "Avaliação",      icon: MessageSquareText },
  { id: "ferias",        label: "Férias",         icon: CalendarCheck },
  { id: "documentos",    label: "Documentos",     icon: FileText },
  { id: "meus-dados",    label: "Meus Dados",     icon: User },
];
const REDUNDANT_WITH_SIDEBAR = new Set(["onboarding", "treinamentos", "avaliacao"]);

const STATUS_INFO = {
  pendente: { label: "Pendente", bg: "var(--warning-bg)", text: "var(--warning)" },
  aprovado: { label: "Aprovado", bg: "var(--success-bg)", text: "var(--success)" },
  recusado: { label: "Recusado", bg: "var(--danger-bg)",  text: "var(--danger)" },
};

// notifications/markRead vêm por prop (do useServerNotifications já chamado
// em App.jsx), não de uma 2ª chamada do hook aqui — App.jsx assina o canal
// Realtime "notifications_<userId>" globalmente; uma 2ª assinatura com o
// mesmo nome de canal, ao montar esta tela, derrubava o app inteiro com
// "cannot add 'postgres_changes' callback ... after 'subscribe()'".
function ComunicadosPanel({ notifications, markRead }) {
  const comunicados = useMemo(
    () => notifications.filter(n => n.type === "comunicado" || n.type === "comunicado_importante"),
    [notifications]
  );

  if (comunicados.length === 0) {
    return <EmptyState icon={Megaphone} title="Nenhum comunicado" description="Avisos do RH aparecem aqui." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {comunicados.map(c => (
        <div
          key={c.id}
          onClick={() => !c.read && markRead(c.id)}
          className="cursor-pointer"
          style={{
            border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px",
            background: c.read ? "var(--surface)" : "var(--surface-alt)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{c.title}</div>
            {!c.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{c.body}</div>
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6 }}>{formatDateBR(c.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}

// colaboradorId (rh_colaboradores.id), NÃO o id do profile: a FK de
// rh_ferias.user_id foi migrada pra rh_colaboradores em 20260787, e as
// policies de read/insert comparam por essa coluna. Gravar o id do profile
// aqui violava a FK e fazia a lista voltar sempre vazia.
function SolicitarFeriasForm({ colaboradorId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("ferias");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!startDate || !endDate) { setError("Preencha as duas datas."); return; }
    if (endDate < startDate) { setError("Data final não pode ser antes da inicial."); return; }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("rh_ferias").insert({
      user_id: colaboradorId,
      type,
      start_date: startDate,
      end_date: endDate,
      notes: notes || null,
      status: "pendente",
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setStartDate(""); setEndDate(""); setNotes(""); setType("ferias");
    setOpen(false);
    onCreated?.();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 font-semibold"
        style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "6px 16px", fontSize: 13, border: "none", cursor: "pointer", marginBottom: 16 }}
      >
        <Plus size={14} /> Solicitar férias/afastamento
      </button>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16, background: "var(--surface-alt)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12 }}>
            {RH_LEAVE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div />
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>Início</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>Fim</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12 }} />
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Observação (opcional)"
        rows={2}
        style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, marginBottom: 10 }}
      />
      {error && <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 10 }}>{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}
        >
          {saving && <Loader2 size={12} className="animate-spin" />} Enviar solicitação
        </button>
        <button onClick={() => { setOpen(false); setError(null); }} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-dim)", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function MeuFeriasPanel({ colaboradorId, admissionDate }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = React.useCallback(async () => {
    if (!isSupabaseConfigured || !colaboradorId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("rh_ferias")
      .select("*")
      .eq("user_id", colaboradorId)
      .order("start_date", { ascending: false });
    setRequests(data || []);
    setLoading(false);
  }, [colaboradorId]);

  React.useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const leaveLabel = (typeId) => RH_LEAVE_TYPES.find(t => t.id === typeId)?.label || typeId;
  const saldo = useMemo(() => computeFeriasSaldo(admissionDate, requests), [admissionDate, requests]);

  return (
    <div>
      {saldo && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>{saldo.saldo}</span>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            dia(s) de férias disponíveis · {saldo.diasDireito} adquiridos, {saldo.diasGozados} já gozados
          </span>
        </div>
      )}
      <SolicitarFeriasForm colaboradorId={colaboradorId} onCreated={fetchRequests} />
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : requests.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Nenhuma solicitação ainda" description="Suas solicitações de férias/afastamento aparecem aqui." />
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map(r => {
            const info = STATUS_INFO[r.status] || STATUS_INFO.pendente;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{leaveLabel(r.type)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{formatDateBR(r.start_date)} – {formatDateBR(r.end_date)}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: info.bg, color: info.text }}>{info.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CAMPO_LABELS = [
  ["fullName", "Nome completo"], ["cpf", "CPF"], ["rg", "RG"],
  ["jobTitle", "Cargo"], ["department", "Departamento"],
  ["admissionDate", "Admissão"], ["employeeStatus", "Status"],
];

// Campos que a própria pessoa pode propor atualização — nome/CPF/RG/cargo/
// departamento/admissão exigem documento ou já têm fluxo próprio
// (rh_movimentacoes), então ficam de fora de propósito.
const EDITABLE_SIMPLE = [["phone", "phone", "Telefone"], ["email", "email", "E-mail"]];
const ADDRESS_FIELDS = [
  ["addressStreet", "address_street", "Rua"],
  ["addressNumber", "address_number", "Número"],
  ["addressComplement", "address_complement", "Complemento"],
  ["addressNeighborhood", "address_neighborhood", "Bairro"],
  ["addressCity", "address_city", "Cidade"],
  ["addressState", "address_state", "Estado"],
  ["addressZip", "address_zip", "CEP"],
];

const REQUEST_STATUS_INFO = {
  pendente: { label: "Aguardando RH", bg: "var(--warning-bg)", text: "var(--warning)" },
  aprovado: { label: "Aprovado",      bg: "var(--success-bg)", text: "var(--success)" },
  recusado: { label: "Recusado",      bg: "var(--danger-bg)",  text: "var(--danger)" },
};

async function insertDataUpdateRequest({ colaboradorId, currentUserId, field, currentValue, newValue, motivo }) {
  return supabase.from("rh_data_update_requests").insert({
    colaborador_id: colaboradorId,
    requested_by: currentUserId,
    field,
    current_value: currentValue || null,
    new_value: newValue,
    motivo: motivo || null,
  });
}

function EditFieldInline({ colaboradorId, currentUserId, dbField, currentValue, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentValue || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!value.trim() || value.trim() === (currentValue || "")) { setOpen(false); return; }
    setSaving(true);
    await insertDataUpdateRequest({ colaboradorId, currentUserId, field: dbField, currentValue, newValue: value.trim() });
    setSaving(false);
    setOpen(false);
    onSubmitted?.();
  };

  if (!open) {
    return (
      <button onClick={() => { setValue(currentValue || ""); setOpen(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "inline-flex" }}>
        <Pencil size={11} />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 mt-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", flex: 1 }}
      />
      <button onClick={submit} disabled={saving} style={{ background: "var(--accent)", border: "none", borderRadius: 6, padding: 4, cursor: "pointer", display: "flex" }}>
        <Check size={11} color="#FFF" />
      </button>
      <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}>
        <X size={11} />
      </button>
    </div>
  );
}

function EditEnderecoForm({ colaboradorId, currentUserId, meuColaborador, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => Object.fromEntries(ADDRESS_FIELDS.map(([key]) => [key, meuColaborador[key] || ""])));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const changed = ADDRESS_FIELDS.filter(([key]) => (values[key] || "").trim() !== (meuColaborador[key] || ""));
    if (changed.length === 0) { setOpen(false); return; }
    setSaving(true);
    await Promise.all(changed.map(([key, dbField]) =>
      insertDataUpdateRequest({ colaboradorId, currentUserId, field: dbField, currentValue: meuColaborador[key], newValue: (values[key] || "").trim() })
    ));
    setSaving(false);
    setOpen(false);
    onSubmitted?.();
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
        <Pencil size={11} /> Atualizar endereço
      </button>
    );
  }
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginTop: 8, background: "var(--surface-alt)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {ADDRESS_FIELDS.map(([key, , label]) => (
          <div key={key}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)" }}>{label}</label>
            <input
              value={values[key]}
              onChange={(e) => setValues(v => ({ ...v, [key]: e.target.value }))}
              style={{ width: "100%", marginTop: 2, fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Enviando…" : "Enviar solicitação"}
        </button>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-dim)", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function MinhasSolicitacoesList({ currentUser, refreshKey }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured || !currentUser?.id) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from("rh_data_update_requests")
      .select("*")
      .eq("requested_by", currentUser.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (active) { setRequests(data || []); setLoading(false); } });
    return () => { active = false; };
  }, [currentUser?.id, refreshKey]);

  if (loading || requests.length === 0) return null;

  const fieldLabel = (f) => (EDITABLE_SIMPLE.find(e => e[1] === f) || ADDRESS_FIELDS.find(e => e[1] === f) || [null, null, f])[2];

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        Minhas solicitações de atualização
      </div>
      <div className="flex flex-col gap-1.5">
        {requests.map(r => {
          const info = REQUEST_STATUS_INFO[r.status] || REQUEST_STATUS_INFO.pendente;
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text)" }}>{fieldLabel(r.field)}: <span style={{ color: "var(--text-dim)" }}>{r.new_value}</span></span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: info.bg, color: info.text }}>{info.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MeusDadosPanel({ meuColaborador, currentUser }) {
  const [refreshKey, setRefreshKey] = useState(0);
  if (!meuColaborador) {
    return <EmptyState icon={User} title="Nenhum dado cadastrado" description="Fale com o RH se isso não for esperado." />;
  }
  const endereco = [
    meuColaborador.addressStreet, meuColaborador.addressNumber, meuColaborador.addressComplement,
    meuColaborador.addressNeighborhood, meuColaborador.addressCity, meuColaborador.addressState,
  ].filter(Boolean).join(", ");
  const bump = () => setRefreshKey(k => k + 1);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        {CAMPO_LABELS.map(([key, label]) => (
          <div key={key}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontSize: 13, color: "var(--text)", marginTop: 2 }}>
              {key === "admissionDate" ? formatDateBR(meuColaborador.admissionDate) : (meuColaborador[key] || "—")}
            </div>
          </div>
        ))}
        {EDITABLE_SIMPLE.map(([key, dbField, label]) => (
          <div key={key}>
            <div className="flex items-center gap-1.5">
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
              <EditFieldInline colaboradorId={meuColaborador.id} currentUserId={currentUser?.id} dbField={dbField} currentValue={meuColaborador[key]} onSubmitted={bump} />
            </div>
            <div style={{ fontSize: 13, color: "var(--text)", marginTop: 2 }}>{meuColaborador[key] || "—"}</div>
          </div>
        ))}
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Endereço</div>
          <div style={{ fontSize: 13, color: "var(--text)", marginTop: 2, marginBottom: 6 }}>{endereco || "—"}</div>
          <EditEnderecoForm colaboradorId={meuColaborador.id} currentUserId={currentUser?.id} meuColaborador={meuColaborador} onSubmitted={bump} />
        </div>
      </div>
      <MinhasSolicitacoesList currentUser={currentUser} refreshKey={refreshKey} />
      <p style={{ fontSize: 12, color: "var(--text-dim)", borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 16 }}>
        Nome, CPF, RG, cargo, departamento e admissão exigem documento — fale com o RH pra corrigir esses. Telefone,
        e-mail e endereço você pode propor atualização aqui; o RH revisa antes de valer.
      </p>
    </div>
  );
}

export function MeuRHView({ currentUser, notifyMentions, notifications, markNotificationRead, isPortalOnly = false }) {
  const [tab, setTab] = useState("comunicados");
  const { meuColaborador } = useMyColaborador(currentUser);
  // Portal não tem "Meu Desenvolvimento" na sidebar — pra esse papel, as 3
  // abas continuam sendo o único caminho até onboarding/treinamentos/
  // avaliação. Todo mundo com os itens soltos no menu não precisa da
  // duplicata aqui dentro.
  const TABS = isPortalOnly ? TABS_FULL : TABS_FULL.filter(t => !REDUNDANT_WITH_SIDEBAR.has(t.id));

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Home size={22} style={{ color: "var(--text)" }} />
        <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Meu RH</h1>
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
        {meuColaborador?.fullName ? `Olá, ${meuColaborador.fullName.split(" ")[0]}.` : "Bem-vindo(a)."} Tudo que você precisa acessar do RH está aqui.
      </p>

      <div className="flex gap-1 mb-5 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5"
              style={{
                padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: "none", border: "none", whiteSpace: "nowrap",
                color: active ? "var(--text)" : "var(--text-dim)",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "comunicados" && <ComunicadosPanel notifications={notifications} markRead={markNotificationRead} />}
      {tab === "onboarding" && <RHOnboardingView currentUser={currentUser} canWrite={false} isRHUser={false} notifyMentions={notifyMentions} />}
      {tab === "treinamentos" && <RHTreinamentosView currentUser={currentUser} canWrite={false} isRHUser={false} notifyMentions={notifyMentions} />}
      {tab === "avaliacao" && <RHFeedbackView currentUser={currentUser} canWrite={false} isRHUser={false} notifyMentions={notifyMentions} />}
      {tab === "ferias" && <MeuFeriasPanel colaboradorId={meuColaborador?.id} admissionDate={meuColaborador?.admissionDate} />}
      {tab === "documentos" && (
        meuColaborador ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Holerite</div>
              <RHAttachmentsPanel domain="holerite" recordId={meuColaborador.id} currentUser={currentUser} readOnly />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Ponto</div>
              <RHAttachmentsPanel domain="ponto" recordId={meuColaborador.id} currentUser={currentUser} readOnly />
            </div>
          </div>
        ) : (
          <EmptyState icon={FileText} title="Nenhum documento ainda" description="Holerite e comprovante de ponto aparecem aqui quando o RH subir." />
        )
      )}
      {tab === "meus-dados" && <MeusDadosPanel meuColaborador={meuColaborador} currentUser={currentUser} />}
    </div>
  );
}

export default MeuRHView;
