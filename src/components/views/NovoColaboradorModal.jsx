import React, { useCallback, useMemo, useRef, useState } from "react";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { X, Upload, FileText, Sparkles, Loader2, AlertCircle, Check, Camera, Trash2 } from "lucide-react";
import { RH_DEPARTMENTS, RH_CONTRACT_TYPES, RH_EMPLOYEE_STATUSES } from "../../constants/rh-config";
import { RH_FRENTES, RH_FRENTE_LABELS } from "../../constants/rh-frentes";
import { CurrencyInput } from "../ui/CurrencyInput";
import { supabase } from "../../lib/supabase";
import { formatPhone, formatCPF } from "../../utils/masks";
import { useAI } from "../../hooks/use-ai";
import { documentExtractionPrompt } from "../../constants/ai-prompts";
import { periodoExperienciaInfo } from "../../utils/rh-compliance-dates";
import { DocumentCaptureModal } from "../shared/DocumentCaptureModal";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useRHCargoTemplates } from "../../hooks/use-rh-cargo-templates";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { resolveVisibleFields, getMissingRequiredFields } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";

const DOC_BUCKET = "rh-documentos-colaborador";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// Estado (UF) era texto livre num formulário onde todo campo vizinho
// (Frente, Departamento, Tipo de contrato) é lista fixa — permitia "sp",
// "SP " ou nome por extenso. Achado da auditoria de fricção de 18/07.
const BR_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

const EMPTY_FORM = {
  fullName: "", cpf: "", rg: "", birthDate: "", phone: "", email: "",
  addressStreet: "", addressNumber: "", addressComplement: "", addressNeighborhood: "",
  addressCity: "", addressState: "", addressZip: "",
  jobTitle: "", department: "", frente: "", contractType: "", admissionDate: "",
  employeeStatus: "ativo", salary: "", asoVencimento: "", contratoFim: "",
  periodoExperienciaDias: "",
  aprendizInicio: "", aprendizFim: "",
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

export function NovoColaboradorModal({ currentUser, initialData, hireContext, contextNote, stageId, users, onSave, onClose, onDelete }) {
  const { complete, isConfigured, provider } = useAI(currentUser);
  const { cargos: cargoTemplates } = useRHCargoTemplates({ userId: currentUser?.id });
  const [form, setForm] = useState(() => initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM);
  // Cargo virou select ligado ao catálogo de Cargos & Salários (rh_cargo_templates)
  // — antes era texto livre, sem nenhuma relação com o catálogo (achado #6 do
  // roteiro de treinamento de RH, 31/07/2026). Filtra por departamento quando
  // já escolhido; sem departamento ainda, mostra o catálogo inteiro.
  const cargoOptions = useMemo(() => {
    const base = form.department
      ? cargoTemplates.filter((c) => !c.department || c.department === form.department)
      : cargoTemplates;
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
  }, [cargoTemplates, form.department]);
  // Campos da etapa de Onboarding (só quando criado via "+" de uma coluna do
  // Kanban) — mesmo mecanismo de campos customizados por etapa usado em
  // vaga/candidato/campanha. `stageId` ausente (fluxo de contratação via
  // Recrutamento, ou edição em Funcionários) simplesmente não renderiza nada.
  const onboardingStageFields = useRHStageFields("onboarding");
  const [customValues, setCustomValues] = useState({});
  const visibleCustomFields = stageId ? resolveVisibleFields(onboardingStageFields.getFields(stageId), customValues) : [];
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [invalidField, setInvalidField] = useState(null); // chave de `form`, "file", ou null
  const fileInputRef = useRef();
  const fieldRefs = useRef({});
  const registerField = (key) => (el) => { fieldRefs.current[key] = el; };

  // Guarda contra descarte acidental: fechar por clique-fora/ESC/Cancelar com
  // o formulário preenchido pede confirmação. Sem isso, um clique na área
  // escura apagava ~25 campos (e o re-upload + re-extração da IA) sem aviso.
  // Achado da 2ª auditoria.
  const initialSnapshotRef = useRef(JSON.stringify(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM));
  const stateRef = useRef({ form, file, customValues });
  stateRef.current = { form, file, customValues };
  const guardedClose = useCallback(() => {
    const dirty = JSON.stringify(stateRef.current.form) !== initialSnapshotRef.current
      || !!stateRef.current.file
      || Object.keys(stateRef.current.customValues).length > 0;
    if (dirty && !window.confirm("Descartar os dados preenchidos? As informações não salvas serão perdidas.")) return;
    onClose();
  }, [onClose]);

  // useEscToClose (pilha LIFO) em vez de listener próprio: com listener
  // solto no document, ESC dentro deste modal aberto POR CIMA de um drawer
  // fechava os dois de uma vez. O hook compartilhado só dispara o overlay do
  // topo e chama stopPropagation na captura.
  useEscToClose(guardedClose);

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (invalidField === key) setInvalidField(null); // limpa o destaque ao editar
  };

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

  // Todo o cadastro é obrigatório — dados pessoais e profissionais — exceto
  // os campos que só existem condicionalmente (período de experiência,
  // datas de aprendizagem, fim de contrato) e só valem pra quem se aplica.
  const REQUIRED_FIELDS = [
    ["fullName", "Nome completo"],
    ["cpf", "CPF"],
    ["rg", "RG"],
    ["birthDate", "Data de nascimento"],
    ["phone", "Telefone"],
    ["email", "E-mail"],
    ["addressStreet", "Rua"],
    ["addressNumber", "Número"],
    ["addressZip", "CEP"],
    ["addressNeighborhood", "Bairro"],
    ["addressCity", "Cidade"],
    ["addressState", "Estado"],
    ["jobTitle", "Cargo"],
    ["frente", "Frente"],
    ["department", "Departamento"],
    ["contractType", "Tipo de contrato"],
    ["admissionDate", "Data de admissão"],
    ["salary", "Salário"],
    ["asoVencimento", "Vencimento do ASO"],
  ];
  if (form.contractType === "clt") REQUIRED_FIELDS.push(["periodoExperienciaDias", "Dias de período de experiência"]);
  if (form.contractType === "aprendiz") {
    REQUIRED_FIELDS.push(["aprendizInicio", "Início do contrato de aprendizagem"]);
    REQUIRED_FIELDS.push(["aprendizFim", "Fim do contrato de aprendizagem"]);
  }
  if (form.contractType === "temporario") REQUIRED_FIELDS.push(["contratoFim", "Fim do contrato"]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validação inline: destaca o campo obrigatório inválido e leva o foco/
    // scroll até ele, em vez de só mostrar um banner longe do campo. Achado
    // da 2ª auditoria.
    const focusInvalid = (field) => {
      setInvalidField(field);
      const el = fieldRefs.current[field];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus?.();
    };
    for (const [key, label] of REQUIRED_FIELDS) {
      const val = form[key];
      const isEmpty = val == null || String(val).trim() === "";
      if (!isEmpty) continue;
      // Registro editado que já nasceu sem este campo (obrigatoriedade
      // adicionada depois que o cadastro existia, ex: "Frente") não trava
      // retroativamente uma edição pontual — exigir só vale pra cadastro
      // novo, ou se o campo já tinha valor e foi apagado agora. Achado da
      // auditoria de fricção de 18/07.
      const legacyMissing = initialData && (initialData[key] == null || String(initialData[key]).trim() === "");
      if (legacyMissing) continue;
      setError(`${label} é obrigatório.`);
      focusInvalid(key);
      return;
    }
    if (stageId) {
      const missingCustom = getMissingRequiredFields(visibleCustomFields, customValues);
      if (missingCustom.length > 0) {
        setError(`Preencha antes: ${missingCustom.map(f => f.label).join(", ")}.`);
        return;
      }
      const invalidCustom = getInvalidFields(visibleCustomFields, customValues);
      if (invalidCustom.length > 0) {
        setError(`Corrija antes: ${invalidCustom.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
        return;
      }
    }
    // Documento obrigatório só na criação — editar um colaborador legado sem
    // documento não deve ficar travado retroativamente.
    if (!initialData && !file) {
      setError("Anexe uma foto ou PDF do RG/CNH antes de cadastrar.");
      setInvalidField("file");
      fileInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setInvalidField(null);
    setSaving(true);
    setError(null);
    try {
      const stageExtras = stageId
        ? { onboardingStage: stageId, onboardingStageChangedAt: new Date().toISOString(), customFields: customValues }
        : {};
      const payload = { ...form, ...stageExtras };
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
        const { data: linkData, error: updateErr } = await supabase.from("rh_colaboradores").update({ document_type: documentType, document_path: path }).eq("id", targetId).select();
        if (updateErr) throw new Error(`Funcionário salvo e documento enviado, mas o cadastro não foi vinculado ao arquivo (${updateErr.message}).`);
        // Zero linha = RLS barrou o UPDATE (volta error:null/data:[]) — sem
        // esta checagem o arquivo ficava no Storage órfão, sem vínculo, e a
        // tela fechava como se tivesse dado tudo certo.
        if (!linkData || linkData.length === 0) {
          throw new Error("Funcionário salvo e documento enviado, mas o cadastro não foi vinculado ao arquivo — verifique suas permissões e anexe de novo editando o cadastro.");
        }
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
  const fieldSt = (key) => (invalidField === key ? { ...inputSt, borderColor: "var(--danger)" } : inputSt);

  return (
    <>
    <div
      style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 620, boxShadow: "var(--shadow-pop)", maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>{initialData ? "Editar Funcionário" : "Novo Funcionário"}</div>
          <button onClick={guardedClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          {contextNote && !hireContext && (
            <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>
              {contextNote}
            </div>
          )}
          {hireContext && (
            <div style={{ background: "var(--success-bg)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 6 }}>
                Convertendo candidato aprovado{hireContext.vagaTitle ? ` — vaga "${hireContext.vagaTitle}"` : ""}
              </div>
              {hireContext.vagaId && (
                <div style={{ fontSize: 12, color: "var(--success)" }}>
                  Esta vaga será encerrada automaticamente como preenchida.
                </div>
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
                Configure uma LLM (Anthropic) em Configurações → Integrações para usar o preenchimento automático. O upload do documento continua funcionando normalmente.
              </div>
            )}
            {isConfigured && provider !== "anthropic" && (
              <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 6 }}>
                O preenchimento automático por leitura do documento só funciona com o provedor Anthropic — a chave configurada ({provider || "provedor desconhecido"}) não lê imagens/PDF. O upload do documento continua funcionando normalmente.
              </div>
            )}
          </div>

          <style>{`
            @media (max-width: 640px) {
              .ncm-responsive-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
          <div className="flex flex-col gap-3">
            <div className="ncm-responsive-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Nome completo *</label>
                <input ref={registerField("fullName")} type="text" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls} style={fieldSt("fullName")} onFocus={focusBlue} onBlur={blurGray} autoFocus />
              </div>
              <div>
                <label style={labelSt}>CPF *</label>
                <input ref={registerField("cpf")} type="text" value={form.cpf} onChange={(e) => set("cpf", formatCPF(e.target.value))} placeholder="000.000.000-00" className={inputCls} style={fieldSt("cpf")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>RG *</label>
                <input ref={registerField("rg")} type="text" value={form.rg} onChange={(e) => set("rg", e.target.value)} className={inputCls} style={fieldSt("rg")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>

            <div className="ncm-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Nascimento *</label>
                <input ref={registerField("birthDate")} type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} className={inputCls} style={fieldSt("birthDate")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Telefone *</label>
                <input ref={registerField("phone")} type="tel" value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="(11) 99999-0000" className={inputCls} style={fieldSt("phone")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>E-mail *</label>
                <input ref={registerField("email")} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} style={fieldSt("email")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Endereço</div>
            <div className="ncm-responsive-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Rua *</label>
                <input ref={registerField("addressStreet")} type="text" value={form.addressStreet} onChange={(e) => set("addressStreet", e.target.value)} className={inputCls} style={fieldSt("addressStreet")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Número *</label>
                <input ref={registerField("addressNumber")} type="text" value={form.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} className={inputCls} style={fieldSt("addressNumber")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>CEP *</label>
                <input ref={registerField("addressZip")} type="text" value={form.addressZip} onChange={(e) => set("addressZip", e.target.value)} className={inputCls} style={fieldSt("addressZip")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>
            <div className="ncm-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Bairro *</label>
                <input ref={registerField("addressNeighborhood")} type="text" value={form.addressNeighborhood} onChange={(e) => set("addressNeighborhood", e.target.value)} className={inputCls} style={fieldSt("addressNeighborhood")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Cidade *</label>
                <input ref={registerField("addressCity")} type="text" value={form.addressCity} onChange={(e) => set("addressCity", e.target.value)} className={inputCls} style={fieldSt("addressCity")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Estado *</label>
                <select ref={registerField("addressState")} value={form.addressState} onChange={(e) => set("addressState", e.target.value)} className={inputCls} style={fieldSt("addressState")} onFocus={focusBlue} onBlur={blurGray}>
                  <option value="">Selecionar</option>
                  {BR_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Dados profissionais</div>
            <div className="ncm-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Cargo *</label>
                <select ref={registerField("jobTitle")} value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} className={inputCls} style={fieldSt("jobTitle")}>
                  <option value="">Selecionar</option>
                  {form.jobTitle && !cargoOptions.some((c) => c.name === form.jobTitle) && (
                    <option value={form.jobTitle}>{form.jobTitle} (fora do catálogo)</option>
                  )}
                  {cargoOptions.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                {cargoOptions.length === 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                    Nenhum cargo cadastrado ainda — crie um em Cargos &amp; Salários primeiro.
                  </div>
                )}
              </div>
              <div>
                <label style={labelSt}>Frente *</label>
                <select ref={registerField("frente")} value={form.frente} onChange={(e) => set("frente", e.target.value)} className={inputCls} style={fieldSt("frente")}>
                  <option value="">Selecionar</option>
                  {RH_FRENTES.map((id) => <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Departamento *</label>
                <select ref={registerField("department")} value={form.department} onChange={(e) => set("department", e.target.value)} className={inputCls} style={fieldSt("department")}>
                  <option value="">Selecionar</option>
                  {RH_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Tipo de contrato *</label>
                <select ref={registerField("contractType")} value={form.contractType} onChange={(e) => set("contractType", e.target.value)} className={inputCls} style={fieldSt("contractType")}>
                  <option value="">Selecionar</option>
                  {RH_CONTRACT_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Data de admissão *</label>
                <input ref={registerField("admissionDate")} type="date" value={form.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} className={inputCls} style={fieldSt("admissionDate")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              {form.contractType === "clt" && (
                <div>
                  <label style={labelSt}>Dias de período de experiência *</label>
                  <input
                    ref={registerField("periodoExperienciaDias")}
                    type="number"
                    min={1}
                    placeholder="90"
                    value={form.periodoExperienciaDias}
                    onChange={(e) => set("periodoExperienciaDias", e.target.value)}
                    className={inputCls}
                    style={fieldSt("periodoExperienciaDias")}
                    onFocus={focusBlue}
                    onBlur={blurGray}
                  />
                </div>
              )}
              {/* Jovem Aprendiz (Áudio 6): datas do contrato de aprendizagem.
                  O fim alimenta o lembrete de reposição ~2 meses antes. */}
              {form.contractType === "aprendiz" && (
                <>
                  <div>
                    <label style={labelSt}>Início do contrato de aprendizagem *</label>
                    <input ref={registerField("aprendizInicio")} type="date" value={form.aprendizInicio} onChange={(e) => set("aprendizInicio", e.target.value)} className={inputCls} style={fieldSt("aprendizInicio")} onFocus={focusBlue} onBlur={blurGray} />
                  </div>
                  <div>
                    <label style={labelSt}>Fim do contrato de aprendizagem *</label>
                    <input ref={registerField("aprendizFim")} type="date" value={form.aprendizFim} onChange={(e) => set("aprendizFim", e.target.value)} className={inputCls} style={fieldSt("aprendizFim")} onFocus={focusBlue} onBlur={blurGray} />
                  </div>
                </>
              )}
              <div>
                <label style={labelSt}>Status</label>
                <select value={form.employeeStatus} onChange={(e) => set("employeeStatus", e.target.value)} className={inputCls} style={inputSt}>
                  {RH_EMPLOYEE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Salário (R$) *</label>
                <CurrencyInput prefix={null} value={form.salary} onChange={v => set("salary", v)} className={inputCls} style={fieldSt("salary")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Vencimento do ASO *</label>
                <input ref={registerField("asoVencimento")} type="date" value={form.asoVencimento} onChange={(e) => set("asoVencimento", e.target.value)} className={inputCls} style={fieldSt("asoVencimento")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              {form.contractType === "temporario" && (
                <div>
                  <label style={labelSt}>Fim do contrato *</label>
                  <input ref={registerField("contratoFim")} type="date" value={form.contratoFim} onChange={(e) => set("contratoFim", e.target.value)} className={inputCls} style={fieldSt("contratoFim")} onFocus={focusBlue} onBlur={blurGray} />
                </div>
              )}
            </div>
            {(() => {
              const exp = periodoExperienciaInfo(form);
              if (!exp) return null;
              const custom = Number(form.periodoExperienciaDias) > 0;
              return (
                <div style={{ background: "var(--warning-bg)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "var(--warning)" }}>
                  {custom
                    ? `Período de experiência: ${exp.marco} dias — termina em ${exp.diasRestantes} dia(s).`
                    : `Período de experiência CLT (padrão): marco de ${exp.marco} dias em ${exp.diasRestantes} dia(s). Informe "Dias de período de experiência" acima pra usar um valor diferente do padrão.`}
                </div>
              );
            })()}

            {stageId && visibleCustomFields.length > 0 && (
              <div style={{ marginTop: 4, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Campos desta etapa
                </div>
                <div className="flex flex-col gap-3">
                  {visibleCustomFields.map((f) => (
                    <div key={f.id}>
                      <label style={labelSt}>
                        {f.effectiveRequired && <span style={{ color: "var(--danger)", marginRight: 2 }}>*</span>}
                        {f.label}
                      </label>
                      <RHStageFieldInput
                        field={f}
                        value={customValues[f.fieldKey]}
                        onChange={(val) => setCustomValues((prev) => ({ ...prev, [f.fieldKey]: val }))}
                        users={users}
                        touched={Boolean(error)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "16px 0 0" }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : initialData ? "Salvar alterações" : "Cadastrar funcionário"}
            </button>
            <button type="button" onClick={guardedClose} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
            {initialData && onDelete && (
              <button type="button" onClick={onDelete} title="Excluir funcionário" style={{ padding: "10px 12px", borderRadius: 10, fontSize: 13, border: "none", background: "var(--danger-bg)", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <Trash2 size={14} />
              </button>
            )}
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
