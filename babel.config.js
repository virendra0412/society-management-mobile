module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // NOTE: Do NOT add react-native-reanimated/plugin here.
    // Reanimated v4 (used in SDK 54) is configured automatically
    // by babel-preset-expo. Adding it manually causes errors.
  };
};