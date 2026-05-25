
import { BleManager, ScanMode, Device } from 'react-native-ble-plx';
import BLEAdvertiser from 'react-native-ble-advertiser';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

const SERVICE_UUID = '0000FFFF-0000-1000-8000-00805F9B34FB';
const MANUFACTURER_ID = 0xFFFF; // Testing ID
const MAX_DISCOVERED_DEVICES = 500; // Prevent unbounded Set growth

export interface BlePacket {
    rssi: number;
    data: string; // Base64 or Hex
    deviceId: string;
}

export class BleModule {
    private manager: BleManager;
    private isScanning = false;
    private onPacketReceived: (packet: BlePacket) => void;
    private discoveredDevices: Set<string> = new Set(); // Track logged devices

    constructor(onPacketReceived: (packet: BlePacket) => void) {
        this.manager = new BleManager();
        this.onPacketReceived = onPacketReceived;
    }

    async initialize() {
        await this.requestPermissions();
        BLEAdvertiser.setCompanyId(MANUFACTURER_ID);
    }

    async requestPermissions() {
        if (Platform.OS === 'android') {
            const grants = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ]);
            console.log('[BLE] Permissions:', grants);
        }
    }

    startScanning() {
        if (this.isScanning) return;
        this.isScanning = true;

        console.log('[BLE] Starting BLE Scan...');
        this.manager.startDeviceScan(
            null,
            { allowDuplicates: true, scanMode: ScanMode.Balanced },
            (error, device) => {
                if (error) {
                    console.warn('[BLE] Scan Error:', error);
                    return;
                }
                if (device) {
                    this.handleDeviceDiscovered(device);
                }
            }
        );
    }

    stopScanning() {
        this.manager.stopDeviceScan();
        this.isScanning = false;
    }

    private parsePayload(rawString: string): string | null {
        // 1. Check if it's a Peer List packet
        if (rawString.startsWith('PEERS:')) {
            return rawString;
        }
        // 2. Check if it's a Private Message (SENDER6:RECEIVER6:CONTENT)
        if (/^[0-9A-F]{6}:[0-9A-F]{6}:/.test(rawString)) {
            return rawString;
        }
        // 3. Check if it's a Presence Advertisement (DEVICEID or DEVICEID:Username)
        if (/^[0-9A-F]{12}(:.*)?$/.test(rawString)) {
            return rawString;
        }
        return null;
    }

    private handleDeviceDiscovered(device: Device) {
        // Log NEW devices only (throttled); prune Set if it grows too large
        if (!this.discoveredDevices.has(device.id)) {
            if (this.discoveredDevices.size >= MAX_DISCOVERED_DEVICES) {
                // Remove the oldest entry (first element of the Set)
                const oldest = this.discoveredDevices.values().next().value;
                if (oldest) this.discoveredDevices.delete(oldest);
            }
            this.discoveredDevices.add(device.id);
            console.log('[BLE] New device:', device.id, 'RSSI:', device.rssi);
        }

        if (device.manufacturerData) {
            try {
                const b = Buffer.from(device.manufacturerData, 'base64');
                
                // Try decoding with offset 2 (standard prepended Company ID) and offset 0
                let payload: string | null = null;
                if (b.length > 2) {
                    const candidate = b.slice(2).toString('utf8');
                    payload = this.parsePayload(candidate);
                }
                if (!payload) {
                    const candidate = b.toString('utf8');
                    payload = this.parsePayload(candidate);
                }

                if (payload) {
                    console.log('[BLE] Decoded Valid Packet:', payload);
                    this.onPacketReceived({
                        rssi: device.rssi || -100,
                        data: payload,
                        deviceId: device.id,
                    });
                }
            } catch (e) {
                // Ignore malformed packets
            }
        }
    }

    /**
     * Broadcast a packet via BLE Advertising (Manufacturer Data).
     * BLE advertising has a 31-byte limit for manufacturer data.
     */
    async broadcast(data: Uint8Array) {
        try {
            await BLEAdvertiser.broadcast(SERVICE_UUID, Array.from(data), {
                advertiseMode: BLEAdvertiser.ADVERTISE_MODE_LOW_LATENCY,
                txPowerLevel: BLEAdvertiser.ADVERTISE_TX_POWER_HIGH,
                connectable: false,
                includeDeviceName: false,
                includeTxPowerLevel: false,
            });
        } catch (e) {
            console.warn('[BLE] Broadcast failed:', e);
        }
    }

    /**
     * Advertise our device ID and username so others can discover us.
     * Format: DEVICEID:Username (up to 31 bytes total)
     */
    async advertisePresence(deviceId: string, username?: string) {
        try {
            let payload = deviceId; // 12 chars

            if (username && username.length > 0) {
                // 12 + 1 + name ≤ 31 → name max 18 chars
                const trimmedName = username.substring(0, 18);
                payload = `${deviceId}:${trimmedName}`;
            }

            console.log('[BLE] Advertising presence:', payload);
            const data = Buffer.from(payload, 'utf8');
            await this.broadcast(data);
        } catch (e) {
            console.error('[BLE] Failed to advertise presence:', e);
        }
    }

    stopBroadcast() {
        BLEAdvertiser.stopBroadcast();
    }
}
