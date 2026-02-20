/**
 * Credential storage utility.
 *
 * Sensitive fields (e.g. WebDAV password) are stored via Obsidian's
 * SecretStorage API (available since v1.11.4).  This is cross-platform
 * safe and avoids exposing secrets in data.json, which may be synced
 * via iCloud, Git, or other sync services.
 */

import type { SecretStorage } from "obsidian";

const CREDENTIAL_KEYS = ["webdavpassword", "zoteroapikey"] as const;

type CredentialKey = (typeof CREDENTIAL_KEYS)[number];

/** Minimal shape: settings object must have the credential keys as optional strings. */
type HasCredentials = { [K in CredentialKey]?: string };

/**
 * Persist sensitive credentials to SecretStorage.
 */
export function saveCredentials<T extends HasCredentials>(
    settings: T,
    storage: SecretStorage,
): void {
    for (const key of CREDENTIAL_KEYS) {
        const value = settings[key];
        if (typeof value === "string" && value.length > 0) {
            storage.setSecret(key, value);
        } else {
            // Remove stale secret if field was cleared
            storage.setSecret(key, "");
        }
    }
}

/**
 * Merge sensitive credentials from SecretStorage back into settings.
 *
 * Also handles one-time migration: if the value already exists in
 * settings (loaded from data.json) but not yet in SecretStorage,
 * it is copied to SecretStorage so that the next `stripCredentials`
 * call removes it from data.json.
 */
export function loadCredentials<T extends HasCredentials>(
    settings: T,
    storage: SecretStorage,
): void {
    for (const key of CREDENTIAL_KEYS) {
        const storedValue = storage.getSecret(key);

        if (settings[key] && typeof settings[key] === "string") {
            // Migrate: value in data.json but not yet in SecretStorage
            if (!storedValue) {
                storage.setSecret(key, settings[key]);
            }
        } else if (storedValue) {
            // Normal path: restore from SecretStorage
            settings[key] = storedValue;
        }
    }
}

/**
 * Return a shallow copy of settings with all credential fields removed.
 * Use this before persisting to data.json.
 */
export function stripCredentials<T extends HasCredentials>(settings: T): T {
    const copy = { ...settings };
    for (const key of CREDENTIAL_KEYS) {
        delete copy[key];
    }
    return copy;
}

/**
 * Remove all stored credentials from SecretStorage.
 */
export function clearCredentials(storage: SecretStorage): void {
    for (const key of CREDENTIAL_KEYS) {
        storage.setSecret(key, "");
    }
}
