import { useState, useEffect, useRef } from 'react';

const API = '/.netlify/functions/gh-scan';

const STATUS_LABELS = {
  idle: 'Executar Scanner',
  triggering: 'Iniciando...',
  running: 'Escaneando sites dos programas...',
  done: 'Concluído!',
  error: 'Erro ao executar',
};

export default function ScannerButton({ year, onScanComplete }) {
  const [status, setStatus] = useState('idle');
  const [runId, setRunId] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastRun, setLastRun] = useState(() => localStorage.getItem('gh_last_scan'));
  const [lastResult, setLastResult] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (status === 'running') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      return () => clearInterval(timerRef.current);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [status]);

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
        if (data.conclusion === 'success' || data.status === 'completed') {
          setStatus('done');
          clearInterval(interval);
          const now = new Date().toISOString();
          localStorage.setItem('gh_last_scan', now);
          setLastRun(now);
          setLastResult({ success: true, message: 'Scanner finalizado. Dados atualizados.' });
          if (onScanComplete) onScanComplete();
        } else if (data.conclusion && data.conclusion !== 'success') {
          setStatus('error');
          clearInterval(interval);
          setLastResult({ success: false, message: `Scanner falhou: ${data.conclusion}` });
        }
      } catch { /* ignore polling errors */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [runId, onScanComplete]);

  const triggerScan = async () => {
    setStatus('triggering');
    setLastResult(null);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', year }),
      });
      const data = await res.json();
      if (data.runId) {
        setStatus('running');
        setElapsed(0);
        setRunId(data.runId);
      } else {
        setStatus('error');
        setLastResult({ success: false, message: data.error || 'Falha ao iniciar scanner' });
      }
    } catch (err) {
      setStatus('error');
      setLastResult({ success: false, message: 'Erro de rede: ' + err.message });
    }
  };

  function formatElapsed(secs) {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }

  return (
    <div className="scanner-trigger-wrap">
      <div className="scanner-trigger-row">
        <button
          onClick={triggerScan}
          disabled={status === 'triggering' || status === 'running'}
          className={`scanner-btn scanner-btn-run ${status === 'running' ? 'scanner-running' : ''}`}
        >
          {status === 'running' && <span className="scanner-spinner" />}
          {status === 'idle' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.4rem' }}>
              <path d="M21 12a9 9 0 11-6.219-8.56" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          )}
          {STATUS_LABELS[status] || STATUS_LABELS.idle}
        </button>
        {lastRun && status !== 'running' && (
          <span className="scanner-last-run">
            &#128337; &#218;ltima: {formatTimeAgo(lastRun)}
          </span>
        )}
      </div>
      {status === 'running' && (
        <div className="scanner-progress">
          <span className="scanner-progress-text">
            Verificando sites... ({formatElapsed(elapsed)})
          </span>
          <span className="scanner-progress-hint">
            Isso pode levar alguns minutos. N&#227;o feche esta p&#225;gina.
          </span>
        </div>
      )}
      {lastResult && (
        <div className={`scanner-result ${lastResult.success ? 'scanner-result-ok' : 'scanner-result-err'}`}>
          {lastResult.message}
        </div>
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
