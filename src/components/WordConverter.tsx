import React, { useState, useRef } from 'react';
import { mammoth, XLSX, jsPDF, html2canvas } from '../utils/pdfUtils';
import { GoogleGenAI, Type } from '@google/genai';

/* ─────────────────────────── ICONS (inline SVG) ─────────────────────────── */
const IconFile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'1em',height:'1em'}}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IconTable = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'1em',height:'1em'}}>
    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);
const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:'1em',height:'1em'}}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'1em',height:'1em'}}>
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const IconDoc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:'1em',height:'1em'}}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);

/* ─────────────────────────── STYLES ─────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-void: #04050a;
    --bg-deep: #080c14;
    --bg-panel: rgba(10, 14, 26, 0.85);
    --bg-card: rgba(255,255,255,0.04);
    --bg-card-hover: rgba(255,255,255,0.07);
    --border: rgba(255,255,255,0.08);
    --border-bright: rgba(255,255,255,0.15);
    --gold: #f5c842;
    --gold-dim: rgba(245,200,66,0.18);
    --gold-glow: rgba(245,200,66,0.35);
    --emerald: #22d98a;
    --emerald-dim: rgba(34,217,138,0.18);
    --emerald-glow: rgba(34,217,138,0.35);
    --text-primary: rgba(255,255,255,0.92);
    --text-secondary: rgba(255,255,255,0.5);
    --text-muted: rgba(255,255,255,0.28);
    --radius: 16px;
    --radius-sm: 10px;
    --shadow-deep: 0 32px 80px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4);
    --shadow-card: 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
    --font-head: 'Syne', sans-serif;
    --font-mono: 'DM Mono', monospace;
    --transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
  }

  .wc-root {
    font-family: var(--font-head);
    background: var(--bg-void);
    color: var(--text-primary);
    display: flex;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  /* ── Animated background ── */
  .wc-bg {
    position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0;
  }
  .wc-bg::before {
    content: '';
    position: absolute;
    width: 900px; height: 900px;
    background: radial-gradient(circle, rgba(245,200,66,0.06) 0%, transparent 65%);
    top: -300px; left: -200px;
    animation: bgPulse 8s ease-in-out infinite alternate;
  }
  .wc-bg::after {
    content: '';
    position: absolute;
    width: 700px; height: 700px;
    background: radial-gradient(circle, rgba(34,217,138,0.05) 0%, transparent 65%);
    bottom: -200px; right: -100px;
    animation: bgPulse 10s ease-in-out infinite alternate-reverse;
  }
  @keyframes bgPulse {
    from { opacity: 0.6; transform: scale(1); }
    to   { opacity: 1;   transform: scale(1.12); }
  }

  /* Grid lines */
  .wc-grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
  }

  /* ─── SIDEBAR ─── */
  .wc-sidebar {
    position: relative; z-index: 10;
    width: 300px; flex-shrink: 0;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    overflow-y: auto;
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
  }
  .wc-sidebar::-webkit-scrollbar { width: 4px; }
  .wc-sidebar::-webkit-scrollbar-track { background: transparent; }
  .wc-sidebar::-webkit-scrollbar-thumb { background: var(--border-bright); border-radius: 9999px; }

  /* Logo header */
  .wc-logo {
    padding: 22px 24px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 12px;
  }
  .wc-logo-icon {
    width: 38px; height: 38px;
    background: linear-gradient(135deg, #f5c842, #e6a800);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
    box-shadow: 0 4px 16px rgba(245,200,66,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
    flex-shrink: 0;
  }
  .wc-logo-text { line-height: 1.2; }
  .wc-logo-title { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary); }
  .wc-logo-sub { font-size: 10px; font-weight: 500; color: var(--text-muted); letter-spacing: 0.06em; text-transform: uppercase; font-family: var(--font-mono); margin-top: 1px; }

  /* Upload zone */
  .wc-section { padding: 20px 20px; border-bottom: 1px solid var(--border); }

  .wc-drop {
    position: relative;
    border: 1.5px dashed var(--border-bright);
    border-radius: var(--radius);
    padding: 28px 16px;
    text-align: center;
    cursor: pointer;
    transition: var(--transition);
    background: var(--bg-card);
    overflow: hidden;
  }
  .wc-drop::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, transparent 60%, rgba(245,200,66,0.04));
    pointer-events: none;
  }
  .wc-drop:hover {
    border-color: var(--gold);
    background: var(--gold-dim);
    transform: translateY(-1px);
    box-shadow: 0 8px 32px rgba(245,200,66,0.12);
  }
  .wc-drop.dragging {
    border-color: var(--gold);
    background: var(--gold-dim);
    box-shadow: 0 0 0 4px rgba(245,200,66,0.12), 0 8px 32px rgba(245,200,66,0.2);
    transform: scale(1.01);
  }
  .wc-drop-icon {
    font-size: 28px;
    color: var(--text-muted);
    margin-bottom: 10px;
    display: block;
    transition: var(--transition);
  }
  .wc-drop:hover .wc-drop-icon, .wc-drop.dragging .wc-drop-icon {
    color: var(--gold);
    transform: translateY(-3px);
  }
  .wc-drop-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
  .wc-drop-sub { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }

  .wc-file-badge {
    display: flex; align-items: center; gap: 8px;
    background: var(--gold-dim);
    border: 1px solid rgba(245,200,66,0.25);
    border-radius: 8px;
    padding: 8px 12px;
    margin-top: 12px;
  }
  .wc-file-badge-icon { color: var(--gold); flex-shrink: 0; }
  .wc-file-badge-name { font-size: 11px; font-weight: 600; color: var(--gold); font-family: var(--font-mono); truncate: true; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Section label */
  .wc-label {
    font-size: 9px; font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.12em;
    font-family: var(--font-mono);
    margin-bottom: 12px;
    display: flex; align-items: center; gap: 8px;
  }
  .wc-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* Mode toggle */
  .wc-mode-toggle {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .wc-mode-btn {
    display: flex; align-items: center; justify-content: center; gap: 7px;
    padding: 10px 8px;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 12px; font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    font-family: var(--font-head);
    letter-spacing: -0.01em;
  }
  .wc-mode-btn:hover { border-color: var(--border-bright); color: var(--text-secondary); background: var(--bg-card); }
  .wc-mode-btn.pdf-active {
    border-color: var(--gold);
    background: var(--gold-dim);
    color: var(--gold);
    box-shadow: 0 0 0 3px rgba(245,200,66,0.08), inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .wc-mode-btn.excel-active {
    border-color: var(--emerald);
    background: var(--emerald-dim);
    color: var(--emerald);
    box-shadow: 0 0 0 3px rgba(34,217,138,0.08), inset 0 1px 0 rgba(255,255,255,0.06);
  }

  /* Settings */
  .wc-field { margin-bottom: 14px; }
  .wc-field-label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-mono); margin-bottom: 6px; }
  .wc-select, .wc-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 12px; font-weight: 500;
    color: var(--text-primary);
    outline: none;
    transition: var(--transition);
    font-family: var(--font-head);
    appearance: none;
    -webkit-appearance: none;
  }
  .wc-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 14px; padding-right: 32px; cursor: pointer; }
  .wc-select option { background: #0e1220; color: var(--text-primary); }
  .wc-select:focus, .wc-input:focus { border-color: var(--border-bright); background: rgba(255,255,255,0.07); }
  .pdf-mode .wc-select:focus, .pdf-mode .wc-input:focus { border-color: rgba(245,200,66,0.5); }
  .excel-mode .wc-select:focus, .excel-mode .wc-input:focus { border-color: rgba(34,217,138,0.5); }

  .wc-margins-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .wc-input { text-align: center; }

  /* Tip box */
  .wc-tip {
    background: rgba(34,217,138,0.06);
    border: 1px solid rgba(34,217,138,0.15);
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 10px; line-height: 1.7;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }
  .wc-tip strong { color: var(--emerald); }

  /* Convert button */
  .wc-convert-wrap { padding: 16px 20px 24px; margin-top: auto; }
  .wc-convert-btn {
    width: 100%;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 14px 20px;
    border-radius: var(--radius);
    border: none; outline: none;
    font-size: 14px; font-weight: 700; letter-spacing: -0.01em;
    cursor: pointer;
    transition: var(--transition);
    position: relative;
    overflow: hidden;
    font-family: var(--font-head);
  }
  .wc-convert-btn::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 60%);
    pointer-events: none;
  }
  .wc-convert-btn.pdf-btn {
    background: linear-gradient(135deg, #c89b00, #f5c842, #d4a800);
    color: #1a1000;
    box-shadow: 0 4px 24px rgba(245,200,66,0.35), 0 1px 0 rgba(255,255,255,0.2) inset;
  }
  .wc-convert-btn.pdf-btn:hover:not(:disabled) {
    box-shadow: 0 8px 40px rgba(245,200,66,0.55), 0 1px 0 rgba(255,255,255,0.2) inset;
    transform: translateY(-2px);
  }
  .wc-convert-btn.excel-btn {
    background: linear-gradient(135deg, #0e8a55, #22d98a, #10a060);
    color: #001a10;
    box-shadow: 0 4px 24px rgba(34,217,138,0.35), 0 1px 0 rgba(255,255,255,0.2) inset;
  }
  .wc-convert-btn.excel-btn:hover:not(:disabled) {
    box-shadow: 0 8px 40px rgba(34,217,138,0.55), 0 1px 0 rgba(255,255,255,0.2) inset;
    transform: translateY(-2px);
  }
  .wc-convert-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
  .wc-convert-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }

  .wc-spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(0,0,0,0.2);
    border-top-color: rgba(0,0,0,0.8);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .wc-ai-status {
    font-size: 10px; font-family: var(--font-mono); color: var(--text-muted);
    margin-top: 10px; text-align: center;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .wc-ai-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--gold);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }

  /* ─── MAIN AREA ─── */
  .wc-main {
    flex: 1; overflow: auto;
    position: relative; z-index: 10;
    display: flex; flex-direction: column;
    padding: 32px;
    gap: 24px;
  }
  .wc-main::-webkit-scrollbar { width: 4px; }
  .wc-main::-webkit-scrollbar-track { background: transparent; }
  .wc-main::-webkit-scrollbar-thumb { background: var(--border); border-radius: 9999px; }

  /* Top bar */
  .wc-topbar {
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .wc-preview-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--text-muted);
    font-family: var(--font-mono);
    display: flex; align-items: center; gap: 8px;
  }
  .wc-preview-label-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--gold);
    box-shadow: 0 0 8px var(--gold);
  }
  .wc-page-badge {
    font-size: 11px; font-family: var(--font-mono); font-weight: 500;
    color: var(--text-muted);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 4px 12px;
  }

  /* 3D Document preview */
  .wc-preview-area {
    flex: 1;
    background:
      radial-gradient(ellipse at 30% 20%, rgba(245,200,66,0.04) 0%, transparent 55%),
      radial-gradient(ellipse at 70% 80%, rgba(34,217,138,0.03) 0%, transparent 55%),
      linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%);
    border: 1px solid var(--border);
    border-radius: 20px;
    overflow: auto;
    display: flex; align-items: flex-start; justify-content: center;
    padding: 48px 32px;
    position: relative;
    box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);
    min-height: 0;
  }
  .wc-preview-area::-webkit-scrollbar { width: 6px; }
  .wc-preview-area::-webkit-scrollbar-track { background: transparent; }
  .wc-preview-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 9999px; }

  /* Paper with 3D shadow */
  .wc-paper {
    background: #fff;
    border-radius: 4px;
    padding: 64px 72px;
    width: 100%;
    max-width: 820px;
    min-height: 900px;
    color: #111;
    font-family: 'Times New Roman', Times, serif;
    font-size: 13px;
    line-height: 1.8;
    position: relative;
    box-shadow:
      0 2px 0 rgba(255,255,255,0.04),
      0 8px 32px rgba(0,0,0,0.5),
      0 24px 72px rgba(0,0,0,0.4),
      0 48px 120px rgba(0,0,0,0.3),
      4px 0 20px rgba(0,0,0,0.2),
      -4px 0 20px rgba(0,0,0,0.2);
    transform: perspective(1200px) rotateX(0.8deg);
    transform-origin: top center;
    animation: paperReveal 0.5s ease-out both;
  }
  @keyframes paperReveal {
    from { opacity: 0; transform: perspective(1200px) rotateX(4deg) translateY(20px); }
    to   { opacity: 1; transform: perspective(1200px) rotateX(0.8deg) translateY(0); }
  }

  /* Paper fold corner */
  .wc-paper::before {
    content: '';
    position: absolute;
    top: 0; right: 0;
    width: 0; height: 0;
    border-style: solid;
    border-width: 0 28px 28px 0;
    border-color: transparent rgba(0,0,0,0.08) transparent transparent;
  }
  .wc-paper::after {
    content: '';
    position: absolute;
    top: 0; right: 0;
    width: 28px; height: 28px;
    background: linear-gradient(225deg, #e8e8e8 50%, transparent 50%);
    border-bottom-left-radius: 4px;
  }

  /* Empty state */
  .wc-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; width: 100%;
    gap: 16px;
    pointer-events: none;
  }
  .wc-empty-icon {
    width: 80px; height: 80px;
    border-radius: 20px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 36px;
    color: var(--text-muted);
    box-shadow: var(--shadow-card);
    animation: floatIcon 4s ease-in-out infinite;
  }
  @keyframes floatIcon {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-10px); }
  }
  .wc-empty-title {
    font-size: 18px; font-weight: 700; letter-spacing: -0.03em;
    color: var(--text-secondary);
  }
  .wc-empty-sub { font-size: 13px; color: var(--text-muted); font-family: var(--font-mono); }

  /* Stats strip */
  .wc-stats {
    display: flex; gap: 12px; flex-shrink: 0;
  }
  .wc-stat {
    flex: 1;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    box-shadow: var(--shadow-card);
  }
  .wc-stat-val { font-size: 22px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; margin-bottom: 4px; }
  .wc-stat-label { font-size: 10px; font-family: var(--font-mono); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .stat-gold { color: var(--gold); }
  .stat-emerald { color: var(--emerald); }
  .stat-blue { color: #60a5fa; }
`;

/* ─────────────────────────── COMPONENT ─────────────────────────── */
export default function WordConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'pdf' | 'excel'>('pdf');
  const [htmlContent, setHtmlContent] = useState('');
  const [rawText, setRawText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [aiStatus, setAiStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [pdfSettings, setPdfSettings] = useState({
    pageSize: 'a4',
    orientation: 'portrait',
    margins: { top: 25, bottom: 25, left: 25, right: 25 },
    font: 'times'
  });

  const [excelSettings, setExcelSettings] = useState({ mode: 'all' });

  const handleFile = async (newFile: File | null) => {
    if (!newFile) return;
    setFile(newFile);
    setHtmlContent(''); setRawText('');

    try {
      let plainText = '';
      if (newFile.name.toLowerCase().endsWith('.docx')) {
        const buf = await newFile.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        setHtmlContent(result.value);
        plainText = result.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        setRawText(plainText);
      } else {
        const text = await newFile.text();
        plainText = text;
        setRawText(text);
        setHtmlContent(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'));
      }
      setPageCount(Math.max(1, Math.ceil(plainText.length / 2500)));
      setWordCount(plainText.split(/\s+/).filter(Boolean).length);
      setCharCount(plainText.length);
    } catch (err) { console.error(err); }
  };

  const convertWord = async () => {
    if (!htmlContent && !rawText) return;
    setIsProcessing(true);
    try {
      if (mode === 'pdf') await convertToPdf();
      else await convertToExcel();
    } catch (err) { console.error(err); }
    finally { setIsProcessing(false); }
  };

  const convertToPdf = async () => {
    const { pageSize, orientation, margins, font } = pdfSettings;
    const fontName = font === 'times' ? 'Times New Roman' : font === 'courier' ? 'Courier New' : 'Helvetica, Arial, sans-serif';
    const pageSizes = { a4: { p:[794,1123], l:[1123,794] }, letter: { p:[816,1056], l:[1056,816] }, legal: { p:[816,1344], l:[1344,816] } };
    const [pgW, pgH] = orientation === 'portrait' ? pageSizes[pageSize as keyof typeof pageSizes].p : pageSizes[pageSize as keyof typeof pageSizes].l;
    const sm = { top: isFinite(margins.top) ? margins.top : 25, right: isFinite(margins.right) ? margins.right : 25, bottom: isFinite(margins.bottom) ? margins.bottom : 25, left: isFinite(margins.left) ? margins.left : 25 };

    const container = document.createElement('div');
    container.style.cssText = `position:fixed;top:0;left:0;opacity:0;pointer-events:none;width:${pgW}px;background:white;z-index:-1;`;
    const viewport = document.createElement('div');
    viewport.style.cssText = `position:relative;width:${pgW}px;height:${pgH}px;overflow:hidden;background:#fff;`;
    const pageDiv = document.createElement('div');
    pageDiv.style.cssText = `position:absolute;top:0;left:0;width:${pgW}px;min-height:${pgH}px;background:white;padding:${sm.top}px ${sm.right}px ${sm.bottom}px ${sm.left}px;font-family:${fontName};font-size:12pt;line-height:1.6;color:#000;box-sizing:border-box;word-wrap:break-word;overflow:visible;`;
    pageDiv.innerHTML = `<style>*{-webkit-print-color-adjust:exact;}h1{font-size:20pt;font-weight:bold;margin:16px 0 8px;}h2{font-size:16pt;font-weight:bold;margin:14px 0 6px;}h3{font-size:14pt;font-weight:bold;margin:12px 0 4px;}p{margin:0 0 8px;}ul,ol{margin:0 0 8px 24px;}table{width:100%;border-collapse:collapse;margin:10px 0;}th,td{border:1px solid #000;padding:5px 8px;font-size:10pt;}th{background:#f0f0f0;font-weight:bold;}hr{border:0;border-top:1px solid #000;margin:8px 0;}</style>${htmlContent || rawText.replace(/\n/g, '<br>')}`;
    viewport.appendChild(pageDiv); container.appendChild(viewport); document.body.appendChild(container);

    try {
      await new Promise(r => setTimeout(r, 120));
      const totalH = Math.max(pageDiv.scrollHeight, pgH);
      const numPages = Math.max(1, Math.ceil(totalH / pgH));
      const pdf = new jsPDF({ orientation: orientation as any, unit: 'px', format: [pgW, pgH], hotfixes: ['px_scaling'] });
      for (let p = 0; p < numPages; p++) {
        pageDiv.style.transform = `translateY(-${p * pgH}px)`;
        await new Promise(r => requestAnimationFrame(() => r(null)));
        const canvas = await html2canvas(viewport, { scale: 1.8, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', width: pgW, height: pgH, windowWidth: pgW, windowHeight: pgH, logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        if (p > 0) pdf.addPage([pgW, pgH]);
        pdf.addImage(imgData, 'JPEG', 0, 0, pgW, pgH, undefined, 'FAST');
      }
      pdf.save('converted.pdf');
    } finally { document.body.removeChild(container); }
  };

  const convertToExcel = async () => {
    const wb = XLSX.utils.book_new();
    const tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = htmlContent || '<p>' + rawText.replace(/\n/g, '</p><p>') + '</p>';
    let data: string[][] = [];

    if (excelSettings.mode === 'tables') {
      const tables = tmpDiv.querySelectorAll('table');
      if (tables.length > 0) {
        const aiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
        const tableText = Array.from(tables).map(tbl => Array.from(tbl.querySelectorAll('tr')).map(tr => Array.from(tr.querySelectorAll('td,th')).map(td => (td.textContent||'').trim().replace(/\s+/g,' ')).join('\t')).join('\n')).join('\n\n');
        if (aiKey && tableText.trim()) {
          try {
            setAiStatus('AI organizing data...');
            const ai = new GoogleGenAI({ apiKey: aiKey });
            const res = await ai.models.generateContent({ model:'gemini-3-flash-preview', contents:{parts:[{text:`Extract items and prices from:\n${tableText}\nReturn JSON: {items:[{name,price}]}`}]}, config:{responseMimeType:'application/json',responseSchema:{type:Type.OBJECT,properties:{items:{type:Type.ARRAY,items:{type:Type.OBJECT,properties:{name:{type:Type.STRING},price:{type:Type.STRING}}}}}}} });
            const parsed = JSON.parse(res.text?.trim()||'{}');
            const items = (parsed.items||[]).filter((i:any)=>i?.name||i?.price);
            if (items.length) { const ws=XLSX.utils.aoa_to_sheet([['Item','Price'],...items.map((i:any)=>[i.name||'',i.price||''])]); XLSX.utils.book_append_sheet(wb,ws,'Items'); }
          } catch(e){console.error(e);} finally{setAiStatus('');}
        }
        tables.forEach((tbl,ti)=>{const tdata:string[][]=[];tbl.querySelectorAll('tr').forEach(tr=>{const row:string[]=[];tr.querySelectorAll('td,th').forEach(cell=>row.push((cell.textContent||'').trim().replace(/\s+/g,' ')));if(row.some(c=>c))tdata.push(row);});if(tdata.length){const ws=XLSX.utils.aoa_to_sheet(tdata);XLSX.utils.book_append_sheet(wb,ws,'Table '+(ti+1));}});
      } else { data = htmlToRows(tmpDiv); }
    } else if (excelSettings.mode === 'all') {
      data = htmlToRows(tmpDiv);
    } else {
      data = htmlToParagraphRows(tmpDiv);
    }

    if (data.length > 0) { const ws=XLSX.utils.aoa_to_sheet(data); XLSX.utils.book_append_sheet(wb,ws,'Sheet1'); }
    XLSX.writeFile(wb, 'converted.xlsx');
  };

  const htmlToRows = (container: HTMLElement): string[][] => {
    const rows: string[][] = [];
    container.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,td,th,div').forEach(el => {
      if (el.closest('table') && !['TD','TH'].includes(el.tagName)) return;
      const text = (el.textContent||'').trim().replace(/\s+/g,' ');
      if (!text) return;
      if (text.includes('\t')) { rows.push(text.split('\t').map(c=>c.trim()).filter(c=>c)); return; }
      const p = text.split(/\s*[|¦]\s*/).map(c=>c.trim()).filter(c=>c);
      if (p.length>1) { rows.push(p); return; }
      const cm = text.match(/^([^:]{1,40}):\s+(.+)$/);
      if (cm) { rows.push([cm[1].trim(),cm[2].trim()]); return; }
      const dm = text.match(/^([^\-]{1,40})\s+[-–—]\s+(.+)$/);
      if (dm) { rows.push([dm[1].trim(),dm[2].trim()]); return; }
      const sc = text.split(/\s{2,}/).map(c=>c.trim()).filter(c=>c);
      if (sc.length>1) { rows.push(sc); return; }
      rows.push([text]);
    });
    return rows.filter(r=>r.length&&r.some(c=>c));
  };

  const htmlToParagraphRows = (container: HTMLElement): string[][] => {
    const rows: string[][] = [];
    let currentHead = '';
    if (!container.children.length) return (container.textContent||'').split('\n').filter(l=>l.trim()).map(l=>[l.trim()]);
    Array.from(container.children).forEach(el => {
      const text = (el.textContent||'').trim().replace(/\s+/g,' ');
      if (!text) return;
      const tag = el.tagName;
      if (['H1','H2','H3','H4','H5','H6'].includes(tag)) { currentHead=text; rows.push([text,'']); }
      else if (tag==='TABLE') { el.querySelectorAll('tr').forEach(tr=>{const r:string[]=[]; tr.querySelectorAll('td,th').forEach(cell=>r.push(cell.textContent?.trim()||'')); if(r.some(c=>c))rows.push(r);}); }
      else if (['UL','OL'].includes(tag)) { el.querySelectorAll('li').forEach(li=>{const t=(li.textContent||'').trim(); if(t)rows.push([currentHead,t]);}); }
      else { const cm=text.match(/^([^:]{1,40}):\s+(.+)$/); if(cm)rows.push([cm[1].trim(),cm[2].trim()]); else rows.push([currentHead||'',text]); }
    });
    return rows.filter(r=>r.length&&r.some(c=>c));
  };

  const hasContent = !!(htmlContent || rawText);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="wc-root">
        <div className="wc-bg" />
        <div className="wc-grid" />

        {/* ── SIDEBAR ── */}
        <aside className={`wc-sidebar ${mode === 'pdf' ? 'pdf-mode' : 'excel-mode'}`}>
          {/* Logo */}
          <div className="wc-logo">
            <div className="wc-logo-icon">📄</div>
            <div className="wc-logo-text">
              <div className="wc-logo-title">WordConverter</div>
              <div className="wc-logo-sub">Pro · v2.0</div>
            </div>
          </div>

          {/* Upload */}
          <div className="wc-section">
            <div className="wc-label">Document</div>
            <div
              className={`wc-drop ${isDragging ? 'dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
            >
              <span className="wc-drop-icon"><IconUpload /></span>
              <div className="wc-drop-title">{isDragging ? 'Drop it here!' : 'Drop or click to upload'}</div>
              <div className="wc-drop-sub">.docx · .doc · .txt · .rtf</div>
            </div>
            <input type="file" ref={fileInputRef} style={{display:'none'}} accept=".doc,.docx,.txt,.rtf" onChange={e => handleFile(e.target.files?.[0] || null)} />
            {file && (
              <div className="wc-file-badge">
                <span className="wc-file-badge-icon"><IconDoc /></span>
                <span className="wc-file-badge-name">{file.name}</span>
              </div>
            )}
          </div>

          {/* Mode */}
          <div className="wc-section">
            <div className="wc-label">Output Format</div>
            <div className="wc-mode-toggle">
              <button onClick={() => setMode('pdf')} className={`wc-mode-btn ${mode==='pdf' ? 'pdf-active' : ''}`}><IconFile /> PDF</button>
              <button onClick={() => setMode('excel')} className={`wc-mode-btn ${mode==='excel' ? 'excel-active' : ''}`}><IconTable /> Excel</button>
            </div>
          </div>

          {/* Settings */}
          <div className="wc-section">
            {mode === 'pdf' ? (
              <>
                <div className="wc-label">PDF Settings</div>
                <div className="wc-field">
                  <div className="wc-field-label">Page Size</div>
                  <select className="wc-select" value={pdfSettings.pageSize} onChange={e => setPdfSettings({...pdfSettings, pageSize: e.target.value})}>
                    <option value="a4">A4 (210 × 297 mm)</option>
                    <option value="letter">Letter (8.5 × 11 in)</option>
                    <option value="legal">Legal (8.5 × 14 in)</option>
                  </select>
                </div>
                <div className="wc-field">
                  <div className="wc-field-label">Orientation</div>
                  <select className="wc-select" value={pdfSettings.orientation} onChange={e => setPdfSettings({...pdfSettings, orientation: e.target.value})}>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
                <div className="wc-field">
                  <div className="wc-field-label">Font</div>
                  <select className="wc-select" value={pdfSettings.font} onChange={e => setPdfSettings({...pdfSettings, font: e.target.value})}>
                    <option value="times">Times New Roman</option>
                    <option value="helvetica">Helvetica</option>
                    <option value="courier">Courier New</option>
                  </select>
                </div>
                <div className="wc-field">
                  <div className="wc-field-label">Margins (mm)</div>
                  <div className="wc-margins-grid">
                    {(['top','bottom','left','right'] as const).map(side => (
                      <input key={side} type="number" className="wc-input" placeholder={side.charAt(0).toUpperCase()+side.slice(1)} value={pdfSettings.margins[side]} onChange={e => setPdfSettings({...pdfSettings, margins:{...pdfSettings.margins, [side]: parseInt(e.target.value)||0}})} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="wc-label">Excel Settings</div>
                <div className="wc-field">
                  <div className="wc-field-label">Extract Mode</div>
                  <select className="wc-select" value={excelSettings.mode} onChange={e => setExcelSettings({...excelSettings, mode: e.target.value})}>
                    <option value="all">All Text — Each line as row</option>
                    <option value="tables">Tables Only — Word → Excel</option>
                    <option value="paragraphs">Paragraphs — Heading + content</option>
                  </select>
                </div>
                <div className="wc-tip">
                  <strong>Tips:</strong><br/>
                  · Tab-separated → auto-splits columns<br/>
                  · "Name: Value" → 2 columns<br/>
                  · 2+ spaces → column separator
                </div>
              </>
            )}
          </div>

          {/* Convert button */}
          <div className="wc-convert-wrap">
            <button
              className={`wc-convert-btn ${mode==='pdf' ? 'pdf-btn' : 'excel-btn'}`}
              onClick={convertWord}
              disabled={!hasContent || isProcessing}
            >
              {isProcessing ? <><div className="wc-spinner" /> Converting…</> : <><IconDownload /> Export to {mode === 'pdf' ? 'PDF' : 'Excel'}</>}
            </button>
            {aiStatus && (
              <div className="wc-ai-status">
                <div className="wc-ai-dot" />
                {aiStatus}
              </div>
            )}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="wc-main">
          <div className="wc-topbar">
            <div className="wc-preview-label">
              <div className={`wc-preview-label-dot ${mode==='excel' ? 'style="background:var(--emerald);box-shadow:0 0 8px var(--emerald)"' : ''}`} style={mode==='excel' ? {background:'var(--emerald)',boxShadow:'0 0 8px var(--emerald)'} : {}} />
              Document Preview
            </div>
            {hasContent && <div className="wc-page-badge">~{pageCount} {pageCount === 1 ? 'page' : 'pages'}</div>}
          </div>

          {hasContent && (
            <div className="wc-stats">
              <div className="wc-stat">
                <div className="wc-stat-val stat-gold">{pageCount}</div>
                <div className="wc-stat-label">Pages</div>
              </div>
              <div className="wc-stat">
                <div className="wc-stat-val stat-emerald">{wordCount.toLocaleString()}</div>
                <div className="wc-stat-label">Words</div>
              </div>
              <div className="wc-stat">
                <div className="wc-stat-val stat-blue">{charCount.toLocaleString()}</div>
                <div className="wc-stat-label">Characters</div>
              </div>
              <div className="wc-stat">
                <div className="wc-stat-val" style={{color:'#c084fc'}}>{file ? (file.size / 1024).toFixed(1) : '0'}</div>
                <div className="wc-stat-label">KB</div>
              </div>
            </div>
          )}

          <div className="wc-preview-area">
            {!hasContent ? (
              <div className="wc-empty">
                <div className="wc-empty-icon"><IconDoc /></div>
                <div className="wc-empty-title">No document loaded</div>
                <div className="wc-empty-sub">Upload a .docx, .doc, .txt, or .rtf file</div>
              </div>
            ) : (
              <div
                ref={previewRef}
                className="wc-paper"
                dangerouslySetInnerHTML={{ __html: htmlContent || rawText.replace(/\n/g, '<br>') }}
              />
            )}
          </div>
        </main>
      </div>
    </>
  );
}
