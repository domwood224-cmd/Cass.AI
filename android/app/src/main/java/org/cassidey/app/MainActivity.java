package org.cassidey.app;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int STORAGE_PERMISSION_CODE = 101;

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
        getWindow().setStatusBarColor(0x00000000);  // fully transparent
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setNavigationBarColor(0x00000000);  // fully transparent
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
        // Small delay to ensure the Bridge/WebView is fully initialized
        getBridge().getWebView().postDelayed(() -> {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new NativeBridge(), "CassideyNative");

            // Calculate real system bar heights and inject them immediately
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
    }

    /** Get the status bar height in pixels via WindowInsets (API 20+) or resource */
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
        // Fallback: read from system resources
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        return resourceId > 0 ? getResources().getDimensionPixelSize(resourceId) : 0;
    }

    /** Get the navigation bar height in pixels */
    private int getNavigationBarHeight() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsets insets = getWindowManager().getCurrentWindowMetrics().getWindowInsets();
            int nav = insets.getInsets(WindowInsets.Type.navigationBars()).bottom;
            return nav > 0 ? nav : 48;  // gesture nav may report 0 on some devices
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
            if (insets != null) {
                int nav = insets.getSystemWindowInsetBottom();
                if (nav > 0) return nav;
            }
        }
        // Fallback: read from system resources
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
