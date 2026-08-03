import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  RotateCcw, Check, AlertTriangle, AlertCircle, Trash2, Database, Sparkles, Camera, Loader2,
  Bot, Key, Zap, ExternalLink, CheckCircle2, User, Bell, Sliders, Globe, X, UserCog, Link2, Copy, Users, Palette,
  ShieldCheck, Image, Upload, PanelBottom, Menu as MenuIcon,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { AvatarCropModal } from "../shared/AvatarCropModal";
import { supabase } from "../../lib/supabase";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { RH_FRENTE_LABELS, RH_FRENTE_COLORS } from "../../constants/rh-frentes";
import { AI_PROVIDERS, AI_PROVIDER_MAP } from "../../constants/ai-providers";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import {
  EXECUTIVE_WIDGETS, NOTIFICATION_GROUPS,
} from "../../constants/user-settings";
import { Button } from "../ui/Button";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";
import { useChatStickers } from "../../hooks/use-chat-stickers";
import { callAI } from "../../hooks/use-ai";
import { friendlyAiErrorMessage } from "../../utils/ai-errors";
import { useBottomNavPrefs, BOTTOM_NAV_MAX_SHORTCUTS } from "../../hooks/use-bottom-nav-prefs";
import { getRoleTabs, flattenNavGroups } from "../shell/MobileBottomNav";

// Mesmo critério de quem cria canal no Chat (chat_is_manager, migration
// 20260812_chat_interno_fase1.sql) — replicado aqui (2ª ocorrência, também em
// ChatView.jsx) porque nenhuma das flags de gestor já calculadas em App.jsx
// (isManager/isMarketingManager/isRHManager/isComexManager) mapeia 1:1 pro
// conjunto de roles do chat_is_manager (isComexManager, por exemplo, inclui
// "comex" puro, que não é gestor pro Chat).
const CHAT_MANAGER_ROLES = ["admin", "gerente", "gerente_marketing", "gerente_rh", "diretoria"];
function isChatManagerUser(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  return roles.some(r => CHAT_MANAGER_ROLES.includes(r));
}

function Section({ title, description, children }) {
  return (
    <div
      className="p-5 rounded-xl border"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-4">
        <h2 className="font-semibold" style={{ fontSize: 15, color: "var(--text)" }}>
          {title}
        </h2>
        {description && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-dim)" }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// Achado da 2ª auditoria: os 4 botões de copiar link desta tela não davam
// nenhuma confirmação visual de sucesso (padrão já usado em CampaignCalendar,
// DeliverableDetailDrawer, LeadAIPanel, ComprasMarketingView).
function CopyLinkButton({ url, className, style }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={className}
      style={{
        ...style,
        ...(copied ? { background: "var(--success-bg)", color: "var(--success)", borderColor: "color-mix(in srgb, var(--success) 35%, transparent)" } : {}),
      }}
      title={url}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function ToggleRow({ checked, onChange, label, sublabel, disabled }) {
  return (
    <label
      className="flex items-center justify-between gap-3 py-2.5 cursor-pointer"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
        {sublabel && (
          <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{sublabel}</div>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4 cursor-pointer"
        style={{ accentColor: "var(--text)" }}
      />
    </label>
  );
}

const EXPORT_DOMAIN_LABEL = {
  leads_crm: "Leads (Funil de Vendas)",
  leads_dashboard: "Leads (Minhas Tarefas)",
  leads_explorer: "Leads (Explorador)",
  viagens_registros: "Viagens (registros)",
  viagens_despesas: "Viagens (despesas)",
};

// Trilha de exportações de CSV — proteção de dados estratégicos contra
// vazamento pra concorrente. Só admin vê (ver export_audit_log RLS);
// não bloqueia exportação nenhuma, só dá visibilidade de quem exportou
// o quê e quando.
function ExportAuditPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("export_audit_log")
      .select("*, profiles(name)")
      .order("exported_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { if (active) { setRows(data || []); setLoading(false); } });
    return () => { active = false; };
  }, []);

  return (
    <Section
      title="Exportações de dados"
      description="Últimas 100 exportações de CSV (leads, viagens) — quem, o quê, quantos registros e quando."
    >
      {loading ? (
        <div className="text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs" style={{ color: "var(--text-dim)" }}>Nenhuma exportação registrada ainda.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--text-dim)" }}>
                <th className="text-left font-semibold pb-2">Quem</th>
                <th className="text-left font-semibold pb-2">O quê</th>
                <th className="text-left font-semibold pb-2">Registros</th>
                <th className="text-left font-semibold pb-2">Quando</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="py-1.5" style={{ color: "var(--text)" }}>{r.profiles?.name || "—"}</td>
                  <td className="py-1.5" style={{ color: "var(--text)" }}>{EXPORT_DOMAIN_LABEL[r.domain] || r.domain}</td>
                  <td className="py-1.5" style={{ color: "var(--text-dim)" }}>{r.record_count}</td>
                  <td className="py-1.5" style={{ color: "var(--text-dim)" }}>{new Date(r.exported_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// Painel de gestão de figurinhas do Chat interno — pacote único/global (sem
// company_id, decisão do Daniel). `includeInactive: true` porque o gestor
// precisa ver o que já foi desativado sem reativar às cegas (mesma regra da
// policy de SELECT em chat_stickers).
function StickersPanel() {
  const { stickers, loading, error, uploadSticker, toggleStickerActive, deleteSticker, getPublicUrl } =
    useChatStickers({ includeInactive: true });
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      for (const file of files) {
        if (!["image/png", "image/webp"].includes(file.type)) {
          setUploadError("Só são aceitos arquivos PNG ou WEBP.");
          continue;
        }
        if (file.size > 2 * 1024 * 1024) {
          setUploadError("Cada figurinha pode ter no máximo 2 MB.");
          continue;
        }
        await uploadSticker(file);
      }
    } catch (e) {
      setUploadError(e.message || "Erro ao enviar figurinha.");
    } finally {
      setUploading(false);
    }
  }, [uploadSticker]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteSticker(confirmDelete.id);
      setConfirmDelete(null);
    } catch (e) {
      setUploadError(e.message || "Erro ao excluir figurinha.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Section
        title="Figurinhas do Chat"
        description="Pacote único, compartilhado por toda a plataforma — não é por empresa. Todo colaborador vê as ativas no composer do Chat."
      >
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-5 cursor-pointer transition-colors mb-4"
          style={{
            borderColor: dragOver ? "var(--accent)" : "var(--border-strong)",
            background: dragOver ? "var(--accent-tint)" : "var(--surface-alt)",
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          aria-label="Clique ou arraste imagens para adicionar figurinhas"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: dragOver ? "var(--accent-tint)" : "var(--surface-alt)" }}>
            <Upload size={16} style={{ color: dragOver ? "var(--accent)" : "var(--text-dim)" }} />
          </div>
          <div className="text-xs text-center" style={{ color: "var(--text-dim)" }}>
            {uploading ? (
              <span style={{ color: "var(--accent)" }}>Enviando…</span>
            ) : (
              <>
                <span className="font-semibold" style={{ color: "var(--text)" }}>Clique ou arraste</span>{" "}
                para adicionar uma figurinha
                <div className="mt-0.5">Recomendado: quadrado, fundo transparente, até 512×512 · PNG ou WEBP, máx 2 MB</div>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/png,image/webp"
            className="hidden"
            onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ""; } }}
          />
        </div>

        {uploadError && (
          <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg mb-3" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            {uploadError}
          </div>
        )}

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg mb-3" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</div>
        ) : stickers.length === 0 ? (
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>Nenhuma figurinha cadastrada ainda.</div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {stickers.map(s => (
              <div
                key={s.id}
                className="rounded-xl border p-3 flex flex-col gap-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={getPublicUrl(s.image_path)}
                    alt={s.name}
                    className="shrink-0"
                    style={{ width: 44, height: 44, objectFit: "contain", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>{s.name}</div>
                    <div className="text-xs" style={{ color: s.active ? "var(--success)" : "var(--text-faint)" }}>
                      {s.active ? "Ativa" : "Inativa"}
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmDelete(s)}
                    title="Excluir figurinha"
                    aria-label="Excluir figurinha"
                    className="p-1.5 rounded-lg transition-colors shrink-0"
                    style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <ToggleRow
                  label="Ativa no picker do Chat"
                  checked={s.active}
                  onChange={() => toggleStickerActive(s.id, !s.active)}
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Modal open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Excluir figurinha?" width={400}>
        <div className="p-6">
          <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
            "{confirmDelete?.name}" será removida definitivamente — some do picker de todo mundo e o arquivo é apagado do armazenamento. Essa ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 rounded-lg text-sm font-semibold border"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--danger)", color: "var(--on-danger)", opacity: deleting ? 0.6 : 1 }}
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// Escolha de até 4 atalhos da barra inferior mobile — localStorage por
// usuário (docs/design-spec-atalhos-barra-inferior.md), sem tabela nova.
// Sem seleção salva = comportamento atual (`getRoleTabs`), ninguém é afetado
// até customizar. Limite de 4: opção não marcada fica desabilitada quando o
// limite já foi atingido (mais simples de implementar sem risco de reordenar
// a seleção do usuário à sua revelia).
function BottomNavPrefsPanel({ currentUser, roles, navGroups }) {
  const { selectedIds, setSelectedIds } = useBottomNavPrefs(currentUser?.id);
  const items = useMemo(() => Array.from(flattenNavGroups(navGroups).values()), [navGroups]);
  const defaultIds = useMemo(() => getRoleTabs(roles, navGroups).map(t => t.id), [roles, navGroups]);
  const [draft, setDraft] = useState(() => (selectedIds && selectedIds.length ? selectedIds : defaultIds));
  const [saved, setSaved] = useState(false);

  const toggle = (id) => {
    setSaved(false);
    setDraft(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= BOTTOM_NAV_MAX_SHORTCUTS) return prev;
      return [...prev, id];
    });
  };

  const previewItems = draft.map(id => items.find(i => i.id === id)).filter(Boolean);

  return (
    <Section
      title="Barra inferior (mobile)"
      description="Escolha até 4 atalhos fixos na barra de navegação do celular. 'Menu' continua sempre disponível como 5º item, com o restante das telas liberadas pro seu cargo."
    >
      <div className="rounded-xl border mb-4 overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="flex" style={{ background: "var(--surface-alt)" }}>
          {previewItems.map(({ id, label, icon: Icon }) => (
            <div key={id} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-w-0">
              <Icon size={20} strokeWidth={2.3} style={{ color: "var(--accent)" }} />
              <span className="truncate" style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", maxWidth: "100%" }}>{label}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, BOTTOM_NAV_MAX_SHORTCUTS - previewItems.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5">
              <div style={{ width: 20, height: 20, borderRadius: 6, border: "1.5px dashed var(--border-strong)" }} />
            </div>
          ))}
          <div className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5">
            <MenuIcon size={20} style={{ color: "var(--text-dim)" }} />
            <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-dim)" }}>Menu</span>
          </div>
        </div>
      </div>

      <div className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>
        {draft.length}/{BOTTOM_NAV_MAX_SHORTCUTS} selecionados
      </div>

      <div className="mb-4" style={{ maxHeight: 320, overflowY: "auto" }}>
        {items.map(({ id, label, icon: Icon }) => {
          const checked = draft.includes(id);
          const limitReached = !checked && draft.length >= BOTTOM_NAV_MAX_SHORTCUTS;
          return (
            <label
              key={id}
              className="flex items-center justify-between gap-3 py-2 px-1 rounded-lg"
              style={{ opacity: limitReached ? 0.45 : 1, cursor: limitReached ? "not-allowed" : "pointer" }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon size={16} style={{ color: "var(--text-dim)" }} />
                <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{label}</span>
              </div>
              <input
                type="checkbox"
                checked={checked}
                disabled={limitReached}
                onChange={() => toggle(id)}
                className="w-4 h-4 shrink-0"
                style={{ accentColor: "var(--accent)", cursor: limitReached ? "not-allowed" : "pointer" }}
              />
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => { setSelectedIds(draft); setSaved(true); }}>
          Salvar
        </Button>
        {saved && (
          <span className="text-xs flex items-center gap-1" style={{ color: "var(--success)" }}>
            <Check size={13} /> Salvo
          </span>
        )}
      </div>
    </Section>
  );
}

const ROLE_LABEL = {
  admin:             "Administrador",
  gerente:           "Gerente Comercial",
  vendedor:          "Vendedor",
  consultor:         "Consultor",
  marketing:         "Marketing",
  gerente_marketing: "Gerente de Marketing",
  agencia:           "Agência",
  rh:                "RH",
  gerente_rh:        "Gerente de RH",
};

// "Vermelho" (vermelho da marca, Manual v4.0) é o preset 0 — vira o default
// de fato desde que virou o token --accent padrão em index.css (03/08/2026).
// "Carvão" continua disponível pra quem preferir neutro, só deixou de ser o
// primeiro da lista.
const ACCENT_PRESETS = [
  { label: "Vermelho",  value: "#CC2936", hover: "#8B0000" },
  { label: "Carvão",    value: "#37352F", hover: "#2A2925" },
  { label: "Verde",     value: "#16A34A", hover: "#15803D" },
  { label: "Azul",      value: "#1D4ED8", hover: "#1E3A8A" },
  { label: "Roxo",      value: "#7C3AED", hover: "#6D28D9" },
  { label: "Laranja",   value: "#EA7309", hover: "#C25F00" },
  { label: "Rosa",      value: "#DB2777", hover: "#BE185D" },
];

// Antes só aplicava no claro (`if (!isDark)`) — mesmo bug do TopBar.jsx: um
// acento customizado sumia ao entrar no escuro, revertendo pro default do
// CSS. Aplicar sempre faz a escolha persistir nos dois temas.
function applyAccentGlobal(accent, hover) {
  localStorage.setItem("sanwey-accent", accent);
  localStorage.setItem("sanwey-accent-hover", hover);
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-hover", hover);
}

// Personal tabs available to every authenticated user.
const PERSONAL_TABS = [
  { id: "perfil",        label: "Perfil",          icon: User    },
  { id: "notificacoes", label: "Notificações",     icon: Bell    },
  { id: "ia",            label: "Integrações IA",  icon: Bot     },
  { id: "aparencia",     label: "Aparência",       icon: Palette },
];

// Escolha da barra inferior mobile é relevante pra todo cargo (a barra
// aparece pra qualquer um em telas <lg, gerente incluso) — empurrada
// explicitamente nos dois ramos de `tabs` abaixo, mesmo padrão já usado
// pra "Figurinhas" (isChatManager), em vez de depender do spread de
// PERSONAL_TABS (que hoje já não repassa "Aparência" pro ramo gerente).
const ATALHOS_TAB = { id: "atalhos", label: "Barra inferior", icon: PanelBottom };

// Manager-only tabs added on top of the personal ones.
const MANAGER_TABS = [
  { id: "preferencias", label: "Preferências",     icon: Sliders  },
  { id: "captura",       label: "Captura pública", icon: Link2    },
  { id: "dados",         label: "Dados",           icon: Database },
];

export function SettingsView({
  settings, onUpdate, onReset, onClearLocalData, currentUser,
  leadsCount = 0, onLoadDemoLeads, onClearAllLeads,
  onLoadAllDemoData, demoDataLoading = false, demoDataCounts = null,
  onUpdateUser, onUpdateAuthUser, onUpdateMockUser, supabaseEnabled,
  usersPanel, isManager = false, isMarketingManager = false, isRHManager = false, isComexManager = false, isAdmin = false,
  roles, navGroups,
}) {
  // Painel Executivo não é mais exclusivo do gerente Comercial — gerente de
  // Marketing/RH/Comex também acessa a aba Preferências, só que só enxerga
  // (e só mexe n)o próprio recorte de widgets do Painel Executivo lá dentro.
  const canSeeExecutive = isManager || isMarketingManager || isRHManager || isComexManager;
  const isChatManager = isChatManagerUser(currentUser);
  const [activeTab, setActiveTab] = useState("perfil");
  const tabs = useMemo(() => {
    if (!isManager && !canSeeExecutive) {
      const base = isChatManager ? [...PERSONAL_TABS, { id: "figurinhas", label: "Figurinhas", icon: Image }] : PERSONAL_TABS;
      return [...base, ATALHOS_TAB];
    }
    // Manager order: Perfil, Preferências, Notificações, IA, Captura, Dados, Figurinhas, Barra inferior, Usuários
    const list = [PERSONAL_TABS[0]];
    list.push(MANAGER_TABS[0]);
    list.push(PERSONAL_TABS[1], PERSONAL_TABS[2]);
    if (isManager) list.push(MANAGER_TABS[1], MANAGER_TABS[2]);
    if (isChatManager) list.push({ id: "figurinhas", label: "Figurinhas", icon: Image });
    list.push(ATALHOS_TAB);
    if (isAdmin) list.push({ id: "seguranca", label: "Segurança", icon: ShieldCheck });
    return usersPanel ? [...list, { id: "usuarios", label: "Usuários", icon: UserCog }] : list;
  }, [isManager, canSeeExecutive, usersPanel, isAdmin, isChatManager]);

  // ── Vagas públicas (Recrutamento) ─────────────────────────────────────
  // rh_vagas vem cru (snake_case) de useRHRecrutamento — sem mapper camelCase.
  const { vagas } = useRHRecrutamento({ userId: currentUser?.id });
  const vagasPublicadas = useMemo(
    () => vagas.filter(v => v.stage === "publicada" && v.link_slug),
    [vagas]
  );

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearTyped, setClearTyped] = useState("");

  // ── Appearance / theme colors ────────────────────────────────────────
  const [accentColor, setAccentColor] = useState(
    () => localStorage.getItem("sanwey-accent") || "#CC2936"
  );
  const [hoverColor, setHoverColor] = useState(
    () => localStorage.getItem("sanwey-accent-hover") || "#8B0000"
  );

  const handleAccentPreset = (preset) => {
    setAccentColor(preset.value);
    setHoverColor(preset.hover);
    applyAccentGlobal(preset.value, preset.hover);
  };

  const handleAccentInput = (color) => {
    setAccentColor(color);
    applyAccentGlobal(color, hoverColor);
  };

  const handleHoverInput = (color) => {
    setHoverColor(color);
    applyAccentGlobal(accentColor, color);
  };

  const handleResetAccent = () => {
    const def = ACCENT_PRESETS[0];
    setAccentColor(def.value);
    setHoverColor(def.hover);
    localStorage.removeItem("sanwey-accent");
    localStorage.removeItem("sanwey-accent-hover");
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-hover");
  };

  // ── Profile form ────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    avatarUrl: currentUser?.avatarUrl || null,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState(null);
  const [croppingSrc, setCroppingSrc] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      setProfileForm(f => ({
        ...f,
        name: currentUser.name || "",
        email: currentUser.email || "",
        avatarUrl: currentUser.avatarUrl || null,
      }));
    }
  }, [currentUser?.id]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setProfileFeedback({ type: "error", msg: "Imagem muito grande. Máximo 2 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setCroppingSrc(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleProfileSave = async () => {
    if (!profileForm.name.trim()) {
      setProfileFeedback({ type: "error", msg: "Nome não pode ficar em branco." });
      return;
    }
    setProfileSaving(true);
    setProfileFeedback(null);
    try {
      const profilePatch = {
        name: profileForm.name.trim(),
        initials: profileForm.name.trim().slice(0, 2).toUpperCase(),
        avatarUrl: profileForm.avatarUrl || null,
      };
      if (onUpdateUser && currentUser?.id) {
        await onUpdateUser(currentUser.id, profilePatch);
      } else if (onUpdateMockUser) {
        onUpdateMockUser(u => ({ ...u, ...profilePatch }));
      }
      if (profileForm.email && profileForm.email !== currentUser?.email) {
        if (onUpdateAuthUser) {
          await onUpdateAuthUser({ email: profileForm.email });
        } else if (onUpdateMockUser) {
          onUpdateMockUser(u => ({ ...u, email: profileForm.email }));
        }
      }
      setProfileFeedback({ type: "success", msg: "Perfil atualizado com sucesso." });
    } catch (err) {
      setProfileFeedback({ type: "error", msg: err.message || "Erro ao salvar perfil." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    setPasswordFeedback(null);
    if (passwordForm.newPassword.length < 6) {
      setPasswordFeedback({ type: "error", msg: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ type: "error", msg: "As senhas não coincidem." });
      return;
    }
    setPasswordSaving(true);
    try {
      if (onUpdateAuthUser) {
        await onUpdateAuthUser({ password: passwordForm.newPassword });
        setPasswordFeedback({ type: "success", msg: "Senha alterada com sucesso." });
        setPasswordForm({ newPassword: "", confirmPassword: "" });
      } else {
        setPasswordFeedback({ type: "error", msg: "Troca de senha requer Supabase configurado." });
      }
    } catch (err) {
      setPasswordFeedback({ type: "error", msg: err.message || "Erro ao alterar senha." });
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── AI integration state ─────────────────────────────────────────────
  const [aiForm, setAiForm] = useState({
    provider: currentUser?.aiConfig?.provider || '',
    model: currentUser?.aiConfig?.model || '',
    apiKey: currentUser?.aiConfig?.apiKey || '',
  });
  const [aiKeyVisible, setAiKeyVisible] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null); // null | 'ok' | 'error'
  const [aiTestMsg, setAiTestMsg] = useState('');
  const [aiTesting, setAiTesting] = useState(false);

  // ── IA da empresa (org-wide) ──────────────────────────────────────────
  // Só um card de status (configurado/não) — a chave em si é um secret do
  // projeto Supabase (AI_ORG_PROVIDER/AI_ORG_MODEL/AI_ORG_API_KEY), nunca
  // editável por aqui, mesmo padrão do D4Sign abaixo.
  const [orgAiStatus, setOrgAiStatus] = useState(null); // null=carregando | { configured, provider } | { error }
  useEffect(() => {
    if (activeTab !== "ia" || !isAdmin) return;
    let cancelled = false;
    supabase.functions.invoke("ai-assistant", { body: { action: "status" } }).then(({ data, error }) => {
      if (cancelled) return;
      setOrgAiStatus(error ? { error: error.message } : (data?.error ? { error: data.error } : data));
    });
    return () => { cancelled = true; };
  }, [activeTab, isAdmin]);

  // ── D4Sign status (assinatura eletrônica) ────────────────────────────
  const [d4signStatus, setD4signStatus] = useState(null); // null=carregando | { configured, webhookConfigured, sandbox } | { error }
  // D4Sign é usado pelo RH pra enviar documento pra assinatura — checagem
  // de status só valia pro gestor Comercial antes disso (achado da
  // auditoria de fricção de 18/07: quem realmente usa não conseguia ver).
  const canSeeD4Sign = isManager || isRHManager;
  useEffect(() => {
    if (activeTab !== "ia" || !canSeeD4Sign) return;
    let cancelled = false;
    supabase.functions.invoke("d4sign-status", { body: {} }).then(({ data, error }) => {
      if (cancelled) return;
      setD4signStatus(error ? { error: error.message } : (data?.error ? { error: data.error } : data));
    });
    return () => { cancelled = true; };
  }, [activeTab, canSeeD4Sign]);

  useEffect(() => {
    if (currentUser?.aiConfig) {
      setAiForm({
        provider: currentUser.aiConfig.provider || '',
        model: currentUser.aiConfig.model || '',
        apiKey: currentUser.aiConfig.apiKey || '',
      });
    }
  }, [currentUser?.id]);

  const selectedProvider = AI_PROVIDER_MAP[aiForm.provider];

  // Troca de provedor limpa a chave também — uma chave da OpenAI (sk-...)
  // deixada no campo ao trocar pra Anthropic/Gemini só ia falhar depois,
  // com um erro sem relação óbvia com a causa real (achado da auditoria de
  // fricção de 18/07).
  const handleAiProviderChange = (providerId) => {
    const p = AI_PROVIDER_MAP[providerId];
    setAiForm(f => ({ ...f, provider: providerId, model: p?.models[0]?.id || '', apiKey: '' }));
    setAiTestResult(null);
  };

  const [aiSaveFeedback, setAiSaveFeedback] = useState(null);

  const handleAiSave = async () => {
    if (!aiForm.provider || !aiForm.model || !aiForm.apiKey.trim()) return;
    setAiSaving(true);
    setAiSaveFeedback(null);
    try {
      const config = { provider: aiForm.provider, model: aiForm.model, apiKey: aiForm.apiKey.trim() };
      if (onUpdateUser && currentUser?.id) await onUpdateUser(currentUser.id, { aiConfig: config });
      if (onUpdateMockUser) onUpdateMockUser(u => ({ ...u, aiConfig: config }));
      setAiSaveFeedback({ type: "success", msg: "Configuração salva com sucesso." });
    } catch (err) {
      setAiSaveFeedback({ type: "error", msg: err.message || "Erro ao salvar configuração." });
    } finally {
      setAiSaving(false);
    }
  };

  const handleAiTest = async () => {
    if (!aiForm.provider || !aiForm.model || !aiForm.apiKey.trim()) return;
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const config = { provider: aiForm.provider, model: aiForm.model, apiKey: aiForm.apiKey.trim() };
      const messages = [
        { role: 'user', content: 'Responda apenas: "Conexão OK"' }
      ];
      // callAI passa pela edge function ai-assistant sempre que o Supabase
      // está configurado (chave nunca sai do browser), independente do
      // provedor — só cai pro fetch direto (OpenAI/Gemini) em modo local/
      // demo sem Supabase.
      const text = await callAI(config.provider, config.model, config.apiKey, messages, 20);
      setAiTestResult('ok');
      setAiTestMsg(text.trim().slice(0, 80));
    } catch (e) {
      setAiTestResult('error');
      setAiTestMsg(e.message);
    } finally {
      setAiTesting(false);
    }
  };

  const handleAiDisconnect = async () => {
    setAiForm({ provider: '', model: '', apiKey: '' });
    setAiTestResult(null);
    if (onUpdateUser && currentUser?.id) await onUpdateUser(currentUser.id, { aiConfig: null });
    if (onUpdateMockUser) onUpdateMockUser(u => ({ ...u, aiConfig: null }));
  };

  // ── General settings callbacks ───────────────────────────────────────
  const toggleCompany = useCallback((id) => {
    const has = settings.enabledCompanies.includes(id);
    const next = has
      ? settings.enabledCompanies.filter(c => c !== id)
      : [...settings.enabledCompanies, id];
    if (next.length === 0) return;
    onUpdate({ enabledCompanies: next });
  }, [settings.enabledCompanies, onUpdate]);

  const toggleExecutiveWidget = useCallback((id) => {
    const has = settings.visibleExecutiveWidgets.includes(id);
    onUpdate({
      visibleExecutiveWidgets: has
        ? settings.visibleExecutiveWidgets.filter(w => w !== id)
        : [...settings.visibleExecutiveWidgets, id],
    });
  }, [settings.visibleExecutiveWidgets, onUpdate]);

  const toggleStage = useCallback((id) => {
    const has = settings.visibleKanbanStages.includes(id);
    const next = has
      ? settings.visibleKanbanStages.filter(s => s !== id)
      : [...settings.visibleKanbanStages, id];
    if (next.length === 0) return;
    onUpdate({ visibleKanbanStages: next });
  }, [settings.visibleKanbanStages, onUpdate]);

  const toggleNotification = useCallback((id) => {
    onUpdate({
      notifications: {
        ...settings.notifications,
        [id]: !settings.notifications[id],
      },
    });
  }, [settings.notifications, onUpdate]);

  // "Restaurar padrão" apagava empresas/widgets/notificações com um clique
  // e zero confirmação — ao lado de "Limpar dados locais" e "Limpar todos os
  // leads", que exigem confirmação (a segunda até digitar uma palavra). A
  // fricção antes de uma ação destrutiva deveria refletir o tamanho do
  // estrago, não a tela em que o botão está. Achado da auditoria de 18/07.
  const handleResetSettings = useCallback(() => {
    if (window.confirm("Isso vai restaurar todas as preferências (empresas ativas, widgets, notificações) para o padrão. Continuar?")) {
      onReset();
    }
  }, [onReset]);

  const handleClearLocal = useCallback(() => {
    if (window.confirm("Isso vai apagar leads, configurações e sessão local. Continuar?")) {
      onClearLocalData();
    }
  }, [onClearLocalData]);

  const handleLoadDemo = useCallback(() => {
    const proceed = leadsCount === 0
      ? true
      : window.confirm("Isso vai substituir os leads atuais pelo conjunto de demonstração. Continuar?");
    if (proceed) onLoadDemoLeads?.();
  }, [leadsCount, onLoadDemoLeads]);

  const handleClearLeads = useCallback(() => {
    if (leadsCount === 0) return;
    setClearTyped("");
    setClearConfirmOpen(true);
  }, [leadsCount]);

  const handleClearConfirm = useCallback(() => {
    onClearAllLeads?.();
    setClearConfirmOpen(false);
    setClearTyped("");
  }, [onClearAllLeads]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Configurações
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            {isManager
              ? "Gerencie seu perfil, preferências e integrações"
              : "Atualize seus dados, notificações e integrações pessoais"}
          </p>
        </div>
        {isManager && (
          <Button variant="ghost" icon={RotateCcw} onClick={handleResetSettings}>
            Restaurar padrão
          </Button>
        )}
      </div>

      {/* Tab layout */}
      <div className="lg:flex lg:gap-6 lg:items-start">

        {/* Sidebar nav — lg only */}
        <nav className="hidden lg:flex flex-col gap-0.5 shrink-0" style={{ width: 200 }}>
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left w-full"
                style={{
                  background: active ? "var(--accent-tint)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-dim)",
                  boxShadow: active ? "inset 3px 0 0 var(--accent)" : "inset 3px 0 0 transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = "var(--surface-alt)";
                    e.currentTarget.style.color = "var(--text)";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-dim)";
                  }
                }}
              >
                <Icon size={15} strokeWidth={2} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Stack on mobile */}
        <div className="flex-1 min-w-0">

          {/* Mobile horizontal tabs — lg:hidden */}
          <div className="lg:hidden flex gap-1.5 overflow-x-auto mb-4" style={{ scrollbarWidth: "none" }}>
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold shrink-0 transition-all"
                  style={{
                    background: active ? "var(--accent)" : "#F1EDE8",
                    color: active ? "#FFFFFF" : "var(--text-dim)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="space-y-4">

            {/* ── PERFIL ── */}
            {activeTab === "perfil" && (
              <div className="space-y-4">
                <Section title="Meu perfil">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="relative shrink-0">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden font-bold text-white"
                        style={{
                          fontSize: 22,
                          background: profileForm.avatarUrl ? "transparent" : (currentUser?.avatarBg || "var(--accent)"),
                        }}
                      >
                        {profileForm.avatarUrl
                          ? <img src={profileForm.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                          : (currentUser?.initials || "?")}
                      </div>
                      <button
                        onClick={() => fileRef.current?.click()}
                        title="Alterar foto"
                        className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: "var(--color-industria)", color: "#FFF", border: "2px solid #FFF", cursor: "pointer" }}
                      >
                        <Camera size={13} />
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>{currentUser?.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{currentUser?.email}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                        {(Array.isArray(currentUser?.roles) && currentUser.roles.length ? currentUser.roles : [currentUser?.role])
                          .filter(Boolean)
                          .map(r => ROLE_LABEL[r] || r)
                          .join(" · ")}
                      </div>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Nome
                      </label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--text)", outline: "none", background: "var(--surface)" }}
                        onFocus={e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--text)", outline: "none", background: "var(--surface)" }}
                        onFocus={e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      />
                      {!supabaseEnabled && (
                        <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>Modo offline — email salvo localmente.</p>
                      )}
                    </div>
                  </div>

                  {profileFeedback && (
                    <div
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3"
                      style={{
                        background: profileFeedback.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
                        color: profileFeedback.type === "success" ? "var(--success)" : "var(--danger)",
                        border: `1px solid ${profileFeedback.type === "success" ? "color-mix(in srgb, var(--success) 35%, transparent)" : "color-mix(in srgb, var(--danger) 35%, transparent)"}`,
                      }}
                    >
                      {profileFeedback.type === "success" ? <Check size={13} /> : <AlertTriangle size={13} />}
                      {profileFeedback.msg}
                    </div>
                  )}

                  <button
                    onClick={handleProfileSave}
                    disabled={profileSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                    style={{ background: "var(--color-industria)", opacity: profileSaving ? 0.7 : 1, cursor: profileSaving ? "not-allowed" : "pointer" }}
                  >
                    {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Salvar alterações
                  </button>
                </Section>

                <Section title="Alterar senha" description="Disponível apenas com autenticação ativa.">
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Nova senha
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.newPassword}
                        onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--text)", outline: "none", background: "var(--surface)" }}
                        onFocus={e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Confirmar nova senha
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.confirmPassword}
                        onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                        placeholder="Repita a nova senha"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--text)", outline: "none", background: "var(--surface)" }}
                        onFocus={e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                  </div>

                  {passwordFeedback && (
                    <div
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3"
                      style={{
                        background: passwordFeedback.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
                        color: passwordFeedback.type === "success" ? "var(--success)" : "var(--danger)",
                        border: `1px solid ${passwordFeedback.type === "success" ? "color-mix(in srgb, var(--success) 35%, transparent)" : "color-mix(in srgb, var(--danger) 35%, transparent)"}`,
                      }}
                    >
                      {passwordFeedback.type === "success" ? <Check size={13} /> : <AlertTriangle size={13} />}
                      {passwordFeedback.msg}
                    </div>
                  )}

                  <button
                    onClick={handlePasswordSave}
                    disabled={passwordSaving || !passwordForm.newPassword}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all"
                    style={{
                      background: "var(--surface)",
                      color: "var(--text)",
                      borderColor: "var(--border)",
                      opacity: (passwordSaving || !passwordForm.newPassword) ? 0.5 : 1,
                      cursor: (passwordSaving || !passwordForm.newPassword) ? "not-allowed" : "pointer",
                    }}
                  >
                    {passwordSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                    Alterar senha
                  </button>
                </Section>
              </div>
            )}

            {/* ── PREFERÊNCIAS ── */}
            {activeTab === "preferencias" && (
              <div className="space-y-4">
                {isManager && (
                <Section
                  title="Empresas ativas"
                  description="Quais empresas aparecem no seletor do topo e nos filtros do app."
                >
                  <div className="grid grid-cols-2 gap-2">
                    {COMPANY_IDS.map(id => {
                      const c = COMPANIES[id];
                      const enabled = settings.enabledCompanies.includes(id);
                      // Última empresa ativa não pode ser desligada (precisa sobrar
                      // pelo menos uma) — antes o clique simplesmente não fazia nada,
                      // sem nenhum sinal de por quê. Achado da auditoria de fricção.
                      const isLastEnabled = enabled && settings.enabledCompanies.length === 1;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleCompany(id)}
                          disabled={isLastEnabled}
                          title={isLastEnabled ? "Pelo menos uma empresa precisa ficar ativa" : undefined}
                          className="p-3 rounded-lg border flex items-center gap-2.5 transition-all duration-150 text-left"
                          style={{
                            background: enabled ? c.light : "var(--surface)",
                            borderColor: enabled ? c.primary + "80" : "var(--border)",
                            boxShadow: enabled ? `0 0 0 1px ${c.primary}40` : "none",
                            cursor: isLastEnabled ? "not-allowed" : "pointer",
                            opacity: isLastEnabled ? 0.7 : 1,
                          }}
                          onMouseEnter={e => {
                            if (!enabled) {
                              e.currentTarget.style.borderColor = "#D0D0D0";
                              e.currentTarget.style.background = "#F5F5F3";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!enabled) {
                              e.currentTarget.style.borderColor = "var(--border)";
                              e.currentTarget.style.background = "var(--surface)";
                            }
                          }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.primary }} />
                          <span
                            className="font-medium text-sm flex-1 leading-tight"
                            style={{ color: enabled ? c.dark : "var(--text)" }}
                          >
                            {c.name}
                          </span>
                          {enabled && <Check size={13} color={c.primary} />}
                        </button>
                      );
                    })}
                  </div>
                </Section>
                )}

                {canSeeExecutive && (
                  <Section
                    title="Widgets do Painel Executivo"
                    description="Cada gerente de departamento só vê (e só escolhe) o próprio recorte do Painel Executivo."
                  >
                    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {EXECUTIVE_WIDGETS
                        .filter(w =>
                          (w.dept === "comercial" && isManager) ||
                          (w.dept === "marketing" && isMarketingManager) ||
                          (w.dept === "rh" && isRHManager) ||
                          (w.dept === "comex" && isComexManager))
                        .map(w => (
                          <ToggleRow
                            key={w.id}
                            label={w.label}
                            checked={settings.visibleExecutiveWidgets.includes(w.id)}
                            onChange={() => toggleExecutiveWidget(w.id)}
                          />
                        ))}
                    </div>
                  </Section>
                )}

                {isManager && (
                <Section
                  title="Etapas visíveis no Kanban"
                  description="Esconda etapas que você não usa no dia a dia."
                >
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {DEFAULT_PIPELINE_STAGES.map(s => {
                      const checked = settings.visibleKanbanStages.includes(s.id);
                      // Última etapa visível não pode ser escondida — antes o
                      // clique simplesmente não fazia nada. Achado da auditoria
                      // de fricção de 18/07.
                      const isLastVisible = checked && settings.visibleKanbanStages.length === 1;
                      return (
                        <ToggleRow
                          key={s.id}
                          label={s.name}
                          sublabel={isLastVisible ? "Pelo menos uma etapa precisa ficar visível" : undefined}
                          checked={checked}
                          disabled={isLastVisible}
                          onChange={() => toggleStage(s.id)}
                        />
                      );
                    })}
                  </div>
                </Section>
                )}
              </div>
            )}

            {/* ── NOTIFICAÇÕES ── */}
            {activeTab === "notificacoes" && (
              <Section
                title="Notificações"
                description="Alertas visuais dentro do app, filtrados pelo seu papel."
              >
                <div className="space-y-4">
                  <div>
                    <div
                      className="pb-2 mb-1 border-b"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span
                        className="font-bold tracking-wide"
                        style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}
                      >
                        Menções
                      </span>
                    </div>
                    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                      <ToggleRow
                        label="Notificar quando alguém me mencionar (@)"
                        sublabel="Ativado por padrão. Desative se não quiser receber notificação de @menção em comentários."
                        checked={currentUser?.mentionNotificationsEnabled !== false}
                        onChange={() => {
                          if (onUpdateUser && currentUser?.id) {
                            onUpdateUser(currentUser.id, { mentionNotificationsEnabled: !(currentUser?.mentionNotificationsEnabled !== false) });
                          }
                        }}
                      />
                    </div>
                  </div>
                  {NOTIFICATION_GROUPS
                    .filter(group => {
                      const userRoles = Array.isArray(currentUser?.roles) && currentUser.roles.length
                        ? currentUser.roles
                        : (currentUser?.role ? [currentUser.role] : []);
                      return !userRoles.length || group.roles.some(r => userRoles.includes(r));
                    })
                    .map(group => (
                      <div key={group.id}>
                        <div
                          className="pb-2 mb-1 border-b flex items-center justify-between"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <span
                            className="font-bold tracking-wide"
                            style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}
                          >
                            {group.label}
                          </span>
                          {(() => {
                            const allOn = group.items.every(n => Boolean(settings.notifications[n.id]));
                            return (
                              <button
                                onClick={() => {
                                  const update = {};
                                  group.items.forEach(n => { update[n.id] = !allOn; });
                                  onUpdate({ notifications: { ...settings.notifications, ...update } });
                                }}
                                className="text-[10px] font-semibold"
                                style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                              >
                                {allOn ? "Desativar todos" : "Ativar todos"}
                              </button>
                            );
                          })()}
                        </div>
                        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                          {group.items.map(n => (
                            <ToggleRow
                              key={n.id}
                              label={n.label}
                              checked={Boolean(settings.notifications[n.id])}
                              onChange={() => toggleNotification(n.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </Section>
            )}

            {/* ── IA ── */}
            {activeTab === "ia" && (
              <div className="space-y-4">
              {isAdmin && (
                <Section
                  title="IA da empresa (org-wide)"
                  description="Chave configurada uma vez pelo admin, usada como fallback pra quem não tem chave pessoal — assim vendedor/marketing/RH não precisam criar conta em provedor de IA nenhum pra usar os recursos."
                >
                  {orgAiStatus === null ? (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
                      <Loader2 size={13} className="animate-spin" /> Checando status…
                    </div>
                  ) : orgAiStatus.error ? (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                      <AlertCircle size={13} />
                      <span>Não foi possível checar o status: {orgAiStatus.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div
                        className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                        style={orgAiStatus.configured
                          ? { background: "var(--success-bg)", color: "var(--success)" }
                          : { background: "var(--danger-bg)", color: "var(--danger)" }}
                      >
                        {orgAiStatus.configured ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                        <span className="font-semibold">
                          {orgAiStatus.configured ? `Configurado (${orgAiStatus.provider})` : "Não configurado"}
                        </span>
                      </div>
                      {!orgAiStatus.configured && (
                        <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                          Faltam os secrets AI_ORG_PROVIDER, AI_ORG_MODEL e AI_ORG_API_KEY no projeto Supabase. Enquanto não configurado, cada usuário continua precisando da própria chave pessoal (abaixo) pra usar os recursos de IA.
                        </p>
                      )}
                    </div>
                  )}
                </Section>
              )}
              <Section title="Integrações de IA" description="Configure sua LLM para usar os recursos de IA do CRM (opcional — sua chave pessoal tem prioridade sobre a chave da empresa, se houver).">
                <div className="space-y-5">
                  {/* Status badge */}
                  {currentUser?.aiConfig?.provider && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                      <CheckCircle2 size={13} />
                      <span className="font-semibold">
                        {AI_PROVIDER_MAP[currentUser.aiConfig.provider]?.name} — {currentUser.aiConfig.model} conectado
                      </span>
                      <button
                        onClick={handleAiDisconnect}
                        className="ml-auto text-xs underline"
                        style={{ color: "var(--success)", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Desconectar
                      </button>
                    </div>
                  )}

                  {/* Provider picker */}
                  <div>
                    <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text-dim)" }}>
                      Provedor de IA
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {AI_PROVIDERS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleAiProviderChange(p.id)}
                          className="py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all"
                          style={{
                            background: aiForm.provider === p.id ? NEUTRAL.red + "0F" : "var(--surface)",
                            borderColor: aiForm.provider === p.id ? "var(--color-industria)" : "var(--border)",
                            color: aiForm.provider === p.id ? "var(--color-industria)" : "var(--text)",
                            cursor: "pointer",
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Model picker */}
                  {selectedProvider && (
                    <div>
                      <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text-dim)" }}>
                        Modelo
                      </label>
                      <div className="flex flex-col gap-1.5">
                        {selectedProvider.models.map(m => (
                          <label
                            key={m.id}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all"
                            style={{
                              background: aiForm.model === m.id ? NEUTRAL.red + "0F" : "var(--surface)",
                              borderColor: aiForm.model === m.id ? "var(--color-industria)" : "var(--border)",
                            }}
                          >
                            <input
                              type="radio"
                              name="ai-model"
                              value={m.id}
                              checked={aiForm.model === m.id}
                              onChange={() => setAiForm(f => ({ ...f, model: m.id }))}
                              style={{ accentColor: "var(--color-industria)" }}
                            />
                            <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{m.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* API key */}
                  {selectedProvider && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                          <Key size={11} className="inline mr-1" />Chave de API
                        </label>
                        <a
                          href={selectedProvider.keyHint.includes('platform.openai') ? 'https://platform.openai.com/api-keys' :
                                selectedProvider.keyHint.includes('console.anthropic') ? 'https://console.anthropic.com/settings/keys' :
                                'https://aistudio.google.com/app/apikey'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1"
                          style={{ color: "var(--color-industria)" }}
                        >
                          <ExternalLink size={10} />Obter chave
                        </a>
                      </div>
                      <div className="relative">
                        <input
                          type={aiKeyVisible ? "text" : "password"}
                          value={aiForm.apiKey}
                          onChange={e => { setAiForm(f => ({ ...f, apiKey: e.target.value })); setAiTestResult(null); }}
                          placeholder={selectedProvider.keyPlaceholder}
                          className="w-full text-sm rounded-xl border px-3 py-2.5 outline-none pr-16"
                          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", fontFamily: "monospace" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "var(--color-industria)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                        />
                        <button
                          type="button"
                          onClick={() => setAiKeyVisible(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                          style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                        >
                          {aiKeyVisible ? "Ocultar" : "Mostrar"}
                        </button>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-dim)" }}>
                        {selectedProvider.keyHint}
                      </p>
                    </div>
                  )}

                  {/* Test result */}
                  {aiTestResult && (
                    <div
                      className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                      style={{
                        background: aiTestResult === 'ok' ? "var(--success-bg)" : "var(--danger-bg)",
                        color: aiTestResult === 'ok' ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {aiTestResult === 'ok' ? <CheckCircle2 size={13} /> : <Zap size={13} />}
                      <span>{aiTestResult === 'ok' ? `✓ ${aiTestMsg || 'Conexão OK'}` : friendlyAiErrorMessage(aiTestMsg)}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  {selectedProvider && aiForm.apiKey.trim() && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleAiTest}
                        disabled={aiTesting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                        style={{
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                          cursor: aiTesting ? "wait" : "pointer",
                        }}
                      >
                        <Zap size={12} />
                        {aiTesting ? "Testando..." : "Testar conexão"}
                      </button>
                      <button
                        onClick={handleAiSave}
                        disabled={aiSaving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
                        style={{
                          background: "var(--color-industria)",
                          border: "none",
                          opacity: aiSaving ? 0.6 : 1,
                          cursor: aiSaving ? "wait" : "pointer",
                        }}
                      >
                        {aiSaving ? "Salvando..." : "Salvar configuração"}
                      </button>
                    </div>
                  )}
                  {aiSaveFeedback && (
                    <div
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                      style={{
                        background: aiSaveFeedback.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
                        color: aiSaveFeedback.type === "success" ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {aiSaveFeedback.type === "success" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      {aiSaveFeedback.msg}
                    </div>
                  )}
                </div>
              </Section>

              {canSeeD4Sign && (
                <Section
                  title="Assinatura eletrônica (D4Sign)"
                  description="Usado pelo RH pra enviar documentos de colaboradores pra assinatura eletrônica."
                >
                  {d4signStatus === null ? (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
                      <Loader2 size={13} className="animate-spin" /> Checando status…
                    </div>
                  ) : d4signStatus.error ? (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                      <AlertCircle size={13} />
                      <span>Não foi possível checar o status: {d4signStatus.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div
                        className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                        style={d4signStatus.configured
                          ? { background: "var(--success-bg)", color: "var(--success)" }
                          : { background: "var(--danger-bg)", color: "var(--danger)" }}
                      >
                        {d4signStatus.configured ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                        <span className="font-semibold">
                          {d4signStatus.configured ? "Configurado e ativo" : "Não configurado"}
                        </span>
                        {d4signStatus.configured && d4signStatus.sandbox && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
                            SANDBOX
                          </span>
                        )}
                      </div>
                      {d4signStatus.configured && (
                        <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                          Webhook de retorno de assinatura: {d4signStatus.webhookConfigured ? "configurado" : "não configurado"}.
                        </p>
                      )}
                      {!d4signStatus.configured && (
                        <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                          Faltam os secrets D4SIGN_API_TOKEN, D4SIGN_CRYPT_KEY e/ou D4SIGN_SAFE_UUID no projeto Supabase.
                        </p>
                      )}
                    </div>
                  )}
                </Section>
              )}
              </div>
            )}

            {/* ── APARÊNCIA ── */}
            {activeTab === "aparencia" && (
              <div className="space-y-4">
                <Section
                  title="Cor de destaque"
                  description="Aplicada em botões, links ativos, barras de progresso e destaques em todo o sistema."
                >
                  {/* Preset swatches */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-dim)" }}>Paletas prontas</div>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_PRESETS.map(p => {
                        const active = accentColor === p.value;
                        return (
                          <button
                            key={p.value}
                            onClick={() => handleAccentPreset(p)}
                            title={p.label}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                            style={{
                              background: active ? p.value + "18" : "var(--surface)",
                              borderColor: active ? p.value : "var(--border)",
                              color: active ? p.value : "var(--text-dim)",
                              cursor: "pointer",
                            }}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{ background: p.value, border: "2px solid " + p.value + "40" }}
                            />
                            {p.label}
                            {active && <Check size={11} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom pickers */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Cor principal
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={e => handleAccentInput(e.target.value)}
                          className="w-9 h-9 rounded-lg border cursor-pointer"
                          style={{ borderColor: "var(--border)", padding: 2 }}
                        />
                        <input
                          type="text"
                          value={accentColor}
                          onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) handleAccentInput(e.target.value); }}
                          className="flex-1 text-xs rounded-lg border px-2 py-1.5 outline-none font-mono"
                          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Cor hover
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={hoverColor}
                          onChange={e => handleHoverInput(e.target.value)}
                          className="w-9 h-9 rounded-lg border cursor-pointer"
                          style={{ borderColor: "var(--border)", padding: 2 }}
                        />
                        <input
                          type="text"
                          value={hoverColor}
                          onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) handleHoverInput(e.target.value); }}
                          className="flex-1 text-xs rounded-lg border px-2 py-1.5 outline-none font-mono"
                          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live preview */}
                  <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
                    <div className="text-xs font-semibold mb-3" style={{ color: "var(--text-dim)" }}>Pré-visualização</div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                        style={{ background: accentColor, cursor: "default" }}
                      >
                        Botão primário
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-semibold border"
                        style={{ color: accentColor, borderColor: accentColor, background: accentColor + "10", cursor: "default" }}
                      >
                        Botão secundário
                      </button>
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: accentColor + "18", color: accentColor, border: `1px solid ${accentColor}30` }}
                      >
                        Badge destaque
                      </span>
                      <span
                        className="text-sm font-medium underline cursor-default"
                        style={{ color: accentColor }}
                      >
                        Link ativo
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleResetAccent}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all"
                      style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
                    >
                      <RotateCcw size={12} />
                      Restaurar padrão
                    </button>
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                      A cor é salva localmente neste navegador.
                    </span>
                  </div>
                </Section>

                <Section
                  title="Modo escuro"
                  description="O botão de alternância fica no canto superior direito da barra de navegação."
                >
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
                    Use o ícone <strong style={{ color: "var(--text)" }}>lua / sol</strong> na barra superior para alternar entre modo claro e escuro.
                    A preferência é salva automaticamente.
                  </p>
                </Section>
              </div>
            )}

            {/* ── ATALHOS DA BARRA INFERIOR (mobile) ── */}
            {activeTab === "atalhos" && (
              <BottomNavPrefsPanel currentUser={currentUser} roles={roles} navGroups={navGroups} />
            )}

            {/* ── DADOS ── */}
            {activeTab === "dados" && (
              <div className="space-y-4">
                {!supabaseEnabled && (
                  <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)" }}>
                    Modo offline — dados armazenados localmente neste navegador.
                  </div>
                )}

                {/* ── Comercial (Leads) ── */}
                <Section
                  title="Dados de demonstração · Comercial"
                  description={`${leadsCount} lead${leadsCount === 1 ? "" : "s"} no momento. Use para explorar a UI sem cadastrar dados reais.`}
                >
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Button variant="secondary" icon={Sparkles} onClick={handleLoadDemo}>
                      Carregar dados de demonstração
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t" style={{ borderColor: "var(--border)" }}>
                    <Button
                      variant="ghost"
                      icon={Trash2}
                      onClick={handleClearLeads}
                      disabled={leadsCount === 0}
                      style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}
                    >
                      Limpar todos os leads
                    </Button>
                    {leadsCount > 0 && (
                      <span className="self-center text-xs flex items-center gap-1" style={{ color: "var(--danger)" }}>
                        <AlertTriangle size={11} />
                        Ação irreversível
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed mt-3" style={{ color: "var(--text-dim)" }}>
                    Gera ~68 empresas fictícias distribuídas entre Sanwey e Resibag, com setor, estado, porte e
                    funil. Preenche os dropdowns do Explorador, Kanban e Executivo para testes.
                  </p>
                </Section>

                {/* ── Marketing + RH ── */}
                {supabaseEnabled && onLoadAllDemoData && (
                  <Section
                    title="Dados de demonstração · Marketing & RH"
                    description="Popula campanhas, entregas, despesas, solicitações e funcionários fictícios para explorar todas as áreas da plataforma."
                  >
                    {demoDataCounts && (
                      <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "var(--success-bg)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)" }}>
                        <strong>Carregado com sucesso:</strong>{" "}
                        {demoDataCounts.campaigns} campanhas,{" "}
                        {demoDataCounts.deliverables} entregas,{" "}
                        {demoDataCounts.expenses} despesas,{" "}
                        {demoDataCounts.requests} solicitações,{" "}
                        {demoDataCounts.colaboradores} funcionários.
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        icon={demoDataLoading ? Loader2 : Sparkles}
                        onClick={onLoadAllDemoData}
                        disabled={demoDataLoading}
                      >
                        {demoDataLoading ? "Carregando…" : "Carregar dados de demonstração"}
                      </Button>
                    </div>
                    <p className="text-xs leading-relaxed mt-3" style={{ color: "var(--text-dim)" }}>
                      Cria registros fictícios em: Campanhas de Marketing, Entregas, Despesas,
                      Solicitações e Funcionários (RH). Os dados são marcados com <code>is_demo</code> e
                      podem ser removidos individualmente em cada módulo.
                    </p>
                  </Section>
                )}

                <Section
                  title="Dados locais"
                  description="Apagar leads, configurações e sessão armazenados neste navegador."
                >
                  <div
                    className="p-3.5 rounded-lg mb-4 flex items-start gap-2.5 text-xs"
                    style={{ background: "var(--amber-bg)", borderLeft: "3px solid var(--amber)", color: "var(--amber)" }}
                  >
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      Isso não afeta dados sincronizados com o Supabase. Afeta só este navegador.
                    </span>
                  </div>
                  <Button variant="secondary" icon={Trash2} onClick={handleClearLocal}>
                    Limpar dados locais
                  </Button>
                </Section>
              </div>
            )}

            {/* ── CAPTURA PÚBLICA ── */}
            {activeTab === "captura" && (
              <Section
                title="Links de captura pública"
                description="Compartilhe estes links onde fizer sentido — cada categoria abaixo alimenta um fluxo diferente da plataforma."
              >
                <div className="space-y-6">
                  {/* ── Leads (Comercial) ── */}
                  <div>
                    <div className="pb-2 mb-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <span
                        className="font-bold tracking-wide"
                        style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}
                      >
                        Leads (Comercial)
                      </span>
                      <p className="text-xs mt-1" style={{ color: "var(--text-dim)", marginBottom: 0 }}>
                        Quando um cliente preenche o formulário, o lead entra direto na etapa Prospecção da empresa correspondente.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {COMPANY_IDS.map(id => {
                        const c = COMPANIES[id];
                        const url = `${window.location.origin}/captura/${id}`;
                        return (
                          <div key={id} className="p-3.5 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                                  style={{ background: c.primary + "18", color: c.primary, border: `1px solid ${c.primary}30` }}
                                >
                                  {c.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <CopyLinkButton
                                  url={url}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors"
                                  style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                                />
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                                  style={{ background: c.primary, color: "#FFFFFF", textDecoration: "none" }}
                                >
                                  <ExternalLink size={12} />
                                  Abrir
                                </a>
                              </div>
                            </div>
                            <code style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}>{url}</code>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 p-3 rounded-lg text-xs flex items-start gap-2" style={{ background: "var(--surface-alt)", color: "#1E40AF", border: "1px solid #BFDBFE" }}>
                      <Link2 size={13} className="shrink-0 mt-0.5" />
                      <div>
                        <strong>Dica:</strong> adicione <code>?src=instagram</code>, <code>?src=whatsapp</code> ou outro identificador ao final da URL para rastrear a origem da captura no card do lead.
                      </div>
                    </div>
                  </div>

                  {/* ── Solicitações internas (Marketing) ── */}
                  <div>
                    <div className="pb-2 mb-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <span
                        className="font-bold tracking-wide"
                        style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}
                      >
                        Solicitações internas (Marketing)
                      </span>
                      <p className="text-xs mt-1" style={{ color: "var(--text-dim)", marginBottom: 0 }}>
                        Links internos para outros departamentos pedirem materiais ou compras ao Marketing.
                      </p>
                    </div>

                    {/* Formulário de Solicitação de Marketing */}
                    <div className="mb-5 pb-5 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                        <div>
                          <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--text)" }}>
                            Formulário de Solicitação · Marketing
                          </div>
                          <p className="text-xs" style={{ color: "var(--text-dim)", marginBottom: 0 }}>
                            Outros departamentos usam este link para pedir materiais ao Marketing. As solicitações entram em <strong>Marketing → Solicitações</strong> para aprovação.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <CopyLinkButton
                            url={`${window.location.origin}/solicitar-marketing`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors"
                            style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                          />
                          <a
                            href={`${window.location.origin}/solicitar-marketing`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                            style={{ background: "var(--accent)", color: "var(--on-accent)", textDecoration: "none" }}
                          >
                            <ExternalLink size={12} />
                            Abrir
                          </a>
                        </div>
                      </div>
                      <code style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}>
                        {window.location.origin}/solicitar-marketing
                      </code>
                    </div>

                    {/* Formulário de Solicitação de Compras de Marketing */}
                    <div>
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                        <div>
                          <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--text)" }}>
                            Formulário de Solicitação · Compras de Marketing
                          </div>
                          <p className="text-xs" style={{ color: "var(--text-dim)", marginBottom: 0 }}>
                            Qualquer pessoa usa este link para pedir a compra de um item pronto (brinde, uniforme, material impresso) — mesmo formulário de Solicitar ao Marketing, já com "Compra" pré-selecionado. Entra em <strong>Marketing → Solicitações</strong> para aprovação; ao aprovar, vai automaticamente para o Kanban de Compras.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <CopyLinkButton
                            url={`${window.location.origin}/solicitar-compra`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors"
                            style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                          />
                          <a
                            href={`${window.location.origin}/solicitar-compra`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                            style={{ background: "var(--accent)", color: "var(--on-accent)", textDecoration: "none" }}
                          >
                            <ExternalLink size={12} />
                            Abrir
                          </a>
                        </div>
                      </div>
                      <code style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}>
                        {window.location.origin}/solicitar-compra
                      </code>
                    </div>
                  </div>

                  {/* ── Recrutamento (Vagas públicas) ── */}
                  <div>
                    <div className="pb-2 mb-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <span
                        className="font-bold tracking-wide"
                        style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}
                      >
                        Recrutamento (Vagas públicas)
                      </span>
                      <p className="text-xs mt-1" style={{ color: "var(--text-dim)", marginBottom: 0 }}>
                        Um link de candidatura por vaga publicada. Compartilhe com candidatos, no site ou em redes sociais.
                      </p>
                    </div>
                    {vagasPublicadas.length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                        Nenhuma vaga publicada no momento.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {vagasPublicadas.map(vaga => {
                          const url = `${window.location.origin}/vagas/${vaga.link_slug}`;
                          return (
                            <div key={vaga.id} className="p-3.5 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                                    {vaga.title}
                                  </span>
                                  {(vaga.company_ids || []).map(id => (
                                    <span
                                      key={id}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                                      style={{
                                        background: (RH_FRENTE_COLORS[id] || "#888888") + "18",
                                        color: RH_FRENTE_COLORS[id] || "var(--text-dim)",
                                        border: `1px solid ${RH_FRENTE_COLORS[id] || "#888888"}30`,
                                      }}
                                    >
                                      {RH_FRENTE_LABELS[id] || id}
                                    </span>
                                  ))}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <CopyLinkButton
                                    url={url}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors"
                                    style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                                  />
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                                    style={{ background: "var(--accent)", color: "var(--on-accent)", textDecoration: "none" }}
                                  >
                                    <ExternalLink size={12} />
                                    Abrir
                                  </a>
                                </div>
                              </div>
                              <code style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}>{url}</code>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* ── FIGURINHAS (chat_is_manager) ── */}
            {activeTab === "figurinhas" && isChatManager && <StickersPanel />}

            {/* ── SEGURANÇA (admin) ── */}
            {activeTab === "seguranca" && isAdmin && (
              <div className="space-y-4">
                <ExportAuditPanel />
              </div>
            )}

            {/* ── USUÁRIOS ── */}
            {activeTab === "usuarios" && usersPanel}

          </div>
        </div>
      </div>

      {/* Confirm clear leads modal */}
      <Modal
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="⚠️ Confirmar exclusão de leads"
        width={440}
      >
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
            Esta ação removerá <strong>todos os {leadsCount} leads</strong> do CRM.
            Ela é <strong>irreversível</strong> e não pode ser desfeita.
          </p>
          <div
            className="p-3 rounded-lg text-xs flex items-start gap-2"
            style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}
          >
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>Dados sincronizados com o Supabase serão excluídos do banco de dados permanentemente.</span>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--text-dim)" }}>
              Digite <strong style={{ color: "var(--text)" }}>LIMPAR</strong> para confirmar
            </label>
            <input
              type="text"
              value={clearTyped}
              onChange={e => setClearTyped(e.target.value)}
              placeholder="LIMPAR"
              autoFocus
              className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--danger)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setClearConfirmOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleClearConfirm}
              disabled={clearTyped !== "LIMPAR"}
              className="px-4 py-2 text-sm rounded-lg font-semibold transition-opacity"
              style={{
                background: "var(--danger)",
                color: "var(--on-danger)",
                opacity: clearTyped === "LIMPAR" ? 1 : 0.4,
                cursor: clearTyped === "LIMPAR" ? "pointer" : "not-allowed",
                border: "none",
              }}
            >
              Excluir todos os leads
            </button>
          </div>
        </div>
      </Modal>

      <AvatarCropModal
        imageSrc={croppingSrc}
        onSave={(croppedDataUrl) => {
          setProfileForm(f => ({ ...f, avatarUrl: croppedDataUrl }));
          setCroppingSrc(null);
        }}
        onCancel={() => setCroppingSrc(null)}
      />
    </div>
  );
}

export default SettingsView;
