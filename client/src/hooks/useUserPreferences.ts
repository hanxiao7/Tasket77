import { useState, useEffect, useCallback } from 'react';
import { PresetFilter } from '../types';

interface UserPreferences {
  // Preset filters (stored as individual preference keys)
  // Each preset is stored as: { key: preset_name, value: PresetFilter }
  
  // Other preferences
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  column_visibility?: Record<string, boolean>;
  [key: string]: any; // Allow for future preference types
}

interface UseUserPreferencesReturn {
  preferences: UserPreferences;
  savePreference: (key: string, value: any) => Promise<void>;
  getPresetFilters: (viewMode: 'planner' | 'tracker') => PresetFilter[];
  updatePresetFilter: (presetKey: string, enabled: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const useUserPreferences = (workspaceId: number): UseUserPreferencesReturn => {
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPreferences = async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/user-preferences/${workspaceId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const prefs = await response.json();
        setPreferences(prefs);
      } else {
        console.error('Failed to load preferences:', response.status);
        setError('Failed to load preferences');
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      setError('Error loading preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreference = async (key: string, value: any) => {
    if (!workspaceId) return;

    try {
      setError(null);
      const response = await fetch(`/api/user-preferences/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value })
      });
      
      if (response.ok) {
        setPreferences(prev => ({ ...prev, [key]: value }));
      } else {
        console.error('Failed to save preference:', response.status);
        setError('Failed to save preference');
      }
    } catch (error) {
      console.error('Error saving preference:', error);
      setError('Error saving preference');
    }
  };

  const getPresetFilters = useCallback((viewMode: 'planner' | 'tracker'): PresetFilter[] => {
    const presetKeys = [
      'hide_completed', 'assigned_to_me', 'due_in_7_days', 'overdue_tasks', 'high_urgent_priority',
      'active_past_7_days', 'unchanged_past_14_days', 'lasted_more_than_1_day'
    ];
    
    return presetKeys
      .filter(key => {
        const preset = preferences[key];
        return preset && preset.view === viewMode;
      })
      .map(key => {
        const preset = preferences[key];
        return {
          key,
          enabled: preset.enabled,
          type: preset.type,
          view: preset.view,
          logic: preset.logic,
          days: preset.days
        };
      });
  }, [preferences]);

  const updatePresetFilter = async (presetKey: string, enabled: boolean, days?: number) => {
    const currentPreset = preferences[presetKey];
    if (currentPreset) {
      await savePreference(presetKey, {
        ...currentPreset,
        enabled,
        ...(days !== undefined && { days })
      });
    }
  };

  useEffect(() => {
    loadPreferences();
  }, [workspaceId]);

  return { preferences, savePreference, getPresetFilters, updatePresetFilter, loading, error };
};

export default useUserPreferences;
export type { UserPreferences }; 