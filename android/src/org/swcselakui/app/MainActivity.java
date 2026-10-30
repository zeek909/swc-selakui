package org.swcselakui.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * A thin shell around the committee's Google Apps Script web app.
 * Each committee deploys its own copy, so the app asks for that link
 * on first launch and keeps it on the device.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "swc";
    private static final String KEY_URL = "url";
    private static final String SETUP_PAGE = "file:///android_asset/setup.html";
    private static final int REQ_PHOTO = 1;

    private WebView web;
    private SharedPreferences prefs;
    private ValueCallback<Uri[]> pendingPhotos;
    private Uri cameraUri;
    private boolean clearHistoryNext;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "SWCApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        if (state != null && web.restoreState(state) != null) return;
        String url = savedLink();
        if (url.isEmpty()) web.loadUrl(SETUP_PAGE);
        else web.loadUrl(url);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    private String savedLink() {
        return prefs.getString(KEY_URL, "");
    }

    static boolean isAppLink(String url) {
        return url != null
                && url.startsWith("https://script.google.com/")
                && url.contains("/macros/");
    }

    private static boolean isInsideApp(Uri u) {
        if (u == null || u.getHost() == null) return false;
        if (!"https".equals(u.getScheme())) return false;
        String host = u.getHost();
        return host.equals("script.google.com")
                || host.endsWith(".googleusercontent.com")
                || host.equals("accounts.google.com");
    }

    private boolean onSetupPage() {
        String current = web.getUrl();
        return current != null && current.startsWith(SETUP_PAGE);
    }

    private void showSetup(String mode) {
        web.loadUrl(SETUP_PAGE + "#" + mode);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack() && !onSetupPage()) {
            web.goBack();
            return;
        }
        if (onSetupPage() && savedLink().isEmpty()) {
            finish();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("Leave SWC Selakui?")
                .setMessage("You can also change the committee link this app opens.")
                .setPositiveButton("Exit", new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface d, int w) { finish(); }
                })
                .setNeutralButton("Change link", new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface d, int w) { showSetup("change"); }
                })
                .setNegativeButton("Stay", null)
                .show();
    }

    /** Called from assets/setup.html only. */
    private class Bridge {
        @JavascriptInterface
        public String getLink() {
            return savedLink();
        }

        @JavascriptInterface
        public void saveLink(final String raw) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (!onSetupPage()) return;
                    String url = raw == null ? "" : raw.trim();
                    if (!isAppLink(url)) return;
                    prefs.edit().putString(KEY_URL, url).apply();
                    clearHistoryNext = true;
                    web.loadUrl(url);
                }
            });
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (!onSetupPage()) return;
                    String url = savedLink();
                    if (url.isEmpty()) showSetup("first");
                    else {
                        clearHistoryNext = true;
                        web.loadUrl(url);
                    }
                }
            });
        }
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            if (url.startsWith("file:///android_asset/")) return false;
            Uri u = Uri.parse(url);
            if (isInsideApp(u)) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, u));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            // Drop the setup or offline page from history once the app has loaded.
            if (clearHistoryNext && url != null && !url.startsWith(SETUP_PAGE)) {
                clearHistoryNext = false;
                view.clearHistory();
            }
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onReceivedError(WebView view, int code, String description, String failingUrl) {
            // Only called for the main page, so a blocked image does not trigger it.
            showSetup("offline");
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (pendingPhotos != null) pendingPhotos.onReceiveValue(null);
            pendingPhotos = callback;

            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("image/*");
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }

            List<Intent> extra = new ArrayList<>();
            Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (camera.resolveActivity(getPackageManager()) != null) {
                cameraUri = PhotoProvider.newPhotoUri(MainActivity.this);
                camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                camera.setClipData(ClipData.newRawUri("photo", cameraUri));
                camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                extra.add(camera);
            } else {
                cameraUri = null;
            }

            Intent chooser = Intent.createChooser(pick, "Add a photo");
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extra.toArray(new Intent[0]));
            try {
                startActivityForResult(chooser, REQ_PHOTO);
            } catch (ActivityNotFoundException e) {
                pendingPhotos = null;
                callback.onReceiveValue(null);
                return false;
            }
            return true;
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        if (request != REQ_PHOTO) {
            super.onActivityResult(request, result, data);
            return;
        }
        if (pendingPhotos == null) return;

        Uri[] chosen = null;
        if (result == RESULT_OK) {
            List<Uri> uris = new ArrayList<>();
            if (data != null) {
                ClipData clip = data.getClipData();
                if (clip != null) {
                    for (int i = 0; i < clip.getItemCount(); i++) {
                        Uri u = clip.getItemAt(i).getUri();
                        if (u != null && !u.equals(cameraUri)) uris.add(u);
                    }
                }
                if (uris.isEmpty() && data.getData() != null) uris.add(data.getData());
            }
            if (uris.isEmpty() && cameraUri != null) {
                File f = PhotoProvider.fileFor(this, cameraUri);
                if (f != null && f.length() > 0) uris.add(cameraUri);
            }
            if (!uris.isEmpty()) chosen = uris.toArray(new Uri[0]);
        }
        pendingPhotos.onReceiveValue(chosen);
        pendingPhotos = null;
    }
}
