import React, { useState, useEffect, useRef } from 'react';
import { Filter, X, Plus } from 'lucide-react';
import { TaskFilters, PresetFilter, FilterGroup, FilterCondition, Category, Tag } from '../types';
import { useAuth } from '../contexts/AuthContext';

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
  const [customGroups, setCustomGroups] = useState<FilterGroup[]>([]);
  const [customLogic, setCustomLogic] = useState<'AND' | 'OR'>('AND');
  const [presetFilters, setPresetFilters] = useState<PresetFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Option sources
  const [workspaceUsers, setWorkspaceUsers] = useState<Array<{ user_id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

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

  // Sync incoming custom filters from parent
  useEffect(() => {
    if (filters.customFilters) {
      setCustomGroups(filters.customFilters);
    } else {
      setCustomGroups([]);
    }
    if (filters.customFiltersLogic) {
      setCustomLogic(filters.customFiltersLogic);
    } else {
      setCustomLogic('AND');
    }
  }, [filters.customFilters, filters.customFiltersLogic]);

  // Load option lists for categorical pickers
  useEffect(() => {
    const loadOptions = async () => {
      if (!workspaceId) return;
      try {
        const [usersRes, catsRes, tagsRes] = await Promise.all([
          fetch(`/api/workspace-users/${workspaceId}`, { credentials: 'include' }),
          fetch(`/api/categories?include_hidden=true&workspace_id=${workspaceId}`, { credentials: 'include' }),
          fetch(`/api/tags?workspace_id=${workspaceId}`, { credentials: 'include' })
        ]);
        if (usersRes.ok) {
          const usersJson = await usersRes.json();
          const simplified = usersJson
            .map((u: any) => ({ user_id: u.user_id, name: u.name || u.user_name || u.email }))
            .filter((u: any) => u.user_id);
          // Sort current user first, then by name
          simplified.sort((a: any, b: any) => {
            if (user?.id && (a.user_id === user.id || b.user_id === user.id)) {
              if (a.user_id === user.id && b.user_id !== user.id) return -1;
              if (b.user_id === user.id && a.user_id !== user.id) return 1;
            }
            return (a.name || '').localeCompare(b.name || '');
          });
          setWorkspaceUsers(simplified);
        }
        if (catsRes.ok) setCategories(await catsRes.json());
        if (tagsRes.ok) setTags(await tagsRes.json());
      } catch (e) {
        console.error('Error loading filter options:', e);
      }
    };
    loadOptions();
  }, [workspaceId, user?.id]);

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
    const presetCount = presetFilters.filter(preset => preset.enabled).length;
    const customCount = customGroups.reduce((acc, g) => acc + (g.conditions?.length || 0), 0);
    return presetCount + (customCount > 0 ? 1 : 0);
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

  // Custom filter handlers
  const addGroup = () => {
    setCustomGroups(prev => [...prev, { id: crypto.randomUUID(), conditions: [], logic: 'AND' }]);
  };

  const removeGroup = (groupId: string) => {
    setCustomGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const addCondition = (groupId: string) => {
    setCustomGroups(prev => prev.map(g => g.id === groupId ? {
      ...g,
      conditions: [...g.conditions, { field: 'status', operator: 'in', values: [] }]
    } : g));
  };

  const updateCondition = (groupId: string, index: number, partial: Partial<FilterCondition>) => {
    setCustomGroups(prev => prev.map(g => g.id === groupId ? {
      ...g,
      conditions: g.conditions.map((c, i) => i === index ? { ...c, ...partial } : c)
    } : g));
  };

  const removeCondition = (groupId: string, index: number) => {
    setCustomGroups(prev => prev.map(g => g.id === groupId ? {
      ...g,
      conditions: g.conditions.filter((_, i) => i !== index)
    } : g));
  };

  const clearCustom = () => {
    setCustomGroups([]);
    setCustomLogic('AND');
    onFiltersChange({ ...filters, customFilters: undefined, customFiltersLogic: undefined });
  };

  const applyCustom = () => {
    onFiltersChange({ ...filters, customFilters: customGroups, customFiltersLogic: customLogic });
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

  // Helpers to render editors
  const categoricalFields = ['assignee', 'category', 'tag', 'status', 'priority'] as const;
  const dateFields = ['due_date', 'completion_date', 'created_date', 'last_modified', 'start_date'] as const;
  const statusOptions = ['todo', 'in_progress', 'paused', 'done'];
  const priorityOptions = ['urgent', 'high', 'normal', 'low'];

  const renderCategoricalEditor = (groupId: string, idx: number, cond: FilterCondition) => {
    let options: Array<{ value: number | string; label: string }> = [];
    if (cond.field === 'assignee') {
      options = workspaceUsers.map(u => ({ value: u.user_id, label: u.name || `User ${u.user_id}` }));
    } else if (cond.field === 'category') {
      options = categories.map(c => ({ value: c.id, label: c.name }));
    } else if (cond.field === 'tag') {
      options = tags.map(t => ({ value: t.id, label: t.name }));
    } else if (cond.field === 'status') {
      options = statusOptions.map(s => ({ value: s, label: s.replace('_', ' ') }));
    } else if (cond.field === 'priority') {
      options = priorityOptions.map(p => ({ value: p, label: p }));
    }

    const allSelected = options.length > 0 && Array.isArray(cond.values) && cond.values.length === options.length;
    const toggleSelectAll = () => {
      updateCondition(groupId, idx, { operator: 'in', values: allSelected ? [] : options.map(o => o.value) });
    };
    const toggleValue = (val: number | string) => {
      const current = Array.isArray(cond.values) ? [...cond.values] : [];
      const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
      updateCondition(groupId, idx, { operator: 'in', values: next });
    };

    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">Select values</span>
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={allSelected} onChange={toggleSelectAll} />
            <span>Select all</span>
          </label>
        </div>
        <div className="max-h-32 overflow-y-auto border rounded">
          {options.map(opt => (
            <label key={String(opt.value)} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-50">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={Array.isArray(cond.values) && cond.values.includes(opt.value)}
                onChange={() => toggleValue(opt.value)}
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
          {/* None at bottom */}
          {['assignee', 'category', 'tag'].includes(cond.field) && (
            <label className="flex items-center gap-2 px-2 py-1 text-sm border-t hover:bg-gray-50">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={!!cond.includeNull}
                onChange={() => updateCondition(groupId, idx, { includeNull: !cond.includeNull })}
              />
              <span className="truncate italic text-gray-600">None</span>
            </label>
          )}
        </div>
      </div>
    );
  };

  const renderDateEditor = (groupId: string, idx: number, cond: FilterCondition) => {
    const mode: 'range' | 'diff' | 'null' = cond.operator === 'between' ? 'range' : (cond.operator === 'date_diff' ? 'diff' : (cond.operator === 'is_null' || cond.operator === 'is_not_null') ? 'null' : 'range');
    const setMode = (m: 'range' | 'diff' | 'null') => {
      if (m === 'range') updateCondition(groupId, idx, { operator: 'between', values: ['', ''] });
      if (m === 'diff') updateCondition(groupId, idx, { operator: 'date_diff', date_field: cond.field as any, date_field_2: 'today', comparator: 'le', days: 0 });
      if (m === 'null') updateCondition(groupId, idx, { operator: 'is_null' });
    };
    const dateFieldSelect = (
      <select value={cond.field} onChange={e => updateCondition(groupId, idx, { field: e.target.value as any })} className="border rounded px-2 py-1">
        {dateFields.map(f => (
          <option key={f} value={f}>{f.replace('_', ' ')}</option>
        ))}
      </select>
    );

    return (
      <div className="w-full space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-600">Mode</span>
          <select value={mode} onChange={e => setMode(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
            <option value="range">Date range</option>
            <option value="diff">Date difference</option>
            <option value="null">Null check</option>
          </select>
        </div>

        {mode === 'range' && (
          <div className="flex items-center gap-2">
            {dateFieldSelect}
            <input type="date" value={(cond.values?.[0] as string) || ''} onChange={e => {
              const next = [...(cond.values || ['', ''])];
              next[0] = e.target.value;
              updateCondition(groupId, idx, { operator: 'between', values: next });
            }} className="border rounded px-2 py-1" />
            <span className="text-sm">to</span>
            <input type="date" value={(cond.values?.[1] as string) || ''} onChange={e => {
              const next = [...(cond.values || ['', ''])];
              next[1] = e.target.value;
              updateCondition(groupId, idx, { operator: 'between', values: next });
            }} className="border rounded px-2 py-1" />
          </div>
        )}

        {mode === 'diff' && (
          <div className="flex items-center gap-2 flex-wrap">
            <select value={cond.date_field || cond.field} onChange={e => updateCondition(groupId, idx, { date_field: e.target.value as any })} className="border rounded px-2 py-1">
              {[...dateFields, 'today'].map(f => (
                <option key={f} value={f}>{String(f).replace('_', ' ')}</option>
              ))}
            </select>
            <span>−</span>
            <select value={cond.date_field_2 || 'today'} onChange={e => updateCondition(groupId, idx, { date_field_2: e.target.value as any })} className="border rounded px-2 py-1">
              {[...dateFields, 'today'].map(f => (
                <option key={f} value={f}>{String(f).replace('_', ' ')}</option>
              ))}
            </select>
            <select value={cond.comparator || 'le'} onChange={e => updateCondition(groupId, idx, { comparator: e.target.value as any })} className="border rounded px-2 py-1">
              <option value="lt">&lt;</option>
              <option value="le">&le;</option>
              <option value="eq">=</option>
              <option value="ge">&ge;</option>
              <option value="gt">&gt;</option>
            </select>
            <input type="number" min={0} value={cond.days ?? 0} onChange={e => updateCondition(groupId, idx, { days: Number(e.target.value) })} className="w-20 border rounded px-2 py-1" />
            <span>days</span>
          </div>
        )}

        {mode === 'null' && (
          <div className="flex items-center gap-2">
            {dateFieldSelect}
            <select value={cond.operator} onChange={e => updateCondition(groupId, idx, { operator: e.target.value as any })} className="border rounded px-2 py-1">
              <option value="is_null">is null</option>
              <option value="is_not_null">is not null</option>
            </select>
          </div>
        )}
      </div>
    );
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
                <div className="flex items-center gap-2">
                  <button onClick={addGroup} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                    <Plus className="w-4 h-4" /> Add group
                  </button>
                  <button onClick={clearCustom} className="text-sm text-gray-600 hover:text-gray-800">Clear</button>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-600">Combine groups with</span>
                <select value={customLogic} onChange={e => setCustomLogic(e.target.value as 'AND' | 'OR')} className="text-sm border rounded px-2 py-1">
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
                <button onClick={applyCustom} className="ml-auto text-sm text-blue-600 hover:text-blue-700">Apply</button>
              </div>
              <div className="space-y-4">
                {customGroups.map(group => (
                  <div key={group.id} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Group logic</span>
                        <select value={group.logic} onChange={e => setCustomGroups(prev => prev.map(g => g.id === group.id ? { ...g, logic: e.target.value as 'AND' | 'OR' } : g))} className="text-sm border rounded px-2 py-1">
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      </div>
                      <button onClick={() => removeGroup(group.id)} className="text-sm text-red-600 hover:text-red-700">Remove group</button>
                    </div>
                    <div className="space-y-2">
                      {group.conditions.map((cond, idx) => (
                        <div key={idx} className="flex flex-col gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <select value={cond.field} onChange={e => updateCondition(group.id, idx, { field: e.target.value as any, values: [], operator: categoricalFields.includes(e.target.value as any) ? 'in' : 'between' })} className="border rounded px-2 py-1">
                              <option value="status">Status</option>
                              <option value="assignee">Assignee</option>
                              <option value="category">Category</option>
                              <option value="tag">Tag</option>
                              <option value="priority">Priority</option>
                              <option value="due_date">Due date</option>
                              <option value="completion_date">Completion date</option>
                              <option value="created_date">Created date</option>
                              <option value="last_modified">Last modified</option>
                              <option value="start_date">Start date</option>
                            </select>
                            <button onClick={() => removeCondition(group.id, idx)} className="ml-auto text-red-600 hover:text-red-700">Remove</button>
                          </div>
                          {categoricalFields.includes(cond.field as any)
                            ? renderCategoricalEditor(group.id, idx, cond)
                            : renderDateEditor(group.id, idx, cond)}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => addCondition(group.id)} className="mt-2 text-sm text-blue-600 hover:text-blue-700">+ Add condition</button>
                  </div>
                ))}
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