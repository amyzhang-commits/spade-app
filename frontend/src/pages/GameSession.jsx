import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import ScoreBars from '../components/ScoreBars'

export default function GameSession() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [actions, setActions] = useState([])
  const [actionLibrary, setActionLibrary] = useState([])
  const [selectedAction, setSelectedAction] = useState(null)
  const [customAction, setCustomAction] = useState('')
  const [customUserMovement, setCustomUserMovement] = useState(0)
  const [customLlmMovement, setCustomLlmMovement] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCustom, setShowCustom] = useState(false)
  const [trackedActions, setTrackedActions] = useState([])
  const [selectedActionIds, setSelectedActionIds] = useState([])
  const [sessionCustomActions, setSessionCustomActions] = useState([])
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [actionsToSave, setActionsToSave] = useState([])

  useEffect(() => {
    fetchSession()
    fetchActionLibrary()
    fetchTrackedActions()
    fetchSelectedActions()
  }, [sessionId])

  const fetchSession = async () => {
    try {
      const response = await axios.get(`/api/sessions/${sessionId}`)
      setSession(response.data)
    } catch (error) {
      console.error('Failed to fetch session:', error)
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const fetchActionLibrary = async () => {
    try {
      const response = await axios.get('/api/actions/library')
      setActionLibrary(response.data)
    } catch (error) {
      console.error('Failed to fetch action library:', error)
    }
  }

  const fetchTrackedActions = async () => {
    try {
      const response = await axios.get(`/api/actions/session/${sessionId}/actions`)
      setTrackedActions(response.data)

      // Extract custom actions (those without library_id) and add to sessionCustomActions
      const customActions = response.data
        .filter(action => !action.library_id && action.action_description)
        .map(action => ({
          action_description: action.action_description,
          default_user_movement: action.user_movement,
          default_llm_movement: action.llm_movement,
          action_id: action.action_id
        }))

      // Remove duplicates by description
      const uniqueCustomActions = customActions.filter((action, index, self) =>
        index === self.findIndex(a => a.action_description === action.action_description)
      )

      setSessionCustomActions(uniqueCustomActions)
    } catch (error) {
      console.error('Failed to fetch tracked actions:', error)
    }
  }

  const fetchSelectedActions = async () => {
    try {
      const response = await axios.get(`/api/sessions/${sessionId}/selected-actions`)
      setSelectedActionIds(response.data)
    } catch (error) {
      console.error('Failed to fetch selected actions:', error)
    }
  }

  const trackAction = async (libraryId = null, description = null, userMov = 0, llmMov = 0, isNewCustom = false) => {
    try {
      const response = await axios.post('/api/actions/track', {
        session_id: parseInt(sessionId),
        library_id: libraryId,
        action_description: description,
        user_movement: userMov,
        llm_movement: llmMov
      })

      // Update local session scores immediately for smooth UX
      setSession(prev => ({
        ...prev,
        user_score: prev.user_score + userMov,
        llm_score: prev.llm_score + llmMov
      }))

      setActions(prev => [response.data, ...prev])

      // Only add to sessionCustomActions if this is a NEW custom action (not reusing an existing one)
      if (isNewCustom && !libraryId && description) {
        const customActionObj = {
          action_description: description,
          default_user_movement: userMov,
          default_llm_movement: llmMov,
          action_id: response.data.action_id
        }
        setSessionCustomActions(prev => [...prev, customActionObj])
      }

      setSelectedAction(null)
      setShowCustom(false)
      setCustomAction('')

      // Refresh tracked actions
      fetchTrackedActions()
    } catch (error) {
      console.error('Failed to track action:', error)
      alert('Failed to track action')
    }
  }

  const handleLibraryAction = (action) => {
    trackAction(
      action.library_id,
      null,
      action.default_user_movement,
      action.default_llm_movement
    )
  }

  const handleCustomQuickAction = (customAction) => {
    // isNewCustom = false because we're reusing an existing custom action
    trackAction(
      null,
      customAction.action_description,
      customAction.default_user_movement,
      customAction.default_llm_movement,
      false  // Not a new custom action, just reusing
    )
  }

  const handleCustomAction = (e) => {
    e.preventDefault()
    if (!customAction.trim()) return

    // isNewCustom = true because this is creating a brand new custom action
    trackAction(
      null,
      customAction,
      parseInt(customUserMovement),
      parseInt(customLlmMovement),
      true  // This IS a new custom action
    )
  }

  const pauseSession = async () => {
    try {
      const response = await axios.post(`/api/sessions/${sessionId}/pause`)
      setSession(response.data)
    } catch (error) {
      console.error('Failed to pause session:', error)
    }
  }

  const resumeSession = async () => {
    try {
      const response = await axios.post(`/api/sessions/${sessionId}/resume`)
      setSession(response.data)
    } catch (error) {
      console.error('Failed to resume session:', error)
    }
  }

  const endSession = () => {
    if (sessionCustomActions.length > 0) {
      // Show dialog to save custom actions
      setShowEndDialog(true)
    } else {
      // No custom actions, just end
      confirmEndSession()
    }
  }

  const confirmEndSession = async () => {
    try {
      // Save selected custom actions to library
      for (const action of actionsToSave) {
        await axios.post('/api/actions/library', {
          action_description: action.action_description,
          default_user_movement: action.default_user_movement,
          default_llm_movement: action.default_llm_movement,
          created_from_session_id: parseInt(sessionId)
        })
      }

      // End the session
      await axios.post(`/api/sessions/${sessionId}/end`)
      navigate('/dashboard')
    } catch (error) {
      console.error('Failed to end session:', error)
      alert('Failed to end session')
    }
  }

  const toggleActionToSave = (action) => {
    if (actionsToSave.some(a => a.action_description === action.action_description)) {
      setActionsToSave(actionsToSave.filter(a => a.action_description !== action.action_description))
    } else {
      setActionsToSave([...actionsToSave, action])
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              {session.session_name || `Session ${session.session_id}`}
            </h1>
            <div className="flex gap-2">
              {session.status === 'active' && (
                <>
                  <button
                    onClick={pauseSession}
                    className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                  >
                    Pause
                  </button>
                  <button
                    onClick={endSession}
                    className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    End Session
                  </button>
                </>
              )}
              {session.status === 'paused' && (
                <button
                  onClick={resumeSession}
                  className="px-4 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  Resume
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Score Bars - Sticky */}
        <div className="sticky top-16 z-20 bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Collaboration Balance</h2>
          <ScoreBars userScore={session.user_score} llmScore={session.llm_score} />
        </div>

        {session.status === 'active' && (
          <>
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Quick Actions</h2>
                <button
                  onClick={() => setShowCustom(!showCustom)}
                  className="text-sm text-user-color hover:text-blue-700 font-medium"
                >
                  {showCustom ? 'Show Library' : 'Custom Action'}
                </button>
              </div>

              {showCustom ? (
                <form onSubmit={handleCustomAction} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Action Description
                    </label>
                    <input
                      type="text"
                      value={customAction}
                      onChange={(e) => setCustomAction(e.target.value)}
                      placeholder="What did you do?"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-user-color"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Points
                      </label>
                      <input
                        type="number"
                        value={customUserMovement}
                        onChange={(e) => setCustomUserMovement(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-user-color"
                      />
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-user-color"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-user-color text-white rounded-md hover:bg-blue-700"
                  >
                    Track Custom Action
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* Library Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {actionLibrary
                      .filter(action => selectedActionIds.length === 0 || selectedActionIds.includes(action.library_id))
                      .filter(action => !action.user_created)  // Exclude user-created actions from this section
                      .map((action) => (
                      <button
                        key={action.library_id}
                        onClick={() => handleLibraryAction(action)}
                        className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-user-color hover:bg-blue-50 transition group"
                      >
                        <p className="text-sm font-medium text-gray-900 group-hover:text-user-color">
                          {action.action_description}
                        </p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-600">
                          <span className="text-user-color">You: {action.default_user_movement > 0 ? '+' : ''}{action.default_user_movement}</span>
                          <span className="text-llm-color">LLM: {action.default_llm_movement > 0 ? '+' : ''}{action.default_llm_movement}</span>
                          <span className="ml-auto">Used {action.times_used}x</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* User-Created Library Actions (from picker) */}
                  {actionLibrary
                    .filter(action => selectedActionIds.length === 0 || selectedActionIds.includes(action.library_id))
                    .filter(action => action.user_created).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <span>Your Custom Actions</span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Library</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {actionLibrary
                          .filter(action => selectedActionIds.length === 0 || selectedActionIds.includes(action.library_id))
                          .filter(action => action.user_created)
                          .map((action) => (
                          <button
                            key={action.library_id}
                            onClick={() => handleLibraryAction(action)}
                            className="text-left p-4 border-2 border-green-200 bg-green-50 rounded-lg hover:border-green-400 hover:bg-green-100 transition group"
                          >
                            <p className="text-sm font-medium text-gray-900 group-hover:text-green-700">
                              {action.action_description}
                            </p>
                            <div className="flex gap-4 mt-2 text-xs text-gray-600">
                              <span className="text-user-color">You: {action.default_user_movement > 0 ? '+' : ''}{action.default_user_movement}</span>
                              <span className="text-llm-color">LLM: {action.default_llm_movement > 0 ? '+' : ''}{action.default_llm_movement}</span>
                              <span className="ml-auto">Used {action.times_used}x</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Session Custom Actions */}
                  {sessionCustomActions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <span>Custom Actions from This Session</span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">New</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sessionCustomActions.map((action, index) => (
                          <button
                            key={`custom-${index}`}
                            onClick={() => handleCustomQuickAction(action)}
                            className="text-left p-4 border-2 border-purple-200 bg-purple-50 rounded-lg hover:border-purple-400 hover:bg-purple-100 transition group"
                          >
                            <p className="text-sm font-medium text-gray-900 group-hover:text-purple-700">
                              {action.action_description}
                            </p>
                            <div className="flex gap-4 mt-2 text-xs text-gray-600">
                              <span className="text-user-color">You: {action.default_user_movement > 0 ? '+' : ''}{action.default_user_movement}</span>
                              <span className="text-llm-color">LLM: {action.default_llm_movement > 0 ? '+' : ''}{action.default_llm_movement}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {session.status === 'paused' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8 text-center">
            <p className="text-yellow-800">Session is paused. Resume to continue tracking.</p>
          </div>
        )}

        {session.status === 'ended' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8 text-center">
            <p className="text-gray-800">This session has ended.</p>
          </div>
        )}

        {/* Session History */}
        {trackedActions.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Session History</h2>
            <div className="space-y-3">
              {trackedActions.map((action, index) => {
                // Find the library action for description if library_id exists
                const libraryAction = action.library_id
                  ? actionLibrary.find(a => a.library_id === action.library_id)
                  : null
                const description = libraryAction?.action_description || action.action_description || 'Custom action'

                return (
                  <div key={action.action_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500">#{trackedActions.length - index}</span>
                      <span className="text-sm text-gray-900">{description}</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className={`font-medium ${action.user_movement > 0 ? 'text-user-color' : action.user_movement < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        You: {action.user_movement > 0 ? '+' : ''}{action.user_movement}
                      </span>
                      <span className={`font-medium ${action.llm_movement > 0 ? 'text-llm-color' : action.llm_movement < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        LLM: {action.llm_movement > 0 ? '+' : ''}{action.llm_movement}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* End Session Dialog */}
      {showEndDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Save Custom Actions?</h2>
              <p className="text-sm text-gray-600 mb-6">
                You created {sessionCustomActions.length} custom action{sessionCustomActions.length === 1 ? '' : 's'} during this session.
                Would you like to save any to your action library for future sessions?
              </p>

              <div className="space-y-3 mb-6">
                {sessionCustomActions.map((action, index) => {
                  const isSelected = actionsToSave.some(a => a.action_description === action.action_description)
                  return (
                    <button
                      key={index}
                      onClick={() => toggleActionToSave(action)}
                      className={`w-full text-left p-4 border-2 rounded-lg transition ${
                        isSelected
                          ? 'border-purple-400 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {action.action_description}
                          </p>
                          <div className="flex gap-4 mt-1 text-xs text-gray-600">
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

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setActionsToSave([])
                    confirmEndSession()
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
                >
                  Skip & End Session
                </button>
                <button
                  onClick={() => {
                    confirmEndSession()
                  }}
                  className="px-6 py-2 bg-user-color text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  {actionsToSave.length > 0 ? `Save ${actionsToSave.length} & End Session` : 'End Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
