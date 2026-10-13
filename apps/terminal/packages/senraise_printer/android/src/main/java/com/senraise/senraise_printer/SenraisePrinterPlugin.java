package com.senraise.senraise_printer;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import io.flutter.embedding.engine.plugins.FlutterPlugin;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;
import io.flutter.plugin.common.MethodChannel.MethodCallHandler;
import io.flutter.plugin.common.MethodChannel.Result;
import recieptservice.com.recieptservice.PrinterInterface;

/**
 * Talks to the Senraise printing service (an Android service of the terminal, bound with its AIDL interface).
 * Differences from the original plugin: every call is answered (success or an error code), calls wait for the service to be bound,
 * a whole receipt is printed as one batch on a single worker thread so two receipts never interleave, and the bind is retried.
 */
public class SenraisePrinterPlugin implements FlutterPlugin, MethodCallHandler {
    private static final String TAG = "SenraisePrinter";
    private MethodChannel channel;
    private Context context;
    private volatile PrinterInterface printer;
    private final Object lock = new Object();
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private final ServiceConnection connection = new ServiceConnection() {
        @Override public void onServiceConnected(ComponentName name, IBinder binder) {
            synchronized (lock) { printer = PrinterInterface.Stub.asInterface(binder); lock.notifyAll(); }
        }
        @Override public void onServiceDisconnected(ComponentName name) {
            synchronized (lock) { printer = null; }
        }
    };

    private boolean bind() {
        try {
            Intent intent = new Intent();
            intent.setClassName("recieptservice.com.recieptservice", "recieptservice.com.recieptservice.service.PrinterService");
            return context.bindService(intent, connection, Context.BIND_AUTO_CREATE);
        } catch (Exception e) {
            Log.e(TAG, "bind failed: " + e);
            return false;
        }
    }

    // Waits for the printing service (it can take a moment after the app starts); asks to bind again if it is not coming.
    private PrinterInterface waitForPrinter(long timeoutMs) {
        long end = System.currentTimeMillis() + timeoutMs;
        synchronized (lock) {
            if (printer == null) bind();
            while (printer == null) {
                long left = end - System.currentTimeMillis();
                if (left <= 0) break;
                try { lock.wait(Math.min(left, 500)); } catch (InterruptedException e) { Thread.currentThread().interrupt(); break; }
            }
            return printer;
        }
    }

    @Override
    public void onAttachedToEngine(@NonNull FlutterPluginBinding binding) {
        context = binding.getApplicationContext();
        channel = new MethodChannel(binding.getBinaryMessenger(), "senraise_printer");
        channel.setMethodCallHandler(this);
        bind();
    }

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull Result result) {
        switch (call.method) {
            case "bound": result.success(printer != null); return;
            case "version":
                worker.execute(() -> {
                    PrinterInterface p = waitForPrinter(3000);
                    if (p == null) { reply(result, "NOT_BOUND", null); return; }
                    try { replyOk(result, p.getServiceVersion()); } catch (Exception e) { reply(result, "PRINT_FAILED", e.getMessage()); }
                });
                return;
            case "batch":
                final List<Map<String, Object>> ops = call.argument("ops");
                if (ops == null) { result.error("BAD_ARGS", "ops missing", null); return; }
                worker.execute(() -> {
                    PrinterInterface p = waitForPrinter(4000);
                    if (p == null) { reply(result, "NOT_BOUND", "The printing service is not available."); return; }
                    try { for (Map<String, Object> op : ops) run(p, op); replyOk(result, null); }
                    catch (Exception e) { Log.e(TAG, "print failed", e); reply(result, "PRINT_FAILED", String.valueOf(e.getMessage())); }
                });
                return;
            default: result.notImplemented();
        }
    }

    private void run(PrinterInterface p, Map<String, Object> op) throws Exception {
        String name = (String) op.get("op");
        if (name == null) return;
        switch (name) {
            case "text": p.printText((String) op.get("text")); break;
            case "pic": {
                byte[] data = (byte[]) op.get("data");
                Bitmap bmp = BitmapFactory.decodeByteArray(data, 0, data.length);
                if (bmp == null) throw new IllegalArgumentException("bad image");
                p.printBitmap(bmp);
                break;
            }
            case "qr": p.printQRCode((String) op.get("data"), num(op, "size", 6), num(op, "level", 1)); break;
            case "bar": p.printBarCode((String) op.get("data"), num(op, "symbology", 8), num(op, "height", 100), num(op, "width", 2)); break;
            case "align": p.setAlignment(num(op, "value", 0)); break;
            case "size": p.setTextSize(((Number) op.get("value")).floatValue()); break;
            case "bold": p.setTextBold(Boolean.TRUE.equals(op.get("value"))); break;
            case "dark": p.setDark(num(op, "value", 0)); break;
            case "line": p.nextLine(num(op, "count", 1)); break;
            case "epson": p.printEpson((byte[]) op.get("data")); break;
            default: throw new IllegalArgumentException("unknown op " + name);
        }
    }

    private static int num(Map<String, Object> op, String key, int fallback) {
        Object v = op.get(key);
        return v instanceof Number ? ((Number) v).intValue() : fallback;
    }

    private void reply(Result result, String code, String message) { main.post(() -> result.error(code, message, null)); }
    private void replyOk(Result result, Object value) { main.post(() -> result.success(value)); }

    @Override
    public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {
        try { context.unbindService(connection); } catch (Exception ignored) { }
        channel.setMethodCallHandler(null);
        worker.shutdown();
    }
}
