import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Header.css'

const Header = () => {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <span className="logo-icon">&#127909;</span>
          <span className="logo-text">Weekend Watchlist</span>
        </Link>

        <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
          <Link
            to="/"
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            Home
          </Link>
          <Link
            to="/discover"
            className={`nav-link ${isActive('/discover') ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            Discover
          </Link>
          {user && (
            <>
              <Link
                to="/rank"
                className={`nav-link ${isActive('/rank') || isActive('/rankings') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Rank
              </Link>
              <Link
                to="/profile"
                className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                My List
              </Link>
            </>
          )}
        </nav>

        <div className="header-actions">
          {user ? (
            <div className="user-menu">
              <button
                className="user-button"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <span className="user-avatar">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </button>
              {menuOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <span className="dropdown-email">{user.email}</span>
                  </div>
                  <Link
                    to="/profile"
                    className="dropdown-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    My Profile
                  </Link>
                  <button
                    className="dropdown-item dropdown-signout"
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary">
              Sign In
            </Link>
          )}

          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`hamburger ${menuOpen ? 'open' : ''}`}></span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
