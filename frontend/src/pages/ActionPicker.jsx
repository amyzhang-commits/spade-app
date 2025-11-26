import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'

export default function ActionPicker() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionName = location.state?.sessionName || ''

  const [actionLibrary, setActionLibrary] = useState([])
  const [selectedActions, setSelectedActions] = useState([])
  const [customActions, setCustomActions] = useState([]) // Pre-session custom actions (not saved to library yet)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [customDescription, setCustomDescription] = useState('')
  const [customUserMovement, setCustomUserMovement] = useState(0)
  const [customLlmMovement, setCustomLlmMovement] = useState(0)
  const [addingCustom, setAddingCustom] = useState(false)

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

  const toggleAction = (libraryId) => {
    if (selectedActions.includes(libraryId)) {
      setSelectedActions(selectedActions.filter(id => id !== libraryId))
    } else {
      if (selectedActions.length < 5) {
        setSelectedActions([...selectedActions, libraryId])
      }
    }
  }

  const createCustomAction = (e) => {
    e.preventDefault()
    if (!customDescription.trim()) return

    const totalActions = selectedActions.length + customActions.length
    if (totalActions >= 5) {
      alert('Maximum 5 actions (library + custom combined)')
      return
    }

    // Store custom action locally (not saving to library yet)
    const newCustomAction = {
      action_description: customDescription,
      default_user_movement: parseInt(customUserMovement),
      default_llm_movement: parseInt(customLlmMovement),
      id: Date.now() // Temporary ID for React key
    }

    setCustomActions([...customActions, newCustomAction])

    // Reset form
    setCustomDescription('')
    setCustomUserMovement(0)
    setCustomLlmMovement(0)
  }

  const removeCustomAction = (id) => {
    setCustomActions(customActions.filter(action => action.id !== id))
  }

  const getActionCategory = (action) => {
    const netUser = action.default_user_movement - action.default_llm_movement
    if (netUser > 2) return { label: 'Human Advance', color: 'text-blue-700 bg-blue-100' }
    if (netUser < -2) return { label: 'AI Advance', color: 'text-red-700 bg-red-100' }
    return { label: 'Balanced', color: 'text-gray-700 bg-gray-100' }
  }

  const createSession = async () => {
    const totalActions = selectedActions.length + customActions.length
    if (totalActions < 3) {
      alert('Please select at least 3 actions to track (library + custom combined)')
      return
    }

    setCreating(true)
    try {
      const response = await axios.post('/api/sessions/', {
        session_name: sessionName || null,
        selected_action_ids: selectedActions
      })
      // Pass custom actions via navigation state
      navigate(`/session/${response.data.session_id}`, {
        state: { initialCustomActions: customActions }
      })
    } catch (error) {
      console.error('Failed to create session:', error)
      alert('Failed to create session')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Cancel
          </button>
          <h1 className="text-xl font-bold text-gray-900">Select Actions to Track</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            Pick 3-5 actions for this session
          </h2>
          <p className="text-sm text-blue-800">
            Choose from the library or create custom actions. Select what you'll likely do during this work session.
          </p>
          <p className="text-sm text-blue-700 mt-2">
            Total: {selectedActions.length + customActions.length} / 5
            {selectedActions.length + customActions.length >= 3 && ' ✓'}
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left: Action Library (2/3 width) */}
          <div className="lg:col-span-2">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Action Library</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actionLibrary.map((action) => {
            const isSelected = selectedActions.includes(action.library_id)
            const isDisabled = !isSelected && (selectedActions.length + customActions.length >= 5)
            const category = getActionCategory(action)

            return (
              <button
                key={action.library_id}
                onClick={() => toggleAction(action.library_id)}
                disabled={isDisabled}
                className={`text-left p-4 border-2 rounded-lg transition ${
                  isSelected
                    ? 'border-user-color bg-blue-50'
                    : isDisabled
                    ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-user-color hover:bg-blue-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'bg-user-color border-user-color' : 'border-gray-300'
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
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
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
            </div>

            {/* Custom Actions to Track */}
            {customActions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span>Custom Actions to Track</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">New</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customActions.map((action) => {
                    const category = getActionCategory(action)
                    return (
                      <div
                        key={action.id}
                        className="text-left p-4 border-2 border-purple-200 bg-purple-50 rounded-lg"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
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
                            </div>
                          </div>
                          <button
                            onClick={() => removeCustomAction(action.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Remove"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Create Custom Action (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Create Custom Action</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <form onSubmit={createCustomAction} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What will you do?
                    </label>
                    <textarea
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder="e.g., Asked LLM to write tests"
                      required
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-user-color text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Points
                    </label>
                    <input
                      type="number"
                      value={customUserMovement}
                      onChange={(e) => setCustomUserMovement(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-user-color text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Positive = you gain control
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      LLM Points
                    </label>
                    <input
                      type="number"
                      value={customLlmMovement}
                      onChange={(e) => setCustomLlmMovement(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-user-color text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Positive = LLM gains control
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={selectedActions.length + customActions.length >= 5}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    Add Custom Action
                  </button>
                  {selectedActions.length + customActions.length >= 5 && (
                    <p className="text-xs text-red-600 text-center">
                      Max 5 total actions (library + custom)
                    </p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {selectedActions.length + customActions.length < 3 && `Add at least ${3 - (selectedActions.length + customActions.length)} more action${3 - (selectedActions.length + customActions.length) === 1 ? '' : 's'}`}
              {selectedActions.length + customActions.length >= 3 && "You're all set!"}
            </p>
            <button
              onClick={createSession}
              disabled={selectedActions.length + customActions.length < 3 || creating}
              className="px-8 py-3 bg-user-color text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-user-color disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {creating ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
