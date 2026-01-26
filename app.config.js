const { getDefaultConfig } = require('expo/config');

module.exports = ({ config }) => {
    return {
        ...config,
        name: 'OfflineChatApp',
        slug: 'offline-chat-app',
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'light',
        splash: {
            image: './assets/splash.png',
            resizeMode: 'contain',
            backgroundColor: '#ffffff',
        },
        assetBundlePatterns: ['**/*'],
        ios: {
            supportsTablet: true,
            bundleIdentifier: 'com.offlinechatapp',
            infoPlist: {
                NSBluetoothAlwaysUsageDescription: 'Allow OfflineChatApp to use Bluetooth.',
                NSBluetoothPeripheralUsageDescription: 'Allow OfflineChatApp to use Bluetooth.',
            },
        },
        android: {
            adaptiveIcon: {
                foregroundImage: './assets/adaptive-icon.png',
                backgroundColor: '#ffffff',
            },
            package: 'com.offlinechatapp',
            permissions: [
                "android.permission.INTERNET",
                "android.permission.BLUETOOTH",
                "android.permission.BLUETOOTH_ADMIN",
                "android.permission.BLUETOOTH_SCAN",
                "android.permission.BLUETOOTH_ADVERTISE",
                "android.permission.BLUETOOTH_CONNECT",
                "android.permission.ACCESS_FINE_LOCATION"
            ]
        },
        plugins: [
            [
                "@config-plugins/react-native-ble-plx",
                {
                    "isBackgroundEnabled": true,
                    "modes": ["central", "peripheral"],
                    "bluetoothAlwaysPermission": "Allow $(PRODUCT_NAME) to connect to bluetooth devices",
                }
            ],
            [
                "expo-build-properties",
                {
                    "android": {
                        "minSdkVersion": 24,
                        "compileSdkVersion": 34,
                        "targetSdkVersion": 34,
                        "buildToolsVersion": "34.0.0"
                    }
                }
            ]
        ],
        extra: {
            eas: {
                projectId: "88d5916a-9cf2-4fdf-8c7c-87906757fe33"
            }
        },
        mods: {
            android: {
                manifest: async (config) => {
                    // Ensure modResults (AndroidManifest) is available
                    if (!config.modResults || !config.modResults.manifest) {
                        return config;
                    }
                    const androidManifest = config.modResults;
                    const features = androidManifest.manifest['uses-feature'] || [];
                    const bleFeature = features.find(
                        (f) => f.$['android:name'] === 'android.hardware.bluetooth_le'
                    );
                    if (!bleFeature) {
                        androidManifest.manifest['uses-feature'] = [
                            ...(features),
                            { $: { 'android:name': 'android.hardware.bluetooth_le', 'android:required': 'true' } },
                        ];
                    }
                    return config;
                },
            },
        },
    };
};
