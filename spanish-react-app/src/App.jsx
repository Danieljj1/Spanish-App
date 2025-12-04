import { useState, useEffect } from "react";
import "./App.css";
import prompts from "./Spanish_Prompts.json";

function App() {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  // Pick a random prompt on first load
  useEffect(() => {
    pickRandomPrompt();
  }, []);

  function pickRandomPrompt() {
    setError("");
    setFeedback(null);
    setAnswer("");
    setShowTranslation(false);

    const random = prompts[Math.floor(Math.random() * prompts.length)];
    setPrompt(random);
  }

  async function evaluateAnswer() {
    // If no prompt or answer, return without evaluating
    if (!prompt || !answer.trim()) return;

    setLoading(true);
    setError("");
    setFeedback(null);

    // Extract Spanish and English prompts
    const promptEs = prompt.text;
    const promptEn = prompt.english;

    // Send POST request to server for evaluation
    try {
      const API_URL = import.meta.env.VITE_API_URL;

      const res = await fetch(`${API_URL}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt_es: promptEs,
          prompt_en: promptEn,
          answer: answer,
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      setFeedback(data);
      setShowTranslation(true); // show EN after user submits
    } catch (err) {
      console.error(err);
      setError("There was a problem contacting the server.");
    } finally {
      setLoading(false);
    }
  }

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

  const promptEs = prompt.text;
  const promptEn = prompt.english;

  return (
    <div className="app-root">
      <div className="card">
        <div className="card-header">Spani-GO</div>

        <div className="card-body">
          <div className="prompt-meta">
            <span className="pill pill-level">{prompt.level}</span>
            <span className="pill pill-topic">{prompt.topic}</span>
          </div>

          <div className="bubble bubble-es">
            <span className="bubble-label">Tutor</span>
            <p>{promptEs}</p>
          </div>

          {showTranslation && (
            <div className="bubble bubble-en">
              <span className="bubble-label">EN</span>
              <p>{promptEn}</p>
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
                    ? "🙂 Good job, but there's room for improvement."
                    : "🌱 Needs significant improvement. Keep practicing!"}
                </span>
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
                          <span className="alt-en">
                            {" "}
                            — {feedback.alternatives_english[i]}
                          </span>
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
