import { useState, useEffect } from 'react';

const API = '/.netlify/functions/gh-scan';

export default function ScannerButton({ year, onScanComplete }) {
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
        body: JSON.stringify({ action: 'trigger', year }),
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

  const labels = {
    trigger: 'Executar Scanner',
    triggering: 'Iniciando...',
    running: 'Escaneando...',
    done: 'Concluído!',
    error: 'Erro',
    idle: 'Executar Scanner',
    lastRun: 'Última execução',
  };

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
          {labels.lastRun}: {formatTimeAgo(lastRun)}
        </span>
      )}
    </div>
  );
}

function formatTimeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}
