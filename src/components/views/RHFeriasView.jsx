import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Plus,
  X,
  Clock,
  CalendarCheck,
  Users,
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { RH_LEAVE_TYPES } from "../../constants/rh-config";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function calcDias(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.max(0, Math.round(diff / 86400000) + 1);
}

function leaveTypeLabel(typeId) {
  return RH_LEAVE_TYPES.find((t) => t.id === typeId)?.label || typeId || "—";
}

function statusConfig(status) {
  switch (status) {
    case "aprovado":  return { label: "Aprovado",  color: "var(--success)", bg: "#DCFCE7" };
    case "recusado":  return { label: "Recusado",  color: "var(--danger)", bg: "#FEE2E2" };
    default:          return { label: "Pendente",  color: "var(--warning)", bg: "#FEF3C7" };
  }
}

function isActiveNow(req) {
  if (req.status !== "aprovado") return false;
  const now = Date.now();
  const start = new Date(req.start_date).getTime();
  const end   = new Date(req.end_date).getTime();
  return now >= start && now <= end;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ── Avatar circle ─────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 30 }) {
  const initials =
    (user?.initials) ||
    (user?.name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--color-industria)",
        color: "#FFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = statusConfig(status);
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
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Solicitar Férias Modal ────────────────────────────────────────────────────

function SolicitarFeriasModal({ currentUser, onSave, onClose }) {
  const [type, setType]           = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [notes, setNotes]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const dias = calcDias(startDate, endDate);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!type)        { setError("Selecione o tipo de licença."); return; }
    if (!startDate)   { setError("Informe a data de início."); return; }
    if (!endDate)     { setError("Informe a data de término."); return; }
    if (new Date(endDate) < new Date(startDate)) { setError("A data de término deve ser após o início."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        user_id:    currentUser.id,
        type,
        start_date: startDate,
        end_date:   endDate,
        notes:      notes.trim() || null,
        status:     "pendente",
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao enviar solicitação.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };
  const focusBlue = (e) => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = (e) => { e.target.style.borderColor = "var(--border-strong)"; };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>
              Solicitar Afastamento
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              {currentUser?.name || currentUser?.email}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelSt}>Tipo *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                style={inputSt}
                autoFocus
              >
                <option value="">Selecionar tipo</option>
                {RH_LEAVE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelSt}>Início *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                  style={inputSt}
                  onFocus={focusBlue}
                  onBlur={blurGray}
                />
              </div>
              <div>
                <label style={labelSt}>Término *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                  style={inputSt}
                  onFocus={focusBlue}
                  onBlur={blurGray}
                />
              </div>
            </div>

            {dias > 0 && (
              <div
                style={{
                  background: "var(--surface-alt)",
                  border: "1px solid #BFDBFE",
                  borderRadius: 10,
                  padding: "8px 14px",
                  fontSize: 12,
                  color: "var(--accent)",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Calendar size={13} />
                {dias} dia{dias !== 1 ? "s" : ""} de afastamento
              </div>
            )}

            <div>
              <label style={labelSt}>Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informações adicionais, motivo, CID (se licença médica)…"
                rows={3}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none"
                style={inputSt}
                onFocus={focusBlue}
                onBlur={blurGray}
              />
            </div>
          </div>

          {error && (
            <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0 0" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Enviando…" : "Enviar solicitação"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function RHFeriasView({ currentUser, users = [], canWrite }) {
  const [requests, setRequests]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filterStatus, setFilterStatus] = useState("todas");
  const [onlyMine, setOnlyMine]       = useState(false);
  const [showSolicitar, setShowSolicitar] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rh_ferias")
        .select("*, profiles:user_id(id, name, initials), approver:approved_by(name)")
        .order("created_at", { ascending: false });
      if (!error) setRequests(data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // ── Email helper ────────────────────────────────────────────────────────────
  const sendRhEmail = useCallback(async (type, req, extraVars = {}) => {
    try {
      // Fetch employee email from profiles if not already present
      let toEmail = req.profiles?.email || null;
      if (!toEmail && req.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", req.user_id)
          .single();
        toEmail = profile?.email || null;
      }
      if (!toEmail) return; // skip silently — no email available

      await supabase.functions.invoke("rh-send-email", {
        body: {
          type,
          to: toEmail,
          variables: {
            EMPLOYEE_NAME: req.profiles?.name || "",
            LEAVE_TYPE:    leaveTypeLabel(req.type),
            START_DATE:    fmt(req.start_date),
            END_DATE:      fmt(req.end_date),
            DAYS_COUNT:    String(calcDias(req.start_date, req.end_date)),
            APP_URL:       window.location.origin,
            ...extraVars,
          },
        },
      });
    } catch (err) {
      // Non-blocking — log but don't surface to user
      console.warn("[RHFeriasView] sendRhEmail error:", err);
    }
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleApprove = async (id) => {
    setActionLoading(id + "_aprovar");
    try {
      const req = requests.find((r) => r.id === id);
      const { error } = await supabase
        .from("rh_ferias")
        .update({
          status:      "aprovado",
          approved_by: currentUser?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (!error) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: "aprovado", approved_by: currentUser?.id, approved_at: new Date().toISOString() }
              : r
          )
        );
        if (req) {
          sendRhEmail("ferias_aprovadas", req, {
            APPROVED_BY: currentUser?.name || currentUser?.email || "",
          });
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    setActionLoading(id + "_recusar");
    try {
      const req = requests.find((r) => r.id === id);
      const { error } = await supabase
        .from("rh_ferias")
        .update({ status: "recusado" })
        .eq("id", id);
      if (!error) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "recusado" } : r))
        );
        if (req) {
          sendRhEmail("ferias_rejeitadas", req, {
            REASON:       req.notes || "Não informado",
            MANAGER_NAME: currentUser?.name || currentUser?.email || "",
          });
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSolicitar = async (data) => {
    const { data: nova, error } = await supabase
      .from("rh_ferias")
      .insert(data)
      .select("*, profiles:user_id(id, name, initials), approver:approved_by(name)")
      .single();
    if (error) throw new Error(error.message);
    setRequests((prev) => [nova, ...prev]);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pendentes  = requests.filter((r) => r.status === "pendente").length;
    const aprovadosMes = requests.filter((r) => r.status === "aprovado" && isThisMonth(r.approved_at || r.start_date)).length;
    const diasAtivos = requests
      .filter((r) => isActiveNow(r))
      .reduce((sum, r) => sum + calcDias(r.start_date, r.end_date), 0);
    return { pendentes, aprovadosMes, diasAtivos };
  }, [requests]);

  // ── Filtered ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filterStatus !== "todas" && r.status !== filterStatus) return false;
      if (onlyMine && r.user_id !== currentUser?.id) return false;
      return true;
    });
  }, [requests, filterStatus, onlyMine, currentUser]);

  const PILL_TABS = [
    { id: "todas",    label: "Todas" },
    { id: "pendente", label: "Pendentes" },
    { id: "aprovado", label: "Aprovadas" },
    { id: "recusado", label: "Recusadas" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck size={22} style={{ color: "var(--text)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
              Férias & Licenças
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Gestão de solicitações de afastamento
          </p>
        </div>
        <button
          onClick={() => setShowSolicitar(true)}
          style={{
            background: "var(--accent)",
            color: "#FFF",
            borderRadius: 10,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus size={14} /> Solicitar
        </button>
      </div>

      {/* Stat cards */}
      <div
        className="grid gap-3 mb-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
      >
        {[
          { label: "Pendentes",           value: stats.pendentes,   color: "var(--amber)",   icon: <Clock size={14} style={{ color: "var(--amber)" }} /> },
          { label: "Aprovadas este mês",  value: stats.aprovadosMes, color: "var(--success)",      icon: <Check size={14} style={{ color: "var(--success)" }} /> },
          { label: "Dias em férias agora", value: stats.diasAtivos,  color: "var(--text)", icon: <Calendar size={14} style={{ color: "var(--text)" }} /> },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              padding: "12px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              {s.icon}
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {s.label}
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        {/* Pill tabs */}
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 3 }}>
          {PILL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              style={{
                background: filterStatus === tab.id ? "var(--surface)" : "transparent",
                color: filterStatus === tab.id ? "var(--text)" : "var(--text-dim)",
                border: "none",
                borderRadius: 8,
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: filterStatus === tab.id ? 700 : 500,
                cursor: "pointer",
                boxShadow: filterStatus === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.1s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mine toggle (only for canWrite users) */}
        {canWrite && (
          <button
            onClick={() => setOnlyMine((v) => !v)}
            style={{
              background: onlyMine ? "var(--color-industria)" : "var(--surface)",
              color: onlyMine ? "#FFF" : "var(--text-dim)",
              border: `1px solid ${onlyMine ? "var(--color-industria)" : "var(--border)"}`,
              borderRadius: 8,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.1s",
            }}
          >
            <Users size={12} />
            {onlyMine ? "Minhas solicitações" : "Todos os funcionários"}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>
          Carregando…
        </div>
      ) : !isSupabaseConfigured ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Calendar size={48} style={{ color: "var(--text-dim)", opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: "var(--text-dim)", fontWeight: 500 }}>Supabase não configurado</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", opacity: 0.6, marginTop: 4 }}>
            Configure as variáveis de ambiente para usar este módulo
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <CalendarCheck size={48} style={{ color: "var(--text-dim)", opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: "var(--text-dim)", fontWeight: 500 }}>
            Nenhuma solicitação encontrada
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", opacity: 0.6, marginTop: 4 }}>
            {filterStatus !== "todas" ? "Tente mudar o filtro de status" : "As solicitações aparecerão aqui"}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                  {["Funcionário", "Tipo", "Período", "Dias", "Status", "Aprovado por", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5"
                      style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => {
                  const profile = req.profiles;
                  const dias = calcDias(req.start_date, req.end_date);
                  const isLoadingAprovar = actionLoading === req.id + "_aprovar";
                  const isLoadingRecusar = actionLoading === req.id + "_recusar";

                  return (
                    <tr
                      key={req.id}
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td className="px-4 py-3">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <UserAvatar user={profile} size={30} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                              {profile?.name || "Desconhecido"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--text)" }}>
                        {leaveTypeLabel(req.type)}
                      </td>
                      <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                        {fmt(req.start_date)} – {fmt(req.end_date)}
                      </td>
                      <td className="px-4 py-3" style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                        {dias}d
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--text-dim)" }}>
                        {req.approver?.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {canWrite && req.status === "pendente" && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={!!actionLoading}
                              title="Aprovar"
                              style={{
                                background: "#DCFCE7",
                                color: "var(--success)",
                                border: "1px solid #BBF7D0",
                                borderRadius: 7,
                                padding: "3px 10px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                opacity: isLoadingAprovar ? 0.6 : 1,
                              }}
                            >
                              <Check size={11} /> {isLoadingAprovar ? "…" : "Aprovar"}
                            </button>
                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={!!actionLoading}
                              title="Recusar"
                              style={{
                                background: "#FEE2E2",
                                color: "var(--danger)",
                                border: "1px solid #FECACA",
                                borderRadius: 7,
                                padding: "3px 10px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                opacity: isLoadingRecusar ? 0.6 : 1,
                              }}
                            >
                              <X size={11} /> {isLoadingRecusar ? "…" : "Recusar"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((req) => {
              const profile = req.profiles;
              const dias = calcDias(req.start_date, req.end_date);
              const isLoadingAprovar = actionLoading === req.id + "_aprovar";
              const isLoadingRecusar = actionLoading === req.id + "_recusar";

              return (
                <div
                  key={req.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <UserAvatar user={profile} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                        {profile?.name || "Desconhecido"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 1 }}>
                        {leaveTypeLabel(req.type)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                        {fmt(req.start_date)} – {fmt(req.end_date)} · {dias}d
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  {req.notes && (
                    <div style={{ fontSize: 11, color: "var(--text-dim)", background: "var(--surface-alt)", borderRadius: 8, padding: "6px 10px", marginBottom: 10, lineHeight: 1.4 }}>
                      {req.notes}
                    </div>
                  )}

                  {canWrite && req.status === "pendente" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={!!actionLoading}
                        style={{
                          flex: 1,
                          background: "#DCFCE7",
                          color: "var(--success)",
                          border: "1px solid #BBF7D0",
                          borderRadius: 8,
                          padding: "6px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                          opacity: isLoadingAprovar ? 0.6 : 1,
                        }}
                      >
                        <Check size={13} /> {isLoadingAprovar ? "…" : "Aprovar"}
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={!!actionLoading}
                        style={{
                          flex: 1,
                          background: "#FEE2E2",
                          color: "var(--danger)",
                          border: "1px solid #FECACA",
                          borderRadius: 8,
                          padding: "6px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                          opacity: isLoadingRecusar ? 0.6 : 1,
                        }}
                      >
                        <X size={13} /> {isLoadingRecusar ? "…" : "Recusar"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Solicitar Modal */}
      {showSolicitar && (
        <SolicitarFeriasModal
          currentUser={currentUser}
          onSave={handleSolicitar}
          onClose={() => setShowSolicitar(false)}
        />
      )}
    </div>
  );
}
