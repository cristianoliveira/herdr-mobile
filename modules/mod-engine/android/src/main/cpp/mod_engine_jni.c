// JNI glue for expo.modules.modengine.Native. Strings cross as UTF-8 byte
// arrays: JNI's own string functions use modified UTF-8, which QuickJS doesn't.
#include <jni.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "mod_engine.h"

static char *to_c(JNIEnv *env, jbyteArray a) {
    jsize n = (*env)->GetArrayLength(env, a);
    char *s = malloc((size_t)n + 1);
    if (!s) return NULL;
    (*env)->GetByteArrayRegion(env, a, 0, n, (jbyte *)s);
    s[n] = 0;
    return s;
}

static jbyteArray to_java(JNIEnv *env, char *s) {
    if (!s) return NULL;
    jsize n = (jsize)strlen(s);
    jbyteArray a = (*env)->NewByteArray(env, n);
    if (a) (*env)->SetByteArrayRegion(env, a, 0, n, (const jbyte *)s);
    me_free_string(s);
    return a;
}

JNIEXPORT jlong JNICALL
Java_expo_modules_modengine_Native_create(JNIEnv *env, jclass cls, jlong memory_limit, jint budget_ms) {
    (void)env; (void)cls;
    return (jlong)(intptr_t)me_new((size_t)memory_limit, budget_ms);
}

JNIEXPORT void JNICALL
Java_expo_modules_modengine_Native_free(JNIEnv *env, jclass cls, jlong handle) {
    (void)env; (void)cls;
    me_free((ModEngine *)(intptr_t)handle);
}

JNIEXPORT jbyteArray JNICALL
Java_expo_modules_modengine_Native_load(JNIEnv *env, jclass cls, jlong handle, jbyteArray files, jbyteArray entry) {
    (void)cls;
    char *f = to_c(env, files), *e = to_c(env, entry);
    char *r = (f && e) ? me_load((ModEngine *)(intptr_t)handle, f, e) : NULL;
    free(f);
    free(e);
    return to_java(env, r);
}

JNIEXPORT jbyteArray JNICALL
Java_expo_modules_modengine_Native_call(JNIEnv *env, jclass cls, jlong handle, jbyteArray name, jbyteArray args) {
    (void)cls;
    char *n = to_c(env, name), *a = to_c(env, args);
    char *r = (n && a) ? me_call((ModEngine *)(intptr_t)handle, n, a) : NULL;
    free(n);
    free(a);
    return to_java(env, r);
}
