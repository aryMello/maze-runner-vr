// ========================================
// SCORE INTEGRATION MODULE - VERSÃO CORRIGIDA
// Handles user authentication and score submission
// ========================================

class ScoreIntegration {
  constructor() {
    this.userCode = null;
    this.userId = null;
    this.apiBaseUrl = "https://base-presentation-vrar.onrender.com";
    this.experienceId = 2;
    this.redirectDelay = 10000; // 10 seconds
    
    Utils.logInfo("📊 ScoreIntegration initialized");
  }

  /**
   * Initialize - Extract and save user code from URL
   */
  init() {
    // Extract code from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code') || window.location.search.replace("?", "");
    
    if (code) {
      this.userCode = code;
      localStorage.setItem("userCode", code);
      Utils.logInfo("✅ User code saved:", code);
      console.log("User code:", code);
    } else {
      // Try to load from localStorage
      this.userCode = localStorage.getItem("userCode");
      if (this.userCode) {
        Utils.logInfo("📦 User code loaded from storage:", this.userCode);
      } else {
        Utils.logWarn("⚠️ No user code found in URL or storage");
      }
    }
    
    return this.userCode;
  }

  /**
   * Get user ID from API using user code
   * @returns {Promise<number|null>} - User ID or null
   */
  async getUserId() {
    if (!this.userCode) {
      Utils.logError("❌ No user code available");
      return null;
    }
    
    if (this.userId) {
      Utils.logDebug("📦 Using cached user ID:", this.userId);
      return this.userId;
    }
    
    try {
      Utils.logInfo("🔍 Fetching user ID for code:", this.userCode);
      
      const response = await fetch(`${this.apiBaseUrl}/users?code=${this.userCode}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const users = await response.json();
      
      if (!users || users.length === 0) {
        throw new Error("User not found");
      }
      
      this.userId = users[0].id;
      Utils.logInfo("✅ User ID retrieved:", this.userId);
      console.log("User data:", users[0]);
      
      return this.userId;
      
    } catch (error) {
      Utils.logError("❌ Error fetching user ID:", error);
      console.error("Error details:", error);
      return null;
    }
  }

  /**
   * Save score to API
   * @param {number} score - Player's score (treasures collected)
   * @returns {Promise<boolean>} - Success status
   */
  async saveScore(score) {
    Utils.logInfo(`📊 Saving score: ${score}`);
    
    try {
      // ✅ CORREÇÃO: userC -> userId
      const userId = await this.getUserId();
      
      if (!userId) {
        throw new Error("Failed to get user ID");
      }
      
      // Prepare score data
      const scoreData = {
        userId: userId,
        experienceId: this.experienceId,
        score: score
      };
      
      Utils.logInfo("📤 Sending score data:", scoreData);
      console.log("Score payload:", scoreData);
      
      // Send score to API
      const response = await fetch(`${this.apiBaseUrl}/experienceScores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(scoreData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      Utils.logInfo("✅ Score saved successfully!");
      console.log("API Response:", result);
      
      // Show success message to user
      this.showSuccessMessage(score);
      
      // Schedule redirect
      this.scheduleRedirect();
      
      return true;
      
    } catch (error) {
      Utils.logError("❌ Error saving score:", error);
      console.error("Error details:", error);
      
      // Show error message
      this.showErrorMessage(error.message);
      
      return false;
    }
  }

  /**
   * Show success message overlay
   * @param {number} score - Score that was saved
   */
  showSuccessMessage(score) {
    const overlay = document.createElement('div');
    overlay.id = 'score-success-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;
    
    overlay.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 40px;
        border-radius: 20px;
        text-align: center;
        max-width: 500px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      ">
        <h2 style="color: white; font-size: 2.5em; margin: 0 0 20px 0;">
          ✅ Pontuação Salva!
        </h2>
        <p style="color: white; font-size: 1.5em; margin: 10px 0;">
          Score: <strong>${score}</strong> ${score === 1 ? 'tesouro' : 'tesouros'}
        </p>
        <p style="color: white; font-size: 1.2em; margin: 20px 0;">
          Você será redirecionado em <span id="redirect-countdown">${this.redirectDelay / 1000}</span> segundos...
        </p>
        <div style="
          width: 100%;
          height: 4px;
          background: rgba(255,255,255,0.3);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 20px;
        ">
          <div id="redirect-progress" style="
            width: 0%;
            height: 100%;
            background: white;
            transition: width ${this.redirectDelay}ms linear;
          "></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Start progress bar animation
    setTimeout(() => {
      const progress = document.getElementById('redirect-progress');
      if (progress) {
        progress.style.width = '100%';
      }
    }, 100);
    
    // Update countdown
    let remaining = this.redirectDelay / 1000;
    const countdownEl = document.getElementById('redirect-countdown');
    
    const countdownInterval = setInterval(() => {
      remaining--;
      if (countdownEl) {
        countdownEl.textContent = remaining;
      }
      if (remaining <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);
  }

  /**
   * Show error message overlay
   * @param {string} message - Error message
   */
  showErrorMessage(message) {
    const overlay = document.createElement('div');
    overlay.id = 'score-error-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;
    
    overlay.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #f93e3e 0%, #c62828 100%);
        padding: 40px;
        border-radius: 20px;
        text-align: center;
        max-width: 500px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      ">
        <h2 style="color: white; font-size: 2.5em; margin: 0 0 20px 0;">
          ❌ Erro ao Salvar
        </h2>
        <p style="color: white; font-size: 1.2em; margin: 10px 0;">
          ${message}
        </p>
        <p style="color: white; font-size: 1em; margin: 20px 0; opacity: 0.9;">
          Entre em contato com o suporte se o problema persistir.
        </p>
        <button onclick="this.parentElement.parentElement.remove()" style="
          padding: 15px 40px;
          font-size: 1.2em;
          background: white;
          color: #c62828;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: bold;
          margin-top: 20px;
        ">Fechar</button>
      </div>
    `;
    
    document.body.appendChild(overlay);
  }

  /**
   * Schedule redirect to auth page
   */
  scheduleRedirect() {
    Utils.logInfo(`⏰ Redirecting in ${this.redirectDelay / 1000} seconds...`);
    
    setTimeout(() => {
      Utils.logInfo("🔄 Redirecting to auth page...");
      window.location.href = `${this.apiBaseUrl}/pages/auth`;
    }, this.redirectDelay);
  }

  /**
   * Get user code
   * @returns {string|null}
   */
  getUserCode() {
    return this.userCode;
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this.userCode;
  }

  /**
   * Set API base URL
   * @param {string} url
   */
  setApiBaseUrl(url) {
    this.apiBaseUrl = url;
    Utils.logInfo("🔗 API Base URL updated:", url);
  }

  /**
   * Set experience ID
   * @param {number} id
   */
  setExperienceId(id) {
    this.experienceId = id;
    Utils.logInfo("🎮 Experience ID updated:", id);
  }

  /**
   * Set redirect delay
   * @param {number} ms - Delay in milliseconds
   */
  setRedirectDelay(ms) {
    this.redirectDelay = ms;
    Utils.logInfo("⏰ Redirect delay updated:", ms / 1000, "seconds");
  }
}

// Create singleton instance
const scoreIntegration = new ScoreIntegration();

// Legacy function for backward compatibility
function saveScores(pontos) {
  return scoreIntegration.saveScore(pontos);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScoreIntegration;
}

window.ScoreIntegration = ScoreIntegration;
window.scoreIntegration = scoreIntegration;
window.saveScores = saveScores;