/**
 * Load custom chess pieces from a theme directory
 * @param {string} themeName - Name of the theme directory (e.g., 'default', 'classic')
 * @returns {Object} Object mapping piece types to SVG content (as strings)
 * 
 * Expected file structure:
 * lib/chess/{themeName}/
 *   - K.svg, Q.svg, R.svg, B.svg, N.svg, P.svg
 * 
 * Pieces will be colored (white/black) when rendered
 */
import React from 'react'

// Static imports for default theme pieces
import K_svg from './default/K.svg?raw'
import Q_svg from './default/Q.svg?raw'
import R_svg from './default/R.svg?raw'
import B_svg from './default/B.svg?raw'
import N_svg from './default/N.svg?raw'
import P_svg from './default/P.svg?raw'

export function loadCustomPieces(themeName = 'default') {
  const pieces = {}
  
  // For now, only support 'default' theme
  // Can be extended later to support other themes
  if (themeName !== 'default') {
    console.warn(`Theme '${themeName}' not supported yet. Using 'default' instead.`)
    themeName = 'default'
  }
  
  if (themeName === 'default') {
    // Use the statically imported SVGs
    pieces.K = typeof K_svg === 'string' ? K_svg : K_svg?.default || K_svg
    pieces.Q = typeof Q_svg === 'string' ? Q_svg : Q_svg?.default || Q_svg
    pieces.R = typeof R_svg === 'string' ? R_svg : R_svg?.default || R_svg
    pieces.B = typeof B_svg === 'string' ? B_svg : B_svg?.default || B_svg
    pieces.N = typeof N_svg === 'string' ? N_svg : N_svg?.default || N_svg
    pieces.P = typeof P_svg === 'string' ? P_svg : P_svg?.default || P_svg
    
    // Validate all pieces are valid SVG strings
    for (const [type, content] of Object.entries(pieces)) {
      if (typeof content !== 'string') {
        console.warn(`Piece ${type} is not a string:`, typeof content)
        delete pieces[type]
      } else {
        const trimmed = content.trim()
        if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) {
          console.warn(`Piece ${type} is not valid SVG (starts with: ${trimmed.substring(0, 50)})`)
          delete pieces[type]
        }
      }
    }
  }
  
  return pieces
}

/**
 * Apply color to SVG content by modifying fill and stroke attributes
 * @param {string} svgContent - Raw SVG content as string
 * @param {string} color - 'w' for white, 'b' for black
 * @returns {string} SVG content with applied colors
 */
function applyColorToSVG(svgContent, color) {
  if (!svgContent || typeof svgContent !== 'string') return svgContent
  
  const trimmed = svgContent.trim()
  
  // Validate it's actually SVG, not HTML error page
  // SVGs can start with <?xml or <svg
  if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) {
    console.warn('Invalid SVG content, expected SVG but got:', trimmed.substring(0, 50))
    return svgContent
  }
  
  const isWhite = color === 'w'
  const fillColor = isWhite ? '#ffffff' : '#000000'
  const strokeColor = isWhite ? '#000000' : '#ffffff'
  
  // Replace fill attributes (handle both fill="..." and fill='...')
  let coloredSVG = svgContent.replace(/fill="[^"]*"/gi, `fill="${fillColor}"`)
  coloredSVG = coloredSVG.replace(/fill='[^']*'/gi, `fill="${fillColor}"`)
  
  // Replace stroke attributes
  coloredSVG = coloredSVG.replace(/stroke="[^"]*"/gi, `stroke="${strokeColor}"`)
  coloredSVG = coloredSVG.replace(/stroke='[^']*'/gi, `stroke="${strokeColor}"`)
  
  // If no fill/stroke attributes exist, add them to the root SVG element
  if (!coloredSVG.includes('fill=') && !coloredSVG.includes('stroke=')) {
    coloredSVG = coloredSVG.replace(/<svg([^>]*)>/i, `<svg$1 fill="${fillColor}" stroke="${strokeColor}">`)
  }
  
  return coloredSVG
}

/**
 * Create customPieces object for react-chessboard
 * @param {Object} pieceSVGs - Object mapping piece types to SVG content strings (e.g., { K: '<svg>...</svg>', Q: '<svg>...</svg>' })
 * @returns {Object} customPieces object for react-chessboard
 */
export function createCustomPieces(pieceSVGs) {
  const customPieces = {}
  
  const pieceTypes = ['K', 'Q', 'R', 'B', 'N', 'P']
  const colors = ['w', 'b']
  
  console.log('Creating custom pieces from:', Object.keys(pieceSVGs))
  
  for (const color of colors) {
    for (const type of pieceTypes) {
      const pieceCode = `${color}${type}`
      const svgContent = pieceSVGs[type]
      
      if (svgContent && typeof svgContent === 'string') {
        try {
          // Apply color to the SVG
          const coloredSVG = applyColorToSVG(svgContent, color)
          
          // Validate the colored SVG is still valid
          const trimmedColored = coloredSVG.trim()
          if (!coloredSVG || (!trimmedColored.startsWith('<svg') && !trimmedColored.startsWith('<?xml'))) {
            console.warn(`Invalid SVG content for ${pieceCode}`)
            continue
          }
          
          // Convert to data URL using base64 for better compatibility with large SVGs
          const base64SVG = btoa(unescape(encodeURIComponent(coloredSVG)))
          const dataUrl = `data:image/svg+xml;base64,${base64SVG}`
          
          console.log(`Created custom piece ${pieceCode} with data URL length:`, dataUrl.length)
          
          customPieces[pieceCode] = ({ squareWidth }) => {
            console.log(`Rendering custom piece ${pieceCode} with squareWidth:`, squareWidth)
            return (
              <div
                style={{
                  width: squareWidth,
                  height: squareWidth,
                  backgroundImage: `url(${dataUrl})`,
                  backgroundSize: '100%',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  display: 'block',
                }}
              />
            )
          }
        } catch (error) {
          console.error(`Failed to create custom piece for ${pieceCode}:`, error)
        }
      } else {
        console.warn(`No SVG content for piece type ${type}`)
      }
    }
  }
  
  console.log('Final custom pieces object keys:', Object.keys(customPieces))
  return customPieces
}

