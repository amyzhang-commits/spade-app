import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await axios.get('/api/sessions/')
      setSessions(response.data)
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const createSession = async (e) => {
    e.preventDefault()
    // Navigate to action picker instead of creating session directly
    navigate('/action-picker', { state: { sessionName } })
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'ended': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Spade App</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/manage-library')}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Manage Library
            </button>
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create Session Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Start New Session</h2>
          <form onSubmit={createSession} className="flex gap-4">
            <input
              type="text"
              placeholder="Session name (optional)"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-user-color focus:border-transparent"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2 bg-user-color text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-user-color disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Start Session'}
            </button>
          </form>
        </div>

        {/* Sessions List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Your Sessions</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-500">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No sessions yet. Start your first one above!
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.session_id}
                  onClick={() => navigate(`/session/${session.session_id}`)}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {session.session_name || `Session ${session.session_id}`}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Started {formatDate(session.start_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-user-color">
                          You: {session.user_score}
                        </div>
                        <div className="text-sm font-medium text-llm-color">
                          LLM: {session.llm_score}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
