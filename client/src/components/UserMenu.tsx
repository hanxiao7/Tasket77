import React, { useState, useRef, useEffect } from 'react';
import { Menu, User, Settings, LogOut, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ManageAccessModal from './ManageAccessModal';

interface UserMenuProps {
  className?: string;
  selectedWorkspaceId?: number;
  workspaces?: Array<{ id: number; name: string; access_level?: 'owner' | 'edit' | 'view'; other_users_count?: number }>;
  onWorkspaceChange?: (workspaceId: number) => void;
  refreshWorkspaces?: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ 
  className = '', 
  selectedWorkspaceId = 1, 
  workspaces = [], 
  onWorkspaceChange = () => {},
  refreshWorkspaces = () => {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isManageAccessOpen, setIsManageAccessOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const handleProfile = () => {
    setIsOpen(false);
    // TODO: Implement profile functionality

  };

  const handleSettings = () => {
    setIsOpen(false);
    // TODO: Implement settings functionality

  };

  const handleManageAccess = () => {
    setIsOpen(false);
    setIsManageAccessOpen(true);
  };

  if (!user) return null;

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md border border-gray-300 transition-colors"
        title="User menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
          {/* User Info */}
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            {/* <p className="text-xs text-gray-500">{user.email}</p> */}
          </div>

          {/* Menu Items */}
          <button
            onClick={handleProfile}
            className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <User className="w-4 h-4 mr-3 text-gray-500" />
            Profile
          </button>

          <button
            onClick={handleSettings}
            className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4 mr-3 text-gray-500" />
            Settings
          </button>

          <button
            onClick={handleManageAccess}
            className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Users className="w-4 h-4 mr-3 text-gray-500" />
            Manage Access
          </button>

          {/* Divider */}
          <div className="border-t border-gray-100 my-1"></div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Logout
          </button>
        </div>
      )}

      {/* Manage Access Modal */}
      <ManageAccessModal
        isOpen={isManageAccessOpen}
        onClose={() => setIsManageAccessOpen(false)}
        selectedWorkspaceId={selectedWorkspaceId}
        workspaces={workspaces}
        onWorkspaceChange={onWorkspaceChange}
        refreshWorkspaces={refreshWorkspaces}
      />
    </div>
  );
};

export default UserMenu; 