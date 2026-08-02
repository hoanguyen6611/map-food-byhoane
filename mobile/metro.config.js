// Metro config with monorepo awareness.
//
// This app depends on the workspace package `@foodmap/shared-types`
// (see /packages/shared-types), linked via npm workspaces declared in the
// repo-root package.json. npm workspaces hoist/symlink that package into the
// repo root's node_modules, not into mobile/node_modules — so Metro needs to
// know to (a) watch the repo root for changes to the linked package and
// (b) also look in the repo root's node_modules when resolving modules.
// This is the standard Expo monorepo setup:
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace (so edits to packages/shared-types trigger reloads).
config.watchFolders = [workspaceRoot];

// Let Metro resolve modules hoisted to the workspace root's node_modules, in
// addition to this app's own node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
