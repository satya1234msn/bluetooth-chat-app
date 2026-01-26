
import { BleManager, ScanMode, Device } from 'react-native-ble-plx';
import BLEAdvertiser from 'react-native-ble-advertiser';
import { PermissionsAndroid, Platform, NativeEventEmitter, NativeModules } from 'react-native';
import { Buffer } from 'buffer';

const SERVICE_UUID = '0000FFFF-0000-1000-8000-00805F9B34FB';
const MANUFACTURER_ID = 0xFFFF; // Testing ID

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

        // Setup Advertiser
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
            console.log('Permissions:', grants);
        }
    }

    startScanning() {
        if (this.isScanning) return;
        this.isScanning = true;

        console.log('[BLE] Starting BLE Scan...');
        this.manager.startDeviceScan(
            null, // Scan all, filter later for resilience
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

    private handleDeviceDiscovered(device: Device) {
        // Log NEW devices (throttled)
        if (!this.discoveredDevices.has(device.id)) {
            this.discoveredDevices.add(device.id);
            console.log('[BLE] New device discovered:', device.id, 'RSSI:', device.rssi);
        }

        if (device.manufacturerData) {
            try {
                const b = Buffer.from(device.manufacturerData, 'base64');
                const rawString = b.toString('utf8');

                // Pattern: 12 Hex Chars, optionally followed by : and Content
                // Ignores any garbage before the ID (e.g. "◆◆◆3B6E...")
                // Captures Group 1: ID, Group 2: :Content
                const match = rawString.match(/([0-9A-F]{12})(:.*)?/);

                if (match) {
                    const cleanId = match[1];
                    const contentPart = match[2]; // Includes the colon, e.g. ":Hello"

                    if (contentPart) {
                        // It's a message! (ID:CONTENT)
                        // Strip the colon
                        const content = contentPart.substring(1);
                        const fullPayload = `${cleanId}:${content}`;
                        console.log('[BLE] Decoded Message:', fullPayload);

                        this.onPacketReceived({
                            rssi: device.rssi || -100,
                            data: fullPayload, // SEND CLEAN DATA: "ID:CONTENT"
                            deviceId: device.id,
                        });
                    } else {
                        // It's just a Presence Advertisement (ID only)
                        // Send clean ID
                        this.onPacketReceived({
                            rssi: device.rssi || -100,
                            data: cleanId,
                            deviceId: device.id,
                        });
                    }
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }
    }

    /**
     * Broadcast a packet via BLE Advertising (Manufacturer Data)
     * Data must be short (< 24 bytes legacy, or more if extended supported)
     */
    async broadcast(data: Uint8Array) {
        try {
            // BLE Advertiser has 31-byte limit for manufacturer data
            // We should only advertise our device ID (12 bytes), not full messages
            console.log('[BLE] Broadcasting device presence...');
            await BLEAdvertiser.broadcast(SERVICE_UUID, Array.from(data), {
                advertiseMode: BLEAdvertiser.ADVERTISE_MODE_LOW_LATENCY,
                txPowerLevel: BLEAdvertiser.ADVERTISE_TX_POWER_HIGH,
                connectable: false, // Broadcast only
                includeDeviceName: false,
                includeTxPowerLevel: false
            });

        } catch (e) {
            console.warn('[BLE] Broadcast failed:', e);
        }
    }

    /**
     * Advertise our device ID so others can discover us
     */
    async advertisePresence(deviceId: string) {
        try {
            // Send just the device ID (12 chars = 12 bytes, well under 31 byte limit)
            const data = Buffer.from(deviceId, 'utf8');
            console.log('[BLE] Starting presence advertisement:', deviceId);
            await this.broadcast(data);
        } catch (e) {
            console.error('[BLE] Failed to advertise presence:', e);
        }
    }

    stopBroadcast() {
        BLEAdvertiser.stopBroadcast();
    }
}
