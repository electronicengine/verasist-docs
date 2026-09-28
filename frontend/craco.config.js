// craco.config.js
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  jest: { configure: (config) => ({
    ...config,
    moduleNameMapper: { "^#(minpath|minproc|minurl)$": "<rootDir>/node_modules/vfile/lib/$1.browser.js", "^@/(.*)$": "<rootDir>/src/$1", "^unist-util-visit-parents/do-not-use-color$": "<rootDir>/node_modules/unist-util-visit-parents/lib/color.js" },
    // Markdown's unified ecosystem ships ESM; let Babel handle those packages in Jest.
    transformIgnorePatterns: ["/node_modules/(?!(react-markdown|remark[^/]*|rehype[^/]*|unified|bail|trough|vfile[^/]*|unist[^/]*|mdast[^/]*|hast[^/]*|micromark[^/]*|decode-named-character-reference|character-entities[^/]*|property-information|space-separated-tokens|comma-separated-tokens|trim-lines|ccount|escape-string-regexp|markdown-table|zwitch|devlop|estree-util-is-identifier-name|longest-streak|html-url-attributes|is-plain-obj)/)"],
  }) },
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      return webpackConfig;
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Strip legacy webpack-dev-server v4 keys not supported by v5
  delete devServerConfig.onAfterSetupMiddleware;
  delete devServerConfig.onBeforeSetupMiddleware;
  // Convert v4 `https` to v5 `server`
  if (Object.prototype.hasOwnProperty.call(devServerConfig, "https")) {
    const httpsValue = devServerConfig.https;
    delete devServerConfig.https;
    if (httpsValue) {
      devServerConfig.server = typeof httpsValue === "object" ? { type: "https", options: httpsValue } : { type: "https" };
    }
  }

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

// Keep the default CRA/Craco setup without the removed visual editing integration.
module.exports = webpackConfig;
