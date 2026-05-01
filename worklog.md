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
