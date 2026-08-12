import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import Pdf from 'react-native-pdf';
import { ArrowLeft } from 'lucide-react-native';

export default function PdfViewerScreen({ route, navigation }: any) {
  const { pdf } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{pdf.name}</Text>
      </View>
      
      {pdf.localUri ? (
        <Pdf
          source={{ uri: pdf.localUri }}
          onLoadComplete={(numberOfPages) => {
            console.log(`[PdfViewer] PDF lido offline com sucesso: ${numberOfPages} páginas.`);
          }}
          onError={(error) => {
            console.error('[PdfViewer] Erro ao ler PDF offline:', error);
          }}
          style={styles.pdf}
          renderActivityIndicator={() => <ActivityIndicator size="large" color="#6366f1" />}
        />
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>PDF não está salvo offline. Sincronize primeiro.</Text>
        </View>
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
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    paddingTop: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backBtn: {
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
  },
  pdf: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#e2e8f0'
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: 'bold'
  }
});
