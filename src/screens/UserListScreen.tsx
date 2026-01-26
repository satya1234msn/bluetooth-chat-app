import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Modal, TextInput, RefreshControl } from 'react-native';
import { useChatStore } from '../store/useChatStore';
import { Peer } from '../modules/MeshTypes';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { THEME } from '../theme/colors';

type RootStackParamList = {
    UserList: undefined;
    Chat: { userId: string; userName: string };
};

export const UserListScreen = () => {
    const { peers, conversations, deviceId, renamePeer } = useChatStore();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    // Rename State
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [targetPeerId, setTargetPeerId] = useState<string | null>(null);
    const [newPeerName, setNewPeerName] = useState('');

    // Refresh State
    const [refreshing, setRefreshing] = useState(false);



    const onRefresh = async () => {
        setRefreshing(true);
        // Wait for BLE to detect new devices
        await new Promise(resolve => setTimeout(resolve, 1000));
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

    // Merge peers and existing conversations
    const uniqueIds = Array.from(new Set([...peers.map(p => p.id), ...Object.keys(conversations)]));

    // Filter out ourself and BROADCAST (handled by FAB)
    const displayList = uniqueIds.filter(id => id !== deviceId && id !== 'BROADCAST');

    const renderItem = ({ item: userId }: { item: string }) => {
        const peer = peers.find(p => p.id === userId);
        const msgs = conversations[userId] || [];
        const lastMsg = msgs.length > 0 ? msgs[0] : null;

        const displayName = peer?.name || userId.substring(0, 8);
        const lastContent = lastMsg ? (lastMsg.senderId === deviceId ? 'You: ' : '') + lastMsg.content : 'No messages yet';

        return (
            <TouchableOpacity
                style={styles.itemContainer}
                onPress={() => navigation.navigate('Chat', { userId, userName: displayName })}
                onLongPress={() => handleLongPress(userId, displayName)}
                delayLongPress={500}
            >
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text>
                </View>
                <View style={styles.textContainer}>
                    <View style={styles.headerRow}>
                        <Text style={styles.name}>{displayName}</Text>
                        <Text style={styles.time}>
                            {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </Text>
                    </View>
                    <Text style={styles.lastMsg} numberOfLines={1}>{lastContent}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>All Chats</Text>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{peers.length} Online</Text>
                </View>
            </View>

            <FlatList
                data={displayList}
                renderItem={renderItem}
                keyExtractor={item => item}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.colors.primary} />
                }
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('Chat', { userId: 'BROADCAST', userName: 'Broadcast Channel' })}
            >
                <Text style={styles.fabText}>📢</Text>
            </TouchableOpacity>

            <Modal
                transparent
                visible={renameModalVisible}
                animationType="fade"
                onRequestClose={() => setRenameModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rename User</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={newPeerName}
                            onChangeText={setNewPeerName}
                            placeholder="Enter new name"
                            placeholderTextColor={THEME.colors.textSecondary}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setRenameModalVisible(false)} style={styles.modalButtonCancel}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: THEME.spacing.m,
        backgroundColor: THEME.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: THEME.colors.border,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: THEME.colors.text,
    },
    statusBadge: {
        backgroundColor: 'rgba(59, 165, 92, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: THEME.colors.statusOnline,
        fontWeight: 'bold',
        fontSize: 12,
    },
    list: {
        padding: THEME.spacing.m,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomColor: THEME.colors.surface,
        borderBottomWidth: 1,
    },
    avatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: THEME.colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: THEME.spacing.m,
    },
    avatarText: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
    },
    textContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    name: {
        fontSize: 17,
        fontWeight: '600',
        color: THEME.colors.text,
    },
    time: {
        fontSize: 12,
        color: THEME.colors.textSecondary,
    },
    lastMsg: {
        color: THEME.colors.textSecondary,
        fontSize: 14,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: THEME.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },
    fabText: {
        fontSize: 24,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24
    },
    modalContent: {
        width: '100%',
        backgroundColor: THEME.colors.surface,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: THEME.colors.border
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 16
    },
    modalInput: {
        backgroundColor: THEME.colors.background,
        color: 'white',
        borderRadius: 8,
        padding: 12,
        marginBottom: 24,
        fontSize: 16
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12
    },
    modalButtonCancel: {
        padding: 12
    },
    modalButtonSave: {
        backgroundColor: THEME.colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8
    },
    modalButtonText: {
        color: 'white',
        fontWeight: 'bold'
    }
});
