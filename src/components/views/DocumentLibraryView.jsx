import React, { useMemo, useState } from "react";
import {
  BookOpen, Plus, Trash2, Pencil, Search, Download, Upload, FileText,
} from "lucide-react";
import { useDocumentLibrary } from "../../hooks/use-document-library";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { EmptyState } from "../ui/EmptyState";
import { StatCard } from "../ui/StatCard";
import { Modal } from "../ui/Modal";
import { FilterBar } from "../shared/FilterBar";
import { Card, CardGrid, CardSkeleton, GridListToggle } from "../shared/Card";
import { PageHeader } from "../shared/PageHeader";
import { formatDateBR } from "../../utils/date";

// Biblioteca de Documentos Técnicos (18/08/2026) — datasheet/certificado
// reutilizável (ISO 9001, INMETRO, FSSC, ficha técnica de modelo Sanbag),
// anexável a qualquer negócio sem reenviar o arquivo toda vez (ver
// "Anexar da biblioteca" em LeadDetailDrawer → aba Anexos). Mesmo molde de
// FornecedoresView.jsx (Card/CardGrid + FilterBar + exclusão canônica,
// CLAUDE.md regra 6/"padrão de exclusão").

export const CATEGORY_LABELS = {
  certificado: "Certificado",
  datasheet: "Datasheet",
  manual: "Manual",
  ficha_tecnica: "Ficha técnica",
  outro: "Outro",
};
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label }));

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentModal({ doc, onSave, onClose }) {
  const [title, setTitle] = useState(doc?.title || "");
  const [category, setCategory] = useState(doc?.category || "outro");
  const [tagsText, setTagsText] = useState((doc?.tags || []).join(", "));
  const [companyIds, setCompanyIds] = useState(doc?.company_ids || []);
  const [expiresAt, setExpiresAt] = useState(doc?.expires_at || "");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const toggleCompany = (id) => setCompanyIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError("Informe o título do documento."); return; }
    if (companyIds.length === 0) { setError("Selecione ao menos uma empresa."); return; }
    if (!doc && !file) { setError("Selecione o arquivo."); return; }
    setSaving(true);
    setError(null);
    try {
      const tags = tagsText.split(",").map(t => t.trim()).filter(Boolean);
      await onSave({ title: title.trim(), category, tags, companyIds, expiresAt: expiresAt || null, file });
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao salvar documento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={doc ? "Editar documento" : "Novo documento"} width={460}>
      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus className="w-full text-sm rounded-lg px-3 py-2 border"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}
              placeholder="Ex.: Certificado ISO 9001 — Sanwey" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Categoria</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border"
                style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}>
                {CATEGORY_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Validade (opcional)</label>
              <input type="date" value={expiresAt || ""} onChange={e => setExpiresAt(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border"
                style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Tags (separadas por vírgula)</label>
            <input value={tagsText} onChange={e => setTagsText(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}
              placeholder="Ex.: sanbag-standard, iso-9001" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Empresas *</label>
            <div className="flex gap-2">
              {COMPANY_IDS.map(id => (
                <button key={id} type="button" onClick={() => toggleCompany(id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={companyIds.includes(id)
                    ? { background: COMPANIES[id]?.primary, color: "#fff", borderColor: COMPANIES[id]?.primary }
                    : { background: "var(--surface-alt)", color: "var(--text-dim)", borderColor: "var(--border)" }}>
                  {COMPANIES[id]?.short || id}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
              Arquivo {doc && "(deixe em branco pra manter o atual)"}
            </label>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs rounded-lg px-3 py-2 border"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
            {doc && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-dim)" }}>
                Trocar o arquivo aqui atualiza todos os negócios que já anexaram este documento (mesma referência).
              </p>
            )}
          </div>
        </div>

        {error && <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</div>}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmDeleteDocumentModal({ doc, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao excluir documento.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Excluir documento?" width={400}>
      <div className="p-6">
        <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
          "{doc.title}" será removido da biblioteca. Negócios que já anexaram este documento perdem a
          referência — o arquivo não fica mais acessível a partir deles.
        </p>
        {error && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={deleting} className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)", opacity: deleting ? 0.6 : 1 }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--danger)", color: "var(--on-danger)", opacity: deleting ? 0.6 : 1 }}>
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DocumentLibraryView({ user, canManage = false }) {
  const { documents, loading, create, update, replaceFile, remove, getSignedUrl } = useDocumentLibrary();
  const [editing, setEditing] = useState(null); // doc | "new" | null
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [density, setDensity] = useState("grid");
  const [downloadingId, setDownloadingId] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter(d => {
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      if (q && !(d.title || "").toLowerCase().includes(q) && !(d.tags || []).some(t => t.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [documents, search, categoryFilter]);

  const filtersActive = Boolean(search.trim()) || categoryFilter !== "all";
  const clearFilters = () => { setSearch(""); setCategoryFilter("all"); };

  const handleSave = async (form) => {
    if (editing === "new") {
      await create(form.file, { ...form, uploadedBy: user?.id || null });
    } else {
      if (form.file) {
        // Trocar o arquivo mantém o mesmo document_library_id — quem já
        // referenciou continua apontando pro registro certo, só o conteúdo
        // muda (comportamento "sobrescrever", registrado na spec).
        await replaceFile(editing, form.file);
      }
      await update(editing.id, form);
    }
  };

  const handleDownload = async (doc) => {
    setDownloadingId(doc.id);
    try {
      const url = await getSignedUrl(doc.file_path);
      if (!url) return;
      const a = document.createElement("a");
      a.href = url; a.download = doc.file_name; a.target = "_blank"; a.rel = "noopener noreferrer";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={BookOpen}
        title="Biblioteca de Documentos"
        subtitle="Datasheet, certificado e ficha técnica reutilizáveis — anexe a qualquer negócio sem reenviar"
        actions={
          canManage && (
            <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 font-semibold"
              style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "6px 16px", fontSize: 13, cursor: "pointer" }}>
              <Plus size={14} /> Novo documento
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3" style={{ maxWidth: 280 }}>
        <StatCard icon={FileText} value={documents.length} label="Documentos" />
      </div>

      <FilterBar
        search={{ value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Buscar por título ou tag…" }}
        filters={[{
          id: "category",
          value: categoryFilter,
          onChange: (e) => setCategoryFilter(e.target.value),
          label: "Categoria",
          options: [{ value: "all", label: "Todas as categorias" }, ...CATEGORY_OPTIONS.map(c => ({ value: c.id, label: c.label }))],
        }]}
        trailing={<GridListToggle value={density} onChange={setDensity} />}
      />

      {loading ? (
        <CardGrid density={density}>
          {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} density={density} />)}
        </CardGrid>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhum documento cadastrado"
          description="Cadastre datasheets e certificados reutilizáveis pra anexar em qualquer negócio."
          action={canManage && (
            <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 font-semibold"
              style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
              <Plus size={14} /> Novo documento
            </button>
          )}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum resultado pra estes filtros"
          description="Nenhum documento corresponde à busca ou categoria selecionada. Tente outro termo ou limpe os filtros."
          action={
            <button onClick={clearFilters}
              style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Limpar filtros
            </button>
          }
        />
      ) : (
        <CardGrid density={density}>
          {filtered.map(d => {
            const expired = d.expires_at && new Date(d.expires_at) < new Date();
            return (
              <Card
                key={d.id}
                density={density}
                onClick={() => handleDownload(d)}
                icon={<FileText size={density === "list" ? 14 : 17} />}
                title={d.title}
                meta={CATEGORY_LABELS[d.category] || d.category}
                footer={d.expires_at ? `Validade: ${formatDateBR(d.expires_at)}${expired ? " (vencido)" : ""}` : formatBytes(d.file_size)}
                menu={canManage && (
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setEditing(d); }} aria-label="Editar documento"
                      style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(d); }} aria-label="Excluir documento"
                      style={{ color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              >
                <div className="space-y-1 text-xs" style={{ color: "var(--text-dim)" }}>
                  <div className="flex items-center gap-1"><Download size={10} /> {downloadingId === d.id ? "Baixando…" : d.file_name}</div>
                  {d.company_ids?.length > 0 && (
                    <div>{d.company_ids.map(id => COMPANIES[id]?.short || id).join(", ")}</div>
                  )}
                  {expired && (
                    <div className="font-semibold" style={{ color: "var(--danger)" }}>Certificado vencido</div>
                  )}
                </div>
              </Card>
            );
          })}
        </CardGrid>
      )}

      {editing && (
        <DocumentModal
          doc={editing === "new" ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteDocumentModal
          doc={confirmDelete}
          onConfirm={() => remove(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default DocumentLibraryView;
