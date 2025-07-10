import React, { useState, useEffect } from 'react';
import { Workspace } from '../types';
import { apiService } from '../services/api';
import { ChevronDown, Plus, Edit, Trash2, Settings } from 'lucide-react';

interface WorkspaceSelectorProps {
  selectedWorkspaceId: number;
  onWorkspaceChange: (workspaceId: number) => void;
}

const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ 
  selectedWorkspaceId, 
  onWorkspaceChange 
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [editWorkspaceDescription, setEditWorkspaceDescription] = useState('');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const workspacesData = await apiService.getWorkspaces();
      setWorkspaces(workspacesData);
      
      // If no workspace is selected and we have workspaces, select the first one
      if (selectedWorkspaceId === 0 && workspacesData.length > 0) {
        onWorkspaceChange(workspacesData[0].id);
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    
    try {
      const newWorkspace = await apiService.createWorkspace(
        newWorkspaceName.trim(), 
        newWorkspaceDescription.trim() || undefined
      );
      setWorkspaces([...workspaces, newWorkspace]);
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
      setIsCreating(false);
      onWorkspaceChange(newWorkspace.id);
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  };

  const handleUpdateWorkspace = async (id: number) => {
    if (!editWorkspaceName.trim()) return;
    
    try {
      const updatedWorkspace = await apiService.updateWorkspace(
        id,
        editWorkspaceName.trim(),
        editWorkspaceDescription.trim() || undefined
      );
      setWorkspaces(workspaces.map(w => w.id === id ? updatedWorkspace : w));
      setEditWorkspaceName('');
      setEditWorkspaceDescription('');
      setIsEditing(null);
    } catch (error) {
      console.error('Error updating workspace:', error);
    }
  };

  const handleDeleteWorkspace = async (id: number) => {
    if (id === 1) {
      alert('Cannot delete the default workspace');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this workspace? This will also delete all tasks and tags in this workspace.')) {
      return;
    }
    
    try {
      await apiService.deleteWorkspace(id);
      setWorkspaces(workspaces.filter(w => w.id !== id));
      
      // If the deleted workspace was selected, switch to the first available workspace
      if (selectedWorkspaceId === id && workspaces.length > 1) {
        const remainingWorkspaces = workspaces.filter(w => w.id !== id);
        onWorkspaceChange(remainingWorkspaces[0].id);
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
    }
  };

  const startEditing = (workspace: Workspace) => {
    setIsEditing(workspace.id);
    setEditWorkspaceName(workspace.name);
    setEditWorkspaceDescription(workspace.description || '');
  };

  const cancelEditing = () => {
    setIsEditing(null);
    setEditWorkspaceName('');
    setEditWorkspaceDescription('');
  };

  return (
    <div className="relative">
      {/* Main Selector */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Settings className="w-4 h-4 text-gray-500" />
        <span className="font-medium text-gray-900">
          {selectedWorkspace?.name || 'Select Workspace'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* Workspace List */}
          <div className="p-2">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="mb-2">
                {isEditing === workspace.id ? (
                  // Edit Mode
                  <div className="p-3 border border-blue-300 rounded-lg bg-blue-50">
                    <input
                      type="text"
                      value={editWorkspaceName}
                      onChange={(e) => setEditWorkspaceName(e.target.value)}
                      className="w-full mb-2 px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Workspace name"
                    />
                    <textarea
                      value={editWorkspaceDescription}
                      onChange={(e) => setEditWorkspaceDescription(e.target.value)}
                      className="w-full mb-2 px-2 py-1 border border-gray-300 rounded text-sm resize-none"
                      placeholder="Description (optional)"
                      rows={2}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateWorkspace(workspace.id)}
                        className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display Mode
                  <div className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedWorkspaceId === workspace.id 
                      ? 'bg-blue-100 border border-blue-300' 
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1"
                        onClick={() => {
                          onWorkspaceChange(workspace.id);
                          setIsOpen(false);
                        }}
                      >
                        <div className="font-medium text-gray-900">{workspace.name}</div>
                        {workspace.description && (
                          <div className="text-sm text-gray-500 mt-1">{workspace.description}</div>
                        )}
                      </div>
                      <div className="flex space-x-1 ml-2">
                        <button
                          onClick={() => startEditing(workspace)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Edit workspace"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        {workspace.id !== 1 && (
                          <button
                            onClick={() => handleDeleteWorkspace(workspace.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Delete workspace"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Create New Workspace */}
            {isCreating ? (
              <div className="p-3 border border-green-300 rounded-lg bg-green-50">
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full mb-2 px-2 py-1 border border-gray-300 rounded text-sm"
                  placeholder="Workspace name"
                  autoFocus
                />
                <textarea
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  className="w-full mb-2 px-2 py-1 border border-gray-300 rounded text-sm resize-none"
                  placeholder="Description (optional)"
                  rows={2}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleCreateWorkspace}
                    className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setNewWorkspaceName('');
                      setNewWorkspaceDescription('');
                    }}
                    className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full p-3 text-left text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Create New Workspace</span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default WorkspaceSelector; 