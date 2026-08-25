import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  FileText, Download, Eye, X, ExternalLink, Pencil,
  Check, XCircle, ChevronRight, FileSpreadsheet,
  BookOpen, Award, ArrowLeft, Trash2, AlertTriangle, Folder, FolderOpen,
  Maximize2, Minimize2,
} from 'lucide-react';
import { api, resolveApiUrl } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import './Dashboard.css';
import XlsxViewer from '../components/XlsxViewer';

interface Subcategory {
  id: string;
  name: string;
  category: string;
  iconUrl?: string;
  _count: { pdfs: number };
}

interface PdfMetadata {
  id: string;
  name: string;
  hash: string;
  url_download: string;
  category: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
}

const CATEGORIES = [
  { key: 'Produtos e tabelas', label: 'Produtos e Tabelas', icon: FileSpreadsheet },
  { key: 'Culturas',           label: 'Culturas',           icon: BookOpen },
  { key: 'Resultados',         label: 'Resultados',         icon: Award },
  { key: 'Palestras',          label: 'Palestras',          icon: FileText },
];

export default function Dashboard() {
  const [pdfs, setPdfs] = useState<PdfMetadata[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPdf, setSelectedPdf] = useState<PdfMetadata | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modalExpanded, setModalExpanded] = useState(false);

  // ---- Move state ----
  const [movingPdf, setMovingPdf] = useState<PdfMetadata | null>(null);
  const [moveCategory, setMoveCategory] = useState('');
  const [moveSubcategoryId, setMoveSubcategoryId] = useState('');
  const [moving, setMoving] = useState(false);

  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const subParam = searchParams.get('sub'); // subcategoryId
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pdfsRes, subsRes, hiddenRes] = await Promise.all([
          api.get('/pdfs'),
          api.get('/subcategories'),
          api.get('/categories/hidden').catch(() => ({ data: [] })),
        ]);
        setPdfs(pdfsRes.data);
        setSubcategories(subsRes.data);
        setHiddenCategories(hiddenRes.data);
      } catch {
        toast.error('Erro ao carregar documentos.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (pdf: PdfMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(pdf.id);
    setEditName(pdf.name);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const confirmRename = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const trimmed = editName.trim();
    if (!trimmed) { cancelEditing(); return; }
    try {
      const response = await api.patch(`/pdfs/${id}`, { name: trimmed });
      setPdfs((prev) => prev.map((p) => p.id === id ? { ...p, name: response.data.name } : p));
      if (selectedPdf?.id === id) setSelectedPdf((prev) => prev ? { ...prev, name: response.data.name } : prev);
      toast.success('PDF renomeado com sucesso!');
    } catch {
      toast.error('Erro ao renomear o PDF.');
    } finally {
      setEditingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') confirmRename(id);
    if (e.key === 'Escape') cancelEditing();
  };

  const openViewer = (pdf: PdfMetadata) => {
    if (editingId) return;
    setSelectedPdf(pdf);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/pdfs/${confirmDeleteId}`);
      setPdfs((prev) => prev.filter((p) => p.id !== confirmDeleteId));
      if (selectedPdf?.id === confirmDeleteId) setSelectedPdf(null);
      toast.success('PDF excluído com sucesso!');
    } catch {
      toast.error('Erro ao excluir o PDF.');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const openMoveModal = (pdf: PdfMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setMovingPdf(pdf);
    setMoveCategory(pdf.category || CATEGORIES[0].key);
    setMoveSubcategoryId(pdf.subcategoryId || '');
  };

  const subsForMoveCategory = subcategories.filter(s => s.category === moveCategory);

  const handleMove = async () => {
    if (!movingPdf || !moveSubcategoryId) return;
    setMoving(true);
    try {
      const res = await api.patch(`/pdfs/${movingPdf.id}`, { subcategoryId: moveSubcategoryId });
      setPdfs(prev => prev.map(p => p.id === movingPdf.id ? {
        ...p,
        category: res.data.category,
        subcategoryId: res.data.subcategoryId,
        subcategoryName: res.data.subcategoryName,
      } : p));
      toast.success('PDF movido com sucesso!');
      setMovingPdf(null);
    } catch {
      toast.error('Erro ao mover o PDF.');
    } finally {
      setMoving(false);
    }
  };

  // ---- Derived data ----
  const currentCategory = CATEGORIES.find((c) => c.key === categoryParam);
  const currentSub = subcategories.find(s => s.id === subParam);

  const subsInCategory = subcategories.filter(s => s.category === categoryParam);

  const filteredPdfs = (() => {
    if (!categoryParam) return [];
    if (subParam) {
      return pdfs.filter(p => p.subcategoryId === subParam);
    }
    return pdfs.filter(p => p.category === categoryParam);
  })();

  // ---- HOME VIEW ----
  if (!categoryParam) {
    return (
      <Layout>
        <div className="page-header animate-fade-in">
          <h1>Início</h1>
          <p>Selecione uma categoria para visualizar os documentos.</p>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner spinner-lg" />
            <span>Carregando documentos...</span>
          </div>
        ) : (
          <div className="main-category-grid animate-fade-in">
            {CATEGORIES.map(({ key, label, icon: Icon }) => {
              const count = pdfs.filter((p) => p.category === key).length;
              return (
                <div
                  key={key}
                  className="main-category-card"
                  onClick={() => navigate(`/dashboard?category=${encodeURIComponent(key)}`)}
                >
                  <div className="main-category-card-info">
                    <h3>{label}</h3>
                    <span>{count} {count === 1 ? 'documento' : 'documentos'}</span>
                  </div>
                  <div className="main-category-card-icon">
                    <img 
                      src={resolveApiUrl(`/categories/find-image/${encodeURIComponent(key)}?t=${Date.now()}`)} 
                      alt={label} 
                      className="main-category-card-img" 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.removeAttribute('style');
                      }} 
                    />
                    <Icon size={34} color="var(--accent)" style={{ display: 'none' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Layout>
    );
  }

  // ---- SUBCATEGORY LIST VIEW (category selected, no sub yet) ----
  if (categoryParam && !subParam) {
    return (
      <Layout>
        <div className="category-view-header animate-fade-in">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} />
          </button>
          <div className="breadcrumb">
            <span>Início</span>
            <ChevronRight size={14} />
            <span className="breadcrumb-current">{currentCategory?.label || categoryParam}</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner spinner-lg" />
            <span>Carregando...</span>
          </div>
        ) : subsInCategory.length === 0 ? (
          <div className="empty-state animate-fade-in">
            <Folder size={48} color="var(--text-muted)" />
            <h3>Nenhuma subcategoria encontrada</h3>
            <p>O admin ainda não criou subcategorias para esta categoria.</p>
          </div>
        ) : (
          <div className="category-grid animate-fade-in">
            {subsInCategory.map((sub) => {
              const count = pdfs.filter(p => p.subcategoryId === sub.id).length;
              return (
                <div
                  key={sub.id}
                  className="category-card"
                  onClick={() => navigate(`/dashboard?category=${encodeURIComponent(categoryParam)}&sub=${sub.id}`)}
                >
                  <div className="category-card-icon">
                    {sub.iconUrl ? (
                      <img src={resolveApiUrl(sub.iconUrl)} alt="Ícone" className="dashboard-subcat-icon" />
                    ) : (
                      <Folder size={34} color="var(--accent)" />
                    )}
                  </div>
                  <div className="category-card-info">
                    <h3>{sub.name}</h3>
                    <span>{count} {count === 1 ? 'documento' : 'documentos'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Layout>
    );
  }

  // ---- PDF LIST VIEW (category + subcategory selected) ----
  return (
    <Layout>
      <div className="category-view-header animate-fade-in">
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => navigate(`/dashboard?category=${encodeURIComponent(categoryParam!)}`)}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="breadcrumb">
          <span
            className="breadcrumb-link"
            onClick={() => navigate('/dashboard')}
          >Início</span>
          <ChevronRight size={14} />
          <span
            className="breadcrumb-link"
            onClick={() => navigate(`/dashboard?category=${encodeURIComponent(categoryParam!)}`)}
          >{currentCategory?.label || categoryParam}</span>
          <ChevronRight size={14} />
          <span className="breadcrumb-current">{currentSub?.name || subParam}</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner spinner-lg" />
          <span>Carregando documentos...</span>
        </div>
      ) : filteredPdfs.length === 0 ? (
        <div className="empty-state animate-fade-in">
          <FileText size={48} color="var(--text-muted)" />
          <h3>Nenhum documento encontrado</h3>
          <p>Nenhum PDF cadastrado nesta subcategoria.</p>
        </div>
      ) : (
        <div className="pdf-list animate-fade-in">
          {filteredPdfs.map((pdf) => (
            <div
              key={pdf.id}
              className="pdf-item"
              onClick={() => openViewer(pdf)}
            >
              <div className="pdf-item-icon">
                {pdf.name.toLowerCase().endsWith('.xlsx') ? (
                  <FileSpreadsheet size={22} color="var(--accent)" />
                ) : (
                  <FileText size={22} color="var(--accent)" />
                )}
              </div>

              {editingId === pdf.id ? (
                <div className="rename-form" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={inputRef}
                    className="rename-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, pdf.id)}
                  />
                  <button className="btn btn-primary btn-icon btn-sm" onClick={(e) => confirmRename(pdf.id, e)}>
                    <Check size={14} />
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={cancelEditing}>
                    <XCircle size={14} />
                  </button>
                </div>
              ) : (
                <div className="pdf-item-info">
                  <div className="pdf-item-name">{pdf.name}</div>
                  <div className="pdf-item-meta">{pdf.subcategoryName || pdf.category}</div>
                </div>
              )}

              {editingId !== pdf.id && (
                <div className="pdf-item-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Visualizar" onClick={() => openViewer(pdf)}>
                    <Eye size={16} />
                  </button>
                  {isAdmin && (
                    <button className="btn btn-ghost btn-icon btn-sm" title="Renomear" onClick={(e) => startEditing(pdf, e)}>
                      <Pencil size={16} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      title="Mover para outra subcategoria"
                      onClick={(e) => openMoveModal(pdf, e)}
                    >
                      <FolderOpen size={16} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="btn btn-ghost btn-icon btn-sm btn-danger"
                      title="Excluir"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(pdf.id); }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <a
                    href={resolveApiUrl(pdf.url_download)}
                    download
                    className="btn btn-outline btn-icon btn-sm"
                    title="Baixar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download size={16} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedPdf && createPortal(
        <div className="pdf-modal-overlay animate-fade-in" onClick={() => { setSelectedPdf(null); setModalExpanded(false); }}>
          <div className={`pdf-modal ${modalExpanded ? 'pdf-modal-expanded' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="pdf-modal-header">
              <div className="pdf-modal-title">
                {selectedPdf.name.toLowerCase().endsWith('.xlsx') ? (
                  <FileSpreadsheet size={18} color="var(--primary)" />
                ) : (
                  <FileText size={18} color="var(--primary)" />
                )}
                <span>{selectedPdf.name}</span>
              </div>
              <div className="pdf-modal-actions">
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => setModalExpanded(prev => !prev)}
                  title={modalExpanded ? 'Reduzir' : 'Expandir'}
                >
                  {modalExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <a href={resolveApiUrl(selectedPdf.url_download)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon btn-sm">
                  <ExternalLink size={16} />
                </a>
                <a href={resolveApiUrl(selectedPdf.url_download)} download className="btn btn-primary btn-icon btn-sm">
                  <Download size={16} />
                </a>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setSelectedPdf(null); setModalExpanded(false); }}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="pdf-modal-body">
              {selectedPdf.name.toLowerCase().endsWith('.xlsx') ? (
                <XlsxViewer url={resolveApiUrl(selectedPdf.url_download)} />
              ) : (
                <iframe src={resolveApiUrl(selectedPdf.url_download)} title={selectedPdf.name} className="pdf-iframe" />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDeleteId && createPortal(
        <div className="pdf-modal-overlay animate-fade-in" onClick={() => !deleting && setConfirmDeleteId(null)}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-icon">
              <AlertTriangle size={32} color="#ef4444" />
            </div>
            <h3>Excluir documento</h3>
            <p>Tem certeza que deseja excluir <strong>{pdfs.find(p => p.id === confirmDeleteId)?.name}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="delete-confirm-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <><span className="spinner" /> Excluindo...</> : <><Trash2 size={16} /> Excluir</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {movingPdf && createPortal(
        <div className="pdf-modal-overlay animate-fade-in" onClick={() => !moving && setMovingPdf(null)}>
          <div className="move-modal" onClick={e => e.stopPropagation()}>
            <div className="move-modal-header">
              <FolderOpen size={20} color="var(--accent)" />
              <h3>Mover documento</h3>
            </div>
            <p className="move-modal-subtitle">Selecione a nova localização para <strong>{movingPdf.name}</strong>.</p>

            <div className="move-modal-fields">
              <div className="input-group">
                <label>Categoria</label>
                <select
                  value={moveCategory}
                  onChange={e => { setMoveCategory(e.target.value); setMoveSubcategoryId(''); }}
                >
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label>Subcategoria</label>
                {subsForMoveCategory.length === 0 ? (
                  <div className="no-subs-hint">Nenhuma subcategoria nesta categoria.</div>
                ) : (
                  <select
                    value={moveSubcategoryId}
                    onChange={e => setMoveSubcategoryId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {subsForMoveCategory.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {movingPdf.subcategoryId && (
              <div className="move-modal-current">
                Localização atual: <strong>{movingPdf.category}</strong> › <strong>{movingPdf.subcategoryName}</strong>
              </div>
            )}

            <div className="move-modal-actions">
              <button className="btn btn-ghost" onClick={() => setMovingPdf(null)} disabled={moving}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleMove}
                disabled={moving || !moveSubcategoryId || moveSubcategoryId === movingPdf.subcategoryId}
              >
                {moving ? <><span className="spinner" /> Movendo...</> : <><FolderOpen size={16} /> Mover</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Layout>
  );
}
