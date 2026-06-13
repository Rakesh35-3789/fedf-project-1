chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "SPEAK_FOCUSFORGE") return;

  speak(msg.message, msg.mode);
});

function speak(message, mode) {
  try {
    speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(message);
    speech.lang = "en-US";
    speech.volume = 1;

    if (mode === "up") {
      speech.rate = 1.12;
      speech.pitch = 1.25;
    } else if (mode === "down") {
      speech.rate = 0.88;
      speech.pitch = 0.75;
    } else if (mode === "celebrate") {
      speech.rate = 1.08;
      speech.pitch = 1.35;
    } else {
      speech.rate = 1;
      speech.pitch = 1;
    }

    const voices = speechSynthesis.getVoices();

    const preferred =
      voices.find((v) => v.name.toLowerCase().includes("samantha")) ||
      voices.find((v) => v.name.toLowerCase().includes("alex")) ||
      voices.find((v) => v.lang === "en-US");

    if (preferred) {
      speech.voice = preferred;
    }

    speechSynthesis.speak(speech);
  } catch (error) {
    console.log("FocusForge voice failed:", error);
  }
}