const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const backendDir = path.resolve(projectRoot, "backend");

const defaultConfig = getDefaultConfig(projectRoot);

// Exclude the backend folder entirely from Metro's resolver/watch list using a RegExp.
const escapeForRegex = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
defaultConfig.resolver.blockList = [new RegExp(`${escapeForRegex(backendDir)}\\/.*`)];

module.exports = defaultConfig;
