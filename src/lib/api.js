import { db, isDemoMode, rtdb } from './firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore'
import { ref, get } from 'firebase/database'

const DB_PATHS = {
  users: 'users',
  emailVerifications: 'email_verifications',
  verificationChallenges: 'verification_challenges',
  events: 'events',
  news: 'news',
  partners: 'partners',
  forumPosts: 'forum_posts',
  forumReplies: 'forum_replies',
  manualStreams: 'manual_streams',
}

// Helper function to convert Firestore timestamp to ISO string
function convertTimestamp(timestamp) {
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return timestamp.toDate().toISOString()
  }
  return timestamp
}

// Helper function to parse Chess.com timestamp
function parseChesscomTimestamp(timestamp) {
  if (!timestamp) return null
  
  // If it's a number, it's a Unix timestamp
  if (typeof timestamp === 'number') {
    // Chess.com uses seconds, so multiply by 1000 to get milliseconds
    // But check if it's already in milliseconds (unlikely to be > year 2000 in seconds)
    const year2000Timestamp = 946684800 // Jan 1, 2000 in seconds
    if (timestamp < year2000Timestamp) {
      // Already in milliseconds (very unlikely for Chess.com)
      return new Date(timestamp).toISOString()
    } else {
      // In seconds, convert to milliseconds
      return new Date(timestamp * 1000).toISOString()
    }
  } else if (typeof timestamp === 'string') {
    // Check if it's a Unix timestamp string
    const numTimestamp = parseInt(timestamp, 10)
    if (!isNaN(numTimestamp)) {
      const year2000Timestamp = 946684800
      if (numTimestamp < year2000Timestamp) {
        return new Date(numTimestamp).toISOString()
      } else {
        return new Date(numTimestamp * 1000).toISOString()
      }
    } else {
      // ISO string or other format, use as-is
      return timestamp
    }
  }
  
  return null
}

// Helper function to parse Lichess date from PGN
function parseLichessDate(pgn) {
  if (!pgn) return null
  
  try {
    // Extract UTCDate and UTCTime from PGN headers
    // Format: [UTCDate "2025.11.04"] and [UTCTime "14:52:41"]
    const utcDateMatch = pgn.match(/\[UTCDate\s+"([^"]+)"\]/)
    const utcTimeMatch = pgn.match(/\[UTCTime\s+"([^"]+)"\]/)
    
    if (utcDateMatch && utcTimeMatch) {
      const dateStr = utcDateMatch[1] // "2025.11.04"
      const timeStr = utcTimeMatch[1] // "14:52:41"
      
      // Convert Lichess date format (YYYY.MM.DD) to ISO format
      // Replace dots with hyphens: "2025.11.04" -> "2025-11-04"
      const isoDateStr = dateStr.replace(/\./g, '-')
      
      // Combine date and time: "2025-11-04T14:52:41Z"
      const isoString = `${isoDateStr}T${timeStr}Z`
      
      // Parse and return ISO string
      const date = new Date(isoString)
      if (!isNaN(date.getTime())) {
        return date.toISOString()
      }
    }
    
    // Fallback: try Date header (format: [Date "2025.11.04"])
    const dateMatch = pgn.match(/\[Date\s+"([^"]+)"\]/)
    if (dateMatch) {
      const dateStr = dateMatch[1] // "2025.11.04"
      const isoDateStr = dateStr.replace(/\./g, '-')
      const date = new Date(isoDateStr)
      if (!isNaN(date.getTime())) {
        return date.toISOString()
      }
    }
  } catch (error) {
    console.warn('[parseLichessDate] Error parsing date from PGN:', error)
  }
  
  return null
}

// Helper function to convert Firestore document to plain object
function docToData(docSnapshot) {
  const data = docSnapshot.data()
  const convert = (obj) => {
    if (obj === null || obj === undefined) return obj
    if (typeof obj === 'object' && 'toDate' in obj) {
      return convertTimestamp(obj)
    }
    if (Array.isArray(obj)) {
      return obj.map(convert)
    }
    if (typeof obj === 'object') {
      const converted = {}
      for (const key in obj) {
        converted[key] = convert(obj[key])
      }
      return converted
    }
    return obj
  }
  return { id: docSnapshot.id, ...convert(data) }
}

// Helper function to get a single document from Firestore
async function getData(collectionName, docId) {
  if (!db) throw new Error('Firebase not configured')
  const docRef = doc(db, collectionName, docId)
  const snapshot = await getDoc(docRef)
  return snapshot.exists() ? docToData(snapshot) : null
}

// Helper function to get list of data from Firestore
async function getList(collectionName, orderByField) {
  if (!db) throw new Error('Firebase not configured')
  
  try {
    let dbQuery = collection(db, collectionName)
    
    if (orderByField) {
      dbQuery = query(dbQuery, orderBy(orderByField))
    }
    
    const snapshot = await getDocs(dbQuery)
    
    if (snapshot.empty) {
      return []
    }
    
    return snapshot.docs.map((doc) => docToData(doc))
  } catch (error) {
    // Don't log permission errors for verification_challenges - they're expected if rules don't allow reading
    if (collectionName === 'verification_challenges' && (error?.code === 'permission-denied' || error?.message?.includes('permission'))) {
      // Return empty array instead of throwing - the calling code can handle this
      return []
    }
    console.error(`[getList] Error fetching from ${collectionName}:`, error)
    throw error
  }
}

export const api = {
  async getUser(userId) {
    if (isDemoMode) {
      return null
    }

    if (!db) throw new Error('Firebase not configured')

    return await getData(DB_PATHS.users, userId)
  },

  async getPlayer(username) {
    if (isDemoMode) {
      return null
    }

    if (!db) {
      return null
    }

    try {
      const users = await getList(DB_PATHS.users)
      return users.find(
        (u) => u.chesscom_username?.toLowerCase() === username.toLowerCase() ||
               u.lichess_username?.toLowerCase() === username.toLowerCase() ||
               u.username?.toLowerCase() === username.toLowerCase()
      ) || null
    } catch (error) {
      console.error('[getPlayer] Error fetching player:', error)
      return null
    }
  },

  async getUserByEmail(email) {
    if (isDemoMode) {
      return null
    }

    if (!db) throw new Error('Firebase not configured')

    try {
      const users = await getList(DB_PATHS.users, 'created_at')
      const emailLower = email.toLowerCase()

      // Find user with matching email (case-insensitive)
      const user = users.find((u) => u.email?.toLowerCase() === emailLower)
      return user || null
    } catch (error) {
      console.error('[getUserByEmail] Error fetching user by email:', error)
      throw error
    }
  },

  async updateUser(userId, updates) {
    if (isDemoMode) {
      // In demo mode, just return the updates as if they were saved
      return { id: userId, ...updates }
    }

    if (!db) throw new Error('Firebase not configured')

    const userRef = doc(db, DB_PATHS.users, userId)
    const existingUser = await getData(DB_PATHS.users, userId)

    if (existingUser) {
      // Update existing user
      await updateDoc(userRef, {
        ...updates,
        updated_at: new Date().toISOString(),
      })
      return { ...existingUser, ...updates, id: userId, updated_at: new Date().toISOString() }
    } else {
      // Create new user
      const newUser = {
        ...updates,
        id: userId,
        created_at: updates.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await setDoc(userRef, newUser)
      return newUser
    }
  },

  // Email verification
  async createEmailVerification(userId, email) {
    if (isDemoMode) {
      return {
        token: 'demo-token',
        verificationLink: `${window.location.origin}/verify-email?token=demo-token`,
      }
    }

    if (!db) throw new Error('Firebase not configured')

    // Generate secure token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

    const verification = {
      user_id: userId,
      token,
      email,
      created_at: now.toISOString(),
      verified_at: null,
      expires_at: expiresAt.toISOString(),
    }

    await addDoc(collection(db, DB_PATHS.emailVerifications), verification)

    const verificationLink = `${window.location.origin}/verify-email?token=${token}`

    return { token, verificationLink }
  },

  async verifyEmail(token) {
    if (isDemoMode) {
      return { success: true, userId: 'demo-user', message: 'Email verified (demo mode)' }
    }

    if (!db) throw new Error('Firebase not configured')

    try {
      const verifications = await getList(DB_PATHS.emailVerifications, 'created_at')
      let verification = null

      // Find verification by token
      for (const v of verifications) {
        if (v.token === token && !v.verified_at) {
          verification = v
          break
        }
      }

      if (!verification) {
        return { success: false, message: 'Invalid or already used verification token' }
      }

      // Check if expired
      const expiresAt = new Date(verification.expires_at)
      if (expiresAt < new Date()) {
        return { success: false, message: 'Verification token has expired' }
      }

      // Mark as verified
      await updateDoc(doc(db, DB_PATHS.emailVerifications, verification.id), {
        verified_at: new Date().toISOString(),
      })

      // Update user's email_verified_at status
      const emailVerifiedAt = new Date().toISOString()
      await updateDoc(doc(db, DB_PATHS.users, verification.user_id), {
        email_verified_at: emailVerifiedAt,
      })

      return {
        success: true,
        userId: verification.user_id,
        message: 'Email verified successfully',
      }
    } catch (error) {
      console.error('[verifyEmail] Error verifying email:', error)
      throw error
    }
  },

  // Email
  async sendEmail(to, from, subject, message) {
    try {
      const response = await fetch('https://chessbd.pythonanywhere.com/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          from,
          subject,
          message,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('[sendEmail] API error response:', response.status, errorText)
        throw new Error(`Email API returned ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('[sendEmail] Error sending email:', error)
      throw error
    }
  },

  // Verification challenge
  async createVerificationChallenge(userId) {
    if (isDemoMode) {
      return { code: 'DEMO123' }
    }

    if (!db) throw new Error('Firebase not configured')

    // Check if user already has an active (unverified) challenge
    // If permission denied, we'll just create a new code (getList returns empty array on permission error)
    let activeChallenges = []
    try {
      const challenges = await getList(DB_PATHS.verificationChallenges, 'created_at')
      activeChallenges = challenges
        .filter((challenge) => challenge.user_id === userId && !challenge.verified_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } catch (error) {
      // If getList throws (non-permission error), log it but continue to create new code
      if (error?.code !== 'permission-denied' && !error?.message?.includes('permission')) {
        console.error('[createVerificationChallenge] Error checking existing challenges:', error)
      }
      // Continue to create a new code
    }

    // If user has an active unverified code, return it instead of creating a new one
    if (activeChallenges.length > 0) {
      return { code: activeChallenges[0].code }
    }

    // No active code found, create a new one
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const challenge = {
      user_id: userId,
      code,
      created_at: new Date().toISOString(),
      verified_at: null,
    }

    try {
      await addDoc(collection(db, DB_PATHS.verificationChallenges), challenge)
      return { code }
    } catch (error) {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        throw new Error('Permission denied. Please update your database rules.')
      }
      throw error
    }
  },

  async verifyChesscomUsername(userId, username) {
    if (isDemoMode) {
      return true
    }

    if (!db) throw new Error('Firebase not configured')

    // Get latest unverified verification challenge for this user
    let challenges = []
    try {
      challenges = await getList(DB_PATHS.verificationChallenges, 'created_at')
    } catch (error) {
      // If permission denied, throw a more helpful error
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        throw new Error('Permission denied. Please update your database rules to allow reading verification_challenges.')
      }
      throw error
    }
    
    const activeChallenges = challenges
      .filter((challenge) => challenge.user_id === userId && !challenge.verified_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (activeChallenges.length === 0) {
      throw new Error('No active verification code found. Please generate a code first.')
    }

    const challenge = activeChallenges[0]
    const challengeId = challenge.id

    // Fetch player profile from Chess.com API via CORS proxy
    const CHESSCOM_API_BASE = 'https://api.chess.com/pub'
    const apiUrl = `${CHESSCOM_API_BASE}/player/${username.toLowerCase()}`
    
    const CORS_PROXIES = [
      {
        name: 'AllOrigins',
        url: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
      },
      {
        name: 'CorsProxy',
        url: (target) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
      },
    ]
    
    let profile = null
    let lastError = null
    
    // Try to get JSON response from Chess.com API
    for (let i = 0; i < CORS_PROXIES.length; i++) {
      try {
        const proxy = CORS_PROXIES[i]
        const proxyUrl = proxy.url(apiUrl)
        
        const profileRes = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        })

        if (!profileRes.ok) {
          if (profileRes.status === 404 && i === CORS_PROXIES.length - 1) {
            throw new Error('Username not found on Chess.com. Please check your username and make sure it\'s spelled correctly.')
          }
          continue
        }

        const responseText = await profileRes.text()
        
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
          continue
        }
        
        try {
          profile = JSON.parse(responseText)
        } catch (parseError) {
          continue
        }
        
        if (profile.error || profile.code === 404 || profile.message?.includes('not found')) {
          if (i === CORS_PROXIES.length - 1) {
            throw new Error('Username not found on Chess.com. Please check your username and make sure it\'s spelled correctly.')
          }
          continue
        }
        
        if (!profile.username && !profile['@id']) {
          if (i === CORS_PROXIES.length - 1) {
            throw new Error('Invalid response from Chess.com API. Please try again later.')
          }
          continue
        }
        
        break
        
      } catch (error) {
        lastError = error
        
        if (error.name === 'AbortError' || error.name === 'TypeError') {
          continue
        }
        
        if ((error.message?.includes('not found') || error.message?.includes('404')) && i === CORS_PROXIES.length - 1) {
          throw error
        }
        
        continue
      }
    }
    
    if (!profile || (!profile.username && !profile['@id'])) {
      throw new Error(
        lastError?.message || 
        'Failed to fetch profile from Chess.com API. Please try again later or check your internet connection.'
      )
    }

    // Check if verification code is in location field
    const locationText = String(profile.location || '').trim().toLowerCase()
    const code = challenge.code.toLowerCase().trim()

    const verified = locationText.includes(code)
    
    if (verified) {
      // Delete the verification challenge entry after successful verification
      try {
        await deleteDoc(doc(db, DB_PATHS.verificationChallenges, challengeId))
      } catch (error) {
        console.error(`[verifyChesscomUsername] Failed to delete verification challenge ${challengeId}:`, error)
      }

      // Update user profile with Chess.com verification
      const userRef = doc(db, DB_PATHS.users, userId)
      await updateDoc(userRef, {
        chesscom_username: username.toLowerCase(),
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      return true
    }

    throw new Error(`Verification code "${challenge.code}" not found in your Chess.com profile location field. Please make sure you added it to your Chess.com profile location field and saved the changes.`)
  },

  async verifyLichessUsername(userId, username) {
    if (isDemoMode) {
      return true
    }

    if (!db) throw new Error('Firebase not configured')

    // Get latest unverified verification challenge for this user
    let challenges = []
    try {
      challenges = await getList(DB_PATHS.verificationChallenges, 'created_at')
    } catch (error) {
      // If permission denied, throw a more helpful error
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        throw new Error('Permission denied. Please update your database rules to allow reading verification_challenges.')
      }
      throw error
    }
    
    const activeChallenges = challenges
      .filter((challenge) => challenge.user_id === userId && !challenge.verified_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (activeChallenges.length === 0) {
      throw new Error('No active verification code found. Please generate a code first.')
    }

    const challenge = activeChallenges[0]
    const challengeId = challenge.id

    // Fetch player profile from Lichess API
    const LICHESS_API_BASE = 'https://lichess.org/api'
    const apiUrl = `${LICHESS_API_BASE}/user/${username.toLowerCase()}`

    let profile = null

    try {
      const profileRes = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!profileRes.ok) {
        if (profileRes.status === 404) {
          throw new Error('Username not found on Lichess. Please check your username and make sure it\'s spelled correctly.')
        }
        throw new Error(`Lichess API error: ${profileRes.statusText}`)
      }

      profile = await profileRes.json()
    } catch (error) {
      throw new Error(`Failed to fetch profile from Lichess: ${error.message}`)
    }

    // Check if verification code is in bio or location
    const bioText = String(profile.profile?.bio || '').trim().toLowerCase()
    const location = String(profile.profile?.location || '').trim().toLowerCase()
    const code = challenge.code.toLowerCase().trim()

    const verified = bioText.includes(code) || location.includes(code)

    if (verified) {
      // Delete the verification challenge entry after successful verification
      try {
        await deleteDoc(doc(db, DB_PATHS.verificationChallenges, challengeId))
      } catch (error) {
        console.error(`[verifyLichessUsername] Failed to delete verification challenge ${challengeId}:`, error)
      }

      // Update user profile with Lichess verification
      const userRef = doc(db, DB_PATHS.users, userId)
      await updateDoc(userRef, {
        lichess_username: username.toLowerCase(),
        lichess_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      return true
    }

    throw new Error(`Verification code "${challenge.code}" not found in your Lichess profile. Please make sure you added it to your Lichess profile bio or location field and saved the changes.`)
  },

  async uploadImage(file, folder = 'avatars') {
    if (isDemoMode) {
      return { public_url: 'https://via.placeholder.com/150' }
    }

    const UPLOAD_API_URL = 'https://chessbd.pythonanywhere.com/supabase/upload'
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (folder) {
        formData.append('folder', folder)
      }

      const response = await fetch(UPLOAD_API_URL, {
        method: 'POST',
        body: formData,
        credentials: 'omit',
      })

      if (!response.ok) {
        // Handle different HTTP status codes
        if (response.status === 502 || response.status === 503) {
          throw new Error('Upload service is temporarily unavailable. Please try again in a moment.')
        } else if (response.status === 413) {
          throw new Error('File is too large. Please use an image smaller than 5MB.')
        } else if (response.status === 415) {
          throw new Error('Invalid file type. Please upload an image file (JPG, PNG, etc.).')
        }
        
        // Try to parse error response
        let errorMessage = `Upload failed: ${response.statusText}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = `Upload failed: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      if (!data.ok) {
        throw new Error(data.error || data.message || 'Upload failed')
      }

      return data
    } catch (error) {
      console.error('[uploadImage] Error uploading image:', error)
      // Re-throw with a user-friendly message if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.')
      }
      throw error
    }
  },

  async getStats() {
    if (isDemoMode) {
      return {
        totalUsers: 0,
        totalEvents: 0,
        totalGames: 0,
        verifiedUsers: 0,
        activePlayers: 0,
      }
    }

    if (!db) {
      return {
        totalUsers: 0,
        totalEvents: 0,
        totalGames: 0,
        verifiedUsers: 0,
        activePlayers: 0,
      }
    }

    try {
      // Read stats from /data path which contains pre-calculated counts
      const dataDoc = await getDoc(doc(db, 'data', 'stats'))
      const data = dataDoc.exists() ? dataDoc.data() : null

      if (!data) {
        return {
          totalUsers: 0,
          totalEvents: 0,
          totalGames: 0,
          verifiedUsers: 0,
          activePlayers: 0,
        }
      }

      // Get active users from Realtime Database presence
      let activePlayers = 0
      try {
        if (rtdb) {
          const presenceRef = ref(rtdb, 'presence')
          const snapshot = await get(presenceRef)
          if (snapshot.exists()) {
            const presenceData = snapshot.val()
            if (presenceData && typeof presenceData === 'object') {
              // Count users with online: true or any presence data
              activePlayers = Object.keys(presenceData).filter(key => {
                const userPresence = presenceData[key]
                return userPresence && (userPresence.online === true || userPresence.online !== false)
              }).length
            }
          }
        }
      } catch (activeError) {
        console.error('[getStats] Error fetching active players:', activeError)
        // Continue with other stats even if active check fails
      }

      return {
        totalUsers: data.users_count || 0,
        totalEvents: data.events_count || 0,
        totalGames: data.games_count || 0,
        verifiedUsers: data.verified_users_count || 0,
        activePlayers,
      }
    } catch (error) {
      // Check if it's an offline error
      if (error?.code === 'unavailable' || error?.message?.includes('offline') || error?.message?.includes('Failed to get document')) {
        return {
          totalUsers: 0,
          totalEvents: 0,
          totalGames: 0,
          verifiedUsers: 0,
          activePlayers: 0,
        }
      }
      
      console.error('[getStats] Error fetching stats:', error)
      // Return zero stats on error instead of throwing
      return {
        totalUsers: 0,
        totalEvents: 0,
        totalGames: 0,
        verifiedUsers: 0,
        activePlayers: 0,
      }
    }
  },

  async getEvents(filters) {
    if (isDemoMode) {
      return []
    }

    if (!db) {
      return []
    }

    try {
      const allEvents = await getList(DB_PATHS.events, 'start_time')
      
      // Import calculateEventStatus from utils
      const { calculateEventStatus } = await import('./utils/event-status.js')
      
      const eventsWithStatus = allEvents.map((e) => {
        const status = calculateEventStatus(e)
        // Map to API format (live -> in_progress, completed -> finished)
        const normalizedStatus = status === 'in_progress' ? 'in_progress' : status === 'finished' ? 'finished' : 'upcoming'
        return {
          ...e,
          status: normalizedStatus,
        }
      })
      
      // Filter by status if provided
      let filtered = eventsWithStatus
      if (filters?.status) {
        filtered = eventsWithStatus.filter((e) => {
          // Normalize status for comparison
          const normalizedStatus = e.status === 'live' ? 'in_progress' : e.status === 'completed' ? 'finished' : e.status
          return normalizedStatus === filters.status
        })
      }
      
      // Sort by start_time (newest first), handling null dates
      const sorted = filtered.sort((a, b) => {
        if (!a.start_time && !b.start_time) return 0
        if (!a.start_time) return 1
        if (!b.start_time) return -1
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      })
      
      return sorted
    } catch (error) {
      console.error('[getEvents] Error fetching events:', error)
      if (error?.message?.includes('Permission')) {
        console.error('[getEvents] Permission denied. Check database rules.')
      }
      return []
    }
  },

  async getEvent(idOrSlug) {
    if (!idOrSlug) {
      return null
    }

    if (isDemoMode || !db) {
      return null
    }

    try {
      const { generateEventSlug } = await import('./utils/slug.js')
      const { calculateEventStatus } = await import('./utils/event-status.js')
      const allEvents = await getList(DB_PATHS.events, 'start_time')
      
      // Generate slugs for all events
      const eventsWithSlugs = allEvents.map((e) => {
        let slug = e.slug
        if (!slug && e.id && e.name) {
          slug = generateEventSlug(e.name)
        }
        return { ...e, computedSlug: slug }
      })

      // First, try to find by exact slug match (stored or computed)
      const normalizedSearchSlug = idOrSlug.toLowerCase().trim()
      let eventWithSlug = eventsWithSlugs.find((e) => {
        const eventSlug = e.computedSlug
        if (!eventSlug) return false
        const normalizedEventSlug = eventSlug.toLowerCase().trim()
        return normalizedEventSlug === normalizedSearchSlug
      }) || null
      
      let event = eventWithSlug ? (() => {
        const { computedSlug, ...eventData } = eventWithSlug
        return eventData
      })() : null
      
      // If still not found by slug, try by ID
      if (!event) {
        const { doc, getDoc } = await import('firebase/firestore')
        const eventDoc = await getDoc(doc(db, DB_PATHS.events, idOrSlug))
        if (eventDoc.exists()) {
          event = { id: eventDoc.id, ...eventDoc.data() }
        } else {
          // Try finding in allEvents by ID
          event = allEvents.find((e) => e.id === idOrSlug) || null
        }
      }
      
      if (!event) {
        return null
      }
      
      // Ensure slug exists (for backward compatibility)
      if (!event.slug && event.id && event.name) {
        const newSlug = generateEventSlug(event.name)
        event.slug = newSlug
        
        // Try to save slug to database (non-blocking)
        try {
          const { doc, updateDoc } = await import('firebase/firestore')
          const eventRef = doc(db, DB_PATHS.events, event.id)
          await updateDoc(eventRef, {
            slug: newSlug,
            updated_at: new Date().toISOString(),
          })
        } catch (error) {
          // Failed to save slug, continue anyway
        }
      }
      
      // Calculate status
      const eventStatus = calculateEventStatus(event)
      const normalizedStatus = eventStatus === 'in_progress' ? 'in_progress' : eventStatus === 'finished' ? 'finished' : 'upcoming'
      
      return { ...event, status: normalizedStatus }
    } catch (error) {
      console.error('[getEvent] Error fetching event:', error)
      return null
    }
  },

  async getChesscomStats(username) {
    if (isDemoMode || !username) {
      return null
    }

    const CHESSCOM_API_BASE = 'https://api.chess.com/pub'
    const statsUrl = `${CHESSCOM_API_BASE}/player/${username.toLowerCase()}/stats`
    
    try {
      const res = await fetch(statsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      })

      if (res.ok) {
        const stats = await res.json()
        
        const result = { username: username.toLowerCase() }
        
        if (stats.chess_rapid?.last?.rating) {
          const record = stats.chess_rapid.record || {}
          const wins = record.win || 0
          const losses = record.loss || 0
          const draws = record.draw || 0
          const totalGames = wins + losses + draws
          result.rapid = {
            rating: stats.chess_rapid.last.rating,
            games: totalGames,
            wins,
            losses,
            draws,
            winRate: totalGames > 0 ? (wins + draws * 0.5) / totalGames : 0,
          }
        }

        if (stats.chess_blitz?.last?.rating) {
          const record = stats.chess_blitz.record || {}
          const wins = record.win || 0
          const losses = record.loss || 0
          const draws = record.draw || 0
          const totalGames = wins + losses + draws
          result.blitz = {
            rating: stats.chess_blitz.last.rating,
            games: totalGames,
            wins,
            losses,
            draws,
            winRate: totalGames > 0 ? (wins + draws * 0.5) / totalGames : 0,
          }
        }

        if (stats.chess_bullet?.last?.rating) {
          const record = stats.chess_bullet.record || {}
          const wins = record.win || 0
          const losses = record.loss || 0
          const draws = record.draw || 0
          const totalGames = wins + losses + draws
          result.bullet = {
            rating: stats.chess_bullet.last.rating,
            games: totalGames,
            wins,
            losses,
            draws,
            winRate: totalGames > 0 ? (wins + draws * 0.5) / totalGames : 0,
          }
        }

        if (stats.chess_daily?.last?.rating) {
          const record = stats.chess_daily.record || {}
          const wins = record.win || 0
          const losses = record.loss || 0
          const draws = record.draw || 0
          const totalGames = wins + losses + draws
          result.daily = {
            rating: stats.chess_daily.last.rating,
            games: totalGames,
            wins,
            losses,
            draws,
            winRate: totalGames > 0 ? (wins + draws * 0.5) / totalGames : 0,
          }
        }

        if (stats.tactics?.highest?.rating) {
          result.tactics = {
            highest: stats.tactics.highest.rating,
          }
        }

        if (stats.puzzle_rush?.best?.score) {
          result.puzzleRush = {
            best: stats.puzzle_rush.best.score,
          }
        }

        return result
      }
      
      return null
    } catch (error) {
      // Return null instead of throwing - allows graceful degradation
      return null
    }
  },

  async getRatingSnapshot() {
    // Helper function to extract rating from PGN
    const extractRatingFromPGN = (pgn, isWhite) => {
      if (!pgn) return null
      
      const eloMatch = isWhite 
        ? pgn.match(/\[WhiteElo\s+"(\d+)"\]/)
        : pgn.match(/\[BlackElo\s+"(\d+)"\]/)
      
      if (eloMatch && eloMatch[1]) {
        const rating = parseInt(eloMatch[1], 10)
        return isNaN(rating) ? null : rating
      }
      return null
    }

    // Helper function to get date string (YYYY-MM-DD) from timestamp
    const getDateString = (timestamp) => {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Helper function to fetch games from Chess.com archives for a user
    const fetchUserGames = async (username) => {
      try {
        const CHESSCOM_API_BASE = 'https://api.chess.com/pub'
        const CORS_PROXIES = [
          { name: 'CorsProxy.io', url: (target) => `https://corsproxy.io/?${encodeURIComponent(target)}` },
          { name: 'AllOrigins', url: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}` },
          { name: 'ProxyCORS', url: (target) => `https://proxy.cors.sh/${target}` },
        ]

        // Get archives list - use longer timeout for mobile
        const archivesUrl = `${CHESSCOM_API_BASE}/player/${username.toLowerCase()}/games/archives`
        let archives = []
        
        try {
          // Create AbortController for better timeout handling
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 seconds
          
          const res = await fetch(archivesUrl, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'ChessBD/1.0' },
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
          
          if (res.ok) {
            const data = await res.json()
            archives = data.archives || []
          }
        } catch (error) {
          // Try CORS proxies as fallback (important for mobile)
          if (error.name !== 'AbortError') {
            for (const proxy of CORS_PROXIES) {
              try {
                const proxyUrl = proxy.url(archivesUrl)
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 10000)
                
                const res = await fetch(proxyUrl, {
                  headers: { 'Accept': 'application/json', 'User-Agent': 'ChessBD/1.0' },
                  signal: controller.signal,
                })
                clearTimeout(timeoutId)
                
                if (res.ok) {
                  const responseText = await res.text()
                  // Check if response is HTML (proxy error) or JSON
                  if (!responseText.trim().startsWith('<!DOCTYPE') && !responseText.trim().startsWith('<html')) {
                    const data = JSON.parse(responseText)
                    archives = data.archives || []
                    break
                  }
                }
              } catch {
                continue
              }
            }
          }
          
          if (archives.length === 0) {
            return []
          }
        }

        if (archives.length === 0) {
          return []
        }

        // Get archives that could contain games from last 7 days
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear
        
        const relevantArchives = archives.filter(archive => {
          const match = archive.match(/\/(\d{4})\/(\d{2})(?:\/|$)/)
          if (!match) return false
          
          const year = parseInt(match[1], 10)
          const month = parseInt(match[2], 10)
          
          const isCurrentMonth = year === currentYear && month === currentMonth
          const isPrevMonth = year === prevYear && month === prevMonth
          
          return isCurrentMonth || isPrevMonth
        })

        const games = []
        const targetDateStrings = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          date.setHours(0, 0, 0, 0)
          targetDateStrings.push(getDateString(date))
        }
        
        const archivesToProcess = relevantArchives.length > 0 ? relevantArchives : archives.slice(-3)
        
        // Fetch games from relevant archives - limit to 2 archives for mobile performance
        const archivesToFetch = archivesToProcess.slice(0, 2)
        for (const archiveUrl of archivesToFetch) {
          try {
            let gamesData = null
            try {
              // Create AbortController for better timeout handling
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 seconds
              
              const res = await fetch(archiveUrl, {
                headers: { 'Accept': 'application/json', 'User-Agent': 'ChessBD/1.0' },
                signal: controller.signal,
              })
              clearTimeout(timeoutId)
              
              if (res.ok) {
                gamesData = await res.json()
              }
            } catch (error) {
              // Try CORS proxies as fallback (important for mobile)
              if (error.name !== 'AbortError') {
                for (const proxy of CORS_PROXIES) {
                  try {
                    const proxyUrl = proxy.url(archiveUrl)
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), 10000)
                    
                    const res = await fetch(proxyUrl, {
                      headers: { 'Accept': 'application/json', 'User-Agent': 'ChessBD/1.0' },
                      signal: controller.signal,
                    })
                    clearTimeout(timeoutId)
                    
                    if (res.ok) {
                      const responseText = await res.text()
                      // Check if response is HTML (proxy error) or JSON
                      if (!responseText.trim().startsWith('<!DOCTYPE') && !responseText.trim().startsWith('<html')) {
                        gamesData = JSON.parse(responseText)
                        break
                      }
                    }
                  } catch {
                    continue
                  }
                }
              }
              
              if (!gamesData) {
                continue
              }
            }

            if (!gamesData) continue

            const archiveGames = gamesData.games || []
            
            for (const g of archiveGames) {
              const timeClass = g.time_class?.toLowerCase()
              if (timeClass !== 'rapid') continue

              const whiteUsername = (g.white?.username || g.white || '').toLowerCase()
              const blackUsername = (g.black?.username || g.black || '').toLowerCase()
              const userLower = username.toLowerCase()
              const isWhite = whiteUsername === userLower
              const isBlack = blackUsername === userLower
              
              if (!isWhite && !isBlack) continue

              let endTime = null
              if (g.end_time) {
                endTime = new Date(g.end_time * 1000)
              } else if (g.timestamp) {
                endTime = new Date(g.timestamp * 1000)
              }
              
              if (!endTime) continue
              
              const gameDateStr = getDateString(endTime)
              if (!targetDateStrings.includes(gameDateStr)) continue

              const pgn = g.pgn || ''
              const rating = extractRatingFromPGN(pgn, isWhite)
              if (!rating || rating < 400 || rating > 3000) continue

              games.push({ date: gameDateStr, rating, endTime })
            }
          } catch {
            continue
          }
        }

        return games
      } catch {
        return []
      }
    }

    // Fallback data if no database or no users
    const createFallbackData = (baseRating = 1500) => {
      const days = 7
      const dailyAverages = []
      const trendVariation = 50
      
      for (let day = 0; day < days; day++) {
        const progress = day / (days - 1)
        const variation = trendVariation * (1 - progress) * 0.3 * (Math.random() * 0.4 - 0.2)
        const dailyAvg = Math.round(baseRating - (trendVariation * 0.2 * (1 - progress)) + variation)
        dailyAverages.push(Math.max(800, Math.min(3000, dailyAvg)))
      }
      
      const maxDaily = Math.max(...dailyAverages)
      const minDaily = Math.min(...dailyAverages)
      const range = maxDaily - minDaily || 1
      const barData = dailyAverages.map(avg => Math.max(20, ((avg - minDaily) / range) * 100))
      const change = baseRating - dailyAverages[0]
      
      return {
        averageRating: baseRating,
        playerCount: 0,
        barData,
        dailyAverages,
        change,
      }
    }

    if (!db) {
      return createFallbackData()
    }

    try {
      // Get all verified users with Chess.com usernames
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))

      // Only consider users with Chess.com usernames (exclude Lichess-only users)
      const verifiedUsers = users.filter(
        (user) => user.chesscom_username && user.chesscom_username.trim() !== '' && user.verified_at
      )

      if (verifiedUsers.length === 0) {
        return createFallbackData()
      }

      // Fetch current rapid ratings from Chess.com stats API
      // Use Promise.allSettled for better error handling on mobile
      const rapidRatingPromises = verifiedUsers.map(async (user) => {
        try {
          const stats = await this.getChesscomStats(user.chesscom_username)
          return stats?.rapid?.rating || null
        } catch (error) {
          console.debug(`[getRatingSnapshot] Failed to fetch stats for ${user.chesscom_username}:`, error)
          return null
        }
      })
      
      const rapidRatingResults = await Promise.allSettled(rapidRatingPromises)
      const rapidRatings = rapidRatingResults.map(result => 
        result.status === 'fulfilled' ? result.value : null
      )
      
      // Filter valid rapid ratings
      const validRapidRatings = rapidRatings.filter((r) => r !== null && r > 0)

      if (validRapidRatings.length === 0) {
        return createFallbackData()
      }

      // Calculate average rapid rating
      const currentAverage = Math.round(
        validRapidRatings.reduce((sum, r) => sum + r, 0) / validRapidRatings.length
      )

      // For 7-day trend, use game history
      const now = new Date()
      const days = 7
      const dailyRatings = Array.from({ length: days }, () => [])

      // Generate date strings for last 7 days
      const dateStrings = []
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)
        dateStrings.push(getDateString(date))
      }

      // Fetch games for trend chart (limit to 5 for mobile performance)
      const usersWithRatings = verifiedUsers.filter((_, idx) => rapidRatings[idx] !== null).slice(0, 5)
      
      // Use Promise.allSettled to handle individual failures gracefully
      const gamePromises = usersWithRatings.map(async (user) => {
        try {
          const games = await fetchUserGames(user.chesscom_username)
          const gamesByDate = new Map()
          for (const game of games) {
            if (!dateStrings.includes(game.date)) continue
            const existing = gamesByDate.get(game.date)
            if (!existing || game.endTime > existing.endTime) {
              gamesByDate.set(game.date, { rating: game.rating, endTime: game.endTime })
            }
          }
          return gamesByDate
        } catch (error) {
          console.debug(`[getRatingSnapshot] Failed to fetch games for ${user.chesscom_username}:`, error)
          return new Map()
        }
      })

      const gameResults = await Promise.allSettled(gamePromises)
      const allGamesByDate = gameResults.map(result => 
        result.status === 'fulfilled' ? result.value : new Map()
      )
      const usersWithGameData = allGamesByDate.filter(gamesByDate => gamesByDate.size > 0)

      // Aggregate ratings by day from game history
      for (let dayIdx = 0; dayIdx < days; dayIdx++) {
        const dateStr = dateStrings[dayIdx]
        for (const gamesByDate of usersWithGameData) {
          const game = gamesByDate.get(dateStr)
          if (game) {
            dailyRatings[dayIdx].push(game.rating)
          }
        }
      }

      // Calculate daily averages from game history
      const dailyAverages = dailyRatings.map(ratings => {
        if (ratings.length === 0) return null
        return Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length)
      })

      // Fill missing days: if a day has no games, use the previous day's rating
      const filledAverages = []
      let lastKnownRating = 1500 // Default fallback
      
      // First, find the first known rating
      for (let i = 0; i < dailyAverages.length; i++) {
        const avg = dailyAverages[i]
        if (avg !== null) {
          lastKnownRating = avg
          break
        }
      }

      const validAverages = dailyAverages.filter((avg) => avg !== null)
      
      // Fill all days
      if (validAverages.length === 0) {
        // No game history, but we have current ratings - use current average for all days
        for (let idx = 0; idx < days; idx++) {
          filledAverages.push(currentAverage)
        }
      } else {
        // Fill days with game history data
        for (let idx = 0; idx < dailyAverages.length; idx++) {
          const avg = dailyAverages[idx]
          if (avg !== null) {
            lastKnownRating = avg
            filledAverages.push(lastKnownRating)
          } else {
            // No games on this day, use previous day's rating
            filledAverages.push(lastKnownRating)
          }
        }
      }

      const playerCount = validRapidRatings.length

      // Normalize bar heights using full min-to-max range
      const maxDaily = Math.max(...filledAverages)
      const minDaily = Math.min(...filledAverages)
      const range = maxDaily - minDaily
      
      const barData = filledAverages.map((avg) => {
        if (range === 0) {
          return 50 // All bars same height when no variation
        }
        // Normalize to full range: min = 0%, max = 100%
        const normalized = ((avg - minDaily) / range) * 100
        const result = Math.max(10, Math.min(100, normalized))
        return result
      })

      // Calculate change from 7 days ago to today
      const change = filledAverages.length > 0 && validAverages.length > 0
        ? filledAverages[filledAverages.length - 1] - filledAverages[0]
        : 0

      return {
        averageRating: currentAverage,
        playerCount,
        barData,
        dailyAverages: filledAverages,
        change,
      }
    } catch (error) {
      console.error('[getRatingSnapshot] Error:', error)
      return createFallbackData()
    }
  },

  async getNews(publishedOnly = true) {
    if (isDemoMode) {
      return []
    }

    if (!db) {
      return []
    }

    try {
      const newsList = await getList(DB_PATHS.news, 'created_at')
      
      // Filter published news if requested (requires both published AND published_at)
      let filtered = newsList
      if (publishedOnly) {
        filtered = newsList.filter(n => n.published && n.published_at)
      }
      
      // Sort by published_at or created_at descending (newest first)
      const sorted = filtered.sort((a, b) => {
        const dateA = a.published_at || a.created_at || ''
        const dateB = b.published_at || b.created_at || ''
        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
      
      console.log('[getNews] Total news:', newsList.length, 'Published:', filtered.length)
      return sorted
    } catch (error) {
      console.error('[getNews] Error fetching news:', error)
      console.error('[getNews] Error details:', error.message)
      return []
    }
  },

  async getNewsItem(idOrSlug) {
    if (!idOrSlug) {
      return null
    }

    if (isDemoMode || !db) {
      return null
    }

    try {
      const { generateNewsSlug } = await import('./utils/slug')
      const newsList = await getList(DB_PATHS.news)
      
      // Find news by id, stored slug, or generated slug from title
      let news = newsList.find(n => {
        // Match by ID
        if (n.id === idOrSlug) return true
        // Match by stored slug
        if (n.slug === idOrSlug) return true
        // Match by generated slug from title
        if (n.title && generateNewsSlug(n.title) === idOrSlug) return true
        return false
      })
      
      return news || null
    } catch (error) {
      console.error('[getNewsItem] Error fetching news item:', error)
      return null
    }
  },

  async getShowcaseData() {
    if (isDemoMode) {
      return {}
    }

    if (!db) {
      return {}
    }

    try {
      const { doc, getDoc } = await import('firebase/firestore')
      const dataDoc = await getDoc(doc(db, 'data', 'showcase'))
      
      if (!dataDoc.exists()) {
        return {}
      }
      
      const data = dataDoc.data()
      
      // Check all possible key variations (snake_case, camelCase, with/without trailing spaces)
      const playerOfDay = data.player_of_day || data['player_of_day '] || data.playerOfDay
      const playerOfWeek = data.player_of_week || data['player_of_week '] || data.playerOfWeek
      const playerOfMonth = data.player_of_month || data['player_of_month '] || data.playerOfMonth
      const districtOfMonth = data.district_of_month || data['district_of_month '] || data.districtOfMonth
      
      // Helper to validate player data
      const isValidPlayer = (player) => {
        return player && 
               typeof player === 'object' && 
               player.user_id && 
               typeof player.user_id === 'string' && 
               player.user_id.trim().length > 0
      }

      // Helper to validate district data
      const isValidDistrict = (district) => {
        return district && 
               typeof district === 'object' && 
               district.location && 
               typeof district.location === 'string' && 
               district.location.trim().length > 0
      }

      const result = {
        playerOfDay: isValidPlayer(playerOfDay) ? playerOfDay : undefined,
        playerOfWeek: isValidPlayer(playerOfWeek) ? playerOfWeek : undefined,
        playerOfMonth: isValidPlayer(playerOfMonth) ? playerOfMonth : undefined,
        districtOfMonth: isValidDistrict(districtOfMonth) ? districtOfMonth : undefined,
        tournamentWinners: Array.isArray(data.tournament_winners) ? data.tournament_winners : (Array.isArray(data.tournamentWinners) ? data.tournamentWinners : []),
      }
      
      console.log('[getShowcaseData] Fetched data:', result)
      return result
    } catch (error) {
      // Check if it's an offline error (expected when no internet)
      if (error?.code === 'unavailable' || error?.message?.includes('offline') || error?.message?.includes('Failed to get document')) {
        console.warn('[getShowcaseData] Offline, returning empty object')
        return {}
      }
      
      console.error('[getShowcaseData] Error fetching showcase data:', error)
      return {}
    }
  },

  async getPartners() {
    if (isDemoMode) {
      return []
    }

    if (!db) {
      return []
    }

    try {
      const partnersList = await getList(DB_PATHS.partners, 'created_at')
      return partnersList
    } catch (error) {
      console.error('[getPartners] Error fetching partners:', error)
      return []
    }
  },

  async getTestimonials() {
    if (isDemoMode) {
      return []
    }

    if (!db) {
      return []
    }

    try {
      const { collection, getDocs } = await import('firebase/firestore')
      const testimonialsSnapshot = await getDocs(collection(db, 'testimonials'))
      const testimonialsList = testimonialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      
      // Filter featured testimonials and sort by order
      const featured = testimonialsList
        .filter(t => t.featured === true)
        .sort((a, b) => {
          const orderA = a.order ?? 999
          const orderB = b.order ?? 999
          return orderA - orderB
        })
        .slice(0, 3) // Limit to 3
      
      return featured
    } catch (error) {
      console.error('[getTestimonials] Error fetching testimonials:', error)
      return []
    }
  },

  async getUsers() {
    if (isDemoMode) {
      return {}
    }

    if (!db) {
      return {}
    }

    try {
      const { collection, getDocs } = await import('firebase/firestore')
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = {}
      usersSnapshot.docs.forEach(doc => {
        users[doc.id] = { id: doc.id, ...doc.data() }
      })
      return users
    } catch (error) {
      console.error('[getUsers] Error fetching users:', error)
      return {}
    }
  },

  async getClubs() {
    if (isDemoMode) {
      return []
    }

    if (!db) {
      return []
    }

    try {
      const { collection, getDocs } = await import('firebase/firestore')
      const clubsSnapshot = await getDocs(collection(db, 'clubs'))
      const clubsList = clubsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      return clubsList
    } catch (error) {
      console.error('[getClubs] Error fetching clubs:', error)
      return []
    }
  },

  async getClub(slugOrId) {
    if (isDemoMode || !slugOrId) {
      return null
    }

    if (!db) {
      return null
    }

    try {
      const { collection, getDocs, query, where, doc, getDoc } = await import('firebase/firestore')
      
      // First try to find by ID
      const clubDoc = await getDoc(doc(db, 'clubs', slugOrId))
      if (clubDoc.exists()) {
        return { id: clubDoc.id, ...clubDoc.data() }
      }

      // If not found by ID, try to find by slug
      const clubsQuery = query(collection(db, 'clubs'), where('slug', '==', slugOrId))
      const clubsSnapshot = await getDocs(clubsQuery)
      if (!clubsSnapshot.empty) {
        const clubDoc = clubsSnapshot.docs[0]
        return { id: clubDoc.id, ...clubDoc.data() }
      }

      return null
    } catch (error) {
      console.error('[getClub] Error fetching club:', error)
      return null
    }
  },

  async createClub(clubData) {
    if (isDemoMode) {
      throw new Error('Cannot create club in demo mode')
    }

    if (!db) {
      throw new Error('Database not initialized')
    }

    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
      const { generateClubSlug } = await import('./utils/slug')
      
      const newClub = {
        ...clubData,
        slug: clubData.name ? generateClubSlug(clubData.name) : null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }

      const docRef = await addDoc(collection(db, 'clubs'), newClub)
      return { id: docRef.id, ...newClub }
    } catch (error) {
      console.error('[createClub] Error creating club:', error)
      throw error
    }
  },

  async updateClub(clubId, updates) {
    if (isDemoMode) {
      throw new Error('Cannot update club in demo mode')
    }

    if (!db || !clubId) {
      throw new Error('Database not initialized or club ID missing')
    }

    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
      await updateDoc(doc(db, 'clubs', clubId), {
        ...updates,
        updated_at: serverTimestamp(),
      })
      return { id: clubId, ...updates }
    } catch (error) {
      console.error('[updateClub] Error updating club:', error)
      throw error
    }
  },

  async requestToJoinClub(clubId, chesscomUsername) {
    if (isDemoMode) {
      throw new Error('Cannot request to join club in demo mode')
    }

    if (!db || !clubId || !chesscomUsername) {
      throw new Error('Missing required parameters')
    }

    try {
      const { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } = await import('firebase/firestore')
      const clubRef = doc(db, 'clubs', clubId)
      const clubDoc = await getDoc(clubRef)
      
      if (!clubDoc.exists()) {
        throw new Error('Club not found')
      }

      const clubData = clubDoc.data()
      const joinRequests = clubData.join_requests || []
      
      if (joinRequests.includes(chesscomUsername)) {
        throw new Error('Join request already exists')
      }

      await updateDoc(clubRef, {
        join_requests: arrayUnion(chesscomUsername),
        updated_at: serverTimestamp(),
      })

      return { success: true }
    } catch (error) {
      console.error('[requestToJoinClub] Error:', error)
      throw error
    }
  },

  async approveJoinRequest(clubId, chesscomUsername) {
    if (isDemoMode) {
      throw new Error('Cannot approve join request in demo mode')
    }

    if (!db || !clubId || !chesscomUsername) {
      throw new Error('Missing required parameters')
    }

    try {
      const { doc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } = await import('firebase/firestore')
      const clubRef = doc(db, 'clubs', clubId)
      const clubDoc = await getDoc(clubRef)
      
      if (!clubDoc.exists()) {
        throw new Error('Club not found')
      }

      const clubData = clubDoc.data()
      const members = clubData.members || []
      
      if (members.includes(chesscomUsername)) {
        throw new Error('User is already a member')
      }

      await updateDoc(clubRef, {
        members: arrayUnion(chesscomUsername),
        join_requests: arrayRemove(chesscomUsername),
        members_count: (clubData.members_count || 0) + 1,
        updated_at: serverTimestamp(),
      })

      return { success: true }
    } catch (error) {
      console.error('[approveJoinRequest] Error:', error)
      throw error
    }
  },

  async rejectJoinRequest(clubId, chesscomUsername) {
    if (isDemoMode) {
      throw new Error('Cannot reject join request in demo mode')
    }

    if (!db || !clubId || !chesscomUsername) {
      throw new Error('Missing required parameters')
    }

    try {
      const { doc, updateDoc, arrayRemove, serverTimestamp } = await import('firebase/firestore')
      const clubRef = doc(db, 'clubs', clubId)
      
      await updateDoc(clubRef, {
        join_requests: arrayRemove(chesscomUsername),
        updated_at: serverTimestamp(),
      })

      return { success: true }
    } catch (error) {
      console.error('[rejectJoinRequest] Error:', error)
      throw error
    }
  },

  async removeMember(clubId, chesscomUsername) {
    if (isDemoMode) {
      throw new Error('Cannot remove member in demo mode')
    }

    if (!db || !clubId || !chesscomUsername) {
      throw new Error('Missing required parameters')
    }

    try {
      const { doc, getDoc, updateDoc, arrayRemove, serverTimestamp } = await import('firebase/firestore')
      const clubRef = doc(db, 'clubs', clubId)
      const clubDoc = await getDoc(clubRef)
      
      if (!clubDoc.exists()) {
        throw new Error('Club not found')
      }

      const clubData = clubDoc.data()
      const currentCount = clubData.members_count || 0

      await updateDoc(clubRef, {
        members: arrayRemove(chesscomUsername),
        members_count: Math.max(0, currentCount - 1),
        updated_at: serverTimestamp(),
      })

      return { success: true }
    } catch (error) {
      console.error('[removeMember] Error:', error)
      throw error
    }
  },

  async getChesscomPlayerProfile(username) {
    if (isDemoMode || !username) {
      return null
    }

    const CHESSCOM_API_BASE = 'https://api.chess.com/pub'
    const apiUrl = `${CHESSCOM_API_BASE}/player/${username.toLowerCase()}`
    
    try {
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      })

      if (res.ok) {
        const profile = await res.json()
        return {
          username: profile.username || username.toLowerCase(),
          avatar: profile.avatar || null,
          name: profile.name || null,
          location: profile.location || null,
          country: profile.country || null,
        }
      }
      
      return null
    } catch (error) {
      console.error('[getChesscomPlayerProfile] Error fetching profile:', error)
      return null
    }
  },

  async getLichessStats(username) {
    if (isDemoMode || !username) {
      return null
    }

    const LICHESS_API_BASE = 'https://lichess.org/api'
    const statsUrl = `${LICHESS_API_BASE}/user/${username.toLowerCase()}`
    
    try {
      const res = await fetch(statsUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) {
        return null
      }

      const data = await res.json()
      const result = { username: username.toLowerCase() }

      // Extract ratings from Lichess format
      // Lichess API structure: perfs.{timeControl} contains {games, rating, rd, prog, prov}
      // Win/loss/draw breakdown is not in perfs, but needs to be calculated from games
      if (data.perfs?.rapid) {
        const perf = data.perfs.rapid
        const wins = typeof perf.win === 'number' ? perf.win : 0
        const losses = typeof perf.loss === 'number' ? perf.loss : 0
        const draws = typeof perf.draw === 'number' ? perf.draw : 0
        const totalGames = typeof perf.games === 'number' ? perf.games : (wins + losses + draws)
        const rating = typeof perf.rating === 'number' ? perf.rating : (perf.glicko?.rating || 1500)
        
        result.rapid = {
          rating: rating,
          games: totalGames,
          wins,
          losses,
          draws,
          winRate: totalGames > 0 ? (wins + draws * 0.5) / totalGames : 0,
        }
      }

      if (data.perfs?.blitz) {
        const perf = data.perfs.blitz
        const wins = typeof perf.win === 'number' ? perf.win : 0
        const losses = typeof perf.loss === 'number' ? perf.loss : 0
        const draws = typeof perf.draw === 'number' ? perf.draw : 0
        const totalGames = typeof perf.games === 'number' ? perf.games : (wins + losses + draws)
        const rating = typeof perf.rating === 'number' ? perf.rating : (perf.glicko?.rating || 1500)
        
        result.blitz = {
          rating: rating,
          games: totalGames,
          wins,
          losses,
          draws,
          winRate: totalGames > 0 ? (wins + draws * 0.5) / totalGames : 0,
        }
      }

      if (data.perfs?.bullet) {
        const perf = data.perfs.bullet
        const wins = typeof perf.win === 'number' ? perf.win : 0
        const losses = typeof perf.loss === 'number' ? perf.loss : 0
        const draws = typeof perf.draw === 'number' ? perf.draw : 0
        const totalGames = typeof perf.games === 'number' ? perf.games : (wins + losses + draws)
        const rating = typeof perf.rating === 'number' ? perf.rating : (perf.glicko?.rating || 1500)
        
        result.bullet = {
          rating: rating,
          games: totalGames,
          wins,
          losses,
          draws,
          winRate: totalGames > 0 ? (wins + draws * 0.5) / totalGames : 0,
        }
      }

      if (data.perfs?.classical) {
        const perf = data.perfs.classical
        const wins = typeof perf.win === 'number' ? perf.win : 0
        const losses = typeof perf.loss === 'number' ? perf.loss : 0
        const draws = typeof perf.draw === 'number' ? perf.draw : 0
        const totalGames = typeof perf.games === 'number' ? perf.games : (wins + losses + draws)
        const rating = typeof perf.rating === 'number' ? perf.rating : (perf.glicko?.rating || 1500)
        
        result.classical = {
          rating: rating,
          games: totalGames,
          wins,
          losses,
          draws,
          winRate: totalGames > 0 ? (wins + draws * 0.5) / totalGames : 0,
        }
      }

      if (data.perfs?.puzzle) {
        result.puzzle = {
          rating: typeof data.perfs.puzzle.rating === 'number' ? data.perfs.puzzle.rating : (data.perfs.puzzle.glicko?.rating || 1500),
        }
      }

      // Check if we need to calculate stats from games
      // Lichess perfs object has games count but not win/loss/draw per time control
      const hasStats = result.rapid || result.blitz || result.bullet || result.classical
      
      // Check if we need to calculate stats from games
      // Either: we have games > 0 but no win/loss/draw breakdown
      const needsGameCalculation = hasStats && (
        (result.rapid && result.rapid.games > 0 && (result.rapid.wins === 0 && result.rapid.losses === 0 && result.rapid.draws === 0)) ||
        (result.blitz && result.blitz.games > 0 && (result.blitz.wins === 0 && result.blitz.losses === 0 && result.blitz.draws === 0)) ||
        (result.bullet && result.bullet.games > 0 && (result.bullet.wins === 0 && result.bullet.losses === 0 && result.bullet.draws === 0)) ||
        (result.classical && result.classical.games > 0 && (result.classical.wins === 0 && result.classical.losses === 0 && result.classical.draws === 0))
      )
      
      // Fetch raw games from Lichess to calculate accurate win/loss/draw stats per time control
      if (needsGameCalculation) {
        try {
          const rawGamesUrl = `${LICHESS_API_BASE}/games/user/${username.toLowerCase()}?max=100&pgnInJson=true`
          const rawRes = await fetch(rawGamesUrl, {
            headers: { 'Accept': 'application/x-ndjson' },
            signal: AbortSignal.timeout(15000),
          })
          
          if (rawRes.ok) {
            const rawText = await rawRes.text()
            const rawLines = rawText.trim().split('\n').filter(line => line.trim())
            const statsByPerfRaw = {}
            const userLower = username.toLowerCase()
            
            rawLines.forEach((line) => {
              try {
                const game = JSON.parse(line)
                const perf = game.perf || game.speed || 'unknown'
                const white = (game.players?.white?.user?.name || game.white || '').toLowerCase()
                const black = (game.players?.black?.user?.name || game.black || '').toLowerCase()
                
                const perfMap = {
                  'rapid': 'rapid',
                  'blitz': 'blitz',
                  'bullet': 'bullet',
                  'classical': 'classical',
                  'ultraBullet': 'bullet',
                  'ultrabullet': 'bullet',
                  'correspondence': 'classical',
                }
                const mappedPerf = perfMap[perf] || perf
                
                if (!statsByPerfRaw[mappedPerf]) {
                  statsByPerfRaw[mappedPerf] = { wins: 0, losses: 0, draws: 0 }
                }
                
                const isUserWhite = white === userLower
                const isUserBlack = black === userLower
                
                if (game.status === 'draw' || game.status === 'stalemate' || game.winner === 'draw') {
                  statsByPerfRaw[mappedPerf].draws++
                } else if (game.winner === 'white') {
                  if (isUserWhite) {
                    statsByPerfRaw[mappedPerf].wins++
                  } else if (isUserBlack) {
                    statsByPerfRaw[mappedPerf].losses++
                  }
                } else if (game.winner === 'black') {
                  if (isUserWhite) {
                    statsByPerfRaw[mappedPerf].losses++
                  } else if (isUserBlack) {
                    statsByPerfRaw[mappedPerf].wins++
                  }
                }
              } catch (e) {
                // Skip invalid lines
              }
            })
            
            // Map Lichess perf names to our time controls
            const perfMap = {
              'rapid': 'rapid',
              'blitz': 'blitz',
              'bullet': 'bullet',
              'classical': 'classical',
            }
            
            // Update result with calculated stats (preserving ratings from API)
            Object.entries(statsByPerfRaw).forEach(([perf, stats]) => {
              const timeControl = perfMap[perf] || 'rapid'
              const totalGames = stats.wins + stats.losses + stats.draws
              
              if (totalGames > 0 && result[timeControl]) {
                // Keep the rating from API, but update game counts
                result[timeControl] = {
                  ...result[timeControl],
                  games: Math.max(result[timeControl].games || 0, totalGames), // Use API games count if higher
                  wins: stats.wins,
                  losses: stats.losses,
                  draws: stats.draws,
                  winRate: totalGames > 0 ? (stats.wins + stats.draws * 0.5) / totalGames : 0,
                }
              }
            })
          }
        } catch (error) {
          console.warn('[getLichessStats] Failed to fetch games for accurate stats:', error)
        }
      }

      return result
    } catch (error) {
      console.error('[getLichessStats] Error fetching stats:', error)
      return null
    }
  },

  async getLichessGames(username, maxGames = 20) {
    if (isDemoMode || !username) {
      return []
    }

    const LICHESS_API_BASE = 'https://lichess.org/api'
    const gamesUrl = `${LICHESS_API_BASE}/games/user/${username.toLowerCase()}?max=${maxGames}&pgnInJson=true`

    try {
      const res = await fetch(gamesUrl, {
        headers: {
          'Accept': 'application/x-ndjson',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        return []
      }

      const text = await res.text()
      const lines = text.trim().split('\n').filter(line => line.trim())
      const games = []

      for (const line of lines.slice(0, maxGames)) {
        try {
          const game = JSON.parse(line)
          
          // Extract player names - try API first, then PGN as fallback
          let white = game.players?.white?.user?.name || game.white || ''
          let black = game.players?.black?.user?.name || game.black || ''
          
          // If names are missing, try to extract from PGN
          if ((!white || !black) && game.pgn) {
            const whiteMatch = game.pgn.match(/\[White\s+"([^"]+)"\]/)
            const blackMatch = game.pgn.match(/\[Black\s+"([^"]+)"\]/)
            
            if (whiteMatch && !white) {
              white = whiteMatch[1]
            }
            if (blackMatch && !black) {
              black = blackMatch[1]
            }
          }
          
          // Determine result
          let result = '*'
          if (game.winner === 'white') {
            result = '1-0'
          } else if (game.winner === 'black') {
            result = '0-1'
          } else if (game.status === 'draw' || game.status === 'stalemate') {
            result = '1/2-1/2'
          }

          // Determine if this is a tournament game
          const isTournament = game.event && 
            (game.event.toLowerCase().includes('tournament') || 
             game.event.toLowerCase().includes('arena') ||
             game.event.toLowerCase().includes('swiss'))
          
          // Extract time control/perf type from Lichess game
          const perf = game.perf || game.speed || ''
          const timeControlMap = {
            'rapid': 'Rapid',
            'blitz': 'Blitz',
            'bullet': 'Bullet',
            'ultraBullet': 'Bullet',
            'classical': 'Classical',
            'correspondence': 'Classical',
          }
          const timeControl = perf ? (timeControlMap[perf] || perf.charAt(0).toUpperCase() + perf.slice(1)) : undefined
          
          // Parse end_time: prefer lastMoveAt from API, fallback to PGN date parsing
          let endTime = null
          if (game.lastMoveAt) {
            // lastMoveAt is a Unix timestamp in milliseconds
            endTime = new Date(game.lastMoveAt).toISOString()
          } else if (game.pgn) {
            // Try to parse date from PGN headers
            endTime = parseLichessDate(game.pgn)
          }
          
          games.push({
            white,
            black,
            result,
            pgn: game.pgn || undefined,
            url: game.id ? `https://lichess.org/${game.id}` : undefined,
            end_time: endTime || undefined,
            event_name: game.event || undefined,
            event_id: undefined, // Lichess doesn't have event_id in our system
            source: isTournament ? 'tournament' : 'lichess',
            time_control: timeControl,
          })
        } catch (parseError) {
          // Skip invalid lines
          continue
        }
      }

      return games
    } catch (error) {
      console.error(`[getLichessGames] Failed to fetch games for ${username}:`, error)
      return []
    }
  },

  async getPlayerGames(username) {
    if (isDemoMode || !username) {
      return []
    }

    const user = await this.getPlayer(username)
    if (!user || (!user.chesscom_username && !user.lichess_username)) {
      return []
    }

    const chesscomUsername = user.chesscom_username?.toLowerCase()
    const lichessUsername = user.lichess_username?.toLowerCase()
    const allGames = []

    // Get Chess.com games from archives
    if (chesscomUsername) {
      try {
        const CHESSCOM_API_BASE = 'https://api.chess.com/pub'
        const CORS_PROXIES = [
          { name: 'CorsProxy.io', url: (target) => `https://corsproxy.io/?${encodeURIComponent(target)}` },
          { name: 'AllOrigins', url: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}` },
          { name: 'ProxyCORS', url: (target) => `https://proxy.cors.sh/${target}` },
        ]
        const archivesUrl = `${CHESSCOM_API_BASE}/player/${chesscomUsername}/games/archives`
        let archives = []
        
        try {
          // Create AbortController for better timeout handling
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 seconds
          
          const res = await fetch(archivesUrl, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'ChessBD/1.0' },
            signal: controller.signal,
          })
          clearTimeout(timeoutId)

          if (res.ok) {
            const data = await res.json()
            archives = data.archives || []
          }
        } catch (error) {
          // Try CORS proxies as fallback (important for mobile)
          if (error.name !== 'AbortError') {
            for (const proxy of CORS_PROXIES) {
              try {
                const proxyUrl = proxy.url(archivesUrl)
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 15000)
                
                const res = await fetch(proxyUrl, {
                  headers: { 'Accept': 'application/json', 'User-Agent': 'ChessBD/1.0' },
                  signal: controller.signal,
                })
                clearTimeout(timeoutId)
                
                if (res.ok) {
                  const responseText = await res.text()
                  // Check if response is HTML (proxy error) or JSON
                  if (!responseText.trim().startsWith('<!DOCTYPE') && !responseText.trim().startsWith('<html')) {
                    const data = JSON.parse(responseText)
                    archives = data.archives || []
                    break
                  }
                }
              } catch {
                continue
              }
            }
          }
        }

        if (archives.length > 0) {
          
          // Process all available archives (not just recent ones)
          // Chess.com archives endpoint only returns months where games were played
          // Limit to recent 6 archives for mobile performance
          const archivesToProcess = archives.slice(-6)
          for (const archiveUrl of archivesToProcess) {
            try {
              let gamesData = null
              try {
                // Create AbortController for better timeout handling
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 seconds
                
                const archiveRes = await fetch(archiveUrl, {
                  headers: { 'Accept': 'application/json', 'User-Agent': 'ChessBD/1.0' },
                  signal: controller.signal,
                })
                clearTimeout(timeoutId)

                if (archiveRes.ok) {
                  gamesData = await archiveRes.json()
                }
              } catch (error) {
                // Try CORS proxies as fallback (important for mobile)
                if (error.name !== 'AbortError') {
                  for (const proxy of CORS_PROXIES) {
                    try {
                      const proxyUrl = proxy.url(archiveUrl)
                      const controller = new AbortController()
                      const timeoutId = setTimeout(() => controller.abort(), 15000)
                      
                      const res = await fetch(proxyUrl, {
                        headers: { 'Accept': 'application/json', 'User-Agent': 'ChessBD/1.0' },
                        signal: controller.signal,
                      })
                      clearTimeout(timeoutId)
                      
                      if (res.ok) {
                        const responseText = await res.text()
                        // Check if response is HTML (proxy error) or JSON
                        if (!responseText.trim().startsWith('<!DOCTYPE') && !responseText.trim().startsWith('<html')) {
                          gamesData = JSON.parse(responseText)
                          break
                        }
                      }
                    } catch {
                      continue
                    }
                  }
                }
              }

              if (gamesData) {
                const games = gamesData.games || []
                
                games.forEach((g) => {
                  // Handle different Chess.com API response formats
                  let whiteUsername = ''
                  let blackUsername = ''
                  
                  // Format 1: { white: { username: "..." }, black: { username: "..." } }
                  if (g.white?.username) {
                    whiteUsername = g.white.username.toLowerCase()
                  } else if (typeof g.white === 'string') {
                    whiteUsername = g.white.toLowerCase()
                  } else if (g.white) {
                    whiteUsername = String(g.white).toLowerCase()
                  }
                  
                  if (g.black?.username) {
                    blackUsername = g.black.username.toLowerCase()
                  } else if (typeof g.black === 'string') {
                    blackUsername = g.black.toLowerCase()
                  } else if (g.black) {
                    blackUsername = String(g.black).toLowerCase()
                  }
                  
                  // Only include games where user is white or black
                  if (whiteUsername === chesscomUsername || blackUsername === chesscomUsername) {
                    // Extract result
                    let result = g.result || '0-1'
                    if (g.pgn) {
                      const resultMatch = g.pgn.match(/\[Result\s+"([^"]+)"\]/)
                      if (resultMatch) {
                        result = resultMatch[1]
                      }
                    }
                    
                    // Convert result format
                    if (result === 'win' && g.white?.result === 'win') {
                      result = '1-0'
                    } else if (result === 'win' && g.black?.result === 'win') {
                      result = '0-1'
                    } else if (result === 'agreed' || result === 'repetition' || result === 'stalemate' || result === 'insufficient') {
                      result = '1/2-1/2'
                    }

                    // Extract time control from PGN or API response
                    let timeControl = undefined
                    
                    // Try to get from PGN headers first
                    if (g.pgn) {
                      const timeControlMatch = g.pgn.match(/\[TimeControl\s+"([^"]+)"\]/)
                      if (timeControlMatch) {
                        const tc = timeControlMatch[1]
                        // Map Chess.com time control to readable names
                        if (tc === '1/86400' || tc.includes('86400')) {
                          timeControl = 'Daily'
                        } else if (tc.includes('600') || tc.includes('300')) {
                          timeControl = 'Rapid'
                        } else if (tc.includes('180') || tc.includes('120')) {
                          timeControl = 'Blitz'
                        } else if (tc.includes('60') || tc.includes('30')) {
                          timeControl = 'Bullet'
                        }
                      }
                    }
                    
                    // If not found in PGN, try API response field
                    if (!timeControl && g.time_class) {
                      // Map time_class to readable format
                      const timeClassMap = {
                        'rapid': 'Rapid',
                        'blitz': 'Blitz',
                        'bullet': 'Bullet',
                        'daily': 'Daily',
                        'daily960': 'Daily',
                      }
                      timeControl = timeClassMap[g.time_class] || g.time_class
                    }

                    // Parse end_time using helper function
                    const endTime = parseChesscomTimestamp(g.end_time || g.timestamp)

                    allGames.push({
                      white: whiteUsername,
                      black: blackUsername,
                      result: result,
                      pgn: g.pgn || '',
                      url: g.url || g['@id'] || undefined,
                      end_time: endTime || undefined,
                      source: 'regular',
                      time_control: timeControl,
                    })
                  }
                })
              }
            } catch (error) {
              // Continue to next archive
              continue
            }
          }
        }
      } catch (error) {
        console.error('[getPlayerGames] Error fetching Chess.com games:', error)
      }
    }

    // Get Lichess games using helper function
    if (lichessUsername) {
      try {
        const lichessGames = await this.getLichessGames(lichessUsername, 20)
        
        // Filter games where user is white or black
        const userLichessGames = lichessGames.filter((g) => {
          const white = (g.white || '').toLowerCase()
          const black = (g.black || '').toLowerCase()
          return white === lichessUsername || black === lichessUsername
        })
        
        allGames.push(...userLichessGames)
      } catch (error) {
        console.error('[getPlayerGames] Error fetching Lichess games:', error)
      }
    }

    // Sort by end_time (newest first)
    return allGames.sort((a, b) => {
      const timeA = a.end_time ? new Date(a.end_time).getTime() : 0
      const timeB = b.end_time ? new Date(b.end_time).getTime() : 0
      return timeB - timeA
    })
  },

  async getLichessPlayerProfile(username) {
    if (isDemoMode || !username) {
      return null
    }

    const LICHESS_API_BASE = 'https://lichess.org/api'
    const profileUrl = `${LICHESS_API_BASE}/user/${username}`

    try {
      const res = await fetch(profileUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) {
        console.warn(`[Lichess Profile] Failed with status ${res.status}`)
        return null
      }

      const data = await res.json()

      return {
        username: data.username || username.toLowerCase(),
        title: data.title || undefined,
        name: data.profile?.firstName || data.profile?.lastName ? 
          `${data.profile.firstName || ''} ${data.profile.lastName || ''}`.trim() : undefined,
        bio: data.profile?.bio || undefined,
        country: data.profile?.country || undefined,
        location: data.profile?.location || undefined,
        createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : undefined,
        seenAt: data.seenAt ? new Date(data.seenAt).toISOString() : undefined,
        playTime: data.playTime?.total || undefined,
      }
    } catch (error) {
      console.warn(`[Lichess Profile] Failed to fetch profile:`, error.message)
      return null
    }
  },

  async getJobs(publishedOnly = true) {
    if (isDemoMode) {
      return []
    }

    if (!db) {
      return []
    }

    try {
      const jobsList = await getList('jobs', 'created_at')
      
      // Filter by published status if requested
      if (publishedOnly) {
        return jobsList.filter((job) => job.published)
      }
      
      return jobsList
    } catch (error) {
      console.error('[getJobs] Error fetching jobs:', error)
      return []
    }
  },

  // Forum Posts
  async getForumPosts() {
    if (isDemoMode) {
      return []
    }

    if (!db) {
      return []
    }

    try {
      const posts = await getList(DB_PATHS.forumPosts, 'created_at')
      // Sort: pinned first, then by last_reply_at or created_at
      return posts.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1
        if (!a.is_pinned && b.is_pinned) return 1
        const aTime = a.last_reply_at || a.created_at
        const bTime = b.last_reply_at || b.created_at
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
    } catch (error) {
      console.error('[getForumPosts] Error:', error)
      return []
    }
  },

  async getForumPost(idOrSlug) {
    if (isDemoMode) {
      return null
    }

    if (!db) {
      return null
    }

    try {
      // First, try to get by ID directly (for backward compatibility)
      try {
        const post = await getData(DB_PATHS.forumPosts, idOrSlug)
        if (post) {
          return post
        }
      } catch {
        // Not found by ID, continue to search by slug
      }

      // If not found by ID, search by slug
      const { generateForumPostSlug } = await import('./utils/slug')
      
      // If slug contains a hyphen followed by 4 characters at the end, try to extract ID
      if (idOrSlug.includes('-')) {
        const parts = idOrSlug.split('-')
        if (parts.length > 1) {
          const possibleIdSuffix = parts[parts.length - 1]
          // Try to find post by matching the last 4 characters of ID
          const allPosts = await getList(DB_PATHS.forumPosts)
          for (const post of allPosts) {
            if (post.id && post.id.slice(-4) === possibleIdSuffix) {
              const postSlug = generateForumPostSlug(post.title, post.id)
              if (postSlug === idOrSlug) {
                return post
              }
            }
          }
        }
      }

      // If still not found, search all posts and match by slug
      const allPosts = await getList(DB_PATHS.forumPosts)
      
      for (const post of allPosts) {
        const postSlug = generateForumPostSlug(post.title, post.id)
        if (postSlug === idOrSlug) {
          return post
        }
      }

      return null
    } catch (error) {
      console.error('[getForumPost] Error:', error)
      return null
    }
  },

  async createForumPost(post) {
    if (isDemoMode) {
      throw new Error('Demo mode: Cannot create forum post')
    }

    if (!db) {
      throw new Error('Firebase not configured')
    }
    
    const now = new Date().toISOString()
    const newPost = {
      ...post,
      replies_count: 0,
      views_count: 0,
      is_pinned: false,
      is_locked: false,
      created_at: now,
      updated_at: now,
    }
    
    const postRef = await addDoc(collection(db, DB_PATHS.forumPosts), newPost)
    return { id: postRef.id, ...newPost }
  },

  async updateForumPost(id, updates) {
    if (isDemoMode) {
      throw new Error('Demo mode: Cannot update forum post')
    }

    if (!db) {
      throw new Error('Firebase not configured')
    }
    
    const updatesWithTimestamp = {
      ...updates,
      updated_at: new Date().toISOString(),
    }
    
    await updateDoc(doc(db, DB_PATHS.forumPosts, id), updatesWithTimestamp)
    
    const updatedPost = await this.getForumPost(id)
    if (!updatedPost) throw new Error('Post not found after update')
    return updatedPost
  },

  async deleteForumPost(id) {
    if (isDemoMode) {
      throw new Error('Demo mode: Cannot delete forum post')
    }

    if (!db) {
      throw new Error('Firebase not configured')
    }
    
    await deleteDoc(doc(db, DB_PATHS.forumPosts, id))
    // Also delete all replies
    const replies = await getList(DB_PATHS.forumReplies)
    const postReplies = replies.filter(r => r.post_id === id)
    for (const reply of postReplies) {
      await deleteDoc(doc(db, DB_PATHS.forumReplies, reply.id))
    }
  },

  // Forum Replies
  async getForumReplies(postId) {
    if (isDemoMode) {
      return []
    }

    if (!db) {
      return []
    }

    try {
      const replies = await getList(DB_PATHS.forumReplies)
      return replies
        .filter(r => r.post_id === postId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    } catch (error) {
      console.error('[getForumReplies] Error:', error)
      return []
    }
  },

  async createForumReply(reply) {
    if (isDemoMode) {
      throw new Error('Demo mode: Cannot create forum reply')
    }

    if (!db) {
      throw new Error('Firebase not configured')
    }
    
    const now = new Date().toISOString()
    const newReply = {
      ...reply,
      created_at: now,
      updated_at: now,
    }
    
    const replyRef = await addDoc(collection(db, DB_PATHS.forumReplies), newReply)
    
    // Update post's last_reply_at and replies_count
    const post = await this.getForumPost(reply.post_id)
    if (post) {
      await this.updateForumPost(reply.post_id, {
        last_reply_at: now,
        replies_count: (post.replies_count || 0) + 1,
      })
    }
    
    return { id: replyRef.id, ...newReply }
  },

  async deleteForumReply(id, postId) {
    if (isDemoMode) {
      throw new Error('Demo mode: Cannot delete forum reply')
    }

    if (!db) {
      throw new Error('Firebase not configured')
    }
    
    await deleteDoc(doc(db, DB_PATHS.forumReplies, id))
    
    // Update post's replies_count
    const post = await this.getForumPost(postId)
    if (post) {
      const replies = await this.getForumReplies(postId)
      const lastReply = replies.length > 0 ? replies[replies.length - 1] : null
      await this.updateForumPost(postId, {
        replies_count: replies.length,
        last_reply_at: lastReply?.created_at || null,
      })
    }
  },

  // Watch Page API Functions
  async getLichessCurrentGame(username) {
    if (!username) {
      return null
    }

    const LICHESS_API_BASE = 'https://lichess.org/api'
    const currentGameUrl = `${LICHESS_API_BASE}/user/${username.toLowerCase()}/current-game`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const res = await fetch(currentGameUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        // 404 means user is not currently playing
        if (res.status === 404) {
          return null
        }
        console.warn(`[Lichess Current Game] Failed with status ${res.status} for ${username}`)
        return null
      }

      const game = await res.json()
      
      if (!game || !game.id) {
        console.warn(`[Lichess Current Game] No game ID found for ${username}`)
        return null
      }

      // Lichess API returns player data in different formats
      const whitePlayer = game.white || game.players?.white || game.whitePlayer
      const blackPlayer = game.black || game.players?.black || game.blackPlayer
      
      // Extract username - handle AI players
      const getUsername = (player) => {
        if (!player) return ''
        if (player.aiLevel !== undefined) {
          return `AI Level ${player.aiLevel}`
        }
        if (typeof player === 'string') return player
        if (player.username) return player.username
        if (player.name) return player.name
        if (player.user?.name) return player.user.name
        if (player.user?.username) return player.user.username
        if (player.user?.id) return player.user.id
        if (player.id) return player.id
        return ''
      }
      
      const getRating = (player) => {
        if (!player) return undefined
        return player.rating || player.user?.rating || player.ratingDiff
      }
      
      const whiteUsername = getUsername(whitePlayer)
      const blackUsername = getUsername(blackPlayer)

      // Construct PGN from moves
      let pgn = undefined
      if (game.moves) {
        const movesList = game.moves.split(' ').filter(m => m.trim())
        let pgnMoves = ''
        for (let i = 0; i < movesList.length; i++) {
          const moveNum = Math.floor(i / 2) + 1
          if (i % 2 === 0) {
            pgnMoves += `${moveNum}.${movesList[i]}`
          } else {
            pgnMoves += ` ${movesList[i]}`
            if (i < movesList.length - 1) {
              pgnMoves += ' '
            }
          }
        }
        pgn = `[Event "Live Game"]\n[Site "lichess.org"]\n[White "${whiteUsername}"]\n[Black "${blackUsername}"]\n[Variant "${game.variant || 'Standard'}"]\n[TimeControl "${game.speed || 'correspondence'}"]\n\n${pgnMoves.trim()}`
      }
      
      return {
        id: game.id,
        white: {
          username: whiteUsername || 'Unknown Player',
          rating: getRating(whitePlayer),
        },
        black: {
          username: blackUsername || 'Unknown Player',
          rating: getRating(blackPlayer),
        },
        speed: game.speed || game.perf?.key || game.variant || 'unknown',
        perf: game.perf?.key || game.perf || game.speed || game.variant || 'unknown',
        clock: game.clock ? {
          initial: game.clock.initial || game.clock.limit || 0,
          increment: game.clock.increment || 0,
        } : undefined,
        url: `https://lichess.org/${game.id}`,
        createdAt: game.createdAt ? new Date(game.createdAt).toISOString() : new Date().toISOString(),
        pgn,
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return null
      }
      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        return null
      }
      console.warn(`[Lichess Current Game] Failed to fetch current game for ${username}:`, error.message)
      return null
    }
  },

  async isLichessUserPlaying(username) {
    if (!username) {
      return false
    }

    const LICHESS_API_BASE = 'https://lichess.org/api'
    const userStatusUrl = `${LICHESS_API_BASE}/users/status?ids=${username.toLowerCase()}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const res = await fetch(userStatusUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        return false
      }

      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const userStatus = data[0]
        return userStatus.playing === true || (userStatus.count && userStatus.count.playing > 0)
      }
      return false
    } catch (error) {
      if (error.name === 'AbortError') {
        return false
      }
      return false
    }
  },

  async getChessBDLiveGames() {
    if (isDemoMode) {
      return []
    }

    if (!db) {
      console.warn('[ChessBD Live Games] Firebase database not configured')
      return []
    }

    try {
      // Get all users with verified Lichess accounts
      const allUsers = await getList(DB_PATHS.users)
      const verifiedLichessUsers = allUsers.filter(
        (user) => user.lichess_username && user.lichess_verified_at
      )

      if (verifiedLichessUsers.length === 0) {
        return []
      }

      const liveGames = []

      // Process users in batches to avoid overwhelming the API
      const batchSize = 10
      for (let i = 0; i < verifiedLichessUsers.length; i += batchSize) {
        const batch = verifiedLichessUsers.slice(i, i + batchSize)
        const batchPromises = batch.map(async (user) => {
          try {
            // First check if user is actually playing
            const isPlaying = await this.isLichessUserPlaying(user.lichess_username)
            
            if (!isPlaying) {
              return
            }

            // User is playing, fetch the current game
            const currentGame = await this.getLichessCurrentGame(user.lichess_username)
            if (currentGame) {
              // Verify this ChessBD user is playing (either white or black)
              const userLichessUsername = user.lichess_username.toLowerCase()
              const whiteUsername = currentGame.white.username.toLowerCase()
              const blackUsername = currentGame.black.username.toLowerCase()
              const isUserInGame = 
                whiteUsername === userLichessUsername ||
                blackUsername === userLichessUsername

              if (isUserInGame) {
                liveGames.push({
                  ...currentGame,
                  chessbdUser: {
                    id: user.id,
                    name: user.name || null,
                    lichess_username: user.lichess_username,
                  },
                })
              }
            }
          } catch (error) {
            console.warn(`[ChessBD Live Games] Error checking game for ${user.lichess_username}:`, error.message)
          }
        })

        await Promise.all(batchPromises)
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < verifiedLichessUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      return liveGames
    } catch (error) {
      console.warn('[ChessBD Live Games] Error fetching live games:', error.message)
      return []
    }
  },

  async checkTwitchLive(username) {
    if (!username) return { isLive: false }
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      // Using a public API to check if streamer is live
      const response = await fetch(`https://decapi.me/twitch/uptime/${username}`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const text = await response.text()
        // If channel is live, returns uptime like "2h 30m", otherwise "offline"
        if (text && !text.toLowerCase().includes('offline') && !text.toLowerCase().includes('not found')) {
          // Try to get viewer count and title
          try {
            const viewerResponse = await fetch(`https://decapi.me/twitch/viewercount/${username}`, {
              signal: AbortSignal.timeout(5000),
            })
            const titleResponse = await fetch(`https://decapi.me/twitch/title/${username}`, {
              signal: AbortSignal.timeout(5000),
            })
            
            const viewerCount = viewerResponse.ok ? parseInt(await viewerResponse.text()) : undefined
            const title = titleResponse.ok ? await titleResponse.text() : undefined

            return {
              isLive: true,
              viewerCount: isNaN(viewerCount) ? undefined : viewerCount,
              title: title || undefined,
              game: undefined,
            }
          } catch {
            return {
              isLive: true,
              viewerCount: undefined,
              title: undefined,
              game: undefined,
            }
          }
        }
      }
      return { isLive: false }
    } catch (error) {
      if (error.name === 'AbortError') {
        return { isLive: false }
      }
      console.debug(`[checkTwitchLive] Failed to check Twitch status for ${username}:`, error.message)
      return { isLive: false }
    }
  },

  async checkYouTubeLive(channelId) {
    if (!channelId) return { isLive: false }
    
    try {
      // Extract channel ID from URL if it's a full URL
      let cleanChannelId = channelId
      if (channelId.includes('youtube.com/@')) {
        // Extract username from URL
        const match = channelId.match(/@([^/?]+)/)
        cleanChannelId = match ? match[1] : channelId
      } else if (channelId.includes('youtube.com/channel/')) {
        const match = channelId.match(/channel\/([^/?]+)/)
        cleanChannelId = match ? match[1] : channelId
      }
      
      const CORS_PROXIES = [
        {
          name: 'AllOrigins',
          url: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
        },
        {
          name: 'CorsProxy.io',
          url: (target) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
        },
      ]
      
      const targetUrl = `https://www.youtube.com/@${cleanChannelId}/live`
      
      // Try direct first, then proxies
      let isLive = false
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const directResponse = await fetch(targetUrl, {
          signal: controller.signal,
          redirect: 'follow',
        })

        clearTimeout(timeoutId)
        
        if (directResponse.ok) {
          const html = await directResponse.text()
          isLive = html.includes('"isLive":true') || html.includes('LIVE') || html.includes('live-now')
          if (isLive) return { isLive: true }
        }
      } catch (directError) {
        // Direct fetch failed, try proxies
        console.debug(`[checkYouTubeLive] Direct fetch failed, trying proxies...`)
      }
      
      // Try proxies
      for (const proxy of CORS_PROXIES) {
        try {
          const proxyUrl = proxy.url(targetUrl)
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)

          const response = await fetch(proxyUrl, {
            signal: controller.signal,
          })

          clearTimeout(timeoutId)
          
          if (response.ok) {
            const html = await response.text()
            // Check if response is HTML (proxy error page)
            if (html.trim().startsWith('<!DOCTYPE') || html.trim().startsWith('<html')) {
              continue
            }
            
            isLive = html.includes('"isLive":true') || html.includes('LIVE') || html.includes('live-now')
            if (isLive) return { isLive: true }
          }
        } catch (error) {
          continue
        }
      }
      
      return { isLive: false }
    } catch (error) {
      if (error.name === 'AbortError') {
        return { isLive: false }
      }
      console.debug(`[checkYouTubeLive] Failed to check YouTube status for ${channelId}:`, error.message)
      return { isLive: false }
    }
  },

  async checkKickLive(username) {
    if (!username) return { isLive: false }
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`https://kick.com/api/v2/channels/${username}`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        if (data.livestream) {
          return {
            isLive: true,
            viewerCount: data.livestream.viewer_count || undefined,
            title: data.livestream.session_title || undefined,
          }
        }
      }
      return { isLive: false }
    } catch (error) {
      if (error.name === 'AbortError') {
        return { isLive: false }
      }
      console.debug(`[checkKickLive] Failed to check Kick status for ${username}:`, error.message)
      return { isLive: false }
    }
  },

  async checkChesscomLive(username) {
    if (!username) return { isLive: false }
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      // Chess.com doesn't have a public API for streaming status
      // We'll check if the user has streaming info in their profile
      const response = await fetch(`https://api.chess.com/pub/player/${username}`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        // If user has twitch_url, they might be streaming
        // But we can't verify if they're actually live without Twitch API
        if (data.twitch_url) {
          // Extract Twitch username and check if live
          const twitchMatch = data.twitch_url.match(/(?:twitch\.tv\/)([^\/\s?]+)/i)
          if (twitchMatch) {
            const twitchUsername = twitchMatch[1]
            return await this.checkTwitchLive(twitchUsername)
          }
        }
      }
      return { isLive: false }
    } catch (error) {
      if (error.name === 'AbortError') {
        return { isLive: false }
      }
      console.debug(`[checkChesscomLive] Failed to check Chess.com status for ${username}:`, error.message)
      return { isLive: false }
    }
  },

  async getLiveStreamers() {
    if (isDemoMode) {
      return []
    }

    if (!db) {
      console.warn('[Live Streamers] Firebase database not configured')
      return []
    }

    try {
      // Get all users with is_streamer = true
      const allUsers = await getList(DB_PATHS.users)
      const streamers = allUsers.filter(user => user.is_streamer === true)

      // Get manual streams (if the collection exists)
      let manualStreams = []
      try {
        manualStreams = await getList(DB_PATHS.manualStreams, 'created_at')
      } catch (error) {
        // Manual streams collection might not exist, that's okay
        console.debug('[Live Streamers] Manual streams collection not found or error:', error.message)
      }

      const liveStreamers = []

      // Check ChessBD user streamers (priority 1)
      await Promise.all(streamers.map(async (streamer) => {
        const checks = []
        
        if (streamer.twitch_username) {
          checks.push(
            this.checkTwitchLive(streamer.twitch_username).then(result => ({
              platform: 'twitch',
              isLive: result.isLive,
              viewerCount: result.viewerCount,
              title: result.title,
              game: result.game,
            }))
          )
        }
        
        if (streamer.youtube_channel) {
          checks.push(
            this.checkYouTubeLive(streamer.youtube_channel).then(result => ({
              platform: 'youtube',
              isLive: result.isLive,
              viewerCount: result.viewerCount,
              title: result.title,
              game: undefined,
            }))
          )
        }
        
        if (streamer.kick_username) {
          checks.push(
            this.checkKickLive(streamer.kick_username).then(result => ({
              platform: 'kick',
              isLive: result.isLive,
              viewerCount: result.viewerCount,
              title: result.title,
              game: undefined,
            }))
          )
        }
        
        // Check chess.com if user has a chess.com username and is a streamer
        if (streamer.chesscom_username) {
          checks.push(
            this.checkChesscomLive(streamer.chesscom_username).then(result => ({
              platform: 'chesscom',
              isLive: result.isLive,
              viewerCount: result.viewerCount,
              title: result.title,
              game: result.game,
            }))
          )
        }
        
        const results = await Promise.all(checks)
        const liveResult = results.find(r => r.isLive)
        
        if (liveResult) {
          liveStreamers.push({
            ...streamer,
            livePlatform: liveResult.platform,
            liveInfo: {
              viewerCount: liveResult.viewerCount,
              title: liveResult.title,
              game: liveResult.game,
            },
          })
        }
      }))
      
      // Check manual streams (priority 2)
      await Promise.all(manualStreams.map(async (manualStream) => {
        let checkResult = null
        
        if (manualStream.platform === 'twitch') {
          checkResult = await this.checkTwitchLive(manualStream.username)
        } else if (manualStream.platform === 'youtube') {
          checkResult = await this.checkYouTubeLive(manualStream.username)
        } else if (manualStream.platform === 'kick') {
          checkResult = await this.checkKickLive(manualStream.username)
        } else if (manualStream.platform === 'chesscom') {
          checkResult = await this.checkChesscomLive(manualStream.username)
        }
        
        if (checkResult?.isLive) {
          liveStreamers.push({
            ...manualStream,
            livePlatform: manualStream.platform,
            liveInfo: {
              viewerCount: checkResult.viewerCount,
              title: checkResult.title,
              game: checkResult.game,
            },
          })
        }
      }))

      return liveStreamers
    } catch (error) {
      console.warn('[Live Streamers] Error fetching live streamers:', error.message)
      return []
    }
  },

  async getChesscomTournamentSettings(eventId) {
    if (isDemoMode) {
      return null
    }

    if (!db) throw new Error('Firebase not configured')

    const event = await getData(DB_PATHS.events, eventId)
    if (!event) {
      return null
    }
    if (!event.chesscom_club_id || !event.chesscom_tournament_id) {
      return null
    }

    let tournamentId = event.chesscom_tournament_id
    
    // Construct tournament ID in name-id format
    // For finished tournaments, the API endpoint is the same, but we ensure proper format
    if (tournamentId && /^\d+$/.test(tournamentId)) {
      const { slugify } = await import('./utils/slug.js')
      const eventNameSlug = slugify(event.name)
      tournamentId = `${eventNameSlug}-${tournamentId}`
    }
    
    // Chess.com API uses the same endpoint for both live and finished tournaments
    // Format: https://api.chess.com/pub/tournament/{name-id}
    // The URL stays the same whether tournament is in progress or finished
    const CHESSCOM_API_BASE = 'https://api.chess.com/pub'
    const tournamentUrl = `${CHESSCOM_API_BASE}/tournament/${tournamentId}`

    let tournamentData = null

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const res = await fetch(tournamentUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (res.ok) {
        const responseText = await res.text()
        if (!responseText.trim().startsWith('<!DOCTYPE') && !responseText.trim().startsWith('<html')) {
          try {
            tournamentData = JSON.parse(responseText)
            if (tournamentData.code !== undefined || tournamentData.message) {
              tournamentData = null
            }
          } catch (parseError) {
            tournamentData = null
          }
        }
      }
    } catch (error) {
      tournamentData = null
    }

    if (tournamentData) {
      const result = {}

      // Map status
      if (tournamentData.status) {
        if (tournamentData.status === 'registration' || tournamentData.status === 'scheduled') {
          result.status = 'upcoming'
        } else if (tournamentData.status === 'in_progress' || tournamentData.status === 'started') {
          result.status = 'in_progress'
        } else if (tournamentData.status === 'finished' || tournamentData.status === 'completed') {
          result.status = 'finished'
        }
      }

      // Extract settings
      if (tournamentData.settings) {
        result.settings = {
          type: tournamentData.settings.type,
          rules: tournamentData.settings.rules,
          is_rated: tournamentData.settings.is_rated,
          is_official: tournamentData.settings.is_official,
          time_class: tournamentData.settings.time_class,
          time_control: tournamentData.settings.time_control,
          registered_user_count: tournamentData.settings.registered_user_count,
          total_rounds: tournamentData.settings.total_rounds,
          winner_places: tournamentData.settings.winner_places,
          initial_setup: tournamentData.settings.initial_setup,
        }
      }

      // Extract participants
      if (tournamentData.players && Array.isArray(tournamentData.players)) {
        result.participants = tournamentData.players.map((p) => {
          if (typeof p === 'string') {
            return { username: p.toLowerCase(), status: 'registered' }
          }
          return {
            username: (p.username || p.name || p.player || p).toLowerCase(),
            status: p.status || 'registered',
          }
        })
      }

      return result
    }

    return null
  },

  async getChesscomTournamentStandings(eventId) {
    if (isDemoMode) {
      return null
    }

    if (!db) throw new Error('Firebase not configured')

    const event = await getData(DB_PATHS.events, eventId)
    if (!event || !event.chesscom_club_id || !event.chesscom_tournament_id) {
      return null
    }

    let tournamentId = event.chesscom_tournament_id
    
    // Construct tournament ID in name-id format
    // For finished tournaments, the API endpoint is the same, but we ensure proper format
    if (tournamentId && /^\d+$/.test(tournamentId)) {
      const { slugify } = await import('./utils/slug.js')
      const eventNameSlug = slugify(event.name)
      tournamentId = `${eventNameSlug}-${tournamentId}`
    }
    
    // Chess.com API uses the same endpoint for both live and finished tournaments
    // Format: https://api.chess.com/pub/tournament/{name-id}
    // The URL stays the same whether tournament is finished or not
    const CHESSCOM_API_BASE = 'https://api.chess.com/pub'
    const tournamentUrl = `${CHESSCOM_API_BASE}/tournament/${tournamentId}`

    let tournamentData = null

    // Direct API call only (no proxy) - CORS errors will be caught and handled gracefully
    // Same pattern as getChesscomStats which works on mobile
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 seconds timeout
      
      const res = await fetch(tournamentUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (res.ok) {
        const responseText = await res.text()
        if (!responseText.trim().startsWith('<!DOCTYPE') && !responseText.trim().startsWith('<html')) {
          try {
            tournamentData = JSON.parse(responseText)
            if (tournamentData.code !== undefined || tournamentData.message) {
              tournamentData = null
            }
          } catch (parseError) {
            tournamentData = null
          }
        }
      }
    } catch (error) {
      // CORS errors and other network errors are expected - handle gracefully
      // Return null instead of throwing, same as getChesscomStats
      tournamentData = null
    }

    if (!tournamentData || !tournamentData.rounds) {
      return null
    }

    // Fetch standings from rounds/groups
    const standingsMap = new Map()

    if (tournamentData.rounds && Array.isArray(tournamentData.rounds) && tournamentData.rounds.length > 0) {
      const roundPromises = tournamentData.rounds.map(async (roundUrl) => {
        
        let roundData = null

        // Direct API call only (no proxy) - Same pattern as getChesscomStats
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 seconds timeout
          
          const roundRes = await fetch(roundUrl, {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (roundRes.ok) {
            const roundText = await roundRes.text()
            if (!roundText.trim().startsWith('<!DOCTYPE') && !roundText.trim().startsWith('<html')) {
              try {
                roundData = JSON.parse(roundText)
              } catch (parseError) {
                roundData = null
              }
            }
          }
        } catch (error) {
          roundData = null
        }

        if (roundData) {
          const roundStandings = []
          
          if (roundData.groups && Array.isArray(roundData.groups) && roundData.groups.length > 0) {
              const groupPromises = roundData.groups.map(async (groupUrl) => {
                // Direct API call only (no proxy) - Same pattern as getChesscomStats
                  try {
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 seconds timeout
                    
                    const groupRes = await fetch(groupUrl, {
                      headers: { 'Accept': 'application/json' },
                      signal: controller.signal,
                    })

                    clearTimeout(timeoutId)

                    if (!groupRes.ok) {
                    return { standings: [] }
                    }

                    const groupText = await groupRes.text()
                    if (groupText.trim().startsWith('<!DOCTYPE') || groupText.trim().startsWith('<html')) {
                    return { standings: [] }
                  }

                  let groupData = null
                  try {
                    groupData = JSON.parse(groupText)
                  } catch (parseError) {
                    return { standings: [] }
                  }

                  if (!groupData) {
                    return { standings: [] }
                  }

                    const groupStandings = []
                    
                    // Check for standings array
                    if (groupData.standings && Array.isArray(groupData.standings)) {
                      groupData.standings.forEach((s) => {
                        const username = (s.username || s.player || s.name || s.player_name || s)?.toLowerCase()
                        if (username) {
                          const score = s.points !== undefined ? s.points : (s.score !== undefined ? s.score : 0)
                          const rank = s.place_finish !== undefined ? s.place_finish : (s.rank !== undefined ? s.rank : 0)
                          const tiebreak = s.tiebreak !== undefined ? s.tiebreak : (s.sb !== undefined ? s.sb : 0)
                          groupStandings.push({ rank, username, score, tiebreak })
                        }
                      })
                    }
                    // Check for players array (alternative format)
                    if (groupData.players && Array.isArray(groupData.players)) {
                      groupData.players.forEach((s) => {
                        // Handle different data structures
                        let username = null
                        if (typeof s === 'string') {
                          username = s.toLowerCase()
                        } else if (s && typeof s === 'object') {
                          username = (s.username || s.player || s.name || s.player_name || '')
                          if (username && typeof username === 'string') {
                            username = username.toLowerCase()
                          } else {
                            username = null
                          }
                        }
                        
                        if (username) {
                          const score = s.points !== undefined ? s.points : (s.score !== undefined ? s.score : 0)
                          const rank = s.place_finish !== undefined ? s.place_finish : (s.rank !== undefined ? s.rank : 0)
                          const tiebreak = s.tiebreak !== undefined ? s.tiebreak : (s.sb !== undefined ? s.sb : 0)
                          groupStandings.push({ rank, username, score, tiebreak })
                        }
                      })
                    }
                    
                    return { standings: groupStandings }
                  } catch (e) {
                return { standings: [] }
                }
              })
              
              const groupResults = await Promise.all(groupPromises)
              groupResults.forEach(({ standings }) => {
                roundStandings.push(...standings)
              })
            } else {
              // Check for standings array
              if (roundData.standings && Array.isArray(roundData.standings)) {
                roundData.standings.forEach((s) => {
                  const username = (s.username || s.player || s.name || s.player_name || s)?.toLowerCase()
                  if (username) {
                    const score = s.points !== undefined ? s.points : (s.score !== undefined ? s.score : 0)
                    const rank = s.place_finish !== undefined ? s.place_finish : (s.rank !== undefined ? s.rank : 0)
                    const tiebreak = s.tiebreak !== undefined ? s.tiebreak : (s.sb !== undefined ? s.sb : 0)
                    roundStandings.push({ rank, username, score, tiebreak })
                  }
                })
              }
              // Check for players array (alternative format)
              if (roundData.players && Array.isArray(roundData.players)) {
                roundData.players.forEach((s, index) => {
                  // Handle different data structures
                  let username = null
                  if (typeof s === 'string') {
                    username = s.toLowerCase()
                  } else if (s && typeof s === 'object') {
                    username = (s.username || s.player || s.name || s.player_name || '')
                    if (username && typeof username === 'string') {
                      username = username.toLowerCase()
                    } else {
                      username = null
                    }
                  }
                  
                  if (username) {
                    const score = s.points !== undefined ? s.points : (s.score !== undefined ? s.score : 0)
                    const rank = s.place_finish !== undefined ? s.place_finish : (s.rank !== undefined ? s.rank : 0)
                    const tiebreak = s.tiebreak !== undefined ? s.tiebreak : (s.sb !== undefined ? s.sb : 0)
                    roundStandings.push({ rank, username, score, tiebreak })
                  }
                })
              }
            }
            
          return { standings: roundStandings }
        }
        
        // If all proxies failed
        return { standings: [] }
      })
      
      const roundResults = await Promise.allSettled(roundPromises)
      
      roundResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { standings } = result.value
          standings.forEach((s) => {
            standingsMap.set(s.username, s)
          })
        } else {
          console.error('[getChesscomTournamentStandings] Round promise rejected:', result.reason)
        }
      })
    }

    // Convert standings map to sorted array
    const standings = Array.from(standingsMap.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.tiebreak !== undefined && b.tiebreak !== undefined) {
          if (b.tiebreak !== a.tiebreak) return b.tiebreak - a.tiebreak
        }
        return (a.rank || 0) - (b.rank || 0)
      })
      .map((s, index) => ({
        ...s,
        rank: index + 1,
      }))

    return standings.length > 0 ? standings : null
  },

  async getChesscomTournamentGames(eventId) {
    if (isDemoMode) {
      return null
    }

    if (!db) throw new Error('Firebase not configured')

    const event = await getData(DB_PATHS.events, eventId)
    if (!event || !event.chesscom_club_id || !event.chesscom_tournament_id) {
      return null
    }

    let tournamentId = event.chesscom_tournament_id
    
    // Construct tournament ID in name-id format
    if (tournamentId && /^\d+$/.test(tournamentId)) {
      const { slugify } = await import('./utils/slug.js')
      const eventNameSlug = slugify(event.name)
      tournamentId = `${eventNameSlug}-${tournamentId}`
    }
    
    const CHESSCOM_API_BASE = 'https://api.chess.com/pub'
    const tournamentUrl = `${CHESSCOM_API_BASE}/tournament/${tournamentId}`

    let tournamentData = null

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const res = await fetch(tournamentUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (res.ok) {
        const responseText = await res.text()
        if (!responseText.trim().startsWith('<!DOCTYPE') && !responseText.trim().startsWith('<html')) {
          try {
            tournamentData = JSON.parse(responseText)
            if (tournamentData.code !== undefined || tournamentData.message) {
              tournamentData = null
            }
          } catch (parseError) {
            tournamentData = null
          }
        }
      }
    } catch (error) {
      tournamentData = null
    }

    if (!tournamentData || !tournamentData.rounds) {
      return null
    }

    // Fetch games from rounds/groups
    const allGames = []

    if (tournamentData.rounds && Array.isArray(tournamentData.rounds) && tournamentData.rounds.length > 0) {
      const roundPromises = tournamentData.rounds.map(async (roundUrl) => {
        let roundData = null
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)
          
          const roundRes = await fetch(roundUrl, {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (roundRes.ok) {
            const roundText = await roundRes.text()
            if (!roundText.trim().startsWith('<!DOCTYPE') && !roundText.trim().startsWith('<html')) {
              try {
                roundData = JSON.parse(roundText)
              } catch (parseError) {
                roundData = null
              }
            }
          }
        } catch (error) {
          roundData = null
        }

        if (!roundData) {
          return { games: [] }
        }

        const roundGames = []
        
        if (roundData.groups && Array.isArray(roundData.groups) && roundData.groups.length > 0) {
          const groupPromises = roundData.groups.map(async (groupUrl) => {
            let groupData = null
            try {
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 10000)
              
              const groupRes = await fetch(groupUrl, {
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
              })

              clearTimeout(timeoutId)

              if (!groupRes.ok) {
                return { games: [] }
              }

              const groupText = await groupRes.text()
              if (groupText.trim().startsWith('<!DOCTYPE') || groupText.trim().startsWith('<html')) {
                return { games: [] }
              }

              try {
                groupData = JSON.parse(groupText)
              } catch (parseError) {
                return { games: [] }
              }

              if (!groupData) {
                return { games: [] }
              }

              const groupGames = []
              
              if (groupData.games && Array.isArray(groupData.games)) {
                groupData.games.forEach((g) => {
                  const whiteUsername = g.white?.username || g.white || ''
                  const blackUsername = g.black?.username || g.black || ''
                  
                  let result = g.result || '0-1'
                  if (g.pgn) {
                    const resultMatch = g.pgn.match(/\[Result\s+"([^"]+)"\]/)
                    if (resultMatch) {
                      result = resultMatch[1]
                    }
                  }
                  
                  if (result === 'win' && g.white?.result === 'win') {
                    result = '1-0'
                  } else if (result === 'win' && g.black?.result === 'win') {
                    result = '0-1'
                  } else if (result === 'agreed' || result === 'repetition' || result === 'stalemate' || result === 'insufficient') {
                    result = '1/2-1/2'
                  }
                  
                  const endTime = parseChesscomTimestamp(g.end_time || g.timestamp)

                  let timeControl = undefined
                  if (g.pgn) {
                    const timeControlMatch = g.pgn.match(/\[TimeControl\s+"([^"]+)"\]/)
                    if (timeControlMatch) {
                      const tc = timeControlMatch[1]
                      if (tc === '1/86400' || tc.includes('86400')) {
                        timeControl = 'Daily'
                      } else if (tc.includes('600') || tc.includes('300')) {
                        timeControl = 'Rapid'
                      } else if (tc.includes('180') || tc.includes('120')) {
                        timeControl = 'Blitz'
                      } else if (tc.includes('60') || tc.includes('30')) {
                        timeControl = 'Bullet'
                      }
                    }
                  }
                  if (!timeControl && g.time_class) {
                    timeControl = g.time_class.charAt(0).toUpperCase() + g.time_class.slice(1)
                  }

                  groupGames.push({
                    white: whiteUsername.toLowerCase(),
                    black: blackUsername.toLowerCase(),
                    result: result,
                    pgn: g.pgn || '',
                    url: g.url || g['@id'] || null,
                    end_time: endTime,
                    time_control: timeControl,
                  })
                })
              }
              
              return { games: groupGames }
            } catch (e) {
              return { games: [] }
            }
          })
          
          const groupResults = await Promise.all(groupPromises)
          groupResults.forEach(({ games }) => {
            roundGames.push(...games)
          })
        } else {
          if (roundData.games && Array.isArray(roundData.games)) {
            roundData.games.forEach((g) => {
              const whiteUsername = g.white?.username || g.white || ''
              const blackUsername = g.black?.username || g.black || ''
              
              let result = g.result || '0-1'
              if (g.pgn) {
                const resultMatch = g.pgn.match(/\[Result\s+"([^"]+)"\]/)
                if (resultMatch) {
                  result = resultMatch[1]
                }
              }
              
              if (result === 'win' && g.white?.result === 'win') {
                result = '1-0'
              } else if (result === 'win' && g.black?.result === 'win') {
                result = '0-1'
              } else if (result === 'agreed' || result === 'repetition' || result === 'stalemate' || result === 'insufficient') {
                result = '1/2-1/2'
              }
              
              let timeControl = undefined
              if (g.pgn) {
                const timeControlMatch = g.pgn.match(/\[TimeControl\s+"([^"]+)"\]/)
                if (timeControlMatch) {
                  const tc = timeControlMatch[1]
                  if (tc === '1/86400' || tc.includes('86400')) {
                    timeControl = 'Daily'
                  } else if (tc.includes('600') || tc.includes('300')) {
                    timeControl = 'Rapid'
                  } else if (tc.includes('180') || tc.includes('120')) {
                    timeControl = 'Blitz'
                  } else if (tc.includes('60') || tc.includes('30')) {
                    timeControl = 'Bullet'
                  }
                }
              }
              if (!timeControl && g.time_class) {
                timeControl = g.time_class.charAt(0).toUpperCase() + g.time_class.slice(1)
              }
              
              roundGames.push({
                white: whiteUsername.toLowerCase(),
                black: blackUsername.toLowerCase(),
                result: result,
                pgn: g.pgn || '',
                url: g.url || g['@id'] || null,
                end_time: parseChesscomTimestamp(g.end_time || g.timestamp),
                time_control: timeControl,
              })
            })
          }
        }
        
        return { games: roundGames }
      })
      
      const roundResults = await Promise.allSettled(roundPromises)
      
      roundResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { games } = result.value
          allGames.push(...games)
        }
      })
    }

    return allGames.length > 0 ? allGames : null
  },

  async getLichessTournamentGames(eventId, signal) {
    if (isDemoMode) {
      return null
    }

    if (!db) throw new Error('Firebase not configured')

    const event = await getData(DB_PATHS.events, eventId)
    if (!event || !event.lichess_tournament_id) {
      return null
    }

    const LICHESS_API_BASE = 'https://lichess.org/api'
    const gamesUrl = `${LICHESS_API_BASE}/tournament/${event.lichess_tournament_id}/games?pgnInJson=true`

    try {
      const res = await fetch(gamesUrl, {
        headers: {
          'Accept': 'application/x-ndjson',
        },
        signal: signal || AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        return null
      }

      const text = await res.text()
      const lines = text.trim().split('\n').filter(line => line.trim())
      const games = []

      for (const line of lines) {
        try {
          const game = JSON.parse(line)
          const white = (game.white?.username || game.white || '').toLowerCase()
          const black = (game.black?.username || game.black || '').toLowerCase()
          
          let result = '*'
          if (game.winner === 'white') {
            result = '1-0'
          } else if (game.winner === 'black') {
            result = '0-1'
          } else if (game.status === 'draw' || game.status === 'stalemate') {
            result = '1/2-1/2'
          }

          const timeControl = game.perf || game.speed || undefined
          const timeControlMap = {
            'rapid': 'Rapid',
            'blitz': 'Blitz',
            'bullet': 'Bullet',
            'classical': 'Classical',
            'ultraBullet': 'Bullet',
            'correspondence': 'Classical',
          }
          const mappedTimeControl = timeControl ? (timeControlMap[timeControl] || timeControl) : undefined

          games.push({
            white,
            black,
            result,
            pgn: game.pgn || undefined,
            url: game.id ? `https://lichess.org/${game.id}` : undefined,
            end_time: game.lastMoveAt ? new Date(game.lastMoveAt).toISOString() : undefined,
            time_control: mappedTimeControl,
          })
        } catch (parseError) {
          // Skip invalid lines
        }
      }

      return games.length > 0 ? games : null
    } catch (error) {
      if (error.name === 'AbortError') {
        return null
      }
      return null
    }
  },

  async search(query) {
    if (isDemoMode || !query || query.trim().length < 2) {
      return { players: [], events: [], news: [], jobs: [], clubs: [], locations: [], forums: [] }
    }

    if (!db) {
      return { players: [], events: [], news: [], jobs: [], clubs: [], locations: [], forums: [] }
    }

    const searchTerm = query.trim().toLowerCase()

    try {
      // Search players (users)
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      const matchingPlayers = allUsers.filter(user => {
        const name = (user.name || '').toLowerCase()
        const email = (user.email || '').toLowerCase()
        const chesscomUsername = (user.chesscom_username || '').toLowerCase()
        const location = (user.location || '').toLowerCase()
        
        return name.includes(searchTerm) || 
               email.includes(searchTerm) || 
               chesscomUsername.includes(searchTerm) ||
               location.includes(searchTerm)
      })

      // Search events
      const eventsList = await getList(DB_PATHS.events, 'start_time')
      const matchingEvents = eventsList.filter(event => {
        const name = (event.name || '').toLowerCase()
        const description = (event.description || '').toLowerCase()
        
        return name.includes(searchTerm) || description.includes(searchTerm)
      })

      // Search news
      const newsList = await getList(DB_PATHS.news, 'created_at')
      const matchingNews = newsList.filter(article => {
        const title = (article.title || '').toLowerCase()
        const content = (article.content || '').toLowerCase()
        const excerpt = (article.excerpt || '').toLowerCase()
        const author = (article.author_name || article.author || '').toLowerCase()
        
        return title.includes(searchTerm) || 
               content.includes(searchTerm) || 
               excerpt.includes(searchTerm) ||
               author.includes(searchTerm)
      }).filter(article => article.published && article.published_at) // Only published news

      // Search jobs
      const jobsList = await getList('jobs', 'created_at')
      const matchingJobs = jobsList.filter(job => {
        if (!job.published) return false
        const title = (job.title || '').toLowerCase()
        const description = (job.description || '').toLowerCase()
        const company = (job.company || '').toLowerCase()
        const location = (job.location || '').toLowerCase()
        
        return title.includes(searchTerm) || 
               description.includes(searchTerm) ||
               company.includes(searchTerm) ||
               location.includes(searchTerm)
      })

      // Search clubs
      const clubsList = await getList('clubs', 'created_at')
      const matchingClubs = clubsList.filter(club => {
        const name = (club.name || '').toLowerCase()
        const description = (club.description || '').toLowerCase()
        const location = (club.location || '').toLowerCase()
        
        return name.includes(searchTerm) || 
               description.includes(searchTerm) ||
               location.includes(searchTerm)
      })

      // Search forum posts
      const forumPosts = await getList(DB_PATHS.forumPosts, 'created_at')
      const matchingForums = forumPosts.filter(post => {
        const title = (post.title || '').toLowerCase()
        const content = (post.content || '').toLowerCase()
        const author = (post.author_name || post.author_email || '').toLowerCase()
        const category = (post.category || '').toLowerCase()

        return title.includes(searchTerm) ||
               content.includes(searchTerm) ||
               author.includes(searchTerm) ||
               category.includes(searchTerm)
      })

      // Search locations (districts) - extract unique locations from users
      const locationSet = new Set()
      allUsers.forEach(user => {
        if (user.location && user.location.trim()) {
          const location = user.location.trim()
          if (location.toLowerCase().includes(searchTerm)) {
            locationSet.add(location)
          }
        }
      })
      const matchingLocations = Array.from(locationSet).map(location => ({
        name: location,
        district_name: location,
      }))

      return {
        players: matchingPlayers.slice(0, 20), // Limit to 20 results per category
        events: matchingEvents.slice(0, 20),
        news: matchingNews.slice(0, 20),
        jobs: matchingJobs.slice(0, 20),
        clubs: matchingClubs.slice(0, 20),
        locations: matchingLocations.slice(0, 20),
        forums: matchingForums.slice(0, 20),
      }
    } catch (error) {
      console.error('[search] Error searching:', error)
      return { players: [], events: [], news: [], jobs: [], clubs: [], locations: [], forums: [] }
    }
  },

  async getPuzzle() {
    return this.getChesscomPuzzle()
  },

  // Chess.com Puzzle API - Get random puzzle
  async getChesscomPuzzle() {
    try {
      const chesscomPuzzleUrl = 'https://api.chess.com/pub/puzzle/random'
      
      const res = await fetch(chesscomPuzzleUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) {
        return null
      }

      const data = await res.json()
      
      // Chess.com puzzle API returns: title, url, publish_time, fen, pgn, image
      // Extract solution from PGN - the moves after the FEN position
      if (data.fen && data.pgn) {
        // Parse solution from PGN - moves after the FEN comment
        const pgnLines = data.pgn.split('\n')
        const movesLine = pgnLines.find((line) => line.trim() && !line.startsWith('['))
        const solution = []
        
        if (movesLine) {
          // Extract moves from PGN
          // Handle formats like:
          // "1. e4 e5 2. Nf3 Nc6" (standard)
          // "1... Qe3+ 2. Kxb4" (starting with black)
          // "44. e7 Bxe7 45. Qb8+ Qf8 46. Bxf6+ Bxf6 47. Qxf8# 1-0"
          
          // Remove move numbers (both "1. " and "1... " formats)
          let cleaned = movesLine
            .replace(/\d+\.\.\.\s+/g, '') // Remove "1... ", "2... ", etc.
            .replace(/\d+\.\s+/g, '') // Remove "1. ", "2. ", etc.
            .replace(/\s*\*\s*$/, '') // Remove trailing "*"
            .replace(/\s*1-0\s*|\s*0-1\s*|\s*1\/2-1\/2\s*/g, '') // Remove game results
            .trim()
          
          // Split by whitespace and filter out empty strings
          // Keep all tokens that contain at least one letter (chess moves have letters)
          const moves = cleaned
            .split(/\s+/)
            .filter((m) => {
              // Filter out empty strings
              if (!m || m.length === 0) return false
              // Keep tokens that contain at least one letter (chess moves always have letters)
              // This will keep moves like "Qe3+", "Kxb4", "a5+", "Qb6#", "O-O", etc.
              // and filter out pure numbers or symbols
              return /[a-zA-Z]/.test(m)
            })
            .map((m) => {
              // Clean each move: remove move numbers and ellipsis
              // Handle formats like:
              // "80...Nf1" -> "Nf1"
              // "81.c5" -> "c5"
              // "Nd2#" -> "Nd2#" (already clean)
              return m
                .replace(/^\d+\.\.\.\s*/, '') // Remove "80... " from start
                .replace(/^\d+\.\s*/, '') // Remove "81. " from start
                .trim()
            })
          
          solution.push(...moves)
        }

        return {
          game: {
            id: `chesscom-${data.publish_time || Date.now()}`,
            perf: { key: 'puzzle', name: data.title || 'Chess Puzzle' },
            rated: false,
            players: [
              { userId: '', name: 'White', color: 'white' },
              { userId: '', name: 'Black', color: 'black' }
            ],
            pgn: data.pgn || '',
            fen: data.fen,
            url: data.url || '' // Chess.com puzzle URL
          },
          puzzle: {
            id: `chesscom-${data.publish_time || Date.now()}`,
            rating: 1500, // Chess.com doesn't provide rating in this endpoint
            plays: 0,
            initialPly: 0, // Puzzle starts at the FEN position
            solution: solution.length > 0 ? solution : [],
            themes: [] // Chess.com doesn't provide themes in this endpoint
          }
        }
      }
      
      return null
    } catch (error) {
      return null
    }
  },

}


