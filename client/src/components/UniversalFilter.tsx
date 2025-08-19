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
  // NOTE: This component now works in session-only mode:
  // - Preset filter states (enabled/disabled) are loaded from database defaults on page load
  // - All filter changes during the session are kept in local state only
  // - Changes are lost on page refresh and reset to database defaults
  // - Custom filters are always session-only and never saved
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customGroups, setCustomGroups] = useState<FilterGroup[]>([]);
  const [customLogic, setCustomLogic] = useState<'AND' | 'OR'>('AND');
  const [presetFilters, setPresetFilters] = useState<PresetFilter[]>([]);
  const [customDays, setCustomDays] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Option sources
  const [workspaceUsers, setWorkspaceUsers] = useState<Array<{ user_id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // Single-field custom filter state
  type SingleMode = 'none' | 'assignee' | 'category' | 'tag' | 'status' | 'priority' | 'date_range' | 'date_diff' | 'null_is' | 'null_is_not';
  const [singleMode, setSingleMode] = useState<SingleMode>('none');
  const [singleValues, setSingleValues] = useState<any[]>([]);
  const [singleIncludeNull, setSingleIncludeNull] = useState<boolean>(false);
  const [rangeField, setRangeField] = useState<'due_date' | 'completion_date' | 'created_date' | 'last_modified' | 'start_date'>('due_date');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [nullField, setNullField] = useState<'assignee' | 'status' | 'category' | 'tag' | 'priority' | 'due_date' | 'created_date' | 'completion_date' | 'last_modified' | 'start_date'>('due_date');
  const [nullOperator, setNullOperator] = useState<'is_null' | 'is_not_null'>('is_null');
  const [diffFrom, setDiffFrom] = useState<'due_date' | 'completion_date' | 'created_date' | 'last_modified' | 'start_date' | 'today'>('created_date');
  const [diffTo, setDiffTo] = useState<'due_date' | 'completion_date' | 'created_date' | 'last_modified' | 'start_date' | 'today'>('today');
  const [diffCmp, setDiffCmp] = useState<'lt' | 'le' | 'eq' | 'ge' | 'gt'>('le');
  const [diffDays, setDiffDays] = useState<number>(0);

  // Load preset filters from database (defaults only - changes are session-only)
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
          
          // Set initial state from database defaults
          setPresetFilters(viewPresets);
          
          // Initialize customDays with default values from backend
          // Note: days values are loaded from database but changes are session-only
          const daysValues: Record<string, number> = {};
          Object.entries(preferences).forEach(([key, value]: [string, any]) => {
            if (value && value.days && isDatePreset(key)) {
              daysValues[key] = value.days;
            }
          });
          setCustomDays(daysValues);
          
          // Note: We don't call onFiltersChange here to avoid circular updates
          // The parent component should handle initializing the filters with default presets
        }
      } catch (error) {
        console.error('Error loading preset filters:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPresetFilters();
  }, [workspaceId, viewMode]);

  // Note: We don't use useEffect to avoid infinite loops
  // Filters are updated only when user makes explicit changes

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

  // Initialize single-mode UI from existing customFilters when possible
  useEffect(() => {
    const group = filters.customFilters?.[0];
    const cond = group?.conditions?.[0];
    if (!cond) {
      setSingleMode('none');
      setSingleValues([]);
      setSingleIncludeNull(false);
      setRangeField('due_date');
      setRangeStart('');
      setRangeEnd('');
      setNullField('due_date');
      setNullOperator('is_null');
      setDiffFrom('created_date');
      setDiffTo('today');
      setDiffCmp('le');
      setDiffDays(0);
      return;
    }
    // Prefer operator-first interpretation so null/date-diff/range take precedence over field type
    if (cond.operator === 'is_null' || cond.operator === 'is_not_null') {
      setSingleMode(cond.operator === 'is_null' ? 'null_is' : 'null_is_not');
      setNullField(cond.field as any);
      setNullOperator(cond.operator);
    } else if (cond.operator === 'between') {
      setSingleMode('date_range');
      setRangeField(cond.field as any);
      setRangeStart((cond.values?.[0] as string) || '');
      setRangeEnd((cond.values?.[1] as string) || '');
    } else if (cond.operator === 'date_diff') {
      setSingleMode('date_diff');
      setDiffFrom((cond.date_field as any) || 'created_date');
      setDiffTo((cond.date_field_2 as any) || 'today');
      setDiffCmp((cond.comparator as any) || 'le');
      setDiffDays(cond.days || 0);
    } else {
      if (['assignee', 'category', 'tag', 'status', 'priority'].includes(cond.field)) {
        setSingleMode(cond.field as SingleMode);
        setSingleValues(Array.isArray(cond.values) ? cond.values : []);
        setSingleIncludeNull(!!cond.includeNull);
      } else {
        setSingleMode('none');
      }
    }
  }, [filters.customFilters]);

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

  const handlePresetToggle = (presetKey: string, enabled: boolean) => {
    // Update local state first
    setPresetFilters(prev => {
      const newPresets = prev.map(preset => 
        preset.key === presetKey 
          ? { ...preset, enabled } 
          : preset
      );
      
      // Update parent filters after state update
      const updatedPresets = newPresets
        .filter(preset => preset.enabled)
        .map(preset => preset.key);
      
      const newFilters = {
        ...filters,
        presets: updatedPresets,
        currentDays: customDays
      };
      
      console.log('UniversalFilter: Toggle preset, updating filters with:', newFilters);
      onFiltersChange(newFilters);
      
      return newPresets;
    });
  };

  const handleDaysChange = (presetKey: string, days: number) => {
    console.log(`UniversalFilter: Changing days for ${presetKey} to ${days}`);
    
    // Update local state only (session-only)
    setCustomDays(prev => ({ ...prev, [presetKey]: days }));
    
    // Trigger filter update to use the new days value
    const currentPreset = presetFilters.find(p => p.key === presetKey);
    if (currentPreset && currentPreset.enabled) {
      const newFilters = {
        ...filters,
        currentDays: { ...customDays, [presetKey]: days }
      };
      console.log('UniversalFilter: Triggering filter update with:', newFilters);
      onFiltersChange(newFilters);
    }
  };

  const getDefaultDays = (presetKey: string): number => {
    const defaults: Record<string, number> = {
      'due_in_7_days': 7,
      'active_past_7_days': 7,
      'unchanged_past_14_days': 14,
      'lasted_more_than_1_day': 1
    };
    return defaults[presetKey] || 7;
  };

  const isDatePreset = (presetKey: string): boolean => {
    return ['due_in_7_days', 'active_past_7_days', 'unchanged_past_14_days', 'lasted_more_than_1_day'].includes(presetKey);
  };

  const getActiveFiltersCount = () => {
    const presetCount = presetFilters.filter(preset => preset.enabled).length;
    const customCount = customGroups.reduce((acc, g) => acc + (g.conditions?.length || 0), 0);
    return presetCount + (customCount > 0 ? 1 : 0);
  };

  const getPresetLabel = (key: string): string => {
    const labels: Record<string, string> = {
      'hide_completed': 'Hide completed',
      'assigned_to_me': 'Assigned to me',
      'due_in_7_days': 'Due in',
      'overdue_tasks': 'Overdue tasks',
      'high_urgent_priority': 'High/Urgent priority',
      'active_past_7_days': 'Active in past',
      'assigned_to_me_tracker': 'Assigned to me',
      'unchanged_past_14_days': 'Unchanged in past',
      'lasted_more_than_1_day': 'Lasted for at least'
    };
    return labels[key] || key;
  };

  // Custom filter handlers (session-only - not saved to database)
  const clearCustom = () => {
    setSingleMode('none');
    setSingleValues([]);
    setSingleIncludeNull(false);
    setRangeField('due_date');
    setRangeStart('');
    setRangeEnd('');
    setNullField('due_date');
    setNullOperator('is_null');
    setDiffFrom('created_date');
    setDiffTo('today');
    setDiffCmp('le');
    setDiffDays(0);
    onFiltersChange({ ...filters, customFilters: undefined, customFiltersLogic: undefined });
  };

  const applyCustom = () => {
    // Custom filters are session-only and not saved to database
    let condition: FilterCondition | null = null;
    if (['assignee', 'category', 'tag', 'status', 'priority'].includes(singleMode)) {
      condition = {
        field: singleMode as any,
        operator: 'in',
        values: singleValues,
        includeNull: ['assignee', 'category', 'tag'].includes(singleMode) ? singleIncludeNull : undefined,
      } as FilterCondition;
    } else if (singleMode === 'date_range') {
      if (rangeStart && rangeEnd) {
        condition = {
          field: rangeField,
          operator: 'between',
          values: [rangeStart, rangeEnd],
        } as FilterCondition;
      }
    } else if (singleMode === 'null_is' || singleMode === 'null_is_not') {
      condition = {
        field: nullField as any,
        operator: singleMode === 'null_is' ? 'is_null' : 'is_not_null',
        values: [],
      } as FilterCondition;
    } else if (singleMode === 'date_diff') {
      condition = {
        field: 'created_date',
        operator: 'date_diff',
        values: [],
        date_field: diffFrom,
        date_field_2: diffTo,
        comparator: diffCmp,
        days: diffDays,
      } as FilterCondition;
    }

    if (condition) {
      const group: FilterGroup = { id: 'single', logic: 'AND', conditions: [condition] };
      onFiltersChange({ ...filters, customFilters: [group], customFiltersLogic: 'AND' });
    } else {
      onFiltersChange({ ...filters, customFilters: undefined, customFiltersLogic: undefined });
    }
  };

  // Sort presets: default first, then assigned to me, then others alphabetically
  const getSortedPresets = (presets: PresetFilter[]): PresetFilter[] => {
    return presets.sort((a, b) => {
      const aLabel = getPresetLabel(a.key);
      const bLabel = getPresetLabel(b.key);
      
      // Default presets first (based on view mode)
      const aIsDefault = aLabel.includes('(default)');
      const bIsDefault = bLabel.includes('(default)');
      if (aIsDefault && !bIsDefault) return -1;
      if (!aIsDefault && bIsDefault) return 1;
      
      // View-specific default filters (Active in past for tracker, Hide completed for planner)
      if (viewMode === 'tracker' && a.key === 'active_past_7_days' && b.key !== 'active_past_7_days') return -1;
      if (viewMode === 'tracker' && b.key === 'active_past_7_days' && a.key !== 'active_past_7_days') return 1;
      if (viewMode === 'planner' && a.key === 'hide_completed' && b.key !== 'hide_completed') return -1;
      if (viewMode === 'planner' && b.key === 'hide_completed' && a.key !== 'hide_completed') return 1;
      
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

  const renderCategoricalSingle = () => {
    let options: Array<{ value: number | string; label: string }> = [];
    if (singleMode === 'assignee') {
      options = workspaceUsers.map(u => ({ value: u.user_id, label: u.name || `User ${u.user_id}` }));
    } else if (singleMode === 'category') {
      options = categories.map(c => ({ value: c.id, label: c.name }));
    } else if (singleMode === 'tag') {
      options = tags.map(t => ({ value: t.id, label: t.name }));
    } else if (singleMode === 'status') {
      options = statusOptions.map(s => ({ value: s, label: s.replace('_', ' ') }));
    } else if (singleMode === 'priority') {
      options = priorityOptions.map(p => ({ value: p, label: p }));
    }

    const supportsNull = ['assignee', 'category', 'tag'].includes(singleMode);
    const allSelected = options.length > 0 && Array.isArray(singleValues) && singleValues.length === options.length && (!supportsNull || singleIncludeNull);
    const toggleSelectAll = () => {
      if (allSelected) {
        setSingleValues([]);
        if (supportsNull) setSingleIncludeNull(false);
      } else {
        setSingleValues(options.map(o => o.value));
        if (supportsNull) setSingleIncludeNull(true);
      }
    };
    const toggleValue = (val: number | string) => {
      const current = Array.isArray(singleValues) ? [...singleValues] : [];
      const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
      setSingleValues(next);
    };

    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          {/* <span className="text-xs text-gray-600">Select values</span> */}
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
                checked={Array.isArray(singleValues) && singleValues.includes(opt.value)}
                onChange={() => toggleValue(opt.value)}
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
          {/* None at bottom */}
          {['assignee', 'category', 'tag'].includes(singleMode) && (
            <label className="flex items-center gap-2 px-2 py-1 text-sm border-t hover:bg-gray-50">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={!!singleIncludeNull}
                onChange={() => setSingleIncludeNull(!singleIncludeNull)}
              />
              <span className="truncate italic text-gray-600">None</span>
            </label>
          )}
        </div>
      </div>
    );
  };

  const renderDateRangeSingle = () => (
    <div className="w-full mt-2">
      <div className="flex items-center gap-2">
        <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="text-sm border rounded px-2 py-1" />
        <span className="text-sm">to</span>
        <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="text-sm border rounded px-2 py-1" />
      </div>
    </div>
  );

  const renderNullCheckSingle = () => (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <div className="w-1/2">
          <select value={singleMode} onChange={e => setSingleMode(e.target.value as any)} className="w-full text-sm border rounded px-2 py-1">
            <option value="null_is">Is null</option>
            <option value="null_is_not">Is not null</option>
          </select>
        </div>
        <div className="w-1/2">
          <select value={nullField} onChange={e => setNullField(e.target.value as any)} className="w-full text-sm border rounded px-2 py-1">
            {[...categoricalFields, ...dateFields].map(f => (
              <option key={f as any} value={f as any}>{String(f).replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderDateDiffSingle = () => (
    <div className="w-full mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm">From</span>
        <select value={diffFrom} onChange={e => setDiffFrom(e.target.value as any)} className="text-sm border rounded px-1 py-1 w-30">
          {[...dateFields, 'today'].map(f => (
            <option key={f as any} value={f as any}>{String(f).replace('_', ' ')}</option>
          ))}
        </select>
        <span className="text-sm">to</span>
        <select value={diffTo} onChange={e => setDiffTo(e.target.value as any)} className="text-sm border rounded px-1 py-1 w-30">
          {[...dateFields, 'today'].map(f => (
            <option key={f as any} value={f as any}>{String(f).replace('_', ' ')}</option>
          ))}
        </select>
        <select value={diffCmp} onChange={e => setDiffCmp(e.target.value as any)} className="text-sm border rounded px-1 py-1">
          <option value="lt">&lt;</option>
          <option value="le">&le;</option>
          <option value="eq">=</option>
          <option value="ge">&ge;</option>
          <option value="gt">&gt;</option>
        </select>
        <input type="number" min={0} value={diffDays} onChange={e => setDiffDays(Number(e.target.value))} className="w-12 text-sm border rounded px-1 py-1" />
        <span className="text-sm">days</span>
      </div>
    </div>
  );

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
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
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
                        <div
                          key={preset.key}
                          className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={preset.enabled}
                            onChange={(e) => handlePresetToggle(preset.key, e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          {isDatePreset(preset.key) ? (
                            <div className="flex items-center gap-1 flex-1">
                              <span className="truncate">
                                {getPresetLabel(preset.key).replace(/\[\d+\]/, '')}
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={customDays[preset.key] || getDefaultDays(preset.key)}
                                onChange={(e) => handleDaysChange(preset.key, Number(e.target.value))}
                                className="w-12 text-sm border rounded px-1 py-0.5 text-center"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm text-gray-900">
                                {preset.key === 'lasted_more_than_1_day' ? 'days' : 'days'}
                              </span>
                              {/* Show default note for tracker view default filter */}
                              {viewMode === 'tracker' && preset.key === 'active_past_7_days' && (
                                <span className="text-xs text-gray-500 italic">(default)</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-1">
                              <span className="truncate">{getPresetLabel(preset.key)}</span>
                              {/* Show default note for planner view default filter */}
                              {viewMode === 'planner' && preset.key === 'hide_completed' && (
                                <span className="text-xs text-gray-500 italic">(default)</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom Filters - Single field mode */}
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Custom Filters</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="relative w-1/2">
                          {singleMode === 'none' && (
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Filter by</span>
                          )}
                          <select
                            value={singleMode}
                            onChange={e => setSingleMode(e.target.value as any)}
                            className="text-sm border rounded px-2 py-1 w-full text-gray-900"
                          >
                            <option value="none" hidden></option>
                          <option value="assignee">Assignee</option>
                          <option value="category">Category</option>
                          <option value="tag">Tag</option>
                          <option value="status">Status</option>
                          <option value="priority">Priority</option>
                          <option value="date_range">Date range</option>
                          <option value="date_diff">Date difference</option>
                          <option value="null_is">Is null</option>
                          <option value="null_is_not">Is not null</option>
                          </select>
                        </div>
                        {singleMode === 'date_range' && (
                          <select
                            value={rangeField}
                            onChange={e => setRangeField(e.target.value as any)}
                            className="text-sm border rounded px-2 py-1 w-1/2 text-gray-900"
                          >
                            {dateFields.map(f => (
                              <option key={f} value={f}>{f.replace('_', ' ')}</option>
                            ))}
                          </select>
                        )}
                        {(singleMode === 'null_is' || singleMode === 'null_is_not') && (
                          <select
                            value={nullField}
                            onChange={e => setNullField(e.target.value as any)}
                            className="text-sm border rounded px-2 py-1 w-1/2 text-gray-900"
                          >
                            {[...categoricalFields, ...dateFields].map(f => (
                              <option key={f as any} value={f as any}>{String(f).replace('_', ' ')}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {['assignee', 'category', 'tag', 'status', 'priority'].includes(singleMode) && (
                        renderCategoricalSingle()
                      )}

                      {singleMode === 'date_range' && renderDateRangeSingle()}
                      {singleMode === 'date_diff' && renderDateDiffSingle()}
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <button onClick={clearCustom} className="px-3 py-1.5 text-sm border rounded text-gray-700 hover:bg-gray-50">Clear</button>
                      <button onClick={applyCustom} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Apply</button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer removed - close button already exists in header */}
          </div>
        </div>
      )}
    </>
  );
};

export default UniversalFilter; 