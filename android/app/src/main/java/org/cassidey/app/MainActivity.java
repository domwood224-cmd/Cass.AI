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
import android.webkit.WebViewClient;
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
    private volatile String pendingTTS = null;
    private volatile double pendingTTSPitch = 1.0;
    private volatile double pendingTTSRate = 1.0;
    private volatile double pendingTTSVolume = 1.0;
    private AudioManager audioManager = null;
    private Object audioFocusRequest = null;
    private volatile boolean hasAudioFocus = false;
    private volatile String lastError = "none";
    private volatile int speakCallCount = 0;
    private volatile int speakSuccessCount = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        Log.i(TAG, "=== MainActivity.onCreate() START ===");
        super.onCreate(savedInstanceState);
        Log.i(TAG, "=== Capacitor super.onCreate() completed ===");

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

        // ── Initialize native TTS engine (async, non-blocking) ──
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        // Delay TTS init slightly to not block UI startup
        new android.os.Handler().postDelayed(() -> {
            try {
                initTtsEngine();
            } catch (Exception e) {
                Log.e(TAG, "Failed to initialize TTS engine", e);
                lastError = "TTS init exception: " + e.getMessage();
            }
        }, 1000);

        // ── Inject native bridge when WebView page finishes loading ──
        // Using onPageFinished is MORE reliable than postDelayed(300)
        // because it guarantees the page is ready to receive the bridge.
        getBridge().getWebView().setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectNativeBridge(view);
            }
        });

        // Also inject immediately as a fallback (in case onPageFinished already fired)
        getBridge().getWebView().postDelayed(() -> {
            try {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    // Check if bridge already exists
                    webView.evaluateJavascript(
                        "javascript:window.__CASSIDEY_BRIDGE_INJECTED__||false",
                        value -> {
                            if (!"true".equals(value)) {
                                Log.i(TAG, "Fallback bridge injection triggered");
                                injectNativeBridge(webView);
                            } else {
                                Log.i(TAG, "Bridge already injected, skipping fallback");
                            }
                        }
                    );
                }
            } catch (Exception e) {
                Log.w(TAG, "Fallback bridge injection failed", e);
            }
        }, 500);
    }

    /** Inject the native bridge, WebChromeClient, and device metrics into the WebView */
    private void injectNativeBridge(WebView webView) {
        Log.i(TAG, "=== injectNativeBridge() called ===");
        try {
            Log.i(TAG, "Injecting native bridge into WebView...");

            // Set up WebChromeClient for permission handling
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    Log.d(TAG, "WebView permission request: " + java.util.Arrays.toString(request.getResources()));
                    runOnUiThread(() -> request.grant(request.getResources()));
                }
            });

            // Inject the Java bridge object
            webView.addJavascriptInterface(new NativeBridge(), "CassideyNative");

            // Send device metrics
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
                "window.__CASSIDEY_BRIDGE_INJECTED__=true;" +
                "window.dispatchEvent(new Event('nativeInsetsReady'));" +
                "console.log('[Cassidey] Native bridge injected successfully');" +
                "})();",
                statusBarH, navBarH, screenH, screenW, density
            );
            webView.evaluateJavascript(js, null);

            Log.i(TAG, "Native bridge injected: CassideyNative, status=" + statusBarH + "px, nav=" + navBarH + "px");
        } catch (Exception e) {
            Log.e(TAG, "FAILED to inject native bridge", e);
        }
    }

    /** Initialize (or re-initialize) the native TTS engine */
    private void initTtsEngine() {
        ttsReady = false;
        lastError = "initializing";
        Log.i(TAG, "initTtsEngine: Starting TTS initialization...");

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
                try {
                if (status != TextToSpeech.SUCCESS) {
                    String err = "TTS init FAILED: status=" + status;
                    Log.e(TAG, err);
                    lastError = err;
                    runOnUiThread(() -> dispatchJsEvent("nativeTtsError", err));
                    return;
                }

                // Try multiple locales in order of preference
                Locale[] localesToTry = { Locale.US, Locale.UK, Locale.ENGLISH, Locale.getDefault() };
                boolean langSet = false;

                for (Locale loc : localesToTry) {
                    try {
                        int result = nativeTTS.setLanguage(loc);
                        if (result == TextToSpeech.LANG_AVAILABLE || result == TextToSpeech.LANG_COUNTRY_AVAILABLE || result == TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE) {
                            Log.i(TAG, "TTS language set to: " + loc.toLanguageTag() + " (result=" + result + ")");
                            langSet = true;
                            break;
                        } else {
                            Log.w(TAG, "TTS language not available for: " + loc + " (result=" + result + ")");
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to set TTS language: " + loc, e);
                    }
                }

                if (!langSet) {
                    Log.w(TAG, "TTS: NO suitable language found — using default");
                    langSet = true; // Let the engine use whatever it has
                }

                ttsReady = langSet;
                lastError = "none";
                Log.i(TAG, "TTS engine READY: " + ttsReady);

                // Set audio attributes: assistant usage for TTS (accessibility/speech)
                try {
                    nativeTTS.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANT)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build());
                } catch (Exception e) {
                    Log.w(TAG, "Failed to set audio attributes, trying fallback", e);
                    try {
                        // Fallback to media usage if assistant fails
                        nativeTTS.setAudioAttributes(new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_MEDIA)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build());
                    } catch (Exception e2) {
                        Log.w(TAG, "Fallback audio attributes also failed", e2);
                    }
                }

                // Set up utterance progress listener
                nativeTTS.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        Log.i(TAG, "★ TTS onStart: " + utteranceId);
                        runOnUiThread(() -> dispatchJsEvent("nativeTtsStart", null));
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        Log.i(TAG, "★ TTS onDone: " + utteranceId);
                        abandonAudioFocusForTts();
                        runOnUiThread(() -> dispatchJsEvent("nativeTtsEnd", null));
                    }

                    @Override
                    public void onError(String utteranceId) {
                        String err = "utterance error: " + utteranceId;
                        Log.e(TAG, "★ TTS onError: " + err);
                        lastError = err;
                        abandonAudioFocusForTts();
                        runOnUiThread(() -> dispatchJsEvent("nativeTtsEnd", null));
                        runOnUiThread(() -> dispatchJsEvent("nativeTtsError", err));
                    }

                    @Override
                    public void onError(String utteranceId, int errorCode) {
                        String err = "utterance error: " + utteranceId + " code=" + errorCode;
                        Log.e(TAG, "★ TTS onError: " + err);
                        lastError = err;
                        abandonAudioFocusForTts();
                        runOnUiThread(() -> dispatchJsEvent("nativeTtsEnd", null));
                        runOnUiThread(() -> dispatchJsEvent("nativeTtsError", err));
                    }
                });

                // Notify JS
                runOnUiThread(() -> dispatchJsEvent("nativeTtsReady", null));

                // Speak any pending text
                String pending = pendingTTS;
                if (pending != null) {
                    pendingTTS = null;
                    Log.i(TAG, "Speaking pending text: " + pending.length() + " chars");
                    speakNative(pending, pendingTTSPitch, pendingTTSPitch, pendingTTSVolume);
                }
                } catch (Exception e) {
                    String err = "TTS init exception: " + e.getMessage();
                    Log.e(TAG, err, e);
                    lastError = err;
                    runOnUiThread(() -> dispatchJsEvent("nativeTtsError", err));
                }
            }
        });
    }

    /** Dispatch a CustomEvent to JavaScript — ALWAYS on UI thread */
    private void dispatchJsEvent(String eventName, String detail) {
        runOnUiThread(() -> {
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
        });
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

    /** Request audio focus — use GAIN_TRANSIENT (full, not ducked) */
    private void requestAudioFocusForTts() {
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioFocusRequest request = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                        .setAudioAttributes(new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ASSISTANT)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build())
                        .setAcceptsDelayedFocusGain(false)
                        .build();
                audioFocusRequest = request;
                int result = audioManager.requestAudioFocus(request);
                hasAudioFocus = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
                Log.i(TAG, "Audio focus (GAIN_TRANSIENT): " + (hasAudioFocus ? "GRANTED" : "DENIED"));
            } else {
                int result = audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
                hasAudioFocus = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
                Log.i(TAG, "Audio focus (legacy GAIN_TRANSIENT): " + (hasAudioFocus ? "GRANTED" : "DENIED"));
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to request audio focus", e);
            hasAudioFocus = false;
        }
    }

    /** Abandon audio focus */
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
        } catch (Exception e) {
            Log.w(TAG, "Failed to abandon audio focus", e);
        }
    }

    /** Speak text via native Android TTS — MUST be called on UI thread */
    private void speakNative(final String text, final double pitch, final double rate, final double volume) {
        speakCallCount++;

        if (nativeTTS == null) {
            Log.e(TAG, "speakNative: nativeTTS is NULL!");
            lastError = "nativeTTS is null";
            dispatchJsEvent("nativeTtsError", "TTS engine is null");
            dispatchJsEvent("nativeTtsEnd", null);
            return;
        }

        if (!ttsReady) {
            Log.w(TAG, "speakNative: TTS not ready — queuing " + text.length() + " chars");
            pendingTTS = text;
            pendingTTSPitch = pitch;
            pendingTTSRate = rate;
            pendingTTSVolume = volume;
            return;
        }

        runOnUiThread(() -> {
            try {
                // Request FULL audio focus (not ducked — we need to hear the speech)
                requestAudioFocusForTts();

                // Only speak if we have audio focus
                if (!hasAudioFocus) {
                    Log.w(TAG, "No audio focus granted, cannot speak TTS");
                    dispatchJsEvent("nativeTtsError", "no audio focus");
                    dispatchJsEvent("nativeTtsEnd", null);
                    return;
                }

                nativeTTS.setPitch((float) pitch);
                nativeTTS.setSpeechRate((float) rate);

                android.os.Bundle params = new android.os.Bundle();
                params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, (float) volume);
                int result = nativeTTS.speak(text, TextToSpeech.QUEUE_FLUSH, params, "cassidey");

                if (result == TextToSpeech.SUCCESS) {
                    speakSuccessCount++;
                    Log.i(TAG, "★ speakNative SUCCESS — " + text.length() + " chars, focus=" + hasAudioFocus + ", calls=" + speakCallCount + ", ok=" + speakSuccessCount);
                } else {
                    Log.e(TAG, "★ speakNative FAILED — result=" + result + ", text=" + text.substring(0, Math.min(50, text.length())));
                    lastError = "speak() returned: " + result;
                    abandonAudioFocusForTts();
                    dispatchJsEvent("nativeTtsError", "speak failed: " + result);
                    dispatchJsEvent("nativeTtsEnd", null);
                }
            } catch (Exception e) {
                Log.e(TAG, "★ speakNative EXCEPTION", e);
                lastError = "exception: " + e.getMessage();
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

        @JavascriptInterface
        public String hasMicrophonePermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                        == PackageManager.PERMISSION_GRANTED ? "true" : "false";
            }
            return "true";
        }

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

        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            });
        }

        // ── Native TTS Bridge Methods ──

        /** Check if TTS engine is ready */
        @JavascriptInterface
        public String isTtsReady() {
            return String.valueOf(ttsReady);
        }

        /**
         * Speak text via native Android TTS.
         * Java handles queuing if engine isn't ready yet.
         */
        @JavascriptInterface
        public String speakTts(String text, double pitch, double rate, double volume) {
            Log.i(TAG, "speakTts() called: ready=" + ttsReady + " len=" + (text != null ? text.length() : "null") + " vol=" + volume);
            if (text == null || text.isEmpty()) {
                Log.w(TAG, "speakTts: empty text!");
                return "empty";
            }
            if (ttsReady) {
                speakNative(text, pitch, rate, volume);
                return "ok";
            } else {
                Log.i(TAG, "speakTts: TTS not ready, queuing " + text.length() + " chars");
                pendingTTS = text;
                pendingTTSPitch = pitch;
                pendingTTSRate = rate;
                pendingTTSVolume = volume;
                return "queued";
            }
        }

        /** Stop any current TTS speech */
        @JavascriptInterface
        public void stopTts() {
            Log.i(TAG, "stopTts called");
            if (nativeTTS != null) {
                runOnUiThread(() -> {
                    try { nativeTTS.stop(); } catch (Exception e) { Log.w(TAG, "stopTts error", e); }
                });
            }
        }

        /** Check if TTS is currently speaking */
        @JavascriptInterface
        public String isTtsSpeaking() {
            if (nativeTTS != null) {
                try { return String.valueOf(nativeTTS.isSpeaking()); } catch (Exception ignored) {}
            }
            return "false";
        }

        /** Force re-initialize TTS engine */
        @JavascriptInterface
        public void reinitTts() {
            Log.i(TAG, "reinitTts requested from JS");
            runOnUiThread(() -> initTtsEngine());
        }

        /**
         * Test TTS — speaks a simple test phrase.
         * Used to verify the entire JS→Java→TTS→Audio pipeline works.
         */
        @JavascriptInterface
        public String testTts() {
            Log.i(TAG, "testTts() called");
            if (nativeTTS == null) {
                lastError = "TTS engine is null";
                return "{\"error\":\"TTS engine is null\"}";
            }
            if (!ttsReady) {
                lastError = "TTS not ready";
                return "{\"error\":\"TTS not ready\"}";
            }
            // Speak a simple test on the UI thread
            runOnUiThread(() -> {
                try {
                    requestAudioFocusForTts();
                    android.os.Bundle params = new android.os.Bundle();
                    params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
                    int result = nativeTTS.speak("Testing voice output", TextToSpeech.QUEUE_FLUSH, params, "test");
                    Log.i(TAG, "testTts speak result: " + (result == TextToSpeech.SUCCESS ? "SUCCESS" : "FAILED=" + result));
                } catch (Exception e) {
                    Log.e(TAG, "testTts exception", e);
                }
            });
            return "{\"status\":\"speaking\"}";
        }

        /** Get comprehensive TTS diagnostic info */
        @JavascriptInterface
        public String getTtsStatus() {
            return "{"
                + "\"ready\":" + ttsReady
                + ",\"speaking\":" + (nativeTTS != null && nativeTTS.isSpeaking())
                + ",\"hasEngine\":" + (nativeTTS != null)
                + ",\"audioFocus\":" + hasAudioFocus
                + ",\"pending\":" + (pendingTTS != null)
                + ",\"calls\":" + speakCallCount
                + ",\"success\":" + speakSuccessCount
                + ",\"lastError\":\"" + lastError.replace("\"", "'") + "\""
                + "}";
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MIC_PERMISSION_CODE) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
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
