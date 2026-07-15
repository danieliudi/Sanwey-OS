import React, { useEffect, useRef, useState } from "react";
import { X, Upload, FileText, Sparkles, Loader2, AlertCircle, Check, Camera } from "lucide-react";
import { RH_DEPARTMENTS, RH_CONTRACT_TYPES, RH_EMPLOYEE_STATUSES } from "../../constants/rh-config";
import { RH_FRENTES, RH_FRENTE_LABELS } from "../../constants/rh-frentes";
import { CurrencyInput } from "../ui/CurrencyInput";
import { supabase } from "../../lib/supabase";
import { useAI } from "../../hooks/use-ai";
import { documentExtractionPrompt } from "../../constants/ai-prompts";
import { periodoExperienciaInfo } from "../../utils/rh-compliance-dates";
import { DocumentCaptureModal } from "../shared/DocumentCaptureModal";

const DOC_BUCKET = "rh-documentos-colaborador";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const EMPTY_FORM = {
  fullName: "", cpf: "", rg: "", birthDate: "", phone: "", email: "",
  addressStreet: "", addressNumber: "", addressComplement: "", addressNeighborhood: "",
  addressCity: "", addressState: "", addressZip: "",
  jobTitle: "", department: "", frente: "", contractType: "", admissionDate: "",
  employeeStatus: "ativo", salary: "", asoVencimento: "", contratoFim: "",
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseExtraction(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("A IA não retornou um JSON válido.");
  return JSON.parse(match[0]);
}

export function NovoColaboradorModal({ currentUser, initialData, hireContext, onSave, onClose }) {
  const { complete, isConfigured, provider } = useAI(currentUser);
  const [form, setForm] = useState(() => initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [closeVaga, setCloseVaga] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleFile = async (f) => {
    setFileError(null);
    setExtracted(false);
    if (!f) { setFile(null); return; }
    if (!ALLOWED_TYPES.includes(f.type)) { setFileError("Envie uma foto (JPG/PNG) ou PDF do documento."); return; }
    if (f.size > MAX_FILE_SIZE) { setFileError("O arquivo deve ter no máximo 10MB."); return; }
    setFile(f);

    if (!isConfigured || provider !== "anthropic") return; // preenchimento automático é opcional

    setExtracting(true);
    setError(null);
    try {
      const base64 = await fileToBase64(f);
      const block = f.type === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: f.type, data: base64 } };
      const text = await complete(documentExtractionPrompt(block), { maxTokens: 300 });
      const data = parseExtraction(text);
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || data.fullName || "",
        cpf: prev.cpf || data.cpf || "",
        rg: prev.rg || data.rg || "",
        birthDate: prev.birthDate || data.birthDate || "",
      }));
      setExtracted(true);
    } catch (err) {
      setFileError(`Não foi possível ler o documento automaticamente (${err.message || "erro"}). Preencha manualmente.`);
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) { setError("Nome completo é obrigatório."); return; }
    if (!form.frente) { setError("Frente é obrigatória."); return; }
    // Documento obrigatório só na criação — editar um colaborador legado sem
    // documento não deve ficar travado retroativamente.
    if (!initialData && !file) { setError("Anexe uma foto ou PDF do RG/CNH antes de cadastrar."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = hireContext ? { ...form, _closeVaga: closeVaga } : form;
      const novo = await onSave(payload);
      const targetId = novo?.id || initialData?.id;
      if (file && targetId) {
        const ext = file.type === "application/pdf" ? "pdf" : (file.type.split("/")[1] || "jpg");
        // document_type só aceita 'cnh'/'rg' (CHECK constraint da tabela) — o
        // documento anexado aqui é sempre RG ou CNH (rótulo do campo acima),
        // nunca "cpf" (isso é só um número, não um documento escaneado).
        const documentType = "rg";
        const path = `${targetId}/documento.${ext}`;
        const { error: uploadErr } = await supabase.storage.from(DOC_BUCKET).upload(path, file, { contentType: file.type, upsert: true });
        if (uploadErr) throw new Error(`Funcionário salvo, mas o documento não foi enviado (${uploadErr.message}). Tente anexar novamente editando o cadastro.`);
        const { error: updateErr } = await supabase.from("rh_colaboradores").update({ document_type: documentType, document_path: path }).eq("id", targetId);
        if (updateErr) throw new Error(`Funcionário salvo e documento enviado, mas o cadastro não foi vinculado ao arquivo (${updateErr.message}).`);
      }
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao cadastrar funcionário.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };
  const focusBlue = (e) => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = (e) => { e.target.style.borderColor = "var(--border-strong)"; };
  const inputCls = "w-full text-sm rounded-xl border px-3 py-2 outline-none";

  return (
    <>
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 620, boxShadow: "var(--shadow-pop)", maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>{initialData ? "Editar Funcionário" : "Novo Funcionário"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          {hireContext && (
            <div style={{ background: "var(--success-bg)", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 6 }}>
                Convertendo candidato aprovado{hireContext.vagaTitle ? ` — vaga "${hireContext.vagaTitle}"` : ""}
              </div>
              {hireContext.vagaId && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--success)", cursor: "pointer" }}>
                  <input type="checkbox" checked={closeVaga} onChange={(e) => setCloseVaga(e.target.checked)} />
                  Encerrar esta vaga como preenchida
                </label>
              )}
            </div>
          )}

          {/* Upload de documento + preenchimento automático */}
          <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} style={{ color: "#7C3AED" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#5B21B6" }}>
                Documento (RG ou CNH){!initialData && <span style={{ color: "var(--danger)" }}> *</span>}
              </span>
            </div>
            <p style={{ fontSize: 11, color: "#5B21B6", marginBottom: 10, lineHeight: 1.5 }}>
              Envie uma foto ou PDF do documento — fica anexado direto no cadastro do funcionário. Também é útil para colaboradores que não sabem ler ou escrever: a IA tenta preencher nome, CPF, RG e nascimento a partir do arquivo (revise antes de salvar).
            </p>
            <label style={{
              display: "flex", alignItems: "center", gap: 10,
              border: `1px dashed ${fileError ? "var(--danger)" : "#C4B5FD"}`, borderRadius: 8,
              padding: "10px 12px", cursor: "pointer", background: "var(--surface)",
            }}>
              <Upload size={15} style={{ color: "#7C3AED", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: file ? "var(--text)" : "var(--text-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file ? file.name : "Selecionar foto ou PDF do documento…"}
              </span>
              {extracting && <Loader2 size={14} className="animate-spin" style={{ color: "#7C3AED", flexShrink: 0 }} />}
              {!extracting && extracted && <Check size={14} style={{ color: "var(--success)", flexShrink: 0 }} />}
              {!extracting && file && !extracted && <FileText size={14} style={{ color: "var(--text-dim)", flexShrink: 0 }} />}
              <input ref={fileInputRef} type="file" accept=".pdf,image/*" onChange={(e) => handleFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
            </label>
            <button
              type="button"
              onClick={() => setCaptureOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#7C3AED", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "6px 0 0" }}
            >
              <Camera size={12} /> Ou usar a câmera (com checagem automática de legibilidade)
            </button>
            {fileError && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{fileError}</div>}
            {!isConfigured && (
              <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 6 }}>
                Configure uma LLM (Anthropic) em Configurações → Integrações de IA para usar o preenchimento automático. O upload do documento continua funcionando normalmente.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Nome completo *</label>
                <input type="text" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} autoFocus />
              </div>
              <div>
                <label style={labelSt}>CPF</label>
                <input type="text" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>RG</label>
                <input type="text" value={form.rg} onChange={(e) => set("rg", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Nascimento</label>
                <input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Telefone</label>
                <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 99999-0000" className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>E-mail (opcional)</label>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Endereço</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Rua</label>
                <input type="text" value={form.addressStreet} onChange={(e) => set("addressStreet", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Número</label>
                <input type="text" value={form.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>CEP</label>
                <input type="text" value={form.addressZip} onChange={(e) => set("addressZip", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Bairro</label>
                <input type="text" value={form.addressNeighborhood} onChange={(e) => set("addressNeighborhood", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Cidade</label>
                <input type="text" value={form.addressCity} onChange={(e) => set("addressCity", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Estado</label>
                <input type="text" value={form.addressState} onChange={(e) => set("addressState", e.target.value)} maxLength={2} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Dados profissionais</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Cargo</label>
                <input type="text" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="Ex: Operador de produção" className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Frente *</label>
                <select value={form.frente} onChange={(e) => set("frente", e.target.value)} className={inputCls} style={inputSt}>
                  <option value="">Selecionar</option>
                  {RH_FRENTES.map((id) => <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Departamento</label>
                <select value={form.department} onChange={(e) => set("department", e.target.value)} className={inputCls} style={inputSt}>
                  <option value="">Selecionar</option>
                  {RH_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Tipo de contrato</label>
                <select value={form.contractType} onChange={(e) => set("contractType", e.target.value)} className={inputCls} style={inputSt}>
                  <option value="">Selecionar</option>
                  {RH_CONTRACT_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Data de admissão</label>
                <input type="date" value={form.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Status</label>
                <select value={form.employeeStatus} onChange={(e) => set("employeeStatus", e.target.value)} className={inputCls} style={inputSt}>
                  {RH_EMPLOYEE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Salário (R$)</label>
                <CurrencyInput prefix={null} value={form.salary} onChange={v => set("salary", v)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Vencimento do ASO</label>
                <input type="date" value={form.asoVencimento} onChange={(e) => set("asoVencimento", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Fim do contrato (se temporário)</label>
                <input type="date" value={form.contratoFim} onChange={(e) => set("contratoFim", e.target.value)} className={inputCls} style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>
            {(() => {
              const exp = periodoExperienciaInfo(form);
              return exp ? (
                <div style={{ background: "var(--warning-bg)", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "var(--warning)" }}>
                  Período de experiência CLT: marco de {exp.marco} dias em {exp.diasRestantes} dia(s).
                </div>
              ) : null;
            })()}
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "16px 0 0" }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : initialData ? "Salvar alterações" : "Cadastrar funcionário"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
    {captureOpen && (
      <DocumentCaptureModal
        onCapture={(f) => { setCaptureOpen(false); handleFile(f); }}
        onClose={() => setCaptureOpen(false)}
        title="Capturar documento (RG ou CNH)"
      />
    )}
    </>
  );
}

export default NovoColaboradorModal;
