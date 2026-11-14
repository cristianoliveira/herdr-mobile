// One isolated QuickJS-ng runtime per mod copy. Every function must be called
// from the same thread for a given engine. Results are UTF-8 JSON strings the
// caller frees with me_free_string:
//   {"ok":true,"value":<json>,"outbox":[...],"jobErrors":[...]}
//   {"ok":false,"error":{"message","name","file","line","stack"},"outbox":[...],"jobErrors":[...]}
#ifndef MOD_ENGINE_H
#define MOD_ENGINE_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct ModEngine ModEngine;

// memory_limit: bytes for the whole runtime. budget_ms: how long one call may run.
ModEngine *me_new(size_t memory_limit, int budget_ms);
void me_free(ModEngine *e);

// files_json: {"<module name>": "<source>"}. Relative imports resolve against the
// importing module's name; bare names ("herdr-ui") are looked up as they are.
// entry: the module to evaluate, a key of files_json.
char *me_load(ModEngine *e, const char *files_json, const char *entry);

// Calls globalThis.__dispatch(name, args_json), runs pending jobs, and returns
// what __dispatch returned (a JSON string) plus globalThis.__drain()'s outbox.
char *me_call(ModEngine *e, const char *name, const char *args_json);

void me_free_string(char *s);

#ifdef __cplusplus
}
#endif

#endif
