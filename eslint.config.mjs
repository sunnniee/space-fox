import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import stylistic from '@stylistic/eslint-plugin'

export default defineConfig([globalIgnores(["**/dist"]), {
    files: ["**/*.ts"],

    plugins: {
        "@typescript-eslint": typescriptEslint,
        "import": importPlugin,
        "stylistic": stylistic
    },

    languageOptions: {
        parser: tsParser,
    },

    settings: {
        "import/extensions": [".ts"]
    },

    rules: {
        "dot-notation": "error",
        "eqeqeq": ["error", "always", { null: "ignore" }],
        "for-direction": "error",
        "no-async-promise-executor": "error",
        "no-cond-assign": "error",
        "no-constant-condition": ["error", { checkLoops: false }],
        "no-dupe-else-if": "error",
        "no-duplicate-case": "error",
        "no-fallthrough": "error",
        "no-invalid-regexp": "error",
        "no-irregular-whitespace": "error",
        "no-loss-of-precision": "error",
        "no-misleading-character-class": "error",
        "no-prototype-builtins": "error",
        "no-regex-spaces": "error",
        "no-shadow-restricted-names": "error",
        "no-unneeded-ternary": ["error", { defaultAssignment: false }],
        "no-unexpected-multiline": "error",
        "no-unsafe-optional-chaining": "error",
        "no-useless-backreference": "error",
        "no-useless-computed-key": "error",
        "no-useless-escape": "error",
        "no-restricted-globals": "error",
        "operator-assignment": ["error", "always"],
        "prefer-const": "error",
        "prefer-destructuring": ["error", { object: true, array: false }],
        "prefer-spread": "error",
        "use-isnan": "error",
        "yoda": "error",

        "@typescript-eslint/array-type": "error",
        "@typescript-eslint/ban-ts-comment": "error",
        "@typescript-eslint/consistent-indexed-object-style": "error",
        "@typescript-eslint/no-confusing-non-null-assertion": "error",
        "@typescript-eslint/no-unused-vars": ["error", {
            args: "all",
            argsIgnorePattern: "^_",
            caughtErrors: "none",
            destructuredArrayIgnorePattern: "^_"
        }],

        "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
        "import/default": "error",
        "import/export": "error",
        "import/extensions": ["error", "ignorePackages"],
        "import/first": "error",
        "import/named": "error",
        "import/no-duplicates": "error",
        "import/no-empty-named-blocks": "error",
        "import/no-mutable-exports": "error",
        "import/no-self-import": "error",
        "import/no-unassigned-import": "error",
        "import/no-unresolved": ["error"],
        "import/no-unused-modules": "error",
        "import/order": "error",

        "stylistic/arrow-parens": ["error", "as-needed"],
        "stylistic/block-spacing": ["error", "always"],
        "stylistic/brace-style": ["error", "1tbs", { "allowSingleLine": true }],
        "stylistic/eol-last": ["error", "always"],
        "stylistic/function-call-spacing": ["error", "never"],
        "stylistic/indent": ["error", 4, { SwitchCase: 1 }],
        "stylistic/indent-binary-ops": ["error", 4],
        "stylistic/key-spacing": ["error", { "mode": "strict" }],
        "stylistic/linebreak-style": ["error", "unix"],
        "stylistic/max-statements-per-line": ["error", { "max": 2 }],
        "stylistic/member-delimiter-style": "error",
        "stylistic/newline-per-chained-call": ["error", { "ignoreChainWithDepth": 3 }],
        "stylistic/no-extra-parens": "error",
        "stylistic/no-extra-semi": "error",
        "stylistic/no-mixed-spaces-and-tabs": "error",
        "stylistic/no-multi-spaces": "error",
        "stylistic/no-trailing-spaces": "error",
        "stylistic/no-whitespace-before-property": "error",
        "stylistic/object-curly-spacing": ["error", "always"],
        "stylistic/operator-linebreak": ["error", "before", { "overrides": { "=": "after" } }],
        "stylistic/quote-props": ["error", "consistent-as-needed"],
        "stylistic/quotes": ["error", "double", { avoidEscape: true }],
        "stylistic/semi": ["error", "always"],
        "stylistic/space-in-parens": ["error", "never"],
        "stylistic/spaced-comment": ["error", "always", { markers: ["!"] }],
        "stylistic/wrap-iife": ["error", "inside"],
    },
}]);
