// Polyfills
import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;
import 'react-native-get-random-values';

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { UserListScreen } from './src/screens/UserListScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DebugOverlay } from './src/components/DebugOverlay';
import { useChatStore } from './src/store/useChatStore';

const Stack = createNativeStackNavigator();

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const initialize = useChatStore(state => state.initialize);

  useEffect(() => {
    console.log('[APP] Starting global initialization...');
    initialize()
      .then(() => {
        console.log('[APP] Initialization complete');
        setIsInitialized(true);
      })
      .catch((error) => {
        console.error('[APP] Initialization failed:', error);
        setIsInitialized(true); // Still allow app to load
      });
  }, []);

  if (!isInitialized) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#BB86FC" />
          <Text style={styles.loadingText}>Starting Mesh Network...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="UserList">
          <Stack.Screen name="UserList" component={UserListScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
        <DebugOverlay />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0F15',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
});

export default App;
