import React, { useState } from "react";
import { User, Lock, Save, CheckCircle2 } from "lucide-react";

const ROLE_LABEL = {
  admin:             "Administrador",
  gerente:           "Gerente Comercial",
  vendedor:          "Vendedor",
  consultor:         "Consultor",
  marketing:         "Marketing",
  gerente_marketing: "Gerente de Marketing",
  agencia:           "Agência",
};

export function UserProfileView({ currentUser, onUpdateUser, onUpdateAuthUser, onUpdateMockUser, supabaseEnabled }) {
  const [name, setName]           = useState(currentUser?.name || "");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [nameError, setNameError] = useState("");

  const [pwCurrent, setPwCurrent]   = useState("");
  const [pwNew, setPwNew]           = useState("");
  const [pwConfirm, setPwConfirm]   = useState("");
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwSaved, setPwSaved]       = useState(false);
  const [pwError, setPwError]       = useState("");

  async function handleSaveName(e) {
    e.preventDefault();
    if (!name.trim()) { setNameError("Nome não pode ficar em branco."); return; }
    setNameError("");
    setSaving(true);
    try {
      if (supabaseEnabled && onUpdateUser) {
        await onUpdateUser({ id: currentUser.id, name: name.trim() });
      } else if (onUpdateMockUser) {
        onUpdateMockUser(u => ({ ...u, name: name.trim() }));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setNameError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    setPwError("");
    if (!pwNew) { setPwError("Informe a nova senha."); return; }
    if (pwNew.length < 6) { setPwError("A senha deve ter ao menos 6 caracteres."); return; }
    if (pwNew !== pwConfirm) { setPwError("As senhas não coincidem."); return; }
    setPwSaving(true);
    try {
      if (supabaseEnabled && onUpdateAuthUser) {
        await onUpdateAuthUser({ password: pwNew });
      }
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    } catch (err) {
      setPwError(err.message || "Erro ao alterar senha.");
    } finally {
      setPwSaving(false);
    }
  }

  const initials = currentUser?.initials || (currentUser?.name || "?").slice(0, 2).toUpperCase();
  const role     = ROLE_LABEL[currentUser?.role] || currentUser?.role || "—";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "8px 0 32px" }}>
      {/* Avatar + identity */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: "28px 24px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: currentUser?.avatarUrl ? "transparent" : (currentUser?.avatarBg || "#b5000b"),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "#FFFFFF",
            fontSize: 22,
            flexShrink: 0,
            overflow: "hidden",
            border: "3px solid #E5E7EB",
          }}
        >
          {currentUser?.avatarUrl
            ? <img src={currentUser.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : initials}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#201a1a" }}>{currentUser?.name || "—"}</div>
          <div style={{ color: "#5c5f60", fontSize: 13, marginTop: 2 }}>{role}</div>
          <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>{currentUser?.email}</div>
        </div>
      </div>

      {/* Name */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: "24px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <User size={16} style={{ color: "#b5000b" }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: "#201a1a" }}>Informações pessoais</span>
        </div>
        <form onSubmit={handleSaveName}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5c5f60", marginBottom: 4 }}>
            Nome de exibição
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: `1px solid ${nameError ? "#ef4444" : "#E5E7EB"}`,
              fontSize: 14,
              color: "#201a1a",
              background: "#FAFAFA",
              outline: "none",
              boxSizing: "border-box",
            }}
            placeholder="Seu nome"
          />
          {nameError && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{nameError}</div>}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: "#b5000b",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Save size={14} />
              {saving ? "Salvando…" : "Salvar nome"}
            </button>
            {saved && (
              <span style={{ color: "#16A34A", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={14} /> Salvo!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Password */}
      {supabaseEnabled && (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Lock size={16} style={{ color: "#b5000b" }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: "#201a1a" }}>Alterar senha</span>
          </div>
          <form onSubmit={handleSavePassword}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5c5f60", marginBottom: 4 }}>Nova senha</label>
                <input
                  type="password"
                  value={pwNew}
                  onChange={e => setPwNew(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${pwError ? "#ef4444" : "#E5E7EB"}`,
                    fontSize: 14,
                    color: "#201a1a",
                    background: "#FAFAFA",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5c5f60", marginBottom: 4 }}>Confirmar nova senha</label>
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={e => setPwConfirm(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${pwError ? "#ef4444" : "#E5E7EB"}`,
                    fontSize: 14,
                    color: "#201a1a",
                    background: "#FAFAFA",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="Repita a nova senha"
                />
              </div>
              {pwError && <div style={{ color: "#ef4444", fontSize: 12 }}>{pwError}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="submit"
                  disabled={pwSaving}
                  style={{
                    background: "#b5000b",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 18px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: pwSaving ? "not-allowed" : "pointer",
                    opacity: pwSaving ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Lock size={14} />
                  {pwSaving ? "Salvando…" : "Alterar senha"}
                </button>
                {pwSaved && (
                  <span style={{ color: "#16A34A", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={14} /> Senha alterada!
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default UserProfileView;
