const { withPodfile } = require("@expo/config-plugins");

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

/** Persist fmt/Xcode 26 fix across `expo prebuild`. */
function withFmtXcode26Fix(config) {
  return withPodfile(config, (podfile) => {
    if (podfile.contents.includes("Xcode 26 workaround")) {
      return podfile;
    }

    podfile.contents = podfile.contents.replace(
      /react_native_post_install\([\s\S]*?\)\s*\n/,
      (match) => `${match}\n${FMT_PATCH}\n`,
    );

    return podfile;
  });
}

module.exports = withFmtXcode26Fix;
