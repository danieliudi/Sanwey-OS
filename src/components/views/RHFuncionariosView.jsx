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
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import {
  RH_DEPARTMENTS,
  RH_CONTRACT_TYPES,
  RH_EMPLOYEE_STATUSES,
} from "../../constants/rh-config";
import { supabase } from "../../lib/supabase";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function statusInfo(statusId) {
  return (
    RH_EMPLOYEE_STATUSES.find((s) => s.id === statusId) ||
    RH_EMPLOYEE_STATUSES[0]
  );
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
  const bg = user.avatarBg || NEUTRAL.red;
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

function EmployeeDetailModal({ user, leads = [], canWrite, onUpdateUser, onClose }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [form, setForm] = useState({
    job_title:       user.job_title       || "",
    department:      user.department      || "",
    contract_type:   user.contract_type   || "",
    admission_date:  user.admission_date  ? user.admission_date.slice(0, 10) : "",
    employee_status: user.employee_status || "ativo",
    salary:          user.salary          != null ? String(user.salary) : "",
  });

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
        department:      form.department      || null,
        contract_type:   form.contract_type   || null,
        admission_date:  form.admission_date  ? new Date(form.admission_date).toISOString() : null,
        employee_status: form.employee_status || null,
        salary:          form.salary !== "" ? parseFloat(form.salary) : null,
      });
      setEditing(false);

      // Send welcome email only when admission_date is set for the first time
      if (!hadAdmissionDate && nowHasAdmissionDate && user.email) {
        try {
          const startDate = new Date(form.admission_date).toLocaleDateString("pt-BR");
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
    color: NEUTRAL.slate,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 4,
    display: "block",
  };
  const inputSt = {
    borderColor: "#D1D5DB",
    color: NEUTRAL.graphite,
    background: "#FAFAFA",
    fontSize: 13,
  };
  const focusBlue = (e) => { e.target.style.borderColor = "#1E4D8C"; };
  const blurGray  = (e) => { e.target.style.borderColor = "#D1D5DB"; };

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
          background: "#FFFFFF",
          borderRadius: 16,
          width: "100%",
          maxWidth: 560,
          boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #F3F4F6",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Avatar user={user} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>
              {user.name || user.email}
            </div>
            <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 2 }}>
              {user.email}
            </div>
            <div style={{ marginTop: 6 }}>
              <StatusBadge statusId={user.employee_status || "ativo"} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canWrite && !editing && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  background: "#EFF6FF",
                  border: "none",
                  color: "#1E4D8C",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#DBEAFE"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#EFF6FF"; }}
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
                color: NEUTRAL.slate,
                padding: 6,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; }}
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
            <div style={{ fontWeight: 700, fontSize: 12, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
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
                  <input
                    type="number"
                    value={form.salary}
                    onChange={(e) => set("salary", e.target.value)}
                    placeholder="0,00"
                    min="0"
                    step="0.01"
                    className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                    style={inputSt}
                    onFocus={focusBlue}
                    onBlur={blurGray}
                  />
                </div>
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
                ].map((f) => (
                  <div key={f.label}>
                    <div style={labelSt}>{f.label}</div>
                    <div style={{ fontSize: 13, color: NEUTRAL.graphite, fontWeight: 500 }}>{f.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CRM metrics */}
          {userLeads.length > 0 && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                padding: "14px 16px",
                background: "#F9FAFB",
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <BarChart2 size={13} /> Métricas CRM
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 10, color: NEUTRAL.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                    Leads atribuídos
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
                    {userLeads.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: NEUTRAL.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                    Em andamento
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
                    {userLeads.filter((l) => !["perdido", "ganho"].includes(l.stage)).length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>
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
                  background: "#1E4D8C",
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
                  border: "1px solid #E5E7EB",
                  background: "#FFF",
                  color: NEUTRAL.slate,
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
  pendingConversion,
  onClearPendingConversion,
  onCreateInvitation,
}) {
  const [search, setSearch]         = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterContract, setFilterContract] = useState("all");
  const [selected, setSelected]     = useState(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSent, setInviteSent]       = useState(false);

  const stats = useMemo(() => ({
    total:      users.length,
    ativos:     users.filter((u) => (u.employee_status || "ativo") === "ativo").length,
    ferias:     users.filter((u) => u.employee_status === "ferias").length,
    desligados: users.filter((u) => u.employee_status === "desligado").length,
  }), [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !(u.name || "").toLowerCase().includes(q) &&
          !(u.email || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filterDept !== "all" && u.department !== filterDept) return false;
      if (filterStatus !== "all" && (u.employee_status || "ativo") !== filterStatus) return false;
      if (filterContract !== "all" && u.contract_type !== filterContract) return false;
      return true;
    });
  }, [users, search, filterDept, filterStatus, filterContract]);

  const selectSt = {
    borderColor: "#E5E7EB",
    color: NEUTRAL.graphite,
    background: "#FFF",
    fontSize: 12,
  };

  const handleSendConversionInvite = async () => {
    if (!pendingConversion || !onCreateInvitation) return;
    setSendingInvite(true);
    try {
      await onCreateInvitation({
        email: pendingConversion.email,
        name:  pendingConversion.name,
        role:  "rh",
      });
      setInviteSent(true);
      setTimeout(() => { onClearPendingConversion?.(); setInviteSent(false); }, 3000);
    } catch {} finally {
      setSendingInvite(false);
    }
  };

  return (
    <div>
      {/* Pending conversion banner */}
      {pendingConversion && (
        <div style={{
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {pendingConversion.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#15803D" }}>
              Candidato aprovado: {pendingConversion.name}
            </div>
            <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
              {pendingConversion.email ? `E-mail: ${pendingConversion.email}` : "Envie o convite para liberar acesso ao sistema."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {!inviteSent ? (
              <button
                onClick={handleSendConversionInvite}
                disabled={sendingInvite || !pendingConversion.email || !onCreateInvitation}
                style={{
                  background: "#16A34A", color: "#FFF", border: "none", borderRadius: 8,
                  padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  opacity: sendingInvite ? 0.7 : 1,
                }}
              >
                {sendingInvite ? "Enviando…" : "Enviar convite"}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>✓ Convite enviado!</span>
            )}
            <button
              onClick={onClearPendingConversion}
              style={{ background: "transparent", border: "1px solid #BBF7D0", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#6B7280", cursor: "pointer" }}
            >
              Dispensar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users size={22} style={{ color: NEUTRAL.graphite }} />
            <h1
              style={{
                fontWeight: 700,
                fontSize: 26,
                color: NEUTRAL.graphite,
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Funcionários
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            Registro de colaboradores · {stats.total} no total
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div
        className="grid gap-3 mb-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}
      >
        {[
          { label: "Total",       value: stats.total,      color: NEUTRAL.graphite },
          { label: "Ativos",      value: stats.ativos,     color: "#16A34A" },
          { label: "Férias",      value: stats.ferias,     color: "#1E4D8C" },
          { label: "Desligados",  value: stats.desligados, color: NEUTRAL.slate },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border"
            style={{
              background: "#FFFFFF",
              borderColor: "#E5E7EB",
              padding: "12px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: NEUTRAL.slate,
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
            background: "#FFF",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            padding: "6px 12px",
            flex: "1 1 180px",
            maxWidth: 280,
          }}
        >
          <Search size={13} style={{ color: NEUTRAL.slate, flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              fontSize: 12,
              color: NEUTRAL.graphite,
              background: "transparent",
              width: "100%",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ background: "none", border: "none", color: NEUTRAL.slate, cursor: "pointer", padding: 0, display: "flex" }}
            >
              <X size={13} />
            </button>
          )}
        </div>

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
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Users size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>
            Nenhum funcionário encontrado
          </div>
          <div style={{ fontSize: 12, color: NEUTRAL.slate, opacity: 0.6, marginTop: 4 }}>
            Tente ajustar os filtros
          </div>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  {["Funcionário", "Cargo", "Departamento", "Contrato", "Status", "Admissão", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5"
                      style={{ fontSize: 10, fontWeight: 600, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: "1px solid #E5E7EB", cursor: "pointer" }}
                    onClick={() => setSelected(u)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td className="px-4 py-3">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar user={u} size={34} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: NEUTRAL.graphite }}>
                            {u.name || "Sem nome"}
                          </div>
                          <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 1 }}>
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12, color: NEUTRAL.graphite }}>
                      {u.job_title || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12, color: NEUTRAL.slate }}>
                      {u.department || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12, color: NEUTRAL.slate }}>
                      {contractLabel(u.contract_type)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge statusId={u.employee_status || "ativo"} />
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12, color: NEUTRAL.slate }}>
                      {fmt(u.admission_date)}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} style={{ color: NEUTRAL.slate, opacity: 0.5 }} />
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
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: 12,
                  padding: "14px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#FFFFFF"; }}
              >
                <Avatar user={u} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: NEUTRAL.graphite }}>
                    {u.name || "Sem nome"}
                  </div>
                  <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 1 }}>
                    {u.job_title || u.email}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <StatusBadge statusId={u.employee_status || "ativo"} />
                    {u.department && (
                      <span style={{ fontSize: 10, color: NEUTRAL.slate, background: "#F3F4F6", borderRadius: 99, padding: "2px 8px" }}>
                        {u.department}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: NEUTRAL.slate, opacity: 0.5, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </>
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
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
