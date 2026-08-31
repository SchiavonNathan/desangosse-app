import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
  BackHandler,
} from 'react-native';
import { getLocalPdfs, getLocalHiddenCategories, saveHiddenCategories } from '../database/schema';
import { syncPdfs, startNetworkListener } from '../sync/syncService';
import { useAuthStore } from '../store/authStore';
import {
  FileText,
  LogOut,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Folder,
  BookOpen,
  Award,
  FileSpreadsheet,
} from 'lucide-react-native';
import api from '../services/api';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { key: 'Produtos e tabelas', label: 'Produtos e Tabelas', icon: FileSpreadsheet },
  { key: 'Culturas',           label: 'Culturas',           icon: BookOpen },
  { key: 'Resultados',         label: 'Resultados',         icon: Award },
  { key: 'Palestras',          label: 'Palestras',          icon: FileText },
];

interface Subcategory {
  id: string;
  name: string;
  category: string;
  iconUrl?: string;
}

export default function DashboardScreen({ navigation }: any) {
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  // Navigation State: Level 1 (null, null) -> Level 2 (category, null) -> Level 3 (category, subcategory)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<Subcategory | null>(null);

  const { user, logout } = useAuthStore();

  const baseUrl = api.defaults.baseURL || 'https://cht-cropbio.com.br/api';

  const loadData = async () => {
    try {
      // 1. Load local SQLite data (offline-first)
      const [localData, localHidden] = await Promise.all([
        getLocalPdfs(),
        getLocalHiddenCategories(),
      ]);
      setPdfs(localData);
      if (localHidden && Array.isArray(localHidden)) {
        setHiddenCategories(localHidden);
      }

      // 2. Fetch remote subcategories and hidden status if online
      try {
        const [subsRes, hiddenRes] = await Promise.all([
          api.get('/subcategories').catch(() => ({ data: [] })),
          api.get('/categories/hidden').catch(() => ({ data: [] })),
        ]);
        if (subsRes.data && Array.isArray(subsRes.data) && subsRes.data.length > 0) {
          setSubcategories(subsRes.data);
        }
        if (hiddenRes.data && Array.isArray(hiddenRes.data)) {
          setHiddenCategories(hiddenRes.data);
          await saveHiddenCategories(hiddenRes.data);
        }
      } catch {
        // Ignore network errors when offline
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = startNetworkListener(() => {
      loadData();
    });

    handleSync();

    return () => {
      unsubscribe();
    };
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    const onBackPress = () => {
      if (selectedSubcategory) {
        setSelectedSubcategory(null);
        return true;
      }
      if (selectedCategory) {
        setSelectedCategory(null);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [selectedCategory, selectedSubcategory]);

  const handleSync = async () => {
    setSyncing(true);
    await syncPdfs();
    await loadData();
    setSyncing(false);
  };

  const onRefresh = () => {
    setRefresh(true);
    handleSync();
  };

  const openPdf = (pdf: any) => {
    navigation.navigate('PdfViewer', { pdf });
  };

  // Build subcategories list for the selected category (combines API subs + local SQLite subs)
  const getSubcategoriesForCategory = useCallback((categoryKey: string) => {
    const subMap = new Map<string, Subcategory>();

    // 1. Add from API
    for (const sub of subcategories) {
      if (sub.category === categoryKey) {
        subMap.set(sub.id, sub);
      }
    }

    // 2. Add from local PDFs in SQLite if not yet in map
    for (const pdf of pdfs) {
      if ((pdf.category || 'Produtos e tabelas') === categoryKey) {
        const subId = pdf.subcategoryId || pdf.subcategoryName || 'geral';
        const subName = pdf.subcategoryName || 'Geral';
        if (!subMap.has(subId)) {
          subMap.set(subId, {
            id: subId,
            name: subName,
            category: categoryKey,
          });
        }
      }
    }

    return Array.from(subMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [subcategories, pdfs]);

  // Filter PDFs for current selection
  const getPdfsForSubcategory = useCallback((categoryKey: string, subId: string) => {
    return pdfs.filter(p => {
      const matchCat = (p.category || 'Produtos e tabelas') === categoryKey;
      const matchSub = (p.subcategoryId === subId) || (p.subcategoryName === subId) || (!p.subcategoryId && subId === 'geral');
      return matchCat && matchSub;
    });
  }, [pdfs]);

  // Header Component (shared across all levels)
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <View style={styles.headerLogoContainer}>
          <Image source={require('../../assets/desangosse.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <View>
          <Text style={styles.welcome}>DE SANGOSSE</Text>
          <Text style={styles.subtitle}>Olá, {user?.username}</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={handleSync} style={styles.actionBtn} activeOpacity={0.7}>
          <RefreshCw size={22} color={syncing ? '#94a3b8' : '#ffffff'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={styles.actionBtn} activeOpacity={0.7}>
          <LogOut size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Sync banner
  const renderSyncBanner = () => syncing ? (
    <View style={styles.syncBanner}>
      <ActivityIndicator size="small" color="#0A422D" />
      <Text style={styles.syncText}>Sincronizando documentos...</Text>
    </View>
  ) : null;

  // Breadcrumb navigation bar
  const renderBreadcrumb = (title: string, onBack: () => void, subtitle?: string) => (
    <View style={styles.breadcrumbBar}>
      <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
        <ArrowLeft size={20} color="#0A422D" />
      </TouchableOpacity>
      <View style={styles.breadcrumbTextContainer}>
        <Text style={styles.breadcrumbTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.breadcrumbSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </View>
  );

  // =========================================================================
  // LEVEL 3: Document/PDF List View
  // =========================================================================
  if (selectedCategory && selectedSubcategory) {
    const currentPdfs = getPdfsForSubcategory(selectedCategory, selectedSubcategory.id);
    return (
      <View style={styles.container}>
        {renderHeader()}
        {renderSyncBanner()}
        {renderBreadcrumb(
          selectedSubcategory.name,
          () => setSelectedSubcategory(null),
          selectedCategory
        )}

        <FlatList
          key="doc-list-view"
          data={currentPdfs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FileText size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Nenhum documento encontrado</Text>
              <Text style={styles.emptySubtitle}>Esta subcategoria ainda não possui arquivos sincronizados.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isXlsx = item.name.toLowerCase().endsWith('.xlsx');
            return (
              <TouchableOpacity
                style={styles.docCard}
                onPress={() => openPdf(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.docIconWrap, isXlsx && styles.docIconWrapXlsx]}>
                  {isXlsx ? (
                    <FileSpreadsheet color="#16a34a" size={28} />
                  ) : (
                    <FileText color="#0A422D" size={28} />
                  )}
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={2}>{item.name}</Text>
                  <View style={styles.docStatusRow}>
                    <View style={[styles.statusDot, item.localUri ? styles.statusDotOnline : styles.statusDotOffline]} />
                    <Text style={styles.docStatusText}>
                      {item.localUri ? 'Disponível Offline' : 'Apenas Online'}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#94a3b8" />
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  // =========================================================================
  // LEVEL 2: Subcategories List View
  // =========================================================================
  if (selectedCategory) {
    const currentSubs = getSubcategoriesForCategory(selectedCategory);
    return (
      <View style={styles.container}>
        {renderHeader()}
        {renderSyncBanner()}
        {renderBreadcrumb(
          selectedCategory,
          () => setSelectedCategory(null),
          'Selecione uma subcategoria'
        )}

        <FlatList
          key="subcat-list-view"
          data={currentSubs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Folder size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Nenhuma subcategoria encontrada</Text>
              <Text style={styles.emptySubtitle}>Esta categoria ainda não possui subcategorias cadastradas.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const count = getPdfsForSubcategory(selectedCategory, item.id).length;
            const iconFullUrl = item.iconUrl
              ? (item.iconUrl.startsWith('http') ? item.iconUrl : `${baseUrl}${item.iconUrl.startsWith('/') ? '' : '/'}${item.iconUrl}`)
              : null;

            return (
              <TouchableOpacity
                style={styles.subcatCard}
                onPress={() => setSelectedSubcategory(item)}
                activeOpacity={0.7}
              >
                <View style={styles.subcatIconWrap}>
                  {iconFullUrl ? (
                    <Image source={{ uri: iconFullUrl }} style={styles.subcatIconImg} resizeMode="contain" />
                  ) : (
                    <Folder color="#0A422D" size={30} />
                  )}
                </View>
                <View style={styles.subcatInfo}>
                  <Text style={styles.subcatTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.subcatCount}>
                    {count} {count === 1 ? 'documento' : 'documentos'}
                  </Text>
                </View>
                <ChevronRight size={22} color="#94a3b8" />
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  // =========================================================================
  // LEVEL 1: Home 2x2 Category Grid View (Synchronized with hidden categories)
  // =========================================================================
  const visibleCategories = CATEGORIES.filter((c) => !hiddenCategories.includes(c.key));

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderSyncBanner()}

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#0A422D" />
          <Text style={styles.loadingText}>Carregando categorias...</Text>
        </View>
      ) : (
        <FlatList
          key="home-grid-2-cols"
          data={visibleCategories}
          keyExtractor={(item) => item.key}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Folder size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Nenhuma categoria visível</Text>
            </View>
          }
          renderItem={({ item }) => {
            const IconComponent = item.icon;
            const imageUrl = `${baseUrl}/categories/find-image/${encodeURIComponent(item.key)}?t=1`;
            const hasError = imageErrorMap[item.key];

            return (
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => setSelectedCategory(item.key)}
                activeOpacity={0.85}
              >
                <View style={styles.gridCardImageWrapper}>
                  {!hasError ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.gridCardImage}
                      resizeMode="contain"
                      onError={() => setImageErrorMap(prev => ({ ...prev, [item.key]: true }))}
                    />
                  ) : (
                    <View style={styles.gridFallbackIcon}>
                      <IconComponent size={44} color="#0A422D" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 18,
    backgroundColor: '#0A422D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogoContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLogo: {
    width: '100%',
    height: '100%',
  },
  welcome: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 14,
  },
  actionBtn: {
    padding: 6,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  syncText: {
    color: '#0A422D',
    fontSize: 12,
    fontWeight: '600',
  },

  // Breadcrumb Bar
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breadcrumbTextContainer: {
    flex: 1,
  },
  breadcrumbTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  breadcrumbSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },

  // Level 1: Home 2x2 Grid
  gridContainer: {
    padding: 14,
    paddingTop: 16,
    paddingBottom: 32,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  gridCard: {
    width: (width - 42) / 2,
    height: (width - 42) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 4,
  },
  gridCardImageWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCardImage: {
    width: '100%',
    height: '100%',
  },
  gridFallbackIcon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
  },

  // Level 2: Subcategories List
  listContent: {
    padding: 16,
    paddingBottom: 36,
  },
  subcatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  subcatIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
    padding: 4,
  },
  subcatIconImg: {
    width: '100%',
    height: '100%',
  },
  subcatInfo: {
    flex: 1,
  },
  subcatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  subcatCount: {
    fontSize: 13,
    color: '#64748b',
  },

  // Level 3: Documents List
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  docIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  docIconWrapXlsx: {
    backgroundColor: '#f0fdf4',
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
    lineHeight: 20,
  },
  docStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: '#10b981',
  },
  statusDotOffline: {
    backgroundColor: '#94a3b8',
  },
  docStatusText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },

  // Empty & Loading States
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 14,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
});
