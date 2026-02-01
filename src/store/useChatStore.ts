import { create } from 'zustand';
import { Vibration } from 'react-native';
import { MessagePacket, Peer } from '../modules/MeshTypes';
import { router } from '../modules/MeshRouter';
import { storage } from '../modules/StorageService';

interface ChatState {
    conversations: Record<string, MessagePacket[]>; // peerId -> messages
    unreadCounts: Record<string, number>; // peerId -> count
    peers: Peer[];
    deviceId: string;
    isReady: boolean;
    activePeerId: string | null; // Currently selected chat

    initialize: () => Promise<void>;
    sendMessage: (text: string, targetId?: string) => Promise<void>;
    refreshMessages: () => void;
    setActivePeer: (peerId: string | null) => void;
    renamePeer: (peerId: string, newName: string) => Promise<void>;
    markAsRead: (peerId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    conversations: {},
    unreadCounts: {},
    peers: [],
    deviceId: '',
    isReady: false,
    activePeerId: null,

    initialize: async () => {
        console.log('[STORE] Initializing chat store...');
        // Hook router callback
        router.onNewMessage = (msg: MessagePacket) => {
            // console.log('[STORE] onNewMessage callback triggered:', msg.id);
            const state = get();

            // Notification Logic
            // If message is NOT from me, and IS new (not re-loaded from storage on init)
            // But wait, onNewMessage is called for every "new" message router finds
            // If I am NOT in the chat with this person, vibrate and increment unread
            if (msg.senderId !== state.deviceId) {
                if (state.activePeerId !== msg.senderId) {
                    // Increment Unread
                    const currentCount = state.unreadCounts[msg.senderId] || 0;
                    set({
                        unreadCounts: {
                            ...state.unreadCounts,
                            [msg.senderId]: currentCount + 1
                        }
                    });

                    // Haptic Notification
                    Vibration.vibrate(500); // 500ms vibration
                }
            }

            get().refreshMessages();
        };

        router.onPeerUpdate = (peers) => {
            // console.log('[STORE] onPeerUpdate callback triggered, peer count:', peers.length);
            set({ peers });
        };

        // ... rest of initialize ...
        console.log('[STORE] Starting router...');
        await router.start();
        console.log('[STORE] Router started');

        const { security } = require('../modules/SecurityModule');
        set({ deviceId: security.deviceId, isReady: true });

        // Final refresh
        get().refreshMessages();
    },

    sendMessage: async (text: string, targetId: string = 'BROADCAST') => {
        await router.sendMessage(text, targetId);
        get().refreshMessages();
    },

    refreshMessages: () => {
        const allMsgs = storage.getMessages();
        const myId = get().deviceId;

        // Group by Peer
        const newConversations: Record<string, MessagePacket[]> = {};

        allMsgs.forEach(msg => {
            const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
            const key = (msg.receiverId === 'BROADCAST' || msg.receiverId === 'ALL') ? 'BROADCAST' : otherId;

            // Primary bucket
            if (!newConversations[key]) newConversations[key] = [];
            newConversations[key].push(msg);

            // Cross-posting for visibility
            if (key === 'BROADCAST' && msg.senderId !== myId) {
                const senderKey = msg.senderId;
                if (!newConversations[senderKey]) newConversations[senderKey] = [];
                newConversations[senderKey].push(msg);
            }
        });

        set({ conversations: newConversations });
    },

    setActivePeer: (peerId) => {
        set({ activePeerId: peerId });
        if (peerId) {
            get().markAsRead(peerId);
        }
    },

    markAsRead: (peerId: string) => {
        const state = get();
        if (state.unreadCounts[peerId]) {
            const newCounts = { ...state.unreadCounts };
            delete newCounts[peerId];
            set({ unreadCounts: newCounts });
        }
    },

    renamePeer: async (peerId: string, newName: string) => {
        const peer = storage.getPeer(peerId);
        if (peer) {
            await storage.savePeer({ ...peer, name: newName });
            const peers = storage.getPeers();
            set({ peers });
        }
    }
}));
