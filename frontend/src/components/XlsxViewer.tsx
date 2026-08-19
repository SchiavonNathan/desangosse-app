import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import './XlsxViewer.css';

interface XlsxViewerProps {
  url: string;
}

export default function XlsxViewer({ url }: XlsxViewerProps) {
  const [sheets, setSheets] = useState<{ name: string; data: any[][] }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAndParse = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha ao baixar o arquivo da planilha');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        const parsed = workbook.SheetNames.map(name => {
          const worksheet = workbook.Sheets[name];
          const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          return { name, data: jsonData };
        });
        
        if (isMounted) {
          setSheets(parsed);
          setActiveSheet(0);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Erro ao processar a planilha');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAndParse();
    
    return () => {
      isMounted = false;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="xlsx-loading">
        <div className="spinner spinner-lg" />
        <span>Carregando planilha...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="xlsx-error">
        <p>Erro: {error}</p>
      </div>
    );
  }

  if (!sheets.length || !sheets[activeSheet]?.data?.length) {
    return (
      <div className="xlsx-empty">
        <p>A planilha está vazia.</p>
      </div>
    );
  }

  const data = sheets[activeSheet].data;
  const maxCols = Math.max(...data.map(row => row.length));
  const cols = Array.from({ length: maxCols }, (_, i) => i);

  return (
    <div className="xlsx-viewer-container">
      {/* Sheet tabs (only show if multiple sheets) */}
      {sheets.length > 1 && (
        <div className="xlsx-sheet-tabs">
          {sheets.map((sheet, i) => (
            <button
              key={i}
              className={`xlsx-sheet-tab ${i === activeSheet ? 'active' : ''}`}
              onClick={() => setActiveSheet(i)}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      <div className="xlsx-table-wrapper">
        <table className="xlsx-table">
          <thead>
            <tr>
              <th className="xlsx-row-number">#</th>
              {cols.map(colIndex => (
                <th key={colIndex}>{data[0]?.[colIndex] ?? ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(1).map((row: any[], rowIndex: number) => (
              <tr key={rowIndex}>
                <td className="xlsx-row-number">{rowIndex + 1}</td>
                {cols.map(colIndex => (
                  <td key={colIndex}>{row[colIndex] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="xlsx-statusbar">
        <span>{data.length - 1} linhas × {maxCols} colunas</span>
        <span>Planilha: {sheets[activeSheet].name}</span>
      </div>
    </div>
  );
}
