# ChessBD

A comprehensive chess platform for the Bangladesh chess community, featuring game analysis, player profiles, events, clubs, and learning resources.

## Features

### 🎮 Chess Features
- **Game Analysis**: Advanced PGN analysis with Stockfish 17 engine
  - Move quality classification (Brilliant, Great, Best, Excellent, Good, Inaccuracy, Mistake, Miss, Blunder)
  - Win percentage calculations
  - Position evaluation graphs
  - Best move suggestions
- **Chess Engine**: Interactive engine analysis with Stockfish 17
- **Bot Games**: Play against AI bots with different difficulty levels
- **Puzzles**: Chess puzzles and tactics training

### 👥 Community Features
- **Player Profiles**: View player statistics, ratings, and game history
- **Leaderboards**: Rankings and statistics
- **Events**: Tournament and event management
- **Clubs**: Chess club directory and details
- **Forum**: Community discussions
- **News**: Chess news and updates

### 📚 Learning Resources
- **Interactive Lessons**: Step-by-step chess tutorials
- **Video Tutorials**: Educational chess videos
- **Recommended Books**: Chess literature recommendations
- **Practice Games**: Training games and exercises

### 🗺️ Location Features
- **District Map**: Interactive map of Bangladesh districts
- **Club Locations**: Find chess clubs by location

### 🌐 Additional Features
- Multi-language support (English, Bengali)
- Dark/Light theme switching
- Responsive design
- User authentication and profiles
- Search functionality
- Watch live games

## Tech Stack

### Frontend
- **React 19** - UI library
- **Vite 7** - Build tool and dev server
- **React Router 7** - Routing
- **Zustand** - State management
- **React Query** - Data fetching and caching
- **Lucide React** - Icons

### Chess
- **chess.js** - Chess logic and PGN parsing
- **react-chessboard** - Chess board component
- **Stockfish 17** - Chess engine (WebAssembly)

### Backend & Services
- **Firebase** - Authentication, Firestore, Realtime Database
- **Firebase Hosting** - Deployment

### Utilities
- **date-fns** - Date formatting
- **react-markdown** - Markdown rendering
- **leaflet** - Interactive maps

## Prerequisites

- Node.js 18+ and npm
- Firebase account and project setup
- Git

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/abdussamiakanda/chessBD.git
   cd chessBD
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication, Firestore, and Realtime Database
   - Copy your Firebase configuration
   - Create a `.env.local` file in the root directory:
     ```env
     VITE_FIREBASE_API_KEY=your_api_key
     VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     VITE_FIREBASE_DATABASE_URL=your_database_url
     ```

4. **Stockfish Engine Files**
   - The Stockfish 17 engine files should be in `public/engines/stockfish-17/`
   - Ensure both multi-threaded and single-threaded versions are present:
     - `stockfish-17.js` and `stockfish-17-part-*.wasm` (multi-threaded)
     - `stockfish-17-single.js` and `stockfish-17-single-part-*.wasm` (single-threaded)

## Development

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Open your browser**
   - Navigate to `http://localhost:5173` (or the port shown in terminal)

3. **Lint your code**
   ```bash
   npm run lint
   ```

## Building for Production

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Preview the production build**
   ```bash
   npm run preview
   ```

3. **Deploy to Firebase Hosting**
   ```bash
   firebase deploy
   ```

## Project Structure

```
chessBD/
├── public/
│   ├── engines/
│   │   └── stockfish-17/          # Stockfish engine files
│   ├── bangladesh_geojson_*.json   # Map data
│   └── favicon.svg
├── src/
│   ├── components/                 # Reusable components
│   │   ├── auth/                   # Authentication components
│   │   ├── chess/                  # Chess-related components
│   │   ├── events/                 # Event components
│   │   ├── games/                  # Game components
│   │   ├── maps/                   # Map components
│   │   ├── standings/              # Leaderboard components
│   │   └── ui/                     # UI components
│   ├── contexts/                   # React contexts
│   ├── hooks/                      # Custom React hooks
│   ├── lib/                        # Library code
│   │   ├── api.js                  # API functions
│   │   ├── bots/                   # Bot definitions
│   │   ├── chess/                  # Chess utilities
│   │   ├── engine/                 # Chess engine integration
│   │   ├── firebase.js             # Firebase configuration
│   │   └── utils/                  # Utility functions
│   ├── locales/                    # Translation files
│   ├── pages/                      # Page components
│   │   └── learn/                  # Learning pages
│   ├── store/                      # State management
│   ├── App.jsx                     # Main app component
│   ├── main.jsx                    # Entry point
│   └── index.css                   # Global styles
├── .gitignore
├── firebase.json                    # Firebase hosting config
├── package.json
├── vite.config.js                  # Vite configuration
└── README.md
```

## Key Components

### Analysis Page
- PGN upload and parsing
- Move-by-move analysis with Stockfish 17
- Move quality indicators
- Evaluation graphs
- Player information display

### Chess Engine
- Interactive engine analysis
- Position evaluation
- Best move calculation
- Multi-threaded support

### Player Profiles
- Statistics and ratings
- Game history
- Chess.com and Lichess integration

## Configuration

### Firebase Hosting
The `firebase.json` file contains hosting configuration:
- Static file serving
- Rewrite rules for SPA routing
- Headers for WASM files and caching

### Vite Configuration
The `vite.config.js` handles:
- React plugin
- Worker configuration
- WASM file handling
- Build output optimization

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Requires WebAssembly support for chess engine

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Contact

For questions or support, please contact the project maintainer.

---

Built with ❤️ for the Bangladesh chess community
