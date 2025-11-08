# Maze Runner VR

A multiplayer VR maze game built with A-Frame and WebSockets. Navigate through procedurally generated mazes, collect treasures, and compete with friends in real-time!

## Features

- **Multiplayer Experience**: Play with up to 4 players in real-time
- **VR Support**: Full VR compatibility with A-Frame
- **Camera-Based Movement**: Minecraft-style WASD controls that move relative to where you're looking
- **Real-Time Sync**: All player movements and treasure collections are synchronized via WebSockets
- **Procedural Mazes**: Each game generates a unique maze layout
- **Proximity-Based Collection**: Automatically collect treasures when you get close to them
- **Leaderboard**: Real-time ranking system showing who collected the most treasures

## Getting Started

### Prerequisites

- Modern web browser with WebGL support
- Internet connection (for CDN resources)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/maze-runner-vr.git
cd maze-runner-vr
```

2. Serve the files with any static file server:
```bash
# Using Node.js
npm start
```

3. Open `http://localhost:8000` in your browser

## How to Play

1. **Enter Your Name**: Type your name on the welcome screen
2. **Create or Join Room**: 
   - Click "Create Room" to start a new game
   - Click "Show Rooms" to join an existing game
3. **Wait for Players**: Wait in the lobby for other players to join
4. **Ready Up**: Click "Ready" when you're ready to start
5. **Play**: 
   - Use **WASD** or **Arrow Keys** to move
   - Look around with your **mouse** or **VR headset**
   - Collect treasures by walking near them
6. **Win**: Be the first to collect all treasures!

## Controls

| Key | Action |
|-----|--------|
| W / ↑ | Move forward  |
| S / ↓ | Move backward |
| A / ← | Strafe left   |
| D / → | Strafe right  |
| Mouse | Look around   |

### Key Components

#### **WebSocket Communication**
- `WSClient`: Native WebSocket wrapper with reconnection logic
- `WSHandlers`: Event handlers for all server messages
- Events: `room_created`, `player_joined`, `game_start`, `player_update`, `treasure_collected`, etc.

#### **Game Controllers**
- `GameController`: Orchestrates initialization and game loop
- `MovementController`: Handles player movement with collision detection
- `InputController`: Processes keyboard/mouse input
- `CameraController`: Manages camera position and rotation

#### **Managers**
- `UIManager`: Controls all UI elements and screens
- `PlayerManager`: Renders and updates player entities in 3D space
- `MazeManager`: Renders maze walls from server data
- `TreasureManager`: Handles treasure rendering and proximity-based collection

#### **Utilities**
- `CoordinateUtils`: Converts between grid coordinates and world space
- `CollisionUtils`: Checks wall collisions before movement
- `GameState`: Centralized state management

## WebSocket Protocol

### Client → Server

```javascript
// Create room
{ "type": "create_room", "payload": { "playerId": "...", "name": "...", "maxPlayers": 4 } }

// Join room
{ "type": "join", "payload": { "playerId": "...", "name": "..." } }

// Ready status
{ "type": "ready", "payload": { "ready": true } }

// Movement
{ "type": "move", "payload": { "x": 1.5, "z": 2.0, "direction": 90 } }

// Collect treasure
{ "type": "collect_treasure", "payload": { "treasureId": "treasure-1" } }
```

### Server → Client

```javascript
// Room created
{ "type": "room_created", "payload": { "code": "ABC123", "room": {...} } }

// Player joined
{ "type": "player_joined", "payload": { "id": "...", "name": "...", "players": {...} } }

// Game starting
{ "type": "game_start", "payload": { "maze": [[...]], "treasures": [...], "players": {...} } }

// Player position update
{ "type": "player_update", "payload": { "id": "...", "x": 1.5, "z": 2.0, "direction": 90 } }

// Treasure collected
{ "type": "treasure_collected", "payload": { "treasureId": "...", "playerId": "...", "treasures": 1 } }

// Game won
{ "type": "game_win", "payload": { "playerId": "...", "playerName": "...", "treasures": 11 } }
```

## License

MIT License - feel free to use this project for learning and fun!

## 👥 Team

@aryMello - Frontend developer
@drotgalvao - Backend developer

Contributions are welcome! Please feel free to submit a Pull Request.

**Have fun playing!**