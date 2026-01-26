import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useChatStore } from '../store/useChatStore';
import { MessagePacket } from '../modules/MeshTypes';
import { THEME } from '../theme/colors';

export const ChatScreen = ({ route, navigation }: any) => {
    const { userId, userName } = route.params || {};
    const { conversations, deviceId, sendMessage, initialize } = useChatStore();
    const [inputText, setInputText] = useState('');

    // Get specific conversion
    const messages = conversations[userId] || [];
    const flatListRef = useRef<FlatList>(null);
    const lastMessageCountRef = useRef(0);

    // Only log when message count changes, not on every render
    useEffect(() => {
        if (messages.length !== lastMessageCountRef.current) {
            console.log('[CHAT_SCREEN] Messages updated for userId:', userId, 'count:', messages.length);
            lastMessageCountRef.current = messages.length;
        }
    }, [messages.length, userId]);

    const handleSend = () => {
        if (inputText.trim().length === 0) return;
        console.log('[CHAT_SCREEN] Sending message to:', userId, 'content:', inputText.trim());
        sendMessage(inputText.trim(), userId); // Send to specific user
        setInputText('');
    };

    const renderItem = ({ item }: { item: MessagePacket }) => {
        const isMe = item.senderId === deviceId;
        return (
            <View style={[styles.bubbleContainer, isMe ? styles.rightAlign : styles.leftAlign]}>
                <View style={[styles.bubble, isMe ? styles.sentBubble : styles.receivedBubble]}>
                    <Text style={[styles.messageText, isMe ? { color: THEME.colors.textSent } : { color: THEME.colors.textReceived }]}>
                        {item.content}
                    </Text>
                    <Text style={styles.timeText}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {item.ttl < 3 && ' • relayed'}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <View style={styles.avatarSmall}>
                        <Text style={styles.avatarTextSmall}>{userName?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>{userName}</Text>
                        <Text style={styles.headerSubtitle}>ID: {userId ? userId.substring(0, 8) : 'Unknown'}</Text>
                    </View>
                </View>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                inverted
                contentContainerStyle={styles.listContent}
            />

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Message..."
                    placeholderTextColor={THEME.colors.textSecondary}
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSend}
                />
                <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                    <Text style={styles.sendButtonText}>➤</Text>
                </TouchableOpacity>
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
        padding: THEME.spacing.m,
        backgroundColor: THEME.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: THEME.colors.border,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: THEME.spacing.s,
    },
    backButton: {
        padding: THEME.spacing.s,
    },
    backButtonText: {
        color: THEME.colors.text,
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.colors.text,
    },
    headerSubtitle: {
        fontSize: 12,
        color: THEME.colors.textSecondary,
    },
    avatarSmall: {
        width: 36,
        height: 36,
        borderRadius: THEME.borderRadius.round,
        backgroundColor: THEME.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: THEME.spacing.s,
    },
    avatarTextSmall: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    listContent: {
        paddingHorizontal: THEME.spacing.m,
        paddingBottom: THEME.spacing.m,
    },
    bubbleContainer: {
        marginVertical: 4,
        flexDirection: 'row',
    },
    rightAlign: {
        justifyContent: 'flex-end',
    },
    leftAlign: {
        justifyContent: 'flex-start',
    },
    bubble: {
        padding: 12,
        borderRadius: 20,
        maxWidth: '75%',
    },
    sentBubble: {
        backgroundColor: THEME.colors.bubbleSent,
        borderBottomRightRadius: 2,
    },
    receivedBubble: {
        backgroundColor: THEME.colors.bubbleReceived,
        borderBottomLeftRadius: 2,
    },
    messageText: {
        fontSize: 16,
    },
    timeText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        alignSelf: 'flex-end',
        marginTop: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: THEME.spacing.m,
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
    },
    sendButton: {
        backgroundColor: THEME.colors.primary,
        borderRadius: 24,
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonText: {
        color: 'white',
        fontSize: 18,
    },
});
