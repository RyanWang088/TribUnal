import { Navigate, Route, Routes } from 'react-router-dom'
import { useCase } from './context/CaseContext.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Intake from './pages/Intake.jsx'
import MasterDashboard from './pages/MasterDashboard.jsx'
import CaseDashboard from './pages/CaseDashboard.jsx'

function RequireAuth({ children }) {
  const { user } = useCase()
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/intake"
        element={
          <RequireAuth>
            <Intake />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <MasterDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/case/:caseId"
        element={
          <RequireAuth>
            <CaseDashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
