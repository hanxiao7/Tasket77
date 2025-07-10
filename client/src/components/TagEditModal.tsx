import React, { useState, useEffect } from 'react';
import { Tag } from '../types';
import { apiService } from '../services/api';
import { X, Edit3, Eye, EyeOff, Trash2, Plus } from 'lucide-react';

interface TagEditModalProps {
  tags: Tag[];
  workspaceId: number;
  onClose: () => void;
  onTagsUpdate: () => void;
}

const TagEditModal: React.FC<TagEditModalProps> = ({ tags, workspaceId, onClose, onTagsUpdate }) => {
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isToggling, setIsToggling] = useState<number | null>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  const handleEditClick = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  };

  const handleSave = async () => {
    if (!editingTagId || !editingTagName.trim()) return;

    try {
      setIsUpdating(true);
      await apiService.updateTag(editingTagId, editingTagName.trim());
      setEditingTagId(null);
      setEditingTagName('');
      onTagsUpdate();
    } catch (error) {
      console.error('Error updating tag:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditingTagId(null);
    setEditingTagName('');
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      setIsCreatingTag(true);
      await apiService.createTag(newTagName.trim(), workspaceId);
      setNewTagName('');
      onTagsUpdate();
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleToggleHidden = async (tag: Tag) => {
    try {
      setIsToggling(tag.id);
      await apiService.toggleTagHidden(tag.id);
      onTagsUpdate();
    } catch (error) {
      console.error('Error toggling tag hidden status:', error);
    } finally {
      setIsToggling(null);
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (!window.confirm(`Are you sure you want to delete the tag "${tag.name}"? This will remove it from all tasks.`)) {
      return;
    }

    try {
      setIsDeleting(tag.id);
      await apiService.deleteTag(tag.id);
      onTagsUpdate();
    } catch (error) {
      console.error('Error deleting tag:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if ((e.target as Element).classList.contains('modal-overlay')) {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  // Save tag when clicking outside the edited tag
  useEffect(() => {
    const handleClickOutsideTag = (e: MouseEvent) => {
      if (editingTagId !== null) {
        const target = e.target as Element;
        const inputElement = document.querySelector('.tag-item input');
        if (inputElement && !inputElement.contains(target)) {
          handleSave();
        }
      }
    };

    document.addEventListener('click', handleClickOutsideTag);
    return () => {
      document.removeEventListener('click', handleClickOutsideTag);
    };
  }, [editingTagId, editingTagName]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Tags</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {/* Create new tag section */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Enter new tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newTagName.trim()) {
                    handleCreateTag();
                  }
                }}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || isCreatingTag}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {tags.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No tags found
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className={`tag-item flex items-center justify-between p-3 rounded-lg border ${
                    tag.hidden === 1 ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                  }`}
                >
                  {/* Tag name */}
                  <div className="flex-1 min-w-0">
                    {editingTagId === tag.id ? (
                      <input
                        type="text"
                        value={editingTagName}
                        onChange={(e) => setEditingTagName(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div className={`text-sm font-medium ${tag.hidden === 1 ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {tag.name}
                      </div>
                    )}
                    {tag.hidden === 1 && (
                      <div className="text-xs text-gray-400 mt-1">Hidden</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 ml-3">
                    {editingTagId === tag.id ? (
                      <div></div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(tag);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit tag name"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleHidden(tag)}
                          disabled={isToggling === tag.id}
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                          title={tag.hidden === 1 ? "Show tag" : "Hide tag"}
                        >
                          {tag.hidden === 1 ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(tag)}
                          disabled={isDeleting === tag.id}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete tag"
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

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {tags.filter(t => t.hidden !== 1).length} visible, {tags.filter(t => t.hidden === 1).length} hidden
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagEditModal; 