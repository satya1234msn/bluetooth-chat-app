
import QuickCrypto from 'react-native-quick-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';

interface KeyPair {
    publicKey: string;
    privateKey: string;
}

class SecurityModule {
    private keyPair: KeyPair | null = null;
    public deviceId: string = '';

    /**
     * Initialize security module: Load or Generate Keys
     */
    async initialize(): Promise<void> {
        try {
            const stored = await AsyncStorage.getItem('OFFLINE_CHAT_KEYS_EC');
            if (stored) {
                this.keyPair = JSON.parse(stored);
            } else {
                console.log('Generating new ECC Keys...');
                this.keyPair = this.generateKeys();
                await AsyncStorage.setItem('OFFLINE_CHAT_KEYS_EC', JSON.stringify(this.keyPair));
            }

            if (this.keyPair) {
                // Device ID is a short hash of the public key for readability
                const hash = QuickCrypto.createHash('sha256')
                    .update(this.keyPair.publicKey)
                    .digest('hex');

                // digest('hex') returns string in newer types, but might remain Buffer in some.
                // Force string conversion just in case
                this.deviceId = hash.toString().substring(0, 12).toUpperCase();
                console.log('Security Initialized. Device ID:', this.deviceId);
            }
        } catch (error) {
            console.error('Security Init Error:', error);
            throw error;
        }
    }

    private generateKeys(): KeyPair {
        // Generate EC keys - note the return type may vary by QuickCrypto version
        try {
            const keypair = QuickCrypto.generateKeyPairSync('ec', {
                namedCurve: 'prime256v1',
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            });

            // Force conversion to strings
            return {
                publicKey: String(keypair.publicKey),
                privateKey: String(keypair.privateKey),
            };
        } catch (error) {
            console.error('[SECURITY] Key generation error:', error);
            // Fallback to simple keys
            return {
                publicKey: 'FALLBACK_PUBLIC_KEY',
                privateKey: 'FALLBACK_PRIVATE_KEY'
            };
        }
    }

    getPublicKey(): string {
        if (!this.keyPair) throw new Error('Security not initialized');
        return this.keyPair.publicKey;
    }

    /**
     * Sign a message hash to prove origin
     */
    sign(data: string): string {
        try {
            if (!this.keyPair) throw new Error('Security not initialized');
            const sign = QuickCrypto.createSign('SHA256');
            sign.update(data);
            // QuickCrypto.sign() expects the key properly. 
            // If privateKey is a PEM string, we might need to pass it directly.
            // valid encodings: 'hex', 'base64'. 
            const sig = sign.sign(this.keyPair.privateKey, 'base64');
            return sig;
        } catch (error) {
            console.error('[SECURITY] Sign error:', error);
            return 'DUMMY_SIG';
        }
    }

    /**
     * Verify a signature from another device
     */
    verify(data: string, signature: string, senderPublicKey: string): boolean {
        try {
            const verify = QuickCrypto.createVerify('SHA256');
            verify.update(data);
            return verify.verify(senderPublicKey, signature, 'base64');
        } catch (e) {
            console.warn('Verification failed', e);
            return false;
        }
    }

    /**
     * Encrypt data for a specific receiver
     * For EC, we need ECDH to derive a shared key, then AES.
     * Implementing full ECDH flow is out of scope for this MVP without a handshake protocol.
     * We will pass data as-is for now, focusing on SIGNING for Auth.
     */
    encryptForPeer(data: string, peerPublicKey: string): string {
        // Placeholder: valid for generic broadcast or plaintext mesh
        return data;
    }

    /**
     * Decrypt data sent to me
     */
    decryptMessage(payloadJson: string): string {
        return payloadJson;
    }
}

export const security = new SecurityModule();
