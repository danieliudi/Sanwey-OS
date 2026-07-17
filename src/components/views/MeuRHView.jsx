import React, { useMemo, useState } from "react";
import {
  Home, Megaphone, ClipboardCheck, GraduationCap, MessageSquareText,
  CalendarCheck, FileText, User, Plus, Loader2,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useMyColaborador } from "../../hooks/use-my-colaborador";
import { useServerNotifications } from "../../hooks/use-server-notifications";
import { RHOnboardingView } from "./RHOnboardingView";
import { RHTreinamentosView } from "./RHTreinamentosView";
import { RHFeedbackView } from "./RHFeedbackView";
import { RHAttachmentsPanel } from "../rh-pipeline/RHDetailDrawerShell";
import { RH_LEAVE_TYPES } from "../../constants/rh-config";
import { formatDateBR } from "../../utils/date";
import { EmptyState } from "../ui/EmptyState";

// Painel do colaborador (/meu-rh) — pra quem tem login mas nenhum cargo
// operacional (papel "portal", ver migration 20260740) e, opcionalmente,
// pra qualquer colaborador comum acessar as próprias telas num só lugar.
// Reaproveita as telas "self" que RHOnboardingView/RHTreinamentosView/
// RHFeedbackView já tinham (isRHUser=false) em vez de duplicar UI.

const TABS = [
  { id: "comunicados",   label: "Comunicados",   icon: Megaphone },
  { id: "onboarding",    label: "Onboarding",     icon: ClipboardCheck },
  { id: "treinamentos",  label: "Treinamentos",   icon: GraduationCap },
  { id: "avaliacao",     label: "Avaliação",      icon: MessageSquareText },
  { id: "ferias",        label: "Férias",         icon: CalendarCheck },
  { id: "documentos",    label: "Documentos",     icon: FileText },
  { id: "meus-dados",    label: "Meus Dados",     icon: User },
];

const STATUS_INFO = {
  pendente: { label: "Pendente", bg: "var(--warning-bg)", text: "var(--warning)" },
  aprovado: { label: "Aprovado", bg: "var(--success-bg)", text: "var(--success)" },
  recusado: { label: "Recusado", bg: "var(--danger-bg)",  text: "var(--danger)" },
};

function ComunicadosPanel({ currentUser }) {
  const { notifications, markRead } = useServerNotifications({ currentUser });
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

function SolicitarFeriasForm({ currentUser, onCreated }) {
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
      user_id: currentUser.id,
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
        style={{ background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "6px 16px", fontSize: 13, border: "none", cursor: "pointer", marginBottom: 16 }}
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
          style={{ background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}
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

function MeuFeriasPanel({ currentUser }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = React.useCallback(async () => {
    if (!isSupabaseConfigured || !currentUser?.id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("rh_ferias")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("start_date", { ascending: false });
    setRequests(data || []);
    setLoading(false);
  }, [currentUser?.id]);

  React.useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const leaveLabel = (typeId) => RH_LEAVE_TYPES.find(t => t.id === typeId)?.label || typeId;

  return (
    <div>
      <SolicitarFeriasForm currentUser={currentUser} onCreated={fetchRequests} />
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
  ["phone", "Telefone"], ["email", "E-mail"],
  ["jobTitle", "Cargo"], ["department", "Departamento"],
  ["admissionDate", "Admissão"], ["employeeStatus", "Status"],
];

function MeusDadosPanel({ meuColaborador }) {
  if (!meuColaborador) {
    return <EmptyState icon={User} title="Nenhum dado cadastrado" description="Fale com o RH se isso não for esperado." />;
  }
  const endereco = [
    meuColaborador.addressStreet, meuColaborador.addressNumber, meuColaborador.addressComplement,
    meuColaborador.addressNeighborhood, meuColaborador.addressCity, meuColaborador.addressState,
  ].filter(Boolean).join(", ");

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
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Endereço</div>
          <div style={{ fontSize: 13, color: "var(--text)", marginTop: 2 }}>{endereco || "—"}</div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-dim)", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        Encontrou algo errado ou desatualizado? Fale com o RH pra corrigir — essa tela ainda não tem um jeito de solicitar
        atualização direto por aqui.
      </p>
    </div>
  );
}

export function MeuRHView({ currentUser, notifyMentions }) {
  const [tab, setTab] = useState("comunicados");
  const { meuColaborador } = useMyColaborador(currentUser);

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

      {tab === "comunicados" && <ComunicadosPanel currentUser={currentUser} />}
      {tab === "onboarding" && <RHOnboardingView currentUser={currentUser} canWrite={false} isRHUser={false} notifyMentions={notifyMentions} />}
      {tab === "treinamentos" && <RHTreinamentosView currentUser={currentUser} canWrite={false} isRHUser={false} notifyMentions={notifyMentions} />}
      {tab === "avaliacao" && <RHFeedbackView currentUser={currentUser} canWrite={false} isRHUser={false} notifyMentions={notifyMentions} />}
      {tab === "ferias" && <MeuFeriasPanel currentUser={currentUser} />}
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
      {tab === "meus-dados" && <MeusDadosPanel meuColaborador={meuColaborador} />}
    </div>
  );
}

export default MeuRHView;
