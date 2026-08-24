import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { StyleEarning } from '../types';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Plus, X } from 'lucide-react';

interface ExcelStyleUploaderProps {
  currentEarnings: StyleEarning[];
  onApplyStyles: (importedStyles: StyleEarning[], mode: 'replace' | 'merge') => void;
  currency: string;
  payCycleLabel?: string;
}

interface ParsedRow {
  id: string;
  style: string;
  cmPrice: number;
  plannedQty: number;
  qtyProduced: number;
  smv: number;
  isValid: boolean;
  errors: string[];
}

export default function ExcelStyleUploader({
  currentEarnings,
  onApplyStyles,
  currency,
  payCycleLabel
}: ExcelStyleUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge');
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to create & download Excel template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Style Code": "NWJ1492/A",
        "CM Price": 12.50,
        "Planned Target Qty": 600,
        "Actual Qty Produced": 520,
        "SMV (Minutes)": 8.5
      },
      {
        "Style Code": "NWJ1501/B",
        "CM Price": 14.00,
        "Planned Target Qty": 450,
        "Actual Qty Produced": 410,
        "SMV (Minutes)": 10.2
      },
      {
        "Style Code": "TSH2024/M",
        "CM Price": 8.75,
        "Planned Target Qty": 1000,
        "Actual Qty Produced": 950,
        "SMV (Minutes)": 5.0
      },
      {
        "Style Code": "DRS3088/C",
        "CM Price": 18.20,
        "Planned Target Qty": 350,
        "Actual Qty Produced": 300,
        "SMV (Minutes)": 14.0
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths for readability
    ws['!cols'] = [
      { wch: 18 }, // Style Code
      { wch: 12 }, // CM Price
      { wch: 20 }, // Planned Target Qty
      { wch: 20 }, // Actual Qty Produced
      { wch: 15 }  // SMV
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Style Rates & Targets");
    XLSX.writeFile(wb, "Style_CM_Price_Template.xlsx");
  };

  const processFile = (file: File) => {
    setErrorMsg(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("No worksheets found in uploaded file.");
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          throw new Error("The selected Excel sheet contains no rows or data.");
        }

        const rows: ParsedRow[] = rawJson.map((row, idx) => {
          // Normalize column headers to lowercase without spaces or punctuation
          const normalizedRow: { [key: string]: any } = {};
          Object.keys(row).forEach((k) => {
            const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            normalizedRow[cleanKey] = row[k];
          });

          // Detect Style Name / Code
          const styleVal = 
            normalizedRow['stylecode'] ?? 
            normalizedRow['style'] ?? 
            normalizedRow['stylename'] ?? 
            normalizedRow['code'] ?? 
            normalizedRow['item'] ?? 
            normalizedRow['name'] ?? 
            Object.values(row)[0] ?? 
            `STYLE_${idx + 1}`;

          const styleStr = String(styleVal).trim();

          // Detect CM Price
          const rawPrice = 
            normalizedRow['cmprice'] ?? 
            normalizedRow['cm'] ?? 
            normalizedRow['price'] ?? 
            normalizedRow['cutmakeprice'] ?? 
            normalizedRow['cmtprice'] ?? 
            normalizedRow['rate'] ?? 
            0;
          
          const cmPriceNum = parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

          // Detect Planned Target Qty
          const rawPlanned = 
            normalizedRow['plannedtargetqty'] ?? 
            normalizedRow['plannedqty'] ?? 
            normalizedRow['planned'] ?? 
            normalizedRow['targetqty'] ?? 
            normalizedRow['target'] ?? 
            normalizedRow['plannedvolume'] ?? 
            0;

          const plannedQtyNum = parseInt(String(rawPlanned).replace(/[^0-9]/g, ''), 10) || 0;

          // Detect Actual Qty Produced
          const rawActual = 
            normalizedRow['actualqtyproduced'] ?? 
            normalizedRow['actualqty'] ?? 
            normalizedRow['qtyproduced'] ?? 
            normalizedRow['actual'] ?? 
            normalizedRow['output'] ?? 
            normalizedRow['quantity'] ?? 
            normalizedRow['produced'] ?? 
            0;

          const qtyProducedNum = parseInt(String(rawActual).replace(/[^0-9]/g, ''), 10) || 0;

          // Detect SMV
          const rawSmv = 
            normalizedRow['smvminutes'] ?? 
            normalizedRow['smv'] ?? 
            normalizedRow['standardminutes'] ?? 
            10.0;

          const smvNum = parseFloat(String(rawSmv).replace(/[^0-9.]/g, '')) || 10.0;

          const rowErrors: string[] = [];
          if (!styleStr) rowErrors.push("Missing style name");
          if (cmPriceNum < 0) rowErrors.push("Invalid CM Price");

          return {
            id: `imported_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            style: styleStr || `Style #${idx + 1}`,
            cmPrice: cmPriceNum,
            plannedQty: plannedQtyNum > 0 ? plannedQtyNum : (qtyProducedNum > 0 ? Math.round(qtyProducedNum * 1.15) : 500),
            qtyProduced: qtyProducedNum,
            smv: smvNum,
            isValid: rowErrors.length === 0,
            errors: rowErrors
          };
        });

        setParsedRows(rows);
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv document.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleApply = () => {
    if (parsedRows.length === 0) return;

    const validStyles: StyleEarning[] = parsedRows
      .filter(r => r.isValid)
      .map(r => ({
        id: r.id,
        style: r.style,
        cmPrice: r.cmPrice,
        plannedQty: r.plannedQty,
        qtyProduced: r.qtyProduced,
        smv: r.smv
      }));

    onApplyStyles(validStyles, importMode);
    setIsOpen(false);
    setParsedRows([]);
    setFileName('');
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition cursor-pointer shadow-2xs"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Import Excel Sheet
        </button>

        <button
          onClick={handleDownloadTemplate}
          title="Download sample Excel template format"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" /> Download Template
        </button>
      </div>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Import Styles, CM Prices & Planned Targets
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload an Excel (.xlsx, .xls) or CSV file with style specs, prices, targets, and output.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {payCycleLabel && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-900">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="font-bold">📅 Target Financial Period (21st–20th Basis):</span>
                    <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md font-mono text-[11px] font-bold">
                      {payCycleLabel}
                    </span>
                  </div>
                  <span className="text-[11px] text-indigo-700 hidden sm:inline">Assumed for New Month (21st-20th cycle)</span>
                </div>
              )}

              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
                  isDragOver 
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]' 
                    : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/80'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                  <Upload className="w-6 h-6" />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {fileName ? `Selected: ${fileName}` : 'Click or Drag & Drop Excel File Here'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Supports <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">.xlsx</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">.xls</code>, and <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">.csv</code>
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                    Expected Columns: Style Code | CM Price | Planned Target Qty | Actual Qty
                  </span>
                </div>
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900">
                        Parsed {parsedRows.length} Styles from File
                      </span>
                    </div>

                    {/* Import Mode Radio Switch */}
                    <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-xl text-xs font-medium border border-slate-200">
                      <label className={`flex items-center gap-1.5 px-3 py-1 rounded-lg cursor-pointer transition ${importMode === 'merge' ? 'bg-white font-bold text-indigo-900 shadow-xs' : 'text-slate-600'}`}>
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                          className="hidden"
                        />
                        <Plus className="w-3 h-3 text-indigo-600" /> Append to Existing
                      </label>
                      <label className={`flex items-center gap-1.5 px-3 py-1 rounded-lg cursor-pointer transition ${importMode === 'replace' ? 'bg-white font-bold text-rose-900 shadow-xs' : 'text-slate-600'}`}>
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="hidden"
                        />
                        <RefreshCw className="w-3 h-3 text-rose-600" /> Replace All Styles
                      </label>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Style Code</th>
                          <th className="p-2.5 text-right">CM Price</th>
                          <th className="p-2.5 text-right">Planned Qty</th>
                          <th className="p-2.5 text-right">Actual Qty</th>
                          <th className="p-2.5 text-right">Expected Rev</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800 font-mono text-[11px]">
                        {parsedRows.map((r, i) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-2.5 text-slate-400 font-sans">{i + 1}</td>
                            <td className="p-2.5 font-bold font-sans text-slate-900">{r.style}</td>
                            <td className="p-2.5 text-right">{currency} {r.cmPrice.toFixed(2)}</td>
                            <td className="p-2.5 text-right text-indigo-700 font-bold">{r.plannedQty.toLocaleString()}</td>
                            <td className="p-2.5 text-right font-bold">{r.qtyProduced.toLocaleString()}</td>
                            <td className="p-2.5 text-right text-emerald-700 font-bold">
                              {currency} {(r.plannedQty * r.cmPrice).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-2.5 text-center font-sans">
                              {r.isValid ? (
                                <span className="inline-flex items-center text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                  Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full font-bold" title={r.errors.join(", ")}>
                                  Error
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={handleDownloadTemplate}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download Excel Format Template
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={parsedRows.length === 0 || !parsedRows.some(r => r.isValid)}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition cursor-pointer shadow-xs"
                >
                  Apply {parsedRows.filter(r => r.isValid).length} Imported Styles
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
