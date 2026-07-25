// Audio Alert & Continuous Alarm Loop Utility with MP3 & WebAudio synth support

let audioContext: AudioContext | null = null;
let alarmIntervalId: ReturnType<typeof setInterval> | null = null;
let currentHtmlAudio: HTMLAudioElement | null = null;
let isAudioPlaying = false;
let isTestPlaying = false;

// Pre-defined royalty-free high-audibility MP3 sound data URIs or online links
export const MP3_PRESETS = [
  {
    id: 'siren_synth',
    name: 'Sirène d\'Urgence Synthétique (Haut-parleur)',
    type: 'synth' as const,
  },
  {
    id: 'mp3_chime',
    name: 'Carillon Digital MP3 (Double Bip)',
    type: 'mp3' as const,
    url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  },
  {
    id: 'mp3_alarm_clock',
    name: 'Sonnerie d\'Alarme Resto MP3 (Urgent)',
    type: 'mp3' as const,
    url: 'https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3',
  },
  {
    id: 'mp3_bell',
    name: 'Cloche de Service Restaurant MP3',
    type: 'mp3' as const,
    url: 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3',
  },
  {
    id: 'custom_mp3',
    name: 'Lien MP3 Personnalisé (URL)',
    type: 'mp3' as const,
    url: '',
  },
];

export function playSynthSiren(volume = 0.5) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext || audioContext.state === 'suspended') {
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const ctx = audioContext;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.2);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.4);

    osc2.frequency.setValueAtTime(587.33, now);
    osc2.frequency.exponentialRampToValueAtTime(880, now + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(587.33, now + 0.4);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  } catch (e) {
    console.warn('Audio synth error:', e);
  }
}

export function startContinuousAlarm(soundType = 'mp3_alarm_clock', customUrl = '', volume = 0.8) {
  stopContinuousAlarm();
  isAudioPlaying = true;

  const selectedPreset = MP3_PRESETS.find((p) => p.id === soundType);
  const mp3Url = soundType === 'custom_mp3' && customUrl ? customUrl : selectedPreset?.url;

  if (selectedPreset?.type === 'mp3' && mp3Url) {
    try {
      currentHtmlAudio = new Audio(mp3Url);
      currentHtmlAudio.loop = true;
      currentHtmlAudio.volume = Math.min(Math.max(volume, 0.1), 1);
      const playPromise = currentHtmlAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('MP3 playback blocked by browser policy, falling back to synth:', err);
          // Fallback to Web Audio oscillator synth loop
          alarmIntervalId = setInterval(() => playSynthSiren(volume), 800);
        });
      }
    } catch (e) {
      console.warn('Audio MP3 play error, falling back:', e);
      alarmIntervalId = setInterval(() => playSynthSiren(volume), 800);
    }
  } else {
    // Default Web Audio synth loop
    playSynthSiren(volume);
    alarmIntervalId = setInterval(() => playSynthSiren(volume), 800);
  }
}

export function stopContinuousAlarm() {
  isAudioPlaying = false;
  isTestPlaying = false;

  if (alarmIntervalId) {
    clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }

  if (currentHtmlAudio) {
    try {
      currentHtmlAudio.pause();
      currentHtmlAudio.currentTime = 0;
    } catch (e) {
      console.warn('Error stopping HTML audio:', e);
    }
    currentHtmlAudio = null;
  }
}

export function testAlarmSound(soundType = 'mp3_alarm_clock', customUrl = '', volume = 0.8) {
  stopContinuousAlarm();
  isTestPlaying = true;

  const selectedPreset = MP3_PRESETS.find((p) => p.id === soundType);
  const mp3Url = soundType === 'custom_mp3' && customUrl ? customUrl : selectedPreset?.url;

  if (selectedPreset?.type === 'mp3' && mp3Url) {
    try {
      currentHtmlAudio = new Audio(mp3Url);
      currentHtmlAudio.loop = false;
      currentHtmlAudio.volume = volume;
      currentHtmlAudio.play().catch(() => playSynthSiren(volume));
    } catch (e) {
      playSynthSiren(volume);
    }
  } else {
    playSynthSiren(volume);
  }
}

export function getIsTestPlaying() {
  return isTestPlaying;
}
