const { SpeechSynthesis } = window.speechSynthesis;
export const speak = (text) => {
  let utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utterance);
};
