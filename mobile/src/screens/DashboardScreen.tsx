import React, { useEffect, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { getLocalPdfs } from '../database/schema';
import { syncPdfs, startNetworkListener } from '../sync/syncService';
import { useAuthStore } from '../store/authStore';
import { FileText, LogOut, RefreshCw } from 'lucide-react-native';
import api from '../services/api';

const CATEGORIES = [
  'Produtos e tabelas',
  'Culturas',
  'Resultados',
  'Palestras'
];

export default function DashboardScreen({ navigation }: any) {
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const { user, logout } = useAuthStore();

  useEffect(() => {
    loadPdfs();
    const unsubscribe = startNetworkListener(() => {
      loadPdfs();
    });
    
    handleSync();

    return () => {
      unsubscribe();
    };
  }, []);

  const loadPdfs = async () => {
    try {
      const data = await getLocalPdfs();
      setPdfs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await syncPdfs();
    await loadPdfs();
    setSyncing(false);
  };

  const onRefresh = () => {
    setRefresh(true);
    handleSync();
  };

  const openPdf = (pdf: any) => {
    navigation.navigate('PdfViewer', { pdf });
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => openPdf(item)}>
      <View style={styles.cardIcon}>
        <FileText color="#0A422D" size={32} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.pdfTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.pdfStatus}>{item.localUri ? 'Disponível Offline' : 'Apenas Online'}</Text>
      </View>
    </TouchableOpacity>
  );

  // Build sections: group by category > subcategory
  // Each section title = "Categoria — Subcategoria" or just "Categoria" if no subcategory
  const sections = (() => {
    const result: { title: string; categoryTitle: string; isSubcatHeader: boolean; data: any[] }[] = [];

    for (const cat of CATEGORIES.filter(c => !hiddenCategories.includes(c))) {
      const catPdfs = pdfs.filter(p => (p.category || 'Produtos e tabelas') === cat);
      if (catPdfs.length === 0) continue;

      // Group by subcategoryName
      const subMap = new Map<string, any[]>();
      for (const pdf of catPdfs) {
        const key = pdf.subcategoryName || '—';
        if (!subMap.has(key)) subMap.set(key, []);
        subMap.get(key)!.push(pdf);
      }

      const subKeys = Array.from(subMap.keys()).sort();
      for (const subKey of subKeys) {
        result.push({
          title: subKey === '—' ? cat : `${cat} › ${subKey}`,
          categoryTitle: cat,
          isSubcatHeader: subKey !== '—',
          data: subMap.get(subKey)!,
        });
      }
    }

    return result;
  })();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>DE SANGOSSE by DSG</Text>
          <Text style={styles.subtitle}>Olá, {user?.username}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSync} style={styles.actionBtn}>
            <RefreshCw size={24} color={syncing ? '#94a3b8' : '#ffffff'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.actionBtn}>
            <LogOut size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {syncing && (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color="#0A422D" />
          <Text style={styles.syncText}>Sincronizando com o servidor...</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0A422D" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderContainer}>
              {section.isSubcatHeader ? (
                <>
                  <Text style={styles.sectionCategory}>{section.categoryTitle}</Text>
                  <Text style={styles.sectionSubcat}>
                    {section.title.split('›')[1]?.trim()}
                  </Text>
                </>
              ) : (
                <Text style={styles.sectionHeader}>{section.title}</Text>
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <FileText size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>Nenhum documento encontrado.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0A422D',
    paddingTop: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  welcome: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    padding: 4,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  syncText: {
    color: '#0A422D',
    fontSize: 12,
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeaderContainer: {
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#e5e7eb',
    paddingVertical: 4,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A422D',
  },
  sectionCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionSubcat: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A422D',
    marginTop: 2,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  pdfTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  pdfStatus: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4b5563',
    marginTop: 16,
  },
});
