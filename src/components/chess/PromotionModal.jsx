import './PromotionModal.css'

export function PromotionModal({ isOpen, onSelect, color }) {
  if (!isOpen) return null

  const pieces = [
    { type: 'q', symbol: '♕', name: 'Queen' },
    { type: 'r', symbol: '♖', name: 'Rook' },
    { type: 'b', symbol: '♗', name: 'Bishop' },
    { type: 'n', symbol: '♘', name: 'Knight' },
  ]

  return (
    <div className="promotion-modal-overlay" onClick={() => onSelect('q')}>
      <div className="promotion-modal" onClick={(e) => e.stopPropagation()}>
        <div className="promotion-modal-title">Choose promotion piece</div>
        <div className="promotion-modal-pieces">
          {pieces.map((piece) => (
            <button
              key={piece.type}
              className="promotion-modal-piece"
              onClick={() => onSelect(piece.type)}
              title={piece.name}
            >
              <span className={`promotion-piece-symbol ${color}`}>
                {piece.symbol}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

