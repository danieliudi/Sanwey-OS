import React, { useCallback, useMemo, useState } from "react";
import {
  UserPlus, User, Mail, Check, Save, Edit3, Trash2, Info, Loader2, Send, X,
  Search, Users, Building2, MoreVertical,
} from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { CANONICAL_SECTORS } from "../../constants/taxonomy";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { CompanyTag } from "../ui/CompanyTag";

const EMPTY_FORM = {
  id: null, name: "", email: "", role: "vendedor",
  companies: [], initials: "", avatarBg: "#1E4D8C",
  sectors: [], supervisorId: "",
};

const EMPTY_INVITE = { email: "", role: "vendedor", companies: [], sectors: [], supervisorId: "" };

const ROLE_OPTIONS_BASE = [
  { value: "consultor",         label: "Consultor" },
  { value: "vendedor",          label: "Vendedor" },
  { value: "gerente",           label: "Gerente (CRM)" },
  { value: "marketing",         label: "Marketing" },
  { value: "gerente_marketing", label: "Gerente de Marketing" },
  { value: "agencia",           label: "Agência (Visitante)" },
];

const ROLE_OPTIONS_ADMIN = [
  ...ROLE_OPTIONS_BASE,
  { value: "admin", label: "Admin" },
];

function roleLabel(role) {
  if (role === "admin")             return "Admin";
  if (role === "gerente")           return "Gerente";
  if (role === "consultor")         return "Consultor";
  if (role === "marketing")         return "Marketing";
  if (role === "gerente_marketing") return "G. Marketing";
  if (role === "agencia")           return "Agência";
  return "Vendedor";
}

function roleBadgeVariant(role) {
  if (role === "admin")             return "admin";
  if (role === "gerente")           return "dark";
  if (role === "consultor")         return "secondary";
  if (role === "marketing")         return "primary";
  if (role === "gerente_marketing") return "primary";
  if (role === "agencia")           return "secondary";
  return "default";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

export function UserManagementView({
  users, leads = [],
  currentUser,
  onUpdateUser, onDeleteUser, onUsersChange,
  supabaseEnabled = false, loading = false,
  invitations = [], invitationsLoading = false,
  onCreateInvitation, onRevokeInvitation, onResendInvitation,
}) {
  const isAdmin = currentUser?.role === "admin";
  const roleOptions = isAdmin ? ROLE_OPTIONS_ADMIN : ROLE_OPTIONS_BASE;

  const canEdit = useCallback((target) => {
    if (!target || !currentUser) return false;
    if (target.role === "admin" && !isAdmin) return false;
    return true;
  }, [currentUser, isAdmin]);

  const canDelete = useCallback((target) => {
    if (!target || !currentUser) return false;
    if (target.id === currentUser.id) return false;
    if (target.role === "admin" && !isAdmin) return false;
    return true;
  }, [currentUser, isAdmin]);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteJustSent, setInviteJustSent] = useState(null);

  const [search, setSearch] = useState("");
  const [menuOpenId, setMenuOpenId] = useState(null);

  const startNew = useCallback(() => {
    setEditing("new");
    setForm(EMPTY_FORM);
    setModalError(null);
  }, []);

  const startEdit = useCallback((u) => {
    setEditing(u.id);
    setForm({ ...EMPTY_FORM, ...u, sectors: Array.isArray(u.sectors) ? u.sectors : [], supervisorId: u.supervisorId || "" });
    setModalError(null);
  }, []);

  const closeModal = useCallback(() => {
    setEditing(null);
    setModalError(null);
  }, []);

  const openInvite = useCallback(() => {
    setInviteOpen(true);
    setInviteForm(EMPTY_INVITE);
    setInviteError(null);
    setInviteJustSent(null);
  }, []);

  const closeInvite = useCallback(() => {
    setInviteOpen(false);
    setInviteError(null);
  }, []);

  const save = useCallback(async () => {
    if (!form.name?.trim()) { setModalError("Informe o nome."); return; }
    const companyRequired = form.role === "vendedor" || form.role === "consultor" || form.role === "gerente";
    if (companyRequired && (!Array.isArray(form.companies) || form.companies.length === 0)) {
      setModalError("Selecione ao menos uma empresa."); return;
    }
    const initials = form.initials
      || form.name.split(" ").map(n => n[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
    setSaving(true);
    setModalError(null);
    try {
      if (form.id) {
        if (onUpdateUser) {
          await onUpdateUser(form.id, { name: form.name, role: form.role, companies: form.companies, initials, avatarBg: form.avatarBg, sectors: form.sectors || [], supervisorId: form.supervisorId || null });
        } else if (onUsersChange) {
          onUsersChange(prev => prev.map(u => u.id === form.id ? { ...u, ...form, initials } : u));
        }
      } else {
        if (onUsersChange) {
          onUsersChange(prev => [...prev, { ...form, id: `u_${Date.now()}`, initials }]);
        }
      }
      setEditing(null);
    } catch (e) {
      setModalError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }, [form, onUpdateUser, onUsersChange]);

  const submitInvite = useCallback(async () => {
    const email = inviteForm.email.trim().toLowerCase();
    if (!isValidEmail(email)) { setInviteError("Informe um e-mail válido."); return; }
    if ((inviteForm.role === "vendedor" || inviteForm.role === "consultor") && inviteForm.companies.length === 0) {
      setInviteError("Selecione ao menos uma empresa para vendedor/consultor."); return;
    }
    if (users.some(u => (u.email || "").toLowerCase() === email)) {
      setInviteError("Já existe um usuário cadastrado com este e-mail."); return;
    }
    if (invitations.some(i => (i.email || "").toLowerCase() === email)) {
      setInviteError("Já existe um convite pendente para este e-mail."); return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      await onCreateInvitation({ email, role: inviteForm.role, companies: inviteForm.companies, sectors: inviteForm.sectors || [], supervisorId: inviteForm.supervisorId || null, invitedBy: currentUser?.id });
      setInviteJustSent(email);
      setInviteForm(EMPTY_INVITE);
    } catch (e) {
      setInviteError(e?.message || String(e));
    } finally {
      setInviting(false);
    }
  }, [inviteForm, onCreateInvitation, currentUser, users, invitations]);

  const remove = useCallback((id) => {
    const target = users.find(u => u.id === id);
    if (!target) return;
    setMenuOpenId(null);
    setConfirmDialog({
      message: `Remover ${target.name}? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          if (onDeleteUser) await onDeleteUser(id);
          else if (onUsersChange) onUsersChange(prev => prev.filter(u => u.id !== id));
        } catch (e) {
          window.alert(`Não foi possível remover: ${e?.message || e}`);
        }
      },
    });
  }, [users, onDeleteUser, onUsersChange]);

  const [resendingId, setResendingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }

  const revoke = useCallback((inv) => {
    setConfirmDialog({
      message: `Revogar o convite para ${inv.email}?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try { await onRevokeInvitation(inv.id); } catch (e) { window.alert(`Erro: ${e?.message || e}`); }
      },
    });
  }, [onRevokeInvitation]);

  const resend = useCallback(async (inv) => {
    if (!onResendInvitation) return;
    setResendingId(inv.id);
    try { await onResendInvitation(inv.id); } catch (e) { window.alert(`Erro: ${e?.message || e}`); } finally { setResendingId(null); }
  }, [onResendInvitation]);

  const toggleCompany = useCallback((id) => {
    setForm(prev => ({ ...prev, companies: prev.companies.includes(id) ? prev.companies.filter(c => c !== id) : [...prev.companies, id] }));
  }, []);

  const toggleInviteCompany = useCallback((id) => {
    setInviteForm(prev => ({ ...prev, companies: prev.companies.includes(id) ? prev.companies.filter(c => c !== id) : [...prev.companies, id] }));
  }, []);

  const toggleSector = useCallback((s) => {
    setForm(prev => ({ ...prev, sectors: prev.sectors.includes(s) ? prev.sectors.filter(x => x !== s) : [...prev.sectors, s] }));
  }, []);

  const toggleInviteSector = useCallback((s) => {
    setInviteForm(prev => ({ ...prev, sectors: prev.sectors.includes(s) ? prev.sectors.filter(x => x !== s) : [...prev.sectors, s] }));
  }, []);

  const formCompanyRequired = form.role === "vendedor" || form.role === "consultor" || form.role === "gerente";
  const canSave = Boolean(form.name && (!formCompanyRequired || form.companies.length > 0));
  const canManageInvites = supabaseEnabled && Boolean(onCreateInvitation);

  const vendedorOptions = useMemo(() => [
    { value: "", label: "Sem supervisor" },
    ...users.filter(u => u.role === "vendedor").map(u => ({ value: u.id, label: u.name })),
  ], [users]);

  // Per-user lead stats
  const userStats = useMemo(() => {
    const map = {};
    for (const u of users) {
      const owned = leads.filter(l => l.owner === u.id);
      const won = owned.filter(l => l.stage === "ganho").length;
      const open = owned.filter(l => l.stage !== "ganho" && l.stage !== "perdido").length;
      map[u.id] = { total: owned.length, won, open };
    }
    return map;
  }, [users, leads]);

  // Summary stats
  const totalUsers = users.length;
  const managerCount = users.filter(u => u.role === "gerente" || u.role === "admin").length;
  const sellerCount = users.filter(u => u.role === "vendedor" || u.role === "consultor").length;

  // Filter
  const q = search.trim().toLowerCase();
  const filteredUsers = q
    ? users.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        roleLabel(u.role).toLowerCase().includes(q)
      )
    : users;

  return (
    <div className="space-y-6" onClick={() => setMenuOpenId(null)}>

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: "#201a1a", letterSpacing: "-0.02em" }}>
            Equipe Comercial
          </h1>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            Gerencie usuários, cargos e acessos do time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageInvites && (
            <Button variant="primary" icon={UserPlus} onClick={openInvite}>Convidar</Button>
          )}
          {!supabaseEnabled && (
            <Button variant="primary" icon={UserPlus} onClick={startNew}>Novo usuário</Button>
          )}
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <StatMini label="Total" value={totalUsers} />
        <StatMini label="Gerentes" value={managerCount} accent="#b5000b" />
        <StatMini label="Vendedores" value={sellerCount} />
      </div>

      {/* ── Supabase info ── */}
      {supabaseEnabled && (
        <div
          className="p-3 rounded-xl border flex items-start gap-2 text-xs"
          style={{ background: "#EEF5FC", borderColor: "#CFE2F3", color: "#264C7A" }}
        >
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>Como funciona o convite:</strong> ao convidar, você define cargo e empresas. Peça para a pessoa
            acessar a tela de login e clicar em <em>"Criar conta"</em> com o mesmo e-mail.
          </div>
        </div>
      )}

      {/* ── Pending invites ── */}
      {canManageInvites && invitations.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-bold tracking-widest mb-2" style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}>
            Convites pendentes · {invitations.length}
          </div>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div
                key={inv.id}
                className="p-4 rounded-xl border flex items-center justify-between gap-4 flex-wrap"
                style={{ background: "#FFFBEB", borderColor: "#FCD34D" }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "#FEF3C7", color: "#92400E" }}>
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "#201a1a" }}>{inv.email}</span>
                      <Badge variant={roleBadgeVariant(inv.role)} size="sm">{roleLabel(inv.role)}</Badge>
                      <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-widest rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>
                        Aguardando
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {inv.companies.length === 0
                        ? <span className="text-[11px] italic" style={{ color: NEUTRAL.slate }}>Sem empresas</span>
                        : inv.companies.map(c => <CompanyTag key={c} companyId={c} size="sm" />)
                      }
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {onResendInvitation && (
                    <Button variant="ghost" size="sm" icon={resendingId === inv.id ? Loader2 : Send} disabled={resendingId === inv.id} onClick={() => resend(inv)}>
                      {resendingId === inv.id ? "Enviando…" : inv.lastSentAt ? "Reenviar" : "Enviar"}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" icon={X} onClick={() => revoke(inv)}>Revogar</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: NEUTRAL.slate }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou cargo..."
          className="w-full rounded-xl border text-sm transition-all"
          style={{
            paddingLeft: 42, paddingRight: 16, height: 48,
            borderColor: "#E5E7EB", background: "#FFFFFF", color: "#201a1a", outline: "none",
          }}
          onFocus={e => { e.target.style.borderColor = "#b5000b"; e.target.style.boxShadow = "0 0 0 3px rgba(181,0,11,0.08)"; }}
          onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
        />
      </div>

      {/* ── User cards ── */}
      {loading && users.length === 0 ? (
        <div className="p-10 flex items-center justify-center gap-2 text-sm" style={{ color: NEUTRAL.slate }}>
          <Loader2 size={14} className="animate-spin" />
          Carregando usuários…
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-8 text-center rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB", color: NEUTRAL.slate }}>
          Nenhum usuário encontrado.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredUsers.map(u => {
            const stats = userStats[u.id] || { total: 0, won: 0, open: 0 };
            const pending = (u.role === "vendedor" || u.role === "consultor") && (!u.companies || u.companies.length === 0);
            const isSelf = u.id === currentUser?.id;
            const menuOpen = menuOpenId === u.id;

            return (
              <div
                key={u.id}
                className="rounded-xl border flex flex-col"
                style={{
                  background: "#FFFFFF",
                  borderColor: pending ? "#FCD34D" : "#E5E7EB",
                  boxShadow: "0 1px 4px rgba(32,26,26,0.06)",
                  overflow: "hidden",
                }}
              >
                {/* Card top */}
                <div className="p-5 flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white"
                      style={{ background: u.avatarBg || "#b5000b", fontSize: 20, overflow: "hidden" }}
                    >
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : (u.initials || u.name?.slice(0, 2).toUpperCase() || "?")
                      }
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-[15px] leading-tight truncate" style={{ color: "#201a1a" }}>
                          {u.name}
                        </div>
                        <div className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
                          {u.email || "—"}
                        </div>
                      </div>

                      {/* 3-dot menu */}
                      {(canEdit(u) || canDelete(u)) && (
                        <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setMenuOpenId(menuOpen ? null : u.id)}
                            className="rounded-lg flex items-center justify-center transition-colors"
                            style={{ width: 32, height: 32, background: menuOpen ? "#fef1f0" : "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#fef1f0"; }}
                            onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = "transparent"; }}
                          >
                            <MoreVertical size={15} />
                          </button>
                          {menuOpen && (
                            <div
                              className="absolute right-0 top-9 rounded-xl border flex flex-col overflow-hidden z-20"
                              style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 8px 24px rgba(32,26,26,0.12)", minWidth: 160 }}
                            >
                              {canEdit(u) && (
                                <button
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors"
                                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#201a1a" }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "#fef1f0"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                  onClick={() => { setMenuOpenId(null); startEdit(u); }}
                                >
                                  <Edit3 size={14} /> Editar perfil
                                </button>
                              )}
                              {canDelete(u) && (
                                <button
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors"
                                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ba1a1a" }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "#ffdad6"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                  onClick={() => remove(u.id)}
                                >
                                  <Trash2 size={14} /> Remover
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <Badge variant={roleBadgeVariant(u.role)} size="sm">{roleLabel(u.role)}</Badge>
                      {isSelf && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: "#fef1f0", color: "#b5000b" }}>
                          Você
                        </span>
                      )}
                      {pending && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>
                          Sem empresa
                        </span>
                      )}
                      {Array.isArray(u.sectors) && u.sectors.map(s => (
                        <span key={s} className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: "#EEF2FF", color: "#3730A3" }}>
                          {s}
                        </span>
                      ))}
                    </div>

                    {/* Company tags */}
                    {Array.isArray(u.companies) && u.companies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {u.companies.map(c => <CompanyTag key={c} companyId={c} size="sm" />)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats strip */}
                <div className="border-t mx-0 grid grid-cols-3 divide-x" style={{ borderColor: "#E5E7EB" }}>
                  <StatStrip label="Leads" value={stats.total} />
                  <StatStrip label="Abertos" value={stats.open} />
                  <StatStrip label="Ganhos" value={stats.won} accent="#16A34A" />
                </div>

                {/* Ver Perfil button */}
                <div className="p-4 pt-3">
                  <button
                    onClick={() => canEdit(u) ? startEdit(u) : null}
                    disabled={!canEdit(u)}
                    className="w-full rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                    style={{
                      height: 44,
                      borderColor: canEdit(u) ? "#b5000b" : "#E5E7EB",
                      color: canEdit(u) ? "#b5000b" : NEUTRAL.slate,
                      background: "transparent",
                      cursor: canEdit(u) ? "pointer" : "default",
                    }}
                    onMouseEnter={e => { if (canEdit(u)) { e.currentTarget.style.background = "#fef1f0"; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <User size={15} />
                    Ver Perfil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit / New modal ── */}
      <Modal open={editing !== null} onClose={closeModal} title={editing === "new" ? "Novo usuário" : "Editar usuário"} width={560}>
        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Nome *</FieldLabel>
              <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome completo" icon={User} />
            </div>
            <div>
              <FieldLabel>Função</FieldLabel>
              <Select value={form.role} onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))} options={roleOptions} />
            </div>
          </div>
          <div>
            <FieldLabel>Email {supabaseEnabled && <span style={{ textTransform: "none", fontWeight: 400 }}>(gerenciado pelo login)</span>}</FieldLabel>
            <Input value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="email@sanwey.com.br" icon={Mail} type="email" disabled={supabaseEnabled} />
          </div>
          <div>
            <FieldLabel>Empresas com acesso *</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {COMPANY_IDS.map(id => {
                const c = COMPANIES[id];
                const selected = form.companies.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleCompany(id)}
                    className="p-3 rounded-xl border flex items-center gap-2 transition-all"
                    style={{ background: selected ? c.light : "#FFFFFF", borderColor: selected ? c.primary : "#E5E7EB" }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ background: c.primary }} />
                    <span className="font-semibold text-sm flex-1 text-left" style={{ color: selected ? c.dark : "#201a1a" }}>{c.name}</span>
                    {selected && <Check size={14} color={c.primary} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <FieldLabel>Setores</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {CANONICAL_SECTORS.map(s => {
                const selected = form.sectors.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleSector(s)}
                    className="p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left"
                    style={{ background: selected ? "#EEF2FF" : "#FFFFFF", borderColor: selected ? "#6366F1" : "#E5E7EB" }}
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
                      style={{ background: selected ? "#6366F1" : "transparent", borderColor: selected ? "#6366F1" : "#D1D5DB" }}
                    >
                      {selected && <Check size={11} color="#FFFFFF" />}
                    </div>
                    <span className="text-xs font-semibold leading-tight" style={{ color: selected ? "#3730A3" : "#201a1a" }}>{s}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {form.role === "consultor" && (
            <div>
              <FieldLabel>Supervisor (vendedor)</FieldLabel>
              <Select value={form.supervisorId || ""} onChange={e => setForm(prev => ({ ...prev, supervisorId: e.target.value }))} options={vendedorOptions} />
            </div>
          )}
          {modalError && (
            <div className="p-2 rounded-xl text-xs" style={{ background: "#ffdad6", color: "#ba1a1a" }}>{modalError}</div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "#E5E7EB", background: "#fef1f0" }}>
          <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon={saving ? Loader2 : Save} onClick={save} disabled={!canSave || saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </Modal>

      {/* ── Invite modal ── */}
      <Modal open={inviteOpen} onClose={closeInvite} title="Convidar usuário" width={560}>
        <div className="p-6 space-y-4">
          <div>
            <FieldLabel>E-mail *</FieldLabel>
            <Input value={inviteForm.email} onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))} placeholder="email@sanwey.com.br" icon={Mail} type="email" />
            <div className="text-[11px] mt-1.5" style={{ color: NEUTRAL.slate }}>
              A pessoa precisa criar a conta na tela de login com este mesmo e-mail.
            </div>
          </div>
          <div>
            <FieldLabel>Função</FieldLabel>
            <Select value={inviteForm.role} onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))} options={roleOptions} />
          </div>
          <div>
            <FieldLabel>Empresas com acesso {(inviteForm.role === "vendedor" || inviteForm.role === "consultor") && "*"}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {COMPANY_IDS.map(id => {
                const c = COMPANIES[id];
                const selected = inviteForm.companies.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleInviteCompany(id)}
                    className="p-3 rounded-xl border flex items-center gap-2 transition-all"
                    style={{ background: selected ? c.light : "#FFFFFF", borderColor: selected ? c.primary : "#E5E7EB" }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ background: c.primary }} />
                    <span className="font-semibold text-sm flex-1 text-left" style={{ color: selected ? c.dark : "#201a1a" }}>{c.name}</span>
                    {selected && <Check size={14} color={c.primary} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <FieldLabel>Setores</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {CANONICAL_SECTORS.map(s => {
                const selected = inviteForm.sectors.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleInviteSector(s)}
                    className="p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left"
                    style={{ background: selected ? "#EEF2FF" : "#FFFFFF", borderColor: selected ? "#6366F1" : "#E5E7EB" }}
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
                      style={{ background: selected ? "#6366F1" : "transparent", borderColor: selected ? "#6366F1" : "#D1D5DB" }}
                    >
                      {selected && <Check size={11} color="#FFFFFF" />}
                    </div>
                    <span className="text-xs font-semibold leading-tight" style={{ color: selected ? "#3730A3" : "#201a1a" }}>{s}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {inviteForm.role === "consultor" && (
            <div>
              <FieldLabel>Supervisor (vendedor)</FieldLabel>
              <Select value={inviteForm.supervisorId || ""} onChange={e => setInviteForm(prev => ({ ...prev, supervisorId: e.target.value }))} options={vendedorOptions} />
            </div>
          )}
          {inviteError && (
            <div className="p-2 rounded-xl text-xs" style={{ background: "#ffdad6", color: "#ba1a1a" }}>{inviteError}</div>
          )}
          {inviteJustSent && (
            <div className="p-2.5 rounded-xl text-xs flex items-start gap-2" style={{ background: "#ECFDF5", color: "#065F46" }}>
              <Check size={14} className="shrink-0 mt-0.5" />
              <div>Convite registrado para <strong>{inviteJustSent}</strong>. Peça para criar a conta na tela de login.</div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "#E5E7EB", background: "#fef1f0" }}>
          <Button variant="ghost" onClick={closeInvite} disabled={inviting}>Fechar</Button>
          <Button variant="primary" icon={inviting ? Loader2 : Send} onClick={submitInvite} disabled={inviting || !inviteForm.email.trim()}>
            {inviting ? "Enviando…" : "Enviar convite"}
          </Button>
        </div>
      </Modal>

      {/* ── Confirm dialog ── */}
      <Modal open={!!confirmDialog} onClose={() => setConfirmDialog(null)} title="Confirmar ação" width={400}>
        <div className="p-6">
          <p className="text-sm mb-6" style={{ color: "#201a1a", lineHeight: 1.6 }}>{confirmDialog?.message}</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={confirmDialog?.onConfirm}
              style={{ background: "#ba1a1a" }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function StatMini({ label, value, accent }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
      <div className="text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>{label}</div>
      <div className="font-bold" style={{ fontSize: 28, color: accent || "#201a1a", lineHeight: 1, letterSpacing: "-0.02em" }}>
        {value}
      </div>
    </div>
  );
}

function StatStrip({ label, value, accent }) {
  return (
    <div className="py-3 px-4 text-center">
      <div className="text-[10px] uppercase font-bold tracking-wider mb-0.5" style={{ color: "#6B7280", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div className="font-bold text-lg" style={{ color: accent || "#201a1a", letterSpacing: "-0.01em" }}>
        {value}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block" style={{ color: "#6B7280", letterSpacing: "0.15em" }}>
      {children}
    </label>
  );
}

export default UserManagementView;
