import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import './XlsxViewer.css';

interface XlsxViewerProps {
  url: string;
}

export default function XlsxViewer({ url }: XlsxViewerProps) {
  const [data, setData] = useState<any[][]>([]);
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
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (isMounted) {
          setData(jsonData);
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

  if (!data || data.length === 0) {
    return (
      <div className="xlsx-empty">
        <p>A planilha está vazia.</p>
      </div>
    );
  }

  const maxCols = Math.max(...data.map(row => row.length));
  const cols = Array.from({ length: maxCols }, (_, i) => i);

  return (
    <div className="xlsx-viewer-container">
      <div className="xlsx-table-wrapper">
        <table className="xlsx-table">
          <thead>
            <tr>
              {cols.map(colIndex => (
                <th key={colIndex}>{data[0]?.[colIndex] ?? ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(1).map((row: any[], rowIndex: number) => (
              <tr key={rowIndex}>
                {cols.map(colIndex => (
                  <td key={colIndex}>{row[colIndex] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
