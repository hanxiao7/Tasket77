import React, { useState, useEffect, useRef } from 'react';
import { Filter, X } from 'lucide-react';
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
  type SingleMode = 'none' | 'assignee' | 'category' | 'tag' | 'status' | 'priority' | 'date_range' | 'date_diff';
  const [singleMode, setSingleMode] = useState<SingleMode>('none');
  const [singleValues, setSingleValues] = useState<any[]>([]);
  const [singleIncludeNull, setSingleIncludeNull] = useState<boolean>(false);
  const [categoricalOperator, setCategoricalOperator] = useState<'in' | 'is_null' | 'is_not_null'>('in');
  const [rangeField, setRangeField] = useState<'due_date' | 'completion_date' | 'created_date' | 'last_modified' | 'start_date'>('due_date');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');

  const [diffFrom, setDiffFrom] = useState<'due_date' | 'completion_date' | 'created_date' | 'last_modified' | 'start_date' | 'today'>('created_date');
  const [diffTo, setDiffTo] = useState<'due_date' | 'completion_date' | 'created_date' | 'last_modified' | 'start_date' | 'today'>('today');
  const [diffCmp, setDiffCmp] = useState<'lt' | 'le' | 'eq' | 'ge' | 'gt'>('le');
  const [diffDays, setDiffDays] = useState<number>(0);

  // Load saved filters from database (defaults only - changes are session-only)
  useEffect(() => {
    const loadSavedFilters = async () => {
      if (!workspaceId) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/filters/${workspaceId}?view_mode=${viewMode}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const filters = await response.json();
          
          // Map new database structure to existing UI format
          const viewPresets = filters.map((filter: any) => ({
            id: filter.id,
            name: filter.name,
            enabled: filter.is_default,  // Use is_default for initial state
            is_default: filter.is_default,  // Preserve is_default for sorting
            view_mode: filter.view_mode,
            operator: filter.operator,
            conditions: filter.conditions
          }));
          
          // Set initial state from database defaults
          setPresetFilters(viewPresets);
          
          // Initialize customDays with default values from conditions
          // Note: days values are loaded from database but changes are session-only
          const daysValues: Record<string, number> = {};
          filters.forEach((filter: any) => {
            // Only process filters that have date_diff conditions
            const hasDateDiffCondition = filter.conditions.some((condition: any) => 
              condition.condition_type === 'date_diff'
            );
            
            if (hasDateDiffCondition) {
              // Find the date_diff condition for this filter
              const dateDiffCondition = filter.conditions.find((condition: any) => 
                condition.condition_type === 'date_diff' && condition.values && condition.values.length > 0
              );
              
              if (dateDiffCondition) {
                // Convert filter name to key format
                const key = filter.name.toLowerCase().replace(/\s+/g, '_');
                daysValues[key] = dateDiffCondition.values[0];
                console.log(`Setting days for ${filter.name} (${key}): ${dateDiffCondition.values[0]}`);
              }
            }
          });
          setCustomDays(daysValues);
          
          // Note: We don't call onFiltersChange here to avoid circular updates
          // The parent component should handle initializing the filters with default presets
        }
      } catch (error) {
        console.error('Error loading saved filters:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSavedFilters();
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



  // Initialize single-mode UI from existing customFilters when possible
  useEffect(() => {
    const group = filters.customFilters?.[0];
    const cond = group?.conditions?.[0];
    if (!cond) {
      setSingleMode('none');
      setSingleValues([]);
      setSingleIncludeNull(false);
      setRangeField(DEFAULT_VALUES.rangeField);
      setRangeStart('');
      setRangeEnd('');

      setDiffFrom(DEFAULT_VALUES.diffFrom);
      setDiffTo(DEFAULT_VALUES.diffTo);
      setDiffCmp(DEFAULT_VALUES.diffCmp);
      setDiffDays(DEFAULT_VALUES.diffDays);
      return;
    }
    // Prefer operator-first interpretation so null/date-diff/range take precedence over field type
    if (cond.operator === 'is_null' || cond.operator === 'is_not_null') {
      setSingleMode(cond.field as any);
      setCategoricalOperator(cond.operator === 'is_null' ? 'is_null' : 'is_not_null');
    } else if ((cond as any).condition_type === 'date_range') {
      setSingleMode('date_range');
      setRangeField(cond.field as any);
      // Validate date values before setting them
      const startValue = cond.values?.[0];
      const endValue = cond.values?.[1];
      setRangeStart((typeof startValue === 'string' && startValue.match(/^\d{4}-\d{2}-\d{2}$/)) ? startValue : '');
      setRangeEnd((typeof endValue === 'string' && endValue.match(/^\d{4}-\d{2}-\d{2}$/)) ? endValue : '');
    } else if ((cond as any).condition_type === 'date_diff') {
      setSingleMode('date_diff');
      setDiffFrom(((cond as any).date_from) || DEFAULT_VALUES.diffFrom);
      setDiffTo(((cond as any).date_to) || DEFAULT_VALUES.diffTo);
      // Convert operator back to comparison type
      const operator = (cond as any).operator;
      if (operator === '<') setDiffCmp('lt');
      else if (operator === '<=') setDiffCmp('le');
      else if (operator === '=') setDiffCmp('eq');
      else if (operator === '>=') setDiffCmp('ge');
      else if (operator === '>') setDiffCmp('gt');
      else setDiffCmp('le');
      // Validate days value before setting it
      const daysValue = cond.values?.[0];
      setDiffDays((typeof daysValue === 'number' && daysValue >= 0) ? daysValue : 0);
    } else if ((cond as any).condition_type === 'list') {
      if (cond.field && ['assignee', 'category', 'tag', 'status', 'priority'].includes(cond.field)) {
        setSingleMode(cond.field as SingleMode);
        setSingleValues(Array.isArray(cond.values) ? cond.values : []);
        setSingleIncludeNull(!!cond.includeNull);
      } else {
        setSingleMode('none');
      }
    } else {
      setSingleMode('none');
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

  const handlePresetToggle = (presetId: number, enabled: boolean) => {
    // Update local state first
    setPresetFilters(prev => {
      const newPresets = prev.map(preset => 
        preset.id === presetId 
          ? { ...preset, enabled } 
          : preset
      );
      
      // Defer parent update to next tick to avoid setState during render warning
      setTimeout(() => {
        const updatedPresets = newPresets
          .filter(preset => preset.enabled)
          .map(preset => preset.id);
        
        const newFilters = {
          ...filters,
          presets: updatedPresets,
          currentDays: customDays
        };
        
        console.log('UniversalFilter: Toggle preset, updating filters with:', newFilters);
        onFiltersChange(newFilters);
      }, 0);
      
      return newPresets;
    });
  };

  // Handle date interval changes for preset filters
  // Always updates the filter immediately so that when the preset is enabled,
  // it uses the current days value without needing an "Apply" button
  const handleDaysChange = (presetKey: string, days: number) => {
    console.log(`UniversalFilter: Changing days for ${presetKey} to ${days}`);
    
    // Update local state first
    setCustomDays(prev => {
      const newCustomDays = { ...prev, [presetKey]: days };
      
      // Defer parent update to next tick to avoid setState during render warning
      setTimeout(() => {
        const updatedPresets = presetFilters
          .filter(preset => preset.enabled)
          .map(preset => preset.id);
        
        const newFilters = {
          ...filters,
          presets: updatedPresets,
          currentDays: newCustomDays
        };
        
        console.log('UniversalFilter: Triggering filter update with new days value:', newFilters);
        onFiltersChange(newFilters);
      }, 0);
      
      return newCustomDays;
    });
  };


  const getActiveFiltersCount = () => {
    const presetCount = presetFilters.filter(preset => preset.enabled).length;
    const customCount = filters.customFilters ? filters.customFilters.reduce((acc, g) => acc + (g.conditions?.length || 0), 0) : 0;
    return presetCount + (customCount > 0 ? 1 : 0);
  };

  // Custom filter handlers (session-only - not saved to database)
  const clearCustom = () => {
    setSingleMode('none');
    setSingleValues([]);
    setSingleIncludeNull(false);
    setRangeField(DEFAULT_VALUES.rangeField);
    setRangeStart('');
    setRangeEnd('');

    setDiffFrom(DEFAULT_VALUES.diffFrom);
    setDiffTo(DEFAULT_VALUES.diffTo);
    setDiffCmp(DEFAULT_VALUES.diffCmp);
    setDiffDays(DEFAULT_VALUES.diffDays);
    onFiltersChange({ ...filters, customFilters: undefined, customFiltersLogic: undefined });
  };

  const applyCustom = () => {
    console.log('UniversalFilter: Apply button clicked, current state:', {
      singleMode,
      singleValues,
      singleIncludeNull,
      categoricalOperator,
      rangeField,
      rangeStart,
      rangeEnd,

      diffFrom,
      diffTo,
      diffCmp,
      diffDays
    });
    
    // Convert UI selection to database-compatible format
    let condition: any = null;
    
    if (['assignee', 'category', 'tag', 'status', 'priority'].includes(singleMode)) {
      // Categorical fields with operator selector
      condition = {
        condition_type: 'list',
        field: singleMode,
        operator: categoricalOperator.toUpperCase(), // Convert to uppercase for database
        values: categoricalOperator === 'in' ? singleValues : [],
        includeNull: ['assignee', 'category', 'tag'].includes(singleMode) ? singleIncludeNull : undefined,
      };
    } else if (singleMode === 'date_range') {
      if (rangeStart && rangeEnd) {
        condition = {
          condition_type: 'date_range',
          field: rangeField,
          operator: 'between',
          values: [rangeStart, rangeEnd],
        };
      }
    } else if (singleMode === 'date_diff') {
      condition = {
        condition_type: 'date_diff',
        date_from: diffFrom,
        date_to: diffTo,
        operator: diffCmp === 'lt' ? '<' : diffCmp === 'le' ? '<=' : diffCmp === 'eq' ? '=' : diffCmp === 'ge' ? '>=' : '>',
        values: [diffDays],
        unit: 'days',
      };
    }

    console.log('UniversalFilter: Built database-compatible condition:', condition);

    if (condition) {
      // Create a custom filter object that matches the FilterGroup interface
      const customFilter = {
        id: 'custom_' + Date.now(),
        logic: 'AND' as const,
        conditions: [condition]
      };
      
      const newFilters = { ...filters, customFilters: [customFilter], customFiltersLogic: 'AND' as const };
      console.log('UniversalFilter: Applying custom filters:', newFilters);
      onFiltersChange(newFilters);
    } else {
      console.log('UniversalFilter: No valid condition, clearing custom filters');
      onFiltersChange({ ...filters, customFilters: undefined, customFiltersLogic: undefined });
    }
  };

  // Sort presets: default first, then alphabetically
  const getSortedPresets = (presets: PresetFilter[]): PresetFilter[] => {
    const sorted = presets.sort((a, b) => {
      // Default presets first
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });
    
    console.log('UniversalFilter: Sorted presets:', sorted.map(p => ({ name: p.name, is_default: p.is_default })));
    return sorted;
  };

  // Helpers to render editors
  const categoricalFields = ['assignee', 'category', 'tag', 'status', 'priority'] as const;
  const dateFields = ['due_date', 'completion_date', 'created_date', 'last_modified', 'start_date'] as const;
  
  // These could be moved to a constants file or loaded from database in the future
  const statusOptions = ['todo', 'in_progress', 'paused', 'done'];
  const priorityOptions = ['urgent', 'high', 'normal', 'low'];
  
  // Default values for form initialization
  const DEFAULT_VALUES = {
    rangeField: 'due_date' as const,
    diffFrom: 'created_date' as const,
    diffTo: 'today' as const,
    diffCmp: 'ge' as const,
    diffDays: 0,
    fallbackDays: 7
  };

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
        {/* Only show values input when operator is 'in' */}
        {categoricalOperator === 'in' && (
          <>
            <div className="flex items-center justify-between mb-1">
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
          </>
        )}
        

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
                          key={preset.id}
                          className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={preset.enabled}
                            onChange={(e) => handlePresetToggle(preset.id, e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          {preset.conditions?.some((c: any) => c.condition_type === 'date_diff') ? (
                            <div className="flex items-center gap-1 flex-1">
                              <span className="truncate">
                                {preset.name}
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={customDays[preset.name.toLowerCase().replace(/\s+/g, '_')] || (typeof preset.conditions?.[0]?.values?.[0] === 'number' && preset.conditions[0].values[0] >= 0 ? preset.conditions[0].values[0] : DEFAULT_VALUES.fallbackDays)}
                                onChange={(e) => handleDaysChange(preset.name.toLowerCase().replace(/\s+/g, '_'), Number(e.target.value))}
                                className="w-12 text-sm border rounded px-1 py-0.5 text-center"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm text-gray-900">days</span>
                              {/* Show default note for default filters */}
                              {preset.is_default && (
                                <span className="text-xs text-gray-500 italic">(default)</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-1">
                              <span className="truncate">{preset.name}</span>
                              {/* Show default note for default filters */}
                              {preset.is_default && (
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
                          </select>
                        </div>
                        {/* Operator selector for categorical fields - moved to be inline */}
                        {['assignee', 'category', 'tag', 'status', 'priority'].includes(singleMode) && (
                          <select
                            value={categoricalOperator}
                            onChange={(e) => setCategoricalOperator(e.target.value as 'in' | 'is_null' | 'is_not_null')}
                            className="text-sm border rounded px-2 py-1 w-1/2 text-gray-900"
                          >
                            <option value="in">In</option>
                            <option value="is_null">Is NULL</option>
                            <option value="is_not_null">Is not NULL</option>
                          </select>
                        )}
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