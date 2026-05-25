import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ScrollView,
} from 'react-native';
import { THEME } from '../theme/colors';
import { storage } from '../modules/StorageService';
import { security } from '../modules/SecurityModule';
import { router } from '../modules/MeshRouter';

export const ProfileScreen = ({ navigation }: any) => {
    const [username, setUsername] = useState('');
    const [deviceId, setDeviceId] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setUsername(storage.myUsername);
        setDeviceId(security.deviceId);
    }, []);

    const handleSave = async () => {
        const trimmed = username.trim();
        if (!trimmed) return;

        setSaving(true);
        try {
            // Persist the username
            await storage.setMyUsername(trimmed);
            // Re-advertise BLE presence with the updated name
            await router.updatePresence(trimmed);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) {
            console.error('[PROFILE] Save failed:', e);
        } finally {
            setSaving(false);
        }
    };

    const avatarInitial = username ? username[0].toUpperCase() : '?';
    // Generate a consistent color from the device ID for the avatar
    const avatarColor = THEME.colors.primary;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={THEME.colors.surface} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Avatar */}
                <View style={[styles.avatarLarge, { backgroundColor: avatarColor }]}>
                    <Text style={styles.avatarTextLarge}>{avatarInitial}</Text>
                </View>
                <Text style={styles.avatarCaption}>
                    {username ? username : 'Set your display name below'}
                </Text>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Username Input */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Display Name</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="e.g. Alice"
                        placeholderTextColor={THEME.colors.textSecondary}
                        maxLength={15}
                        autoCapitalize="words"
                        returnKeyType="done"
                    />
                    <Text style={styles.hint}>
                        Max 15 characters · Visible to nearby users via Bluetooth
                    </Text>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        saved && styles.saveButtonSuccess,
                        (!username.trim() || saving) && styles.saveButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={!username.trim() || saving}
                >
                    <Text style={styles.saveButtonText}>
                        {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Profile'}
                    </Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Device Info Card */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Device Information</Text>
                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Device ID</Text>
                            <Text style={styles.infoValue} selectable>{deviceId || 'Initializing...'}</Text>
                        </View>
                        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                            <Text style={styles.infoLabel}>Protocol</Text>
                            <Text style={styles.infoValue}>BLE Mesh • TTL=3</Text>
                        </View>
                    </View>
                    <Text style={styles.hint}>
                        Your Device ID uniquely identifies you on the mesh network.
                        It is derived from your cryptographic public key.
                    </Text>
                </View>


            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: THEME.spacing.m,
        paddingVertical: 12,
        backgroundColor: THEME.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: THEME.colors.border,
    },
    backButton: {
        padding: THEME.spacing.s,
        marginRight: 4,
    },
    backButtonText: {
        color: THEME.colors.text,
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: THEME.colors.text,
    },
    content: {
        padding: THEME.spacing.l,
        alignItems: 'center',
    },

    // Avatar
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: THEME.spacing.m,
        marginBottom: THEME.spacing.s,
        elevation: 8,
        shadowColor: THEME.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    avatarTextLarge: {
        color: 'white',
        fontSize: 42,
        fontWeight: '800',
    },
    avatarCaption: {
        color: THEME.colors.textSecondary,
        fontSize: 14,
        marginBottom: THEME.spacing.m,
    },

    divider: {
        width: '100%',
        height: 1,
        backgroundColor: THEME.colors.border,
        marginVertical: THEME.spacing.l,
    },

    // Section
    section: {
        width: '100%',
        marginBottom: THEME.spacing.l,
    },
    sectionLabel: {
        color: THEME.colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: THEME.spacing.s,
    },
    input: {
        backgroundColor: THEME.colors.surface,
        color: THEME.colors.text,
        borderRadius: THEME.borderRadius.m,
        padding: THEME.spacing.m,
        fontSize: 18,
        borderWidth: 1,
        borderColor: THEME.colors.border,
    },
    hint: {
        color: THEME.colors.textSecondary,
        fontSize: 12,
        marginTop: THEME.spacing.s,
        lineHeight: 18,
    },

    // Save Button
    saveButton: {
        backgroundColor: THEME.colors.primary,
        paddingVertical: THEME.spacing.m,
        paddingHorizontal: THEME.spacing.xl,
        borderRadius: THEME.borderRadius.l,
        width: '100%',
        alignItems: 'center',
    },
    saveButtonSuccess: {
        backgroundColor: THEME.colors.statusOnline,
    },
    saveButtonDisabled: {
        backgroundColor: THEME.colors.border,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },

    // Info Card
    infoCard: {
        backgroundColor: THEME.colors.surface,
        borderRadius: THEME.borderRadius.m,
        borderWidth: 1,
        borderColor: THEME.colors.border,
        overflow: 'hidden',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: THEME.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: THEME.colors.border,
        gap: 12,
    },
    infoLabel: {
        color: THEME.colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
        width: 80,
    },
    infoValue: {
        color: THEME.colors.text,
        fontSize: 13,
        fontFamily: 'monospace',
        flex: 1,
    },
    infoEmoji: {
        fontSize: 20,
        width: 28,
        textAlign: 'center',
    },
    infoDesc: {
        color: THEME.colors.textSecondary,
        fontSize: 13,
        flex: 1,
        lineHeight: 19,
    },
});
