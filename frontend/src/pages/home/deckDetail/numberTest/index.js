import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { deckService } from "@api-services/deckService";
import { LocalLoadingWrapper } from "@components/loading";
import { getFirstError } from "@utils/errorHandler";
import { toast } from "react-toastify";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import BackspaceIcon from "@mui/icons-material/Backspace";

const numberToEnglishWords = (num) => {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

  if (num === 0) return 'zero';

  const helper = (n) => {
    let str = '';
    if (n >= 1000000) {
      str += helper(Math.floor(n / 1000000)) + ' million ';
      n %= 1000000;
    }
    if (n >= 1000) {
      str += helper(Math.floor(n / 1000)) + ' thousand ';
      n %= 1000;
    }
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' hundred ';
      n %= 100;
      if (n > 0) {
        str += 'and ';
      }
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
      if (n > 0) {
        str += ones[n] + ' ';
      }
    } else if (n >= 10) {
      str += teens[n - 10] + ' ';
    } else if (n > 0) {
      str += ones[n] + ' ';
    }
    return str;
  };

  return helper(num).trim().replace(/\s+/g, ' ');
};

function NumberTest() {
  const { deckID } = useParams();
  const navigate = useNavigate();

  // Deck details
  const [deck, setDeck] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Settings state
  const [mode, setMode] = useState("teens-tens"); // digits, teens-tens, hundreds, thousands, millions, custom
  const [customMin, setCustomMin] = useState(1);
  const [customMax, setCustomMax] = useState(100);
  const [roundSize, setRoundSize] = useState(10);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState("");

  // Game state
  const [gameState, setGameState] = useState("setup"); // setup, playing, finished
  const [numbers, setNumbers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [playCount, setPlayCount] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Question validation state
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showSpelling, setShowSpelling] = useState(false);

  // History state: [{ number, userInput, correct, playCount }]
  const [history, setHistory] = useState([]);

  // Audio references
  const audioTimeoutRef = useRef(null);

  // Load deck info
  useEffect(() => {
    const fetchDeck = async () => {
      if (!deckID) return;
      try {
        setIsLoading(true);
        const res = await deckService.retrieve(deckID);
        if (!res.error) {
          setDeck(res.data);
        } else {
          toast.error(getFirstError(res.error));
        }
      } catch (error) {
        console.error("Error retrieving deck:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDeck();
  }, [deckID]);

  // Load synthesis voices
  useEffect(() => {
    const loadVoices = () => {
      if ("speechSynthesis" in window) {
        const allVoices = window.speechSynthesis.getVoices();
        const engVoices = allVoices.filter((v) => v.lang.startsWith("en"));
        setVoices(engVoices);
        if (engVoices.length > 0) {
          // Try to select a nice default voice
          const defaultVoice =
            engVoices.find(
              (v) => v.name.includes("Google") && v.lang.includes("US")
            ) ||
            engVoices.find((v) => v.lang.includes("US")) ||
            engVoices[0];
          setSelectedVoiceName(defaultVoice.name);
        }
      }
    };

    loadVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Generate numbers list based on configurations
  const startTest = () => {
    const generated = [];
    for (let i = 0; i < roundSize; i++) {
      generated.push(generateNumber());
    }
    setNumbers(generated);
    setCurrentIndex(0);
    setUserInput("");
    setPlayCount(0);
    setHistory([]);
    setIsChecked(false);
    setIsCorrect(false);
    setShowSpelling(false);
    setGameState("playing");

    // Automatically speak the first number with a slight delay
    setTimeout(() => {
      playVoice(generated[0]);
    }, 400);
  };

  const generateNumber = () => {
    let min = 0;
    let max = 100;
    switch (mode) {
      case "digits":
        min = 0;
        max = 9;
        break;
      case "teens-tens":
        const isTeen = Math.random() < 0.5;
        if (isTeen) {
          min = 10;
          max = 19;
        } else {
          const tensValues = [20, 30, 40, 50, 60, 70, 80, 90];
          return tensValues[Math.floor(Math.random() * tensValues.length)];
        }
        break;
      case "hundreds":
        min = 100;
        max = 999;
        break;
      case "thousands":
        min = 1000;
        max = 9999;
        break;
      case "millions":
        min = 1000000;
        max = 9999999;
        break;
      case "custom":
        min = parseInt(customMin) || 0;
        max = parseInt(customMax) || 100;
        if (min > max) {
          const temp = min;
          min = max;
          max = temp;
        }
        break;
      default:
        min = 0;
        max = 100;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const playVoice = (numToPlay) => {
    const currentNum = numToPlay !== undefined ? numToPlay : numbers[currentIndex];
    if (currentNum === undefined) return;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(currentNum));
      utterance.rate = speed;
      utterance.pitch = pitch;

      const voice = voices.find((v) => v.name === selectedVoiceName);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        setIsPlayingAudio(true);
      };
      utterance.onend = () => {
        setIsPlayingAudio(false);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
      };

      window.speechSynthesis.speak(utterance);
      setPlayCount((prev) => prev + 1);
    } else {
      toast.error("Text-to-speech is not supported in this browser.");
    }
  };

  // Keyboard support for typing digits
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (gameState !== "playing") return;

      // Enter key behaves contextually
      if (e.key === "Enter") {
        if (isChecked) {
          handleNext();
        } else {
          handleCheck();
        }
        return;
      }

      // Allow numbers typing
      if (/^[0-9]$/.test(e.key)) {
        if (!isChecked) {
          setUserInput((prev) => prev + e.key);
        }
      } else if (e.key === "Backspace") {
        if (!isChecked) {
          setUserInput((prev) => prev.slice(0, -1));
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [gameState, userInput, isChecked, currentIndex, numbers]);

  const handleKeyPress = (char) => {
    if (isChecked) return;
    if (char === "delete") {
      setUserInput("");
    } else if (char === "backspace") {
      setUserInput((prev) => prev.slice(0, -1));
    } else {
      setUserInput((prev) => prev + char);
    }
  };

  const handleCheck = () => {
    if (userInput.trim() === "") {
      toast.warning("Please type the number you hear.");
      return;
    }

    const expected = String(numbers[currentIndex]);
    const correct = userInput.trim() === expected;

    setIsCorrect(correct);
    setIsChecked(true);
    setShowSpelling(true);

    // Speak spelling helper to help reinforce correct answer
    if (correct && "speechSynthesis" in window) {
      // Small pause before confirmation sound/voice
      if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = setTimeout(() => {
        // play subtle correct confirmation or do nothing
      }, 500);
    }
  };

  const handleShowAnswer = () => {
    setUserInput(String(numbers[currentIndex]));
    setIsCorrect(false);
    setIsChecked(true);
    setShowSpelling(true);
  };

  const handleNext = () => {
    // Record current result in history
    const record = {
      number: numbers[currentIndex],
      userInput: userInput,
      correct: isCorrect,
      playCount: playCount,
    };
    const newHistory = [...history, record];
    setHistory(newHistory);

    if (currentIndex + 1 < numbers.length) {
      setCurrentIndex((prev) => prev + 1);
      setUserInput("");
      setPlayCount(0);
      setIsChecked(false);
      setIsCorrect(false);
      setShowSpelling(false);

      // Play next voice
      setTimeout(() => {
        playVoice(numbers[currentIndex + 1]);
      }, 400);
    } else {
      setGameState("finished");
    }
  };

  const restartSameConfig = () => {
    startTest();
  };

  const getCorrectCount = () => {
    return history.filter((item) => item.correct).length;
  };

  const getAccuracy = () => {
    if (history.length === 0) return 0;
    return Math.round((getCorrectCount() / history.length) * 100);
  };

  const getAveragePlayCount = () => {
    if (history.length === 0) return 0;
    const total = history.reduce((sum, item) => sum + item.playCount, 0);
    return (total / history.length).toFixed(1);
  };

  const exitTest = () => {
    if (deckID) {
      navigate(`/deck/${deckID}`);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="number-test-wrapper">
      <LocalLoadingWrapper open={isLoading} />
      
      {/* HEADER SECTION */}
      <div className="number-test-header">
        <button className="back-btn" onClick={exitTest}>
          <ArrowBackIcon />
          <span>Back</span>
        </button>
        <div className="title-area">
          <h2>English Number Test</h2>
          {deck && <span className="deck-tag">{deck.name}</span>}
        </div>
        <div className="actions-area">
          {gameState === "playing" && (
            <button className="settings-shortcut" onClick={() => setGameState("setup")}>
              <SettingsIcon />
            </button>
          )}
        </div>
      </div>

      <div className="number-test-body">
        {/* SETUP SCREEN */}
        {gameState === "setup" && (
          <div className="test-card setup-card">
            <h3>Configuration</h3>
            <p className="subtitle">
              Configure parameters to test your listening comprehension of English numbers.
            </p>

            <div className="settings-grid">
              {/* Difficulty range */}
              <div className="setting-section">
                <label className="section-label">Number Range Difficulty</label>
                <div className="modes-row">
                  <button
                    className={`mode-option ${mode === "digits" ? "active" : ""}`}
                    onClick={() => setMode("digits")}
                  >
                    <h4>Digits</h4>
                    <span>0 – 9</span>
                  </button>
                  <button
                    className={`mode-option ${mode === "teens-tens" ? "active" : ""}`}
                    onClick={() => setMode("teens-tens")}
                    title="Targets teen/ty confusion (13 vs 30, 14 vs 40, etc.)"
                  >
                    <h4>Teens & Tens</h4>
                    <span>10 – 90</span>
                  </button>
                  <button
                    className={`mode-option ${mode === "hundreds" ? "active" : ""}`}
                    onClick={() => setMode("hundreds")}
                  >
                    <h4>Hundreds</h4>
                    <span>100 – 999</span>
                  </button>
                  <button
                    className={`mode-option ${mode === "thousands" ? "active" : ""}`}
                    onClick={() => setMode("thousands")}
                  >
                    <h4>Thousands</h4>
                    <span>1,000 – 9,999</span>
                  </button>
                  <button
                    className={`mode-option ${mode === "millions" ? "active" : ""}`}
                    onClick={() => setMode("millions")}
                  >
                    <h4>Millions</h4>
                    <span>1M – 9.9M</span>
                  </button>
                  <button
                    className={`mode-option ${mode === "custom" ? "active" : ""}`}
                    onClick={() => setMode("custom")}
                  >
                    <h4>Custom</h4>
                    <span>Custom Range</span>
                  </button>
                </div>

                {mode === "custom" && (
                  <div className="custom-range-inputs">
                    <div className="input-field">
                      <label>Min Value</label>
                      <input
                        type="number"
                        value={customMin}
                        min="0"
                        onChange={(e) => setCustomMin(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                    <div className="input-field">
                      <label>Max Value</label>
                      <input
                        type="number"
                        value={customMax}
                        min="1"
                        onChange={(e) => setCustomMax(Math.max(1, parseInt(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Round size, voice accent, rate, pitch */}
              <div className="setting-section flex-row-settings">
                <div className="setting-item">
                  <label>Round Size</label>
                  <select value={roundSize} onChange={(e) => setRoundSize(parseInt(e.target.value))}>
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={20}>20 Questions</option>
                    <option value={50}>50 Questions</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label>Voice Accent</label>
                  <select
                    value={selectedVoiceName}
                    onChange={(e) => setSelectedVoiceName(e.target.value)}
                    disabled={voices.length === 0}
                  >
                    {voices.length === 0 ? (
                      <option>System Default (English)</option>
                    ) : (
                      voices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="setting-section range-sliders">
                <div className="slider-item">
                  <div className="slider-header">
                    <label>Speech Speed: {speed}x</label>
                    <button className="reset-sub-btn" onClick={() => setSpeed(1.0)}>Reset</button>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  />
                </div>

                <div className="slider-item">
                  <div className="slider-header">
                    <label>Voice Pitch: {pitch}</label>
                    <button className="reset-sub-btn" onClick={() => setPitch(1.0)}>Reset</button>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <button className="start-test-btn" onClick={startTest}>
              <PlayArrowIcon />
              <span>Start Practice</span>
            </button>
          </div>
        )}

        {/* ACTIVE TEST SCREEN */}
        {gameState === "playing" && (
          <div className="test-card game-card">
            {/* Progress indicator bar */}
            <div className="progress-container">
              <div className="progress-text">
                <span>Question {currentIndex + 1} of {numbers.length}</span>
                <span>Play Count: {playCount}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${((currentIndex) / numbers.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Speaking voice target panel */}
            <div className="audio-interaction-panel">
              <button
                className={`speaker-pulsar ${isPlayingAudio ? "pulsing" : ""}`}
                onClick={() => playVoice()}
                title="Click to speak number"
              >
                <VolumeUpIcon className="speaker-icon" />
                {isPlayingAudio && (
                  <>
                    <span className="wave wave-1" />
                    <span className="wave wave-2" />
                    <span className="wave wave-3" />
                  </>
                )}
              </button>
              <span className="audio-prompt-text">
                {isPlayingAudio ? "Speaking..." : "Tap to Listen"}
              </span>
            </div>

            {/* Answer feedback alert */}
            {isChecked && (
              <div className={`feedback-alert ${isCorrect ? "correct" : "incorrect"}`}>
                <div className="feedback-header">
                  {isCorrect ? <CheckCircleIcon className="alert-icon" /> : <CancelIcon className="alert-icon" />}
                  <h4>{isCorrect ? "Correct!" : "Incorrect"}</h4>
                </div>
                {showSpelling && (
                  <div className="spelling-reveal">
                    <div className="word-text">
                      "{numberToEnglishWords(numbers[currentIndex])}"
                    </div>
                    {!isCorrect && (
                      <div className="correct-digits">
                        Correct digits: <strong>{numbers[currentIndex]}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* User digit inputs display */}
            <div className={`input-display-area ${isChecked ? (isCorrect ? "match-correct" : "match-incorrect") : ""}`}>
              <input
                type="text"
                value={userInput}
                readOnly
                placeholder="Type the number..."
                className="digits-input-box"
              />
            </div>

            {/* Interaction controls */}
            <div className="controls-row">
              {!isChecked ? (
                <>
                  <button className="control-btn clear-btn" onClick={() => handleKeyPress("delete")}>
                    Clear
                  </button>
                  <button className="control-btn show-btn" onClick={handleShowAnswer}>
                    Show Answer
                  </button>
                  <button className="control-btn check-btn" onClick={handleCheck}>
                    Check
                  </button>
                </>
              ) : (
                <button className="control-btn next-btn" onClick={handleNext}>
                  Next Question
                </button>
              )}
            </div>

            {/* Mobile virtual keypad */}
            {!isChecked && (
              <div className="keypad-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => (
                  <button key={val} className="key-btn" onClick={() => handleKeyPress(String(val))}>
                    {val}
                  </button>
                ))}
                <button className="key-btn action-key" onClick={() => handleKeyPress("delete")}>
                  C
                </button>
                <button className="key-btn" onClick={() => handleKeyPress("0")}>
                  0
                </button>
                <button className="key-btn action-key" onClick={() => handleKeyPress("backspace")}>
                  <BackspaceIcon style={{ fontSize: 18 }} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* RESULTS SCREEN */}
        {gameState === "finished" && (
          <div className="test-card result-card">
            <h3>Round Completed!</h3>
            
            <div className="result-stats-dashboard">
              <div className="stat-circle-box">
                <svg viewBox="0 0 100 100" className="circular-chart">
                  <path
                    className="circle-bg"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    transform="translate(32,32)"
                  />
                  <path
                    className={`circle ${getAccuracy() >= 80 ? "green" : getAccuracy() >= 50 ? "orange" : "red"}`}
                    strokeDasharray={`${getAccuracy()}, 100`}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    transform="translate(32,32)"
                  />
                  <text x="50" y="55" className="percentage">{getAccuracy()}%</text>
                </svg>
              </div>

              <div className="stats-details">
                <div className="stat-row">
                  <span className="stat-label">Correct Answers:</span>
                  <span className="stat-value">{getCorrectCount()} / {history.length}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Average Playback:</span>
                  <span className="stat-value">{getAveragePlayCount()} times</span>
                </div>
                <div className="motivational-message">
                  {getAccuracy() === 100
                    ? "Perfect score! Outstanding listening skills!"
                    : getAccuracy() >= 80
                    ? "Excellent! You have a great ear for numbers!"
                    : getAccuracy() >= 50
                    ? "Good job! Keep practicing to sharpen your accuracy."
                    : "Keep trying! Listening to numbers takes time and patience."}
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="history-table-container">
              <h4>Review Session Details</h4>
              <div className="table-responsive">
                <table className="review-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Audio</th>
                      <th>Target Number</th>
                      <th>Spelling</th>
                      <th>Your Input</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, idx) => (
                      <tr key={idx} className={item.correct ? "row-correct" : "row-incorrect"}>
                        <td>{idx + 1}</td>
                        <td>
                          <button
                            className="replay-audio-btn"
                            onClick={() => playVoice(item.number)}
                            title="Replay audio"
                          >
                            <VolumeUpIcon style={{ fontSize: 16 }} />
                          </button>
                        </td>
                        <td><strong>{item.number}</strong></td>
                        <td className="spell-cell">{numberToEnglishWords(item.number)}</td>
                        <td>
                          {item.userInput === "" ? (
                            <span className="skipped-tag">Skipped</span>
                          ) : (
                            <span className={item.correct ? "val-correct" : "val-incorrect"}>
                              {item.userInput}
                            </span>
                          )}
                        </td>
                        <td>
                          {item.correct ? (
                            <span className="status-pill correct">Correct</span>
                          ) : (
                            <span className="status-pill incorrect">Wrong</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="results-actions">
              <button className="res-action-btn secondary" onClick={() => setGameState("setup")}>
                <SettingsIcon />
                <span>Adjust Settings</span>
              </button>
              <button className="res-action-btn primary" onClick={restartSameConfig}>
                <RefreshIcon />
                <span>Another Round</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NumberTest;
