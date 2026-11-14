// See mod_engine.h. The runtime inside the engine (herdr-ui, herdr) is plain JS
// passed in with the mod's files; this layer only loads, calls, and reports.
#include "mod_engine.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "quickjs/quickjs.h"

struct ModEngine {
    JSRuntime *rt;
    JSContext *ctx;
    int budget_ms;
    int64_t deadline_ms; // 0: no deadline
};

static int64_t now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (int64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static int on_interrupt(JSRuntime *rt, void *opaque) {
    (void)rt;
    ModEngine *e = opaque;
    return e->deadline_ms != 0 && now_ms() > e->deadline_ms;
}

// Modules come from globalThis.__files, set by me_load.
static JSModuleDef *load_module(JSContext *ctx, const char *name, void *opaque) {
    (void)opaque;
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue files = JS_GetPropertyStr(ctx, global, "__files");
    JSValue src = JS_IsObject(files) ? JS_GetPropertyStr(ctx, files, name) : JS_UNDEFINED;
    JS_FreeValue(ctx, files);
    JS_FreeValue(ctx, global);
    if (!JS_IsString(src)) {
        JS_FreeValue(ctx, src);
        JS_ThrowReferenceError(ctx, "could not find module '%s'", name);
        return NULL;
    }
    size_t len;
    const char *code = JS_ToCStringLen(ctx, &len, src);
    JS_FreeValue(ctx, src);
    if (!code) return NULL;
    JSValue fn = JS_Eval(ctx, code, len, name, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    JS_FreeCString(ctx, code);
    if (JS_IsException(fn)) return NULL;
    JSModuleDef *m = JS_VALUE_GET_PTR(fn);
    JS_FreeValue(ctx, fn);
    return m;
}

ModEngine *me_new(size_t memory_limit, int budget_ms) {
    ModEngine *e = calloc(1, sizeof(ModEngine));
    if (!e) return NULL;
    e->rt = JS_NewRuntime();
    if (!e->rt) { free(e); return NULL; }
    e->budget_ms = budget_ms;
    JS_SetMemoryLimit(e->rt, memory_limit);
    JS_SetMaxStackSize(e->rt, 1024 * 1024);
    JS_SetInterruptHandler(e->rt, on_interrupt, e);
    JS_SetModuleLoaderFunc(e->rt, NULL, load_module, e);
    e->ctx = JS_NewContext(e->rt);
    if (!e->ctx) { JS_FreeRuntime(e->rt); free(e); return NULL; }
    return e;
}

void me_free(ModEngine *e) {
    if (!e) return;
    JS_FreeContext(e->ctx);
    JS_FreeRuntime(e->rt);
    free(e);
}

void me_free_string(char *s) { free(s); }

// A growable byte buffer for the JSON result.
typedef struct { char *p; size_t len, cap; } Buf;

static void buf_add(Buf *b, const char *s, size_t n) {
    if (b->len + n + 1 > b->cap) {
        size_t cap = b->cap ? b->cap * 2 : 256;
        while (cap < b->len + n + 1) cap *= 2;
        char *p = realloc(b->p, cap);
        if (!p) return;
        b->p = p;
        b->cap = cap;
    }
    memcpy(b->p + b->len, s, n);
    b->len += n;
    b->p[b->len] = 0;
}

static void buf_str(Buf *b, const char *s) { buf_add(b, s, strlen(s)); }

// Appends JSON.stringify(v), or "null" when it can't be stringified.
static void buf_json(Buf *b, JSContext *ctx, JSValueConst v) {
    JSValue s = JS_JSONStringify(ctx, v, JS_UNDEFINED, JS_UNDEFINED);
    const char *c = JS_IsString(s) ? JS_ToCString(ctx, s) : NULL;
    if (c) {
        buf_str(b, c);
        JS_FreeCString(ctx, c);
    } else {
        if (JS_IsException(s)) JS_FreeValue(ctx, JS_GetException(ctx));
        buf_str(b, "null");
    }
    JS_FreeValue(ctx, s);
}

// Appends a JS string that already holds JSON text, or the fallback.
static void buf_raw(Buf *b, JSContext *ctx, JSValueConst v, const char *fallback) {
    const char *c = JS_IsString(v) ? JS_ToCString(ctx, v) : NULL;
    if (c) {
        buf_str(b, c);
        JS_FreeCString(ctx, c);
    } else {
        buf_str(b, fallback);
    }
}

// The first frame of a QuickJS stack ("    at f (x.js:1:24)" or "    at x.js:4:2")
// as its file and line. Returns 0 when there is none.
static int first_frame(const char *stack, char *file, size_t size, int *line) {
    const char *at = strstr(stack, "at ");
    if (!at) return 0;
    const char *start = at + 3;
    const char *end = strchr(start, '\n');
    if (!end) end = start + strlen(start);
    const char *open = memchr(start, '(', end - start);
    if (open) {
        start = open + 1;
        const char *close = memchr(start, ')', end - start);
        if (close) end = close;
    }
    // file:line:col, where the file may itself contain colons.
    const char *col = NULL, *ln = NULL;
    for (const char *p = end - 1; p >= start; p--) {
        if (*p != ':') continue;
        if (!col) col = p;
        else { ln = p; break; }
    }
    if (!ln || ln == start) return 0;
    size_t n = (size_t)(ln - start);
    if (n >= size) n = size - 1;
    memcpy(file, start, n);
    file[n] = 0;
    *line = atoi(ln + 1);
    return *line > 0;
}

// The pending exception as {message, name, file, line, stack}.
static void buf_exception(Buf *b, JSContext *ctx) {
    JSValue exc = JS_GetException(ctx);
    JSValue out = JS_NewObject(ctx);
    JSValue msg = JS_ToString(ctx, exc);
    if (JS_IsException(msg)) {
        JS_FreeValue(ctx, JS_GetException(ctx));
        msg = JS_NewString(ctx, "unknown error");
    }
    if (JS_IsObject(exc)) {
        JSValue m = JS_GetPropertyStr(ctx, exc, "message");
        if (JS_IsString(m)) { JS_FreeValue(ctx, msg); msg = m; } else JS_FreeValue(ctx, m);
        JS_SetPropertyStr(ctx, out, "name", JS_GetPropertyStr(ctx, exc, "name"));
        JS_SetPropertyStr(ctx, out, "file", JS_GetPropertyStr(ctx, exc, "fileName"));
        JS_SetPropertyStr(ctx, out, "line", JS_GetPropertyStr(ctx, exc, "lineNumber"));
        JSValue stack = JS_GetPropertyStr(ctx, exc, "stack");
        JSValue file = JS_GetPropertyStr(ctx, out, "file");
        if (JS_IsUndefined(file) && JS_IsString(stack)) {
            const char *s = JS_ToCString(ctx, stack);
            char name[512];
            int line;
            if (s && first_frame(s, name, sizeof name, &line)) {
                JS_SetPropertyStr(ctx, out, "file", JS_NewString(ctx, name));
                JS_SetPropertyStr(ctx, out, "line", JS_NewInt32(ctx, line));
            }
            if (s) JS_FreeCString(ctx, s);
        }
        JS_FreeValue(ctx, file);
        JS_SetPropertyStr(ctx, out, "stack", stack);
    }
    JS_SetPropertyStr(ctx, out, "message", msg);
    buf_json(b, ctx, out);
    JS_FreeValue(ctx, out);
    JS_FreeValue(ctx, exc);
}

// Runs promise jobs until none are left; a job that throws is reported, not fatal.
static void run_jobs(ModEngine *e, Buf *job_errors) {
    JSContext *pctx;
    for (;;) {
        int r = JS_ExecutePendingJob(e->rt, &pctx);
        if (r == 0) break;
        if (r < 0) {
            if (job_errors->len > 1) buf_str(job_errors, ",");
            int64_t deadline = e->deadline_ms;
            e->deadline_ms = 0;
            buf_exception(job_errors, pctx);
            e->deadline_ms = deadline;
        }
    }
}

// Finishes the result: the outbox from __drain(), the job errors, and the end.
static char *finish(ModEngine *e, Buf *b, Buf *job_errors) {
    JSContext *ctx = e->ctx;
    e->deadline_ms = 0; // reporting never runs into the budget
    buf_str(b, ",\"outbox\":");
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue drain = JS_GetPropertyStr(ctx, global, "__drain");
    if (JS_IsFunction(ctx, drain)) {
        JSValue r = JS_Call(ctx, drain, global, 0, NULL);
        if (JS_IsException(r)) JS_FreeValue(ctx, JS_GetException(ctx));
        buf_raw(b, ctx, r, "[]");
        JS_FreeValue(ctx, r);
    } else {
        buf_str(b, "[]");
    }
    JS_FreeValue(ctx, drain);
    JS_FreeValue(ctx, global);
    buf_str(job_errors, "]");
    buf_str(b, ",\"jobErrors\":");
    buf_str(b, job_errors->p);
    buf_str(b, "}");
    free(job_errors->p);
    return b->p;
}

static void start(ModEngine *e) {
    JS_UpdateStackTop(e->rt);
    e->deadline_ms = now_ms() + e->budget_ms;
}

char *me_load(ModEngine *e, const char *files_json, const char *entry) {
    JSContext *ctx = e->ctx;
    Buf b = {0}, jobs = {0};
    buf_str(&jobs, "[");
    start(e);

    JSValue files = JS_ParseJSON(ctx, files_json, strlen(files_json), "<files>");
    if (JS_IsException(files)) goto fail;
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue src = JS_GetPropertyStr(ctx, files, entry);
    JS_SetPropertyStr(ctx, global, "__files", files);
    JS_FreeValue(ctx, global);
    if (!JS_IsString(src)) {
        JS_FreeValue(ctx, src);
        JS_ThrowReferenceError(ctx, "could not find module '%s'", entry);
        goto fail;
    }
    size_t len;
    const char *code = JS_ToCStringLen(ctx, &len, src);
    JS_FreeValue(ctx, src);
    if (!code) goto fail;
    JSValue r = JS_Eval(ctx, code, len, entry, JS_EVAL_TYPE_MODULE);
    JS_FreeCString(ctx, code);
    if (JS_IsException(r)) goto fail;
    run_jobs(e, &jobs);
    // A module's evaluation is a promise: a rejection is the load's failure.
    if (JS_PromiseState(ctx, r) == JS_PROMISE_REJECTED) {
        JS_Throw(ctx, JS_PromiseResult(ctx, r));
        JS_FreeValue(ctx, r);
        goto fail;
    }
    JS_FreeValue(ctx, r);
    buf_str(&b, "{\"ok\":true,\"value\":null");
    return finish(e, &b, &jobs);

fail:
    e->deadline_ms = 0;
    buf_str(&b, "{\"ok\":false,\"error\":");
    buf_exception(&b, ctx);
    return finish(e, &b, &jobs);
}

char *me_call(ModEngine *e, const char *name, const char *args_json) {
    JSContext *ctx = e->ctx;
    Buf b = {0}, jobs = {0};
    buf_str(&jobs, "[");
    start(e);

    JSValue global = JS_GetGlobalObject(ctx);
    JSValue dispatch = JS_GetPropertyStr(ctx, global, "__dispatch");
    if (!JS_IsFunction(ctx, dispatch)) {
        JS_FreeValue(ctx, dispatch);
        JS_FreeValue(ctx, global);
        JS_ThrowTypeError(ctx, "the mod runtime is not loaded");
        goto fail;
    }
    JSValue argv[2] = { JS_NewString(ctx, name), JS_NewString(ctx, args_json) };
    JSValue r = JS_Call(ctx, dispatch, global, 2, argv);
    JS_FreeValue(ctx, argv[0]);
    JS_FreeValue(ctx, argv[1]);
    JS_FreeValue(ctx, dispatch);
    JS_FreeValue(ctx, global);
    if (JS_IsException(r)) goto fail;
    run_jobs(e, &jobs);
    e->deadline_ms = 0;
    buf_str(&b, "{\"ok\":true,\"value\":");
    buf_raw(&b, ctx, r, "null");
    JS_FreeValue(ctx, r);
    return finish(e, &b, &jobs);

fail:
    e->deadline_ms = 0;
    buf_str(&b, "{\"ok\":false,\"error\":");
    buf_exception(&b, ctx);
    return finish(e, &b, &jobs);
}
