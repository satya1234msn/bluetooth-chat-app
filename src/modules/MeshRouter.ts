
import { storage } from './StorageService';
import { security } from './SecurityModule';
import { BleModule, BlePacket } from './BleModule';
import { MessagePacket, Peer } from './MeshTypes';
import { Buffer } from 'buffer';

// Constants
const PEER_SHARE_INTERVAL = 10000; // Share peer list every 10 seconds
const TTL_DEFAULT = 3;
const RELAY_TTL = 2; // TTL for relayed messages

export class MeshRouter {
    private ble: BleModule;
    private relayedMessages: Set<string> = new Set(); // Track relayed message IDs
    private intervals: ReturnType<typeof setInterval>[] = [];

    // Callbacks to update UI
    public onNewMessage?: (msg: MessagePacket) => void;
    public onPeerUpdate?: (peers: Peer[]) => void;

    constructor() {
        this.ble = new BleModule(this.handlePacket.bind(this));
    }

    async start() {
        console.log('Starting MeshRouter...');
        await storage.initialize();
        await security.initialize();
        await this.ble.initialize();

        this.ble.startScanning();

        // Advertise our presence with username so other devices can discover us
        await this.ble.advertisePresence(security.deviceId, storage.myUsername);
        console.log('[ROUTER] Started advertising presence with username:', storage.myUsername);

        // Periodically share our peer list for mesh discovery
        const peerShareInterval = setInterval(() => this.sharePeerList(), PEER_SHARE_INTERVAL);
        this.intervals.push(peerShareInterval);
    }

    /**
     * Update BLE presence advertisement (e.g. after username change)
     */
    async updatePresence(username: string) {
        try {
            this.ble.stopBroadcast();
            await this.ble.advertisePresence(security.deviceId, username);
            console.log('[ROUTER] Updated presence advertisement with username:', username);
        } catch (e) {
            console.warn('[ROUTER] Failed to update presence:', e);
        }
    }

    /**
     * Stop all intervals and BLE activity
     */
    stop() {
        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];
        this.ble.stopScanning();
        this.ble.stopBroadcast();
    }

    /**
     * Share our known peers with nearby devices
     * Format: "PEERS:ID1,ID2,ID3" (6-char IDs)
     */
    private async sharePeerList() {
        try {
            const peers = storage.getPeers();
            if (peers.length === 0) return;

            // Only share direct peers (not indirect ones to prevent loops)
            const directPeers = peers.filter(p => p.status === 'connected');
            if (directPeers.length === 0) return;

            // Take up to 3 peers to fit in BLE packet (31 bytes limit)
            // "PEERS:" = 6 bytes, each ID = 6 bytes + comma = 7 bytes
            // Max: 6 + 7*3 = 27 bytes
            const peerIds = directPeers
                .slice(0, 3)
                .map(p => p.id.substring(0, 6))
                .join(',');

            const payload = `PEERS:${peerIds}`;
            console.log('[ROUTER] Sharing peer list:', payload);
            await this.ble.broadcast(Buffer.from(payload, 'utf8'));
        } catch (e) {
            console.warn('[ROUTER] Failed to share peer list:', e);
        }
    }

    /**
     * Create and send a new message
     */
    async sendMessage(content: string, receiverId: string, type: 'text' | 'image' = 'text') {
        if (!receiverId) {
            console.error('[ROUTER] sendMessage called without receiverId');
            return;
        }
        try {
            const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const timestamp = Date.now();
            console.log('[ROUTER] sendMessage called - receiver:', receiverId, 'content:', content);

            const signature = security.sign(content);

            const msg: MessagePacket = {
                id,
                senderId: security.deviceId,
                receiverId,
                content,
                timestamp,
                type,
                ttl: TTL_DEFAULT,
                hops: 0,
                signature,
            };

            console.log('[ROUTER] Created message:', msg.id, 'Processing...');
            await this.processIncomingMessage(msg);
            console.log('[ROUTER] Message processed and saved');
        } catch (error) {
            console.error('[ROUTER] sendMessage ERROR:', error);
            throw error;
        }
    }

    /**
     * Handle Raw BLE Packet
     */
    private async handlePacket(packet: BlePacket) {
        try {
            // --- Presence Advertisement ---
            // Format: DEVICEID (12 uppercase hex chars) OR DEVICEID:Username
            // The $ anchor ensures this won't match the message format (SENDER6:RECEIVER6:Content)
            // because messages use 6-char short IDs at the start, not 12.
            const presenceMatch = packet.data.match(/^([0-9A-F]{12})(?::(.+))?$/);
            if (presenceMatch) {
                const deviceId = presenceMatch[1];
                const username = presenceMatch[2]; // May be undefined
                const existingPeer = storage.getPeer(deviceId);
                const now = Date.now();

                if (!existingPeer || now - existingPeer.lastSeen > 5000) {
                    await storage.savePeer({
                        id: deviceId,
                        publicKey: 'TODO_PK',
                        lastSeen: now,
                        status: 'connected',
                        rssi: packet.rssi,
                        name: username || existingPeer?.name || deviceId.substring(0, 6),
                    });
                    if (this.onPeerUpdate) this.onPeerUpdate(storage.getPeers());
                } else if (existingPeer && Math.abs((existingPeer.rssi || -100) - packet.rssi) > 10) {
                    // Update RSSI if significant change
                    await storage.savePeer({
                        ...existingPeer,
                        rssi: packet.rssi,
                        lastSeen: now,
                        name: username || existingPeer.name,
                    });
                    if (this.onPeerUpdate) this.onPeerUpdate(storage.getPeers());
                }
                return;
            }

            // --- Peer List Packet ---
            // Format: "PEERS:ABC123,DEF456"
            if (packet.data.startsWith('PEERS:')) {
                await this.handlePeerListPacket(packet.data);
                return;
            }

            // --- Private Message ---
            // Format: "SENDER6:RECEIVER6:Content"
            if (packet.data.includes(':')) {
                const parts = packet.data.split(':');
                if (parts.length >= 3) {
                    const senderShort = parts[0];
                    const receiverShort = parts[1];
                    const content = parts.slice(2).join(':');

                    if (senderShort.length === 6 && /^[0-9A-F]+$/.test(senderShort)) {
                        const myShortId = security.deviceId.substring(0, 6);

                        // Find full sender ID from known peers
                        const knownPeer = storage.getPeers().find(p => p.id.startsWith(senderShort));
                        const fullSenderId = knownPeer?.id || senderShort.padEnd(12, '0');

                        // Generate stable ID for deduplication (time-bucketed per minute)
                        const timeBucket = Math.floor(Date.now() / 60000);
                        const stableId = `msg_${fullSenderId}_${content}_${timeBucket}`;

                        // Skip if already processed or relayed
                        if (storage.hasMessage(stableId) || this.relayedMessages.has(stableId)) {
                            return;
                        }

                        if (receiverShort === myShortId) {
                            // Message IS for us — process it
                            const msg: MessagePacket = {
                                id: stableId,
                                senderId: fullSenderId,
                                receiverId: security.deviceId,
                                content,
                                timestamp: Date.now(),
                                type: 'text',
                                ttl: RELAY_TTL,
                                hops: 1,
                                signature: '',
                            };
                            await this.processIncomingMessage(msg);
                        } else {
                            // Message NOT for us — relay it
                            console.log('[ROUTER] Relaying message from', senderShort, 'to', receiverShort);
                            this.relayedMessages.add(stableId);

                            // Keep relay set from growing too large
                            if (this.relayedMessages.size > 100) {
                                const first = this.relayedMessages.values().next().value;
                                if (first) this.relayedMessages.delete(first);
                            }

                            await this.ble.broadcast(Buffer.from(packet.data, 'utf8'));
                        }
                    }
                }
            }
        } catch (e) {
            // Not a valid packet — ignore
        }
    }

    /**
     * Handle peer list packet from another device
     * Format: "PEERS:ABC123,DEF456,GHI789"
     */
    private async handlePeerListPacket(data: string) {
        try {
            const peerIds = data.substring(6).split(','); // Remove "PEERS:" prefix
            console.log('[ROUTER] Received peer list:', peerIds);

            for (const shortId of peerIds) {
                if (shortId.length !== 6 || !/^[0-9A-F]+$/.test(shortId)) continue;

                // Skip if it's us
                if (security.deviceId.startsWith(shortId)) continue;

                // Check if we already know this peer directly
                const existingPeer = storage.getPeers().find(p => p.id.startsWith(shortId));
                if (existingPeer && existingPeer.status === 'connected') {
                    continue;
                }

                // Add as indirect peer
                const fullId = existingPeer?.id || shortId.padEnd(12, '0');
                await storage.savePeer({
                    id: fullId,
                    publicKey: 'TODO_PK',
                    lastSeen: Date.now(),
                    status: 'indirect',
                    name: existingPeer?.name || shortId,
                    discoveredVia: 'mesh',
                });
                console.log('[ROUTER] Added indirect peer:', fullId);
            }

            if (this.onPeerUpdate) this.onPeerUpdate(storage.getPeers());
        } catch (e) {
            console.warn('[ROUTER] Failed to process peer list:', e);
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

        console.log('[ROUTER] New Message:', msg.id, 'from:', msg.senderId, 'to:', msg.receiverId);

        // 2. Decrement TTL (if not our own message)
        if (msg.senderId !== security.deviceId) {
            msg.ttl -= 1;
            msg.hops += 1;
        }

        // 3. Save to storage
        await storage.saveMessage(msg);

        // 3.1 Update sender's peer record
        const existingPeer = storage.getPeer(msg.senderId);
        await storage.savePeer({
            id: msg.senderId,
            publicKey: 'TODO_PK',
            lastSeen: Date.now(),
            status: 'connected',
            name: existingPeer?.name || msg.senderId.substring(0, 6),
        });

        // 4. Notify UI
        if (this.onNewMessage) {
            this.onNewMessage(msg);
        } else {
            console.warn('[ROUTER] onNewMessage callback not set!');
        }

        if (this.onPeerUpdate) {
            this.onPeerUpdate(storage.getPeers());
        }

        // 5. Broadcast via BLE (only for messages we sent)
        if (msg.ttl > 0 && msg.senderId === security.deviceId) {
            this.broadcastMessage(msg);
        }
    }

    private async broadcastMessage(msg: MessagePacket) {
        // BLE limit is 31 bytes.
        // Private message format: SENDER(6):RECEIVER(6):CONTENT
        // 6 + 1 + 6 + 1 = 14 bytes overhead → 17 bytes available for content
        try {
            const senderShort = msg.senderId.substring(0, 6);
            const receiverShort = msg.receiverId.substring(0, 6);
            const compactPayload = `${senderShort}:${receiverShort}:${msg.content}`;
            const len = Buffer.byteLength(compactPayload, 'utf8');

            if (len <= 31) {
                console.log('[ROUTER] Broadcasting message:', compactPayload);
                await this.ble.broadcast(Buffer.from(compactPayload, 'utf8'));
            } else {
                console.log('[ROUTER] Message too long for BLE (' + len + ' > 31 bytes). Saved locally only.');
            }
        } catch (e) {
            console.warn('[ROUTER] Broadcast failed:', e);
        }
    }
}

export const router = new MeshRouter();
