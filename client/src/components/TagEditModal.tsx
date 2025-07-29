import React, { useState } from 'react';
import { Tag } from '../types';
import { apiService } from '../services/api';
import { X, Plus, Edit3, Trash2, Eye, EyeOff } from 'lucide-react';

interface TagEditModalProps {
  tags: Tag[];
  workspaceId: number;
  onClose: () => void;
  onTagsUpdate: (updatedTags?: Tag[]) => void;
}

const TagEditModal: React.FC<TagEditModalProps> = ({ tags, workspaceId, onClose, onTagsUpdate }) => {
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isTogglingHidden, setIsTogglingHidden] = useState<number | null>(null);

  const handleEditClick = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  };

  const handleSave = async () => {
    if (!editingTagId || !editingTagName.trim()) return;

    const originalTags = tags;
    const updatedTags = tags.map(tag => 
      tag.id === editingTagId 
        ? { ...tag, name: editingTagName.trim() }
        : tag
    );

    // Optimistic update - update local state immediately
    onTagsUpdate(updatedTags);
    setEditingTagId(null);
    setEditingTagName('');

    try {
      setIsUpdating(true);
      await apiService.updateTag(editingTagId, editingTagName.trim());
    } catch (error) {
      console.error('Error updating tag:', error);
      // Revert on error
      onTagsUpdate(originalTags);
      setEditingTagId(editingTagId);
      setEditingTagName(editingTagName);
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

    const tempId = Date.now(); // Temporary ID for optimistic update
    const newTag = {
      id: tempId,
      name: newTagName.trim(),
      workspace_id: workspaceId,
      hidden: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const updatedTags = [...tags, newTag];

    // Optimistic update - update local state immediately
    onTagsUpdate(updatedTags);
    setNewTagName('');

    try {
      setIsCreatingTag(true);
      const createdTag = await apiService.createTag(newTagName.trim(), workspaceId);
      
      // Replace the temporary tag with the real one from the database
      const finalTags = updatedTags.map(tag => 
        tag.id === tempId ? createdTag : tag
      );
      onTagsUpdate(finalTags);
    } catch (error) {
      console.error('Error creating tag:', error);
      // Revert on error
      onTagsUpdate(tags);
      setNewTagName(newTagName);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (!window.confirm(`Are you sure you want to delete the tag "${tag.name}"? This will remove it from all tasks.`)) {
      return;
    }

    const originalTags = tags;
    const updatedTags = tags.filter(t => t.id !== tag.id);

    // Optimistic update - update local state immediately
    onTagsUpdate(updatedTags);
    setIsDeleting(tag.id);

    try {
      await apiService.deleteTag(tag.id);
    } catch (error) {
      console.error('Error deleting tag:', error);
      // Revert on error
      onTagsUpdate(originalTags);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggleHidden = async (tag: Tag) => {
    const originalTags = tags;
    const updatedTags = tags.map(t => 
      t.id === tag.id 
        ? { ...t, hidden: !t.hidden }
        : t
    );

    // Optimistic update - update local state immediately
    onTagsUpdate(updatedTags);
    setIsTogglingHidden(tag.id);

    try {
      await apiService.toggleTagHidden(tag.id);
    } catch (error) {
      console.error('Error toggling tag hidden status:', error);
      // Revert on error
      onTagsUpdate(originalTags);
    } finally {
      setIsTogglingHidden(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

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
                id="new-tag-name"
                name="new-tag-name"
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

          {/* Tags list */}
          {tags.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No tags found
            </div>
          ) : (
            <div className="space-y-2">
              {tags
                .sort((a, b) => {
                  // First sort by hidden status (hidden tags at the end)
                  if (a.hidden !== b.hidden) {
                    return a.hidden ? 1 : -1;
                  }
                  // Then sort alphabetically by name
                  return a.name.localeCompare(b.name);
                })
                .map((tag) => (
                <div
                  key={tag.id}
                  className={`tag-item flex items-center justify-between p-3 rounded-lg border ${
                    tag.hidden === true ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
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
                      <div className={`text-sm font-medium ${tag.hidden === true ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {tag.name}
                        {tag.hidden === true && (
                          <span className="ml-2 text-xs text-gray-400">(hidden)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1">
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
                          disabled={isTogglingHidden === tag.id}
                          className="p-1 text-gray-600 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
                          title={tag.hidden ? "Show tag" : "Hide tag"}
                        >
                          {tag.hidden ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
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
        <div className="flex justify-end p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagEditModal; 