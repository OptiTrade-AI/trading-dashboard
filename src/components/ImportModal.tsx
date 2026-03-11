'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';

type TradeType = 'csp' | 'cc' | 'directional' | 'spread';

interface ParsedRow {
  data: Record<string, string>;
  valid: boolean;
  error?: string;
}

const requiredFields: Record<TradeType, string[]> = {
  csp: ['ticker', 'strike', 'premiumCollected', 'contracts', 'entryDate', 'expiration'],
  cc: ['ticker', 'strike', 'premiumCollected', 'contracts', 'entryDate', 'expiration', 'sharesHeld', 'costBasis'],
  directional: ['ticker', 'optionType', 'strike', 'entryPrice', 'contracts', 'entryDate', 'expiration'],
  spread: ['ticker', 'spreadType', 'longStrike', 'shortStrike', 'longPrice', 'shortPrice', 'contracts', 'entryDate', 'expiration'],
};

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (type: TradeType, rows: Record<string, string>[]) => void;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });

  return { headers, rows };
}

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [tradeType, setTradeType] = useState<TradeType>('csp');
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleParse = useCallback((text: string) => {
    const { headers: h, rows } = parseCSV(text);
    setHeaders(h);
    const required = requiredFields[tradeType];
    const validated = rows.map(data => {
      const missing = required.filter(f => !data[f] && !data[f.toLowerCase()]);
      if (missing.length > 0) {
        return { data, valid: false, error: `Missing: ${missing.join(', ')}` };
      }
      return { data, valid: true };
    });
    setParsedRows(validated);
  }, [tradeType]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      handleParse(text);
    };
    reader.readAsText(file);
  }, [handleParse]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      handleParse(text);
    };
    reader.readAsText(file);
  }, [handleParse]);

  const validRows = parsedRows.filter(r => r.valid);
  const invalidRows = parsedRows.filter(r => !r.valid);

  const handleImport = () => {
    if (validRows.length === 0) return;
    onImport(tradeType, validRows.map(r => r.data));
    toast.success(`Imported ${validRows.length} trades`);
    onClose();
    setCsvText('');
    setParsedRows([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-card-solid border border-border rounded-2xl shadow-2xl shadow-black/40 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Import Trades</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">&times;</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Trade type selector */}
          <div className="flex gap-2">
            {(['csp', 'cc', 'directional', 'spread'] as const).map(type => (
              <button
                key={type}
                onClick={() => { setTradeType(type); setParsedRows([]); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  tradeType === type ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground'
                )}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Required fields hint */}
          <div className="text-xs text-muted">
            Required columns: {requiredFields[tradeType].join(', ')}
          </div>

          {/* File upload / drag-drop area */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-accent/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            <p className="text-sm text-muted mb-1">Drop a CSV file here or click to upload</p>
            <p className="text-xs text-muted">Or paste CSV data below</p>
          </div>

          {/* Manual CSV text area */}
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder="ticker,strike,premiumCollected,contracts,entryDate,expiration&#10;AAPL,150,250,1,2025-01-15,2025-02-21"
            className="input-field text-xs font-mono h-24 resize-y"
          />
          <button
            onClick={() => handleParse(csvText)}
            className="btn-secondary text-sm"
          >
            Parse CSV
          </button>

          {/* Preview */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-foreground">
                  Preview: {validRows.length} valid, {invalidRows.length} invalid
                </span>
              </div>
              <div className="overflow-x-auto max-h-48 border border-border/30 rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 bg-card/50">
                      <th className="px-2 py-1.5 text-left text-muted">Status</th>
                      {headers.slice(0, 6).map(h => (
                        <th key={h} className="px-2 py-1.5 text-left text-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-b border-border/10">
                        <td className="px-2 py-1.5">
                          {row.valid ? (
                            <span className="text-profit font-bold">{'\u2713'}</span>
                          ) : (
                            <span className="text-loss font-bold" title={row.error}>{'\u2717'}</span>
                          )}
                        </td>
                        {headers.slice(0, 6).map(h => (
                          <td key={h} className="px-2 py-1.5 text-foreground">{row.data[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button
            onClick={handleImport}
            disabled={validRows.length === 0}
            className={cn('btn-primary text-sm', validRows.length === 0 && 'opacity-50 cursor-not-allowed')}
          >
            Import {validRows.length} Trade{validRows.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
