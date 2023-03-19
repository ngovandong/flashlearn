const { alias } = require("react-app-rewire-alias");
module.exports = function override(config) {
  alias({
    "@components": "src/components",
    "@utils": "src/utils",
    "@styles": "src/styles",
    "@constants": "src/constants",
    "@app": "src/app",
    "@pages": "src/pages",
    "@api-services": "src/api-service",
  })(config);

  return config;
};
