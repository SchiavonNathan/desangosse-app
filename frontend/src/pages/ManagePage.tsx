import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Layout from '../components/Layout';
import {
  FolderPlus, Pencil, Check, XCircle, Trash2, AlertTriangle,
  FileText, FolderOpen, Layers, FileCog, ImageIcon, X, Camera,
} from 'lucide-react';
import { api, resolveApiUrl } from '../services/api';
import { toast } from 'sonner';
import './Dashboard.css'; // shared modal + danger button styles
import './ManagePage.css';

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
  iconUrl?: string;
  _count: { pdfs: number };
}

interface PdfItem {
  id: string;
  name: string;
  hash: string;
  url_download: string;
  category: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
}

type Tab = 'subcategories' | 'pdfs' | 'categories';

export default function ManagePage() {
  const [activeTab, setActiveTab] = useState<Tab>('subcategories');

  // ---- Subcategory state ----
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCategory, setNewSubCategory] = useState(CATEGORIES[0]);
  const [newSubIcon, setNewSubIcon] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [confirmDeleteSub, setConfirmDeleteSub] = useState<Subcategory | null>(null);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updatingIconId, setUpdatingIconId] = useState<string | null>(null);
  const iconUpdateRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ---- PDF state ----
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(true);
  const [editingPdfId, setEditingPdfId] = useState<string | null>(null);
  const [editPdfName, setEditPdfName] = useState('');
  const [confirmDeletePdfId, setConfirmDeletePdfId] = useState<string | null>(null);
  const [deletingPdf, setDeletingPdf] = useState(false);
  const [movingPdf, setMovingPdf] = useState<PdfItem | null>(null);
  const [moveCategory, setMoveCategory] = useState('');
  const [moveSubcategoryId, setMoveSubcategoryId] = useState('');
  const [moving, setMoving] = useState(false);
  const [pdfFilterCategory, setPdfFilterCategory] = useState('');

  // ---- Category Images State ----
  const [updatingCategory, setUpdatingCategory] = useState<string | null>(null);
  const categoryImageRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleUpdateCategoryImage = async (categoryName: string, file: File) => {
    setUpdatingCategory(categoryName);
    try {
      const formData = new FormData();
      formData.append('image', file);
      await api.post(`/categories/${encodeURIComponent(categoryName)}/image`, formData);
      toast.success('Imagem da categoria atualizada!');
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast.error('Erro ao atualizar imagem.');
    } finally {
      setUpdatingCategory(null);
    }
  };

  // ---- Load data ----
  const fetchSubs = async () => {
    try {
      const res = await api.get<Subcategory[]>('/subcategories');
      setSubcategories(res.data);
    } catch { toast.error('Erro ao carregar subcategorias.'); }
    finally { setLoadingSubs(false); }
  };

  const fetchPdfs = async () => {
    try {
      const res = await api.get<PdfItem[]>('/pdfs');
      setPdfs(res.data);
    } catch { toast.error('Erro ao carregar PDFs.'); }
    finally { setLoadingPdfs(false); }
  };

  useEffect(() => {
    fetchSubs();
    fetchPdfs();
  }, []);

  // ---- Icon preview ----
  const handleIconChange = (file: File | null) => {
    setNewSubIcon(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setIconPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setIconPreview(null);
    }
  };

  const clearIcon = () => {
    setNewSubIcon(null);
    setIconPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ===== SUBCATEGORY HANDLERS =====
  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSubName.trim();
    if (!name) return;
    setCreatingNew(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('category', newSubCategory);
      if (newSubIcon) {
        formData.append('icon', newSubIcon);
      }
      const res = await api.post<Subcategory>('/subcategories', formData);
      setSubcategories(prev => [...prev, { ...res.data, _count: { pdfs: 0 } }]);
      setNewSubName('');
      clearIcon();
      toast.success('Subcategoria criada!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao criar subcategoria.');
    } finally { setCreatingNew(false); }
  };

  const confirmRenameSub = async (id: string) => {
    const name = editSubName.trim();
    if (!name) { setEditingSubId(null); return; }
    try {
      const res = await api.patch<Subcategory>(`/subcategories/${id}`, { name });
      setSubcategories(prev => prev.map(s => s.id === id ? { ...s, name: res.data.name } : s));
      toast.success('Subcategoria renomeada!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao renomear.');
    } finally { setEditingSubId(null); }
  };

  const handleDeleteSub = async () => {
    if (!confirmDeleteSub) return;
    setDeletingSubId(confirmDeleteSub.id);
    try {
      await api.delete(`/subcategories/${confirmDeleteSub.id}`);
      setSubcategories(prev => prev.filter(s => s.id !== confirmDeleteSub.id));
      toast.success('Subcategoria excluída!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir.');
    } finally {
      setDeletingSubId(null);
      setConfirmDeleteSub(null);
    }
  };

  const groupedSubs = CATEGORIES.map(cat => ({
    category: cat,
    items: subcategories.filter(s => s.category === cat),
  }));

  const handleUpdateIcon = async (id: string, file: File) => {
    setUpdatingIconId(id);
    try {
      const formData = new FormData();
      formData.append('icon', file);
      const res = await api.patch<Subcategory>(`/subcategories/${id}/icon`, formData);
      setSubcategories(prev => prev.map(s => s.id === id ? { ...s, iconUrl: res.data.iconUrl } : s));
      toast.success('Ícone atualizado!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar ícone.');
    } finally {
      setUpdatingIconId(null);
      // Reset the file input
      if (iconUpdateRefs.current[id]) iconUpdateRefs.current[id]!.value = '';
    }
  };

  // ===== PDF HANDLERS =====
  const confirmRenamePdf = async (id: string) => {
    const name = editPdfName.trim();
    if (!name) { setEditingPdfId(null); return; }
    try {
      const res = await api.patch(`/pdfs/${id}`, { name });
      setPdfs(prev => prev.map(p => p.id === id ? { ...p, name: res.data.name } : p));
      toast.success('PDF renomeado!');
    } catch { toast.error('Erro ao renomear.'); }
    finally { setEditingPdfId(null); }
  };

  const handleDeletePdf = async () => {
    if (!confirmDeletePdfId) return;
    setDeletingPdf(true);
    try {
      await api.delete(`/pdfs/${confirmDeletePdfId}`);
      setPdfs(prev => prev.filter(p => p.id !== confirmDeletePdfId));
      toast.success('PDF excluído!');
    } catch { toast.error('Erro ao excluir.'); }
    finally { setDeletingPdf(false); setConfirmDeletePdfId(null); }
  };

  const openMoveModal = (pdf: PdfItem) => {
    setMovingPdf(pdf);
    setMoveCategory(pdf.category || CATEGORIES[0]);
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
      toast.success('PDF movido!');
      setMovingPdf(null);
    } catch { toast.error('Erro ao mover.'); }
    finally { setMoving(false); }
  };

  const filteredPdfs = pdfFilterCategory
    ? pdfs.filter(p => p.category === pdfFilterCategory)
    : pdfs;

  return (
    <Layout>
      <div className="page-header animate-fade-in">
        <h1>Gerenciamento</h1>
        <p>Gerencie subcategorias e documentos do repositório.</p>
      </div>

      {/* Tab bar */}
      <div className="manage-tabs animate-fade-in">
        <button
          className={`manage-tab ${activeTab === 'subcategories' ? 'active' : ''}`}
          onClick={() => setActiveTab('subcategories')}
        >
          <Layers size={16} />
          Subcategorias
        </button>
        <button
          className={`manage-tab ${activeTab === 'pdfs' ? 'active' : ''}`}
          onClick={() => setActiveTab('pdfs')}
        >
          <FileCog size={16} />
          Documentos
          {pdfs.length > 0 && <span className="manage-tab-badge">{pdfs.length}</span>}
        </button>
        <button
          className={`manage-tab ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          <ImageIcon size={16} />
          Categorias Principais
        </button>
      </div>

      {/* ===== TAB: CATEGORIES ===== */}
      {activeTab === 'categories' && (
        <div className="manage-content animate-fade-in">
          <div className="card manage-list-card">
            <h3>Gerenciar Imagens das Categorias</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Altere a imagem de fundo que aparece para cada categoria na tela de Início.
            </p>
            <div className="manage-table-wrapper">
              <table className="manage-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th style={{ width: '150px' }}>Imagem Atual</th>
                    <th style={{ width: '200px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map(cat => (
                    <tr key={cat}>
                      <td>
                        <strong>{cat}</strong>
                      </td>
                      <td>
                        <img 
                          src={resolveApiUrl(`/categories/find-image/${encodeURIComponent(cat)}?t=${Date.now()}`)} 
                          alt={cat}
                          style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4, background: '#f0f0f0' }}
                          onError={(e) => {
                            // Fallback se não existir imagem no backend
                            e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" fill="%23ccc"><rect width="80" height="60"/></svg>';
                          }}
                        />
                      </td>
                      <td>
                        <div className="manage-actions">
                          <input
                            type="file"
                            accept="image/jpeg, image/png, image/webp"
                            style={{ display: 'none' }}
                            ref={el => { categoryImageRefs.current[cat] = el; }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpdateCategoryImage(cat, file);
                            }}
                          />
                          <button 
                            className="btn-icon" 
                            title="Alterar imagem"
                            onClick={() => categoryImageRefs.current[cat]?.click()}
                            disabled={updatingCategory === cat}
                          >
                            <Camera size={18} />
                            <span style={{ marginLeft: 8, fontSize: '0.85rem' }}>
                              {updatingCategory === cat ? 'Enviando...' : 'Alterar Foto'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: SUBCATEGORIES ===== */}
      {activeTab === 'subcategories' && (
        <div className="manage-content animate-fade-in">

          {/* Create new */}
          <div className="card manage-create-card">
            <h3><FolderPlus size={18} color="var(--accent)" /> Nova Subcategoria</h3>
            <form className="manage-create-form-v2" onSubmit={handleCreateSub}>

              {/* Row 1: category + name */}
              <div className="manage-create-row">
                <div className="manage-field-group">
                  <label className="manage-field-label">Categoria</label>
                  <select value={newSubCategory} onChange={(e) => setNewSubCategory(e.target.value)}>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className="manage-field-group manage-field-grow">
                  <label className="manage-field-label">Nome da subcategoria</label>
                  <input
                    type="text"
                    placeholder="Ex: Sementes, Herbicidas..."
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    maxLength={80}
                  />
                </div>
              </div>

              {/* Row 2: icon + button */}
              <div className="manage-create-row manage-create-row-bottom">
                <div className="manage-icon-picker">
                  <label className="manage-field-label">Ícone (opcional)</label>
                  <div className="manage-icon-picker-inner">
                    {iconPreview ? (
                      <div className="manage-icon-preview-wrap">
                        <img src={iconPreview} alt="Preview" className="manage-icon-preview" />
                        <button type="button" className="manage-icon-clear" onClick={clearIcon} title="Remover ícone">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="manage-icon-placeholder" onClick={() => fileInputRef.current?.click()}>
                        <ImageIcon size={22} color="var(--text-muted)" />
                        <span>Clique para selecionar</span>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg, image/png, image/webp"
                      onChange={(e) => handleIconChange(e.target.files?.[0] || null)}
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary manage-create-btn"
                  disabled={!newSubName.trim() || creatingNew}
                >
                  {creatingNew ? <span className="spinner" /> : <><FolderPlus size={16} /> Criar Subcategoria</>}
                </button>
              </div>
            </form>
          </div>

          {/* List by category */}
          {loadingSubs ? (
            <div className="loading-state"><div className="spinner spinner-lg" /><span>Carregando...</span></div>
          ) : (
            <div className="subcats-sections">
              {groupedSubs.map(({ category: cat, items }) => (
                <div key={cat} className="subcats-section">
                  <div className="subcats-section-header">
                    <span className="subcats-section-title">{cat}</span>
                    <span className="subcats-section-count">{items.length} subcategoria{items.length !== 1 ? 's' : ''}</span>
                  </div>

                  {items.length === 0 ? (
                    <div className="subcat-empty-state">
                      <FolderPlus size={28} color="var(--text-muted)" />
                      <span>Nenhuma subcategoria criada ainda.</span>
                    </div>
                  ) : (
                    <div className="subcats-cards">
                      {items.map(sub => (
                        <div key={sub.id} className="subcat-card">
                          <div className="subcat-card-icon">
                            {sub.iconUrl
                              ? <img src={resolveApiUrl(sub.iconUrl)} alt="Ícone" className="subcat-card-img" />
                              : <FolderOpen size={36} color="var(--accent)" />
                            }
                            {/* Overlay button to change icon */}
                            <button
                              className="subcat-card-icon-change"
                              title="Alterar ícone"
                              onClick={() => iconUpdateRefs.current[sub.id]?.click()}
                              disabled={updatingIconId === sub.id}
                            >
                              {updatingIconId === sub.id
                                ? <span className="spinner" style={{ width: 12, height: 12 }} />
                                : <Camera size={13} />
                              }
                            </button>
                            <input
                              type="file"
                              accept="image/jpeg, image/png, image/webp"
                              style={{ display: 'none' }}
                              ref={el => { iconUpdateRefs.current[sub.id] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpdateIcon(sub.id, file);
                              }}
                            />
                          </div>

                          {editingSubId === sub.id ? (
                            <div className="subcat-card-rename">
                              <input
                                className="rename-input"
                                value={editSubName}
                                onChange={e => setEditSubName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') confirmRenameSub(sub.id); if (e.key === 'Escape') setEditingSubId(null); }}
                                autoFocus
                              />
                              <button className="btn btn-primary btn-icon btn-sm" onClick={() => confirmRenameSub(sub.id)}><Check size={15} /></button>
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingSubId(null)}><XCircle size={15} /></button>
                            </div>
                          ) : (
                            <div className="subcat-card-info">
                              <span className="subcat-card-name">{sub.name}</span>
                              <span className="subcat-card-count">{sub._count.pdfs} PDF{sub._count.pdfs !== 1 ? 's' : ''}</span>
                            </div>
                          )}

                          {editingSubId !== sub.id && (
                            <div className="subcat-card-actions">
                              <button
                                className="btn btn-ghost btn-icon"
                                title="Renomear"
                                onClick={() => { setEditingSubId(sub.id); setEditSubName(sub.name); }}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-danger"
                                title="Excluir"
                                onClick={() => setConfirmDeleteSub(sub)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: PDFs ===== */}
      {activeTab === 'pdfs' && (
        <div className="manage-content animate-fade-in">
          <div className="manage-pdf-toolbar">
            <select value={pdfFilterCategory} onChange={e => setPdfFilterCategory(e.target.value)}>
              <option value="">Todas as categorias</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <span className="manage-pdf-count">{filteredPdfs.length} documento{filteredPdfs.length !== 1 ? 's' : ''}</span>
          </div>

          {loadingPdfs ? (
            <div className="loading-state"><div className="spinner spinner-lg" /><span>Carregando...</span></div>
          ) : filteredPdfs.length === 0 ? (
            <div className="empty-state animate-fade-in">
              <FileText size={48} color="var(--text-muted)" />
              <h3>Nenhum documento encontrado</h3>
              <p>Faça upload de PDFs na aba "Upload de PDF".</p>
            </div>
          ) : (
            <div className="manage-pdf-list">
              {filteredPdfs.map(pdf => (
                <div key={pdf.id} className="manage-pdf-item">
                  <div className="manage-pdf-icon">
                    <FileText size={20} color="var(--accent)" />
                  </div>

                  {editingPdfId === pdf.id ? (
                    <div className="manage-pdf-rename">
                      <input
                        className="rename-input"
                        value={editPdfName}
                        onChange={e => setEditPdfName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') confirmRenamePdf(pdf.id); if (e.key === 'Escape') setEditingPdfId(null); }}
                        autoFocus
                      />
                      <button className="btn btn-primary btn-icon btn-sm" onClick={() => confirmRenamePdf(pdf.id)}><Check size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingPdfId(null)}><XCircle size={14} /></button>
                    </div>
                  ) : (
                    <div className="manage-pdf-info">
                      <div className="manage-pdf-name">{pdf.name}</div>
                      <div className="manage-pdf-meta">
                        <span className="manage-pdf-cat">{pdf.category}</span>
                        {pdf.subcategoryName && (
                          <><span className="manage-pdf-sep">›</span><span className="manage-pdf-subcat">{pdf.subcategoryName}</span></>
                        )}
                      </div>
                    </div>
                  )}

                  {editingPdfId !== pdf.id && (
                    <div className="manage-pdf-actions">
                      <button className="btn btn-ghost btn-icon btn-sm" title="Renomear" onClick={() => { setEditingPdfId(pdf.id); setEditPdfName(pdf.name); }}>
                        <Pencil size={15} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Mover" onClick={() => openMoveModal(pdf)}>
                        <FolderOpen size={15} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm btn-danger" title="Excluir" onClick={() => setConfirmDeletePdfId(pdf.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== MODALS ===== */}

      {confirmDeleteSub && createPortal(
        <div className="pdf-modal-overlay animate-fade-in" onClick={() => !deletingSubId && setConfirmDeleteSub(null)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-icon"><AlertTriangle size={32} color="#ef4444" /></div>
            <h3>Excluir subcategoria</h3>
            <p>
              Tem certeza que deseja excluir <strong>{confirmDeleteSub.name}</strong>?
              {confirmDeleteSub._count.pdfs > 0 && (
                <> Esta subcategoria possui <strong>{confirmDeleteSub._count.pdfs} PDF(s)</strong> vinculados e não pode ser excluída.</>
              )}
            </p>
            <div className="delete-confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDeleteSub(null)} disabled={!!deletingSubId}>Cancelar</button>
              {confirmDeleteSub._count.pdfs === 0 && (
                <button className="btn btn-danger" onClick={handleDeleteSub} disabled={!!deletingSubId}>
                  {deletingSubId ? <><span className="spinner" /> Excluindo...</> : <><Trash2 size={16} /> Excluir</>}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDeletePdfId && createPortal(
        <div className="pdf-modal-overlay animate-fade-in" onClick={() => !deletingPdf && setConfirmDeletePdfId(null)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-icon"><AlertTriangle size={32} color="#ef4444" /></div>
            <h3>Excluir documento</h3>
            <p>Tem certeza que deseja excluir <strong>{pdfs.find(p => p.id === confirmDeletePdfId)?.name}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="delete-confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDeletePdfId(null)} disabled={deletingPdf}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDeletePdf} disabled={deletingPdf}>
                {deletingPdf ? <><span className="spinner" /> Excluindo...</> : <><Trash2 size={16} /> Excluir</>}
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
                <select value={moveCategory} onChange={e => { setMoveCategory(e.target.value); setMoveSubcategoryId(''); }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Subcategoria</label>
                {subsForMoveCategory.length === 0 ? (
                  <div className="no-subs-hint">Nenhuma subcategoria nesta categoria.</div>
                ) : (
                  <select value={moveSubcategoryId} onChange={e => setMoveSubcategoryId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {subsForMoveCategory.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
              <button className="btn btn-ghost" onClick={() => setMovingPdf(null)} disabled={moving}>Cancelar</button>
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
