import React, { useState, useEffect } from 'react';
import { Workspace } from '../types';
import { apiService } from '../services/api';
import { ChevronDown, Plus, Edit, Trash2, FolderOpen, Star, Users } from 'lucide-react';

interface WorkspaceSelectorProps {
  selectedWorkspaceId: number | undefined;
  onWorkspaceChange: (workspaceId: number) => void;
  workspaces?: Array<{ id: number; name: string; description?: string; access_level?: 'owner' | 'edit' | 'view'; is_default?: boolean; created_at?: string; updated_at?: string; other_users_count?: number }>;
  refreshWorkspaces?: () => void;
}

const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ 
  selectedWorkspaceId, 
  onWorkspaceChange,
  workspaces: propWorkspaces,
  refreshWorkspaces = () => {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [editWorkspaceDescription, setEditWorkspaceDescription] = useState('');

  // Use prop workspaces if provided, otherwise use empty array
  const workspaces = propWorkspaces || [];

  const selectedWorkspace = selectedWorkspaceId ? workspaces.find(w => w.id === selectedWorkspaceId) : null;

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    
    try {
      const newWorkspace = await apiService.createWorkspace(
        newWorkspaceName.trim(), 
        newWorkspaceDescription.trim() || undefined
      );
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
      setIsCreating(false);
      refreshWorkspaces(); // Refresh workspace list from parent
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
      setEditWorkspaceName('');
      setEditWorkspaceDescription('');
      setIsEditing(null);
      refreshWorkspaces(); // Refresh workspace list from parent
    } catch (error) {
      console.error('Error updating workspace:', error);
    }
  };

  const handleDeleteWorkspace = async (id: number) => {
    const workspace = workspaces.find(w => w.id === id);
    if (!workspace) return;
    
    // Check if user is owner
    if (workspace.access_level !== 'owner') {
      alert('Only owners can delete workspaces');
      return;
    }
    
    if (workspace.is_default) {
      alert('Cannot delete the default workspace');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this workspace? This will also delete all tasks and categories in this workspace.')) {
      return;
    }
    try {
      await apiService.deleteWorkspace(id);
      refreshWorkspaces(); // Refresh workspace list from parent
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
    // Only allow editing if user is owner
    if (workspace.access_level !== 'owner') {
      return;
    }
    setIsEditing(workspace.id);
    setEditWorkspaceName(workspace.name);
    setEditWorkspaceDescription(workspace.description || '');
  };

  const cancelEditing = () => {
    setIsEditing(null);
    setEditWorkspaceName('');
    setEditWorkspaceDescription('');
  };

  const handleSetDefault = async (workspaceId: number) => {
    try {
      const updatedWorkspace = await apiService.setDefaultWorkspace(workspaceId);
      // Refresh workspace list to reflect the new default
      refreshWorkspaces();
    } catch (error) {
      console.error('Error setting default workspace:', error);
    }
  };

  return (
    <div className="relative w-full md:w-64">
      {/* Main Selector */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
      >
        {selectedWorkspace?.other_users_count && selectedWorkspace.other_users_count > 0 ? (
          <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
        ) : (
          <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
        <span className="font-medium text-gray-900 truncate flex-1 mx-2">
          {selectedWorkspace?.name || 'Select Workspace'}
        </span>
        {selectedWorkspace?.is_default && (
          <Star className="w-4 h-4 text-yellow-500 fill-current flex-shrink-0" />
        )}
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
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
                        <div className="font-medium text-gray-900 flex items-center">
                          {workspace.other_users_count && workspace.other_users_count > 0 ? (
                            <Users className="w-3 h-3 text-blue-500 mr-1" />
                          ) : (
                            <FolderOpen className="w-3 h-3 text-gray-500 mr-1" />
                          )}
                          {workspace.name}
                          {workspace.access_level && workspace.access_level !== 'owner' && (
                            <span className="ml-1 text-xs text-gray-500">({workspace.access_level})</span>
                          )}
                        </div>
                        {workspace.description && (
                          <div className="text-sm text-gray-500 mt-1">{workspace.description}</div>
                        )}
                      </div>
                      <div className="flex space-x-1 ml-2">
                        <button
                          onClick={() => startEditing(workspace)}
                          disabled={workspace.access_level !== 'owner'}
                          className={`p-1 ${
                            workspace.access_level === 'owner' 
                              ? 'text-gray-400 hover:text-gray-600' 
                              : 'text-gray-200 cursor-not-allowed'
                          }`}
                          title={workspace.access_level === 'owner' ? 'Edit workspace' : 'Only owners can edit workspace'}
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        {/* Show delete button for all except the default workspace, but disable for non-owners */}
                        {!workspace.is_default && (
                          <button
                            onClick={() => handleDeleteWorkspace(workspace.id)}
                            disabled={workspace.access_level !== 'owner'}
                            className={`p-1 ${
                              workspace.access_level === 'owner' 
                                ? 'text-gray-400 hover:text-red-600' 
                                : 'text-gray-200 cursor-not-allowed'
                            }`}
                            title={workspace.access_level === 'owner' ? 'Delete workspace' : 'Only owners can delete workspace'}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleSetDefault(workspace.id)}
                          className={`p-1 ${workspace.is_default ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                          title={workspace.is_default ? 'Default workspace' : 'Set as default'}
                        >
                          <Star className={`w-3 h-3 ${workspace.is_default ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Create New Workspace */}
            {isCreating ? (
              <div className="p-3 border border-blue-300 rounded-lg bg-blue-50">
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
                    className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
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