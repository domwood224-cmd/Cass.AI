package org.cassidey.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(
    name = "AppUpdater",
    permissions = {
        @Permission(
            alias = "install",
            strings = { "android.permission.REQUEST_INSTALL_PACKAGES" }
        )
    }
)
public class AppUpdaterPlugin extends Plugin {

    private static final String APK_FILENAME = "cassidey-update.apk";

    @PluginMethod
    public void getCurrentVersion(PluginCall call) {
        try {
            String versionName = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0).versionName;
            int versionCode = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0).getLongVersionCode() > Integer.MAX_VALUE
                            ? (int)(getContext().getPackageManager()
                            .getPackageInfo(getContext().getPackageName(), 0).getLongVersionCode())
                            : getContext().getPackageManager()
                            .getPackageInfo(getContext().getPackageName(), 0).versionCode;
            JSObject result = new JSObject();
            result.put("versionName", versionName);
            result.put("versionCode", versionCode);
            call.resolve(result);
        } catch (PackageManager.NameNotFoundException e) {
            call.reject("Failed to get version info: " + e.getMessage());
        }
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        boolean canInstall = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            canInstall = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject result = new JSObject();
        result.put("allowed", canInstall);
        call.resolve(result);
    }

    @PluginMethod
    public void requestInstallPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (getContext().getPackageManager().canRequestPackageInstalls()) {
                JSObject result = new JSObject();
                result.put("granted", true);
                call.resolve(result);
                return;
            }
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()));
                startActivityForResult(call, intent, "installPermissionResult");
            } catch (Exception e) {
                call.reject("Failed to open install settings: " + e.getMessage());
            }
        } else {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        }
    }

    @PermissionCallback
    private void installPermissionResult(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            granted = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void saveAndInstallApk(PluginCall call) {
        if (!call.hasOption("base64Data")) {
            call.reject("Missing base64Data parameter");
            return;
        }

        String base64Data = call.getString("base64Data");
        try {
            byte[] apkBytes = Base64.decode(base64Data, Base64.DEFAULT);

            // Save to app's external files directory (accessible by FileProvider)
            File apkFile = new File(getContext().getExternalFilesDir(null), APK_FILENAME);
            try (OutputStream out = new FileOutputStream(apkFile)) {
                out.write(apkBytes);
            }

            // Delete any previous update APK to free space
            File oldApk = new File(getContext().getExternalFilesDir(null), "cassidey-update-prev.apk");
            if (oldApk.exists()) oldApk.delete();

            JSObject result = new JSObject();
            result.put("saved", true);
            result.put("path", apkFile.getAbsolutePath());
            result.put("sizeBytes", apkBytes.length);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to save APK: " + e.getMessage());
        }
    }

    @PluginMethod
    public void triggerInstall(PluginCall call) {
        File apkFile = new File(getContext().getExternalFilesDir(null), APK_FILENAME);
        if (!apkFile.exists()) {
            call.reject("APK file not found. Download it first.");
            return;
        }

        // Check install permission on Android 8+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("INSTALL_PERMISSION_REQUIRED");
            return;
        }

        try {
            Uri apkUri = androidx.core.content.FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apkFile
            );

            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setData(apkUri);
            intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

            getContext().startActivity(intent);

            call.resolve(new JSObject().put("launched", true));
        } catch (Exception e) {
            call.reject("Failed to launch installer: " + e.getMessage());
        }
    }
}
