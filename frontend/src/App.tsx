import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AdminLayout, StudentLayout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { AdminDashboard } from './pages/admin/Dashboard'
import { ChildrenPage } from './pages/admin/ChildrenPage'
import { PlansPage } from './pages/admin/PlansPage'
import { WordsPage } from './pages/admin/WordsPage'
import { AIPage } from './pages/admin/AIPage'
import { ChildSelectPage } from './pages/student/ChildSelectPage'
import { StudentHomePage } from './pages/student/StudentHomePage'
import { MeaningModule } from './pages/student/MeaningModule'
import { SpellingModule } from './pages/student/SpellingModule'
import { PronunciationModule } from './pages/student/PronunciationModule'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center">加载中...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="children" element={<ChildrenPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="words" element={<WordsPage />} />
        <Route path="ai" element={<AIPage />} />
      </Route>

      <Route path="/learn" element={<StudentLayout />}>
        <Route index element={<ChildSelectPage />} />
        <Route path=":childId" element={<ProtectedRoute><StudentHomePage /></ProtectedRoute>} />
        <Route path=":childId/meaning" element={<ProtectedRoute><MeaningModule /></ProtectedRoute>} />
        <Route path=":childId/spelling" element={<ProtectedRoute><SpellingModule /></ProtectedRoute>} />
        <Route path=":childId/pronunciation" element={<ProtectedRoute><PronunciationModule /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/learn" replace />} />
    </Routes>
  )
}
