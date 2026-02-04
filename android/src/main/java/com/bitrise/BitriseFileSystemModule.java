package com.bitrise;

import android.util.Base64;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableNativeArray;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

public class BitriseFileSystemModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public BitriseFileSystemModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "BitriseFileSystem";
    }

    /**
     * Get the files directory path where CodePush files will be stored
     */
    @ReactMethod
    public void getDocumentsDirectory(Promise promise) {
        try {
            File filesDir = reactContext.getFilesDir();
            if (filesDir != null) {
                File codePushDir = new File(filesDir, "CodePush");
                promise.resolve(codePushDir.getAbsolutePath());
            } else {
                promise.reject("ERROR", "Could not find files directory");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Write file to disk with base64 encoded data
     */
    @ReactMethod
    public void writeFile(String path, String base64Data, Promise promise) {
        try {
            // Decode base64 data
            byte[] fileData = Base64.decode(base64Data, Base64.DEFAULT);

            File file = new File(path);

            // Create directory if needed
            File directory = file.getParentFile();
            if (directory != null && !directory.exists()) {
                if (!directory.mkdirs()) {
                    promise.reject("CREATE_DIR_ERROR", "Failed to create directory");
                    return;
                }
            }

            // Write file
            FileOutputStream outputStream = new FileOutputStream(file);
            try {
                outputStream.write(fileData);
                outputStream.flush();
                promise.resolve(true);
            } finally {
                outputStream.close();
            }
        } catch (Exception e) {
            promise.reject("WRITE_ERROR", e.getMessage());
        }
    }

    /**
     * Read file from disk and return as base64 encoded string
     */
    @ReactMethod
    public void readFile(String path, Promise promise) {
        try {
            File file = new File(path);

            if (!file.exists()) {
                promise.resolve(null);
                return;
            }

            // Read file
            FileInputStream inputStream = new FileInputStream(file);
            try {
                byte[] fileData = new byte[(int) file.length()];
                int bytesRead = inputStream.read(fileData);

                if (bytesRead != fileData.length) {
                    promise.reject("READ_ERROR", "Failed to read complete file");
                    return;
                }

                // Encode to base64
                String base64String = Base64.encodeToString(fileData, Base64.NO_WRAP);
                promise.resolve(base64String);
            } finally {
                inputStream.close();
            }
        } catch (Exception e) {
            promise.reject("READ_ERROR", e.getMessage());
        }
    }

    /**
     * Delete file from disk
     */
    @ReactMethod
    public void deleteFile(String path, Promise promise) {
        try {
            File file = new File(path);

            if (!file.exists()) {
                promise.resolve(false);
                return;
            }

            boolean success = file.delete();
            promise.resolve(success);
        } catch (Exception e) {
            promise.reject("DELETE_ERROR", e.getMessage());
        }
    }

    /**
     * Check if file exists
     */
    @ReactMethod
    public void fileExists(String path, Promise promise) {
        try {
            File file = new File(path);
            promise.resolve(file.exists());
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Get file size in bytes
     */
    @ReactMethod
    public void getFileSize(String path, Promise promise) {
        try {
            File file = new File(path);

            if (!file.exists()) {
                promise.resolve(0);
                return;
            }

            promise.resolve((double) file.length());
        } catch (Exception e) {
            promise.reject("STAT_ERROR", e.getMessage());
        }
    }

    /**
     * Create directory with intermediate directories
     */
    @ReactMethod
    public void createDirectory(String path, Promise promise) {
        try {
            File directory = new File(path);

            boolean success = directory.mkdirs();
            promise.resolve(success || directory.exists());
        } catch (Exception e) {
            promise.reject("CREATE_DIR_ERROR", e.getMessage());
        }
    }

    /**
     * List directory contents
     */
    @ReactMethod
    public void listDirectory(String path, Promise promise) {
        try {
            File directory = new File(path);

            if (!directory.exists()) {
                promise.resolve(new WritableNativeArray());
                return;
            }

            String[] contents = directory.list();
            WritableArray array = new WritableNativeArray();

            if (contents != null) {
                for (String item : contents) {
                    array.pushString(item);
                }
            }

            promise.resolve(array);
        } catch (Exception e) {
            promise.reject("LIST_ERROR", e.getMessage());
        }
    }
}
