"""Exercise Just install targets without building or touching a device.

Run: python3 test/install-recipes.test.py (requires just and fzz).
"""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
STUB = f"#!{sys.executable}\n" + """
import json, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ['INSTALL_TEST_LOG'], 'a') as log:
    log.write(json.dumps([name, *args]) + '\\n')
if name == 'nix':
    assert args[:2] == ['develop', '--command'], args
    if args[2] == 'bash':
        args[3] = str(pathlib.Path(args[3]).resolve())
    os.chdir(os.environ['INSTALL_TEST_ROOT'])
    os.execvp(args[2], args[2:])
if name == 'adb':
    if os.environ.get('DEVICE_FAILURE'):
        sys.exit(1)
    if args == ['devices']:
        print('List of devices attached\\n' + os.environ.get('DEVICE_LIST', 'samsung\\tdevice\\n'))
    elif args[2:] == ['shell', 'getprop', 'ro.product.model']:
        print(os.environ.get('DEVICE_MODEL', 'SM-G781B') + '\\r')
    elif args[2:4] == ['install', '-r']:
        assert pathlib.Path(args[4]).is_file(), args
        sys.exit(int(os.environ.get('INSTALL_FAILURE', '0')))
    else:
        raise AssertionError(args)
if name in ('just', 'python3'):
    sys.exit(0)
if name == 'pnpm':
    if args in (['test'], ['typecheck']):
        sys.exit(1 if os.environ.get('CHECK_FAILURE') == args[0] else 0)
    assert args == ['exec', 'expo', 'prebuild', '--platform', 'android', '--no-install'], args
    if os.environ.get('PREBUILD_FAILURE'):
        sys.exit(1)
if name == 'gradlew':
    if os.environ.get('BUILD_FAILURE'):
        sys.exit(1)
    variant = 'debug' if ':app:assembleDebug' in args else 'release'
    apk = pathlib.Path(f'app/build/outputs/apk/{variant}/app-{variant}.apk')
    apk.parent.mkdir(parents=True, exist_ok=True)
    apk.write_text('fake apk')
"""


class InstallRecipes(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="herdr install ")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.log = self.root / "commands.jsonl"
        self.apk = self.root / "phone's app $(touch injected).apk"
        self.apk.write_text("fake apk")
        (self.root / "android").mkdir()
        gradlew = self.root / "android" / "gradlew"
        gradlew.write_text(STUB)
        gradlew.chmod(0o755)
        for tool in ("nix", "adb", "pnpm"):
            path = self.root / tool
            path.write_text(STUB)
            path.chmod(0o755)

    def run_recipe(self, *arguments, **environment):
        result = subprocess.run(
            ["just", "--justfile", str(ROOT / "Justfile"), *arguments],
            env={**os.environ, "PATH": f"{self.root}:{os.environ['PATH']}",
                 "INSTALL_TEST_LOG": str(self.log), "INSTALL_TEST_ROOT": str(self.root), "TMPDIR": str(self.root),
                 "ANDROID_SERIAL": "", "HERDR_INSTALL_PROFILE": "", "DEVICE_MODEL": "SM-G781B",
                 "DEVICE_FAILURE": "", "PREBUILD_FAILURE": "", "BUILD_FAILURE": "", "INSTALL_FAILURE": "0", **environment},
            cwd=self.root, capture_output=True, text=True, timeout=10,
        )
        self.commands = [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []
        return result

    def run_pipeline(self, failure=""):
        for tool in ("just", "python3"):
            path = self.root / tool
            path.write_text(STUB)
            path.chmod(0o755)
        result = subprocess.run(
            ["fzz", "--config", str(ROOT / ".watch.yaml"), "run", "check-and-install"],
            cwd=self.root,
            env={**os.environ, "PATH": f"{self.root}:{os.environ['PATH']}",
                 "INSTALL_TEST_LOG": str(self.log), "CHECK_FAILURE": failure},
            capture_output=True, text=True, timeout=10,
        )
        self.commands = [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []
        return result

    def test_watcher_installs_only_after_both_checks(self):
        result = self.run_pipeline()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.commands, [["pnpm", "test"], ["python3", "test/install-recipes.test.py"],
                                         ["pnpm", "typecheck"], ["just", "install-latest"]])

    def test_watcher_does_not_install_after_failed_tests(self):
        result = self.run_pipeline("test")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.commands, [["pnpm", "test"]])

    def test_watcher_does_not_install_after_failed_typecheck(self):
        result = self.run_pipeline("typecheck")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.commands, [["pnpm", "test"], ["python3", "test/install-recipes.test.py"], ["pnpm", "typecheck"]])

    def installs(self):
        return [command for command in self.commands if command[0] == "adb" and "install" in command]

    def builds(self):
        return [command for command in self.commands if command[0] == "gradlew"]

    def test_existing_apk_preserves_arguments_and_uses_selected_device(self):
        result = self.run_recipe("install", str(self.apk), "phone's serial")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.installs(), [["adb", "-s", "phone's serial", "install", "-r", str(self.apk)]])
        self.assertEqual(self.builds(), [])
        self.assertFalse((ROOT / "injected").exists())

    def test_missing_apk_stops_before_device_or_build_commands(self):
        result = self.run_recipe("install", str(self.root / "missing.apk"), "samsung")

        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(command[0] in ("adb", "pnpm") for command in self.commands))

    def test_existing_apk_is_refused_on_pixel(self):
        result = self.run_recipe("install", str(self.apk), "pixel", DEVICE_MODEL="Pixel 7")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.installs(), [])
        self.assertEqual(self.builds(), [])
        self.assertIn("just install-dev", result.stderr)

    def test_preview_is_refused_on_pixel_before_build(self):
        result = self.run_recipe("install-preview", "pixel", DEVICE_MODEL="Pixel 7")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.installs(), [])
        self.assertEqual(self.builds(), [])

    def test_development_client_is_built_locally_for_pixel(self):
        result = self.run_recipe("install-dev", "pixel", DEVICE_MODEL="Pixel 7")

        self.assertEqual(result.returncode, 0, result.stderr)
        build = self.builds()[0]
        self.assertIn(":app:assembleDebug", build)
        self.assertIn("-PreactNativeArchitectures=arm64-v8a", build)
        self.assertEqual(self.installs()[0][1:5], ["-s", "pixel", "install", "-r"])
        self.assertEqual(self.installs()[0][5], "android/app/build/outputs/apk/debug/app-debug.apk")

    def test_preview_is_built_locally_for_samsung(self):
        result = self.run_recipe("install-preview", "samsung")

        self.assertEqual(result.returncode, 0, result.stderr)
        build = self.builds()[0]
        self.assertIn(":app:assembleRelease", build)
        self.assertIn("-x", build)
        self.assertEqual(self.installs()[0][1:5], ["-s", "samsung", "install", "-r"])

    def test_latest_uses_configured_serial_without_auto_selection(self):
        result = self.run_recipe("install-latest", ANDROID_SERIAL="configured")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.installs()[0][1:3], ["-s", "configured"])
        self.assertNotIn(["adb", "devices"], self.commands)

    def test_latest_selects_the_only_connected_phone(self):
        result = self.run_recipe("install-latest", ANDROID_SERIAL="", DEVICE_LIST="samsung\tdevice\n")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.installs()[0][1:3], ["-s", "samsung"])
        build = self.builds()[0]
        self.assertIn(":app:assembleRelease", build)

    def test_latest_selects_development_client_for_pixel(self):
        result = self.run_recipe("install-latest", ANDROID_SERIAL="", DEVICE_MODEL="Pixel 7")

        self.assertEqual(result.returncode, 0, result.stderr)
        build = self.builds()[0]
        self.assertIn(":app:assembleDebug", build)

    def test_multiple_phones_require_explicit_selection(self):
        result = self.run_recipe("install-latest", ANDROID_SERIAL="", DEVICE_LIST="one\tdevice\ntwo\tdevice\n")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.builds(), [])
        self.assertEqual(self.installs(), [])
        self.assertIn("ANDROID_SERIAL", result.stderr)

    def test_no_authorized_phone_does_not_build(self):
        result = self.run_recipe("install-latest", ANDROID_SERIAL="", DEVICE_LIST="one\tunauthorized\ntwo\toffline\n")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.builds(), [])
        self.assertEqual(self.installs(), [])

    def test_auto_selection_ignores_emulators(self):
        result = self.run_recipe("install-latest", ANDROID_SERIAL="", DEVICE_LIST="emulator-5554\tdevice\nsamsung\tdevice\n")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.installs()[0][1:3], ["-s", "samsung"])

    def test_configured_preview_cannot_override_pixel_safety(self):
        result = self.run_recipe("install-latest", ANDROID_SERIAL="pixel", DEVICE_MODEL="Pixel 7", HERDR_INSTALL_PROFILE="preview")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.builds(), [])
        self.assertEqual(self.installs(), [])

    def test_failed_build_does_not_install(self):
        result = self.run_recipe("install-preview", "samsung", BUILD_FAILURE="1")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(self.builds()), 1)
        self.assertEqual(self.installs(), [])

    def test_failed_prebuild_does_not_build_or_install(self):
        result = self.run_recipe("install-dev", "pixel", DEVICE_MODEL="Pixel 7", PREBUILD_FAILURE="1")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.builds(), [])
        self.assertEqual(self.installs(), [])

    def test_unavailable_device_stops_before_build(self):
        result = self.run_recipe("install-dev", "missing", DEVICE_FAILURE="1")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.builds(), [])
        self.assertEqual(self.installs(), [])

    def test_failed_install_never_uninstalls(self):
        result = self.run_recipe("install", str(self.apk), "samsung", INSTALL_FAILURE="1")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(self.installs()), 1)
        self.assertFalse(any("uninstall" in command for command in self.commands))


if __name__ == "__main__":
    unittest.main()
