package com.forsakenblank.arcade;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // the back button steps back through pages (game to hub) and only leaves the app from the hub
    @Override
    public void onBackPressed() {
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
