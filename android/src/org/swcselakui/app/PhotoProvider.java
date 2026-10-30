package org.swcselakui.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Lets the camera app save a photo into this app's private cache, so a bill
 * or ID photo can be taken straight from the upload button.
 */
public class PhotoProvider extends ContentProvider {

    private static final String DIR = "photos";

    static Uri newPhotoUri(Context ctx) {
        File dir = new File(ctx.getCacheDir(), DIR);
        if (!dir.exists()) dir.mkdirs();
        File[] old = dir.listFiles();
        if (old != null) {
            long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
            for (File f : old) if (f.lastModified() < cutoff) f.delete();
        }
        String name = "photo-" + System.currentTimeMillis() + ".jpg";
        return Uri.parse("content://" + ctx.getPackageName() + ".photos/" + name);
    }

    static File fileFor(Context ctx, Uri uri) {
        String name = uri.getLastPathSegment();
        if (name == null || name.contains("/") || name.startsWith(".")) return null;
        return new File(new File(ctx.getCacheDir(), DIR), name);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = fileFor(getContext(), uri);
        if (f == null) throw new FileNotFoundException(uri.toString());
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.parseMode(mode));
    }

    @Override
    public String getType(Uri uri) {
        return "image/jpeg";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        File f = fileFor(getContext(), uri);
        if (f == null) return null;
        String[] cols = {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor c = new MatrixCursor(cols, 1);
        c.addRow(new Object[]{f.getName(), f.length()});
        return c;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] args) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] args) {
        return 0;
    }
}
