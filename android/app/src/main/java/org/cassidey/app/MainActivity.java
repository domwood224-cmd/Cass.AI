package org.cassidey.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "CassideyTTS";
    private static final int STORAGE_PERMISSION_CODE = 101;
    private static final int MIC_PERMISSION_CODE = 102;

    // ── Native TTS Engine ──
    private TextToSpeech nativeTTS = null;
    private volatile boolean ttsReady = false;
    private String pendingTTS = null;
    private double pendingTTSPitch = 1.0;
    private double pendingTTSRate = 1.0;
    private double pendingTTSVolume = 1.0;
    private AudioManager audioManager = null;
    private Object audioFocusRequest = null; // AudioFocusRequest on API 26+, null on older
    private volatile boolean hasAudioFocus = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ── True edge-to-edge: WebView draws behind system bars ──
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }

        // Make status bar and nav bar transparent
        getWindow().setStatusBarColor(0x00000000);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setNavigationBarColor(0x00000000);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

        // ── Request storage permissions ──
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!android.os.Environment.isExternalStorageManager()) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivityForResult(intent, STORAGE_PERMISSION_CODE);
                } catch (Exception e) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                    startActivityForResult(intent, STORAGE_PERMISSION_CODE);
                }
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(
                    new String[]{
                        Manifest.permission.READ_EXTERNAL_STORAGE,
                        Manifest.permission.WRITE_EXTERNAL_STORAGE
                    },
                    STORAGE_PERMISSION_CODE
                );
            }
        }

        // ── Inject native bridge after Capacitor's WebView is ready ──
        getBridge().getWebView().postDelayed(() -> {
            WebView webView = getBridge().getWebView();

            // Handle WebView permission requests (microphone, camera, etc.)
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    // Auto-grant microphone and audio capture permissions from WebView
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            runOnUiThread(() -> request.grant(request.getResources()));
                            return;
                        }
                    }
                    runOnUiThread(() -> request.grant(request.getResources()));
                }
            });

            webView.addJavascriptInterface(new NativeBridge(), "CassideyNative");

            int statusBarH = getStatusBarHeight();
            int navBarH = getNavigationBarHeight();
            int screenH = getScreenHeight();
            int screenW = getScreenWidth();
            float density = getResources().getDisplayMetrics().density;

            String js = String.format(
                "javascript:(function(){" +
                "window.__CASSIDEY_NATIVE__={" +
                "statusBarHeight:%d," +
                "navigationBarHeight:%d," +
                "screenHeight:%d," +
                "screenWidth:%d," +
                "density:%f" +
                "};" +
                "window.dispatchEvent(new Event('nativeInsetsReady'));" +
                "})();",
                statusBarH, navBarH, screenH, screenW, density
            );
            webView.evaluateJavascript(js, null);
        }, 300);

        // ── Initialize native TTS engine ──
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        initTtsEngine();
    }

    /** Initialize (or re-initialize) the native TTS engine with language fallback */
    private void initTtsEngine() {
        ttsReady = false;

        // Shutdown old engine if exists
        if (nativeTTS != null) {
            try { nativeTTS.stop(); nativeTTS.shutdown(); } catch (Exception e) {
                Log.w(TAG, "Error shutting down old TTS engine", e);
            }
            nativeTTS = null;
        }

        nativeTTS = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status != TextToSpeech.SUCCESS) {
                    Log.e(TAG, "TTS engine initialization FAILED with status: " + status);
                    dispatchJsEvent("nativeTtsError", "TTS init failed: status=" + status);
                    return;
                }

                // Try multiple locales in order of preference
                Locale[] localesToTry = { Locale.US, Locale.UK, Locale.ENGLISH, Locale.getDefault() };
                boolean langSet = false;

                for (Locale loc : localesToTry) {
                    try {
                        int result = nativeTTS.setLanguage(loc);
                        if (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED) {
                            Log.i(TAG, "TTS language set to: " + loc.toLanguageTag());
                            langSet = true;
                            break;
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to set TTS language: " + loc, e);
                    }
                }

                if (!langSet) {
                    Log.e(TAG, "TTS: NO suitable language found. Trying default engine voices...");
                    // Last resort: don't set a language, let the engine use whatever it has
                    langSet = true;
                }

                ttsReady = langSet;
                Log.i(TAG, "TTS engine ready: " + ttsReady);

                // Set audio attributes: media stream, speech content (modern API)
                nativeTTS.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build());

                // Listen for utterance completion to notify JS
                nativeTTS.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        Log.d(TAG, "TTS onStart: " + utteranceId);
                        runOnUiThread(() -> dispatchJsEvent("nativeTtsStart", null));
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        Log.d(TAG, "TTS onDone: " + utteranceId);
                        abandonAudioFocusForTts();
                        runOnUiThread(() -> dispatchJsEvent("nativeTtsEnd", null));
                    }

                    @Override
                    public void onError(String utteranceId) {
                        Log.e(TAG, "TTS onError: " + utteranceId);
                        abandonAudioFocusForTts();
                        runOnUiThread(() -> dispatchJsEvent("nativeTtsEnd", null));
                        runOnUiThread(() -> dispatchJsEvent("nativeTtsError", "utterance error: " + utteranceId));
                    }

                    // Required on API 21+ — onError with error code
                    @Override
                    public void onError(String utteranceId, int errorCode) {
                        Log.e(TAG, "TTS onError: " + utteranceId + " code=" + errorCode);
                        onError(utteranceId);
                    }
                });

                // Notify JS that TTS is ready
                runOnUiThread(() -> dispatchJsEvent("nativeTtsReady", null));

                // Fire any pending speak from JS
                if (pendingTTS != null) {
                    Log.i(TAG, "TTS speaking pending text (" + pendingTTS.length() + " chars)");
                    speakNative(pendingTTS, pendingTTSPitch, pendingTTSRate, pendingTTSVolume);
                    pendingTTS = null;
                }
            }
        });
    }

    /** Dispatch a CustomEvent to the WebView JavaScript context */
    private void dispatchJsEvent(String eventName, String detail) {
        try {
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                String js;
                if (detail != null) {
                    js = "javascript:window.dispatchEvent(new CustomEvent('" + eventName + "',{detail:'" + detail.replace("'", "\\'") + "'}));";
                } else {
                    js = "javascript:window.dispatchEvent(new CustomEvent('" + eventName + "'));";
                }
                wv.evaluateJavascript(js, null);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to dispatch JS event: " + eventName, e);
        }
    }

    @Override
    public void onDestroy() {
        if (nativeTTS != null) {
            nativeTTS.stop();
            nativeTTS.shutdown();
            nativeTTS = null;
        }
        super.onDestroy();
    }

    /** Request audio focus so TTS can play through speakers */
    private void requestAudioFocusForTts() {
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioFocusRequest request = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setAudioAttributes(new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_MEDIA)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build())
                        .setAcceptsDelayedFocusGain(false)
                        .build();
                audioFocusRequest = request;
                int result = audioManager.requestAudioFocus(request);
                hasAudioFocus = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
                Log.d(TAG, "Audio focus request result: " + result + " (granted=" + hasAudioFocus + ")");
            } else {
                int result = audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
                hasAudioFocus = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
                Log.d(TAG, "Audio focus request (legacy) result: " + result);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to request audio focus", e);
            hasAudioFocus = false;
        }
    }

    /** Abandon audio focus after TTS finishes */
    private void abandonAudioFocusForTts() {
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest((AudioFocusRequest) audioFocusRequest);
                audioFocusRequest = null;
            } else {
                audioManager.abandonAudioFocus(null);
            }
            hasAudioFocus = false;
            Log.d(TAG, "Audio focus abandoned");
        } catch (Exception e) {
            Log.w(TAG, "Failed to abandon audio focus", e);
        }
    }

    /** Native TTS: speak text using Android's TextToSpeech engine */
    private void speakNative(final String text, final double pitch, final double rate, final double volume) {
        if (nativeTTS == null) {
            Log.e(TAG, "speakNative called but nativeTTS is null");
            return;
        }
        if (!ttsReady) {
            Log.w(TAG, "speakNative called but TTS not ready — queuing");
            pendingTTS = text;
            pendingTTSPitch = pitch;
            pendingTTSRate = rate;
            pendingTTSVolume = volume;
            return;
        }

        runOnUiThread(() -> {
            try {
                // Request audio focus before speaking
                requestAudioFocusForTts();

                nativeTTS.setPitch((float) pitch);
                nativeTTS.setSpeechRate((float) rate);

                android.os.Bundle params = new android.os.Bundle();
                params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, (float) volume);
                int result = nativeTTS.speak(text, TextToSpeech.QUEUE_FLUSH, params, "cassidey");
                if (result != TextToSpeech.SUCCESS) {
                    Log.e(TAG, "TTS speak() returned ERROR: " + result);
                    abandonAudioFocusForTts();
                    dispatchJsEvent("nativeTtsError", "speak failed: " + result);
                    dispatchJsEvent("nativeTtsEnd", null);
                } else {
                    Log.d(TAG, "TTS speak() SUCCESS — " + text.length() + " chars, audioFocus=" + hasAudioFocus);
                }
            } catch (Exception e) {
                Log.e(TAG, "Exception in speakNative", e);
                abandonAudioFocusForTts();
                dispatchJsEvent("nativeTtsError", "exception: " + e.getMessage());
                dispatchJsEvent("nativeTtsEnd", null);
            }
        });
    }

    /** JavaScript interface class exposed to the WebView */
    public class NativeBridge {
        @JavascriptInterface
        public int getStatusBarHeight() {
            return MainActivity.this.getStatusBarHeight();
        }

        @JavascriptInterface
        public int getNavigationBarHeight() {
            return MainActivity.this.getNavigationBarHeight();
        }

        @JavascriptInterface
        public int getScreenWidth() {
            return MainActivity.this.getScreenWidth();
        }

        @JavascriptInterface
        public int getScreenHeight() {
            return MainActivity.this.getScreenHeight();
        }

        @JavascriptInterface
        public double getDensity() {
            return (double) MainActivity.this.getResources().getDisplayMetrics().density;
        }

        // ── Permission Helpers ──

        /** Check if microphone permission is granted. Returns "true" or "false" (string for JS compat). */
        @JavascriptInterface
        public String hasMicrophonePermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                        == PackageManager.PERMISSION_GRANTED ? "true" : "false";
            }
            return "true";
        }

        /** Request microphone permission. Result is sent via onPermissionsResult. */
        @JavascriptInterface
        public void requestMicrophonePermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{Manifest.permission.RECORD_AUDIO},
                            MIC_PERMISSION_CODE
                    );
                }
            });
        }

        /** Open the app's system settings page so the user can manually grant permissions. */
        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            });
        }

        // ── Native TTS Bridge Methods ──

        /** Check if native TTS engine is ready. Returns "true" or "false" (string). */
        @JavascriptInterface
        public String isTtsReady() {
            return String.valueOf(ttsReady);
        }

        /**
         * Speak text using native Android TTS.
         * Uses double params for JavaScript bridge compatibility (JS numbers are doubles).
         * @param text       The text to speak
         * @param pitch      0.1 - 2.0 (default 1.0)
         * @param rate       0.1 - 2.0 (default 1.0)
         * @param volume     0.0 - 1.0 (default 1.0)
         * @return "ok" if speak was called, "not_ready" if TTS engine is not initialized
         */
        @JavascriptInterface
        public String speakTts(String text, double pitch, double rate, double volume) {
            Log.d(TAG, "speakTts called: ready=" + ttsReady + " len=" + (text != null ? text.length() : "null"));
            if (ttsReady) {
                speakNative(text, pitch, rate, volume);
                return "ok";
            } else {
                // Queue for when TTS initializes (or re-initializes)
                pendingTTS = text;
                pendingTTSPitch = pitch;
                pendingTTSRate = rate;
                pendingTTSVolume = volume;
                return "not_ready";
            }
        }

        /** Stop any current TTS speech. */
        @JavascriptInterface
        public void stopTts() {
            Log.d(TAG, "stopTts called");
            if (nativeTTS != null) {
                runOnUiThread(() -> nativeTTS.stop());
            }
        }

        /** Check if TTS is currently speaking. Returns "true" or "false" (string). */
        @JavascriptInterface
        public String isTtsSpeaking() {
            if (nativeTTS != null) {
                return String.valueOf(nativeTTS.isSpeaking());
            }
            return "false";
        }

        /** Force re-initialize the TTS engine (use if TTS init failed initially). */
        @JavascriptInterface
        public void reinitTts() {
            Log.i(TAG, "reinitTts requested from JS");
            runOnUiThread(() -> initTtsEngine());
        }

        /** Get TTS diagnostic status for debugging. Returns JSON string. */
        @JavascriptInterface
        public String getTtsStatus() {
            return "{\"ready\":" + ttsReady
                + ",\"speaking\":" + (nativeTTS != null && nativeTTS.isSpeaking())
                + ",\"hasEngine\":" + (nativeTTS != null)
                + ",\"audioFocus\":" + hasAudioFocus
                + ",\"pendingText\":" + (pendingTTS != null)
                + "}";
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MIC_PERMISSION_CODE) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            // Notify the WebView that permission result is in
            runOnUiThread(() -> {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.evaluateJavascript(
                            "javascript:window.dispatchEvent(new CustomEvent('cassidey_permission_result', {detail:{mic:" + granted + "}}));",
                            null
                    );
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  DISPLAY HELPERS
    // ═══════════════════════════════════════════════════════════

    private int getStatusBarHeight() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsets insets = getWindowManager().getCurrentWindowMetrics().getWindowInsets();
            return insets.getInsets(WindowInsets.Type.statusBars()).top;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
            if (insets != null) {
                return insets.getSystemWindowInsetTop();
            }
        }
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        return resourceId > 0 ? getResources().getDimensionPixelSize(resourceId) : 0;
    }

    private int getNavigationBarHeight() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsets insets = getWindowManager().getCurrentWindowMetrics().getWindowInsets();
            int nav = insets.getInsets(WindowInsets.Type.navigationBars()).bottom;
            return nav > 0 ? nav : 48;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
            if (insets != null) {
                int nav = insets.getSystemWindowInsetBottom();
                if (nav > 0) return nav;
            }
        }
        int resourceId = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        return resourceId > 0 ? getResources().getDimensionPixelSize(resourceId) : 48;
    }

    private int getScreenWidth() {
        DisplayMetrics metrics = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(metrics);
        return metrics.widthPixels;
    }

    private int getScreenHeight() {
        DisplayMetrics metrics = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(metrics);
        return metrics.heightPixels;
    }
}
