import React, { useState } from "react";
import { Plus, Pause, Play, Trash2, Users } from "lucide-react";
import { useClientContacts } from "../../hooks/use-client-contacts";
import { Modal } from "../ui/Modal";

// Clientes → Contatos. Comitê de compra de uma conta industrial —
// Procurement, EHS, Logística, CFO, Board — cada um com seu próprio
// registro, em vez do único "Decisor" solto que o lead carregava (ver
// LeadDetailDrawer, seção "Comitê de compra", read-only, alimentada por
// esta mesma tabela). Mesmo molde estrutural de ClientProductsTab.jsx —
// tabela, não Card/CardGrid — pra ficar coerente com a aba irmã dentro do
// mesmo modal.

function inputStyle() {
  return {
    width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "var(--text)",
  };
}

function Label({ children }) {
  return (
    <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </label>
  );
}

function ContactModal({ open, onClose, editing, onSave }) {
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [seeded, setSeeded] = useState(null);

  const key = editing?.id ?? "novo";
  if (open && seeded !== key) {
    setSeeded(key);
    setName(editing?.name || "");
    setJobTitle(editing?.job_title || "");
    setEmail(editing?.email || "");
    setPhone(editing?.phone || "");
    setErr(null);
  }
  if (!open && seeded !== null) setSeeded(null);

  const handleSave = async () => {
    if (!name.trim()) { setErr("Informe o nome do contato."); return; }
    setSaving(true); setErr(null);
    try {
      await onSave({ name: name.trim(), jobTitle: jobTitle.trim(), email: email.trim(), phone: phone.trim() });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editar contato" : "Novo contato"} width={420}>
      <div className="space-y-3.5">
        <div>
          <Label>Nome *</Label>
          <input style={inputStyle()} value={name} onChange={e => setName(e.target.value)} placeholder="Nome do contato" autoFocus />
        </div>
        <div>
          <Label>Cargo / papel no comitê</Label>
          <input style={inputStyle()} value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                 placeholder="Ex.: Procurement, EHS, Diretor de Logística, CFO" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>E-mail</Label>
            <input style={inputStyle()} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@empresa.com" />
          </div>
          <div>
            <Label>Telefone</Label>
            <input style={inputStyle()} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
        </div>

        {err && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : editing ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmDeleteContactModal({ contact, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setDeleting(true); setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao excluir contato.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Excluir contato?" width={400}>
      <div className="p-1">
        <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
          "{contact.name}" será removido do comitê de compra deste cliente. Negócios que já
          referenciaram esse contato mantêm o registro histórico ("Contato inicial").
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

export function ClientContactsTab({ clientId, canEdit = false }) {
  const { rows, loading, create, update, setActive, remove } = useClientContacts(clientId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleSave = async (contact) => {
    if (editing) await update(editing.id, contact);
    else await create(contact);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)", maxWidth: "52ch" }}>
          Comitê de compra desse cliente — Procurement, EHS, Logística, CFO, Board — cada um
          separado, com seu papel. Aparece no drawer de cada negócio ligado a este cliente.
        </p>
        {canEdit && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Plus size={13} /> Novo contato
          </button>
        )}
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 480 }}>
          <thead>
            <tr>
              {["Nome", "Cargo / papel", "Contato", ""].map((h, i) => (
                <th key={h + i}
                    style={{
                      fontSize: 10, fontWeight: 650, letterSpacing: "0.11em", textTransform: "uppercase",
                      color: "var(--text-dim)", borderBottom: "1px solid var(--border)",
                      padding: "10px 12px 8px 0", paddingLeft: i === 0 ? 14 : 0,
                      textAlign: i === 3 ? "right" : "left", whiteSpace: "nowrap",
                    }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10">
                  <Users size={20} style={{ color: "var(--text-dim)", margin: "0 auto 8px" }} />
                  <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Nenhum contato cadastrado</p>
                  <p className="text-xs mt-1 mx-auto" style={{ color: "var(--text-dim)", maxWidth: "44ch" }}>
                    Cadastre cada interlocutor do comitê de compra separadamente — assim o
                    vendedor sabe quem é Procurement, quem é EHS, quem aprova o orçamento.
                  </p>
                </td>
              </tr>
            ) : rows.map(c => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", opacity: c.active ? 1 : 0.55 }}>
                <td style={{ padding: "11px 12px 11px 14px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  {c.name}
                  {!c.active && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>Inativo</span>
                  )}
                </td>
                <td style={{ padding: "11px 12px 11px 0", fontSize: 12, color: "var(--text-dim)" }}>
                  {c.job_title || "—"}
                </td>
                <td style={{ padding: "11px 12px 11px 0", fontSize: 12, color: "var(--text-dim)" }}>
                  {c.email || c.phone ? [c.email, c.phone].filter(Boolean).join(" · ") : "—"}
                </td>
                <td style={{ padding: "11px 14px 11px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                  {canEdit && (
                    <>
                      <button onClick={() => { setEditing(c); setModalOpen(true); }}
                              className="text-[11px] font-bold px-2 py-1 rounded" style={{ color: "var(--accent)" }}>
                        Editar
                      </button>
                      <button onClick={() => setActive(c.id, !c.active)}
                              title={c.active ? "Marcar como inativo" : "Reativar"}
                              className="p-1.5 rounded" style={{ color: "var(--text-dim)" }}>
                        {c.active ? <Pause size={13} /> : <Play size={13} />}
                      </button>
                      <button onClick={() => setConfirmDelete(c)} aria-label="Excluir contato"
                              className="p-1.5 rounded" style={{ color: "var(--danger)" }}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ContactModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} onSave={handleSave} />
      {confirmDelete && (
        <ConfirmDeleteContactModal
          contact={confirmDelete}
          onConfirm={() => remove(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default ClientContactsTab;
