const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      webpackConfig.entry = {
        main: [
          env === "development" &&
            require.resolve("react-dev-utils/webpackHotDevClient"),
          paths.appIndexJs,
        ].filter(Boolean),
        background: "./src/chrome/background.js",
        contentScript: "./src/chrome/contentScript.js",
        loginScript: "./src/chrome/loginScript.js",
      };

      webpackConfig.output = {
        ...webpackConfig.output,
        filename: "[name].js",
      };

      webpackConfig.optimization = {
        ...webpackConfig.optimization,
        runtimeChunk: false,
      };

      // Popup index.html should only load the main React bundle.
      webpackConfig.plugins = webpackConfig.plugins.map((plugin) => {
        if (plugin instanceof HtmlWebpackPlugin) {
          return new HtmlWebpackPlugin({
            ...(plugin.options || plugin.userOptions),
            chunks: ["main"],
          });
        }
        return plugin;
      });

      return webpackConfig;
    },
  },
};
