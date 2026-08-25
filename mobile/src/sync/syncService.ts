import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../services/api';
import { getLocalPdfs, insertOrUpdatePdf, deletePdf } from '../database/schema';

interface ApiPdf {
  id: string;
  name: string;
  hash: string;
  url_download: string;
  category?: string;
  subcategoryId?: string | null;
  subcategoryName?: string | null;
}

let isSyncing = false;

export async function syncPdfs() {
  if (isSyncing) {
    console.log('[SyncService] Sync already in progress. Skipping.');
    return;
  }

  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    console.log('[SyncService] Offline. Skipping sync.');
    return;
  }

  isSyncing = true;
  try {
    console.log('[SyncService] Online. Starting sync...');
    const response = await api.get<ApiPdf[]>('/pdfs');
    const remotePdfs = response.data;
    
    // Using typing from generic SQLite return
    const localPdfs: any[] = await getLocalPdfs();
    
    // 1. Apagar do SQLite e FileSystem os PDFs que não existem mais no remoto
    const remoteIds = remotePdfs.map(r => r.id);
    for (const local of localPdfs) {
      if (!remoteIds.includes(local.id)) {
        console.log(`[SyncService] Apagando PDF removido: ${local.name}`);
        if (local.localUri) {
          try {
            await FileSystem.deleteAsync(local.localUri, { idempotent: true });
          } catch (e) {
             console.error('Error deleting file', e);
          }
        }
        await deletePdf(local.id);
      }
    }

    // 2. Fazer download de arquivos novos ou modificados
    for (const remote of remotePdfs) {
      const localMatch = localPdfs.find(l => l.id === remote.id);
      
      // Se não existir localmente ou o hash for diferente (foi alterado)
      if (!localMatch || localMatch.hash !== remote.hash) {
        console.log(`[SyncService] Baixando PDF: ${remote.name}`);
        const fileUri = `${FileSystem.documentDirectory}${remote.id}.pdf`;
        
        try {
          const baseUrl = api.defaults.baseURL || 'http://192.168.200.103:3001';
          let downloadUrl = remote.url_download;
          if (downloadUrl.startsWith('/')) {
            downloadUrl = `${baseUrl}${downloadUrl}`;
          } else if (downloadUrl.includes('localhost')) {
            downloadUrl = downloadUrl.replace(/http:\/\/localhost:\d+/, baseUrl);
          }

          const downloadRes = await FileSystem.downloadAsync(
            downloadUrl,
            fileUri
          );
          
          console.log(`[SyncService] Download status: ${downloadRes.status} para ${remote.name}`);

          if (downloadRes.status >= 200 && downloadRes.status < 300) {
            await insertOrUpdatePdf({
              id: remote.id,
              name: remote.name,
              hash: remote.hash,
              url: remote.url_download,
              localUri: downloadRes.uri,
              category: remote.category || "Produtos e tabelas",
              subcategoryId: remote.subcategoryId ?? null,
              subcategoryName: remote.subcategoryName ?? null,
            });
            console.log(`[SyncService] Sucesso: ${remote.name}`);
          } else {
            console.error(`[SyncService] Download falhou com status ${downloadRes.status} para ${remote.name}`);
          }
        } catch (downloadErr) {
          console.error(`[SyncService] Falha no download de ${remote.name}`, downloadErr);
        }
      }
    }
    console.log('[SyncService] Sync Finalizado.');
  } catch (err) {
    console.error('[SyncService] Falha de comunicação com API', err);
  } finally {
    isSyncing = false;
  }
}

// Inicia o listener de rede que dispara a sincronização silenciosa
export function startNetworkListener(onSyncEnd?: () => void) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      // Debounce para evitar múltiplas chamadas seguidas
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        syncPdfs().then(() => {
          if (onSyncEnd) onSyncEnd();
        });
      }, 2000);
    }
  });
}
