import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // App-router layout fonts load globally; this rule only understands
      // the pages-router _document convention.
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "docs/**",
      "storage/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
