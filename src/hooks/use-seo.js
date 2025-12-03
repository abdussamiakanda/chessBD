import { useEffect } from 'react'

const DEFAULT_TITLE = 'ChessBD - Bangladesh\'s Premier Chess Community'
const DEFAULT_DESCRIPTION = 'Join the ChessBD community - participate in tournaments, track ratings, read chess news, and connect with chess players in Bangladesh.'
const DEFAULT_URL = typeof window !== 'undefined' ? window.location.origin : 'https://chessbd.app'
const DEFAULT_IMAGE = `${DEFAULT_URL}/crown.png`

/**
 * Hook to manage SEO meta tags and document title
 */
export function useSEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  author,
  publishedTime,
  modifiedTime,
  fbAppId,
} = {}) {
  useEffect(() => {
    // Set document title
    const fullTitle = title ? `${title} | ChessBD` : DEFAULT_TITLE
    document.title = fullTitle

    // Helper function to update or create meta tag
    const updateMetaTag = (name, content, attribute = 'name') => {
      if (!content) return

      // Try multiple selector strategies to find existing meta tag
      let meta = document.querySelector(`meta[${attribute}="${name}"]`)
      
      // If not found, try with escaped quotes
      if (!meta) {
        meta = document.querySelector(`meta[${attribute}='${name}']`)
      }
      
      // If still not found, search all meta tags manually
      if (!meta) {
        const allMetaTags = document.head.querySelectorAll('meta')
        for (let i = 0; i < allMetaTags.length; i++) {
          const tag = allMetaTags[i]
          if (tag.getAttribute(attribute) === name) {
            meta = tag
            break
          }
        }
      }
      
      // Create new meta tag if still not found
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute(attribute, name)
        document.head.appendChild(meta)
      }
      
      // Update content
      meta.setAttribute('content', content)
    }

    // Update or create meta tags
    updateMetaTag('description', description)
    if (keywords) {
      updateMetaTag('keywords', keywords)
    } else {
      // Remove keywords meta tag if not provided
      const keywordsMeta = document.querySelector('meta[name="keywords"]')
      if (keywordsMeta) {
        keywordsMeta.remove()
      }
    }

    // Helper function to remove meta tag if it exists
    const removeMetaTag = (name, attribute = 'name') => {
      const meta = document.querySelector(`meta[${attribute}="${name}"]`)
      if (meta) {
        meta.remove()
      }
    }

    // Helper function to normalize image URL
    const normalizeImageUrl = (img) => {
      if (img.startsWith('http://') || img.startsWith('https://')) {
        return img
      }
      // Ensure relative URLs start with /
      const normalized = img.startsWith('/') ? img : `/${img}`
      return `${DEFAULT_URL}${normalized}`
    }

    // Canonical URL - always use absolute URL
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
    const canonicalUrl = url 
      ? (url.startsWith('http') ? url : `${DEFAULT_URL}${url.startsWith('/') ? url : `/${url}`}`)
      : `${DEFAULT_URL}${currentPath}`
    
    // Update or create canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]')
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.setAttribute('rel', 'canonical')
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.setAttribute('href', canonicalUrl)

    // Open Graph tags - always set og:url
    updateMetaTag('og:title', fullTitle, 'property')
    updateMetaTag('og:description', description, 'property')
    updateMetaTag('og:type', type, 'property')
    updateMetaTag('og:image', normalizeImageUrl(image), 'property')
    updateMetaTag('og:site_name', 'ChessBD', 'property')
    updateMetaTag('og:url', canonicalUrl, 'property')
    
    // Facebook App ID (optional)
    if (fbAppId) {
      updateMetaTag('fb:app_id', fbAppId, 'property')
    } else {
      removeMetaTag('fb:app_id', 'property')
    }

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image')
    updateMetaTag('twitter:title', fullTitle)
    updateMetaTag('twitter:description', description)
    updateMetaTag('twitter:image', normalizeImageUrl(image))

    // Additional meta tags
    if (author) {
      updateMetaTag('author', author)
    } else {
      removeMetaTag('author')
    }
    if (publishedTime) {
      updateMetaTag('article:published_time', publishedTime, 'property')
    } else {
      removeMetaTag('article:published_time', 'property')
    }
    if (modifiedTime) {
      updateMetaTag('article:modified_time', modifiedTime, 'property')
    } else {
      removeMetaTag('article:modified_time', 'property')
    }

    // Cleanup function to restore default title when component unmounts
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title, description, keywords, image, url, type, author, publishedTime, modifiedTime, fbAppId])
}

