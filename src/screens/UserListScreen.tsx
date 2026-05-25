import React, { useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    Modal,
    TextInput,
    RefreshControl,
    StatusBar,
} from 'react-native';
import { useChatStore } from '../store/useChatStore';
import { Peer } from '../modules/MeshTypes';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { THEME } from '../theme/colors';

type RootStackParamList = {
    UserList: undefined;
    Chat: { userId: string; userName: string };
    Profile: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// --- Signal Bars Component ---
const getSignalBars = (rssi: number | undefined): number => {
    if (!rssi || rssi < -100) return 0;
    if (rssi >= -50) return 4;
    if (rssi >= -65) return 3;
    if (rssi >= -80) return 2;
    if (rssi >= -95) return 1;
    return 0;
};

const SignalBars = ({ rssi }: { rssi: number | undefined }) => {
    const bars = getSignalBars(rssi);
    const barColor =
        bars >= 4 ? '#2ED573' :
        bars === 3 ? '#1E90FF' :
        bars === 2 ? '#FFA502' :
        '#FF4757';

    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginLeft: 6 }}>
            {[1, 2, 3, 4].map(level => (
                <View
                    key={level}
                    style={{
                        width: 3,
                        height: 4 + level * 3,
                        marginHorizontal: 1,
                        borderRadius: 1,
                        backgroundColor: level <= bars ? barColor : THEME.colors.border,
                    }}
                />
            ))}
        </View>
    );
};

// --- Empty State ---
const EmptyState = () => (
    <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📡</Text>
        <Text style={styles.emptyTitle}>Scanning for nearby devices</Text>
        <Text style={styles.emptySubtitle}>
            Make sure Bluetooth is enabled on both devices.{'\n'}
            Other users running this app will appear here.
        </Text>
    </View>
);

// --- Main Screen ---
export const UserListScreen = () => {
    const { peers, conversations, deviceId, renamePeer, unreadCounts } = useChatStore();
    const navigation = useNavigation<NavigationProp>();

    // Rename modal state
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [targetPeerId, setTargetPeerId] = useState<string | null>(null);
    const [newPeerName, setNewPeerName] = useState('');

    // Pull-to-refresh state
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await new Promise(resolve => setTimeout(resolve, 1200));
        setRefreshing(false);
    };

    const handleLongPress = (id: string, currentName: string) => {
        setTargetPeerId(id);
        setNewPeerName(currentName);
        setRenameModalVisible(true);
    };

    const confirmRename = async () => {
        if (targetPeerId && newPeerName.trim()) {
            await renamePeer(targetPeerId, newPeerName.trim());
        }
        setRenameModalVisible(false);
        setTargetPeerId(null);
    };

    // Merge live peers with any conversation history partners
    const uniqueIds = Array.from(new Set([
        ...peers.map(p => p.id),
        ...Object.keys(conversations),
    ]));

    // Filter out ourselves and BROADCAST
    const displayList = uniqueIds.filter(id => id !== deviceId && id !== 'BROADCAST');

    const onlinePeers = peers.filter(
        p => p.status === 'connected' && p.id !== deviceId && p.id !== 'BROADCAST'
    ).length;

    const renderItem = ({ item: userId }: { item: string }) => {
        const peer = peers.find(p => p.id === userId);
        const msgs = conversations[userId] || [];
        const lastMsg = msgs.length > 0 ? msgs[0] : null; // msgs are newest-first

        const displayName = peer?.name || userId.substring(0, 8);
        const lastContent = lastMsg
            ? (lastMsg.senderId === deviceId ? 'You: ' : '') + lastMsg.content
            : 'No messages yet';
        const unreadCount = unreadCounts[userId] || 0;
        const isOnline = peer?.status === 'connected';
        const isIndirect = peer?.status === 'indirect';

        return (
            <TouchableOpacity
                style={styles.itemContainer}
                onPress={() => navigation.navigate('Chat', { userId, userName: displayName })}
                onLongPress={() => handleLongPress(userId, displayName)}
                delayLongPress={500}
                activeOpacity={0.7}
            >
                {/* Avatar */}
                <View style={[styles.avatar, isIndirect && styles.avatarIndirect]}>
                    <Text style={styles.avatarText}>{displayName[0]?.toUpperCase() ?? '?'}</Text>
                    {/* Online indicator dot */}
                    {isOnline && <View style={styles.onlineDot} />}
                </View>

                {/* Content */}
                <View style={styles.textContainer}>
                    <View style={styles.headerRow}>
                        <View style={styles.nameRow}>
                            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                            {isIndirect && (
                                <View style={styles.meshBadge}>
                                    <Text style={styles.meshBadgeText}>mesh</Text>
                                </View>
                            )}
                            {isOnline && peer?.rssi !== undefined && (
                                <SignalBars rssi={peer.rssi} />
                            )}
                        </View>
                        <Text style={styles.time}>
                            {lastMsg
                                ? new Date(lastMsg.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })
                                : ''}
                        </Text>
                    </View>
                    <View style={styles.messageRow}>
                        <Text
                            style={[styles.lastMsg, unreadCount > 0 && styles.lastMsgBold]}
                            numberOfLines={1}
                        >
                            {lastContent}
                        </Text>
                        {unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>{unreadCount}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={THEME.colors.surface} />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Mesh Chat</Text>
                    <Text style={styles.subtitle}>Bluetooth P2P Messenger</Text>
                </View>
                <View style={styles.headerRight}>
                    <View style={[styles.statusBadge, onlinePeers === 0 && styles.statusBadgeEmpty]}>
                        <View style={[styles.statusPulse, onlinePeers === 0 && styles.statusPulseOff]} />
                        <Text style={[styles.statusText, onlinePeers === 0 && styles.statusTextOff]}>
                            {onlinePeers > 0 ? `${onlinePeers} Nearby` : 'Scanning...'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.profileButton}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        <Text style={styles.profileButtonText}>👤</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chat List */}
            <FlatList
                data={displayList}
                renderItem={renderItem}
                keyExtractor={item => item}
                contentContainerStyle={[
                    styles.list,
                    displayList.length === 0 && styles.listEmpty,
                ]}
                ListEmptyComponent={<EmptyState />}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={THEME.colors.primary}
                        colors={[THEME.colors.primary]}
                    />
                }
                showsVerticalScrollIndicator={false}
            />

            {/* Rename Modal */}
            <Modal
                transparent
                visible={renameModalVisible}
                animationType="fade"
                onRequestClose={() => setRenameModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rename Contact</Text>
                        <Text style={styles.modalHint}>Long-press a contact to rename them locally.</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={newPeerName}
                            onChangeText={setNewPeerName}
                            placeholder="Enter display name"
                            placeholderTextColor={THEME.colors.textSecondary}
                            autoFocus
                            maxLength={20}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setRenameModalVisible(false)}
                                style={styles.modalButtonCancel}
                            >
                                <Text style={styles.modalButtonCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={confirmRename} style={styles.modalButtonSave}>
                                <Text style={styles.modalButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.colors.background,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: THEME.spacing.m,
        paddingVertical: 12,
        backgroundColor: THEME.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: THEME.colors.border,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: THEME.colors.text,
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: 11,
        color: THEME.colors.textSecondary,
        marginTop: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 165, 92, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 5,
        borderWidth: 1,
        borderColor: 'rgba(59, 165, 92, 0.3)',
    },
    statusBadgeEmpty: {
        backgroundColor: 'rgba(116, 127, 141, 0.15)',
        borderColor: 'rgba(116, 127, 141, 0.3)',
    },
    statusPulse: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: THEME.colors.statusOnline,
    },
    statusPulseOff: {
        backgroundColor: THEME.colors.statusOffline,
    },
    statusText: {
        color: THEME.colors.statusOnline,
        fontWeight: '600',
        fontSize: 12,
    },
    statusTextOff: {
        color: THEME.colors.statusOffline,
    },
    profileButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: THEME.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileButtonText: {
        fontSize: 18,
    },

    // List
    list: {
        paddingTop: THEME.spacing.s,
    },
    listEmpty: {
        flex: 1,
    },

    // Empty State
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingTop: 60,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: THEME.colors.text,
        marginBottom: 10,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: THEME.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 21,
    },

    // List Item
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        paddingHorizontal: THEME.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: THEME.colors.border,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: THEME.colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: THEME.spacing.m,
    },
    avatarIndirect: {
        backgroundColor: THEME.colors.surface,
        borderWidth: 2,
        borderColor: THEME.colors.border,
    },
    avatarText: {
        color: 'white',
        fontSize: 20,
        fontWeight: '700',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: THEME.colors.statusOnline,
        borderWidth: 2,
        borderColor: THEME.colors.background,
    },
    textContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.colors.text,
        flexShrink: 1,
    },
    meshBadge: {
        backgroundColor: 'rgba(244, 123, 103, 0.2)',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
        marginLeft: 6,
    },
    meshBadgeText: {
        fontSize: 10,
        color: THEME.colors.accent,
        fontWeight: '600',
    },
    time: {
        fontSize: 11,
        color: THEME.colors.textSecondary,
    },
    messageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMsg: {
        color: THEME.colors.textSecondary,
        fontSize: 13,
        flex: 1,
        marginRight: 8,
    },
    lastMsgBold: {
        fontWeight: '600',
        color: THEME.colors.text,
    },
    unreadBadge: {
        backgroundColor: THEME.colors.primary,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '700',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        backgroundColor: THEME.colors.surface,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: THEME.colors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: THEME.colors.text,
        marginBottom: 6,
    },
    modalHint: {
        fontSize: 13,
        color: THEME.colors.textSecondary,
        marginBottom: 20,
    },
    modalInput: {
        backgroundColor: THEME.colors.background,
        color: THEME.colors.text,
        borderRadius: 10,
        padding: 13,
        marginBottom: 24,
        fontSize: 16,
        borderWidth: 1,
        borderColor: THEME.colors.border,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        alignItems: 'center',
    },
    modalButtonCancel: {
        padding: 10,
    },
    modalButtonCancelText: {
        color: THEME.colors.textSecondary,
        fontWeight: '600',
        fontSize: 15,
    },
    modalButtonSave: {
        backgroundColor: THEME.colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
    },
    modalButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15,
    },
});
