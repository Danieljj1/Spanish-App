import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [progress, setProgress] = useState({ xp: 0, streak: 0, level: 1, total_sessions: 0 });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    pickRandomPrompt();
    fetchProgress();
  }, []);

  async function fetchProgress() {
    try {
      const res = await fetch(`${API_URL}/progress`);
      if (res.ok) setProgress(await res.json());
    } catch {}
  }

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
    } catch {
      // fallback: keep current prompt
    }
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

      // Record result for XP/streak
      try {
        await fetch(`${API_URL}/record-result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: data.score }),
        });
        await fetchProgress();
      } catch {}
    } catch (err) {
      setError("There was a problem contacting the server.");
    } finally {
      setLoading(false);
    }
  }

  const levelXpTarget = progress.level * 100;
  const levelXpCurrent = progress.xp % levelXpTarget;
  const levelXpPct = Math.min((levelXpCurrent / levelXpTarget) * 100, 100);

  if (!prompt) {
    return (
      <div className="app-root">
        <div className="card">
          <div className="card-header">Spani-GO</div>
          <div className="card-body">
            <p>Loading prompt...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="card">
        <div className="card-header">
          <span>Spani-GO</span>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar-section">
          <div className="progress-stats">
            <span className="streak-badge">🔥 {progress.streak} day streak</span>
            <span className="level-badge">Level {progress.level}</span>
            <span className="xp-text">{progress.xp} XP total</span>
          </div>
          <div className="xp-bar-container">
            <div className="xp-bar" style={{ width: `${levelXpPct}%` }} />
          </div>
          <div className="xp-label">{levelXpCurrent} / {levelXpTarget} XP to Level {progress.level + 1}</div>
        </div>

        <div className="card-body">
          <div className="prompt-meta">
            <span className="pill pill-level">{prompt.level}</span>
            <span className="pill pill-topic">{prompt.topic}</span>
          </div>

          <div className="bubble bubble-es">
            <span className="bubble-label">Tutor</span>
            <p>{prompt.text}</p>
          </div>

          {showTranslation && (
            <div className="bubble bubble-en">
              <span className="bubble-label">EN</span>
              <p>{prompt.english}</p>
            </div>
          )}

          <textarea
            className="answer-input"
            placeholder="Escribe tu respuesta..."
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
              🔄 New prompt
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={evaluateAnswer}
              disabled={loading || !answer.trim()}
            >
              {loading ? "Evaluando..." : "Enviar respuesta"}
            </button>
          </div>

          {feedback && (
            <div className="feedback">
              <div className="score-row">
                <span className="score-badge">{feedback.score}/10</span>
                <span className="score-text">
                  {feedback.score >= 9
                    ? "🔥 Excellent, perfect response!"
                    : feedback.score >= 7
                    ? "💪 Good job, but there's room for improvement."
                    : feedback.score >= 5
                    ? "🙂 Fair effort — keep going!"
                    : "🌱 Needs significant improvement. Keep practicing!"}
                </span>
              </div>

              <div className="xp-earned-banner">
                +{Math.max(5, feedback.score * 5)} XP earned!
              </div>

              <div className="feedback-section">
                <h4>Corrección</h4>
                <p className="feedback-es">{feedback.correction}</p>
                {feedback.correction_english && (
                  <p className="feedback-en">{feedback.correction_english}</p>
                )}
              </div>

              {feedback.alternatives?.length > 0 && (
                <div className="feedback-section">
                  <h4>Otras formas de decirlo</h4>
                  <ul>
                    {feedback.alternatives.map((alt, i) => (
                      <li key={i}>
                        {alt}
                        {feedback.alternatives_english?.[i] && (
                          <span className="alt-en"> — {feedback.alternatives_english[i]}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="feedback-section">
                <h4>Explicación</h4>
                <p>{feedback.explanation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
