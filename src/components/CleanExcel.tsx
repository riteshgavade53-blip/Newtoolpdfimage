import React, { useMemo, useRef, useState } from 'react';
import { XLSX } from '../utils/pdfUtils';
import { FileSpreadsheet, ArrowDownToLine, Sparkles } from 'lucide-react';

type TableData = string[][];

const normalizeCell = (value: unknown) => String(value ?? '');
const removeSpecialChars = (value: string) => {
  return value
    // Remove accented/extended Latin letters and keep only allowed punctuation.
    .replace(/[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0100-\u024F]/g, '')
    .replace(/[^\p{L}\p{N}\s\-_+=,.\/\\:;?<>[\]]+/gu, '');
};

export default function CleanExcel() {
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [rawData, setRawData] = useState<TableData>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [removeSpecialCharactersEnabled, setRemoveSpecialCharactersEnabled] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (newFile: File | null) => {
    if (!newFile) return;
    setFile(newFile);
    try {
      const buffer = await newFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][];
      const normalized = rows.map(r => r.map(normalizeCell));
      setRawData(normalized);
      setSheetName(firstSheetName);
    } catch (err) {
      console.error(err);
      setRawData([]);
      setSheetName('');
    }
  };

  const cleanedData = useMemo(() => {
    if (!rawData.length) return [] as TableData;
    return rawData.map(row =>
      row.map(cell => {
        if (!removeSpecialCharactersEnabled) return cell;
        return removeSpecialChars(cell);
      })
    );
  }, [rawData, removeSpecialCharactersEnabled]);

  const stats = useMemo(() => {
    const rawRows = rawData.length;
    const cleanRows = cleanedData.length;
    const rawCols = rawData.length ? Math.max(...rawData.map(row => row.length), 0) : 0;
    const cleanCols = cleanedData.length ? Math.max(...cleanedData.map(row => row.length), 0) : 0;
    let changedCells = 0;
    rawData.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if ((cleanedData[rIdx]?.[cIdx] || '') !== cell) changedCells += 1;
      });
    });
    return {
      rawRows,
      cleanRows,
      rawCols,
      cleanCols,
      changedCells,
    };
  }, [rawData, cleanedData]);

  const downloadCleaned = () => {
    if (!cleanedData.length) return;
    setIsProcessing(true);
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(cleanedData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Cleaned');
      const safeName = (file?.name || 'cleaned.xlsx').replace(/\.(xlsx|xls|csv)$/i, '');
      XLSX.writeFile(wb, `${safeName}-cleaned.xlsx`);
    } finally {
      setIsProcessing(false);
    }
  };

  const previewRows = cleanedData.slice(0, 25);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-slate-800 font-bold text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" /> Clean Excel
        </div>

        <div className="p-4 border-b border-slate-800">
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/5'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <div className="text-sm font-semibold mb-1 truncate px-2">{file ? file.name : 'Upload Excel/CSV'}</div>
            <div className="text-xs text-slate-500">.xlsx, .xls, .csv</div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        </div>

        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cleanup Options</div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              className="accent-emerald-500"
              checked={removeSpecialCharactersEnabled}
              onChange={e => setRemoveSpecialCharactersEnabled(e.target.checked)}
            />
            Remove special characters only
          </label>
        </div>

        <div className="p-4 border-b border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="font-semibold text-slate-300">Summary</div>
          <div>Rows: {stats.rawRows} {'->'} {stats.cleanRows}</div>
          <div>Columns: {stats.rawCols} {'->'} {stats.cleanCols}</div>
          <div>Changed Cells: {stats.changedCells}</div>
        </div>

        <div className="p-4 mt-auto">
          <button
            onClick={downloadCleaned}
            disabled={!cleanedData.length || isProcessing}
            className="w-full bg-gradient-to-br from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ArrowDownToLine className="w-4 h-4" /> Download Clean Excel
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-950 p-6">
        {!rawData.length ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900 border-2 border-dashed border-slate-800 rounded-2xl">
            <FileSpreadsheet className="w-16 h-16 mb-4 opacity-50" />
            <div className="font-semibold text-lg text-slate-300">Upload an Excel file to clean</div>
            <div className="text-sm mt-2">Preview will appear here</div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 text-xs text-slate-400">
              Cleaned Preview ({previewRows.length} rows shown)
            </div>
            <div className="overflow-auto max-h-[75vh]">
              <table className="min-w-full text-xs text-slate-200">
                <tbody>
                  {previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-slate-800/80">
                      {row.map((cell, cIdx) => (
                        <td key={`${rIdx}-${cIdx}`} className="px-3 py-2 whitespace-pre-wrap align-top">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
