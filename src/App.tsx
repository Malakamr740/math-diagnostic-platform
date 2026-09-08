import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import QuestionBankPage from './pages/QuestionBankPage'
import CreateQuestionPage from './pages/CreateQuestionPage'
import AssessmentsPage from './pages/AssessmentsPage'
import CreateAssessmentPage from './pages/CreateAssessmentPage'
import AssessmentDetailPage from './pages/AssessmentDetailPage'
import EditQuestionPage from './pages/EditQuestionPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/questions/:questionId/edit"
            element={
              <ProtectedRoute>
                <EditQuestionPage />
              </ProtectedRoute>
            }
          />
                    <Route
            path="/admin/questions"
            element={
              <ProtectedRoute>
                <QuestionBankPage />
              </ProtectedRoute>
            }
          />

          {/* Default: redirect root to /admin (ProtectedRoute will bounce to /login if not signed in) */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          {/* Catch-all for unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />

          <Route
            path="/admin/questions/new"
            element={
              <ProtectedRoute>
                <CreateQuestionPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/assessments"
            element={
              <ProtectedRoute>
                <AssessmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assessments/new"
            element={
              <ProtectedRoute>
                <CreateAssessmentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assessments/:assessmentId"
            element={
              <ProtectedRoute>
                <AssessmentDetailPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App