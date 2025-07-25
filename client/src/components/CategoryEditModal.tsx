import React, { useState } from 'react';
import { Category } from '../types';
import { apiService } from '../services/api';
import { X, Plus, Edit3, Eye, EyeOff, Trash2 } from 'lucide-react';

interface CategoryEditModalProps {
  categories: Category[];
  workspaceId: number;
  onClose: () => void;
  onCategoriesUpdate: () => void;
}

const CategoryEditModal: React.FC<CategoryEditModalProps> = ({ categories, workspaceId, onClose, onCategoriesUpdate }) => {
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isToggling, setIsToggling] = useState<number | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const handleEditClick = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const handleSave = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;

    try {
      setIsUpdating(true);
      await apiService.updateCategory(editingCategoryId, editingCategoryName.trim());
      setEditingCategoryId(null);
      setEditingCategoryName('');
      onCategoriesUpdate();
    } catch (error) {
      console.error('Error updating category:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      setIsCreatingCategory(true);
      await apiService.createCategory(newCategoryName.trim(), workspaceId);
      setNewCategoryName('');
      onCategoriesUpdate();
    } catch (error) {
      console.error('Error creating category:', error);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleToggleHidden = async (category: Category) => {
    try {
      setIsToggling(category.id);
      await apiService.toggleCategoryHidden(category.id);
      onCategoriesUpdate();
    } catch (error) {
      console.error('Error toggling category hidden status:', error);
    } finally {
      setIsToggling(null);
    }
  };

  const handleDelete = async (category: Category) => {
    if (!window.confirm(`Are you sure you want to delete the category "${category.name}"? This will remove it from all tasks.`)) {
      return;
    }

    try {
      setIsDeleting(category.id);
      await apiService.deleteCategory(category.id);
      onCategoriesUpdate();
    } catch (error) {
      console.error('Error deleting category:', error);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Categories</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {/* Create new category section */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                id="new-category-name"
                name="new-category-name"
                placeholder="Enter new category name..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newCategoryName.trim()) {
                    handleCreateCategory();
                  }
                }}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim() || isCreatingCategory}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Categories list */}
          {categories.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No categories found
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className={`category-item flex items-center justify-between p-3 rounded-lg border ${
                    category.hidden === true ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                  }`}
                >
                  {/* Category name */}
                  <div className="flex-1 min-w-0">
                    {editingCategoryId === category.id ? (
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div className={`text-sm font-medium ${category.hidden === true ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {category.name}
                      </div>
                    )}
                    {category.hidden === true && (
                      <div className="text-xs text-gray-400 mt-1">Hidden</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1">
                    {editingCategoryId === category.id ? (
                      <div></div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(category);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit category name"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleHidden(category)}
                          disabled={isToggling === category.id}
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                          title={category.hidden === true ? "Show category" : "Hide category"}
                        >
                          {category.hidden === true ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          disabled={isDeleting === category.id}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete category"
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

export default CategoryEditModal; 