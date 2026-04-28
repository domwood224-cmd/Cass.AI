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

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;

public class MainActivity extends BridgeActivity {
    private static final int STORAGE_PERMISSION_CODE = 101;

    // ── Persistent shell process fields ──
    private Process shellProcess = null;
    private BufferedReader shellReader = null;
    private BufferedWriter shellWriter = null;
    private StringBuilder outputBuffer = new StringBuilder();
    private boolean shellRunning = false;

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

    @Override
    protected void onDestroy() {
        super.onDestroy();
        destroyShell();
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

        // ═══════════════════════════════════════════════════════════
        //  SHELL TERMINAL METHODS
        // ═══════════════════════════════════════════════════════════

        /** Initialize a persistent shell session. Returns exit code string. */
        @JavascriptInterface
        public String shellInit() {
            return initShell();
        }

        /** Write a command string to the shell's stdin. */
        @JavascriptInterface
        public void shellWrite(String input) {
            writeShell(input);
        }

        /** Read all available output from the shell since last read. */
        @JavascriptInterface
        public String shellRead() {
            return readShell();
        }

        /** Execute a single command (no persistent session needed). */
        @JavascriptInterface
        public String shellExec(String command) {
            return execCommand(command);
        }

        /** Resize the shell's terminal (for future PTY support). */
        @JavascriptInterface
        public void shellResize(int cols, int rows) {
            // Placeholder for future PTY resize support
        }

        /** Destroy the persistent shell session. */
        @JavascriptInterface
        public void shellDestroy() {
            destroyShell();
        }

        /** Check if the shell is currently running. */
        @JavascriptInterface
        public boolean shellIsRunning() {
            return shellRunning;
        }

        /** Get the current working directory. */
        @JavascriptInterface
        public String shellGetCwd() {
            return execCommand("pwd").trim();
        }

        /** Get the shell type. */
        @JavascriptInterface
        public String shellGetType() {
            // Try common shells in order of preference
            String[] shells = {"/system/bin/bash", "/system/bin/sh", "/data/data/com.termux/files/usr/bin/bash", "/data/data/com.termux/files/usr/bin/zsh"};
            for (String shell : shells) {
                if (new File(shell).exists()) return shell;
            }
            // Fallback: use whatever sh is available
            return "/system/bin/sh";
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  SHELL IMPLEMENTATION
    // ═══════════════════════════════════════════════════════════

    private synchronized String initShell() {
        try {
            destroyShell(); // Clean up any existing session

            String[] cmd;
            String shellPath = "/system/bin/sh";

            // Try to find the best available shell
            String[] preferredShells = {
                "/data/data/com.termux/files/usr/bin/bash",
                "/system/bin/bash",
                "/system/xbin/bash",
                "/system/bin/sh"
            };
            for (String s : preferredShells) {
                if (new File(s).exists()) {
                    shellPath = s;
                    break;
                }
            }

            // Use interactive mode with proper environment
            String[] env = {
                "TERM=xterm-256color",
                "HOME=" + System.getProperty("user.home", "/data/data/org.cassidey.app"),
                "PATH=/system/bin:/system/xbin:/vendor/bin:/usr/bin:/usr/local/bin:/sbin",
                "SHELL=" + shellPath,
                "ANDROID_ROOT=/system",
                "USER=root",
                "HOSTNAME=cassidey"
            };

            ProcessBuilder pb = new ProcessBuilder(shellPath, "-i");
            pb.environment().put("TERM", "xterm-256color");
            pb.environment().put("HOME", System.getProperty("user.home", "/data/data/org.cassidey.app"));
            pb.environment().put("PATH", "/system/bin:/system/xbin:/vendor/bin:/usr/bin:/usr/local/bin:/sbin");
            pb.environment().put("SHELL", shellPath);
            pb.environment().put("ANDROID_ROOT", "/system");
            pb.environment().put("USER", "root");
            pb.environment().put("HOSTNAME", "cassidey");
            pb.redirectErrorStream(true);
            pb.directory(new File("/data/data/org.cassidey.app"));

            shellProcess = pb.start();
            shellWriter = new BufferedWriter(new OutputStreamWriter(shellProcess.getOutputStream()));
            shellReader = new BufferedReader(new InputStreamReader(shellProcess.getInputStream()));
            outputBuffer = new StringBuilder();
            shellRunning = true;

            // Start a background thread to continuously read output
            new Thread(() -> {
                char[] buf = new char[4096];
                try {
                    while (shellRunning && shellReader != null) {
                        int n = shellReader.read(buf);
                        if (n == -1) break;
                        String chunk = new String(buf, 0, n);
                        synchronized (MainActivity.this) {
                            outputBuffer.append(chunk);
                        }
                        Thread.sleep(10); // Small delay to batch output
                    }
                } catch (IOException | InterruptedException e) {
                    // Shell process ended
                }
                shellRunning = false;
            }).start();

            // Give the shell a moment to start, then write a welcome
            Thread.sleep(100);

            return "OK";
        } catch (Exception e) {
            return "ERROR: " + e.getMessage();
        }
    }

    private synchronized void writeShell(String input) {
        if (shellWriter == null || !shellRunning) return;
        try {
            shellWriter.write(input + "\n");
            shellWriter.flush();
        } catch (IOException e) {
            shellRunning = false;
        }
    }

    private synchronized String readShell() {
        String result;
        synchronized (this) {
            result = outputBuffer.toString();
            outputBuffer = new StringBuilder();
        }
        return result;
    }

    private synchronized String execCommand(String command) {
        try {
            ProcessBuilder pb = new ProcessBuilder("/system/bin/sh", "-c", command);
            pb.redirectErrorStream(true);
            pb.directory(new File("/data/data/org.cassidey.app"));
            Process p = pb.start();
            BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                if (output.length() > 0) output.append("\n");
                output.append(line);
            }
            p.waitFor();
            String result = output.toString();
            return result.isEmpty() ? "" : result;
        } catch (Exception e) {
            return "ERROR: " + e.getMessage();
        }
    }

    private synchronized void destroyShell() {
        shellRunning = false;
        try {
            if (shellWriter != null) { shellWriter.close(); shellWriter = null; }
        } catch (IOException e) {}
        try {
            if (shellReader != null) { shellReader.close(); shellReader = null; }
        } catch (IOException e) {}
        if (shellProcess != null) {
            shellProcess.destroy();
            try { shellProcess.waitFor(); } catch (InterruptedException e) {}
            shellProcess = null;
        }
        outputBuffer = new StringBuilder();
    }

    // ═══════════════════════════════════════════════════════════
    //  DISPLAY HELPERS
    // ═══════════════════════════════════════════════════════════

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
