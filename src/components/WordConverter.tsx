import React, { useState, useRef } from 'react';
import { FileText, ArrowDownToLine, Loader2 } from 'lucide-react';

const SERVER_URL = 'http://localhost:7878/convert';

type Status = 'idle' | 'converting' | 'done' | 'error';

export default function WordConverter() {
  const [file, setFile]         = useState<File | null>(null);
  const [status, setStatus]     = useState<Status>('idle');
  const [pdfUrl, setPdfUrl]     = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isDrag, setIsDrag]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File picked ────────────────────────────────────────────────────────────
  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.name.match(/\.docx?$/i)) {
      setErrorMsg('Sirf .docx ya .doc file upload karein');
      setStatus('error');
      return;
    }
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setFile(f);
    setPdfUrl('');
    setStatus('idle');
    setErrorMsg('');
  };

  // ── Convert ────────────────────────────────────────────────────────────────
  const convert = async () => {
    if (!file) return;
    setStatus('converting');
    setErrorMsg('');

    try {
      const res = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server error ${res.status}`);
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      setPdfUrl(url);
      setStatus('done');
    } catch (err: any) {
      setErrorMsg(
        err.message?.includes('fetch') || err.message?.includes('Failed')
          ? 'Server nahi mila.\nTerminal mein chalao:\n  python3 docx_server.py'
          : err.message
      );
      setStatus('error');
    }
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const download = () => {
    if (!pdfUrl || !file) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = file.name.replace(/\.docx?$/i, '.pdf');
    a.click();
  };

  const baseName = file?.name.replace(/\.docx?$/i, '') ?? '';

  return (
    <div style={styles.root}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <FileText size={16} color="#e2b96f" />
          <span style={{ color: '#e2b96f', fontWeight: 700, letterSpacing: 1 }}>
            DOCX → PDF
          </span>
        </div>

        {/* Drop zone */}
        <div
          style={{
            ...styles.dropzone,
            borderColor: isDrag ? '#e2b96f' : file ? '#3a7bd5' : '#2d4a7a',
            background:  isDrag ? '#1a2f4a' : '#0d1b2a',
          }}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
          onDragLeave={() => setIsDrag(false)}
          onDrop={e => { e.preventDefault(); setIsDrag(false); pickFile(e.dataTransfer.files[0]); }}
        >
          <span style={{ fontSize: 32 }}>📂</span>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: file ? '#e2b96f' : '#7b8fb5',
            textAlign: 'center',
            wordBreak: 'break-all'
          }}>
            {file ? file.name : 'Click ya drag karein'}
          </span>
          <span style={{ fontSize: 11, color: '#4a5568' }}>.docx / .doc</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.doc"
          style={{ display: 'none' }}
          onChange={e => pickFile(e.target.files?.[0])}
        />

        {/* Status messages */}
        {status === 'error' && (
          <div style={styles.errorBox}>
            <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap' }}>⚠️ {errorMsg}</pre>
          </div>
        )}

        {status === 'done' && (
          <div style={styles.successBox}>
            ✅ {baseName}.pdf ready!
          </div>
        )}

        {/* Convert button */}
        <button
          onClick={convert}
          disabled={!file || status === 'converting'}
          style={{
            ...styles.btn,
            background: (!file || status === 'converting')
              ? '#1e2d40'
              : 'linear-gradient(135deg,#3a7bd5,#2563a8)',
            color: (!file || status === 'converting') ? '#4a5568' : '#fff',
            cursor: (!file || status === 'converting') ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'converting'
            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Converting…</>
            : 'Convert to PDF'
          }
        </button>

        {/* Download button */}
        <button
          onClick={download}
          disabled={status !== 'done'}
          style={{
            ...styles.btn,
            background: status === 'done'
              ? 'linear-gradient(135deg,#e2b96f,#c9953a)'
              : '#1e2d40',
            color: status === 'done' ? '#1a1a2e' : '#4a5568',
            cursor: status === 'done' ? 'pointer' : 'not-allowed',
            fontWeight: 700,
          }}
        >
          <ArrowDownToLine size={16} />
          Download PDF
        </button>

        {/* Server instructions */}
        <div style={styles.instructions}>
          <div style={{ color: '#7b8fb5', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
            Pehle server chalayein:
          </div>
          <code style={styles.code}>python3 docx_server.py</code>
          <div style={{ color: '#4a5568', fontSize: 10, marginTop: 6 }}>
            Port 7878 par chalega
          </div>
        </div>
      </div>

      {/* ── PDF Preview ──────────────────────────────────────────────────── */}
      <div style={styles.previewArea}>
        {status !== 'done' ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: 64, opacity: 0.2 }}>📄</span>
            <span style={{ color: '#4a5568', fontSize: 15, fontWeight: 600 }}>
              {status === 'converting'
                ? '⏳ Converting… please wait'
                : 'Upload karein → Convert dabayein'}
            </span>
            <span style={{ color: '#2d3748', fontSize: 12 }}>
              PDF exactly same hogi — same fonts, same images, same layout
            </span>
          </div>
        ) : (
          <iframe
            src={`${pdfUrl}#toolbar=0`}
            style={styles.iframe}
            title="PDF Preview"
          />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#0d1117',
    color: '#cdd6f4',
    overflow: 'hidden',
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: '#161b22',
    borderRight: '1px solid #21262d',
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    gap: 12,
    overflowY: 'auto',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottom: '1px solid #21262d',
  },
  dropzone: {
    border: '2px dashed',
    borderRadius: 10,
    padding: '20px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 0',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    transition: 'opacity 0.2s',
  },
  errorBox: {
    background: '#2d1b1b',
    border: '1px solid #7f1d1d',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#fca5a5',
  },
  successBox: {
    background: '#1a2d1a',
    border: '1px solid #166534',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#86efac',
    fontSize: 12,
  },
  instructions: {
    marginTop: 'auto',
    background: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: 8,
    padding: 12,
  },
  code: {
    display: 'block',
    background: '#21262d',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 11,
    color: '#e2b96f',
    fontFamily: 'monospace',
  },
  previewArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iframe: {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
  },
};
