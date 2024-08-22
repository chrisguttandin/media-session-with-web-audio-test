const audioContext = new AudioContext();
const uint32Array = new Uint32Array(audioContext.sampleRate * 5 + 12);

uint32Array.set([
    1179011410,
    audioContext.sampleRate * 5 + 37,
    1163280727,
    544501094,
    16,
    65537,
    audioContext.sampleRate,
    audioContext.sampleRate,
    524289,
    1635017060,
    audioContext.sampleRate * 5 + 1
]);
uint32Array.fill(2139062143, 11);

const mediaSessionAudioElement = new Audio(URL.createObjectURL(new Blob([uint32Array], { type: 'audio/wav' })));

mediaSessionAudioElement.loop = true;

const isAppleTouchDevice = /^(?:iPhone|iPod|Mac)/.test(navigator.platform) && navigator.maxTouchPoints > 1;
const destinationAudioElement = isAppleTouchDevice ? new Audio() : null;
const mediaStreamAudioDestinationNode = destinationAudioElement === null ? null : new MediaStreamAudioDestinationNode(audioContext);

if (destinationAudioElement !== null && mediaStreamAudioDestinationNode !== null) {
    destinationAudioElement.srcObject = mediaStreamAudioDestinationNode.stream;
}

const $toggle = document.getElementById('toggle');
const textContent = $toggle.textContent;
const play = async () => {
    $toggle.disabled = true;

    if (destinationAudioElement === null) {
        await Promise.all([audioContext.resume(), mediaSessionAudioElement.play()]);
    } else {
        await Promise.all([audioContext.resume(), destinationAudioElement.play().then(() => mediaSessionAudioElement.play())]);
    }

    navigator.mediaSession.metadata = new MediaMetadata({
        album: 'Best of Frequencies',
        artist: 'Web Audio API',
        title: '440 Hz'
    });

    const gainNode = new GainNode(audioContext);
    const oscillatorNode = new OscillatorNode(audioContext);
    const fadeDuration = 0.15;
    const startTime = audioContext.currentTime;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(1, startTime + fadeDuration);
    oscillatorNode.connect(gainNode).connect(mediaStreamAudioDestinationNode ?? audioContext.destination);
    oscillatorNode.start(startTime);

    const pause = () => {
        $toggle.disabled = true;

        const endTime = audioContext.currentTime;

        gainNode.gain.cancelScheduledValues(endTime);
        gainNode.gain.setValueAtTime(Math.min(1, (endTime - startTime) / fadeDuration), endTime);
        gainNode.gain.linearRampToValueAtTime(0, endTime + fadeDuration);
        oscillatorNode.stop(endTime + fadeDuration);

        oscillatorNode.onended = async () => {
            oscillatorNode.disconnect(gainNode);
            gainNode.disconnect(mediaStreamAudioDestinationNode ?? audioContext.destination);

            await audioContext.suspend();

            destinationAudioElement?.pause();
            mediaSessionAudioElement.pause();

            $toggle.disabled = false;
            $toggle.onclick = play;
            $toggle.textContent = textContent;
        };
    };

    $toggle.disabled = false;
    $toggle.onclick = pause;
    $toggle.textContent = 'pause';

    navigator.mediaSession.setActionHandler('pause', pause);
};

$toggle.disabled = false;
$toggle.onclick = play;

navigator.mediaSession.setActionHandler('play', play);

mediaSessionAudioElement.onplay = () => (navigator.mediaSession.playbackState = 'playing');
mediaSessionAudioElement.onpause = () => (navigator.mediaSession.playbackState = 'paused');

const duration = 600;

let offset = 0;

const getPosition = () => (offset + audioContext.currentTime) % duration;
const setPositionState = () =>
    navigator.mediaSession.setPositionState({ duration, playbackRate: mediaSessionAudioElement.playbackRate, position: getPosition() });

navigator.mediaSession.setActionHandler('seekto', ({ seekTime }) => {
    offset += seekTime - getPosition();

    setPositionState();
});

mediaSessionAudioElement.ontimeupdate = () => (mediaSessionAudioElement.ontimeupdate = () => setPositionState());
