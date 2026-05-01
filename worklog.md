---
Task ID: 1
Agent: Main Agent
Task: Fix test voices not working and permissions not loading

Work Log:
- Diagnosed voice test bug: Android WebView has a known Chrome bug where `speechSynthesis.cancel()` followed by `speechSynthesis.speak()` in the same synchronous call stack silently fails. The `doSpeak()` function was calling both back-to-back.
- Fixed by wrapping `speechSynthesis.speak(utterance)` in a `setTimeout(() => { ... }, 50)` to break out of the synchronous cancel→speak chain.
- Fixed pre-existing TypeScript errors: moved required `voices` parameter before optional params in `doSpeak()`, removed invalid `.message` property on `SpeechSynthesisErrorEvent`.
- Diagnosed permissions bug: `AndroidManifest.xml` was missing `RECORD_AUDIO` permission, NativeBridge had no permission methods, and WebView couldn't prompt for mic access.
- Added `RECORD_AUDIO` permission to AndroidManifest.xml.
- Added `WebChromeClient.onPermissionRequest()` override to auto-grant WebView mic permission requests.
- Added three new methods to NativeBridge: `hasMicrophonePermission()`, `requestMicrophonePermission()`, `openAppSettings()`.
- Added `onRequestPermissionsResult()` override that dispatches a `cassidey_permission_result` custom event to JavaScript.
- Added Permissions UI section in Settings tab with live mic status (Granted/Denied/Checking), Grant Permission button, and App Settings button.
- Added mic permission check before starting speech recognition in `startRecognition()`.
- Added permission state management with `useEffect` listener for real-time permission result updates.

Stage Summary:
- Voice test button now works on Android WebView (50ms delay fix)
- Permissions section now loads and displays real-time mic permission status
- Users can grant mic permission directly from Settings or open system App Settings
- Speech recognition is gated on mic permission check before starting
- Build passes `tsc --noEmit` and `vite build` successfully

---
Task ID: 2
Agent: Main Agent
Task: Fix build failure — deprecated setAudioStreamType() removed in modern Android SDK

Work Log:
- Investigated GitHub Actions build #54 failure via API logs
- Root cause: `nativeTTS.setAudioStreamType(AudioManager.STREAM_MUSIC)` at line 192 was removed in Android SDK API 33+
- Also found deprecated 2-arg `speak(text, mode, params)` legacy fallback in `speakNative()`
- Fixed by removing all pre-Lollipop conditional branches (Capacitor 8 requires API 21+ minimum anyway)
- Replaced with direct `setAudioAttributes()` call and 4-arg `speak()` call
- Removed unused `AudioManager` import

Stage Summary:
- Build #55 compiled and completed successfully
- APK available at: https://github.com/domwood224-cmd/Cass.AI/releases/download/v0.0.0/app-release.apk
- Native TTS now uses modern AudioAttributes API (USAGE_MEDIA, CONTENT_TYPE_SPEECH)

---
Task ID: 3
Agent: Main Agent
Task: Fix mic ding-loop bug in voice call

Work Log:
- Diagnosed: recognition.onend/onerror handlers checked `callIsSpeaking` (React state) inside a `useCallback` closure that captured the value at creation time
- When AI TTS set callIsSpeaking=true, recognition handlers still saw old value (false) and kept auto-restarting — causing infinite ding sounds
- Added `aiSpeakingRef` (useRef) to track TTS speaking state synchronously without stale closure
- All recognition restart guards now check `aiSpeakingRef` + `processingRef` instead of `callIsSpeaking`
- Removed `callIsSpeaking` from `startRecognition` dependency array (prevents constant re-creates)
- Added double-checked guards in setTimeout callbacks to prevent race conditions
- Increased no-speech restart delay from 300ms to 500ms to reduce ding frequency

Stage Summary:
- Build #56 compiled and completed successfully
- APK: https://github.com/domwood224-cmd/Cass.AI/releases/download/v0.0.0/app-release.apk
- Mic should no longer ding-loop during voice calls

---
Task ID: 4
Agent: Main Agent
Task: Fix TTS no-sound — never fall back to broken Web Speech API on Android

Work Log:
- ROOT CAUSE: speak() waited only 3 seconds for native TTS init, then fell back to Web Speech API
  which produces ZERO audio on Android WebView. User always got silence.
- Rewrote speak() in voice.ts to NEVER fall back to Web Speech API when native bridge exists
- If TTS not ready, queues text via speakTts() (Java holds as pendingTTS and speaks when init fires)
- Increased TTS ready wait from 3s to 10s, added reinit + 5s second wait before giving up
- Added AudioManager audio focus request (GAIN_TRANSIENT_MAY_DUCK) before speaking in Java
- Added audio focus abandon on TTS done/error
- Added getTtsStatus() Java bridge method for debugging (returns JSON)
- Added TtsDebugStatus React component showing live TTS status in call UI
- Increased delay before TTS speak from 500ms to 1000ms for audio focus transition

Stage Summary:
- Build #57 compiled and completed successfully
- APK: https://github.com/domwood224-cmd/Cass.AI/releases/download/v0.0.0/app-release.apk
- TTS now uses native Android TextToSpeech exclusively with audio focus management
- Call UI shows live TTS engine status (ready/speaking/queued) for debugging
