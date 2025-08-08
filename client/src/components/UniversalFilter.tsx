import React, { useState, useEffect, useRef } from 'react';
import { Filter, X, Plus } from 'lucide-react';
import { TaskFilters, PresetFilter } from '../types';

interface UniversalFilterProps {
  workspaceId: number;
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  viewMode: 'planner' | 'tracker';
  className?: string;
}

const UniversalFilter: React.FC<UniversalFilterProps> = ({ 
  workspaceId, 
  filters, 
  onFiltersChange, 
  viewMode,
  className = '' 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [presetFilters, setPresetFilters] = useState<PresetFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load preset filters
  useEffect(() => {
    const loadPresetFilters = async () => {
      if (!workspaceId) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/user-preferences/${workspaceId}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const preferences = await response.json();
          const viewPresets = Object.entries(preferences)
            .filter(([key, value]: [string, any]) => {
              return value && value.view === viewMode && value.type === 'system';
            })
            .map(([key, value]: [string, any]) => ({
              key,
              enabled: value.enabled,
              type: value.type,
              view: value.view,
              logic: value.logic
            }));
          
          setPresetFilters(viewPresets);
        }
      } catch (error) {
        console.error('Error loading preset filters:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPresetFilters();
  }, [workspaceId, viewMode]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsModalOpen(false);
      }
    };

    if (isModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModalOpen]);

  const handlePresetToggle = async (presetKey: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/user-preferences/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          key: presetKey, 
          value: { 
            ...presetFilters.find(p => p.key === presetKey),
            enabled 
          }
        })
      });

      if (response.ok) {
        // Update local state
        setPresetFilters(prev => 
          prev.map(preset => 
            preset.key === presetKey 
              ? { ...preset, enabled } 
              : preset
          )
        );

        // Update filters
        const enabledPresets = presetFilters
          .map(preset => preset.key === presetKey ? { ...preset, enabled } : preset)
          .filter(preset => preset.enabled)
          .map(preset => preset.key);

        onFiltersChange({
          ...filters,
          presets: enabledPresets
        });
      }
    } catch (error) {
      console.error('Error updating preset filter:', error);
    }
  };

  const getActiveFiltersCount = () => {
    return presetFilters.filter(preset => preset.enabled).length;
  };

  const getPresetLabel = (key: string): string => {
    const labels: Record<string, string> = {
      'hide_completed': 'Hide completed (default)',
      'assigned_to_me': 'Assigned to me',
      'due_in_7_days': 'Due in 7 days',
      'overdue_tasks': 'Overdue tasks',
      'high_urgent_priority': 'High/Urgent priority',
      'active_past_7_days': 'Active in past 7 days (default)',
      'assigned_to_me_tracker': 'Assigned to me',
      'unchanged_past_14_days': 'Unchanged in past 14 days',
      'lasted_more_than_1_day': 'Lasted for more than 1 day'
    };
    return labels[key] || key;
  };

  // Sort presets: default first, then assigned to me, then others alphabetically
  const getSortedPresets = (presets: PresetFilter[]): PresetFilter[] => {
    return presets.sort((a, b) => {
      const aLabel = getPresetLabel(a.key);
      const bLabel = getPresetLabel(b.key);
      
      // Default presets first
      const aIsDefault = aLabel.includes('(default)');
      const bIsDefault = bLabel.includes('(default)');
      if (aIsDefault && !bIsDefault) return -1;
      if (!aIsDefault && bIsDefault) return 1;
      
      // Assigned to me second
      const aIsAssignedToMe = aLabel.includes('Assigned to me');
      const bIsAssignedToMe = bLabel.includes('Assigned to me');
      if (aIsAssignedToMe && !bIsAssignedToMe) return -1;
      if (!aIsAssignedToMe && bIsAssignedToMe) return 1;
      
      // Then alphabetically
      return aLabel.localeCompare(bLabel);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors ${className}`}
        title="Filter tasks"
      >
        <div className="relative">
          <Filter className="w-4 h-4" />
          {getActiveFiltersCount() > 0 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
              {getActiveFiltersCount()}
            </div>
          )}
        </div>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            ref={modalRef}
            className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Filter Tasks</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Content */}
            <div className="p-4 space-y-6">
              {loading ? (
                <div className="text-center py-4 text-gray-500">Loading filters...</div>
              ) : (
                <>
                  {/* Preset Filters */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Preset Filters</h4>
                    <div className="space-y-2">
                      {getSortedPresets(presetFilters).map((preset) => (
                        <label
                          key={preset.key}
                          className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={preset.enabled}
                            onChange={(e) => handlePresetToggle(preset.key, e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="truncate">{getPresetLabel(preset.key)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Custom Filters (placeholder for future) */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Custom Filters</h4>
                      <button
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                        disabled
                        title="Coming soon"
                      >
                        <Plus className="w-4 h-4" />
                        Add filter
                      </button>
                    </div>
                    <div className="text-sm text-gray-500 italic">
                      Custom filters coming soon...
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end p-4 border-t border-gray-200">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UniversalFilter; 