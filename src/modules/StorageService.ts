
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessagePacket, Peer } from './MeshTypes';

const STORAGE_KEYS = {
    MESSAGES: 'mesh_messages',
    PEERS: 'mesh_peers',
    PROCESSED_IDS: 'mesh_processed_ids',
};

class StorageService {
    private messages: Map<string, MessagePacket> = new Map();
    private peers: Map<string, Peer> = new Map();
    private processedIds: Set<string> = new Set(); // Bloom filter proxy

    async initialize() {
        try {
            // Load Messages
            const msgJson = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGES);
            if (msgJson) {
                const msgs: MessagePacket[] = JSON.parse(msgJson);
                msgs.forEach(m => this.messages.set(m.id, m));
            }

            // Load Peers
            const peerJson = await AsyncStorage.getItem(STORAGE_KEYS.PEERS);
            if (peerJson) {
                const p: Peer[] = JSON.parse(peerJson);
                p.forEach(x => this.peers.set(x.id, x));
            }

            // Load Processed IDs (for deduping)
            const idsJson = await AsyncStorage.getItem(STORAGE_KEYS.PROCESSED_IDS);
            if (idsJson) {
                const ids: string[] = JSON.parse(idsJson);
                ids.forEach(id => this.processedIds.add(id));
            }

            console.log(`Storage Loaded: ${this.messages.size} msgs, ${this.peers.size} peers`);
        } catch (e) {
            console.error('Storage Init Failed', e);
        }
    }

    async saveMessage(msg: MessagePacket): Promise<void> {
        if (this.messages.has(msg.id)) {
            console.log('[STORAGE] Message already exists:', msg.id);
            return;
        }

        console.log('[STORAGE] Saving new message:', msg.id, 'sender:', msg.senderId, 'receiver:', msg.receiverId);
        this.messages.set(msg.id, msg);
        this.processedIds.add(msg.id);

        // Persist (Batching recommended in production, simple here)
        await this.persistMessages();
        await this.persistIds();
        console.log('[STORAGE] Message persisted. Total messages:', this.messages.size);
    }

    getMessages(): MessagePacket[] {
        const messages = Array.from(this.messages.values()).sort((a, b) => b.timestamp - a.timestamp);
        console.log('[STORAGE] getMessages called, returning', messages.length, 'messages');
        return messages;
    }

    getMessage(id: string): MessagePacket | undefined {
        return this.messages.get(id);
    }

    hasMessage(id: string): boolean {
        return this.processedIds.has(id);
    }

    // --- Peers --- //

    async savePeer(peer: Peer): Promise<void> {
        console.log('[STORAGE] Saving peer:', peer.id, 'name:', peer.name);
        this.peers.set(peer.id, peer);
        await this.persistPeers();
        console.log('[STORAGE] Peer saved. Total peers:', this.peers.size);
    }

    getPeers(): Peer[] {
        return Array.from(this.peers.values());
    }

    getPeer(id: string): Peer | undefined {
        return this.peers.get(id);
    }

    // --- Helpers --- //

    private async persistMessages() {
        const arr = Array.from(this.messages.values());
        await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(arr));
    }

    private async persistPeers() {
        const arr = Array.from(this.peers.values());
        await AsyncStorage.setItem(STORAGE_KEYS.PEERS, JSON.stringify(arr));
    }

    private async persistIds() {
        // Prune old IDs if set gets too large (e.g. > 1000)
        if (this.processedIds.size > 2000) {
            // logic to remove old ids
        }
        await AsyncStorage.setItem(STORAGE_KEYS.PROCESSED_IDS, JSON.stringify(Array.from(this.processedIds)));
    }
}

export const storage = new StorageService();
