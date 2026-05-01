package org.cassidey.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.util.DisplayMetrics;
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
    private static final int STORAGE_PERMISSION_CODE = 101;
    private static final int MIC_PERMISSION_CODE = 102;

    // ── Native TTS Engine ──
    private TextToSpeech nativeTTS = null;
    private boolean ttsReady = false;
    private String pendingTTS = null;
    private float pendingTTSPitch = 1.0f;
    private float pendingTTSRate = 1.0f;
    private float pendingTTSVolume = 1.0f;

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
        nativeTTS = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status == TextToSpeech.SUCCESS) {
                    int result = nativeTTS.setLanguage(Locale.US);
                    ttsReady = (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED);

                    // Listen for utterance completion to notify JS
                    nativeTTS.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
                        @Override
                        public void onStart(String utteranceId) {
                            runOnUiThread(() -> {
                                WebView wv = getBridge().getWebView();
                                if (wv != null) wv.evaluateJavascript(
                                    "javascript:window.dispatchEvent(new CustomEvent('nativeTtsStart'));", null);
                            });
                        }
                        @Override
                        public void onDone(String utteranceId) {
                            runOnUiThread(() -> {
                                WebView wv = getBridge().getWebView();
                                if (wv != null) wv.evaluateJavascript(
                                    "javascript:window.dispatchEvent(new CustomEvent('nativeTtsEnd'));", null);
                            });
                        }
                        @Override
                        public void onError(String utteranceId) {
                            runOnUiThread(() -> {
                                WebView wv = getBridge().getWebView();
                                if (wv != null) wv.evaluateJavascript(
                                    "javascript:window.dispatchEvent(new CustomEvent('nativeTtsEnd'));", null);
                            });
                        }
                        // Required on API 21+ — onError with error code
                        @Override
                        public void onError(String utteranceId, int errorCode) {
                            onError(utteranceId);
                        }
                    });

                    // Fire any pending speak from JS
                    if (ttsReady && pendingTTS != null) {
                        speakNative(pendingTTS, pendingTTSPitch, pendingTTSRate, pendingTTSVolume);
                        pendingTTS = null;
                    }
                }
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

    /** Native TTS: speak text using Android's TextToSpeech engine */
    private void speakNative(final String text, final float pitch, final float rate, final float volume) {
        if (nativeTTS != null && ttsReady) {
            nativeTTS.setPitch(pitch);
            nativeTTS.setSpeechRate(rate);
            // Volume control: set on the utterance params (API 21+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                android.os.Bundle params = new android.os.Bundle();
                params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume);
                nativeTTS.speak(text, TextToSpeech.QUEUE_FLUSH, params, "cassidey_tts");
            } else {
                nativeTTS.speak(text, TextToSpeech.QUEUE_FLUSH, null);
            }
        }
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
        public float getDensity() {
            return MainActivity.this.getResources().getDisplayMetrics().density;
        }

        // ── Permission Helpers ──

        /** Check if microphone permission is granted. Returns "true" or "false" (string for JS compat). */
        @JavascriptInterface
        public String hasMicrophonePermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                        == PackageManager.PERMISSION_GRANTED ? "true" : "false";
            }
            return "true"; // Pre-M, permissions are granted at install time
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
         * @param text       The text to speak
         * @param pitch      0.1 - 2.0 (default 1.0)
         * @param rate       0.1 - 2.0 (default 1.0)
         * @param volume     0.0 - 1.0 (default 1.0)
         */
        @JavascriptInterface
        public void speakTts(String text, float pitch, float rate, float volume) {
            if (ttsReady) {
                runOnUiThread(() -> speakNative(text, pitch, rate, volume));
            } else {
                // TTS not ready yet — queue for when it initializes
                pendingTTS = text;
                pendingTTSPitch = pitch;
                pendingTTSRate = rate;
                pendingTTSVolume = volume;
            }
        }

        /** Stop any current TTS speech. */
        @JavascriptInterface
        public void stopTts() {
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
