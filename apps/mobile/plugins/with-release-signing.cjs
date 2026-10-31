const { withAppBuildGradle } = require("expo/config-plugins");
const start = "// BEGIN AGRISTOCK LOCAL RELEASE SIGNING";
const end = "// END AGRISTOCK LOCAL RELEASE SIGNING";
module.exports = (config) =>
  withAppBuildGradle(config, (result) => {
    if (result.modResults.language !== "groovy")
      throw new Error(
        "AgriStock release signing expects the Expo Groovy Android template.",
      );
    const original = result.modResults.contents;
    const blockStart = original.indexOf(start);
    const blockEnd = original.indexOf(end);
    if (blockStart >= 0 !== blockEnd >= 0)
      throw new Error("Incomplete AgriStock signing block.");
    const clean =
      blockStart < 0
        ? original
        : original.slice(0, blockStart) + original.slice(blockEnd + end.length);
    if (process.env.AGRISTOCK_LOCAL_RELEASE_SIGNING !== "1") {
      result.modResults.contents = clean;
      return result;
    }
    result.modResults.contents =
      clean.trimEnd() +
      `

${start}
def agriSigningVariables = ['AGRISTOCK_KEYSTORE_PATH', 'AGRISTOCK_KEYSTORE_PASSWORD', 'AGRISTOCK_KEY_ALIAS', 'AGRISTOCK_KEY_PASSWORD']
agriSigningVariables.each { name ->
    if (!System.getenv(name)) throw new GradleException('Missing release signing variable: ' + name)
}
android {
    signingConfigs {
        agristockRelease {
            storeFile file(System.getenv('AGRISTOCK_KEYSTORE_PATH'))
            storePassword System.getenv('AGRISTOCK_KEYSTORE_PASSWORD')
            keyAlias System.getenv('AGRISTOCK_KEY_ALIAS')
            keyPassword System.getenv('AGRISTOCK_KEY_PASSWORD')
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.agristockRelease
        }
    }
}
${end}
`;
    return result;
  });
