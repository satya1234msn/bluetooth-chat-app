import { create } from 'zustand';
import { Vibration } from 'react-native';
import { MessagePacket, Peer } from '../modules/MeshTypes';
import { router } from '../modules/MeshRouter';
import { storage } from '../modules/StorageService';
import { security } from '../modules/SecurityModule';

interface ChatState {
    conversations: Record<string, MessagePacket[]>; // peerId -> messages (newest first)
    unreadCounts: Record<string, number>;           // peerId -> unread count
    peers: Peer[];
    deviceId: string;
    isReady: boolean;
    activePeerId: string | null;

    initialize: () => Promise<void>;
    sendMessage: (text: string, targetId: string) => Promise<void>;
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

        // Hook router callbacks
        router.onNewMessage = (msg: MessagePacket) => {
            const state = get();

            // If the message is NOT from me and I'm NOT viewing this conversation,
            // increment unread count and vibrate
            if (msg.senderId !== state.deviceId) {
                if (state.activePeerId !== msg.senderId) {
                    const currentCount = state.unreadCounts[msg.senderId] || 0;
                    set({
                        unreadCounts: {
                            ...state.unreadCounts,
                            [msg.senderId]: currentCount + 1,
                        },
                    });
                    Vibration.vibrate(500);
                }
            }

            get().refreshMessages();
        };

        router.onPeerUpdate = (peers: Peer[]) => {
            set({ peers });
        };

        console.log('[STORE] Starting router...');
        await router.start();
        console.log('[STORE] Router started');

        set({ deviceId: security.deviceId, isReady: true });

        // Initial message load
        get().refreshMessages();
    },

    sendMessage: async (text: string, targetId: string) => {
        if (!targetId) {
            console.error('[STORE] sendMessage called without targetId');
            return;
        }
        await router.sendMessage(text, targetId);
        get().refreshMessages();
    },

    refreshMessages: () => {
        const allMsgs = storage.getMessages();
        const myId = get().deviceId;

        // Group messages by the "other" participant in each conversation
        const newConversations: Record<string, MessagePacket[]> = {};
        const seenInBucket: Record<string, Set<string>> = {};

        const addToBucket = (key: string, msg: MessagePacket) => {
            if (!newConversations[key]) {
                newConversations[key] = [];
                seenInBucket[key] = new Set();
            }
            if (!seenInBucket[key].has(msg.id)) {
                seenInBucket[key].add(msg.id);
                newConversations[key].push(msg);
            }
        };

        allMsgs.forEach(msg => {
            const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
            addToBucket(otherId, msg);
        });

        set({ conversations: newConversations });
    },

    setActivePeer: (peerId: string | null) => {
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
    },
}));
