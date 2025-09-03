import React, { useRef, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import TaskList from './components/TaskList';
import TaskSummary from './components/TaskSummary';
import WorkspaceSelector from './components/WorkspaceSelector';
import UserMenu from './components/UserMenu';
import UniversalFilter from './components/UniversalFilter';

import { Download, ArrowUpDown, CheckCircle } from 'lucide-react';
import { TaskFilters, ViewMode, Task } from './types';

function MainApp() {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | undefined>(undefined);
  const [filters, setFilters] = useState<TaskFilters>({
    view: 'planner',
    presets: [], // Default presets will be loaded from database
    grouping: 'none', // Default to no grouping for planner
    _initialFiltersLoaded: false // Track if initial filters have been loaded
  });
  
  // Derive viewMode from filters.view - single source of truth
  const viewMode = filters.view || 'planner';
  const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Array<{ id: number; name: string; access_level?: 'owner' | 'edit' | 'view'; other_users_count?: number }>>([]);
  const taskListRef = useRef<{ sortTasks: () => void; getTasks: () => Task[] }>(null);
  const { user } = useAuth();



  // Load workspaces on component mount
  useEffect(() => {
    const loadWorkspaces = async () => {
      console.log(`🔄 Loading workspaces for user ${user?.id} (${user?.email})`);
      try {
        const response = await fetch('http://localhost:3001/api/workspaces', {
          credentials: 'include'
        });
        if (response.ok) {
          const workspacesData = await response.json();
                      console.log(`📋 Loaded ${workspacesData.length} workspaces:`, workspacesData.map((w: { id: number; name: string; is_default: boolean; access_level?: string; other_users_count?: number }) => ({ id: w.id, name: w.name, is_default: w.is_default, access_level: w.access_level, other_users_count: w.other_users_count })));
          setWorkspaces(workspacesData);
          
          // Set the first workspace as selected if none is selected
          if (workspacesData.length > 0 && !workspacesData.find((w: { id: number }) => w.id === selectedWorkspaceId)) {
            console.log(`🎯 Setting selected workspace to ${workspacesData[0].id} (${workspacesData[0].name})`);
            setSelectedWorkspaceId(workspacesData[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading workspaces:', error);
      }
    };

    if (user) {
      loadWorkspaces();
    }
  }, [user]); // Removed selectedWorkspaceId from dependencies to prevent infinite loops

  // Load initial preset filters when workspace is selected
  useEffect(() => {
    if (!selectedWorkspaceId) return;
    
    console.log('🔄 App.tsx: Loading initial preset filters for workspace:', selectedWorkspaceId);
    
    const loadInitialFilters = async () => {
      try {
        const response = await fetch(`/api/filters/${selectedWorkspaceId}?view_mode=planner`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const filters = await response.json();
          const enabledPresets = filters
            .filter((filter: any) => filter.is_default)
            .map((filter: any) => filter.id);
          
          console.log('🔄 App.tsx: Setting initial filters with presets:', enabledPresets);
          
          // Set filters immediately - this will be the initial state for TaskList
          setFilters({
            view: 'planner',
            workspace_id: selectedWorkspaceId,
            presets: enabledPresets,
            grouping: 'none',
            currentDays: {},
            customFilters: undefined,
            customFiltersLogic: 'AND',
            _initialFiltersLoaded: true
          });
        }
      } catch (error) {
        console.error('Error loading preset filters:', error);
        // Set empty filters as fallback
        setFilters({
          view: 'planner',
          workspace_id: selectedWorkspaceId,
          presets: [],
          grouping: 'none',
          currentDays: {},
          customFilters: undefined,
          customFiltersLogic: 'AND',
          _initialFiltersLoaded: true
        });
      }
    };

    loadInitialFilters();
  }, [selectedWorkspaceId]);



  const handleFiltersChange = async (newFilters: TaskFilters) => {
    setFilters(newFilters);
  };

  const handleViewModeChange = async (newViewMode: ViewMode) => {
    console.log('🔄 App.tsx: Changing view mode to:', newViewMode);
    
    // Load filters for the new view mode
    if (selectedWorkspaceId) {
      try {
        const response = await fetch(`/api/filters/${selectedWorkspaceId}?view_mode=${newViewMode}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const filters = await response.json();
          const enabledPresets = filters
            .filter((filter: any) => filter.is_default)
            .map((filter: any) => filter.id);
          
          console.log('🔄 App.tsx: Setting filters for view:', newViewMode, 'presets:', enabledPresets);
          
          // Single state update - this is the only change needed!
          setFilters({
            view: newViewMode,
            workspace_id: selectedWorkspaceId,
            presets: enabledPresets,
            grouping: newViewMode === 'planner' ? 'none' : 'category',
            currentDays: {},
            customFilters: undefined,
            customFiltersLogic: 'AND',
            _initialFiltersLoaded: true
          });
        }
      } catch (error) {
        console.error('Error loading preset filters:', error);
        // Fallback: just update the view in filters
        setFilters(prev => ({
          ...prev,
          view: newViewMode,
          grouping: newViewMode === 'planner' ? 'none' : 'category'
        }));
      }
    }
  };

  const handleWorkspaceChange = (workspaceId: number) => {
    setSelectedWorkspaceId(workspaceId);
    setFilters(prev => ({ ...prev, workspace_id: workspaceId }));
  };

  const refreshWorkspaces = async () => {
    console.log(`🔄 Refreshing workspaces for user ${user?.id}`);
    try {
      const response = await fetch('http://localhost:3001/api/workspaces', {
        credentials: 'include'
      });
      if (response.ok) {
        const workspacesData = await response.json();
        console.log(`📋 Refreshed ${workspacesData.length} workspaces:`, workspacesData.map((w: { id: number; name: string; is_default: boolean; access_level?: string; other_users_count?: number }) => ({ id: w.id, name: w.name, is_default: w.is_default, access_level: w.access_level, other_users_count: w.other_users_count })));
        setWorkspaces(workspacesData);
        
        // Update selected workspace if current one no longer exists
        if (selectedWorkspaceId && !workspacesData.find((w: { id: number }) => w.id === selectedWorkspaceId)) {
          if (workspacesData.length > 0) {
            console.log(`🎯 Current workspace no longer accessible, switching to ${workspacesData[0].id} (${workspacesData[0].name})`);
            setSelectedWorkspaceId(workspacesData[0].id);
          } else {
            console.log(`⚠️ No workspaces available, clearing selection`);
            setSelectedWorkspaceId(undefined);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing workspaces:', error);
    }
  };
  const handleSort = () => {
    taskListRef.current?.sortTasks();
  };

  const updateTaskSummary = () => {
    if (taskListRef.current) {
      setCurrentTasks(taskListRef.current.getTasks());
    }
  };
  const handleExport = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/export', { credentials: 'include' });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tasks-export.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting tasks:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-3 md:p-6">
        {/* Header */}
        <div className="mb-6">
          {/* Mobile Layout: Stack vertically */}
          <div className="sm:hidden">
            {/* Top row: App name and user menu */}
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-bold text-gray-900">Tasket77</h1>
              <UserMenu 
                selectedWorkspaceId={selectedWorkspaceId}
                workspaces={workspaces}
                onWorkspaceChange={handleWorkspaceChange}
                refreshWorkspaces={refreshWorkspaces}
              />
            </div>
            {/* Second row: Workspace selector */}
            <div className="mb-3">
              <WorkspaceSelector 
                selectedWorkspaceId={selectedWorkspaceId}
                onWorkspaceChange={handleWorkspaceChange}
                workspaces={workspaces}
                refreshWorkspaces={refreshWorkspaces}
              />
            </div>
          </div>

          {/* Desktop Layout: Original horizontal layout */}
          <div className="hidden sm:block">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Tasket77</h1>
                <p className="text-gray-600">Quick to log. Easy to maintain. See what got done.</p>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <div className="flex items-center space-x-4">
                  <WorkspaceSelector 
                    selectedWorkspaceId={selectedWorkspaceId}
                    onWorkspaceChange={handleWorkspaceChange}
                    workspaces={workspaces}
                    refreshWorkspaces={refreshWorkspaces}
                  />
                  <UserMenu 
                    selectedWorkspaceId={selectedWorkspaceId}
                    workspaces={workspaces}
                    onWorkspaceChange={handleWorkspaceChange}
                    refreshWorkspaces={refreshWorkspaces}
                  />
                </div>
                {/* Task Summary - hidden on mobile */}
                <TaskSummary tasks={currentTasks} />
              </div>
            </div>
          </div>
        </div>
        {/* View Tabs */}
        <div className="mb-4">
          {/* Mobile Layout: Stack controls vertically */}
          <div className="sm:hidden space-y-3">
            {/* Tabs */}
            <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => handleViewModeChange('planner')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${
                  viewMode === 'planner'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Planner
              </button>
              <button
                onClick={() => handleViewModeChange('tracker')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${
                  viewMode === 'tracker'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Tracker
              </button>
            </div>
            
                        {/* Controls row */}
            <div className="flex items-center justify-between">
              {/* Left side: Filters and Grouping */}
              <div className="flex items-center space-x-2">
                {/* Universal filter */}
                {selectedWorkspaceId && (
                  <UniversalFilter
                    workspaceId={selectedWorkspaceId}
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    viewMode={viewMode}
                  />
                )}
                
                {/* Grouping selector */}
                <select
                  value={filters.grouping || 'none'}
                  onChange={(e) => setFilters({ ...filters, grouping: e.target.value as 'none' | 'status' | 'priority' | 'category' })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Group tasks by"
                >
                  <option value="none">No grouping</option>
                  <option value="status">Status</option>
                  <option value="priority">Priority</option>
                  <option value="category">Category</option>
                </select>
              </div>
              
              {/* Right side: Action buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSort}
                  className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors"
                  title="Sort Tasks"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors"
                  title="Export tasks"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Layout: Original horizontal layout */}
          <div className="hidden sm:block">
            <div className="flex items-center justify-between">
              <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
                <button
                  onClick={() => handleViewModeChange('planner')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'planner'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Planner
                </button>
                <button
                  onClick={() => handleViewModeChange('tracker')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'tracker'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tracker
                </button>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Universal filter */}
                {selectedWorkspaceId && (
                  <UniversalFilter
                    workspaceId={selectedWorkspaceId}
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    viewMode={viewMode}
                  />
                )}
                

                
                {/* Grouping selector */}
                <select
                  value={filters.grouping || 'none'}
                  onChange={(e) => setFilters({ ...filters, grouping: e.target.value as 'none' | 'status' | 'priority' | 'category' | 'tag' })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Group tasks by"
                >
                  <option value="none">No grouping</option>
                  <option value="status">Status</option>
                  <option value="priority">Priority</option>
                  <option value="category">Category</option>
                  <option value="tag">Tag</option>
                </select>

                <div className="flex space-x-2">
                  <button
                    onClick={handleSort}
                    className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors"
                    title="Sort Tasks"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors"
                    title="Export tasks"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Task List */}
        {selectedWorkspaceId && filters._initialFiltersLoaded ? (
          <div className="bg-white rounded-lg shadow-sm border">
            <TaskList
              ref={taskListRef}
              viewMode={viewMode}
              filters={filters}
              selectedWorkspaceId={selectedWorkspaceId}
              onFiltersChange={handleFiltersChange}
              onSort={handleSort}
              onTasksChange={setCurrentTasks}
            />
          </div>
        ) : selectedWorkspaceId ? (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="text-gray-500">Loading filters...</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <p className="text-gray-500">No workspace selected. Please create or select a workspace to get started.</p>
          </div>
        )}
        {/* Instructions */}
        <div className="mt-6 p-3 md:p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2 text-sm md:text-base">Quick Tips:</h3>
          <ul className="text-xs md:text-sm text-blue-800 space-y-1">
            <li>• Planner view helps create and follow tasks. Switch to Tracker to review recent progress.</li>
            <li>• Use categories to classify tasks by category or theme</li>
            <li>• Click the status button to cycle through: To Do → In Progress → Paused → In Progress → …</li>
            <li>• Double-click the status button to mark as Done</li>
            <li>• Click the priority flag to cycle: Normal → High → Urgent → Low → Normal → …</li>
            <li>• Hover over a task to add or view descriptions</li>
            <li>• Use the workspace selector to switch between isolated task sets</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainApp />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App; 