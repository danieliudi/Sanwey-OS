import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, Upload, FileText } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { friendlyError } from "../../utils/friendly-error";
import { RH_OPERATIONAL_DEPARTMENTS } from "../../constants/rh-config";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCENT = "#C7212B";
const UNIDADES = [
  { id: "", label: "Não tenho preferência" },
  { id: "sanwey", label: "Sanwey" },
  { id: "resibag", label: "Resibag" },
  { id: "montemor", label: "Monte Mor" },
];

function formatPhone(digits) {
  const d = (digits || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function JobApplicationForm() {
  const { slug } = useParams();

  const [vaga, setVaga] = useState(undefined); // undefined = loading, null = não encontrada
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", linkedin: "", unidade: "", consentimento: false });
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = "Trabalhe conosco — Grupo Sanwey";
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) { setVaga(null); return; }
    (async () => {
      const { data, error: err } = await supabase.rpc("get_vaga_publica", { p_slug: slug });
      if (!active) return;
      if (err || !data || data.length === 0) { setVaga(null); return; }
      setVaga(data[0]);
    })();
    return () => { active = false; };
  }, [slug]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleFile = (f) => {
    setFileError(null);
    if (!f) { setFile(null); return; }
    if (!ALLOWED_TYPES.includes(f.type)) { setFileError("Envie um arquivo PDF ou DOCX."); return; }
    if (f.size > MAX_FILE_SIZE) { setFileError("O arquivo deve ter no máximo 10MB."); return; }
    setFile(f);
  };

  // Vagas operacionais/chão-de-fábrica não exigem currículo formatado —
  // candidato desse perfil raramente tem um pronto em PDF/DOCX, e a
  // exigência bloqueava a candidatura sem alternativa nenhuma (achado da
  // auditoria de fricção de 18/07). RPC também relaxa a mesma exigência.
  const resumeRequired = !RH_OPERATIONAL_DEPARTMENTS.includes(vaga?.department);

  const canSubmit = useMemo(() => (
    form.nome.trim().length >= 2 &&
    (!resumeRequired || Boolean(file)) &&
    // Pelo menos um contato — sem isso o RH não tem como retornar pro
    // candidato (achado da auditoria de fricção de 18/07).
    Boolean(form.email.trim() || form.telefone.replace(/\D/g, "")) &&
    form.consentimento &&
    !submitting
  ), [form, file, submitting, resumeRequired]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const ext = file ? (file.name.split(".").pop() || "pdf").toLowerCase() : null;
      const { data: candidateId, error: rpcErr } = await supabase.rpc("submit_job_application", {
        p_vaga_slug: slug,
        p_nome: form.nome.trim(),
        p_email: form.email.trim() || null,
        p_telefone: form.telefone.replace(/\D/g, "") || null,
        p_linkedin: form.linkedin.trim() || null,
        p_consentimento_lgpd: form.consentimento,
        p_resume_ext: ext,
        p_frente: form.unidade || null,
      });
      if (rpcErr) throw rpcErr;

      if (file) {
        const path = `${candidateId}/curriculo.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("rh-curriculos")
          .upload(path, file, { contentType: file.type, upsert: true });
        if (uploadErr) throw uploadErr;
      }

      // Confirmação por e-mail — fire-and-forget: não bloqueia a tela de
      // sucesso nem falha a candidatura se o e-mail não sair (achado da
      // auditoria de fricção de 18/07).
      supabase.functions
        .invoke("rh-send-email", { body: { type: "candidatura_recebida", vagaSlug: slug, candidateId } })
        .catch(err => console.warn("Falha ao enviar e-mail de confirmação de candidatura:", err));

      setDone(true);
    } catch (err) {
      setError(friendlyError(err, "Não foi possível enviar sua candidatura. Tente novamente."));
    } finally {
      setSubmitting(false);
    }
  };

  if (vaga === undefined) {
    return (
      <ShellCard>
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: ACCENT }} />
        </div>
      </ShellCard>
    );
  }

  if (!vaga) {
    return (
      <ShellCard>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Vaga não encontrada</h1>
        <p style={{ color: "#5c5f60", fontSize: 14, marginBottom: 16 }}>
          Este link não corresponde a nenhuma vaga aberta no momento — pode ter sido preenchida ou encerrada.
        </p>
        <a
          href="/trabalhe-conosco"
          style={{ display: "inline-block", padding: "10px 18px", borderRadius: 10, background: ACCENT, color: "#FFF", fontSize: 14, fontWeight: 700, textDecoration: "none" }}
        >
          Ver outras vagas / deixar currículo
        </a>
      </ShellCard>
    );
  }

  if (done) {
    return (
      <ShellCard>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: ACCENT + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={28} color={ACCENT} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#201a1a", margin: 0 }}>Candidatura recebida!</h1>
          <p style={{ color: "#5c5f60", fontSize: 14, maxWidth: 360, margin: 0 }}>
            Obrigado pelo interesse na vaga de <strong>{vaga.title}</strong>. Nosso time de RH vai analisar seu currículo e entrar em contato se houver fit.
          </p>
        </div>
      </ShellCard>
    );
  }

  return (
    <ShellCard>
      <header style={{ marginBottom: 24 }}>
        {vaga.department && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "4px 10px", borderRadius: 999,
            background: ACCENT + "14", color: ACCENT,
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
            marginBottom: 12,
          }}>
            {vaga.department}
          </div>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#201a1a", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          {vaga.title}
        </h1>
        {vaga.description && (
          <p style={{ color: "#5c5f60", fontSize: 14, margin: "0 0 8px", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {vaga.description}
          </p>
        )}
        {vaga.requirements && (
          <p style={{ color: "#5c5f60", fontSize: 13, margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            <strong>Requisitos:</strong> {vaga.requirements}
          </p>
        )}
      </header>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Nome completo" required>
          <input type="text" value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Digite aqui …" style={input} />
        </Field>

        <Field label="E-mail" hint="Informe e-mail ou telefone para podermos retornar">
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@dominio.com" style={input} />
        </Field>

        <Field label="Telefone" hint="Informe e-mail ou telefone para podermos retornar">
          <input type="tel" value={form.telefone} onChange={e => set("telefone", formatPhone(e.target.value))} placeholder="(99) 99999-9999" style={input} />
        </Field>

        <Field label="LinkedIn (opcional)">
          <input type="url" value={form.linkedin} onChange={e => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/…" style={input} />
        </Field>

        <Field label="Unidade de interesse" hint="Além desta vaga, avise se também tem interesse em outra unidade">
          <select value={form.unidade} onChange={e => set("unidade", e.target.value)} style={input}>
            {UNIDADES.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </Field>

        <Field
          label="Currículo"
          hint={resumeRequired ? "PDF ou DOCX, até 10MB" : "PDF ou DOCX, até 10MB — opcional para esta vaga"}
          required={resumeRequired}
        >
          <label style={{
            display: "flex", alignItems: "center", gap: 10,
            border: `1px dashed ${fileError ? "#DC2626" : "#D1D5DB"}`, borderRadius: 8,
            padding: "14px 12px", cursor: "pointer", background: "#F9FAFB",
          }}>
            <Upload size={16} style={{ color: ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: file ? "#201a1a" : "#6B7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file ? file.name : "Selecionar arquivo…"}
            </span>
            {file && <FileText size={14} style={{ color: "#16A34A", flexShrink: 0 }} />}
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={e => handleFile(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />
          </label>
          {fileError && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 6 }}>{fileError}</div>}
        </Field>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#5c5f60", lineHeight: 1.5, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={form.consentimento}
            onChange={e => set("consentimento", e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <span>
            Autorizo o Grupo Sanwey a armazenar meus dados e currículo para fins de recrutamento e seleção,
            conforme a Lei Geral de Proteção de Dados (LGPD). *
          </span>
        </label>

        {error && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, border: "1px solid #FECACA" }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            marginTop: 4,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: canSubmit ? ACCENT : "#D1D5DB",
            color: "#FFFFFF",
            border: "none", borderRadius: 8,
            padding: "12px 20px", fontSize: 14, fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? "Enviando…" : "Enviar candidatura"}
        </button>
      </form>
    </ShellCard>
  );
}

const input = {
  width: "100%",
  fontSize: 14,
  borderRadius: 6,
  border: "1px solid #D1D5DB",
  padding: "10px 12px",
  color: "#201a1a",
  background: "#FFFFFF",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

// Toque no texto do rótulo não focava o campo (label solto, sem
// htmlFor/id) — no celular, onde esse form é acessado via QR code, o
// alvo maior e mais natural pro toque é o próprio texto, não a caixinha
// do input. Achado da auditoria de fricção de 18/07. Não se aplica ao
// upload de arquivo (o próprio child já é um <label> envolvendo o input
// escondido — a associação nativa já existe por aninhamento).
const LABELABLE_TYPES = new Set(["input", "select", "textarea"]);
function Field({ label, hint, required, children }) {
  const id = `f-${label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  const labelable = React.isValidElement(children) && LABELABLE_TYPES.has(children.type);
  const child = labelable ? React.cloneElement(children, { id: children.props.id || id }) : children;
  return (
    <div>
      <label htmlFor={labelable ? id : undefined} style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 2 }}>
        {required && <span style={{ color: "#C7212B", marginRight: 4 }}>*</span>}
        {label}
      </label>
      {hint && <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{hint}</div>}
      {child}
    </div>
  );
}

function ShellCard({ children }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F9FAFB",
      padding: "32px 16px",
      fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        maxWidth: 560,
        margin: "0 auto",
        background: "#FFFFFF",
        borderRadius: 12,
        boxShadow: "var(--shadow-pop)",
        border: "1px solid #E5E7EB",
        padding: 32,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "#C7212B" }} />
        {children}
      </div>
      <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 11, marginTop: 16 }}>
        © Grupo Sanwey · Trabalhe Conosco
      </p>
    </div>
  );
}
