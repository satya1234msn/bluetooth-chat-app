import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { useChatStore } from '../store/useChatStore';
import { MessagePacket } from '../modules/MeshTypes';
import { THEME } from '../theme/colors';

export const ChatScreen = ({ route, navigation }: any) => {
    const { userId, userName } = route.params || {};
    const { conversations, deviceId, sendMessage, setActivePeer, peers } = useChatStore();
    const [inputText, setInputText] = useState('');
    const flatListRef = useRef<FlatList<MessagePacket>>(null);
    const lastMessageCountRef = useRef(0);

    // Mark peer as active for read-receipt tracking
    useEffect(() => {
        setActivePeer(userId);
        return () => setActivePeer(null);
    }, [userId, setActivePeer]);

    // Get messages for this conversation (newest first from storage)
    const messages = conversations[userId] || [];
    const peer = peers.find(p => p.id === userId);
    const isOnline = peer?.status === 'connected';

    // Log only when message count changes
    useEffect(() => {
        if (messages.length !== lastMessageCountRef.current) {
            console.log('[CHAT_SCREEN] Messages updated for', userId, 'count:', messages.length);
            lastMessageCountRef.current = messages.length;
        }
    }, [messages.length, userId]);

    const handleSend = () => {
        const text = inputText.trim();
        if (!text) return;
        console.log('[CHAT_SCREEN] Sending message to:', userId);
        sendMessage(text, userId);
        setInputText('');
    };

    const renderItem = ({ item }: { item: MessagePacket }) => {
        const isMe = item.senderId === deviceId;
        const isRelayed = item.ttl < 3;

        return (
            <View style={[styles.bubbleContainer, isMe ? styles.rightAlign : styles.leftAlign]}>
                <View style={[styles.bubble, isMe ? styles.sentBubble : styles.receivedBubble]}>
                    <Text style={[styles.messageText, { color: isMe ? THEME.colors.textSent : THEME.colors.textReceived }]}>
                        {item.content}
                    </Text>
                    <View style={styles.metaRow}>
                        {isRelayed && (
                            <Text style={styles.relayedText}>📡 relayed</Text>
                        )}
                        <Text style={styles.timeText}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptySubtitle}>
                Messages are sent directly over{'\n'}Bluetooth — no internet required.
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={THEME.colors.surface} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <View style={styles.avatarSmall}>
                        <Text style={styles.avatarTextSmall}>{userName?.[0]?.toUpperCase() ?? '?'}</Text>
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>{userName}</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: isOnline ? THEME.colors.statusOnline : THEME.colors.statusOffline }]} />
                            <Text style={styles.headerSubtitle}>
                                {isOnline ? 'Nearby • Direct' : `ID: ${userId ? userId.substring(0, 8) : 'Unknown'}`}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Message List — inverted so newest is at bottom */}
            {messages.length === 0 ? (
                renderEmpty()
            ) : (
                <FlatList<MessagePacket>
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    inverted
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Input Bar */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Message..."
                        placeholderTextColor={THEME.colors.textSecondary}
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={handleSend}
                        returnKeyType="send"
                        multiline={false}
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        disabled={!inputText.trim()}
                    >
                        <Text style={styles.sendButtonText}>➤</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
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
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarSmall: {
        width: 38,
        height: 38,
        borderRadius: THEME.borderRadius.round,
        backgroundColor: THEME.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: THEME.spacing.s,
    },
    avatarTextSmall: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: THEME.colors.text,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginRight: 5,
    },
    headerSubtitle: {
        fontSize: 12,
        color: THEME.colors.textSecondary,
    },

    // Message list
    listContent: {
        paddingHorizontal: THEME.spacing.m,
        paddingVertical: THEME.spacing.s,
    },
    listContentEmpty: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIcon: {
        fontSize: 56,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: THEME.colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: THEME.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Bubbles
    bubbleContainer: {
        marginVertical: 3,
        flexDirection: 'row',
    },
    rightAlign: {
        justifyContent: 'flex-end',
    },
    leftAlign: {
        justifyContent: 'flex-start',
    },
    bubble: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 7,
        borderRadius: 20,
        maxWidth: '78%',
    },
    sentBubble: {
        backgroundColor: THEME.colors.bubbleSent,
        borderBottomRightRadius: 4,
    },
    receivedBubble: {
        backgroundColor: THEME.colors.bubbleReceived,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: THEME.colors.border,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 21,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    timeText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 10,
    },
    relayedText: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 10,
    },

    // Input
    inputContainer: {
        flexDirection: 'row',
        paddingHorizontal: THEME.spacing.m,
        paddingVertical: 10,
        backgroundColor: THEME.colors.surface,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: THEME.colors.border,
    },
    input: {
        flex: 1,
        backgroundColor: THEME.colors.background,
        color: THEME.colors.text,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 10,
        fontSize: 15,
        borderWidth: 1,
        borderColor: THEME.colors.border,
    },
    sendButton: {
        backgroundColor: THEME.colors.primary,
        borderRadius: 24,
        width: 46,
        height: 46,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: THEME.colors.border,
    },
    sendButtonText: {
        color: 'white',
        fontSize: 18,
    },
});
