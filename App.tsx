// Polyfills — must be first
import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;
import 'react-native-get-random-values';

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UserListScreen } from './src/screens/UserListScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { useChatStore } from './src/store/useChatStore';

// Navigation type definitions
type RootStackParamList = {
    UserList: undefined;
    Chat: { userId: string; userName: string };
    Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App = () => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const initialize = useChatStore(state => state.initialize);

    const runInit = useCallback(async () => {
        console.log('[APP] Starting initialization...');
        try {
            await initialize();
            console.log('[APP] Initialization complete');
        } catch (error: any) {
            console.error('[APP] Initialization failed:', error);
            setInitError(error?.message ?? 'Unknown error');
        } finally {
            setIsInitialized(true);
        }
    }, [initialize]);

    useEffect(() => {
        runInit();
    }, [runInit]);

    if (!isInitialized) {
        return (
            <SafeAreaProvider>
                <View style={styles.loading}>
                    <View style={styles.loadingCard}>
                        <Text style={styles.loadingEmoji}>📡</Text>
                        <ActivityIndicator size="large" color="#5865F2" style={styles.spinner} />
                        <Text style={styles.loadingTitle}>Mesh Chat</Text>
                        <Text style={styles.loadingText}>Starting Bluetooth mesh network...</Text>
                    </View>
                </View>
            </SafeAreaProvider>
        );
    }

    if (initError) {
        return (
            <SafeAreaProvider>
                <View style={styles.loading}>
                    <View style={styles.loadingCard}>
                        <Text style={styles.errorEmoji}>⚠️</Text>
                        <Text style={styles.errorTitle}>Initialization Failed</Text>
                        <Text style={styles.errorText}>{initError}</Text>
                        <Text style={styles.errorHint}>
                            Ensure Bluetooth and location permissions are granted, then restart the app.
                        </Text>
                    </View>
                </View>
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <NavigationContainer>
                <Stack.Navigator
                    id="Root"
                    screenOptions={{ headerShown: false }}
                    initialRouteName="UserList"
                >
                    <Stack.Screen name="UserList" component={UserListScreen} />
                    <Stack.Screen name="Chat" component={ChatScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                </Stack.Navigator>
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
        padding: 24,
    },
    loadingCard: {
        alignItems: 'center',
        backgroundColor: '#151A23',
        borderRadius: 24,
        padding: 36,
        width: '100%',
        maxWidth: 320,
        borderWidth: 1,
        borderColor: '#2F3136',
    },
    loadingEmoji: {
        fontSize: 56,
        marginBottom: 16,
    },
    spinner: {
        marginBottom: 20,
    },
    loadingTitle: {
        color: '#EEEEEE',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 8,
    },
    loadingText: {
        color: '#8E9297',
        fontSize: 14,
        textAlign: 'center',
    },
    errorEmoji: {
        fontSize: 52,
        marginBottom: 16,
    },
    errorTitle: {
        color: '#FF4757',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 10,
    },
    errorText: {
        color: '#EEEEEE',
        fontSize: 13,
        textAlign: 'center',
        fontFamily: 'monospace',
        marginBottom: 12,
    },
    errorHint: {
        color: '#8E9297',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
    },
});

export default App;
