import { useState, useEffect } from "react";
import "./App.css";

// localStorage-based progress (persists per browser, survives free-tier restarts)
function getStoredProgress() {
  try {
    const stored = localStorage.getItem("spanigo_progress");
    if (stored) return JSON.parse(stored);
  } catch {}
  return { xp: 0, streak: 0, level: 1, total_sessions: 0, last_practice_date: null };
}

function recordStoredResult(score) {
  const progress = getStoredProgress();
  const today = new Date().toISOString().split("T")[0];
  const xpEarned = Math.max(5, score * 5);
  progress.xp = (progress.xp || 0) + xpEarned;
  progress.total_sessions = (progress.total_sessions || 0) + 1;

  const last = progress.last_practice_date;
  if (!last) {
    progress.streak = 1;
  } else if (last === today) {
    // already practiced today
  } else {
    const diffDays = Math.round(
      (new Date(today) - new Date(last)) / (1000 * 60 * 60 * 24)
    );
    progress.streak = diffDays === 1 ? (progress.streak || 0) + 1 : 1;
  }
  progress.last_practice_date = today;

  let level = progress.level || 1;
  while (progress.xp >= level * 100) level++;
  progress.level = level;

  localStorage.setItem("spanigo_progress", JSON.stringify(progress));
  return { xpEarned, ...progress };
}

function scoreColor(score) {
  if (score >= 9) return "var(--green)";
  if (score >= 7) return "var(--accent)";
  if (score >= 5) return "var(--orange)";
  return "var(--red)";
}

function scoreLabel(score) {
  if (score >= 9) return "Excellent";
  if (score >= 7) return "Good work";
  if (score >= 5) return "Fair effort";
  return "Keep practicing";
}

function App() {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [progress, setProgress] = useState(getStoredProgress());

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetchPrompt();
    setProgress(getStoredProgress());
  }, []);

  async function fetchPrompt() {
    try {
      const res = await fetch(`${API_URL}/prompt`);
      if (res.ok) {
        const data = await res.json();
        setPrompt({
          text: data.prompt_es,
          english: data.prompt_en,
          level: data.level,
          topic: data.topic,
        });
      }
    } catch {}
  }

  function pickRandomPrompt() {
    setError("");
    setFeedback(null);
    setAnswer("");
    setShowTranslation(false);
    fetchPrompt();
  }

  async function evaluateAnswer() {
    if (!prompt || !answer.trim()) return;
    setLoading(true);
    setError("");
    setFeedback(null);

    try {
      const res = await fetch(`${API_URL}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt_es: prompt.text,
          prompt_en: prompt.english,
          answer: answer,
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setFeedback(data);
      setShowTranslation(true);

      const updated = recordStoredResult(data.score);
      setProgress(updated);
    } catch (err) {
      setError("There was a problem contacting the server.");
    } finally {
      setLoading(false);
    }
  }

  const levelXpTarget = progress.level * 100;
  const levelXpCurrent = progress.xp % levelXpTarget;
  const levelXpPct = Math.min((levelXpCurrent / levelXpTarget) * 100, 100);

  // Loading state
  if (!prompt) {
    return (
      <div className="app-root">
        <div className="loading-layout">
          <div className="loading-side">
            <span className="loading-wordmark">Spani-GO</span>
            <span className="loading-tagline">Daily Spanish Practice</span>
          </div>
          <div className="loading-main">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="layout">

        {/* Left panel: brand + progress stats */}
        <aside className="side-panel">
          <div className="brand">
            <span className="brand-wordmark">Spani-GO</span>
            <span className="brand-tagline">Daily practice</span>
          </div>

          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-val streak">{progress.streak}</span>
              <span className="stat-lbl">Day streak</span>
            </div>
            <div className="stat-item">
              <span className="stat-val">Lv {progress.level}</span>
              <span className="stat-lbl">Level</span>
            </div>
          </div>

          <div className="xp-block">
            <div className="xp-meta">
              <span>XP</span>
              <span>{levelXpCurrent} / {levelXpTarget}</span>
            </div>
            <div className="xp-track">
              <div className="xp-fill" style={{ width: `${levelXpPct}%` }} />
            </div>
            <span className="xp-total">{progress.xp} total XP</span>
          </div>
        </aside>

        {/* Right panel: practice */}
        <main className="practice-panel">
          <div className="prompt-meta">
            <span className="pill pill-level">{prompt.level}</span>
            <span className="pill pill-topic">{prompt.topic}</span>
          </div>

          <div className="prompt-card">
            <span className="card-label">Tutor</span>
            <p>{prompt.text}</p>
          </div>

          {showTranslation && (
            <div className="translation-card">
              <span className="card-label">English</span>
              <p>{prompt.english}</p>
            </div>
          )}

          <textarea
            className="answer-input"
            placeholder="Escribe tu respuesta en espanol..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />

          {error && <p className="error-text">{error}</p>}

          <div className="button-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={pickRandomPrompt}
              disabled={loading}
            >
              New prompt
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={evaluateAnswer}
              disabled={loading || !answer.trim()}
            >
              {loading ? "Evaluating..." : "Submit"}
            </button>
          </div>

          {feedback && (
            <div className="feedback">
              <div className="score-display">
                <span
                  className="score-number"
                  style={{ color: scoreColor(feedback.score) }}
                >
                  {feedback.score}
                </span>
                <span className="score-denom">/10</span>
                <span className="score-desc">{scoreLabel(feedback.score)}</span>
              </div>

              <div className="xp-earned">
                +{Math.max(5, feedback.score * 5)} XP
              </div>

              <div className="feedback-block">
                <span className="fb-label">Correction</span>
                <p className="fb-es">{feedback.correction}</p>
                {feedback.correction_english && (
                  <p className="fb-en">{feedback.correction_english}</p>
                )}
              </div>

              {feedback.alternatives?.length > 0 && (
                <div className="feedback-block">
                  <span className="fb-label">Other ways to say it</span>
                  <ul className="alt-list">
                    {feedback.alternatives.map((alt, i) => (
                      <li key={i}>
                        <span>{alt}</span>
                        {feedback.alternatives_english?.[i] && (
                          <span className="alt-en">
                            {feedback.alternatives_english[i]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="feedback-block">
                <span className="fb-label">Explanation</span>
                <p>{feedback.explanation}</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
