import React, { useCallback, useMemo, useState } from "react";
import {
  UserPlus, User, Mail, Check, Save, Edit3, Trash2, Info, Loader2, Send, X,
  Search, Users, Building2, MoreVertical, RotateCcw, MessageCircle, MessageCircleOff,
} from "lucide-react";
import { COMPANIES, COMPANY_IDS, MARKETING_UNIT_IDS, MARKETING_UNIT_LABELS, MARKETING_UNIT_COLORS, NEUTRAL } from "../../constants/companies";
import { CANONICAL_SECTORS } from "../../constants/taxonomy";
import { useMarketingSuppliers } from "../../hooks/use-marketing-suppliers";
import { useModuleOverrides } from "../../hooks/use-module-overrides";
import { MODULE_GROUPS, defaultModulesForRoles, effectiveModules, computeRoleFlags } from "../../utils/module-access";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { CompanyTag } from "../ui/CompanyTag";
import { StatCard } from "../ui/StatCard";
import { EmptyState } from "../ui/EmptyState";
import { FilterBar } from "../shared/FilterBar";
import { Card, CardGrid, CardSkeleton, GridListToggle } from "../shared/Card";

const EMPTY_FORM = {
  id: null, name: "", email: "", role: "vendedor",
  // Cargos adicionais além do principal (multi-cargo, FASE 1) — o cargo
  // principal (`role`) sempre entra em `roles` sozinho, não precisa repetir
  // aqui (ver save() e profiles_sync_roles no banco).
  additionalRoles: [],
  companies: [], initials: "", avatarBg: "var(--accent)",
  sectors: [], supervisorId: "", supplierId: "",
  chatEnabled: true,
};

const EMPTY_INVITE = { email: "", name: "", role: "vendedor", companies: [], sectors: [], supervisorId: "", supplierId: "" };

const ROLE_OPTIONS_BASE = [
  { value: "vendedor",          label: "Vendedor" },
  { value: "gerente",           label: "Gerente Comercial" },
  { value: "marketing",         label: "Marketing" },
  { value: "gerente_marketing", label: "Gerente de Marketing" },
  { value: "agencia",           label: "Agência (Visitante)" },
  { value: "rh",                label: "RH" },
  { value: "gerente_rh",        label: "Gerente de RH" },
];

const ROLE_OPTIONS_ADMIN = [
  ...ROLE_OPTIONS_BASE,
  // Diretoria: vê tudo da plataforma em modo leitura, não escreve nada — só
  // admin concede (mesmo critério do próprio "admin" abaixo, dado o alcance
  // do papel). Ver migration 20260756_papel_diretoria.sql.
  { value: "diretoria", label: "Diretoria" },
  // Comex (Importação/Exportação Direta): cargo dedicado, só admin atribui —
  // mesmo critério de "diretoria" acima, dado o alcance do módulo isolado.
  { value: "comex", label: "Comex" },
  { value: "admin", label: "Admin" },
];

// Achado F-01 da auditoria funcional (19/08/2026, decisão do Daniel
// 20/08/2026): Monte Mor gera solicitação real pro Marketing atender
// (MARKETING_UNIT_IDS já previa isso), mas não existia NENHUM jeito de dar
// a unidade a um usuário aqui — o seletor só iterava COMPANY_IDS. "montemor"
// não tem entrada em COMPANIES (não é empresa vendedora, ver comentário em
// constants/companies.js), só em MARKETING_UNIT_LABELS/_COLORS — por isso
// esta função resolve os dois casos em vez de assumir COMPANIES[id] sempre.
function unitDisplay(id) {
  if (COMPANIES[id]) return COMPANIES[id];
  const primary = MARKETING_UNIT_COLORS[id] || NEUTRAL.slate;
  return { name: MARKETING_UNIT_LABELS[id] || id, primary, dark: primary, light: `${primary}1F` };
}

function roleLabel(role) {
  if (role === "admin")             return "Admin";
  if (role === "gerente")           return "Gerente";
  if (role === "marketing")         return "Marketing";
  if (role === "gerente_marketing") return "G. Marketing";
  if (role === "agencia")           return "Agência";
  if (role === "rh")                return "RH";
  if (role === "gerente_rh")        return "Ger. RH";
  if (role === "diretoria")         return "Diretoria";
  if (role === "comex")             return "Comex";
  return "Vendedor";
}

function roleBadgeVariant(role) {
  if (role === "admin")             return "admin";
  if (role === "gerente")           return "dark";
  if (role === "marketing")         return "primary";
  if (role === "gerente_marketing") return "primary";
  if (role === "agencia")           return "secondary";
  if (role === "rh")                return "secondary";
  if (role === "gerente_rh")        return "dark";
  if (role === "diretoria")         return "admin";
  if (role === "comex")             return "primary";
  return "default";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

// Setores só filtram lead pra quem vende de fato (DashboardView/CRMView
// filtram por user.sectors só quando role é vendedor) — pras demais funções
// o campo não faz nada, então nem faz sentido mostrar.
function roleUsesSectors(role) {
  return role === "vendedor";
}

// Fornecedor vinculado só existe pra escopar login de agência a UM fornecedor
// de marketing específico (ver 20260718_marketing_agencia_supplier_scoping.sql)
// — hoje opcional (só existe uma agência cadastrada), mas já deixa pronto pra
// quando houver mais de uma.
function roleUsesSupplier(role) {
  return role === "agencia";
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

  const { suppliers } = useMarketingSuppliers({});
  const agencySuppliers = useMemo(() => suppliers.filter(s => s.category === "agencia" && s.isActive), [suppliers]);

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

  // Acesso por módulo (complementar aos cargos) — só existe pra usuário já
  // criado (precisa de um user_id real). Os cargos no form (já editáveis
  // acima) decidem o padrão em tempo real, antes mesmo de salvar — assim o
  // admin vê o efeito de trocar o cargo no "Acesso por módulo" na hora.
  // Só admin gerencia overrides (mesma regra da RLS em
  // profile_module_overrides) — gerente Comercial acessa esta tela, mas não
  // deve ver/editar acesso por módulo de outra pessoa.
  const editingExistingUser = editing !== null && editing !== "new" && isAdmin;
  const { overrides: moduleOverrides, setOverride: setModuleOverride, clearOverride: clearModuleOverride } =
    useModuleOverrides({ userId: editingExistingUser ? form.id : null, enabled: editingExistingUser });
  const formRoles = useMemo(() => [form.role, ...(form.additionalRoles || [])], [form.role, form.additionalRoles]);
  const formRoleFlags = useMemo(() => computeRoleFlags(formRoles), [formRoles]);
  const formAllowedModules = useMemo(() => effectiveModules(formRoles, moduleOverrides), [formRoles, moduleOverrides]);
  const formDefaultModules = useMemo(() => defaultModulesForRoles(formRoles), [formRoles]);
  const moduleOverrideMap = useMemo(() => new Map(moduleOverrides.map(o => [o.moduleId, o.allow])), [moduleOverrides]);
  const [savingModuleId, setSavingModuleId] = useState(null);

  const toggleModule = useCallback(async (moduleId) => {
    setSavingModuleId(moduleId);
    try {
      await setModuleOverride(moduleId, !formAllowedModules.has(moduleId));
    } finally {
      setSavingModuleId(null);
    }
  }, [setModuleOverride, formAllowedModules]);

  const resetModule = useCallback(async (moduleId) => {
    setSavingModuleId(moduleId);
    try {
      await clearModuleOverride(moduleId);
    } finally {
      setSavingModuleId(null);
    }
  }, [clearModuleOverride]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteJustSent, setInviteJustSent] = useState(null);

  const [search, setSearch] = useState("");
  // Densidade lista por padrão: página nomeada explicitamente na spec (seção
  // 3, doc de padrões de página) como candidata a lista dado volume potencial
  // de dezenas de usuários — usuário pode alternar pra grade a qualquer momento.
  const [density, setDensity] = useState("list");

  const startNew = useCallback(() => {
    setEditing("new");
    setForm(EMPTY_FORM);
    setModalError(null);
  }, []);

  const startEdit = useCallback((u) => {
    setEditing(u.id);
    const additionalRoles = Array.isArray(u.roles) ? u.roles.filter(r => r !== u.role) : [];
    setForm({ ...EMPTY_FORM, ...u, additionalRoles, sectors: Array.isArray(u.sectors) ? u.sectors : [], supervisorId: u.supervisorId || "", supplierId: u.supplierId || "" });
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
    const companyRequired = form.role === "vendedor" || form.role === "gerente";
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
          const roles = [form.role, ...(form.additionalRoles || []).filter(r => r !== form.role)];
          await onUpdateUser(form.id, { name: form.name, role: form.role, roles, companies: form.companies, initials, avatarBg: form.avatarBg, sectors: form.sectors || [], supervisorId: form.supervisorId || null, supplierId: form.supplierId || null, chatEnabled: form.chatEnabled !== false });
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
    // Nome real capturado desde o convite, em vez de depender do fallback
    // do trigger (local-part do e-mail, ex.: "iudiyano") — achado BUG-08/10
    // da auditoria de QA.
    if (!inviteForm.name.trim()) { setInviteError("Informe o nome da pessoa."); return; }
    if (inviteForm.role === "vendedor" && inviteForm.companies.length === 0) {
      setInviteError("Selecione ao menos uma empresa para vendedor."); return;
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
      const result = await onCreateInvitation({ email, name: inviteForm.name.trim(), role: inviteForm.role, companies: inviteForm.companies, sectors: inviteForm.sectors || [], supervisorId: inviteForm.supervisorId || null, supplierId: inviteForm.supplierId || null, invitedBy: currentUser?.id });
      if (result?.alreadyRegistered) {
        setInviteError(`${email} já possui uma conta ativa no Supabase Auth. Peça para a pessoa entrar normalmente ou usar "Esqueci minha senha" — nenhum e-mail de convite é enviado nesse caso.`);
      } else {
        setInviteJustSent(email);
        setInviteForm(EMPTY_INVITE);
      }
    } catch (e) {
      setInviteError(e?.message || String(e));
    } finally {
      setInviting(false);
    }
  }, [inviteForm, onCreateInvitation, currentUser, users, invitations]);

  const remove = useCallback((id) => {
    const target = users.find(u => u.id === id);
    if (!target) return;
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
    try {
      const result = await onResendInvitation(inv.id);
      if (result?.alreadyRegistered) {
        window.alert(`${inv.email} já possui uma conta ativa no Supabase Auth. Peça para a pessoa entrar normalmente ou usar "Esqueci minha senha" — nenhum e-mail de convite é enviado nesse caso.`);
      }
    } catch (e) { window.alert(`Erro: ${e?.message || e}`); } finally { setResendingId(null); }
  }, [onResendInvitation]);

  const toggleCompany = useCallback((id) => {
    setForm(prev => ({ ...prev, companies: prev.companies.includes(id) ? prev.companies.filter(c => c !== id) : [...prev.companies, id] }));
  }, []);

  const toggleInviteCompany = useCallback((id) => {
    setInviteForm(prev => ({ ...prev, companies: prev.companies.includes(id) ? prev.companies.filter(c => c !== id) : [...prev.companies, id] }));
  }, []);

  const toggleFormRole = useCallback((role) => {
    setForm(prev => {
      const nextAdditional = prev.additionalRoles.includes(role)
        ? prev.additionalRoles.filter(r => r !== role)
        : [...prev.additionalRoles, role];
      const stillNeedsSectors = roleUsesSectors(prev.role) || nextAdditional.some(roleUsesSectors);
      const stillNeedsSupplier = roleUsesSupplier(prev.role) || nextAdditional.some(roleUsesSupplier);
      return {
        ...prev,
        additionalRoles: nextAdditional,
        sectors: stillNeedsSectors ? prev.sectors : [],
        supplierId: stillNeedsSupplier ? prev.supplierId : "",
      };
    });
  }, []);

  const toggleSector = useCallback((s) => {
    setForm(prev => ({ ...prev, sectors: prev.sectors.includes(s) ? prev.sectors.filter(x => x !== s) : [...prev.sectors, s] }));
  }, []);

  const toggleInviteSector = useCallback((s) => {
    setInviteForm(prev => ({ ...prev, sectors: prev.sectors.includes(s) ? prev.sectors.filter(x => x !== s) : [...prev.sectors, s] }));
  }, []);

  const formCompanyRequired = form.role === "vendedor" || form.role === "gerente";
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

  // Convite ainda não aceito (auth.users/profiles já existe desde o envio
  // do convite, não só na aceitação — sem essa exclusão, o card de
  // estatística contava convite pendente como usuário ativo de verdade
  // (achado BUG-10 da auditoria de QA).
  const pendingInviteEmails = useMemo(
    () => new Set(invitations.map(i => (i.email || "").toLowerCase())),
    [invitations]
  );
  const isPendingInviteUser = useCallback(
    (u) => pendingInviteEmails.has((u.email || "").toLowerCase()),
    [pendingInviteEmails]
  );

  // Summary stats — exclui convites ainda não aceitos.
  const confirmedUsers = useMemo(() => users.filter(u => !isPendingInviteUser(u)), [users, isPendingInviteUser]);
  const totalUsers = confirmedUsers.length;
  const managerCount = confirmedUsers.filter(u => u.role === "gerente" || u.role === "admin").length;
  const sellerCount = confirmedUsers.filter(u => u.role === "vendedor").length;

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
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Equipe Comercial
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={Users} value={totalUsers} label="Total" />
        <StatCard icon={Building2} value={managerCount} label="Gerentes" />
        <StatCard icon={User} value={sellerCount} label="Vendedores" />
      </div>

      {/* ── Supabase info ── */}
      {supabaseEnabled && (
        <div
          className="p-3 rounded-xl border flex items-start gap-2 text-xs"
          style={{ background: "#EEF5FC", borderColor: "#CFE2F3", color: "#264C7A" }}
        >
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>Como funciona o convite:</strong> ao convidar, você já define cargo e empresas. A pessoa só
            precisa clicar no link do e-mail — ela entra direto, sem precisar criar conta. Se o link expirar ou
            ela disser que o e-mail já está cadastrado, oriente a usar <em>"Esqueci minha senha"</em> na tela de
            login.
          </div>
        </div>
      )}

      {/* ── Pending invites ── */}
      {canManageInvites && invitations.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-bold tracking-widest mb-2" style={{ color: "var(--text-dim)", letterSpacing: "0.15em" }}>
            Convites pendentes · {invitations.length}
          </div>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div
                key={inv.id}
                className="p-4 rounded-xl border flex items-center justify-between gap-4 flex-wrap"
                style={{ background: "var(--amber-bg)", borderColor: "color-mix(in srgb, var(--amber) 35%, transparent)" }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{inv.email}</span>
                      <Badge variant={roleBadgeVariant(inv.role)} size="sm">{roleLabel(inv.role)}</Badge>
                      <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-widest rounded-full" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>
                        Aguardando
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {inv.companies.length === 0
                        ? <span className="text-[11px] italic" style={{ color: "var(--text-dim)" }}>Sem empresas</span>
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
      <FilterBar
        search={{ value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Buscar por nome, e-mail ou cargo…" }}
        trailing={<GridListToggle value={density} onChange={setDensity} />}
      />

      {/* ── User cards ── */}
      {loading && users.length === 0 ? (
        <CardGrid density={density}>
          {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} density={density} />)}
        </CardGrid>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum usuário cadastrado ainda"
          description="Cadastre ou convide o primeiro usuário para gerenciar cargos e acessos do time."
          action={
            canManageInvites
              ? <Button variant="primary" icon={UserPlus} onClick={openInvite}>Convidar</Button>
              : !supabaseEnabled
                ? <Button variant="primary" icon={UserPlus} onClick={startNew}>Novo usuário</Button>
                : null
          }
        />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum resultado para esta busca"
          description="Nenhum usuário com esse nome, e-mail ou cargo. Tente outro termo ou limpe a busca."
          action={
            <button
              onClick={() => setSearch("")}
              style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Limpar busca
            </button>
          }
        />
      ) : (
        <CardGrid density={density}>
          {filteredUsers.map(u => {
            const stats = userStats[u.id] || { total: 0, won: 0, open: 0 };
            const pending = u.role === "vendedor" && (!u.companies || u.companies.length === 0);
            const pendingInvite = isPendingInviteUser(u);
            const isSelf = u.id === currentUser?.id;
            const editable = canEdit(u);
            const deletable = canDelete(u);

            return (
              <Card
                key={u.id}
                density={density}
                interactive={editable || deletable}
                onClick={editable ? () => startEdit(u) : undefined}
                icon={
                  u.avatarUrl
                    ? <img src={u.avatarUrl} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: density === "list" ? 6 : 8 }} />
                    : <span style={{ color: "#FFF", fontSize: density === "list" ? 11 : 14, fontWeight: 700 }}>{u.initials || u.name?.slice(0, 2).toUpperCase() || "?"}</span>
                }
                iconBg={u.avatarBg || "var(--accent)"}
                title={u.name}
                meta={u.email || "—"}
                status={
                  pendingInvite
                    ? { color: "var(--text-dim)", label: "Convite pendente" }
                    : pending
                    ? { color: "var(--amber)", label: "Sem empresa" }
                    : { color: "var(--text-dim)", label: roleLabel(u.role) }
                }
                badges={
                  <>
                    <Badge variant={roleBadgeVariant(u.role)} size="sm">{roleLabel(u.role)}</Badge>
                    {Array.isArray(u.roles) && u.roles.filter(r => r !== u.role).map(r => (
                      <Badge key={r} variant={roleBadgeVariant(r)} size="sm">+ {roleLabel(r)}</Badge>
                    ))}
                    {isSelf && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: "var(--surface-alt)", color: "var(--accent)" }}>
                        Você
                      </span>
                    )}
                    {/* Convite ainda não aceito — antes essa linha da lista
                        geral (não só a seção separada "Convites pendentes")
                        era indistinguível de um usuário com acesso já
                        confirmado (achado BUG-10 da auditoria de QA). */}
                    {pendingInvite && <Badge variant="urgent" size="sm">Convite pendente</Badge>}
                    {pending && <Badge variant="urgent" size="sm">Sem empresa</Badge>}
                    {Array.isArray(u.sectors) && u.sectors.map(s => (
                      <span key={s} className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: "#EEF2FF", color: "#3730A3" }}>
                        {s}
                      </span>
                    ))}
                  </>
                }
                footer={`${stats.total} lead(s) · ${stats.won} ganho(s)`}
                menu={
                  (editable || deletable)
                    ? <UserCardMenu editable={editable} deletable={deletable} onEdit={() => startEdit(u)} onDelete={() => remove(u.id)} />
                    : null
                }
              >
                {Array.isArray(u.companies) && u.companies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {u.companies.map(c => <CompanyTag key={c} companyId={c} size="sm" />)}
                  </div>
                )}
                <div className="grid grid-cols-3 divide-x rounded-lg" style={{ border: "1px solid var(--border)" }}>
                  <StatStrip label="Leads" value={stats.total} />
                  <StatStrip label="Abertos" value={stats.open} />
                  <StatStrip label="Ganhos" value={stats.won} accent="var(--success)" />
                </div>
              </Card>
            );
          })}
        </CardGrid>
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
              <FieldLabel>Função principal</FieldLabel>
              <Select value={form.role} onChange={e => {
                const nextRole = e.target.value;
                setForm(prev => {
                  const nextAdditional = prev.additionalRoles.filter(r => r !== nextRole);
                  const stillNeedsSectors = roleUsesSectors(nextRole) || nextAdditional.some(roleUsesSectors);
                  const stillNeedsSupplier = roleUsesSupplier(nextRole) || nextAdditional.some(roleUsesSupplier);
                  return { ...prev, role: nextRole, additionalRoles: nextAdditional, sectors: stillNeedsSectors ? prev.sectors : [], supplierId: stillNeedsSupplier ? prev.supplierId : "" };
                });
              }} options={roleOptions} />
            </div>
          </div>
          <div>
            <FieldLabel>Cargos adicionais <span style={{ textTransform: "none", fontWeight: 400 }}>(opcional — usuário acumula acesso dos dois)</span></FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {roleOptions.filter(opt => opt.value !== form.role).map(opt => {
                const selected = form.additionalRoles.includes(opt.value);
                return (
                  <button key={opt.value} type="button" onClick={() => toggleFormRole(opt.value)}
                    className="p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left"
                    style={{ background: selected ? "#EEF2FF" : "var(--surface)", borderColor: selected ? "#6366F1" : "var(--border)" }}
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
                      style={{ background: selected ? "#6366F1" : "transparent", borderColor: selected ? "#6366F1" : "var(--border-strong)" }}
                    >
                      {selected && <Check size={11} color="#FFFFFF" />}
                    </div>
                    <span className="text-xs font-semibold leading-tight" style={{ color: selected ? "#3730A3" : "var(--text)" }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <FieldLabel>Email {supabaseEnabled && <span style={{ textTransform: "none", fontWeight: 400 }}>(gerenciado pelo login)</span>}</FieldLabel>
            <Input value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="email@sanwey.com.br" icon={Mail} type="email" disabled={supabaseEnabled} />
          </div>
          <div>
            <FieldLabel>Empresas com acesso {formCompanyRequired && "*"}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {MARKETING_UNIT_IDS.map(id => {
                const c = unitDisplay(id);
                const selected = form.companies.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleCompany(id)}
                    className="p-3 rounded-xl border flex items-center gap-2 transition-all"
                    style={{ background: selected ? c.light : "var(--surface)", borderColor: selected ? c.primary : "var(--border)" }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ background: c.primary }} />
                    <span className="font-semibold text-sm flex-1 text-left" style={{ color: selected ? c.dark : "var(--text)" }}>{c.name}</span>
                    {selected && <Check size={14} color={c.primary} />}
                  </button>
                );
              })}
            </div>
          </div>
          {(roleUsesSectors(form.role) || form.additionalRoles.some(roleUsesSectors)) && (
          <div>
            <FieldLabel>Setores</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {CANONICAL_SECTORS.map(s => {
                const selected = form.sectors.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleSector(s)}
                    className="p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left"
                    style={{ background: selected ? "#EEF2FF" : "var(--surface)", borderColor: selected ? "#6366F1" : "var(--border)" }}
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
                      style={{ background: selected ? "#6366F1" : "transparent", borderColor: selected ? "#6366F1" : "var(--border-strong)" }}
                    >
                      {selected && <Check size={11} color="#FFFFFF" />}
                    </div>
                    <span className="text-xs font-semibold leading-tight" style={{ color: selected ? "#3730A3" : "var(--text)" }}>{s}</span>
                  </button>
                );
              })}
            </div>
          </div>
          )}
          {form.role === "vendedor" && (
            <div>
              <FieldLabel>Supervisor <span style={{ textTransform: "none", fontWeight: 400 }}>(opcional)</span></FieldLabel>
              <Select value={form.supervisorId || ""} onChange={e => setForm(prev => ({ ...prev, supervisorId: e.target.value }))} options={vendedorOptions.filter(o => o.value !== form.id)} />
              <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>
                Quem supervisiona também enxerga os negócios deste vendedor no Funil de Vendas.
              </div>
            </div>
          )}
          {(roleUsesSupplier(form.role) || form.additionalRoles.some(roleUsesSupplier)) && (
            <div>
              <FieldLabel>Fornecedor vinculado <span style={{ textTransform: "none", fontWeight: 400 }}>(opcional)</span></FieldLabel>
              <Select
                value={form.supplierId || ""}
                onChange={e => setForm(prev => ({ ...prev, supplierId: e.target.value }))}
                options={[{ value: "", label: "Nenhum (sem restrição)" }, ...agencySuppliers.map(s => ({ value: s.id, label: s.name }))]}
              />
              <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>
                Restringe o acesso deste login às campanhas/entregas do fornecedor selecionado. Deixe em branco enquanto houver apenas uma agência cadastrada.
              </div>
            </div>
          )}
          {editingExistingUser && (
            <div>
              <FieldLabel>
                Acesso por módulo <span style={{ textTransform: "none", fontWeight: 400 }}>(exceções ao cargo — sem marcar nada aqui, vale o padrão do cargo)</span>
              </FieldLabel>
              {formRoleFlags.isAgencia || formRoleFlags.isPortalOnly ? (
                <div className="text-xs p-3 rounded-xl" style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                  Não se aplica a Agência/Portal — esses cargos têm navegação fixa própria, sem controle por módulo.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {MODULE_GROUPS.map(group => (
                    <div key={group.label}>
                      <div className="text-[10px] uppercase font-bold tracking-widest mb-1.5" style={{ color: "var(--text-dim)", letterSpacing: "0.1em" }}>
                        {group.label}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.modules.map(m => {
                          const checked = formAllowedModules.has(m.id);
                          const isDefault = formDefaultModules.has(m.id);
                          const hasOverride = moduleOverrideMap.has(m.id);
                          const busy = savingModuleId === m.id;
                          return (
                            <div key={m.id} className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleModule(m.id)}
                                disabled={busy}
                                className="flex-1 p-2 rounded-lg border flex items-center gap-2 transition-all text-left"
                                style={{ background: checked ? "#EEF2FF" : "var(--surface)", borderColor: checked ? "#6366F1" : "var(--border)", opacity: busy ? 0.6 : 1 }}
                              >
                                <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
                                  style={{ background: checked ? "#6366F1" : "transparent", borderColor: checked ? "#6366F1" : "var(--border-strong)" }}
                                >
                                  {checked && <Check size={11} color="#FFFFFF" />}
                                </div>
                                <span className="text-xs font-semibold leading-tight flex-1" style={{ color: checked ? "#3730A3" : "var(--text)" }}>{m.label}</span>
                              </button>
                              {hasOverride && (
                                <button
                                  type="button"
                                  onClick={() => resetModule(m.id)}
                                  disabled={busy}
                                  title={`Personalizado (padrão do cargo: ${isDefault ? "concede" : "não concede"}) — clique pra restaurar o padrão`}
                                  className="flex items-center justify-center rounded-lg shrink-0"
                                  style={{ width: 26, height: 26, background: "var(--amber-bg)", color: "var(--amber)", border: "none", cursor: busy ? "default" : "pointer" }}
                                >
                                  <RotateCcw size={11} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {editingExistingUser && (
            <div>
              <FieldLabel>Chat interno</FieldLabel>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, chatEnabled: prev.chatEnabled === false }))}
                className="w-full p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left"
                style={{
                  background: form.chatEnabled !== false ? "var(--success-bg)" : "var(--danger-bg)",
                  borderColor: form.chatEnabled !== false ? "var(--success)" : "var(--danger)",
                }}
              >
                {form.chatEnabled !== false
                  ? <MessageCircle size={16} color="var(--success)" />
                  : <MessageCircleOff size={16} color="var(--danger)" />}
                <span className="text-xs font-semibold flex-1" style={{ color: form.chatEnabled !== false ? "var(--success)" : "var(--danger)" }}>
                  {form.chatEnabled !== false ? "Liberado — pode ler e enviar mensagens" : "Bloqueado — sem acesso a nenhum canal"}
                </span>
              </button>
            </div>
          )}
          {modalError && (
            <div className="p-2 rounded-xl text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{modalError}</div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
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
            <FieldLabel>Nome *</FieldLabel>
            <Input value={inviteForm.name} onChange={e => setInviteForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome completo" icon={User} />
          </div>
          <div>
            <FieldLabel>E-mail *</FieldLabel>
            <Input value={inviteForm.email} onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))} placeholder="email@sanwey.com.br" icon={Mail} type="email" />
            <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>
              A pessoa precisa criar a conta na tela de login com este mesmo e-mail.
            </div>
          </div>
          <div>
            <FieldLabel>Função</FieldLabel>
            <Select value={inviteForm.role} onChange={e => {
              const nextRole = e.target.value;
              setInviteForm(prev => ({
                ...prev,
                role: nextRole,
                sectors: roleUsesSectors(nextRole) ? prev.sectors : [],
                supplierId: roleUsesSupplier(nextRole) ? prev.supplierId : "",
              }));
            }} options={roleOptions} />
          </div>
          <div>
            <FieldLabel>Empresas com acesso {inviteForm.role === "vendedor" && "*"}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {MARKETING_UNIT_IDS.map(id => {
                const c = unitDisplay(id);
                const selected = inviteForm.companies.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleInviteCompany(id)}
                    className="p-3 rounded-xl border flex items-center gap-2 transition-all"
                    style={{ background: selected ? c.light : "var(--surface)", borderColor: selected ? c.primary : "var(--border)" }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ background: c.primary }} />
                    <span className="font-semibold text-sm flex-1 text-left" style={{ color: selected ? c.dark : "var(--text)" }}>{c.name}</span>
                    {selected && <Check size={14} color={c.primary} />}
                  </button>
                );
              })}
            </div>
          </div>
          {roleUsesSectors(inviteForm.role) && (
          <div>
            <FieldLabel>Setores</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {CANONICAL_SECTORS.map(s => {
                const selected = inviteForm.sectors.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleInviteSector(s)}
                    className="p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left"
                    style={{ background: selected ? "#EEF2FF" : "var(--surface)", borderColor: selected ? "#6366F1" : "var(--border)" }}
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
                      style={{ background: selected ? "#6366F1" : "transparent", borderColor: selected ? "#6366F1" : "var(--border-strong)" }}
                    >
                      {selected && <Check size={11} color="#FFFFFF" />}
                    </div>
                    <span className="text-xs font-semibold leading-tight" style={{ color: selected ? "#3730A3" : "var(--text)" }}>{s}</span>
                  </button>
                );
              })}
            </div>
          </div>
          )}
          {inviteForm.role === "vendedor" && (
            <div>
              <FieldLabel>Supervisor <span style={{ textTransform: "none", fontWeight: 400 }}>(opcional)</span></FieldLabel>
              <Select value={inviteForm.supervisorId || ""} onChange={e => setInviteForm(prev => ({ ...prev, supervisorId: e.target.value }))} options={vendedorOptions} />
              <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>
                Quem supervisiona também enxerga os negócios deste vendedor no Funil de Vendas.
              </div>
            </div>
          )}
          {roleUsesSupplier(inviteForm.role) && (
            <div>
              <FieldLabel>Fornecedor vinculado <span style={{ textTransform: "none", fontWeight: 400 }}>(opcional)</span></FieldLabel>
              <Select
                value={inviteForm.supplierId || ""}
                onChange={e => setInviteForm(prev => ({ ...prev, supplierId: e.target.value }))}
                options={[{ value: "", label: "Nenhum (sem restrição)" }, ...agencySuppliers.map(s => ({ value: s.id, label: s.name }))]}
              />
              <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>
                Restringe o acesso deste login às campanhas/entregas do fornecedor selecionado. Deixe em branco enquanto houver apenas uma agência cadastrada.
              </div>
            </div>
          )}
          {inviteError && (
            <div className="p-2 rounded-xl text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{inviteError}</div>
          )}
          {inviteJustSent && (
            <div className="p-2.5 rounded-xl text-xs flex items-start gap-2" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
              <Check size={14} className="shrink-0 mt-0.5" />
              <div>Convite registrado para <strong>{inviteJustSent}</strong>. Peça para criar a conta na tela de login.</div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          <Button variant="ghost" onClick={closeInvite} disabled={inviting}>Fechar</Button>
          <Button variant="primary" icon={inviting ? Loader2 : Send} onClick={submitInvite} disabled={inviting || !inviteForm.email.trim()}>
            {inviting ? "Enviando…" : "Enviar convite"}
          </Button>
        </div>
      </Modal>

      {/* ── Confirm dialog ── */}
      <Modal open={!!confirmDialog} onClose={() => setConfirmDialog(null)} title="Confirmar ação" width={400}>
        <div className="p-6">
          <p className="text-sm mb-6" style={{ color: "var(--text)", lineHeight: 1.6 }}>{confirmDialog?.message}</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={confirmDialog?.onConfirm}
              style={{ background: "var(--danger)" }}
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

function UserCardMenu({ editable, deletable, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const itemSt = { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", fontSize: 12, textAlign: "left" };
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Ações do usuário"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex", borderRadius: 6 }}
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-pop)", minWidth: 140, zIndex: 20, overflow: "hidden" }}>
            {editable && (
              <button onClick={() => { setOpen(false); onEdit(); }} style={{ ...itemSt, color: "var(--text)" }}>
                <Edit3 size={13} /> Editar
              </button>
            )}
            {deletable && (
              <button onClick={() => { setOpen(false); onDelete(); }} style={{ ...itemSt, color: "var(--danger)" }}>
                <Trash2 size={13} /> Excluir
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatStrip({ label, value, accent }) {
  return (
    <div className="py-3 px-4 text-center">
      <div className="text-[10px] uppercase font-bold tracking-wider mb-0.5" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div className="font-bold text-lg" style={{ color: accent || "var(--text)", letterSpacing: "-0.01em" }}>
        {value}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block" style={{ color: "var(--text-dim)", letterSpacing: "0.15em" }}>
      {children}
    </label>
  );
}

export default UserManagementView;
