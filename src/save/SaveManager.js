import { Serializer } from './Serializer.js';

const SAVE_KEY = 'blanca_save';
const SETTINGS_KEY = 'blanca_settings';

export class SaveManager {
    constructor() {
        this.autoSaveEnabled = true;
    }

    save(data) {
        const json = Serializer.serialize(data);
        if (json) {
            try {
                localStorage.setItem(SAVE_KEY, json);
                return true;
            } catch (e) {
                console.error('Save failed:', e);
                return false;
            }
        }
        return false;
    }

    load() {
        try {
            const json = localStorage.getItem(SAVE_KEY);
            if (!json) return null;
            return Serializer.deserialize(json);
        } catch (e) {
            console.error('Load failed:', e);
            return null;
        }
    }

    hasSave() {
        try {
            return localStorage.getItem(SAVE_KEY) !== null;
        } catch {
            return false;
        }
    }

    deleteSave() {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch (e) {
            console.error('Delete save failed:', e);
        }
    }

    saveSettings(settings) {
        const json = Serializer.serialize(settings);
        if (json) {
            try {
                localStorage.setItem(SETTINGS_KEY, json);
            } catch (e) {
                console.error('Save settings failed:', e);
            }
        }
    }

    loadSettings() {
        try {
            const json = localStorage.getItem(SETTINGS_KEY);
            if (!json) return {};
            return Serializer.deserialize(json) || {};
        } catch {
            return {};
        }
    }
}
