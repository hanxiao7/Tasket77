import React, { useState, useEffect } from 'react';
import { X, Plus, Edit3, Trash2, Crown, Users, Eye, EyeOff, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Workspace {
  id: number;
  name: string;
  access_level?: 'owner' | 'edit' | 'view';
}

interface Permission {
  id: number;
  email: string;
  user_name: string | null;
  user_id: number | null;
  access_level: 'owner' | 'edit' | 'view';
  status: 'active' | 'pending';
  created_at: string;
}

interface ManageAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWorkspaceId: number;
  workspaces: Workspace[];
  onWorkspaceChange: (workspaceId: number) => void;
  refreshWorkspaces?: () => void;
}

const ManageAccessModal: React.FC<ManageAccessModalProps> = ({
  isOpen,
  onClose,
  selectedWorkspaceId,
  workspaces,
  onWorkspaceChange,
  refreshWorkspaces = () => {}
}) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newAccessLevel, setNewAccessLevel] = useState<'edit' | 'view'>('edit');
  const [currentUserAccess, setCurrentUserAccess] = useState<'owner' | 'edit' | 'view' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);

  useEffect(() => {
    if (isOpen && selectedWorkspaceId) {
      fetchPermissions();
    }
  }, [isOpen, selectedWorkspaceId]);

  // Clear success message when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSuccess(null);
      setError(null);
    }
  }, [isOpen]);

  const fetchPermissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:3001/api/workspaces/${selectedWorkspaceId}/permissions`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }
      
      const data = await response.json();
      setPermissions(data);
      
      // Find current user's access level by matching user ID
      const currentUser = data.find((p: Permission) => p.user_id === user?.id);
      setCurrentUserAccess(currentUser?.access_level || null);
    } catch (err) {
      setError('Failed to load permissions');
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newEmail.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`http://localhost:3001/api/workspaces/${selectedWorkspaceId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email: newEmail.trim(),
          access_level: newAccessLevel
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add user');
      }

      setSuccess(data.message);
      setNewEmail('');
      setNewAccessLevel('edit');
      fetchPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccessLevel = async (permissionId: number, newLevel: 'owner' | 'edit' | 'view') => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`http://localhost:3001/api/workspaces/${selectedWorkspaceId}/permissions/${permissionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          access_level: newLevel
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update access level');
      }

      setSuccess('Access level updated successfully');
      fetchPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update access level');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (permissionId: number) => {
    if (!window.confirm('Are you sure you want to remove this user?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`http://localhost:3001/api/workspaces/${selectedWorkspaceId}/permissions/${permissionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove user');
      }

      setSuccess('User removed successfully');
      fetchPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferOwnership = async (permissionId: number) => {
    if (!window.confirm('Are you sure you want to transfer ownership? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`http://localhost:3001/api/workspaces/${selectedWorkspaceId}/permissions/${permissionId}/transfer-ownership`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to transfer ownership');
      }

      setSuccess('Ownership transferred successfully');
      fetchPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer ownership');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!window.confirm('Are you sure you want to leave this workspace?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`http://localhost:3001/api/workspaces/${selectedWorkspaceId}/leave`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to leave workspace');
      }

      setSuccess('Left workspace successfully');
      refreshWorkspaces(); // Refresh workspace list after leaving
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave workspace');
    } finally {
      setLoading(false);
    }
  };

  const getAccessLevelIcon = (level: 'owner' | 'edit' | 'view') => {
    switch (level) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'edit':
        return <Edit3 className="w-4 h-4 text-blue-500" />;
      case 'view':
        return <Eye className="w-4 h-4 text-gray-500" />;
    }
  };

  const getAccessLevelLabel = (level: 'owner' | 'edit' | 'view') => {
    switch (level) {
      case 'owner':
        return 'Owner';
      case 'edit':
        return 'Edit';
      case 'view':
        return 'View';
    }
  };

  const isOwner = currentUserAccess === 'owner';
  
  // Helper function to check if a permission belongs to the current user
  const isCurrentUser = (permission: Permission) => permission.user_id === user?.id;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Manage Access</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Workspace Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workspace
            </label>
            <select
              value={selectedWorkspaceId}
              onChange={(e) => onWorkspaceChange(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} {workspace.access_level && `(${getAccessLevelLabel(workspace.access_level)})`}
                </option>
              ))}
            </select>
          </div>

          {/* Current User Access */}
          {currentUserAccess && (
            <div className="mb-6 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center">
                <span className="text-sm text-gray-600">Your access: </span>
                <div className="flex items-center ml-2">
                  {getAccessLevelIcon(currentUserAccess)}
                  <span className="ml-1 text-sm font-medium">{getAccessLevelLabel(currentUserAccess)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          {/* Add User Form */}
          {isOwner && (
            <div className="mb-6 p-4 border border-gray-200 rounded-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add User</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Level
                  </label>
                  <select
                    value={newAccessLevel}
                    onChange={(e) => setNewAccessLevel(e.target.value as 'edit' | 'view')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="edit">Edit</option>
                    <option value="view">View</option>
                  </select>
                </div>
                <button
                  onClick={handleAddUser}
                  disabled={loading || !newEmail.trim()}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </div>
          )}

          {/* Users List */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Users</h3>
            {loading && permissions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : permissions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500">No users found</div>
              </div>
            ) : (
              <div className="space-y-3">
                {permissions
                  .sort((a, b) => {
                    // Owner first
                    if (a.access_level === 'owner' && b.access_level !== 'owner') return -1;
                    if (a.access_level !== 'owner' && b.access_level === 'owner') return 1;
                    // Then sort by user name (or email if no name)
                    const aName = a.user_name || a.email;
                    const bName = b.user_name || b.email;
                    return aName.localeCompare(bName);
                  })
                  .map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-md"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center">
                        {getAccessLevelIcon(permission.access_level)}
                        <span className="ml-2 text-sm font-medium">
                          {permission.user_name || permission.email}
                        </span>
                        {permission.status === 'pending' && (
                          <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                            Pending
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{permission.email}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* Access Level Selector */}
                      {isOwner && permission.access_level !== 'owner' && (
                        <select
                          value={permission.access_level}
                          onChange={(e) => handleUpdateAccessLevel(permission.id, e.target.value as 'edit' | 'view')}
                          disabled={loading}
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="edit">Edit</option>
                          <option value="view">View</option>
                        </select>
                      )}
                      
                      {/* Transfer Ownership */}
                      {isOwner && permission.access_level !== 'owner' && permission.status === 'active' && (
                        <button
                          onClick={() => handleTransferOwnership(permission.id)}
                          disabled={loading}
                          className="p-1 text-gray-400 hover:text-yellow-600 disabled:opacity-50"
                          title="Transfer ownership"
                        >
                          <Crown className="w-4 h-4" />
                        </button>
                      )}
                      
                      {/* Remove User */}
                      {isOwner && permission.access_level !== 'owner' && !isCurrentUser(permission) && (
                        <button
                          onClick={() => handleRemoveUser(permission.id)}
                          disabled={loading}
                          className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                          title="Remove user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      
                      {/* Show disabled buttons for non-owners */}
                      {!isOwner && (
                        <>
                          <select
                            disabled
                            className="px-2 py-1 text-sm border border-gray-300 rounded opacity-50 cursor-not-allowed"
                          >
                            <option>{getAccessLevelLabel(permission.access_level)}</option>
                          </select>
                          <button
                            disabled
                            className="p-1 text-gray-300 cursor-not-allowed"
                            title="Transfer ownership (owner only)"
                          >
                            <Crown className="w-4 h-4" />
                          </button>
                          <button
                            disabled
                            className="p-1 text-gray-300 cursor-not-allowed"
                            title="Remove user (owner only)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leave Workspace Button */}
          {!isOwner && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleLeaveWorkspace}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave Workspace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageAccessModal; 