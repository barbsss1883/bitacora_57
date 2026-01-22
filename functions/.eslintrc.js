module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  // ESTAS LÍNEAS SON LA CLAVE PARA QUE ENTIENDA TYPESCRIPT
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    sourceType: "module",
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    "/lib/**/*", // Doble seguridad para ignorar compilados
    ".eslintrc.js"
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    // Apagamos todas las reglas molestas
    "quotes": "off",
    "import/no-unresolved": 0,
    "indent": "off",
    "max-len": "off",
    "object-curly-spacing": "off",
    "comma-dangle": "off",
    "padded-blocks": "off",
    "no-trailing-spaces": "off",
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "no-invalid-this": "off",
    "camelcase": "off",
    "new-cap": "off"
  },
};