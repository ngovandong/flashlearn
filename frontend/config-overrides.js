const { alias } = require("react-app-rewire-alias");

const jestAliases = {
  "^@components/(.*)$": "<rootDir>/src/components/$1",
  "^@utils/(.*)$": "<rootDir>/src/utils/$1",
  "^@styles/(.*)$": "<rootDir>/src/styles/$1",
  "^@constants/(.*)$": "<rootDir>/src/constants/$1",
  "^@app/(.*)$": "<rootDir>/src/app/$1",
  "^@pages/(.*)$": "<rootDir>/src/pages/$1",
  "^@api-services/(.*)$": "<rootDir>/src/api-service/$1",
  "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
};

module.exports = {
  webpack: function override(config) {
    alias({
      "@components": "src/components",
      "@utils": "src/utils",
      "@styles": "src/styles",
      "@constants": "src/constants",
      "@app": "src/app",
      "@pages": "src/pages",
      "@api-services": "src/api-service",
      "@hooks": "src/hooks",
    })(config);

    return config;
  },
  jest: function overrideJest(config) {
    config.moduleNameMapper = {
      ...jestAliases,
      ...config.moduleNameMapper,
    };
    return config;
  },
};
