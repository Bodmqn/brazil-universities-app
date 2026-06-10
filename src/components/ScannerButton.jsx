import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';

const API = '/.netlify/functions/gh-scan';

export default function ScannerButton({ onScanComplete }) {
  const { lang } = useLang();
  const [status, setStatus] = useState('idle');
  const [runId, setRunId] = useState(null);
  const [lastRun, setLastRun] = useState(() => localStorage.getItem('gh_last_scan'));

  useEffect(() => {
    if (!runId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status', runId }),
        });
        const data = await res.json();
        if (data.conclusion || data.status === 'completed') {
          setStatus('done');
          clearInterval(interval);
          const now = new Date().toISOString();
          localStorage.setItem('gh_last_scan', now);
          setLastRun(now);
          if (onScanComplete) onScanComplete();
        }
      } catch { /* ignore polling errors */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [runId, onScanComplete]);

  const triggerScan = async () => {
    setStatus('triggering');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger' }),
      });
      const data = await res.json();
      if (data.runId) {
        setStatus('running');
        setRunId(data.runId);
      } else {
        setStatus(data.error ? 'error' : 'done');
        if (data.error) alert(data.error);
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
      lastRun: 'Last run',
      now: 'just now',
    },
  };

  const labels = actionLabels[lang] || actionLabels.en;

  return (
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
