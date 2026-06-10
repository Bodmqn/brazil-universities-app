import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';

const REPO = 'Bodmqn/brazil-universities-app';
const WORKFLOW = 'scan-editais.yml';
const STORAGE_KEY = 'gh_scanner_token';

export default function ScannerButton({ onScanComplete }) {
  const { lang } = useLang();
  const [status, setStatus] = useState('idle');
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [showTokenInput, setShowTokenInput] = useState(!token);
  const [inputToken, setInputToken] = useState(token);
  const [runId, setRunId] = useState(null);
  const [lastRun, setLastRun] = useState(() => localStorage.getItem('gh_last_scan'));

  useEffect(() => {
    if (!runId || !token) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/actions/runs/${runId}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
        );
        const data = await res.json();
        if (data.conclusion) {
          setStatus('done');
          clearInterval(interval);
          const now = new Date().toISOString();
          localStorage.setItem('gh_last_scan', now);
          setLastRun(now);
          if (onScanComplete) onScanComplete();
        } else if (data.status === 'completed') {
          setStatus('done');
          clearInterval(interval);
        }
      } catch { /* ignore polling errors */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [runId, token, onScanComplete]);

  const saveToken = () => {
    const trimmed = inputToken.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setToken(trimmed);
    setShowTokenInput(false);
  };

  const clearToken = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken('');
    setInputToken('');
    setShowTokenInput(true);
  };

  const triggerScan = async () => {
    if (!token) {
      setShowTokenInput(true);
      return;
    }
    setStatus('triggering');
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      );
      if (res.status === 204) {
        setStatus('running');
        const runsRes = await fetch(
          `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1&branch=main`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
        );
        const runsData = await runsRes.json();
        if (runsData.workflow_runs?.length > 0) {
          setRunId(runsData.workflow_runs[0].id);
        } else {
          setStatus('done');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatus('error');
        alert(errData.message || `Error ${res.status}: failed to trigger scan`);
      }
    } catch (err) {
      setStatus('error');
      alert('Network error: ' + err.message);
    }
  };

  const actionLabels = {
    pt: {
      trigger: 'Executar Scanner',
      triggering: 'Iniciando...',
      running: 'Escaneando...',
      done: 'Concluído!',
      error: 'Erro',
      idle: 'Executar Scanner',
      tokenPlaceholder: 'Cole seu token GitHub aqui',
      save: 'Salvar Token',
      clear: 'Remover Token',
      lastRun: 'Última execução',
      now: 'agora mesmo',
    },
    en: {
      trigger: 'Run Scanner',
      triggering: 'Starting...',
      running: 'Scanning...',
      done: 'Complete!',
      error: 'Error',
      idle: 'Run Scanner',
      tokenPlaceholder: 'Paste your GitHub token here',
      save: 'Save Token',
      clear: 'Remove Token',
      lastRun: 'Last run',
      now: 'just now',
    },
  };

  const labels = actionLabels[lang] || actionLabels.en;

  return (
    <div className="scanner-controls">
      {showTokenInput ? (
        <div className="scanner-token-input">
          <input
            type="password"
            value={inputToken}
            onChange={e => setInputToken(e.target.value)}
            placeholder={labels.tokenPlaceholder}
            className="scanner-token-field"
          />
          <button onClick={saveToken} className="scanner-btn scanner-btn-save" disabled={!inputToken.trim()}>
            {labels.save}
          </button>
          {token && (
            <button onClick={() => { setShowTokenInput(false); setInputToken(token); }} className="scanner-btn scanner-btn-cancel">
              {lang === 'pt' ? 'Cancelar' : 'Cancel'}
            </button>
          )}
        </div>
      ) : (
        <div className="scanner-toolbar">
          <button
            onClick={triggerScan}
            disabled={status === 'triggering' || status === 'running'}
            className="scanner-btn scanner-btn-run"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.4rem' }}>
              <polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none" />
            </svg>
            {status === 'triggering' ? labels.triggering : status === 'running' ? labels.running : labels[status] || labels.idle}
            {status === 'running' && <span className="scanner-spinner" />}
          </button>
          {lastRun && (
            <span className="scanner-last-run">
              {labels.lastRun}: {formatTimeAgo(lastRun, lang)}
            </span>
          )}
          <button onClick={clearToken} className="scanner-btn scanner-btn-ghost" title={labels.clear}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.5 17.5l-11-11M6.5 17.5l11-11" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(iso, lang) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'pt' ? 'agora mesmo' : 'just now';
  if (mins < 60) return lang === 'pt' ? `há ${mins} min` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return lang === 'pt' ? `há ${hours}h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === 'pt' ? `há ${days}d` : `${days}d ago`;
}
