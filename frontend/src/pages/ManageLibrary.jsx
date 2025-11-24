import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function ManageLibrary() {
  const navigate = useNavigate()
  const [actionLibrary, setActionLibrary] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingAction, setEditingAction] = useState(null)
  const [editDescription, setEditDescription] = useState('')
  const [editUserMovement, setEditUserMovement] = useState(0)
  const [editLlmMovement, setEditLlmMovement] = useState(0)
  const [sortBy, setSortBy] = useState('default') // default, user-favoring, llm-favoring

  useEffect(() => {
    fetchActionLibrary()
  }, [])

  const fetchActionLibrary = async () => {
    try {
      const response = await axios.get('/api/actions/library')
      setActionLibrary(response.data)
    } catch (error) {
      console.error('Failed to fetch action library:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteAction = async (libraryId) => {
    if (!confirm('Are you sure you want to delete this action?')) return

    try {
      await axios.delete(`/api/actions/library/${libraryId}`)
      setActionLibrary(actionLibrary.filter(a => a.library_id !== libraryId))
    } catch (error) {
      console.error('Failed to delete action:', error)
      alert('Failed to delete action')
    }
  }

  const startEdit = (action) => {
    setEditingAction(action.library_id)
    setEditDescription(action.action_description)
    setEditUserMovement(action.default_user_movement)
    setEditLlmMovement(action.default_llm_movement)
  }

  const cancelEdit = () => {
    setEditingAction(null)
    setEditDescription('')
    setEditUserMovement(0)
    setEditLlmMovement(0)
  }

  const saveEdit = async (libraryId) => {
    try {
      const response = await axios.patch(`/api/actions/library/${libraryId}`, {
        action_description: editDescription,
        default_user_movement: parseInt(editUserMovement),
        default_llm_movement: parseInt(editLlmMovement)
      })

      setActionLibrary(actionLibrary.map(a =>
        a.library_id === libraryId ? response.data : a
      ))
      cancelEdit()
    } catch (error) {
      console.error('Failed to update action:', error)
      alert('Failed to update action')
    }
  }

  const getSortedActions = () => {
    const sorted = [...actionLibrary]

    if (sortBy === 'user-favoring') {
      // Sort by net benefit to user (higher user points - lower LLM points = better for user)
      return sorted.sort((a, b) => {
        const aNet = a.default_user_movement - a.default_llm_movement
        const bNet = b.default_user_movement - b.default_llm_movement
        return bNet - aNet // Descending
      })
    } else if (sortBy === 'llm-favoring') {
      // Sort by net benefit to LLM
      return sorted.sort((a, b) => {
        const aNet = a.default_llm_movement - a.default_user_movement
        const bNet = b.default_llm_movement - b.default_user_movement
        return bNet - aNet // Descending
      })
    }

    // Default: starter actions first, then user-created sorted by times used
    return sorted.sort((a, b) => {
      if (a.user_created !== b.user_created) {
        return a.user_created ? 1 : -1 // Starter actions first
      }
      return b.times_used - a.times_used // Most used first
    })
  }

  const getActionCategory = (action) => {
    const netUser = action.default_user_movement - action.default_llm_movement
    if (netUser > 2) return { label: 'User Control', color: 'text-blue-700 bg-blue-100' }
    if (netUser < -2) return { label: 'LLM Control', color: 'text-red-700 bg-red-100' }
    return { label: 'Balanced', color: 'text-gray-700 bg-gray-100' }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  const sortedActions = getSortedActions()
  const userActions = sortedActions.filter(a => a.user_created)
  const starterActions = sortedActions.filter(a => !a.user_created)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Manage Action Library</h1>
          <div className="w-32"></div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sort Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('default')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  sortBy === 'default'
                    ? 'bg-user-color text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Default
              </button>
              <button
                onClick={() => setSortBy('user-favoring')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  sortBy === 'user-favoring'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                User Control →
              </button>
              <button
                onClick={() => setSortBy('llm-favoring')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  sortBy === 'llm-favoring'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                LLM Control →
              </button>
            </div>
          </div>
        </div>

        {/* Your Custom Actions */}
        {userActions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Custom Actions ({userActions.length})</h2>
            <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
              {userActions.map((action) => {
                const isEditing = editingAction === action.library_id
                const category = getActionCategory(action)

                return (
                  <div key={action.library_id} className="p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-user-color"
                          rows={2}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Your Points</label>
                            <input
                              type="number"
                              value={editUserMovement}
                              onChange={(e) => setEditUserMovement(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-user-color"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">LLM Points</label>
                            <input
                              type="number"
                              value={editLlmMovement}
                              onChange={(e) => setEditLlmMovement(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-user-color"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(action.library_id)}
                            className="px-4 py-2 bg-user-color text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-sm font-medium text-gray-900">
                              {action.action_description}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${category.color}`}>
                              {category.label}
                            </span>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-600">
                            <span className="text-user-color">
                              You: {action.default_user_movement > 0 ? '+' : ''}{action.default_user_movement}
                            </span>
                            <span className="text-llm-color">
                              LLM: {action.default_llm_movement > 0 ? '+' : ''}{action.default_llm_movement}
                            </span>
                            <span>Used {action.times_used}x</span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => startEdit(action)}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteAction(action.library_id)}
                            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Starter Actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Starter Actions ({starterActions.length})</h2>
          <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
            {starterActions.map((action) => {
              const category = getActionCategory(action)

              return (
                <div key={action.library_id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-medium text-gray-900">
                          {action.action_description}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${category.color}`}>
                          {category.label}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span className="text-user-color">
                          You: {action.default_user_movement > 0 ? '+' : ''}{action.default_user_movement}
                        </span>
                        <span className="text-llm-color">
                          LLM: {action.default_llm_movement > 0 ? '+' : ''}{action.default_llm_movement}
                        </span>
                        <span>Used {action.times_used}x</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
