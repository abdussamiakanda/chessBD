# External Bot Developer Guide

This guide explains how to create and integrate external bots for the ChessBD Bot Tournament system.

## Overview

External bots allow developers to create custom chess bots that can participate in tournaments. Your bot will receive the current board position (FEN) and must return the next move in UCI format.

**Important Restrictions:**
- **No chess engines allowed** (e.g., Stockfish, Leela, etc.)
- **Maximum response time: 10 seconds**
- Your API should only return the UCI move - no additional processing or validation is required

## API Specification

### Endpoint

Your bot must expose a POST endpoint that accepts chess positions and returns moves.

### Request Format

**Method:** `POST`  
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
}
```

- `fen` (string, required): The current board position in FEN notation
- The FEN represents the position from the perspective of the bot that needs to move

### Response Format

**Success Response (200 OK):**
```json
{
  "move": "e2e4"
}
```

- `move` (string, required): The move in UCI format (e.g., "e2e4", "e7e5", "g1f3")
- For pawn promotions, include the promotion piece: "e7e8q" (promotes to queen)

**Note:** Your API should simply return the move. The tournament system handles all validation and game state management.

### CORS Requirements

Your API **must** support CORS (Cross-Origin Resource Sharing) to allow requests from:
- `http://localhost:5173` (development)
- `https://chessbd.app` (production)
- `https://www.chessbd.app` (production)

**Required CORS Headers:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

**OPTIONS Preflight:**
Your server must handle OPTIONS requests and return 200 OK with CORS headers.

### Example Implementation (Flask/Python)

```python
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/move', methods=['POST', 'OPTIONS'])
def move():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    data = request.get_json()
    fen = data.get('fen')
    
    # Your bot logic here - calculate move from FEN
    # Return only the UCI move string
    move_uci = calculate_move(fen)  # Your custom logic
    
    return jsonify({'move': move_uci}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

## Bot Registration

### Registration Process

1. **Email your bot details** to `bots@chessbd.app` with:
   - Bot Name
   - Bot ID (unique identifier)
   - Creator Username
   - API Link (full URL to your move endpoint)
   - Brief description of your bot

2. **After approval**, an admin will add your bot to the system and it will be available for tournaments

### Bot ID Rules

- Must be unique (not used by other bots or Stockfish)
- Lowercase only
- No spaces or special characters (use underscores or hyphens)
- Examples: `mybot`, `chess_ai_v1`, `super-bot`

## Move Format (UCI)

UCI (Universal Chess Interface) format uses square notation:

- **Format**: `[from][to][promotion]`
- **From/To**: Chess squares in algebraic notation (e.g., `e2`, `e4`, `g1`, `f3`)
- **Promotion**: Optional letter for pawn promotion (`q`=queen, `r`=rook, `b`=bishop, `n`=knight)

**Examples:**
- `e2e4` - Pawn from e2 to e4
- `g1f3` - Knight from g1 to f3
- `e7e8q` - Pawn from e7 to e8, promoting to queen
- `e1g1` - King from e1 to g1 (castling)

## Rules and Requirements

### 1. Response Time

- **Maximum response time: 10 seconds**
- Recommended: Respond within 1-5 seconds for better user experience
- Timeouts will result in a random move being played

### 2. No Chess Engines

- **Chess engines are not allowed** (e.g., Stockfish, Leela Chess Zero, etc.)
- Your bot must use custom logic, algorithms, or AI models
- Engines will result in disqualification

### 3. API Simplicity

- Your API should **only return the UCI move**
- No need to handle game states, validation, or error checking
- The tournament system handles all validation and game management
- Simply calculate and return the move

### 4. Error Handling

If your API fails or times out:
- The system will fall back to a random legal move
- Your bot will continue playing but may perform poorly
- Ensure your API is stable and handles errors gracefully

### 5. Rate Limiting

- No rate limiting is enforced by the tournament system
- Implement your own rate limiting if needed
- Consider server costs for high-frequency requests

## Testing Your Bot

### Manual Testing

Test your bot endpoint directly:

```bash
curl -X POST https://yourdomain.com/bot/move \
  -H "Content-Type: application/json" \
  -d '{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}'
```

Expected response:
```json
{"move": "e2e4"}
```

### Testing CORS

Test CORS preflight:

```bash
curl -X OPTIONS https://yourdomain.com/bot/move \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

You should see CORS headers in the response.

## Best Practices

### 1. Use Chess Libraries (For Position Parsing Only)

You may use chess libraries to parse FEN and generate legal moves, but **not** to use built-in engines:
- **Python**: `python-chess` (for board representation only, not engine)
- **JavaScript/Node.js**: `chess.js` (for board representation only)
- **Other languages**: Use libraries for position parsing, not engine evaluation

### 2. Keep It Simple

- Your API only needs to return the move
- No need to validate FEN or moves - the system handles this
- Focus on your bot's decision-making logic

### 3. Performance

- Optimize your bot's move calculation to stay within 10 seconds
- Consider caching for repeated positions
- Focus on efficient algorithms (no engines allowed)

## Example Bot Implementations

### Simple Random Move Bot (Python)

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import chess
import random

app = Flask(__name__)
CORS(app)

@app.route('/move', methods=['POST', 'OPTIONS'])
def move():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    data = request.get_json()
    fen = data.get('fen', chess.STARTING_FEN)
    
    try:
        board = chess.Board(fen)
        legal_moves = list(board.legal_moves)
        
        if not legal_moves:
            return jsonify({'error': 'no legal moves'}), 400
        
        move = random.choice(legal_moves)
        return jsonify({'move': move.uci()}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### Custom Algorithm Bot (Python)

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import chess

app = Flask(__name__)
CORS(app)

def calculate_move(fen):
    """Your custom bot logic - no engines allowed!"""
    board = chess.Board(fen)
    legal_moves = list(board.legal_moves)
    
    # Example: Simple evaluation function
    # Replace with your own algorithm (minimax, neural network, etc.)
    best_move = None
    best_score = float('-inf')
    
    for move in legal_moves:
        board.push(move)
        # Your evaluation function here
        score = evaluate_position(board)
        board.pop()
        
        if score > best_score:
            best_score = score
            best_move = move
    
    return best_move.uci() if best_move else legal_moves[0].uci()

def evaluate_position(board):
    """Your custom evaluation function"""
    # Implement your own evaluation logic
    # This is just a placeholder
    return 0

@app.route('/move', methods=['POST', 'OPTIONS'])
def move():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    data = request.get_json()
    fen = data.get('fen', chess.STARTING_FEN)
    
    move_uci = calculate_move(fen)
    return jsonify({'move': move_uci}), 200
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure OPTIONS requests return 200 OK
   - Add CORS headers to all responses
   - Check allowed origins match your domain

2. **Timeouts**
   - Optimize move calculation to stay under 10 seconds
   - Consider async processing if needed
   - Simplify algorithms if timing out

3. **404 Errors**
   - Verify endpoint URL is correct
   - Check server is running
   - Ensure route handles POST and OPTIONS

## Support

For bot registration and questions:
- **Email**: `bots@chessbd.app`
- Check server logs for errors
- Test your endpoint independently
- Verify CORS configuration

## License and Terms

- Bots must play fair and follow chess rules
- No cheating or external assistance during games
- Respect rate limits and server resources
- Bot creators are responsible for their bot's behavior

---

**Happy Bot Building! 🎮♟️**

