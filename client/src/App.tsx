import React, { useState, useRef } from 'react';
import { TaskFilters, ViewMode } from './types';
import TaskList from './components/TaskList';
import { Download, ArrowUpDown } from 'lucide-react';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('planner');
  const [filters, setFilters] = useState<TaskFilters>({
    view: 'planner',
    show_completed: false,
    days: 7
  });
  const [isSorting, setIsSorting] = useState(false);
  const taskListRef = useRef<{ sortTasks: () => void }>(null);

  const handleFiltersChange = (newFilters: TaskFilters) => {
    setFilters(newFilters);
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Task Management Tool</h1>
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
            onFiltersChange={handleFiltersChange}
            onSort={handleSort}
            isSorting={isSorting}
          />
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Quick Tips:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Click status button to cycle: To Do → In Progress → Paused → To Do</li>
            <li>• Double-click status button to mark as Done</li>
            <li>• Click task title to edit it inline</li>
            <li>• Click start date or due date to set/edit dates</li>
            <li>• Right-click task for Edit Task or Delete options</li>
            <li>• Hover over tasks to see descriptions</li>
            <li>• Type in the input field and press Enter to create new tasks</li>
            <li>• Click "+ Create new tag" to add new tags for organizing tasks</li>
            <li>• Drag and drop tasks between tags to reorganize</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App; 