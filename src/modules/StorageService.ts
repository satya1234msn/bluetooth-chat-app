
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessagePacket, Peer } from './MeshTypes';

const STORAGE_KEYS = {
    MESSAGES: 'mesh_messages',
    PEERS: 'mesh_peers',
    PROCESSED_IDS: 'mesh_processed_ids',
    MY_USERNAME: 'mesh_my_username',
};

const MAX_PROCESSED_IDS = 2000;
const PRUNE_PROCESSED_IDS_TO = 1000;

class StorageService {
    private messages: Map<string, MessagePacket> = new Map();
    private peers: Map<string, Peer> = new Map();
    private processedIds: Set<string> = new Set();
    private _myUsername: string = '';

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

            // Load Processed IDs (for deduplication)
            const idsJson = await AsyncStorage.getItem(STORAGE_KEYS.PROCESSED_IDS);
            if (idsJson) {
                const ids: string[] = JSON.parse(idsJson);
                ids.forEach(id => this.processedIds.add(id));
            }

            // Load Username
            const username = await AsyncStorage.getItem(STORAGE_KEYS.MY_USERNAME);
            if (username) {
                this._myUsername = username;
            }

            console.log(
                `[STORAGE] Loaded: ${this.messages.size} msgs, ${this.peers.size} peers, username: "${this._myUsername || 'not set'}"`
            );
        } catch (e) {
            console.error('[STORAGE] Init Failed:', e);
        }
    }

    // --- Username --- //

    get myUsername(): string {
        return this._myUsername;
    }

    async setMyUsername(name: string): Promise<void> {
        // Limit to 15 chars for BLE packet size
        this._myUsername = name.substring(0, 15);
        await AsyncStorage.setItem(STORAGE_KEYS.MY_USERNAME, this._myUsername);
        console.log('[STORAGE] Username saved:', this._myUsername);
    }

    // --- Messages --- //

    async saveMessage(msg: MessagePacket): Promise<void> {
        if (this.messages.has(msg.id)) {
            return; // Already stored
        }

        this.messages.set(msg.id, msg);
        this.processedIds.add(msg.id);

        await this.persistMessages();
        await this.persistIds();
        console.log('[STORAGE] Message saved:', msg.id, '| Total:', this.messages.size);
    }

    getMessages(): MessagePacket[] {
        return Array.from(this.messages.values()).sort((a, b) => b.timestamp - a.timestamp);
    }

    getMessage(id: string): MessagePacket | undefined {
        return this.messages.get(id);
    }

    hasMessage(id: string): boolean {
        return this.processedIds.has(id);
    }

    // --- Peers --- //

    async savePeer(peer: Peer): Promise<void> {
        this.peers.set(peer.id, peer);
        await this.persistPeers();
    }

    getPeers(): Peer[] {
        return Array.from(this.peers.values());
    }

    getPeer(id: string): Peer | undefined {
        return this.peers.get(id);
    }

    // --- Private Helpers --- //

    private async persistMessages() {
        const arr = Array.from(this.messages.values());
        await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(arr));
    }

    private async persistPeers() {
        const arr = Array.from(this.peers.values());
        await AsyncStorage.setItem(STORAGE_KEYS.PEERS, JSON.stringify(arr));
    }

    private async persistIds() {
        // Prune old IDs when the set exceeds the limit to prevent storage bloat
        if (this.processedIds.size > MAX_PROCESSED_IDS) {
            const idsArray = Array.from(this.processedIds);
            const pruned = idsArray.slice(idsArray.length - PRUNE_PROCESSED_IDS_TO);
            this.processedIds = new Set(pruned);
            console.log('[STORAGE] Pruned processedIds to', this.processedIds.size);
        }
        await AsyncStorage.setItem(
            STORAGE_KEYS.PROCESSED_IDS,
            JSON.stringify(Array.from(this.processedIds))
        );
    }
}

export const storage = new StorageService();
