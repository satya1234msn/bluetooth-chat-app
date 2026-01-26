
import { create } from 'zustand';
import { MessagePacket, Peer } from '../modules/MeshTypes';
import { router } from '../modules/MeshRouter';
import { storage } from '../modules/StorageService';

interface ChatState {
    conversations: Record<string, MessagePacket[]>; // peerId -> messages
    peers: Peer[];
    deviceId: string;
    isReady: boolean;
    activePeerId: string | null; // Currently selected chat

    initialize: () => Promise<void>;
    sendMessage: (text: string, targetId?: string) => Promise<void>;
    refreshMessages: () => void;
    setActivePeer: (peerId: string | null) => void;
    renamePeer: (peerId: string, newName: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
    conversations: {},
    peers: [],
    deviceId: '',
    isReady: false,
    activePeerId: null,

    initialize: async () => {
        console.log('[STORE] Initializing chat store...');
        // Hook router callback
        router.onNewMessage = (msg) => {
            console.log('[STORE] onNewMessage callback triggered:', msg.id);
            get().refreshMessages();
        };

        router.onPeerUpdate = (peers) => {
            console.log('[STORE] onPeerUpdate callback triggered, peer count:', peers.length);
            set({ peers });
        };

        console.log('[STORE] Starting router...');
        await router.start();
        console.log('[STORE] Router started');

        // Initial Load
        console.log('[STORE] Running initial refresh...');
        get().refreshMessages();

        const { security } = require('../modules/SecurityModule');
        console.log('[STORE] Device ID:', security.deviceId);
        set({ deviceId: security.deviceId, isReady: true });
        console.log('[STORE] Initialization complete');
    },

    sendMessage: async (text: string, targetId: string = 'BROADCAST') => {
        // console.log('[STORE] Sending message to:', targetId, 'content:', text);
        await router.sendMessage(text, targetId);
        get().refreshMessages();
    },

    refreshMessages: () => {
        const allMsgs = storage.getMessages();
        const myId = get().deviceId;
        console.log('[STORE] refreshMessages - Total messages in storage:', allMsgs.length);
        console.log('[STORE] My device ID:', myId);

        // Group by Peer
        const newConversations: Record<string, MessagePacket[]> = {};

        allMsgs.forEach(msg => {
            // Determine who the "other" person is
            const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
            // If receiver was BROADCAST, then everyone sees it in BROADCAST channel
            const key = (msg.receiverId === 'BROADCAST' || msg.receiverId === 'ALL') ? 'BROADCAST' : otherId;

            // Primary bucket
            if (!newConversations[key]) newConversations[key] = [];
            newConversations[key].push(msg);

            // UX IMPROVEMENT: If it's an incoming BROADCAST from someone else, 
            // also show it in the private chat with that person.
            // This ensures if User A sends a "DM" (which is actually broadcast), User B sees it in User A's chat.
            if (key === 'BROADCAST' && msg.senderId !== myId) {
                const senderKey = msg.senderId;
                if (!newConversations[senderKey]) newConversations[senderKey] = [];
                // Only add if not already there (though we are rebuilding from scratch so it's fine)
                newConversations[senderKey].push(msg);
            }
        });

        // console.log('[STORE] Conversation keys created:', Object.keys(newConversations));
        set({ conversations: newConversations });
    },

    setActivePeer: (peerId) => set({ activePeerId: peerId }),

    renamePeer: async (peerId: string, newName: string) => {
        const peer = storage.getPeer(peerId);
        if (peer) {
            await storage.savePeer({ ...peer, name: newName });
            // Refresh peers in state
            const peers = storage.getPeers();
            set({ peers });
        }
    }
}));
