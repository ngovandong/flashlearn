const { SpeechSynthesis } = window.speechSynthesis;
export const speak = (text) => {
  let utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.8;
  speechSynthesis.speak(utterance);
  return () => speechSynthesis.cancel();
};
