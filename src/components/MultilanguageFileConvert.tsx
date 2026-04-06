/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Upload, Download, FileText, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';

interface FileData {
  name: string;
  size: number;
  content: ArrayBuffer;
}

export default function App() {
  const [file, setFile] = useState<FileData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const processFile = async (selectedFile: File) => {
    setError(null);
    setResult(null);
    
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError("Please upload a .csv file.");
      return;
    }

    const buffer = await selectedFile.arrayBuffer();
    setFile({
      name: selectedFile.name,
      size: selectedFile.size,
      content: buffer
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Main conversion logic (similar to your Python script)
  const convertFile = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      // Try different encodings: UTF-8, Windows-1252 (CP1252), Latin1
      const encodings = ['utf-8', 'windows-1252', 'latin1'];
      let decodedText = "";
      let success = false;

      for (const encoding of encodings) {
        try {
          const decoder = new TextDecoder(encoding, { fatal: true });
          decodedText = decoder.decode(file.content);
          success = true;
          break;
        } catch (e) {
          // Continue to next encoding if current one fails
        }
      }

      if (!success) {
        // Fallback to non-fatal decoding
        decodedText = new TextDecoder('windows-1252').decode(file.content);
      }

      // Parse CSV using PapaParse
      const parsed = Papa.parse(decodedText, {
        header: true,
        skipEmptyLines: true,
      });

      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        throw new Error("Failed to parse CSV content.");
      }

      // Convert back to CSV string
      const csvString = Papa.unparse(parsed.data);

      // Create Blob with UTF-8 BOM (0xEF, 0xBB, 0xBF)
      // This is equivalent to 'utf-8-sig' in Python
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });
      
      const newName = file.name.replace(/\.csv$/i, '_utf8.csv');
      setResult({ blob, name: newName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during conversion.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8 flex flex-col items-center">
      <div className="max-w-2xl w-full">
        <header className="text-center mb-12">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-200"
          >
            <RefreshCw className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">CSV Encoding Fixer</h1>
          <p className="text-slate-500">Convert "weird" characters to clean UTF-8 for Excel.</p>
        </header>

        <main className="space-y-6">
          {!file && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-200 ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-slate-400'}`}
            >
              <input type="file" accept=".csv" onChange={handleFileInput} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="flex flex-col items-center">
                <div className="p-4 bg-slate-100 rounded-full mb-4"><Upload className="w-8 h-8 text-slate-400" /></div>
                <p className="text-lg font-medium text-slate-700 mb-1">Drop your CSV file here</p>
                <p className="text-sm text-slate-400">or click to browse</p>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {file && (
              <motion.div key="file-info" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl"><FileText className="w-6 h-6 text-blue-600" /></div>
                    <div>
                      <h3 className="font-semibold text-slate-800 truncate max-w-[200px] md:max-w-sm">{file.name}</h3>
                      <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button onClick={reset} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                </div>

                {!result && !error && (
                  <button onClick={convertFile} disabled={isProcessing} className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl font-semibold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2">
                    {isProcessing ? <><RefreshCw className="w-5 h-5 animate-spin" /> Processing...</> : <><RefreshCw className="w-5 h-5" /> Fix Encoding & Convert</>}
                  </button>
                )}

                {result && (
                  <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-2xl border border-green-100">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-medium">File converted successfully!</span>
                    </div>
                    <button onClick={downloadResult} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-semibold shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2">
                      <Download className="w-5 h-5" /> Download {result.name}
                    </button>
                  </motion.div>
                )}

                {error && (
                  <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-4">
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-2xl border border-red-100">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                    <button onClick={reset} className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-semibold transition-all">Try Another File</button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
