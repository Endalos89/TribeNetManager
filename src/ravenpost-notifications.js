(() => {
  if (!window.ravenpost?.onNewMail) return;

  // Genuine Common Raven call recorded in Grand Teton National Park by the
  // U.S. National Park Service. The recording is public domain and is served
  // from Wikimedia Commons' MP3 transcode.
  // Source: https://commons.wikimedia.org/wiki/File:Common_Raven_Grand_Teton_National_Park.ogg
  const RAVEN_CALL_URL = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ad/Common_Raven_Grand_Teton_National_Park.ogg/Common_Raven_Grand_Teton_National_Park.ogg.mp3';

  let ravenAudio = null;
  let stopTimer = null;

  function getRavenAudio() {
    if (!ravenAudio) {
      ravenAudio = new Audio(RAVEN_CALL_URL);
      ravenAudio.preload = 'auto';
      ravenAudio.volume = 0.8;
    }
    return ravenAudio;
  }

  async function playRavenCall() {
    try {
      const audio = getRavenAudio();
      if (stopTimer) clearTimeout(stopTimer);
      audio.pause();
      audio.currentTime = 0;
      await audio.play();

      // The source clip is 5.7 seconds long. Stop/reset explicitly so repeated
      // notifications always begin with the raven call rather than resuming.
      stopTimer = setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
        stopTimer = null;
      }, 5800);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Warm the browser cache without forcing playback. Ravenpost needs internet
  // for Gmail sync anyway, and Chromium will reuse the downloaded audio.
  try { getRavenAudio().load(); } catch (_) {}

  window.RavenpostSound = { play: playRavenCall };

  window.ravenpost.onNewMail(payload => {
    if (payload?.playSound) playRavenCall();
  });
})();
