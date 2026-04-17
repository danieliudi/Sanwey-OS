import React, { useCallback, useState } from "react";
import {
  UserPlus, User, Mail, Check, Save, Edit3, Trash2, Info, Loader2,
} from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { CompanyTag } from "../ui/CompanyTag";

const EMPTY_FORM = {
  id: null, name: "", email: "", role: "vendedor",
  companies: [], initials: "", avatarBg: "#1E4D8C",
};

const ROLE_OPTIONS_BASE = [
  { value: "vendedor", label: "Vendedor" },
  { value: "gerente", label: "Gerente" },
];

const ROLE_OPTIONS_ADMIN = [
  ...ROLE_OPTIONS_BASE,
  { value: "admin", label: "Admin" },
];

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "gerente") return "Gerente";
  return "Vendedor";
}

function roleBadgeVariant(role) {
  if (role === "admin") return "admin";
  if (role === "gerente") return "dark";
  return "default";
}

export function UserManagementView({
  users, currentUser,
  onUpdateUser, onDeleteUser, onUsersChange,
  supabaseEnabled = false, loading = false,
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

  const startNew = useCallback(() => {
    setEditing("new");
    setForm(EMPTY_FORM);
    setModalError(null);
  }, []);

  const startEdit = useCallback((u) => {
    setEditing(u.id);
    setForm({ ...EMPTY_FORM, ...u });
    setModalError(null);
  }, []);

  const closeModal = useCallback(() => {
    setEditing(null);
    setModalError(null);
  }, []);

  const save = useCallback(async () => {
    if (!form.name || form.companies.length === 0) return;
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
          });
        } else if (onUsersChange) {
          onUsersChange(prev => prev.map(u => u.id === form.id ? { ...u, ...form, initials } : u));
        }
      } else {
        // Local-only create (mock mode). Supabase creation happens via signup flow.
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

  const toggleCompany = useCallback((id) => {
    setForm(prev => ({
      ...prev,
      companies: prev.companies.includes(id)
        ? prev.companies.filter(c => c !== id)
        : [...prev.companies, id],
    }));
  }, []);

  const canSave = Boolean(form.name && form.companies.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Gestão de Usuários
          </h1>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            {users.length} usuários cadastrados · admin &gt; gerente &gt; vendedor
          </p>
        </div>
        {!supabaseEnabled && (
          <Button variant="primary" icon={UserPlus} onClick={startNew}>Novo usuário</Button>
        )}
      </div>

      {supabaseEnabled && (
        <div
          className="p-3 rounded-sm border flex items-start gap-2 text-xs"
          style={{ background: "#EEF5FC", borderColor: "#CFE2F3", color: "#264C7A" }}
        >
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>Como adicionar um novo vendedor:</strong> peça para ele se cadastrar na tela de login
            (botão "Criar conta"). Ele aparecerá aqui como <em>vendedor sem empresas</em>, e você atribui as empresas clicando em Editar.
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
                className="p-4 rounded-sm border flex items-center justify-between gap-4 flex-wrap"
                style={{ background: "#FFFFFF", borderColor: pending ? NEUTRAL.gold : "#EFEFEF" }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                    style={{ background: u.avatarBg }}
                  >
                    {u.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold" style={{ color: NEUTRAL.graphite }}>{u.name}</span>
                      <Badge variant={roleBadgeVariant(u.role)} size="sm">
                        {roleLabel(u.role)}
                      </Badge>
                      {u.id === currentUser?.id && (
                        <span
                          className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-widest rounded-sm"
                          style={{ background: NEUTRAL.gold + "20", color: "#8A6A00", letterSpacing: "0.15em" }}
                        >
                          Você
                        </span>
                      )}
                      {pending && (
                        <span
                          className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-widest rounded-sm"
                          style={{ background: "#FEF9E7", color: "#8A6A00", letterSpacing: "0.15em" }}
                        >
                          Aguardando liberação
                        </span>
                      )}
                    </div>
                    <div className="text-xs mb-1" style={{ color: NEUTRAL.slate }}>{u.email}</div>
                    <div className="flex flex-wrap gap-1">
                      {u.companies.length === 0 ? (
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
                    className="p-3 rounded-sm border flex items-center gap-2 transition-all"
                    style={{
                      background: selected ? c.light : "#FFFFFF",
                      borderColor: selected ? c.primary : "#EFEFEF",
                    }}
                  >
                    <div className="w-3 h-3 rounded-sm" style={{ background: c.primary }} />
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
          {modalError && (
            <div className="p-2 rounded-sm text-xs" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
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
    </div>
  );
}

export default UserManagementView;
