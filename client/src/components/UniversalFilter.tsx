import React, { useState, useEffect, useRef } from 'react';
import { Filter, X, Users, Tag, Calendar, CheckCircle, Play, Pause, Circle } from 'lucide-react';
import { TaskFilters } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface UniversalFilterProps {
  workspaceId: number;
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  viewMode: 'planner' | 'tracker';
  className?: string;
}

interface WorkspaceUser {
  user_id: number;
  name: string;
  email: string;
  access_level: string;
}

interface Category {
  id: number;
  name: string;
  workspace_id: number;
  hidden: boolean;
}

const UniversalFilter: React.FC<UniversalFilterProps> = ({ 
  workspaceId, 
  filters, 
  onFiltersChange, 
  viewMode,
  className = '' 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const currentUserId = user?.id || null;

  // Load workspace users and categories
  useEffect(() => {
    const loadData = async () => {
      if (!workspaceId) return;
      
      setLoading(true);
      try {
        const [usersResponse, categoriesResponse] = await Promise.all([
          fetch(`/api/workspace-users/${workspaceId}`, { credentials: 'include' }),
          fetch(`/api/categories?workspace_id=${workspaceId}&include_hidden=true`, { credentials: 'include' })
        ]);
        
        if (usersResponse.ok) {
          const users = await usersResponse.json();
          setWorkspaceUsers(users);
        }
        
        if (categoriesResponse.ok) {
          const cats = await categoriesResponse.json();
          setCategories(cats);
        }
      } catch (error) {
        console.error('Error loading filter data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [workspaceId]);

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

  const selectedAssigneeIds = filters.assignee_ids || [];
  const selectedCategoryIds = filters.category_ids || [];
  const selectedStatuses = filters.statuses || [];

  const handleAssigneeToggle = (userId: number) => {
    const newAssigneeIds = selectedAssigneeIds.includes(userId)
      ? selectedAssigneeIds.filter(id => id !== userId)
      : [...selectedAssigneeIds, userId];
    
    onFiltersChange({
      ...filters,
      assignee_ids: newAssigneeIds.length > 0 ? newAssigneeIds : undefined
    });
  };



  const handleCategoryToggle = (categoryId: number) => {
    const newCategoryIds = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter(id => id !== categoryId)
      : [...selectedCategoryIds, categoryId];
    
    onFiltersChange({
      ...filters,
      category_ids: newCategoryIds.length > 0 ? newCategoryIds : undefined
    });
  };

  const handleStatusToggle = (status: string) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter(s => s !== status)
      : [...selectedStatuses, status];
    
    onFiltersChange({
      ...filters,
      statuses: newStatuses.length > 0 ? newStatuses : undefined
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedAssigneeIds.length > 0) count++;
    if (selectedCategoryIds.length > 0) count++;
    if (selectedStatuses.length > 0) count++;
    return count;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo': return <Circle className="w-4 h-4" />;
      case 'in_progress': return <Play className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'done': return <CheckCircle className="w-4 h-4" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return 'To Do';
      case 'in_progress': return 'In Progress';
      case 'paused': return 'Paused';
      case 'done': return 'Done';
      default: return status;
    }
  };

  // Get view-specific defaults
  const getViewDefaults = () => {
    if (viewMode === 'planner') {
      return {
        statuses: ['todo', 'in_progress', 'paused'], // exclude 'done' by default
        assignee_ids: undefined,
        category_ids: undefined
      };
    } else if (viewMode === 'tracker') {
      return {
        statuses: ['in_progress', 'paused', 'done'], // exclude 'todo' by default
        assignee_ids: undefined,
        category_ids: undefined
      };
    }
    return {
      statuses: undefined,
      assignee_ids: undefined,
      category_ids: undefined
    };
  };

  // Check if current filters match view defaults
  const isAtViewDefaults = () => {
    const defaults = getViewDefaults();
    const currentStatuses = filters.statuses || [];
    const defaultStatuses = defaults.statuses || [];
    
    // Check if statuses match (order doesn't matter)
    const statusesMatch = currentStatuses.length === defaultStatuses.length &&
      currentStatuses.every(status => defaultStatuses.includes(status)) &&
      defaultStatuses.every(status => currentStatuses.includes(status));
    
    // Check if other filters are at defaults (undefined or empty)
    const assigneesAtDefault = !filters.assignee_ids || filters.assignee_ids.length === 0;
    const categoriesAtDefault = !filters.category_ids || filters.category_ids.length === 0;
    
    return statusesMatch && assigneesAtDefault && categoriesAtDefault;
  };

  // Reset filters to view defaults
  const handleResetToDefaults = () => {
    const defaults = getViewDefaults();
    onFiltersChange({
      ...filters,
      ...defaults
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
                                     {/* Assignees Filter */}
                   <div>
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2">
                         <Users className="w-4 h-4 text-gray-500" />
                         <h4 className="font-medium text-gray-900">Assignees</h4>
                       </div>
                                               <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedAssigneeIds.length === workspaceUsers.length + 1}
                            onChange={() => {
                              if (selectedAssigneeIds.length === workspaceUsers.length + 1) {
                                onFiltersChange({ ...filters, assignee_ids: undefined });
                              } else {
                                onFiltersChange({ ...filters, assignee_ids: [-1, ...workspaceUsers.map(u => u.user_id)] });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="font-medium text-gray-700">Select All</span>
                        </label>
                     </div>
                     
                     

                                           {/* Individual assignees */}
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {/* Current user first */}
                        {currentUserId && workspaceUsers.find(u => u.user_id === currentUserId) && (
                          <label className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedAssigneeIds.includes(currentUserId)}
                              onChange={() => handleAssigneeToggle(currentUserId)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="truncate font-medium text-blue-600">
                              {workspaceUsers.find(u => u.user_id === currentUserId)?.name} (You)
                            </span>
                          </label>
                        )}
                        
                        {/* Other users sorted alphabetically */}
                        {workspaceUsers
                          .filter(user => user.user_id !== currentUserId)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((user) => (
                            <label
                              key={user.user_id}
                              className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedAssigneeIds.includes(user.user_id)}
                                onChange={() => handleAssigneeToggle(user.user_id)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                              />
                              <span className="truncate">{user.name}</span>
                            </label>
                          ))}
                        
                        {/* None option for unassigned tasks - at the bottom */}
                        <label className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedAssigneeIds.includes(-1)}
                            onChange={() => handleAssigneeToggle(-1)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="truncate text-gray-500 italic">None (Unassigned)</span>
                        </label>
                      </div>
                   </div>

                                     {/* Categories Filter */}
                   <div>
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2">
                         <Tag className="w-4 h-4 text-gray-500" />
                         <h4 className="font-medium text-gray-900">Categories</h4>
                       </div>
                                               <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.length === categories.filter(cat => !cat.hidden).length + 1}
                            onChange={() => {
                              const visibleCategories = categories.filter(cat => !cat.hidden);
                              if (selectedCategoryIds.length === visibleCategories.length + 1) {
                                onFiltersChange({ ...filters, category_ids: undefined });
                              } else {
                                onFiltersChange({ ...filters, category_ids: [-1, ...visibleCategories.map(c => c.id)] });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="font-medium text-gray-700">Select All</span>
                        </label>
                     </div>

                                           {/* Individual categories */}
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {categories
                          .filter(cat => !cat.hidden)
                          .map((category) => (
                            <label
                              key={category.id}
                              className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedCategoryIds.includes(category.id)}
                                onChange={() => handleCategoryToggle(category.id)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                              />
                              <span className="truncate">{category.name}</span>
                            </label>
                          ))}
                        
                        {/* None option for uncategorized tasks - at the bottom */}
                        <label className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(-1)}
                            onChange={() => handleCategoryToggle(-1)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="truncate text-gray-500 italic">None (Uncategorized)</span>
                        </label>
                      </div>
                   </div>

                                     {/* Status Filter */}
                   <div>
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2">
                         <CheckCircle className="w-4 h-4 text-gray-500" />
                         <h4 className="font-medium text-gray-900">Status</h4>
                       </div>
                       <label className="flex items-center gap-2 text-sm cursor-pointer">
                         <input
                           type="checkbox"
                           checked={selectedStatuses.length === 4}
                           onChange={() => {
                             if (selectedStatuses.length === 4) {
                               onFiltersChange({ ...filters, statuses: undefined });
                             } else {
                               onFiltersChange({ ...filters, statuses: ['todo', 'in_progress', 'paused', 'done'] });
                             }
                           }}
                           className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                         />
                         <span className="font-medium text-gray-700">Select All</span>
                       </label>
                     </div>

                     {/* Individual statuses */}
                     <div className="space-y-1">
                       {['todo', 'in_progress', 'paused', 'done'].map((status) => (
                         <label
                           key={status}
                           className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer"
                         >
                           <input
                             type="checkbox"
                             checked={selectedStatuses.includes(status)}
                             onChange={() => handleStatusToggle(status)}
                             className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                           />
                           <div className="flex items-center gap-2">
                             {getStatusIcon(status)}
                             <span>{getStatusLabel(status)}</span>
                           </div>
                         </label>
                       ))}
                     </div>
                   </div>
                </>
              )}
            </div>

                         {/* Footer */}
             <div className="flex justify-end p-4 border-t border-gray-200">
               <button
                 onClick={handleResetToDefaults}
                 disabled={isAtViewDefaults()}
                 className={`px-4 py-2 rounded-md transition-colors ${
                   isAtViewDefaults()
                     ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                     : 'bg-blue-600 text-white hover:bg-blue-700'
                 }`}
               >
                 Reset to Default
               </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UniversalFilter; 