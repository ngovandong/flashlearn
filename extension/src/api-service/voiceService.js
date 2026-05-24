// speak.js

/**
 * Converts text to speech using the browser's Speech Synthesis API
 * @param {string} text - The text to be spoken
 * @param {number} [rate=1] - Speech rate (0.1 to 10)
 * @returns {Promise} Resolves when speech is complete, rejects on error
 */
export function speak(text, rate = 1) {
  return new Promise((resolve, reject) => {
    // Check if speech synthesis is supported
    if (!window.speechSynthesis) {
      reject(new Error("Speech synthesis not supported"));
      return;
    }

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // Set default English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find((voice) => voice.lang.startsWith("en"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    // Set rate
    utterance.rate = rate;

    // Handle completion
    utterance.onend = () => resolve();
    utterance.onerror = (error) => reject(error);

    // Start speaking
    window.speechSynthesis.speak(utterance);
  });
}
