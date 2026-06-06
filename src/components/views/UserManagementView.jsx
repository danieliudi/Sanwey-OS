import React, { useCallback, useMemo, useState } from "react";
import {
  UserPlus, User, Mail, Check, Save, Edit3, Trash2, Info, Loader2, Send, X,
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
  sector: "", supervisorId: "",
};

const EMPTY_INVITE = { email: "", role: "vendedor", companies: [], sector: "", supervisorId: "" };

const ROLE_OPTIONS_BASE = [
  { value: "consultor", label: "Consultor" },
  { value: "vendedor", label: "Vendedor" },
  { value: "gerente", label: "Gerente" },
];

const ROLE_OPTIONS_ADMIN = [
  ...ROLE_OPTIONS_BASE,
  { value: "admin", label: "Admin" },
];

const SECTOR_OPTIONS = [
  { value: "", label: "Sem setor" },
  ...CANONICAL_SECTORS.map(s => ({ value: s, label: s })),
];

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "gerente") return "Gerente";
  if (role === "consultor") return "Consultor";
  return "Vendedor";
}

function roleBadgeVariant(role) {
  if (role === "admin") return "admin";
  if (role === "gerente") return "dark";
  if (role === "consultor") return "secondary";
  return "default";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

export function UserManagementView({
  users, currentUser,
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

  const startNew = useCallback(() => {
    setEditing("new");
    setForm(EMPTY_FORM);
    setModalError(null);
  }, []);

  const startEdit = useCallback((u) => {
    setEditing(u.id);
    setForm({ ...EMPTY_FORM, ...u, sector: u.sector || "", supervisorId: u.supervisorId || "" });
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
    if (!form.name?.trim()) {
      setModalError("Informe o nome.");
      return;
    }
    if (!Array.isArray(form.companies) || form.companies.length === 0) {
      setModalError("Selecione ao menos uma empresa.");
      return;
    }
    const initials = form.initials
      || form.name.split(" ").map(n => n[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();

    setSaving(true);
    setModalError(null);
    try {
      if (form.id) {
        if (onUpdateUser) {
          await onUpdateUser(form.id, {
            name: form.name,
            role: form.role,
            companies: form.companies,
            initials,
            avatarBg: form.avatarBg,
            sector: form.sector || null,
            supervisorId: form.supervisorId || null,
          });
        } else if (onUsersChange) {
          onUsersChange(prev => prev.map(u => u.id === form.id ? { ...u, ...form, initials } : u));
        }
      } else {
        if (onUsersChange) {
          const newUser = { ...form, id: `u_${Date.now()}`, initials };
          onUsersChange(prev => [...prev, newUser]);
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
    if (!isValidEmail(email)) {
      setInviteError("Informe um e-mail válido.");
      return;
    }
    if ((inviteForm.role === "vendedor" || inviteForm.role === "consultor") && inviteForm.companies.length === 0) {
      setInviteError("Selecione ao menos uma empresa para vendedor/consultor.");
      return;
    }
    if (users.some(u => (u.email || "").toLowerCase() === email)) {
      setInviteError("Já existe um usuário cadastrado com este e-mail.");
      return;
    }
    if (invitations.some(i => (i.email || "").toLowerCase() === email)) {
      setInviteError("Já existe um convite pendente para este e-mail.");
      return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      await onCreateInvitation({
        email,
        role: inviteForm.role,
        companies: inviteForm.companies,
        sector: inviteForm.sector || null,
        supervisorId: inviteForm.supervisorId || null,
        invitedBy: currentUser?.id,
      });
      setInviteJustSent(email);
      setInviteForm(EMPTY_INVITE);
    } catch (e) {
      setInviteError(e?.message || String(e));
    } finally {
      setInviting(false);
    }
  }, [inviteForm, onCreateInvitation, currentUser, users, invitations]);

  const remove = useCallback(async (id) => {
    const target = users.find(u => u.id === id);
    if (!target) return;
    const ok = window.confirm(`Remover ${target.name}? Esta ação não pode ser desfeita.`);
    if (!ok) return;
    try {
      if (onDeleteUser) {
        await onDeleteUser(id);
      } else if (onUsersChange) {
        onUsersChange(prev => prev.filter(u => u.id !== id));
      }
    } catch (e) {
      window.alert(`Não foi possível remover: ${e?.message || e}`);
    }
  }, [users, onDeleteUser, onUsersChange]);

  const [resendingId, setResendingId] = useState(null);

  const revoke = useCallback(async (inv) => {
    const ok = window.confirm(`Revogar o convite para ${inv.email}?`);
    if (!ok) return;
    try {
      await onRevokeInvitation(inv.id);
    } catch (e) {
      window.alert(`Não foi possível revogar: ${e?.message || e}`);
    }
  }, [onRevokeInvitation]);

  const resend = useCallback(async (inv) => {
    if (!onResendInvitation) return;
    setResendingId(inv.id);
    try {
      await onResendInvitation(inv.id);
    } catch (e) {
      window.alert(`Não foi possível reenviar: ${e?.message || e}`);
    } finally {
      setResendingId(null);
    }
  }, [onResendInvitation]);

  const toggleCompany = useCallback((id) => {
    setForm(prev => ({
      ...prev,
      companies: prev.companies.includes(id)
        ? prev.companies.filter(c => c !== id)
        : [...prev.companies, id],
    }));
  }, []);

  const toggleInviteCompany = useCallback((id) => {
    setInviteForm(prev => ({
      ...prev,
      companies: prev.companies.includes(id)
        ? prev.companies.filter(c => c !== id)
        : [...prev.companies, id],
    }));
  }, []);

  const canSave = Boolean(form.name && form.companies.length > 0);
  const canManageInvites = supabaseEnabled && Boolean(onCreateInvitation);

  // Vendedores disponíveis como supervisores (para seleção de consultor)
  const vendedorOptions = useMemo(() => [
    { value: "", label: "Sem supervisor" },
    ...users.filter(u => u.role === "vendedor").map(u => ({ value: u.id, label: u.name })),
  ], [users]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Gestão de Usuários
          </h1>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            {users.length} usuários cadastrados · admin &gt; gerente &gt; vendedor &gt; consultor
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageInvites && (
            <Button variant="primary" icon={UserPlus} onClick={openInvite}>Convidar usuário</Button>
          )}
          {!supabaseEnabled && (
            <Button variant="primary" icon={UserPlus} onClick={startNew}>Novo usuário</Button>
          )}
        </div>
      </div>

      {supabaseEnabled && (
        <div
          className="p-3 rounded-xl border flex items-start gap-2 text-xs"
          style={{ background: "#EEF5FC", borderColor: "#CFE2F3", color: "#264C7A" }}
        >
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>Como funciona o convite:</strong> ao convidar, você define cargo e empresas. Peça para a pessoa
            acessar a tela de login e clicar em <em>"Criar conta"</em> com o mesmo e-mail —
            ela já entrará com as permissões certas, sem precisar editar depois.
          </div>
        </div>
      )}

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
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "#FEF3C7", color: "#92400E" }}
                  >
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold" style={{ color: NEUTRAL.graphite }}>{inv.email}</span>
                      <Badge variant={roleBadgeVariant(inv.role)} size="sm">
                        {roleLabel(inv.role)}
                      </Badge>
                      <span
                        className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-widest rounded-xl"
                        style={{ background: "#FEF3C7", color: "#92400E", letterSpacing: "0.15em" }}
                      >
                        Aguardando cadastro
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {inv.companies.length === 0 ? (
                        <span className="text-[11px] italic" style={{ color: NEUTRAL.slate }}>
                          Sem empresas atribuídas
                        </span>
                      ) : (
                        inv.companies.map(c => <CompanyTag key={c} companyId={c} size="sm" />)
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {onResendInvitation && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={resendingId === inv.id ? Loader2 : Send}
                      disabled={resendingId === inv.id}
                      onClick={() => resend(inv)}
                      title={inv.lastSentAt ? `Último envio: ${new Date(inv.lastSentAt).toLocaleString("pt-BR")}` : "Enviar e-mail de convite"}
                    >
                      {resendingId === inv.id ? "Enviando…" : inv.lastSentAt ? "Reenviar" : "Enviar"}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" icon={X} onClick={() => revoke(inv)}>
                    Revogar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className="p-10 flex items-center justify-center gap-2 text-sm" style={{ color: NEUTRAL.slate }}>
          <Loader2 size={14} className="animate-spin" />
          Carregando usuários…
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const pending = u.role === "vendedor" && (!u.companies || u.companies.length === 0);
            return (
              <div
                key={u.id}
                className="p-4 rounded-xl border flex items-center justify-between gap-4 flex-wrap"
                style={{ background: "#FFFFFF", borderColor: pending ? NEUTRAL.gold : "#EFEFEF" }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                    style={{ background: u.avatarBg }}
                  >
                    {u.initials}
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0">
                      <span className="font-semibold text-sm truncate" style={{ color: NEUTRAL.graphite }}>{u.name}</span>
                      <Badge variant={roleBadgeVariant(u.role)} size="sm">
                        {roleLabel(u.role)}
                      </Badge>
                      {u.id === currentUser?.id && (
                        <span
                          className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-widest rounded-xl"
                          style={{ background: NEUTRAL.gold + "20", color: "#8A6A00", letterSpacing: "0.15em" }}
                        >
                          Você
                        </span>
                      )}
                      {pending && (
                        <span
                          className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-widest rounded-xl"
                          style={{ background: "#FEF9E7", color: "#8A6A00", letterSpacing: "0.15em" }}
                        >
                          Aguardando liberação
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs" style={{ color: NEUTRAL.slate }}>{u.email}</span>
                      {u.sector && (
                        <span
                          className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-widest rounded"
                          style={{ background: "#EEF2FF", color: "#3730A3", letterSpacing: "0.12em" }}
                        >
                          {u.sector}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!Array.isArray(u.companies) || u.companies.length === 0 ? (
                        <span className="text-[11px] italic" style={{ color: NEUTRAL.slate }}>
                          Sem empresas atribuídas
                        </span>
                      ) : (
                        u.companies.map(c => <CompanyTag key={c} companyId={c} size="sm" />)
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Edit3}
                    onClick={() => startEdit(u)}
                    disabled={!canEdit(u)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => remove(u.id)}
                    disabled={!canDelete(u)}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={closeModal}
        title={editing === "new" ? "Novo usuário" : "Editar usuário"}
        width={560}
      >
        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label
                className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
                style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
              >
                Nome *
              </label>
              <Input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome completo"
                icon={User}
              />
            </div>
            <div>
              <label
                className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
                style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
              >
                Função
              </label>
              <Select
                value={form.role}
                onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                options={roleOptions}
              />
            </div>
          </div>
          <div>
            <label
              className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
              style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
            >
              Email {supabaseEnabled && <span style={{ textTransform: "none", fontWeight: 400 }}>(não editável — gerenciado pelo login)</span>}
            </label>
            <Input
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@sanwey.com.br"
              icon={Mail}
              type="email"
              disabled={supabaseEnabled}
            />
          </div>
          <div>
            <label
              className="text-[10px] uppercase font-bold tracking-widest mb-2 block"
              style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
            >
              Empresas com acesso *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COMPANY_IDS.map(id => {
                const c = COMPANIES[id];
                const selected = form.companies.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCompany(id)}
                    className="p-3 rounded-xl border flex items-center gap-2 transition-all"
                    style={{
                      background: selected ? c.light : "#FFFFFF",
                      borderColor: selected ? c.primary : "#EFEFEF",
                    }}
                  >
                    <div className="w-3 h-3 rounded-xl" style={{ background: c.primary }} />
                    <span
                      className="font-semibold text-sm flex-1 text-left"
                      style={{ color: selected ? c.dark : NEUTRAL.graphite }}
                    >
                      {c.name}
                    </span>
                    {selected && <Check size={14} color={c.primary} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label
                className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
                style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
              >
                Setor
              </label>
              <Select
                value={form.sector || ""}
                onChange={e => setForm(prev => ({ ...prev, sector: e.target.value }))}
                options={SECTOR_OPTIONS}
              />
            </div>
            {form.role === "consultor" && (
              <div>
                <label
                  className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
                  style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
                >
                  Supervisor (vendedor)
                </label>
                <Select
                  value={form.supervisorId || ""}
                  onChange={e => setForm(prev => ({ ...prev, supervisorId: e.target.value }))}
                  options={vendedorOptions}
                />
              </div>
            )}
          </div>
          {modalError && (
            <div className="p-2 rounded-xl text-xs" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
              {modalError}
            </div>
          )}
        </div>
        <div
          className="px-6 py-4 border-t flex items-center justify-end gap-2"
          style={{ borderColor: "#EFEFEF", background: NEUTRAL.warmWhite }}
        >
          <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon={saving ? Loader2 : Save} onClick={save} disabled={!canSave || saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={inviteOpen}
        onClose={closeInvite}
        title="Convidar usuário"
        width={560}
      >
        <div className="p-6 space-y-4">
          <div>
            <label
              className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
              style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
            >
              E-mail *
            </label>
            <Input
              value={inviteForm.email}
              onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@sanwey.com.br"
              icon={Mail}
              type="email"
              autoFocus
            />
            <div className="text-[11px] mt-1.5" style={{ color: NEUTRAL.slate }}>
              A pessoa precisa criar a conta na tela de login com este mesmo e-mail.
            </div>
          </div>

          <div>
            <label
              className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
              style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
            >
              Função
            </label>
            <Select
              value={inviteForm.role}
              onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
              options={roleOptions}
            />
          </div>

          <div>
            <label
              className="text-[10px] uppercase font-bold tracking-widest mb-2 block"
              style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
            >
              Empresas com acesso {(inviteForm.role === "vendedor" || inviteForm.role === "consultor") && "*"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COMPANY_IDS.map(id => {
                const c = COMPANIES[id];
                const selected = inviteForm.companies.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleInviteCompany(id)}
                    className="p-3 rounded-xl border flex items-center gap-2 transition-all"
                    style={{
                      background: selected ? c.light : "#FFFFFF",
                      borderColor: selected ? c.primary : "#EFEFEF",
                    }}
                  >
                    <div className="w-3 h-3 rounded-xl" style={{ background: c.primary }} />
                    <span
                      className="font-semibold text-sm flex-1 text-left"
                      style={{ color: selected ? c.dark : NEUTRAL.graphite }}
                    >
                      {c.name}
                    </span>
                    {selected && <Check size={14} color={c.primary} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label
                className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
                style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
              >
                Setor
              </label>
              <Select
                value={inviteForm.sector || ""}
                onChange={e => setInviteForm(prev => ({ ...prev, sector: e.target.value }))}
                options={SECTOR_OPTIONS}
              />
            </div>
            {inviteForm.role === "consultor" && (
              <div>
                <label
                  className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
                  style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
                >
                  Supervisor (vendedor)
                </label>
                <Select
                  value={inviteForm.supervisorId || ""}
                  onChange={e => setInviteForm(prev => ({ ...prev, supervisorId: e.target.value }))}
                  options={vendedorOptions}
                />
              </div>
            )}
          </div>

          {inviteError && (
            <div className="p-2 rounded-xl text-xs" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
              {inviteError}
            </div>
          )}

          {inviteJustSent && (
            <div className="p-2.5 rounded-xl text-xs flex items-start gap-2" style={{ background: "#ECFDF5", color: "#065F46" }}>
              <Check size={14} className="shrink-0 mt-0.5" />
              <div>
                Convite registrado para <strong>{inviteJustSent}</strong>. Peça para essa pessoa criar a conta na tela de login.
              </div>
            </div>
          )}
        </div>
        <div
          className="px-6 py-4 border-t flex items-center justify-end gap-2"
          style={{ borderColor: "#EFEFEF", background: NEUTRAL.warmWhite }}
        >
          <Button variant="ghost" onClick={closeInvite} disabled={inviting}>Fechar</Button>
          <Button
            variant="primary"
            icon={inviting ? Loader2 : Send}
            onClick={submitInvite}
            disabled={inviting || !inviteForm.email.trim()}
          >
            {inviting ? "Enviando…" : "Enviar convite"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default UserManagementView;
