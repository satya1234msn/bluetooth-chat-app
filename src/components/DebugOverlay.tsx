import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

const LOG_MAX_LINES = 100;

export const debugLogs: string[] = [];
const listeners: ((logs: string[]) => void)[] = [];

// Override console methods to capture logs in the overlay
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => {
    originalLog(...args);
    addLog(`[LOG] ${args.join(' ')}`);
};

console.warn = (...args) => {
    originalWarn(...args);
    addLog(`[WARN] ${args.join(' ')}`);
};

console.error = (...args) => {
    originalError(...args);
    addLog(`[ERR] ${args.join(' ')}`);
};

function addLog(text: string) {
    const timestamp = new Date().toLocaleTimeString();
    const line = `${timestamp}: ${text}`;
    debugLogs.unshift(line);
    if (debugLogs.length > LOG_MAX_LINES) debugLogs.pop();
    listeners.forEach(l => l([...debugLogs]));
}

export const DebugOverlay = () => {
    const [visible, setVisible] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const listener = (newLogs: string[]) => setLogs(newLogs);
        listeners.push(listener);
        return () => {
            const idx = listeners.indexOf(listener);
            if (idx !== -1) listeners.splice(idx, 1);
        };
    }, []);

    if (!visible) {
        return (
            <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)}>
                <Text style={styles.triggerText}>🐛</Text>
            </TouchableOpacity>
        );
    }

    return (
        // Use style.pointerEvents instead of deprecated prop
        <View style={[styles.container, { pointerEvents: 'box-none' }]}>
            <View style={styles.window}>
                <View style={styles.header}>
                    <Text style={styles.title}>Debug Console ({logs.length})</Text>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            onPress={() => { debugLogs.length = 0; setLogs([]); }}
                            style={styles.clearBtn}
                        >
                            <Text style={styles.clearText}>Clear</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
                            <Text style={styles.closeText}>Hide</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <ScrollView style={styles.scroll}>
                    {logs.map((log, i) => (
                        <Text
                            key={i}
                            style={[
                                styles.logText,
                                log.includes('[ERR]') ? styles.err :
                                log.includes('[WARN]') ? styles.warn : null,
                            ]}
                        >
                            {log}
                        </Text>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    trigger: {
        position: 'absolute',
        top: 40,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    triggerText: { fontSize: 22 },
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
        justifyContent: 'flex-end',
    },
    window: {
        height: '50%',
        backgroundColor: 'rgba(0,0,0,0.92)',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        paddingBottom: 5,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    title: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    clearBtn: { padding: 5 },
    clearText: { color: '#FF4757', fontSize: 12 },
    closeBtn: { padding: 5 },
    closeText: { color: '#BB86FC', fontSize: 12 },
    scroll: { flex: 1 },
    logText: { color: '#AAA', fontSize: 10, fontFamily: 'monospace', marginBottom: 2 },
    warn: { color: '#FFA502' },
    err: { color: '#FF4757' },
});
