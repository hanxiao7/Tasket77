import React, { useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import TaskList from './components/TaskList';
import TaskSummary from './components/TaskSummary';
import WorkspaceSelector from './components/WorkspaceSelector';
import UserMenu from './components/UserMenu';
import { Download, ArrowUpDown, CheckCircle } from 'lucide-react';
import { TaskFilters, ViewMode, Task } from './types';

function MainApp() {
  const [viewMode, setViewMode] = useState<ViewMode>('planner');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number>(1);
  const [filters, setFilters] = useState<TaskFilters>({
    view: 'planner',
    show_completed: false,
    days: 7,
    grouping: 'none' // Default to no grouping for planner
  });
  const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Array<{ id: number; name: string; access_level?: 'owner' | 'edit' | 'view' }>>([]);
  const taskListRef = useRef<{ sortTasks: () => void; getTasks: () => Task[] }>(null);
  const { user } = useAuth();

  const handleFiltersChange = (newFilters: TaskFilters) => setFilters(newFilters);
  const handleWorkspaceChange = (workspaceId: number) => {
    setSelectedWorkspaceId(workspaceId);
    setFilters(prev => ({ ...prev, workspace_id: workspaceId }));
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
              />
            </div>
            {/* Second row: Workspace selector */}
            <div className="mb-3">
              <WorkspaceSelector 
                selectedWorkspaceId={selectedWorkspaceId}
                onWorkspaceChange={handleWorkspaceChange}
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
                  />
                  <UserMenu 
                    selectedWorkspaceId={selectedWorkspaceId}
                    workspaces={workspaces}
                    onWorkspaceChange={handleWorkspaceChange}
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
                onClick={() => {
                  setViewMode('planner');
                  setFilters({ ...filters, view: 'planner', show_completed: false, grouping: 'none' });
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${
                  viewMode === 'planner'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Planner
              </button>
              <button
                onClick={() => {
                  setViewMode('tracker');
                  setFilters({ ...filters, view: 'tracker', show_completed: true, grouping: 'category' });
                }}
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
              {/* Left side: Grouping selector */}
              <div className="flex items-center">
                {/* Days filter for tracker */}
                {viewMode === 'tracker' && (
                  <select
                    value={filters.days || 7}
                    onChange={(e) => setFilters({ ...filters, days: Number(e.target.value) })}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Filter by days"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
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
                {/* Show completed toggle for planner */}
                {viewMode === 'planner' && (
                  <button
                    onClick={() => setFilters({ ...filters, show_completed: !filters.show_completed })}
                    className="flex items-center justify-center w-6 h-6 rounded-full transition-colors hover:bg-gray-100"
                    title={filters.show_completed ? "Hide completed tasks" : "Show completed tasks"}
                  >
                    {filters.show_completed ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <div className="relative">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-5 h-0.5 bg-red-500 transform rotate-45"></div>
                        </div>
                      </div>
                    )}
                  </button>
                )}
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
                  onClick={() => {
                    setViewMode('planner');
                    setFilters({ ...filters, view: 'planner', show_completed: false, grouping: 'none' });
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'planner'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Planner
                </button>
                <button
                  onClick={() => {
                    setViewMode('tracker');
                    setFilters({ ...filters, view: 'tracker', show_completed: true, grouping: 'category' });
                  }}
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
                {/* Days filter for tracker */}
                {viewMode === 'tracker' && (
                  <select
                    value={filters.days || 7}
                    onChange={(e) => setFilters({ ...filters, days: Number(e.target.value) })}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Filter by days"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
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
                {/* Show completed toggle for planner */}
                {viewMode === 'planner' && (
                  <button
                    onClick={() => setFilters({ ...filters, show_completed: !filters.show_completed })}
                    className="flex items-center justify-center w-6 h-6 rounded-full transition-colors hover:bg-gray-100"
                    title={filters.show_completed ? "Hide completed tasks" : "Show completed tasks"}
                  >
                    {filters.show_completed ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <div className="relative">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-5 h-0.5 bg-red-500 transform rotate-45"></div>
                        </div>
                      </div>
                    )}
                  </button>
                )}
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