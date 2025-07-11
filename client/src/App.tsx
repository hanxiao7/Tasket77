import React, { useState, useRef } from 'react';
import { TaskFilters, ViewMode } from './types';
import TaskList from './components/TaskList';
import WorkspaceSelector from './components/WorkspaceSelector';
import { Download, ArrowUpDown } from 'lucide-react';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('planner');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number>(1);
  const [filters, setFilters] = useState<TaskFilters>({
    view: 'planner',
    show_completed: false,
    days: 7,
    workspace_id: 1
  });
  const [isSorting, setIsSorting] = useState(false);
  const taskListRef = useRef<{ sortTasks: () => void }>(null);

  const handleFiltersChange = (newFilters: TaskFilters) => {
    setFilters(newFilters);
  };

  const handleWorkspaceChange = (workspaceId: number) => {
    setSelectedWorkspaceId(workspaceId);
    // Update filters to include the new workspace
    setFilters(prev => ({ ...prev, workspace_id: workspaceId }));
  };

  const handleSort = () => {
    setIsSorting(true);
    taskListRef.current?.sortTasks();
    setTimeout(() => setIsSorting(false), 500);
  };

  const handleExport = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/export');
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
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Task Management Tool</h1>
            <WorkspaceSelector 
              selectedWorkspaceId={selectedWorkspaceId}
              onWorkspaceChange={handleWorkspaceChange}
            />
          </div>
          <p className="text-gray-600">Minimal, fast-to-use task management for fast-paced environments</p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => {
                setViewMode('planner');
                setFilters({ ...filters, view: 'planner', show_completed: false });
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
                setFilters({ ...filters, view: 'tracker', show_completed: true });
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

          <div className="flex items-center space-x-3">
            {/* Show completed toggle for planner */}
            {viewMode === 'planner' && (
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.show_completed}
                  onChange={(e) => setFilters({ ...filters, show_completed: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Show completed</span>
              </label>
            )}

            {/* Days filter for tracker */}
            {viewMode === 'tracker' && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Last</span>
                <select
                  value={filters.days || 7}
                  onChange={(e) => setFilters({ ...filters, days: Number(e.target.value) })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>
            )}

            <button
              onClick={handleSort}
              disabled={isSorting}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sort tasks"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>{isSorting ? 'Sorting...' : 'Sort Tasks'}</span>
            </button>

            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors"
              title="Export tasks"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
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
            isSorting={isSorting}
          />
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Quick Tips:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Planner view helps create and follow tasks. Switch to Tracker to review recent progress.</li>
            <li>• Use tags to classify tasks by category or theme</li>
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

export default App; 