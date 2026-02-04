#import "BitriseFileSystem.h"
#import <React/RCTLog.h>

@implementation BitriseFileSystem

RCT_EXPORT_MODULE()

/**
 * Get the documents directory path where CodePush files will be stored
 */
RCT_EXPORT_METHOD(getDocumentsDirectory:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    if (paths.count > 0) {
      NSString *documentsDirectory = paths[0];
      NSString *codePushDirectory = [documentsDirectory stringByAppendingPathComponent:@"CodePush"];
      resolve(codePushDirectory);
    } else {
      reject(@"ERROR", @"Could not find documents directory", nil);
    }
  } @catch (NSException *exception) {
    reject(@"ERROR", exception.reason, nil);
  }
}

/**
 * Write file to disk with base64 encoded data
 */
RCT_EXPORT_METHOD(writeFile:(NSString *)path
                  data:(NSString *)base64Data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    // Decode base64 data
    NSData *fileData = [[NSData alloc] initWithBase64EncodedString:base64Data options:0];

    if (!fileData) {
      reject(@"DECODE_ERROR", @"Failed to decode base64 data", nil);
      return;
    }

    // Create directory if needed
    NSString *directory = [path stringByDeletingLastPathComponent];
    NSFileManager *fileManager = [NSFileManager defaultManager];

    if (![fileManager fileExistsAtPath:directory]) {
      NSError *error = nil;
      [fileManager createDirectoryAtPath:directory
             withIntermediateDirectories:YES
                              attributes:nil
                                   error:&error];
      if (error) {
        reject(@"CREATE_DIR_ERROR", error.localizedDescription, error);
        return;
      }
    }

    // Write file
    NSError *error = nil;
    BOOL success = [fileData writeToFile:path options:NSDataWritingAtomic error:&error];

    if (success) {
      resolve(@YES);
    } else {
      reject(@"WRITE_ERROR", error.localizedDescription, error);
    }
  } @catch (NSException *exception) {
    reject(@"ERROR", exception.reason, nil);
  }
}

/**
 * Read file from disk and return as base64 encoded string
 */
RCT_EXPORT_METHOD(readFile:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSFileManager *fileManager = [NSFileManager defaultManager];

    if (![fileManager fileExistsAtPath:path]) {
      resolve([NSNull null]);
      return;
    }

    NSError *error = nil;
    NSData *fileData = [NSData dataWithContentsOfFile:path options:0 error:&error];

    if (error) {
      reject(@"READ_ERROR", error.localizedDescription, error);
      return;
    }

    // Encode to base64
    NSString *base64String = [fileData base64EncodedStringWithOptions:0];
    resolve(base64String);
  } @catch (NSException *exception) {
    reject(@"ERROR", exception.reason, nil);
  }
}

/**
 * Delete file from disk
 */
RCT_EXPORT_METHOD(deleteFile:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSFileManager *fileManager = [NSFileManager defaultManager];

    if (![fileManager fileExistsAtPath:path]) {
      resolve(@NO);
      return;
    }

    NSError *error = nil;
    BOOL success = [fileManager removeItemAtPath:path error:&error];

    if (success) {
      resolve(@YES);
    } else {
      reject(@"DELETE_ERROR", error.localizedDescription, error);
    }
  } @catch (NSException *exception) {
    reject(@"ERROR", exception.reason, nil);
  }
}

/**
 * Check if file exists
 */
RCT_EXPORT_METHOD(fileExists:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSFileManager *fileManager = [NSFileManager defaultManager];
    BOOL exists = [fileManager fileExistsAtPath:path];
    resolve(@(exists));
  } @catch (NSException *exception) {
    reject(@"ERROR", exception.reason, nil);
  }
}

/**
 * Get file size in bytes
 */
RCT_EXPORT_METHOD(getFileSize:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSFileManager *fileManager = [NSFileManager defaultManager];

    if (![fileManager fileExistsAtPath:path]) {
      resolve(@0);
      return;
    }

    NSError *error = nil;
    NSDictionary *attributes = [fileManager attributesOfItemAtPath:path error:&error];

    if (error) {
      reject(@"STAT_ERROR", error.localizedDescription, error);
      return;
    }

    NSNumber *fileSize = [attributes objectForKey:NSFileSize];
    resolve(fileSize);
  } @catch (NSException *exception) {
    reject(@"ERROR", exception.reason, nil);
  }
}

/**
 * Create directory with intermediate directories
 */
RCT_EXPORT_METHOD(createDirectory:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSFileManager *fileManager = [NSFileManager defaultManager];

    NSError *error = nil;
    BOOL success = [fileManager createDirectoryAtPath:path
                        withIntermediateDirectories:YES
                                         attributes:nil
                                              error:&error];

    if (success) {
      resolve(@YES);
    } else {
      reject(@"CREATE_DIR_ERROR", error.localizedDescription, error);
    }
  } @catch (NSException *exception) {
    reject(@"ERROR", exception.reason, nil);
  }
}

/**
 * List directory contents
 */
RCT_EXPORT_METHOD(listDirectory:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSFileManager *fileManager = [NSFileManager defaultManager];

    if (![fileManager fileExistsAtPath:path]) {
      resolve(@[]);
      return;
    }

    NSError *error = nil;
    NSArray *contents = [fileManager contentsOfDirectoryAtPath:path error:&error];

    if (error) {
      reject(@"LIST_ERROR", error.localizedDescription, error);
      return;
    }

    resolve(contents ? contents : @[]);
  } @catch (NSException *exception) {
    reject(@"ERROR", exception.reason, nil);
  }
}

@end
