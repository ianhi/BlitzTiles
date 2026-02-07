/**
 * User preferences store with localStorage persistence.
 *
 * Manages sound and haptic feedback toggles.
 */

import { create } from 'zustand';
import { playSound } from '../audio/SoundManager';
import { haptics } from '../audio/haptics';
import type { SoundName } from '../audio/SoundManager';

const STORAGE_KEY = 'blitztiles-preferences';

interface Preferences {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

interface PreferencesStore extends Preferences {
  toggleSound: () => void;
  toggleHaptics: () => void;
  /** Play a sound if sound is enabled. */
  sound: (name: SoundName) => void;
  /** Trigger haptic feedback if haptics are enabled. */
  haptic: (type: keyof typeof haptics) => void;
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        soundEnabled: parsed.soundEnabled ?? true,
        hapticsEnabled: parsed.hapticsEnabled ?? true,
      };
    }
  } catch {
    // ignore
  }
  return { soundEnabled: true, hapticsEnabled: true };
}

function savePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export const usePreferences = create<PreferencesStore>((set, get) => {
  const initial = loadPreferences();

  return {
    ...initial,

    toggleSound: () => {
      const next = !get().soundEnabled;
      set({ soundEnabled: next });
      savePreferences({ soundEnabled: next, hapticsEnabled: get().hapticsEnabled });
    },

    toggleHaptics: () => {
      const next = !get().hapticsEnabled;
      set({ hapticsEnabled: next });
      savePreferences({ soundEnabled: get().soundEnabled, hapticsEnabled: next });
    },

    sound: (name) => {
      if (get().soundEnabled) {
        playSound(name);
      }
    },

    haptic: (type) => {
      if (get().hapticsEnabled) {
        haptics[type]();
      }
    },
  };
});
