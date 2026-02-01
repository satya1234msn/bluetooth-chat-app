# Offline Bluetooth Chat App

An offline messaging application built with React Native (Expo) that allows users to communicate without an internet connection. It utilizes Bluetooth Low Energy (BLE) to create a mesh-like network where messages can hop between devices to reach their destination.

## 🚀 Features

-   **Offline Communication**: No internet (Wi-Fi/4G) required. Works entirely over Bluetooth.
-   **Mesh Networking**: Messages are relayed between devices using a "Store and Forward" flooding mechanism.
-   **Secure Identity**: Devices are identified by a unique ID generated from a locally created Elliptic Curve (EC) Key Pair.
-   **Cross-Platform**: Designed to work on Android (and iOS with appropriate permissions).
-   **Privacy Focused**: Keys are generated locally; no central server involved.

---

## 🛠 Modules

The application is structured into several core modules that handle specific responsibilities:

### 1. `BleModule.ts` (Bluetooth Layer)
This is the low-level driver for Bluetooth operations.
-   **Scanning**: Continuously scans for other devices advertising the specific Service UUID.
-   **Advertising**: Broadcasts the device's presence and short messages using BLE Manufacturer Data.
-   **Packet Handling**: Decodes incoming raw BLE packets into usable message objects.
-   **Tech**: Uses `react-native-ble-plx` for scanning and `react-native-ble-advertiser` for broadcasting (due to Android limitations on advertising).

### 2. `MeshRouter.ts` (Network Layer)
Handles the logic for routing messages through the network.
-   **Store and Forward**: Receives messages, stores them, and re-broadcasts them to neighbors.
-   **TTL (Time-To-Live)**: Each message has a TTL counter (default: 3 hops) that decrements on every hop to prevent infinite loops.
-   **Deduplication**: Tracks unique Message IDs to ensure the same message isn't processed or displayed multiple times.

### 3. `SecurityModule.ts` (Security Layer)
Manages encryption and identity.
-   **Key Generation**: Generates an Elliptic Curve (EC) Public/Private key pair on first launch using `react-native-quick-crypto`.
-   **Device ID**: Your unique Chat ID is the first 12 characters of the SHA-256 hash of your Public Key.
-   **Signing**: Digitally signs outgoing messages to prove authenticity.

### 4. `StorageService.ts` / `useChatStore.ts` (Data Layer)
-   **Persistence**: Saves chat history and known peers using `AsyncStorage`.
-   **State Management**: Uses `Zustand` for reactive UI state updates.

---

## 📦 Installation & Setup

### Prerequisites
-   Node.js (>= 18)
-   Android Studio (for Android Simulator or physical device build)

### Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/satya1234msn/bluetooth-chat-app.git
    cd bluetooth-chat-app
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```
    *Note: A `postinstall` script will automatically run `patch-package` to apply necessary fixes to node_modules.*

3.  **Build Pre-requisites**
    Generate native directories (since this uses native BLE modules):
    ```bash
    npx expo prebuild
    ```

### Running the App

**For Android:**
1.  Connect your Android device via USB or start an Emulator.
2.  Run:
    ```bash
    npm run android
    ```

**For iOS:**
(Requires macOS and Xcode)
```bash
npm run ios
```

---

## 📱 How It Works

1.  **Discovery**: When you open the app, it asks for Bluetooth and Location permissions. Once granted, it starts advertising your "Presence" (Device ID) to nearby devices.
2.  **Messaging**:
    *   When you send a message, it is wrapped in variables (ID, Timestamp, Signature).
    *   The `BleModule` broadcasts this packet to the immediate vicinity.
3.  **Relaying (Mesh)**:
    *   A nearby device receives the packet.
    *   The `MeshRouter` checks if it has seen this Message ID before.
    *   If valid and new, it saves the message and **re-broadcasts** it to *its* neighbors (decrementing the TTL).
4.  **Display**: The UI listens to the store and updates when new messages arrive.

## ⚠️ Limitations
-   **Range**: Limited by Bluetooth hardware (~10-50m).
-   **Bandwidth**: extremely low. Images are heavily compressed or not supported in the current broadcast mode.
-   **Packet Size**: BLE legacy advertising is limited to 31 bytes. Longer messages may need to be fragmented (currently implemented as short message support).

## 📄 License
MIT
