// Drives the engine from a shell, for tests on a computer:
//   me_cli <files.json> <entry> [<name> <args-json>]...
// Loads the entry, then makes each call, printing one result per line.
#include <stdio.h>
#include <stdlib.h>

#include "mod_engine.h"

static char *read_all(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long n = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *s = malloc(n + 1);
    if (s && fread(s, 1, n, f) == (size_t)n) s[n] = 0;
    fclose(f);
    return s;
}

int main(int argc, char **argv) {
    if (argc < 3 || (argc - 3) % 2) {
        fprintf(stderr, "usage: me_cli <files.json> <entry> [<name> <args-json>]...\n");
        return 2;
    }
    char *files = read_all(argv[1]);
    if (!files) { perror(argv[1]); return 1; }
    const char *limit = getenv("ME_MEMORY_LIMIT");
    ModEngine *e = me_new(limit ? strtoul(limit, NULL, 10) : 32u << 20, 250);
    char *r = me_load(e, files, argv[2]);
    puts(r);
    me_free_string(r);
    for (int i = 3; i < argc; i += 2) {
        r = me_call(e, argv[i], argv[i + 1]);
        puts(r);
        me_free_string(r);
    }
    fflush(stdout);
    me_free(e);
    free(files);
    return 0;
}
