import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, onDisconnect, set } from 'firebase/database'
import { auth, rtdb } from './lib/firebase'
import { api } from './lib/api'
import { useAuthStore } from './store/auth-store'
import Navbar from './components/Navbar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ScrollToTop } from './components/ScrollToTop'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { CheckEmail } from './pages/CheckEmail'
import { VerifyEmail } from './pages/VerifyEmail'
import { CompleteProfile } from './pages/CompleteProfile'
import { Settings } from './pages/Settings'
import { Dashboard } from './pages/Dashboard'
import { Player } from './pages/Player'
import { About } from './pages/About'
import { Policy } from './pages/Policy'
import { Terms } from './pages/Terms'
import { Contact } from './pages/Contact'
import { Jobs } from './pages/Jobs'
import { News } from './pages/News'
import { NewsDetail } from './pages/NewsDetail'
import { Forum } from './pages/Forum'
import { ForumDetail } from './pages/ForumDetail'
import { Clubs } from './pages/Clubs'
import { ClubDetail } from './pages/ClubDetail'
import { Locations } from './pages/Locations'
import { DistrictDetail } from './pages/DistrictDetail'
import { Watch } from './pages/Watch'
import { Leaderboard } from './pages/Leaderboard'
import { Showcase } from './pages/Showcase'
import { Events } from './pages/Events'
import { EventDetail } from './pages/EventDetail'
import { SearchResults } from './pages/SearchResults'
import { Learn } from './pages/Learn'
import { LearnCategory } from './pages/learn/LearnCategory'
import { Analysis } from './pages/Analysis'
import { Engine } from './pages/Engine'
import { Test } from './pages/Test'
import { Bots } from './pages/Bots'
import { BotGame } from './pages/BotGame'
import { VideoTutorials } from './pages/learn/VideoTutorials'
import { Puzzles } from './pages/Puzzles'
import { InteractiveLessons } from './pages/learn/InteractiveLessons'
import { RecommendedBooks } from './pages/learn/RecommendedBooks'
import { PracticeGames } from './pages/learn/PracticeGames'
import { NotFound } from './pages/NotFound'
import { ToastContainer } from './components/ui/Toast'
import { Footer } from './components/Footer'
import './App.css'

function App() {
  const location = useLocation()
  const isFullHeightPage = location.pathname === '/analysis' || location.pathname === '/engine' || location.pathname === '/test' || location.pathname === '/puzzles' || location.pathname.startsWith('/bots/')
  const { setUser, setLoading } = useAuthStore()

  // Trigger backend endpoint on app load
  useEffect(() => {
    // Trigger backend endpoint on app load
    // Use AbortController with timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    fetch('https://chessbd.pythonanywhere.com/trigger', {
      method: 'GET',
      credentials: 'omit',
      signal: controller.signal
    })
      .then(() => {
        clearTimeout(timeoutId)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        // Silently fail - this is just a trigger for the backend
        // Only log if it's not a network error (which is expected when offline)
        if (error.name !== 'AbortError' && error.name !== 'TypeError') {
          console.debug('Trigger endpoint call failed:', error)
        }
      })
  }, [])

  useEffect(() => {
    // Initialize auth state and set up presence tracking
    if (!auth) {
      setLoading(false)
      return
    }

    let presenceCleanup = null
    let presenceSet = false

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous presence tracking
      if (presenceCleanup) {
        presenceCleanup()
        presenceCleanup = null
        presenceSet = false
      }

      if (firebaseUser) {
        // Set up presence tracking for logged-in users
        if (rtdb && !presenceSet) {
          const userId = firebaseUser.uid
          const presenceRef = ref(rtdb, `presence/${userId}`)

          // Set presence when user is online (no timestamp to avoid continuous updates)
          set(presenceRef, {
            online: true,
          }).then(() => {
            presenceSet = true
          }).catch((error) => {
            console.error('[App] Error setting presence:', error)
          })

          // Set up automatic cleanup on disconnect
          const disconnectRef = onDisconnect(presenceRef)
          disconnectRef.remove().catch((error) => {
            console.error('[App] Error setting up onDisconnect:', error)
          })

          // Set up cleanup function
          presenceCleanup = () => {
            if (presenceSet) {
              set(presenceRef, null).catch(() => {
                // Ignore errors during cleanup
              })
              presenceSet = false
            }
          }
        }

        // Initialize user profile
        try {
          // CRITICAL: Always check by email FIRST to prevent duplicate profiles
          // This ensures we find existing email/password accounts even when
          // Firebase Auth creates a new UID for Google sign-in
          let user = null
          
          if (firebaseUser.email) {
            try {
              const existingUserByEmail = await api.getUserByEmail(firebaseUser.email)
              if (existingUserByEmail) {
                // Found existing profile by email - use it (account merging)
                // IMPORTANT: Do NOT create a new profile under the Google UID
                user = existingUserByEmail
              }
            } catch (error) {
              console.error('[App] Error checking for existing user by email:', error)
            }
          }
          
          // If no existing user found by email, check by UID
          if (!user) {
            user = await api.getUser(firebaseUser.uid)
          }
          
          if (user) {
            // Use existing profile (either found by email or by UID)
            setUser(user)
          } else {
            // No existing profile found by email OR by UID - safe to create a new one
            // This should only happen for truly new users
            const newUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || null,
              location: null,
              chesscom_username: null,
              verified_at: null,
              email_verified_at: firebaseUser.emailVerified ? new Date().toISOString() : null,
              is_admin: false,
              profile_completed: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
            await api.updateUser(firebaseUser.uid, newUser)
            setUser(newUser)
          }
        } catch (error) {
          console.error('[App] Error initializing auth state:', error)
          setUser(null)
        } finally {
          setLoading(false)
        }
      } else {
        // User is signed out
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      unsubscribe()
      if (presenceCleanup) {
        presenceCleanup()
      }
    }
  }, [setUser, setLoading, rtdb])

  return (
    <div className="app-wrapper">
      <ScrollToTop />
      <Navbar />
      <main className={isFullHeightPage ? "main-content main-content-no-padding" : "main-content"}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:slug" element={<NewsDetail />} />
          <Route path="/forum" element={<Forum />} />
          <Route path="/forum/:id" element={<ForumDetail />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/clubs/:slug" element={<ClubDetail />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/locations/:district_name" element={<DistrictDetail />} />
          <Route path="/watch" element={<Watch />} />
          <Route path="/puzzles" element={<Puzzles />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/learn/tutorials" element={<VideoTutorials />} />
          <Route path="/learn/lessons" element={<InteractiveLessons />} />
          <Route path="/learn/books" element={<RecommendedBooks />} />
          <Route path="/learn/practice" element={<PracticeGames />} />
          <Route path="/learn/:category" element={<LearnCategory />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/engine" element={<Engine />} />
          <Route path="/test" element={<Test />} />
          <Route path="/bots" element={<Bots />} />
          <Route path="/bots/:botId" element={<BotGame />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/showcase" element={<Showcase />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/player/:username" element={<Player />} />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isFullHeightPage && <Footer />}
      <ToastContainer />
    </div>
  )
}

export default App
