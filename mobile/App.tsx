import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from './src/store/authStore';
import { initDatabase } from './src/database/schema';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PdfViewerScreen from './src/screens/PdfViewerScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const { user, isLoading, restoreToken } = useAuthStore();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        await initDatabase();
        setDbReady(true);
        await restoreToken();
      } catch (e) {
        console.error('Failed to bootstrap app', e);
      }
    }
    bootstrap();
  }, []);

  if (isLoading || !dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="PdfViewer" component={PdfViewerScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
