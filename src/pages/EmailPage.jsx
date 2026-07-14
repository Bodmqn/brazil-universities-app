import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePrograms } from '../hooks/usePrograms';
import emailTemplates from '../data/email-templates.json';

function flattenPrograms(data) {
  const programs = [];
  for (const region of data || []) {
    for (const state of region.states || []) {
      for (const uni of state.universities || []) {
        for (let idx = 0; idx < (uni.programs || []).length; idx++) {
          const prog = uni.programs[idx];
          programs.push({
            region: region.name,
            state: state.name,
            university: uni.name,
            acronym: uni.acronym,
            program: prog.program,
            level: prog.level,
            city: prog.city,
            programIdx: idx,
            uniKey: uni.acronym || uni.name,
          });
        }
      }
    }
  }
  return programs;
}

function fillTemplate(template, vars) {
  let result = template;

  result = result.replace(/\{\{#hasProfessor\}\}([\s\S]*?)\{\{\/hasProfessor\}\}/g,
    vars.professorName ? '$1' : '');
  result = result.replace(/\{\{#researchInterest\}\}([\s\S]*?)\{\{\/researchInterest\}\}/g,
    vars.researchInterest ? '$1' : '');

  for (const [key, val] of Object.entries(vars)) {
    if (typeof val === 'boolean') continue;
    result = result.replaceAll(`{{${key}}}`, val || '');
  }

  return result;
}

export default function EmailPage() {
  const { data, loading, error } = usePrograms();
  const [selectedProgram, setSelectedProgram] = useState('');
  const [studentName, setStudentName] = useState('');
  const [institution, setInstitution] = useState('');
  const [country, setCountry] = useState('');
  const [researchInterest, setResearchInterest] = useState('');
  const [hasProfessor, setHasProfessor] = useState(false);
  const [professorName, setProfessorName] = useState('');
  const [templateLang, setTemplateLang] = useState('pt');
  const [generated, setGenerated] = useState(null);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef(null);

  const allPrograms = useMemo(() => flattenPrograms(data), [data]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredPrograms = useMemo(() => {
    if (!searchQuery) return allPrograms.slice(0, 50);
    const q = searchQuery.toLowerCase();
    return allPrograms.filter(p =>
      p.program.toLowerCase().includes(q) ||
      p.university.toLowerCase().includes(q) ||
      p.acronym.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [allPrograms, searchQuery]);

  const selectedProg = useMemo(() => {
    if (!selectedProgram) return null;
    return allPrograms.find(p =>
      `${p.uniKey}-${p.programIdx}` === selectedProgram
    );
  }, [allPrograms, selectedProgram]);

  function handleGenerate() {
    if (!selectedProg) return;
    const template = emailTemplates.templates[templateLang];
    const vars = {
      studentName: studentName || '[Seu nome]',
      institution: institution || '[Sua institui\u00e7\u00e3o]',
      country: country || '[Seu pa\u00eds]',
      universityName: selectedProg.university,
      programName: selectedProg.program,
      professorName: hasProfessor ? (professorName || '[Nome do professor]') : 'Respons\u00e1vel pelo Programa',
      researchInterest,
      hasProfessor,
    };

    const subject = fillTemplate(template.subject, vars);
    const body = fillTemplate(template.body, vars);

    setGenerated({ subject, body, lang: template.label });
  }

  async function handleCopy() {
    if (!generated) return;
    const text = `Assunto: ${generated.subject}\n\n${generated.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  return (
    <div className="email-page">
      <div className="breadcrumb">
        <Link to="/">In&#237;cio</Link>
        <span> / </span>
        <span>Gerador de Email</span>
      </div>

      <h2 className="page-title">Gerador de Email para Professores</h2>
      <p className="page-subtitle">
        Gere um email profissional para entrar em contato com orientadores de programas de p\u00f3s-gradua\u00e7\u00e3o
      </p>

      <div className="email-layout">
        <div className="email-form">
          <div className="wizard-section">
            <h3 className="wizard-section-title">Programa Alvo</h3>
            <div className="email-program-search">
              <input
                type="text"
                placeholder="Buscar programa ou universidade..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                className="email-search-input"
              />
              {showDropdown && filteredPrograms.length > 0 && (
                <div className="email-dropdown">
                  {filteredPrograms.map((p, idx) => (
                    <div
                      key={idx}
                      className={`email-dropdown-item ${selectedProgram === `${p.uniKey}-${p.programIdx}` ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedProgram(`${p.uniKey}-${p.programIdx}`);
                        setSearchQuery(`${p.acronym} - ${p.program}`);
                        setShowDropdown(false);
                      }}
                    >
                      <strong translate="no">{p.acronym}</strong>
                      <span>{p.program}</span>
                      <span className="email-dropdown-meta">{p.level} \u00b7 {p.city}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="wizard-section">
            <h3 className="wizard-section-title">Suas Informa\u00e7\u00f5es</h3>
            <div className="email-inputs">
              <div className="email-field">
                <label>Seu nome *</label>
                <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Maria Silva" />
              </div>
              <div className="email-field">
                <label>Institui\u00e7\u00e3o</label>
                <input type="text" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Universidade de ..." />
              </div>
              <div className="email-field">
                <label>Pa\u00eds</label>
                <input type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="Brasil" />
              </div>
              <div className="email-field">
                <label>\u00c1rea de pesquisa</label>
                <input type="text" value={researchInterest} onChange={e => setResearchInterest(e.target.value)} placeholder="Ci\u00eancias da Computa\u00e7\u00e3o, Educa\u00e7\u00e3o, ..." />
              </div>
              <div className="email-field email-field-check">
                <label>
                  <input type="checkbox" checked={hasProfessor} onChange={e => setHasProfessor(e.target.checked)} />
                  Tenho orientador em mente
                </label>
              </div>
              {hasProfessor && (
                <div className="email-field">
                  <label>Nome do orientador</label>
                  <input type="text" value={professorName} onChange={e => setProfessorName(e.target.value)} placeholder="Prof. Dr. ..." />
                </div>
              )}
            </div>
          </div>

          <div className="wizard-section">
            <h3 className="wizard-section-title">Idioma do Email</h3>
            <div className="email-lang-options">
              {Object.entries(emailTemplates.templates).map(([key, tmpl]) => (
                <label key={key} className={`email-lang-btn ${templateLang === key ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="templateLang"
                    value={key}
                    checked={templateLang === key}
                    onChange={() => setTemplateLang(key)}
                  />
                  {tmpl.label}
                </label>
              ))}
            </div>
          </div>

          <button
            className="wizard-submit"
            onClick={handleGenerate}
            disabled={!selectedProg || !studentName}
          >
            Gerar Email
          </button>
        </div>

        {generated && (
          <div className="email-preview" ref={previewRef}>
            <div className="email-preview-header">
              <h3>Email Gerado \u2014 {generated.lang}</h3>
              <button className={`email-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                {copied ? '\u2713 Copiado!' : 'Copiar'}
              </button>
            </div>
            <div className="email-preview-subject">
              <strong>Assunto:</strong> {generated.subject}
            </div>
            <pre className="email-preview-body">{generated.body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
