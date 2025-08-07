import { useState, useEffect } from 'react';

interface UserPreferences {
  assignee_filter?: number[];
  category_filter?: number[];
  status_filter?: string[];
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  column_visibility?: Record<string, boolean>;
  show_completed?: boolean;
  [key: string]: any; // Allow for future preference types
}

interface UseUserPreferencesReturn {
  preferences: UserPreferences;
  savePreference: (key: string, value: any) => Promise<void>;
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

  useEffect(() => {
    loadPreferences();
  }, [workspaceId]);

  return { preferences, savePreference, loading, error };
};

export default useUserPreferences;
export type { UserPreferences }; 