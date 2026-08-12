import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { UploadCloud, FileText, X, Info } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';
import './Admin.css';

const CATEGORIES = [
  'Produtos e tabelas',
  'Culturas',
  'Resultados',
  'Palestras',
];

interface Subcategory {
  id: string;
  name: string;
  category: string;
}

export default function Admin() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subcategoryId, setSubcategoryId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  useEffect(() => {
    api.get<Subcategory[]>('/subcategories').then(res => setSubcategories(res.data)).catch(() => {});
  }, []);

  useEffect(() => { setSubcategoryId(''); }, [category]);

  const subsForCategory = subcategories.filter(s => s.category === category);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') setSelectedFile(file);
    else toast.error('Apenas arquivos PDF são permitidos.');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    if (!subcategoryId) { toast.error('Selecione uma subcategoria.'); return; }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('category', category);
    formData.append('subcategoryId', subcategoryId);

    try {
      await api.post('/pdfs', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('PDF enviado com sucesso!');
      setSelectedFile(null);
      setSubcategoryId('');
    } catch {
      toast.error('Falha no upload. Verifique suas permissões de Admin.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className="page-header animate-fade-in">
        <h1>Upload de PDF</h1>
        <p>Envie novos documentos para o repositório.</p>
      </div>

      <div className="admin-layout animate-fade-in">
        {/* Upload Card */}
        <div className="card upload-card">
          <div className="upload-card-header">
            <h2>Enviar Novo Documento</h2>
            <p>Faça upload de PDFs para disponibilizá-los no aplicativo.</p>
          </div>

          <form onSubmit={handleUpload}>
            <div className="input-group">
              <label htmlFor="category">Categoria</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="subcategory">Subcategoria <span className="label-required">*</span></label>
              {subsForCategory.length === 0 ? (
                <div className="no-subs-hint">
                  Nenhuma subcategoria em "{category}". Acesse <strong>Gerenciamento</strong> para criar uma.
                </div>
              ) : (
                <select id="subcategory" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} required>
                  <option value="">Selecione uma subcategoria...</option>
                  {subsForCategory.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            <div
              className={`upload-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input type="file" accept=".pdf,.xlsx" id="file-upload" className="file-input-hidden" onChange={handleFileChange} />
              {!selectedFile ? (
                <label htmlFor="file-upload" className="dropzone-label">
                  <div className="dropzone-icon"><UploadCloud size={32} color="var(--accent)" /></div>
                  <h3>Clique para selecionar ou arraste o arquivo</h3>
                  <p>Somente arquivos no formato .PDF e .XLSX</p>
                </label>
              ) : (
                <div className="file-preview">
                  <div className="file-preview-icon"><FileText size={24} color="var(--accent)" /></div>
                  <div className="file-preview-info">
                    <div className="file-preview-name">{selectedFile.name}</div>
                    <div className="file-preview-size">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                  <button type="button" className="file-preview-remove" onClick={() => setSelectedFile(null)} title="Remover">
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>

            <div className="upload-form-actions">
              <button type="submit" className="btn btn-primary" disabled={!selectedFile || uploading || !subcategoryId}>
                {uploading ? <><span className="spinner" /> Enviando...</> : <><UploadCloud size={18} /> Fazer Upload</>}
              </button>
            </div>
          </form>
        </div>

        {/* Tips Card */}
        <div className="card tips-card">
          <h3><Info size={16} color="var(--accent)" /> Dicas de uso</h3>
          <ul className="tip-list">
            <li className="tip-item"><span className="tip-bullet" /><span>Apenas arquivos <strong>.PDF</strong> e <strong>.XLSX</strong> são aceitos pelo sistema.</span></li>
            <li className="tip-item"><span className="tip-bullet" /><span>Escolha a <strong>categoria e subcategoria corretas</strong> antes de enviar.</span></li>
            <li className="tip-item"><span className="tip-bullet" /><span>Documentos enviados ficam disponíveis <strong>imediatamente</strong> no app mobile.</span></li>
            <li className="tip-item"><span className="tip-bullet" /><span>Gerencie subcategorias e PDFs existentes na aba <strong>Gerenciamento</strong>.</span></li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
