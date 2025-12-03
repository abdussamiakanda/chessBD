import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'

export function PlayerName({ username, name, name_bn, email, className = '', showTitle = true, platform = 'chesscom' }) {
  const { language, t } = useLanguage()
  
  // Prefer Bangla name if language is Bengali and name_bn exists, otherwise use name
  const displayName = (language === 'bn' && name_bn) ? name_bn : (name || username || email || t('player.unknownPlayer'))
  
  // Fetch profile based on platform
  const { data: chesscomProfile } = useQuery({
    queryKey: ['chesscom-profile', username],
    queryFn: () => username ? api.getChesscomPlayerProfile(username) : null,
    enabled: !!username && showTitle && platform === 'chesscom',
    staleTime: 300000, // 5 minutes
  })

  const { data: lichessProfile } = useQuery({
    queryKey: ['lichess-profile', username],
    queryFn: () => username ? api.getLichessPlayerProfile(username) : null,
    enabled: !!username && showTitle && platform === 'lichess',
    staleTime: 300000, // 5 minutes
  })

  const profile = platform === 'lichess' ? lichessProfile : chesscomProfile
  const title = profile?.title
  const showTitleBadge = showTitle && title

  // Get title styling based on Chess.com conventions
  function getTitleStyle(title) {
    const titleUpper = title.toUpperCase()
    
    // Grandmaster - Gold
    if (titleUpper === 'GM' || titleUpper === 'WGM') {
      return 'font-bold text-yellow-400'
    }
    // International Master - Silver/Gray
    if (titleUpper === 'IM' || titleUpper === 'WIM') {
      return 'font-bold text-gray-300'
    }
    // FIDE Master - Bronze/Orange
    if (titleUpper === 'FM' || titleUpper === 'WFM') {
      return 'font-bold text-orange-500'
    }
    // Candidate Master - Light Blue
    if (titleUpper === 'CM' || titleUpper === 'WCM') {
      return 'font-bold text-cyan-400'
    }
    // National Master - Green
    if (titleUpper === 'NM' || titleUpper === 'WNM') {
      return 'font-bold text-emerald-400'
    }
    
    // Default - white with bold
    return 'font-bold text-white'
  }

  return (
    <span className={className}>
      {showTitleBadge ? (
        <>
          <span className={getTitleStyle(title)}>{title}</span>
          <span className="ml-1.5">{displayName}</span>
        </>
      ) : (
        displayName
      )}
    </span>
  )
}

