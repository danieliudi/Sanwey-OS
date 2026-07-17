import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Search,
  Users,
  Pencil,
  Save,
  ChevronRight,
  Briefcase,
  BarChart2,
  Plus,
  UserCog,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Gift,
  Check,
} from "lucide-react";
import {
  RH_DEPARTMENTS,
  RH_CONTRACT_TYPES,
  RH_EMPLOYEE_STATUSES,
  RH_APRENDIZ_COTA_ALVO,
  RH_DESLIGAMENTO_TIPOS,
  RH_ENTREVISTA_SAIDA_PERGUNTAS,
} from "../../constants/rh-config";
import { RH_FRENTES, RH_FRENTE_LABELS, RH_FRENTE_COLORS } from "../../constants/rh-frentes";
import { supabase } from "../../lib/supabase";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHBeneficios } from "../../hooks/use-rh-beneficios";
import { useRHSignatureRequests } from "../../hooks/use-rh-signature-requests";
import { RHAttachmentsPanel } from "../rh-pipeline/RHDetailDrawerShell";
import { NovoColaboradorModal } from "./NovoColaboradorModal";
import { EmptyState } from "../ui/EmptyState";
import { CurrencyInput } from "../ui/CurrencyInput";
import { periodoExperienciaInfo, avisoPrevioEstimadoDias } from "../../utils/rh-compliance-dates";
import { formatDateBR } from "../../utils/date";

const BENEFICIO_STATUS_COLORS = {
  solicitado: { bg: "var(--warning-bg)", text: "var(--warning)" },
  aprovado:   { bg: "#DBEAFE", text: "#2563EB" },
  ativo:      { bg: "#DCFCE7", text: "#16A34A" },
  cancelado:  { bg: "var(--surface-alt)", text: "var(--text-dim)" },
};
const BENEFICIO_STATUS_LABELS = { solicitado: "Solicitado", aprovado: "Aprovado", ativo: "Ativo", cancelado: "Cancelado" };

function BeneficiosSection({ colaboradorId, canWrite, currentUser }) {
  const { catalogo, colaboradorBeneficios, solicitarBeneficio, aprovarBeneficio } = useRHBeneficios({ userId: currentUser?.id });
  const [picking, setPicking] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const [saving, setSaving] = useState(false);

  const meus = colaboradorBeneficios.filter(b => b.colaboradorId === colaboradorId);
  const catalogoById = new Map(catalogo.filter(c => c.isActive).map(c => [c.id, c]));
  const disponiveis = catalogo.filter(c => c.isActive && !meus.some(b => b.beneficioCatalogoId === c.id && b.status !== "cancelado"));

  const handleSolicitar = async () => {
    if (!pickedId) return;
    setSaving(true);
    try {
      await solicitarBeneficio(colaboradorId, pickedId);
      setPicking(false);
      setPickedId("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: "14px 16px", background: "var(--surface-alt)", marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <Gift size={13} /> Benefícios
      </div>
      {meus.length === 0 && <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>Nenhum benefício vinculado ainda.</div>}
      <div className="flex flex-col gap-1.5 mb-2">
        {meus.map(b => {
          const cat = catalogoById.get(b.beneficioCatalogoId);
          const color = BENEFICIO_STATUS_COLORS[b.status] || BENEFICIO_STATUS_COLORS.solicitado;
          return (
            <div key={b.id} className="flex items-center justify-between gap-2" style={{ fontSize: 12 }}>
              <span style={{ color: "var(--text)", fontWeight: 500 }}>{cat?.nomeExibicao || "—"}</span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 10, fontWeight: 700, color: color.text, background: color.bg, borderRadius: 99, padding: "2px 8px" }}>
                  {BENEFICIO_STATUS_LABELS[b.status] || b.status}
                </span>
                {canWrite && b.status === "solicitado" && (
                  <button
                    onClick={() => aprovarBeneficio(b.id)}
                    title="Aprovar"
                    style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", display: "flex" }}
                  >
                    <Check size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {canWrite && (
        picking ? (
          <div className="flex items-center gap-2">
            <select
              className="text-xs rounded-lg border px-2 py-1.5 outline-none flex-1"
              style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
              value={pickedId}
              onChange={(e) => setPickedId(e.target.value)}
            >
              <option value="">Selecionar benefício…</option>
              {disponiveis.map(c => <option key={c.id} value={c.id}>{c.nomeExibicao}</option>)}
            </select>
            <button onClick={handleSolicitar} disabled={saving || !pickedId} style={{ background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Solicitar
            </button>
            <button onClick={() => setPicking(false)} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 11 }}>
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPicking(true)}
            className="flex items-center gap-1"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
          >
            <Plus size={12} /> Solicitar benefício
          </button>
        )
      )}
    </div>
  );
}

const SIGNATURE_STATUS_COLORS = {
  pendente_envio: { bg: "var(--surface-alt)", text: "var(--text-dim)" },
  enviado:        { bg: "var(--warning-bg)", text: "var(--warning)" },
  assinado:       { bg: "#DCFCE7", text: "#16A34A" },
  recusado:       { bg: "#FEE2E2", text: "#DC2626" },
  cancelado:      { bg: "var(--surface-alt)", text: "var(--text-dim)" },
};
const SIGNATURE_STATUS_LABELS = {
  pendente_envio: "Pendente de envio", enviado: "Enviado", assinado: "Assinado",
  recusado: "Recusado", cancelado: "Cancelado",
};

function SignatureSection({ colaboradorRow, canWrite }) {
  const { requests, loading, sending, sendError, sendForSignature, uploadSourceDocument } =
    useRHSignatureRequests({ domain: "funcionarios", recordId: colaboradorRow.id });
  const [openForm, setOpenForm] = useState(false);
  const [file, setFile] = useState(null);
  const [signerName, setSignerName] = useState(colaboradorRow.fullName || "");
  const [signerEmail, setSignerEmail] = useState(colaboradorRow.email || "");

  const handleSend = async () => {
    if (!file || !signerName.trim() || !signerEmail.trim()) return;
    try {
      const path = await uploadSourceDocument(file);
      await sendForSignature({
        signers: [{ name: signerName.trim(), email: signerEmail.trim() }],
        sourceStoragePath: path,
      });
      setOpenForm(false);
      setFile(null);
    } catch {
      // sendError já reflete a falha — sem alert bloqueante.
    }
  };

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: "14px 16px", background: "var(--surface-alt)", marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        Assinatura eletrônica
      </div>

      {loading && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Carregando…</div>}
      {!loading && requests.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>Nenhum documento enviado pra assinatura ainda.</div>
      )}
      <div className="flex flex-col gap-1.5 mb-2">
        {requests.map(r => {
          const color = SIGNATURE_STATUS_COLORS[r.status] || SIGNATURE_STATUS_COLORS.pendente_envio;
          return (
            <div key={r.id} className="flex items-center justify-between gap-2" style={{ fontSize: 12 }}>
              <span style={{ color: "var(--text)", fontWeight: 500 }}>
                {(r.signers || []).map(s => s.name).join(", ") || "—"}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: color.text, background: color.bg, borderRadius: 99, padding: "2px 8px" }}>
                {SIGNATURE_STATUS_LABELS[r.status] || r.status}
              </span>
            </div>
          );
        })}
      </div>

      {canWrite && (
        openForm ? (
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs"
              style={{ color: "var(--text)" }}
            />
            <input
              type="text"
              placeholder="Nome do signatário"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="text-xs rounded-lg border px-2 py-1.5 outline-none"
              style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
            />
            <input
              type="email"
              placeholder="E-mail do signatário"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              className="text-xs rounded-lg border px-2 py-1.5 outline-none"
              style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
            />
            {sendError && <div style={{ fontSize: 11, color: "var(--danger)" }}>{sendError}</div>}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSend}
                disabled={sending || !file || !signerName.trim() || !signerEmail.trim()}
                style={{ background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: sending ? "default" : "pointer", opacity: sending ? 0.6 : 1 }}
              >
                {sending ? "Enviando…" : "Enviar pra assinatura"}
              </button>
              <button onClick={() => setOpenForm(false)} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 11 }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpenForm(true)}
            className="flex items-center gap-1"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
          >
            <Plus size={12} /> Enviar documento pra assinatura
          </button>
        )
      )}
    </div>
  );
}

// Holerite e comprovante de ponto (Onda 5, prep painel do colaborador): o RH
// sobe o PDF/imagem gerado pelo sistema externo (folha de pagamento, ponto
// homologado) — é só consulta, não um processamento de folha nem um relógio
// de ponto dentro da plataforma. Reaproveita rh_attachments (mesmo mecanismo
// do onboarding), com domínios dedicados pra não misturar com outros anexos.
function DocumentosSection({ colaboradorId, canWrite, currentUser }) {
  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: "14px 16px", background: "var(--surface-alt)", marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        Documentos (consulta)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Holerite</div>
          <RHAttachmentsPanel domain="holerite" recordId={colaboradorId} currentUser={currentUser} readOnly={!canWrite} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Ponto</div>
          <RHAttachmentsPanel domain="ponto" recordId={colaboradorId} currentUser={currentUser} readOnly={!canWrite} />
        </div>
      </div>
      <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 10 }}>
        Suba aqui o PDF/imagem já emitido pelo sistema de folha e pelo registrador de ponto homologado. É só pra consulta — não substitui nenhum dos dois sistemas.
      </p>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

// Delega pro formatDateBR (via parseDateInput) — colunas `date` chegam como
// "AAAA-MM-DD" e new Date() as interpretava como meia-noite UTC, exibindo o
// dia anterior em fuso negativo (Brasil). Achado da 2ª auditoria.
function fmt(dateStr) {
  return formatDateBR(dateStr);
}

function statusInfo(statusId) {
  return (
    RH_EMPLOYEE_STATUSES.find((s) => s.id === statusId) ||
    RH_EMPLOYEE_STATUSES[0]
  );
}

function FrenteBadge({ frente }) {
  if (!frente) return null;
  const color = RH_FRENTE_COLORS[frente] || "var(--text-dim)";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, borderRadius: 99, padding: "2px 8px" }}>
      {RH_FRENTE_LABELS[frente] || frente}
    </span>
  );
}

const FUNC_TABLE_COLS = [
  { id: "name",            label: "Funcionário",   sortable: true },
  { id: "job_title",       label: "Cargo",         sortable: true },
  { id: "frente",          label: "Frente",        sortable: true },
  { id: "department",      label: "Departamento",  sortable: true },
  { id: "contract_type",   label: "Contrato",      sortable: true },
  { id: "employee_status", label: "Status",        sortable: true },
  { id: "admission_date",  label: "Admissão",      sortable: true },
  { id: "",                label: "",              sortable: false },
];

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={11} style={{ color: "var(--border-strong)", flexShrink: 0 }} />;
  return sortDir === "asc"
    ? <ArrowUp size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />
    : <ArrowDown size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />;
}

function contractLabel(typeId) {
  return RH_CONTRACT_TYPES.find((c) => c.id === typeId)?.label || typeId || "—";
}

// ── sub-components ────────────────────────────────────────────────────────────

function Avatar({ user, size = 36 }) {
  const initials =
    user.initials ||
    (user.name || "")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  const bg = user.avatarBg || "var(--color-industria)";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: "#FFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ statusId }) {
  const s = statusInfo(statusId);
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.color}33`,
        borderRadius: 99,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 600,
        display: "inline-block",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Employee Detail Modal ─────────────────────────────────────────────────────

function EmployeeDetailModal({ user, leads = [], canWrite, onUpdateUser, colaboradorRow, onUpdateColaborador, onClose, currentUser }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [form, setForm] = useState({
    job_title:       user.job_title       || "",
    frente:          user.frente          || "",
    department:      user.department      || "",
    contract_type:   user.contract_type   || "",
    admission_date:  user.admission_date  ? user.admission_date.slice(0, 10) : "",
    employee_status: user.employee_status || "ativo",
    salary:          user.salary          != null ? String(user.salary) : "",
    aso_vencimento:  colaboradorRow?.asoVencimento || "",
    contrato_fim:    colaboradorRow?.contratoFim || "",
    aprendiz_inicio: colaboradorRow?.aprendizInicio || "",
    aprendiz_fim:    colaboradorRow?.aprendizFim || "",
    desligamento_date:   colaboradorRow?.desligamentoDate || "",
    desligamento_tipo:   colaboradorRow?.desligamentoTipo || "",
    desligamento_motivo: colaboradorRow?.desligamentoMotivo || "",
    desligamento_meta:   colaboradorRow?.desligamentoMeta || {},
  });

  // Estimativas informativas — período de experiência CLT e aviso-prévio
  // quando a pessoa está desligada. Não bloqueiam nada, é só contexto.
  const expInfo = colaboradorRow ? periodoExperienciaInfo(colaboradorRow) : null;
  const avisoPrevioDias = (form.employee_status === "desligado" && colaboradorRow?.desligamentoDate)
    ? avisoPrevioEstimadoDias(colaboradorRow.admissionDate, colaboradorRow.desligamentoDate)
    : null;

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const userLeads = useMemo(
    () => leads.filter((l) => l.owner === user.id),
    [leads, user.id]
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    // Detect if admission_date is being set for the first time
    const hadAdmissionDate = !!user.admission_date;
    const nowHasAdmissionDate = !!form.admission_date;
    try {
      await onUpdateUser(user.id, {
        job_title:       form.job_title       || null,
        frente:          form.frente          || null,
        department:      form.department      || null,
        contract_type:   form.contract_type   || null,
        admission_date:  form.admission_date  ? new Date(form.admission_date).toISOString() : null,
        employee_status: form.employee_status || null,
        salary:          form.salary !== "" ? parseFloat(form.salary) : null,
      });
      if (colaboradorRow && onUpdateColaborador) {
        const desligPatch = form.employee_status === "desligado" ? {
          desligamentoTipo: form.desligamento_tipo || null,
          desligamentoDate: form.desligamento_date || new Date().toISOString().slice(0, 10),
          desligamentoMotivo: form.desligamento_motivo || null,
          desligamentoMeta: form.desligamento_meta || {},
        } : {};
        await onUpdateColaborador(colaboradorRow.id, {
          frente: form.frente || null,
          asoVencimento: form.aso_vencimento || null,
          contratoFim: form.contrato_fim || null,
          aprendizInicio: form.aprendiz_inicio || null,
          aprendizFim: form.aprendiz_fim || null,
          ...desligPatch,
        });
      }
      setEditing(false);

      // Send welcome email only when admission_date is set for the first time
      if (!hadAdmissionDate && nowHasAdmissionDate && user.email) {
        try {
          const startDate = formatDateBR(form.admission_date);
          await supabase.functions.invoke("rh-send-email", {
            body: {
              type: "welcome",
              to: user.email,
              variables: {
                EMPLOYEE_NAME: user.name || user.email,
                JOB_TITLE:     form.job_title     || "—",
                DEPARTMENT:    form.department    || "—",
                MANAGER_NAME:  "RH Grupo Sanwey",
                START_DATE:    startDate,
                APP_URL:       window.location.origin,
              },
            },
          });
        } catch (emailErr) {
          // Non-blocking — log but don't surface to user
          console.warn("[RHFuncionariosView] welcome email error:", emailErr);
        }
      }
    } catch (err) {
      setError(err?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = {
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 4,
    display: "block",
  };
  const inputSt = {
    borderColor: "var(--border-strong)",
    color: "var(--text)",
    background: "var(--surface)",
    fontSize: 13,
  };
  const focusBlue = (e) => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = (e) => { e.target.style.borderColor = "var(--border-strong)"; };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 560,
          boxShadow: "var(--shadow-pop)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Avatar user={user} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>
              {user.name || user.email}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              {user.email}
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
              <StatusBadge statusId={user.employee_status || "ativo"} />
              <FrenteBadge frente={user.frente} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canWrite && !editing && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  background: "var(--accent-tint)",
                  border: "none",
                  color: "var(--accent)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 16%, transparent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent-tint)"; }}
              >
                <Pencil size={13} /> Editar
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-dim)",
                padding: 6,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 24px" }}>
          {/* HR Fields */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Dados do Funcionário
            </div>

            {editing ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelSt}>Cargo</label>
                  <input
                    type="text"
                    value={form.job_title}
                    onChange={(e) => set("job_title", e.target.value)}
                    placeholder="Ex: Analista Comercial"
                    className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                    style={inputSt}
                    onFocus={focusBlue}
                    onBlur={blurGray}
                  />
                </div>
                <div>
                  <label style={labelSt}>Frente</label>
                  <select
                    value={form.frente}
                    onChange={(e) => set("frente", e.target.value)}
                    className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                    style={inputSt}
                  >
                    <option value="">Selecionar</option>
                    {RH_FRENTES.map((id) => (
                      <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Departamento</label>
                  <select
                    value={form.department}
                    onChange={(e) => set("department", e.target.value)}
                    className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                    style={inputSt}
                  >
                    <option value="">Selecionar</option>
                    {RH_DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Tipo de Contrato</label>
                  <select
                    value={form.contract_type}
                    onChange={(e) => set("contract_type", e.target.value)}
                    className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                    style={inputSt}
                  >
                    <option value="">Selecionar</option>
                    {RH_CONTRACT_TYPES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Data de Admissão</label>
                  <input
                    type="date"
                    value={form.admission_date}
                    onChange={(e) => set("admission_date", e.target.value)}
                    className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                    style={inputSt}
                    onFocus={focusBlue}
                    onBlur={blurGray}
                  />
                </div>
                <div>
                  <label style={labelSt}>Status</label>
                  <select
                    value={form.employee_status}
                    onChange={(e) => set("employee_status", e.target.value)}
                    className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                    style={inputSt}
                  >
                    {RH_EMPLOYEE_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Salário (R$)</label>
                  <CurrencyInput
                    prefix={null}
                    value={form.salary}
                    onChange={v => set("salary", v)}
                    placeholder="0,00"
                    className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                    style={inputSt}
                    onFocus={focusBlue}
                    onBlur={blurGray}
                  />
                </div>
                <div>
                  <label style={labelSt}>Vencimento do ASO</label>
                  <input
                    type="date"
                    value={form.aso_vencimento}
                    onChange={(e) => set("aso_vencimento", e.target.value)}
                    className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                    style={inputSt}
                    onFocus={focusBlue}
                    onBlur={blurGray}
                  />
                </div>
                <div>
                  <label style={labelSt}>Fim do contrato (se temporário)</label>
                  <input
                    type="date"
                    value={form.contrato_fim}
                    onChange={(e) => set("contrato_fim", e.target.value)}
                    className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                    style={inputSt}
                    onFocus={focusBlue}
                    onBlur={blurGray}
                  />
                </div>
                {form.contract_type === "aprendiz" && (
                  <>
                    <div>
                      <label style={labelSt}>Início do contrato de aprendizagem</label>
                      <input
                        type="date"
                        value={form.aprendiz_inicio}
                        onChange={(e) => set("aprendiz_inicio", e.target.value)}
                        className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                        style={inputSt}
                        onFocus={focusBlue}
                        onBlur={blurGray}
                      />
                    </div>
                    <div>
                      <label style={labelSt}>Fim do contrato de aprendizagem</label>
                      <input
                        type="date"
                        value={form.aprendiz_fim}
                        onChange={(e) => set("aprendiz_fim", e.target.value)}
                        className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                        style={inputSt}
                        onFocus={focusBlue}
                        onBlur={blurGray}
                      />
                    </div>
                  </>
                )}

                {form.employee_status === "desligado" && (
                  <div style={{ gridColumn: "1 / -1", marginTop: 4, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Entrevista de desligamento</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={labelSt}>Tipo de desligamento</label>
                        <select value={form.desligamento_tipo} onChange={(e) => set("desligamento_tipo", e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                          <option value="">Selecione…</option>
                          {RH_DESLIGAMENTO_TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelSt}>Data do desligamento</label>
                        <input type="date" value={form.desligamento_date} onChange={(e) => set("desligamento_date", e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label style={labelSt}>Motivo</label>
                      <textarea value={form.desligamento_motivo} onChange={(e) => set("desligamento_motivo", e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
                    </div>
                    {RH_ENTREVISTA_SAIDA_PERGUNTAS.map((q) => (
                      <div key={q.key} style={{ marginTop: 12 }}>
                        <label style={labelSt}>{q.label}</label>
                        <textarea
                          value={form.desligamento_meta?.[q.key] || ""}
                          onChange={(e) => set("desligamento_meta", { ...(form.desligamento_meta || {}), [q.key]: e.target.value })}
                          rows={2}
                          className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Cargo",            value: user.job_title || "—" },
                  { label: "Departamento",      value: user.department || "—" },
                  { label: "Tipo de Contrato",  value: contractLabel(user.contract_type) },
                  { label: "Data de Admissão",  value: fmt(user.admission_date) },
                  { label: "Status",            value: statusInfo(user.employee_status).label },
                  { label: "Salário",           value: user.salary != null ? `R$ ${Number(user.salary).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—" },
                  { label: "Vencimento do ASO", value: fmt(colaboradorRow?.asoVencimento) },
                  { label: "Fim do contrato",   value: fmt(colaboradorRow?.contratoFim) },
                  ...(user.contract_type === "aprendiz" ? [
                    { label: "Início aprendizagem", value: fmt(colaboradorRow?.aprendizInicio) },
                    { label: "Fim aprendizagem",    value: fmt(colaboradorRow?.aprendizFim) },
                  ] : []),
                ].map((f) => (
                  <div key={f.label}>
                    <div style={labelSt}>{f.label}</div>
                    <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{f.value}</div>
                  </div>
                ))}
              </div>
            )}

            {expInfo && (
              <div style={{ marginTop: 14, background: "var(--warning-bg)", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "var(--warning)" }}>
                Período de experiência CLT: marco de {expInfo.marco} dias em {expInfo.diasRestantes} dia(s).
              </div>
            )}
            {avisoPrevioDias != null && (
              <div style={{ marginTop: 14, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "var(--text-dim)" }}>
                Aviso-prévio estimado: {avisoPrevioDias} dias (Lei 12.506/2011 — confirme com RH/jurídico antes de aplicar).
              </div>
            )}
          </div>

          {colaboradorRow && (
            <BeneficiosSection colaboradorId={colaboradorRow.id} canWrite={canWrite} currentUser={currentUser} />
          )}

          {colaboradorRow && (
            <SignatureSection colaboradorRow={colaboradorRow} canWrite={canWrite} />
          )}

          {colaboradorRow && (
            <DocumentosSection colaboradorId={colaboradorRow.id} canWrite={canWrite} currentUser={currentUser} />
          )}

          {/* CRM metrics */}
          {userLeads.length > 0 && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                padding: "14px 16px",
                background: "var(--surface-alt)",
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <BarChart2 size={13} /> Métricas CRM
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                    Leads atribuídos
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
                    {userLeads.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                    Em andamento
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
                    {userLeads.filter((l) => !["perdido", "ganho"].includes(l.stage)).length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {editing && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  background: "var(--accent)",
                  color: "#FFF",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  border: "none",
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Save size={13} />
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
              <button
                onClick={() => { setEditing(false); setError(null); }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  fontSize: 13,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function RHFuncionariosView({
  users = [],
  leads = [],
  currentUser,
  onUpdateUser,
  canWrite,
}) {
  const { colaboradores, createColaborador, updateColaborador, deleteColaborador } = useRHColaboradores({ userId: currentUser?.id });
  const [search, setSearch]         = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterFrente, setFilterFrente] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterContract, setFilterContract] = useState("all");
  const [selected, setSelected]     = useState(null);
  const [novoColaboradorOpen, setNovoColaboradorOpen] = useState(false);
  const [editingColaborador, setEditingColaborador]   = useState(null);
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  // rh_colaboradores agora tem uma linha sincronizada pra cada profile (ver
  // sync_profile_to_colaborador), então quem já aparece em `users` também
  // aparece aqui com profileId preenchido — sem esse filtro, essas pessoas
  // eram contadas duas vezes e reapareciam numa seção "sem acesso" que era
  // exatamente o contrário do que a linha delas representa.
  const colaboradoresSemAcesso = useMemo(
    () => colaboradores.filter((c) => !c.profileId),
    [colaboradores]
  );

  const stats = useMemo(() => {
    const statusOf = (e) => e.employeeStatus || e.employee_status || "ativo";
    // Aprendiz pode estar num profile (snake_case) ou num colaborador sem
    // acesso (camelCase) — cobrir os dois nomes de campo.
    const contractOf = (e) => e.contractType || e.contract_type || "";
    const all = [...users, ...colaboradoresSemAcesso];
    return {
      total:      all.length,
      ativos:     all.filter((e) => statusOf(e) === "ativo").length,
      ferias:     all.filter((e) => statusOf(e) === "ferias").length,
      desligados: all.filter((e) => statusOf(e) === "desligado").length,
      aprendizes: all.filter((e) => statusOf(e) === "ativo" && contractOf(e) === "aprendiz").length,
    };
  }, [users, colaboradoresSemAcesso]);

  const filteredColaboradores = useMemo(() => {
    return colaboradoresSemAcesso.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (!(c.fullName || "").toLowerCase().includes(q) && !(c.email || "").toLowerCase().includes(q)) return false;
      }
      if (filterDept !== "all" && c.department !== filterDept) return false;
      if (filterFrente !== "all" && c.frente !== filterFrente) return false;
      if (filterStatus !== "all" && (c.employeeStatus || "ativo") !== filterStatus) return false;
      if (filterContract !== "all" && c.contractType !== filterContract) return false;
      return true;
    });
  }, [colaboradoresSemAcesso, search, filterDept, filterFrente, filterStatus, filterContract]);

  const filtered = useMemo(() => {
    const arr = users.filter((u) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !(u.name || "").toLowerCase().includes(q) &&
          !(u.email || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filterDept !== "all" && u.department !== filterDept) return false;
      if (filterFrente !== "all" && u.frente !== filterFrente) return false;
      if (filterStatus !== "all" && (u.employee_status || "ativo") !== filterStatus) return false;
      if (filterContract !== "all" && u.contract_type !== filterContract) return false;
      return true;
    });
    arr.sort((a, b) => {
      const va = (a[sortCol] ?? "").toString().toLowerCase();
      const vb = (b[sortCol] ?? "").toString().toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [users, search, filterDept, filterFrente, filterStatus, filterContract, sortCol, sortDir]);

  const selectSt = {
    borderColor: "var(--border)",
    color: "var(--text)",
    background: "var(--surface)",
    fontSize: 12,
  };

  return (
    <div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users size={22} style={{ color: "var(--text)" }} />
            <h1
              style={{
                fontWeight: 700,
                fontSize: 26,
                color: "var(--text)",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Funcionários
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Registro de colaboradores · {stats.total} no total
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setNovoColaboradorOpen(true)}
            className="flex items-center gap-1.5 font-semibold"
            style={{
              background: "var(--accent)", color: "#FFF", borderRadius: 10,
              padding: "6px 16px", fontSize: 13, border: "none",
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> Novo Funcionário
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div
        className="grid gap-3 mb-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}
      >
        {[
          { label: "Total",       value: stats.total,      color: "var(--text)" },
          { label: "Ativos",      value: stats.ativos,     color: "var(--success)" },
          { label: "Férias",      value: stats.ferias,     color: "var(--accent)" },
          { label: "Desligados",  value: stats.desligados, color: "var(--text-dim)" },
          // Cota de aprendizes (Áudio 6): mostra ativos e, se houver meta,
          // "ativos/meta" em vermelho quando abaixo da cota (risco legal).
          ...((stats.aprendizes > 0 || RH_APRENDIZ_COTA_ALVO > 0) ? [{
            label: RH_APRENDIZ_COTA_ALVO > 0 ? "Aprendizes (cota)" : "Aprendizes",
            value: RH_APRENDIZ_COTA_ALVO > 0 ? `${stats.aprendizes}/${RH_APRENDIZ_COTA_ALVO}` : stats.aprendizes,
            color: (RH_APRENDIZ_COTA_ALVO > 0 && stats.aprendizes < RH_APRENDIZ_COTA_ALVO) ? "var(--danger)" : "var(--success)",
          }] : []),
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              padding: "12px 16px",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: s.color,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "6px 12px",
            flex: "1 1 180px",
            maxWidth: 280,
          }}
        >
          <Search size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              fontSize: 12,
              color: "var(--text)",
              background: "transparent",
              width: "100%",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 0, display: "flex" }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <select
          value={filterFrente}
          onChange={(e) => setFilterFrente(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={selectSt}
        >
          <option value="all">Todas as frentes</option>
          {RH_FRENTES.map((id) => (
            <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>
          ))}
        </select>

        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={selectSt}
        >
          <option value="all">Todos os departamentos</option>
          {RH_DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={selectSt}
        >
          <option value="all">Todos os status</option>
          {RH_EMPLOYEE_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        <select
          value={filterContract}
          onChange={(e) => setFilterContract(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={selectSt}
        >
          <option value="all">Todos os contratos</option>
          {RH_CONTRACT_TYPES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Desktop Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum funcionário encontrado"
          description="Tente ajustar os filtros"
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                  {FUNC_TABLE_COLS.map((col) => (
                    <th
                      key={col.id || col.label}
                      className="text-left px-4 py-2.5"
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--text-dim)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        cursor: col.sortable ? "pointer" : "default",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                      onClick={col.sortable ? () => handleSort(col.id) : undefined}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {col.label}
                        {col.sortable && <SortIcon col={col.id} sortCol={sortCol} sortDir={sortDir} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                    onClick={() => setSelected(u)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td className="px-4 py-3">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar user={u} size={34} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                            {u.name || "Sem nome"}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--text)" }}>
                      {u.job_title || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <FrenteBadge frente={u.frente} />
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {u.department || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {contractLabel(u.contract_type)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge statusId={u.employee_status || "ativo"} />
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {fmt(u.admission_date)}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} style={{ color: "var(--text-dim)", opacity: 0.5 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((u) => (
              <div
                key={u.id}
                onClick={() => setSelected(u)}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
              >
                <Avatar user={u} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                    {u.name || "Sem nome"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
                    {u.job_title || u.email}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <StatusBadge statusId={u.employee_status || "ativo"} />
                    <FrenteBadge frente={u.frente} />
                    {u.department && (
                      <span style={{ fontSize: 10, color: "var(--text-dim)", background: "var(--surface-alt)", borderRadius: 99, padding: "2px 8px" }}>
                        {u.department}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "var(--text-dim)", opacity: 0.5, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Colaboradores sem acesso ao sistema */}
      {filteredColaboradores.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="flex items-center gap-2 mb-3">
            <UserCog size={16} style={{ color: "var(--text-dim)" }} />
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
              Colaboradores sem acesso ao sistema
            </div>
            <span style={{ fontSize: 11, color: "var(--text-dim)", background: "var(--surface-alt)", borderRadius: 99, padding: "1px 8px" }}>
              {filteredColaboradores.length}
            </span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {filteredColaboradores.map((c) => (
              <div
                key={c.id}
                onClick={() => setEditingColaborador(c)}
                style={{
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                  padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
              >
                <Avatar user={{ name: c.fullName }} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.fullName}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
                    {c.jobTitle || c.department || "—"}
                  </div>
                </div>
                <FrenteBadge frente={c.frente} />
                <StatusBadge statusId={c.employeeStatus || "ativo"} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <EmployeeDetailModal
          user={selected}
          leads={leads}
          canWrite={canWrite}
          onUpdateUser={async (id, patch) => {
            await onUpdateUser(id, patch);
            setSelected((prev) => prev ? { ...prev, ...patch } : null);
          }}
          colaboradorRow={colaboradores.find((c) => c.profileId === selected.id)}
          onUpdateColaborador={updateColaborador}
          onClose={() => setSelected(null)}
          currentUser={currentUser}
        />
      )}

      {novoColaboradorOpen && (
        <NovoColaboradorModal
          currentUser={currentUser}
          onSave={createColaborador}
          onClose={() => setNovoColaboradorOpen(false)}
        />
      )}

      {editingColaborador && (
        <NovoColaboradorModal
          currentUser={currentUser}
          initialData={editingColaborador}
          onSave={(patch) => updateColaborador(editingColaborador.id, patch)}
          onClose={() => setEditingColaborador(null)}
        />
      )}
    </div>
  );
}
