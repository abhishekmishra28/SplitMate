import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import API from '../services/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Upload, FileText, AlertTriangle, CheckCircle, XCircle,
  Info, ChevronDown, ChevronUp, Eye, SkipForward, Download,
  Loader
} from 'lucide-react';

const SEVERITY_CONFIG = {
  info: { color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-700/30', icon: Info },
  warn: { color: 'text-amber-400', bg: 'bg-amber-900/20', border: 'border-amber-700/30', icon: AlertTriangle },
  error: { color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-700/30', icon: XCircle },
  approval: { color: 'text-violet-400', bg: 'bg-violet-900/20', border: 'border-violet-700/30', icon: Eye },
};

function AnomalyCard({ anomaly }) {
  const cfg = SEVERITY_CONFIG[anomaly.severity] || SEVERITY_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-3`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-mono font-medium ${cfg.color}`}>{anomaly.type}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
              {anomaly.severity.toUpperCase()}
            </span>
          </div>
          <p className="text-gray-300 text-xs">{anomaly.message}</p>
          {anomaly.originalValue && (
            <p className="text-gray-600 text-xs mt-1">
              <span className="text-gray-500">Original: </span>
              <code className="bg-gray-800 px-1 rounded">{anomaly.originalValue}</code>
              {anomaly.suggestedValue && (
                <>
                  <span className="text-gray-500 mx-1">→</span>
                  <code className="bg-gray-800 px-1 rounded text-green-400">{anomaly.suggestedValue}</code>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProcessedRowCard({ row }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = {
    ok: 'border-emerald-700/30 bg-emerald-900/10',
    warn: 'border-amber-700/30 bg-amber-900/10',
    error: 'border-red-700/30 bg-red-900/10',
    approval: 'border-violet-700/30 bg-violet-900/10',
  }[row.status] || 'border-gray-700/30 bg-gray-800/10';

  const StatusIcon = {
    ok: CheckCircle,
    warn: AlertTriangle,
    error: XCircle,
    approval: Eye,
  }[row.status] || CheckCircle;

  const statusIconColor = {
    ok: 'text-emerald-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
    approval: 'text-violet-400',
  }[row.status] || 'text-gray-400';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${statusColor}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon className={`w-4 h-4 ${statusIconColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-500 text-xs">Row {row.rowNumber}</span>
            <span className="text-white text-sm font-medium truncate">{row.original.description || '(no description)'}</span>
            {row.original.amount && (
              <span className="text-gray-400 text-xs">
                {row.original.currency || 'INR'} {row.original.amount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {row.original.date && <span className="text-gray-600 text-xs">{row.original.date}</span>}
            {row.original.paidBy && <span className="text-gray-600 text-xs">by {row.original.paidBy}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {row.anomalies?.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
              {row.anomalies.length} issue{row.anomalies.length !== 1 ? 's' : ''}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
        </div>
      </div>

      {expanded && row.anomalies?.length > 0 && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-800/50">
          <div className="pt-3 space-y-2">
            {row.anomalies.map((anomaly, i) => (
              <AnomalyCard key={i} anomaly={anomaly} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportCSV() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  
  const [phase, setPhase] = useState('upload'); // upload | analyzing | review | importing | done
  const [filename, setFilename] = useState('');
  const [dragOver, setDragOver] = useState(false);
  
  const [importReport, setImportReport] = useState(null);
  const [processedRows, setProcessedRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('all');

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setFilename(file.name);
    setPhase('analyzing');

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await API.post(`/import/upload/${groupId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        setImportReport(res.data.report);
        setProcessedRows(res.data.report.report?.processedRows || []);
        setSummary(res.data.summary);
        setPhase('review');
        toast.success(`Analyzed ${res.data.summary.totalRows} rows`);
      } else {
        throw new Error(res.data.message || 'Failed to upload CSV');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to parse CSV');
      setPhase('upload');
    }
  }, [groupId]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  const handleConfirmImport = async () => {
    if (!importReport?.id) return;
    if (phase === 'importing') return; // Prevent double-click
    
    setPhase('importing');
    try {
      // Approve is idempotent — already approved is fine
      try {
        await API.post(`/import/report/${importReport.id}/approve`);
      } catch (approveErr) {
        // If it says "already approved", that's OK — continue to execute
        const msg = approveErr.response?.data?.message || '';
        if (!msg.toLowerCase().includes('already')) {
          throw approveErr;
        }
      }

      const execRes = await API.post(`/import/execute/${importReport.id}`);
      setSummary(prev => ({ ...prev, importedRows: execRes.data.importedRows }));
      setPhase('done');
      toast.success(`Import complete! ${execRes.data.importedRows} records imported.`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to execute import');
      setPhase('review');
    }
  };

  const downloadTemplate = () => {
    const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
2026-04-01,Groceries,Aisha,1200,INR,equal,Aisha;Rohan;Priya,,Monthly groceries
2026-04-02,Dinner,Rohan,800,INR,percentage,Rohan;Priya;Sam,Rohan:50;Priya:30;Sam:20,
2026-04-05,Netflix,Priya,599,INR,equal,,,Streaming subscription`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expense_template.csv';
    a.click();
  };

  const downloadSampleCSV = () => {
    window.open('/expenses_export.csv', '_blank');
  };

  const downloadReport = () => {
    if (!processedRows || processedRows.length === 0) return;

    let reportText = `Import Analysis Report: ${filename}\n`;
    reportText += `Total Rows: ${summary?.totalRows || 0}\n`;
    reportText += `Valid Rows: ${summary?.validRows || 0}\n`;
    reportText += `Error Rows: ${summary?.invalidRows || 0}\n`;
    reportText += `Total Anomalies: ${summary?.anomalyCount || 0}\n\n`;
    reportText += `--- Anomalies Details ---\n\n`;

    const rowsWithAnomalies = processedRows.filter(r => r.anomalies && r.anomalies.length > 0);
    
    if (rowsWithAnomalies.length === 0) {
      reportText += `No anomalies found in the processed rows.\n`;
    } else {
      rowsWithAnomalies.forEach(row => {
        reportText += `Row ${row.rowNumber} (${row.original.description || 'No description'}):\n`;
        row.anomalies.forEach(anomaly => {
          reportText += `  - [${anomaly.severity.toUpperCase()}] ${anomaly.type}: ${anomaly.message}\n`;
          if (anomaly.originalValue !== undefined) {
            reportText += `    Original: ${anomaly.originalValue}\n`;
          }
          if (anomaly.suggestedValue !== undefined) {
            reportText += `    Suggested/Action Taken: ${anomaly.suggestedValue}\n`;
          }
        });
        reportText += `\n`;
      });
    }

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_report_${filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredRows = filter === 'all'
    ? processedRows
    : processedRows.filter(r => r.status === filter);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(`/groups/${groupId}`)} className="text-gray-500 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-white font-bold">Import CSV</h1>
            <p className="text-gray-500 text-xs">Upload expenses from CSV</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-2 mb-8">
          {['Upload', 'Review', 'Import', 'Done'].map((step, i) => {
            const phaseIdx = { upload: 0, analyzing: 0, review: 1, importing: 2, done: 3 }[phase];
            return (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < phaseIdx ? 'bg-emerald-600 text-white' :
                  i === phaseIdx ? 'bg-violet-600 text-white' :
                  'bg-gray-800 text-gray-500'
                }`}>
                  {i < phaseIdx ? '✓' : i + 1}
                </div>
                <span className={`text-sm ${i === phaseIdx ? 'text-white font-medium' : 'text-gray-600'}`}>{step}</span>
                {i < 3 && <div className={`w-8 h-px ${i < phaseIdx ? 'bg-emerald-600' : 'bg-gray-800'}`} />}
              </div>
            );
          })}
        </div>

        {phase === 'upload' && (
          <div className="space-y-6">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-violet-500 bg-violet-900/20'
                  : 'border-gray-700 hover:border-violet-500/50 hover:bg-gray-900/50'
              }`}
            >
              <Upload className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">Drop your CSV file here</p>
              <p className="text-gray-500 text-sm mb-4">or click to browse</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
              <span className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-violet-500 transition-colors">
                Choose File
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  What we detect
                </h3>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>• Exact & fuzzy duplicates</li>
                  <li>• Name inconsistencies & typos</li>
                  <li>• USD → INR conversion</li>
                  <li>• Missing currency (defaults to INR)</li>
                  <li>• Invalid percentages & amounts</li>
                  <li>• Malformed/ambiguous dates</li>
                </ul>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Expected CSV format
                </h3>
                <div className="font-mono text-xs text-gray-400 space-y-0.5">
                  <p>date, description, paid_by</p>
                  <p>amount, currency, split_type</p>
                  <p>split_with, split_details</p>
                  <p>notes (optional)</p>
                </div>
                <div className="flex gap-3 mt-3">
                  <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-xs">
                    <Download className="w-3.5 h-3.5" /> Template
                  </button>
                  <button onClick={downloadSampleCSV} className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-xs">
                    <Download className="w-3.5 h-3.5" /> Sample CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="text-center py-20">
            <Loader className="w-10 h-10 text-violet-400 animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Analyzing {filename}...</p>
            <p className="text-gray-500 text-sm mt-1">Checking anomalies and validating rows on server</p>
          </div>
        )}

        {phase === 'review' && summary && (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Analysis Report — {filename}</h2>
                <div className="flex items-center gap-4">
                  <button onClick={downloadReport} className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors">
                    <Download className="w-4 h-4" /> Download Report
                  </button>
                  <span className="text-gray-500 text-sm">{summary.totalRows} rows analyzed</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-emerald-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{summary.validRows}</p>
                  <p className="text-gray-500 text-xs mt-0.5">Valid rows</p>
                </div>
                <div className="bg-red-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">{summary.invalidRows}</p>
                  <p className="text-gray-500 text-xs mt-0.5">Error rows</p>
                </div>
                <div className="bg-amber-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-400">{summary.anomalyCount}</p>
                  <p className="text-gray-500 text-xs mt-0.5">Total anomalies</p>
                </div>
                <div className="bg-violet-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-violet-400">{processedRows.length}</p>
                  <p className="text-gray-500 text-xs mt-0.5">Processed Rows</p>
                </div>
              </div>
            </div>

            <div className="flex gap-1 flex-wrap">
              {[
                { key: 'all', label: `All (${processedRows.length})` },
                { key: 'ok', label: `Clean (${processedRows.filter(r => r.status === 'ok').length})` },
                { key: 'approval', label: `Approval (${processedRows.filter(r => r.status === 'approval').length})` },
                { key: 'warn', label: `Warn (${processedRows.filter(r => r.status === 'warn').length})` },
                { key: 'error', label: `Error (${processedRows.filter(r => r.status === 'error').length})` },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filter === f.key ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredRows.map(row => (
                <ProcessedRowCard key={row.rowNumber} row={row} />
              ))}
              {filteredRows.length === 0 && (
                <div className="text-center py-8 text-gray-500">No rows in this category</div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setPhase('upload'); setProcessedRows([]); setImportReport(null); }}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm"
              >
                Upload Different File
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={summary.validRows === 0}
                className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve & Import Valid Rows
              </button>
            </div>
          </div>
        )}

        {phase === 'importing' && (
          <div className="text-center py-20">
            <Loader className="w-10 h-10 text-violet-400 animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Importing expenses...</p>
            <p className="text-gray-500 text-sm mt-1">Executing import on server</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-6">
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-2xl p-6 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-white font-bold text-xl mb-1">Import Complete!</h2>
              <p className="text-gray-400">Successfully imported {summary?.importedRows || 0} rows from {filename}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setPhase('upload'); setProcessedRows([]); setImportReport(null); setSummary(null); }}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm"
              >
                Import Another File
              </button>
              <button
                onClick={() => navigate(`/groups/${groupId}`)}
                className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
              >
                View Group
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
