const { withGradleProperties } = require("@expo/config-plugins");

const GRADLE_JVM_ARGS = "-Xmx2048m -XX:MaxMetaspaceSize=1024m";

function setGradleProperty(properties, key, value) {
  const existing = properties.find(
    (property) => property.type === "property" && property.key === key,
  );

  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: "property", key, value });
  }

  return properties;
}

function withAlphaGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = setGradleProperty(
      config.modResults,
      "org.gradle.jvmargs",
      GRADLE_JVM_ARGS,
    );
    return config;
  });
}

withAlphaGradleMemory.setGradleProperty = setGradleProperty;
module.exports = withAlphaGradleMemory;
