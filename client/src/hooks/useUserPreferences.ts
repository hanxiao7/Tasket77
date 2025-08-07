import { useState, useEffect, useCallback } from 'react';

interface UserPreferences {
  // View-specific filter preferences
  planner_assignee_filter?: number[];
  planner_category_filter?: number[];
  planner_status_filter?: string[];
  tracker_assignee_filter?: number[];
  tracker_category_filter?: number[];
  tracker_status_filter?: string[];
  
  // Legacy global preferences (for backward compatibility)
  assignee_filter?: number[];
  category_filter?: number[];
  status_filter?: string[];
  
  // Other preferences
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  column_visibility?: Record<string, boolean>;
  show_completed?: boolean;
  [key: string]: any; // Allow for future preference types
}

interface UseUserPreferencesReturn {
  preferences: UserPreferences;
  savePreference: (key: string, value: any) => Promise<void>;
  saveViewPreference: (viewMode: 'planner' | 'tracker', filterType: 'assignee' | 'category' | 'status', value: any) => Promise<void>;
  getViewPreference: (viewMode: 'planner' | 'tracker', filterType: 'assignee' | 'category' | 'status') => any;
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

  const saveViewPreference = async (viewMode: 'planner' | 'tracker', filterType: 'assignee' | 'category' | 'status', value: any) => {
    const key = `${viewMode}_${filterType}_filter`;
    await savePreference(key, value);
  };

  const getViewPreference = useCallback((viewMode: 'planner' | 'tracker', filterType: 'assignee' | 'category' | 'status') => {
    const key = `${viewMode}_${filterType}_filter`;
    return preferences[key];
  }, [preferences]);

  useEffect(() => {
    loadPreferences();
  }, [workspaceId]);

  return { preferences, savePreference, saveViewPreference, getViewPreference, loading, error };
};

export default useUserPreferences;
export type { UserPreferences }; 