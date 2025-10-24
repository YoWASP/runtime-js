import js from "@eslint/js";
import globals from "globals";

export default [
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            "semi": "error",
            "eqeqeq": "error",
            "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "no-constant-condition": ["error", { checkLoops: false }],
        },
    },
];
