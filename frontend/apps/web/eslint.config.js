import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.es2025,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": "warn",
      "no-case-declarations": "off",
      "no-empty": "off",
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^React$" },
      ],
      "no-useless-assignment": "off",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "prefer-const": "error",
    },
  },
  {
    files: ["src/**/*.test.js"],
    languageOptions: {
      globals: globals.vitest,
    },
  },
];
