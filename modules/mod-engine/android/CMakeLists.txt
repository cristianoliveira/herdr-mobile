cmake_minimum_required(VERSION 3.13)
project(modengine C)

set(ENGINE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../cpp)

add_library(modengine SHARED
  src/main/cpp/mod_engine_jni.c
  ${ENGINE_DIR}/mod_engine.c
  ${ENGINE_DIR}/quickjs/quickjs-amalgam.c
)
set_property(TARGET modengine PROPERTY C_STANDARD 11)
target_include_directories(modengine PRIVATE ${ENGINE_DIR})
target_compile_definitions(modengine PRIVATE NDEBUG _GNU_SOURCE)
# QuickJS's own warnings are not ours to fix.
target_compile_options(modengine PRIVATE -O2 -w)
# Android 15 devices may use 16 KB pages.
target_link_options(modengine PRIVATE "-Wl,-z,max-page-size=16384")
target_link_libraries(modengine m)
