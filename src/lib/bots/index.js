// Bot data and utilities
import botsData from './bots.json'

// Dynamically import all icons from the icons directory
const iconImports = import.meta.glob('./icons/*.svg', { eager: true })

/**
 * Get icon URL for a bot
 */
export function getBotIcon(botId) {
  const bot = botsData.find((b) => b.id === botId)
  if (!bot || !bot.icon) return null
  
  // If it's a full URL (like Stockfish), return as is
  if (bot.icon.startsWith('http://') || bot.icon.startsWith('https://')) {
    return bot.icon
  }
  
  // Otherwise, dynamically import the icon based on the filename in JSON
  const iconPath = `./icons/${bot.icon}`
  const iconModule = iconImports[iconPath]
  
  return iconModule ? iconModule.default : null
}

/**
 * Get all active bots with resolved icon URLs
 */
export function getBots() {
  return botsData
    .filter((bot) => bot.active !== false)
    .map((bot) => ({
      ...bot,
      icon: getBotIcon(bot.id) || bot.icon,
    }))
}

/**
 * Get a bot by ID with resolved icon URL
 */
export function getBotById(botId) {
  const bot = botsData.find((bot) => bot.id === botId)
  if (!bot) return null
  return {
    ...bot,
    icon: getBotIcon(botId) || bot.icon,
  }
}

export { botsData }

