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
