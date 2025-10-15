// WebSocket Client
// Manages connection strategies and socket.io client lifecycle

class WSClient {
  constructor(server, path, isLocal) {
    this.server = server;
    this.path = path;
    this.isLocal = !!isLocal;
    this.socket = null;
    this.strategies = [
      {
        name: "ws-path",
        path: this.path,
        transports: ["websocket", "polling"],
      },
      {
        name: "socket.io-default",
        path: "/socket.io",
        transports: ["websocket", "polling"],
      },
      { name: "polling-only", path: "/socket.io", transports: ["polling"] },
    ];
  }

  async rawWsDiagnostic() {
    try {
      const norm = Utils.normalizeServer(this.server);
      const wsProto = norm.wsProto || "wss";
      const host = norm.host;
      const path = this.path.startsWith("/") ? this.path : "/" + this.path;
      const wsUrl = `${wsProto}://${host}${path}`;
      Utils.logDebug("Raw WS diagnostic to", wsUrl, "normalized:", norm);
      return await new Promise((resolve) => {
        let dbg;
        try {
          dbg = new WebSocket(wsUrl);
        } catch (e) {
          Utils.logError("Raw WebSocket constructor failed", e && e.message);
          return resolve({ ok: false, error: e });
        }
        const t = setTimeout(() => {
          try {
            dbg.close();
          } catch (e) {}
          resolve({ ok: false, error: new Error("raw ws timeout") });
        }, 8000);
        dbg.onopen = () => {
          clearTimeout(t);
          dbg.close();
          resolve({ ok: true });
        };
        dbg.onerror = (ev) => {
          clearTimeout(t);
          resolve({ ok: false, error: ev });
        };
      });
    } catch (e) {
      Utils.logError("Raw WS diagnostic failed", e && e.message);
      return { ok: false, error: e };
    }
  }

  tryStrategy(strategy) {
    return new Promise((resolve, reject) => {
      const opts = {
        path: strategy.path,
        transports: strategy.transports,
        secure: !this.isLocal,
        rejectUnauthorized: false,
        reconnection: false,
        timeout: 5000,
      };
      Utils.logInfo("Attempting strategy", strategy.name, opts);
      const s = io(this.server, opts);

      const onConnect = () => {
        cleanup();
        Utils.logInfo("Strategy succeeded", strategy.name);
        resolve(s);
      };
      const onError = (err) => {
        cleanup();
        Utils.logWarn(
          "Strategy failed",
          strategy.name,
          err && err.message ? err.message : err
        );
        try {
          s.close();
        } catch (e) {}
        reject(err);
      };

      const timeout = setTimeout(() => {
        onError(new Error("strategy timeout"));
      }, 6000);
      function cleanup() {
        clearTimeout(timeout);
        s.off && s.off("connect", onConnect);
        s.off && s.off("connect_error", onError);
        s.off && s.off("error", onError);
      }

      s.on && s.on("connect", onConnect);
      s.on && s.on("connect_error", onError);
      s.on && s.on("error", onError);
    });
  }

  async connect() {
    for (const st of this.strategies) {
      try {
        const s = await this.tryStrategy(st);
        this.socket = s;
        this.socket.io && (this.socket.io.opts.reconnection = true);
        this.setupHandlers(this.socket);
        return this.socket;
      } catch (e) {
        Utils.logWarn("Strategy", st.name, "did not connect:", e && e.message);
      }
    }

    Utils.logError("All connection strategies failed; running diagnostics");
    const http = await Utils.checkBackendHttp("/api/rooms");
    Utils.logDebug("HTTP diagnostic result", http);
    const raw = await this.rawWsDiagnostic();
    Utils.logDebug("Raw WS diagnostic", raw);
    throw new Error("All strategies failed");
  }

  setupHandlers(s) {
    if (!s) return;
    Utils.logInfo(
      "Configuring socket handlers for connected socket",
      s && s.id
    );

    // Setup manager listeners
    try {
      if (s.io) {
        s.io.on &&
          s.io.on("reconnect_attempt", (attempt) =>
            Utils.logInfo("manager reconnect_attempt", attempt)
          );
        s.io.on &&
          s.io.on("reconnect_error", (err) =>
            Utils.logWarn("manager reconnect_error", err)
          );
        s.io.on &&
          s.io.on("reconnect_failed", () =>
            Utils.logWarn("manager reconnect_failed")
          );
      }
    } catch (e) {
      Utils.logWarn("Could not attach manager listeners", e && e.message);
    }

    // Connection events
    s.on("connect", () => {
      Utils.logInfo("Connected to server (socket.io)");
      uiManager.updateConnectionStatus("connected");
    });
    s.on("disconnect", () => {
      Utils.logInfo("Disconnected from server");
      uiManager.updateConnectionStatus("disconnected");
    });
    s.on("connect_error", (error) => {
      Utils.logError("Connection error (post-connect):", error);
      uiManager.updateConnectionStatus("disconnected");
    });
    s.on("reconnect_attempt", (attempt) =>
      Utils.logInfo("socket reconnect_attempt", attempt)
    );
    s.on("reconnect_error", (err) =>
      Utils.logWarn("socket reconnect_error", err)
    );
    s.on("reconnect_failed", () => Utils.logWarn("socket reconnect_failed"));
    s.on("error", (err) => Utils.logError("socket error", err));
    s.on("ping", () => Utils.logDebug("socket ping"));
    s.on("pong", (latency) =>
      Utils.logDebug("socket pong latency(ms)=", latency)
    );

    // Room events
    s.on("room_created", (data) => {
      Utils.logDebug("room_created", data);
      gameState.setRoom(data.payload.code);
      gameState.setPlayerId(data.payload.room.host);
      if (data.payload.room) {
        gameState.setMaze(data.payload.room.maze);
        gameState.setTreasures(data.payload.room.treasures);
        gameState.updatePlayers(data.payload.room.players);
      }
      uiManager.showWaitingRoom(data.payload.code);
      uiManager.updatePlayerList();
    });

    s.on("room_joined", (data) => {
      Utils.logDebug("room_joined", data);
      gameState.setRoom(data.roomCode || data.code);
      gameState.setPlayerId(data.playerId);
      gameState.updatePlayers(data.players);
      if (data.maze) gameState.setMaze(data.maze);
      if (data.treasures) gameState.setTreasures(data.treasures);
      uiManager.showWaitingRoom(gameState.room);
      uiManager.updatePlayerList();
    });

    s.on("room_error", (data) => {
      alert(data.message || "Erro ao entrar na sala");
    });

    // Player events
    s.on("player_joined", (data) => {
      Utils.logDebug("player_joined", data);
      if (data.players) {
        gameState.updatePlayers(data.players);
      } else if (data.player) {
        gameState.addPlayer(data.player);
      }
      uiManager.updatePlayerList();
    });

    s.on("player_left", (data) => {
      Utils.logDebug("player_left", data);
      if (data.players) {
        gameState.updatePlayers(data.players);
      } else if (data.playerId) {
        gameState.removePlayer(data.playerId);
      }
      uiManager.updatePlayerList();
      if (gameState.gameStarted) {
        playerManager.removePlayerEntity(data.playerId);
        uiManager.updateLeaderboard();
      }
    });

    s.on("player_ready", (data) => {
      Utils.logDebug("player_ready", data);
      if (data.players) {
        gameState.updatePlayers(data.players);
      } else if (data.playerId) {
        gameState.updatePlayerReady(data.playerId, data.ready);
      }
      uiManager.updatePlayerList();
    });

    // Game events
    s.on("game_starting", (data) => {
      Utils.logDebug("game_starting", data);
      gameState.startGame(data);
      uiManager.hideLobby();
      gameController.initGame();
    });

    s.on("player_moved", (data) => {
      if (gameState.players[data.playerId]) {
        gameState.players[data.playerId].x = data.x;
        gameState.players[data.playerId].z = data.z;
        gameState.players[data.playerId].direction = data.direction;
        playerManager.updatePlayerEntity(data.playerId);
      }
    });

    s.on("treasure_collected", (data) => {
      Utils.logDebug("treasure_collected", data);
      gameController.handleTreasureCollection(data);
    });

    s.on("game_won", (data) => {
      Utils.logDebug("game_won", data);
      gameController.handleGameWon(data);
    });

    // Set socket globally and on controller
    window.socket = s;
    gameController.setSocket(s);
  }
}

// Expose globally
window.WSClient = WSClient;
