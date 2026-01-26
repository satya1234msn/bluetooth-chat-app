
export interface MessagePacket {
    id: string;          // Unique UUID
    senderId: string;    // Public Key Hash
    receiverId: string;  // Target Device ID or 'ALL'
    content: string;     // Encrypted Payload (JSON string of {iv, k, d} or just string)
    timestamp: number;
    type: 'text' | 'image' | 'ack' | 'handshake';
    ttl: number;         // Time to Live (hops remaining)
    hops: number;        // Hops taken so far
    signature: string;   // Sender's signature of the content
}

export interface Peer {
    id: string;
    publicKey: string;
    lastSeen: number;
    status: 'connected' | 'disconnected';
    rssi?: number;
    name?: string;       // User's display name
    avatar?: string;     // Base64 image
    bio?: string;        // Short bio
}
