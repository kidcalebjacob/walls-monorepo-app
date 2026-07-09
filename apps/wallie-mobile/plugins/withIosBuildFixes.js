const fs = require("fs");
const path = require("path");
const { withPodfile, withDangerousMod } = require("@expo/config-plugins");

const FMT_PATCH = `    # Xcode 26 workaround: Apple Clang 21 breaks consteval in fmt 11.0.2 (React Native).
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      unless content.include?('Xcode 26 workaround')
        patched = content.gsub(
          /(#elif defined\\(__cpp_consteval\\)\\n#  define FMT_USE_CONSTEVAL) 1/,
          "\\\\1 0 // Xcode 26 workaround"
        )
        if patched != content
          File.chmod(0644, fmt_base)
          File.write(fmt_base, patched)
        end
      end
    end`;

const PATHS_WITH_SPACES_PATCH = `    # Support repo paths with spaces in CocoaPods shell script phases.
    path_space_script_replacements = [
      [
        '/bin/sh -c "\$WITH_ENVIRONMENT \$SCRIPT_PHASES_SCRIPT"',
        '"\$WITH_ENVIRONMENT" "\$SCRIPT_PHASES_SCRIPT"',
      ],
      [
        'bash -l -c "\$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"',
        'bash -l "\$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"',
      ],
    ]
    installer.pods_project.targets.each do |target|
      target.shell_script_build_phases.each do |phase|
        next unless phase.shell_script

        patched_script = phase.shell_script
        path_space_script_replacements.each do |old_script, new_script|
          patched_script = patched_script.gsub(old_script, new_script)
        end
        phase.shell_script = patched_script if patched_script != phase.shell_script
      end
    end
    [
      ['ReactCodegen.podspec.json', '/bin/sh -c \\"\\$WITH_ENVIRONMENT \\$SCRIPT_PHASES_SCRIPT\\"', '\\"\\$WITH_ENVIRONMENT\\" \\"\\$SCRIPT_PHASES_SCRIPT\\"'],
      ['EXConstants.podspec.json', 'bash -l -c \\"\\$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"', 'bash -l \\"\\$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"'],
    ].each do |podspec_name, podspec_old, podspec_new|
      podspec_path = File.join(installer.sandbox.root, 'Local Podspecs', podspec_name)
      next unless File.exist?(podspec_path)

      podspec = File.read(podspec_path)
      next unless podspec.include?(podspec_old)

      File.write(podspec_path, podspec.gsub(podspec_old, podspec_new))
    end`;

const BUNDLE_RN_PATCH = `    # Bundle React Native build phase uses backticks; breaks when repo path contains spaces.
    user_project_path = File.join(__dir__, 'Wallie.xcodeproj')
    if File.exist?(user_project_path)
      user_project = Xcodeproj::Project.open(user_project_path)
      bundle_script_old = '\`"\$NODE_BINARY" --print "require('\\''path'\\'').dirname(require.resolve('\\''react-native/package.json'\\'')) + '\\''/scripts/react-native-xcode.sh'\\''"\`'
      bundle_script_new = <<~'SCRIPT'.rstrip
        REACT_NATIVE_XCODE_SCRIPT="$("\$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'")"
        bash "\$REACT_NATIVE_XCODE_SCRIPT"
      SCRIPT
      user_project.targets.each do |target|
        target.shell_script_build_phases.each do |phase|
          next unless phase.shell_script&.include?(bundle_script_old)

          phase.shell_script = phase.shell_script.gsub(bundle_script_old, bundle_script_new)
        end
      end
      user_project.save
    end`;

const WITH_ENV_PATCH = `    # with-environment.sh executes $1 unquoted; breaks when repo path contains spaces.
    rn_path = File.expand_path(config[:reactNativePath], __dir__)
    with_env = File.join(rn_path, 'scripts', 'xcode', 'with-environment.sh')
    if File.exist?(with_env)
      with_env_content = File.read(with_env)
      with_env_old = "if [ -n \\"\\$1\\" ]; then\\n  \\$1\\nfi"
      with_env_new = "if [ \\"\\$#\\" -gt 0 ]; then\\n  \\"\\$@\\"\\nfi"
      unless with_env_content.include?(with_env_new)
        patched = with_env_content.gsub(with_env_old, with_env_new)
        if patched != with_env_content
          File.chmod(0755, with_env)
          File.write(with_env, patched)
        end
      end
    end`;

const BUNDLE_SCRIPT_OLD =
  '`"$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'"`';
const BUNDLE_SCRIPT_NEW = `REACT_NATIVE_XCODE_SCRIPT="$("$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'")"
bash "$REACT_NATIVE_XCODE_SCRIPT"`;

function patchBundleReactNativeScript(contents) {
  if (!contents.includes(BUNDLE_SCRIPT_OLD)) {
    return contents;
  }

  return contents.replace(BUNDLE_SCRIPT_OLD, BUNDLE_SCRIPT_NEW);
}

/** Persist iOS native build fixes across \`expo prebuild\`. */
function withIosBuildFixes(config) {
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;
      const pbxprojPath = path.join(
        projectRoot,
        `${projectName}.xcodeproj`,
        "project.pbxproj",
      );

      if (fs.existsSync(pbxprojPath)) {
        const contents = fs.readFileSync(pbxprojPath, "utf8");
        const patched = patchBundleReactNativeScript(contents);
        if (patched !== contents) {
          fs.writeFileSync(pbxprojPath, patched);
        }
      }

      return config;
    },
  ]);

  return withPodfile(config, (podfile) => {
    let contents = podfile.contents;

    if (!contents.includes("Xcode 26 workaround")) {
      contents = contents.replace(
        /react_native_post_install\([\s\S]*?\)\s*\n/,
        (match) => `${match}\n${FMT_PATCH}\n`,
      );
    }

    if (!contents.includes("path_space_script_replacements")) {
      contents = contents.replace(
        /react_native_post_install\([\s\S]*?\)\s*\n/,
        (match) => `${match}\n${PATHS_WITH_SPACES_PATCH}\n`,
      );
    }

    if (!contents.includes("Bundle React Native build phase uses backticks")) {
      contents = contents.replace(
        /react_native_post_install\([\s\S]*?\)\s*\n/,
        (match) => `${match}\n${BUNDLE_RN_PATCH}\n`,
      );
    }

    if (!contents.includes("with-environment.sh executes")) {
      contents = contents.replace(
        /react_native_post_install\([\s\S]*?\)\s*\n/,
        (match) => `${match}\n${WITH_ENV_PATCH}\n`,
      );
    }

    podfile.contents = contents;
    return podfile;
  });
}

module.exports = withIosBuildFixes;
