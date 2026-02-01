
import { storage } from './StorageService';
import { security } from './SecurityModule';
import { BleModule, BlePacket } from './BleModule';
import { MessagePacket } from './MeshTypes';
import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';

// Constants
const BROADCAST_INTERVAL = 2000;
const TTL_DEFAULT = 3;

export class MeshRouter {
    private ble: BleModule;

    // Callback to update UI
    public onNewMessage?: (msg: MessagePacket) => void;
    public onPeerUpdate?: (peers: any[]) => void;

    constructor() {
        this.ble = new BleModule(this.handlePacket.bind(this));
    }

    async start() {
        console.log('Starting MeshRouter...');
        await storage.initialize();
        await security.initialize();
        await this.ble.initialize();

        this.ble.startScanning();

        // Advertise our presence so other devices can discover us
        await this.ble.advertisePresence(security.deviceId);
        console.log('[ROUTER] Started advertising presence');

        // Rebroadcast loop (Naive flooding: Pick random message and broadcast)
        // In a real app, we queue recent messages.
        setInterval(() => this.gossip(), BROADCAST_INTERVAL);
    }

    /**
     * Create and send a new message
     */
    async sendMessage(content: string, receiverId: string = 'BROADCAST', type: 'text' | 'image' = 'text') {
        try {
            // Use simpler UUID generation
            const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const timestamp = Date.now();
            console.log('[ROUTER] sendMessage called - receiver:', receiverId, 'content:', content);

            // Encrypt if private
            let finalContent = content;
            if (receiverId !== 'ALL' && receiverId !== 'BROADCAST') {
                // Lookup peer key... (Simulated for assignment)
                // finalContent = security.encryptForPeer(content, peerKey);
            }

            // Sign
            console.log('[ROUTER] Creating signature...');
            const signature = security.sign(finalContent);
            console.log('[ROUTER] Signature created');

            const msg: MessagePacket = {
                id,
                senderId: security.deviceId,
                receiverId,
                content: finalContent,
                timestamp,
                type,
                ttl: TTL_DEFAULT,
                hops: 0,
                signature
            };

            console.log('[ROUTER] Created message:', msg.id, 'Processing...');
            await this.processIncomingMessage(msg); // Save and display my own message
            console.log('[ROUTER] Message processed and saved');
        } catch (error) {
            console.error('[ROUTER] sendMessage ERROR:', error);
            throw error;
        }
    }

    /**
     * Handle Raw BLE Packet
     * In a real implementation, this reassembles fragments.
     * Here we assume the packet contains a serialized JSON (for demo simplicity/large MTU sim)
     * or a custom binary structure.
     */
    private async handlePacket(packet: BlePacket) {
        try {
            // Check for Device ID advertisement (12 chars, hex)
            if (packet.data && packet.data.length === 12 && /^[0-9A-F]+$/.test(packet.data)) {
                // Throttle logs: Only log if we haven't seen this recently (implied by storage update check?)
                // Actually, just remove the log or make it debug-level/conditional
                // console.log('[ROUTER] Received device ID advertisement:', packet.data); 

                const existingPeer = storage.getPeer(packet.data);

                // Only save/log if status changed or it's new, otherwise just update timestamp silently
                const now = Date.now();
                if (!existingPeer || (now - existingPeer.lastSeen > 5000)) {
                    // Only update storage explicitely every 5s to avoid disk thrashing
                    await storage.savePeer({
                        id: packet.data,
                        publicKey: 'TODO_PK',
                        lastSeen: now,
                        status: 'connected',
                        name: existingPeer?.name || packet.data.substring(0, 6)
                    });
                    if (this.onPeerUpdate) this.onPeerUpdate(storage.getPeers());
                }
                return;
            }

            // Check for Short Message format: "ID:CONTENT"
            // ID is 12 chars, hex + 1 colon + content
            if (packet.data.includes(':')) {
                const parts = packet.data.split(':');
                const senderId = parts[0];
                const content = parts.slice(1).join(':'); // Rejoin in case content has colons

                if (senderId.length === 12 && /^[0-9A-F]+$/.test(senderId)) {
                    // console.log('[ROUTER] Received Short Message from:', senderId, 'Content:', content);

                    // CRITICAL FIX: Generate a STABLE ID based on content to prevent infinite loops
                    // The BLE scanner sees the same packet 50x/sec. We must dedup it.
                    // Simple Hash: Base64 of "SENDER:CONTENT"
                    // To allow sending the same message again later, we add a rough timestamp bucket
                    // INCREASED TO 60 SECONDS to prevent spam
                    const timeBucket = Math.floor(Date.now() / 60000);
                    // Use full content for uniqueness (it's short anyway due to BLE limits)
                    // Removing substring(0,5) to prevent collision between "Hello" and "Hello 2"
                    const stableId = `msg_${senderId}_${content}_${timeBucket}`;

                    // Create dummy message packet
                    const msg: MessagePacket = {
                        id: stableId,
                        senderId: senderId,
                        receiverId: 'BROADCAST',
                        content: content,
                        timestamp: Date.now(),
                        type: 'text',
                        ttl: 0,
                        hops: 0,
                        signature: ''
                    };

                    await this.processIncomingMessage(msg);
                    return;
                }
            }

        } catch (e) {
            // Not a valid packet, ignore
        }
    }

    /**
     * Core Routing Logic: Store & Forward
     */
    private async processIncomingMessage(msg: MessagePacket) {
        // 1. Dedup
        if (storage.hasMessage(msg.id)) {
            console.log('[ROUTER] Duplicate message ignored:', msg.id);
            return;
        }

        console.log('[ROUTER] New Message Received:', msg.id, 'from:', msg.senderId, 'to:', msg.receiverId);

        // 2. Decrement TTL
        // If I am not the sender, decrement
        if (msg.senderId !== security.deviceId) {
            msg.ttl -= 1;
            msg.hops += 1;
            console.log('[ROUTER] Decremented TTL to:', msg.ttl);
        }

        // 3. Save
        console.log('[ROUTER] Saving message to storage...');
        await storage.saveMessage(msg);
        console.log('[ROUTER] Message saved');

        // 3.1 Update Peer Presence
        const existingPeer = storage.getPeer(msg.senderId);
        await storage.savePeer({
            id: msg.senderId,
            publicKey: 'TODO_PK',
            lastSeen: Date.now(),
            status: 'connected',
            name: existingPeer?.name || msg.senderId.substring(0, 6) // Preserve name or use default
        });
        console.log('[ROUTER] Peer presence updated for:', msg.senderId);

        if (this.onNewMessage) {
            console.log('[ROUTER] Triggering onNewMessage callback');
            this.onNewMessage(msg);
        } else {
            console.warn('[ROUTER] onNewMessage callback not set!');
        }

        if (this.onPeerUpdate) {
            console.log('[ROUTER] Triggering onPeerUpdate callback');
            this.onPeerUpdate(storage.getPeers());
        }

        // 4. Relay (Flood)
        if (msg.ttl > 0) {
            console.log('[ROUTER] Relaying message via BLE...');
            this.broadcastMessage(msg);
        }
    }

    private async broadcastMessage(msg: MessagePacket) {
        // BLE limit is 31 bytes. 
        // We need to fit: SenderID (12) + content.
        // Format: ID:CONTENT -> "ABCDEF123456:Hello"
        // 12 chars + 1 colon + content. 
        // Available for content: 31 - 13 = 18 bytes.

        try {
            const compactPayload = `${msg.senderId}:${msg.content}`;
            const len = Buffer.byteLength(compactPayload, 'utf8');

            if (len <= 31) {
                console.log('[ROUTER] Broadcasting short message:', compactPayload);
                const buffer = Buffer.from(compactPayload, 'utf8');
                await this.ble.broadcast(buffer);
            } else {
                console.log('[ROUTER] Message too long for BLE legacy broadcast (' + len + ' > 31 bytes). Saved locally only.');
            }
        } catch (e) {
            console.warn('[ROUTER] Broadcast prep failed', e);
        }
    }

    private async gossip() {
        // Pick a random recent message and rebroadcast to ensure propagation?
        // Or just rely on the immediate relay.
        // Immediate relay is better for battery.
        // Gossip is for anti-entropy.
    }
}

export const router = new MeshRouter();
