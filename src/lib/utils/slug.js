/**
 * Convert a string to a URL-friendly slug
 */
export function slugify(text) {
  if (!text) return ''
  const str = String(text)
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars except hyphens
    .replace(/\-\-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '') // Trim hyphens from start
    .replace(/-+$/, '') // Trim hyphens from end
}

/**
 * Generate a URL-friendly slug from a title
 */
export function generateNewsSlug(title) {
  return slugify(title)
}

/**
 * Generate a slug from forum post title with unique identifier
 * Format: {slugified-title}-{unique-number}
 * @param title - Post title
 * @param id - Post ID for uniqueness
 * @returns URL-friendly slug with unique number
 */
export function generateForumPostSlug(title, id) {
  if (!title || !id) return ''
  const titleSlug = slugify(title)
  if (!titleSlug) return ''
  // Use the last 4 characters of the ID for uniqueness
  return `${titleSlug}-${id.slice(-4)}`
}

/**
 * Generate a slug from club name
 * @param name - Club name
 * @returns URL-friendly slug
 */
export function generateClubSlug(name) {
  return slugify(name)
}

/**
 * Generate a slug from event name
 * @param name - Event name
 * @returns URL-friendly slug
 */
export function generateEventSlug(name) {
  return slugify(name)
}

