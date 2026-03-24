import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Header from './components/Header'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Discover from './pages/Discover'
import Rank from './pages/Rank'
import Rankings from './pages/Rankings'
import Setup from './pages/Setup'

function App() {
  return (
    <AuthProvider>
      <div className="app">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/rank" element={<Rank />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/setup" element={<Setup />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  )
}

export default App
