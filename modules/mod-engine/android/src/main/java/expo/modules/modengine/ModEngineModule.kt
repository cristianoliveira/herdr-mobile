package expo.modules.modengine

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

internal object Native {
  init {
    System.loadLibrary("modengine")
  }

  @JvmStatic external fun create(memoryLimit: Long, budgetMs: Int): Long
  @JvmStatic external fun free(handle: Long)
  @JvmStatic external fun load(handle: Long, files: ByteArray, entry: ByteArray): ByteArray?
  @JvmStatic external fun call(handle: Long, name: ByteArray, args: ByteArray): ByteArray?
}

// Mod engines (one QuickJS runtime each) on one thread of their own, so a mod
// never runs on the UI or React Native's JS thread. A QuickJS runtime must stay
// on the thread that made it; `engines` is only touched there.
class ModEngineModule : Module() {
  private val thread: ExecutorService = Executors.newSingleThreadExecutor { r ->
    Thread(null, r, "mod-engine", 16L shl 20)
  }
  private val engines = HashMap<String, Long>()

  private fun onThread(promise: Promise, work: () -> Any?) {
    thread.execute {
      try {
        promise.resolve(work())
      } catch (e: Throwable) {
        promise.reject("ERR_MOD_ENGINE", e.message ?: e.toString(), e)
      }
    }
  }

  private fun handle(id: String): Long = engines[id] ?: throw IllegalStateException("no mod engine $id")

  private fun text(bytes: ByteArray?): String =
    bytes?.toString(Charsets.UTF_8) ?: throw IllegalStateException("the mod engine ran out of memory")

  override fun definition() = ModuleDefinition {
    Name("ModEngine")

    AsyncFunction("create") { id: String, memoryLimit: Double, budgetMs: Int, promise: Promise ->
      onThread(promise) {
        engines.remove(id)?.let(Native::free)
        val h = Native.create(memoryLimit.toLong(), budgetMs)
        check(h != 0L) { "could not create a mod engine" }
        engines[id] = h
        null
      }
    }

    AsyncFunction("load") { id: String, files: String, entry: String, promise: Promise ->
      onThread(promise) { text(Native.load(handle(id), files.toByteArray(), entry.toByteArray())) }
    }

    AsyncFunction("call") { id: String, name: String, args: String, promise: Promise ->
      onThread(promise) { text(Native.call(handle(id), name.toByteArray(), args.toByteArray())) }
    }

    AsyncFunction("dispose") { id: String, promise: Promise ->
      onThread(promise) {
        engines.remove(id)?.let(Native::free)
        null
      }
    }

    OnDestroy {
      thread.execute {
        engines.values.forEach(Native::free)
        engines.clear()
      }
      thread.shutdown()
    }
  }
}
