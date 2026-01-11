// Path: tools/gen-permissions.mts
// ============================================================================
// Permissions Generator (class-based, Node ESM)
//
// Goal:
//   Generate an IDE-friendly permission object (PERM) from the canonical
//   ACCESS_OPTIONS array located at:
//     src/app/source/access-map.source.ts
//
// Output:
//   src/app/core/security/permissions.const.ts
//
// Why this exists:
//   - Prevent stringly-typed permissions in templates/components.
//   - Enable autocomplete: PERM.TeamManagement.delete
//   - Keep "single source of truth" in ACCESS_OPTIONS.
//   - Zero runtime cost (build-time only).
//
// How it works:
//   - Uses TypeScript Compiler API to parse the TS file (AST traversal).
//   - Extracts ACCESS_OPTIONS.module and ACCESS_OPTIONS.actions[].id.
//   - Generates a constant object PERM with stable structure.
// ============================================================================
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
class PermissionsGenerator {
    // ──────────────────────────────────────────────────────────────────────────
    // Config
    // ──────────────────────────────────────────────────────────────────────────
    static PROJECT_ROOT = PermissionsGenerator.#resolveProjectRoot();
    static ACCESS_MAP_PATH = path.join(PermissionsGenerator.PROJECT_ROOT, "src", "app", "source", "access-map.source.ts");
    static OUT_PATH = path.join(PermissionsGenerator.PROJECT_ROOT, "src", "app", "core", "security", "permissions.const.ts");
    // Entry point
    static async run() {
        try {
            console.log("[Info:] [PermGen] Starting permissions generation...\n");
            const sourceText = await this.#readText(this.ACCESS_MAP_PATH);
            const accessOptions = this.#extractAccessOptionsFromTsAst(sourceText);
            if (!accessOptions.length) {
                throw new Error("ACCESS_OPTIONS parsed as empty. Check access-map.source.ts structure.");
            }
            const permTree = this.#buildPermTree(accessOptions);
            const outFile = this.#renderOutputTs(permTree);
            await this.#writeText(this.OUT_PATH, outFile);
            console.log(`[Success:] [PermGen] Generated: ${this.#relativeToRoot(this.OUT_PATH)}\n`);
            console.log(`[Info:] [PermGen] Source: ${this.#relativeToRoot(this.ACCESS_MAP_PATH)}\n`);
        }
        catch (error) {
            console.error("[Error:] [PermGen] Generation failed.\n", error, "\n");
            process.exitCode = 1;
        }
    }
    // ──────────────────────────────────────────────────────────────────────────
    // File helpers
    // ──────────────────────────────────────────────────────────────────────────
    static async #readText(filePath) {
        return fs.readFile(filePath, "utf8");
    }
    static async #writeText(filePath, content) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, "utf8");
    }
    static #relativeToRoot(absPath) {
        return path.relative(this.PROJECT_ROOT, absPath).replaceAll("\\", "/");
    }
    static #resolveProjectRoot() {
        // tools/gen-permissions.mjs → project root = parent folder of tools/
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        return path.resolve(__dirname, "..");
    }
    // ──────────────────────────────────────────────────────────────────────────
    // AST parsing: extract ACCESS_OPTIONS
    // ──────────────────────────────────────────────────────────────────────────
    /**
     * Extracts:
     *   [
     *     { module: "TeamManagement", actions: ["view","create",...] },
     *     ...
     *   ]
     *
     * from the TS const ACCESS_OPTIONS using the TypeScript Compiler API.
     *
     * This avoids executing TS at runtime and keeps generation safe and deterministic.
     */
    static #extractAccessOptionsFromTsAst(sourceText) {
        const sourceFile = ts.createSourceFile("access-map.source.ts", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        let accessOptionsNode = null;
        // Find: export const ACCESS_OPTIONS = [...]
        const visit = (node) => {
            if (ts.isVariableStatement(node) &&
                node.declarationList &&
                node.declarationList.declarations) {
                for (const decl of node.declarationList.declarations) {
                    const name = decl.name;
                    if (ts.isIdentifier(name) &&
                        name.text === "ACCESS_OPTIONS" &&
                        decl.initializer) {
                        accessOptionsNode = decl.initializer;
                        return;
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        if (!accessOptionsNode) {
            throw new Error("Could not find ACCESS_OPTIONS initializer in access-map.source.ts");
        }
        // Some people wrap it with "as const satisfies ..." which becomes
        // a TS "AsExpression" / "SatisfiesExpression" chain. Unwrap until we hit ArrayLiteralExpression.
        const arrayExpr = this.#unwrapToArrayLiteral(accessOptionsNode);
        if (!arrayExpr) {
            throw new Error("ACCESS_OPTIONS initializer is not an array literal after unwrapping.");
        }
        const results = [];
        for (const el of arrayExpr.elements) {
            if (!ts.isObjectLiteralExpression(el))
                continue;
            const moduleValue = this.#getStringProp(el, "module");
            if (!moduleValue)
                continue;
            const actionsArray = this.#getArrayProp(el, "actions");
            const actionIds = [];
            if (actionsArray) {
                for (const actionEl of actionsArray.elements) {
                    if (!ts.isObjectLiteralExpression(actionEl))
                        continue;
                    const id = this.#getStringProp(actionEl, "id");
                    if (id)
                        actionIds.push(id);
                }
            }
            results.push({ module: moduleValue, actions: actionIds });
        }
        return results;
    }
    static #unwrapToArrayLiteral(node) {
        let cur = node;
        // Unwrap: ( ... ) / as const / satisfies / type assertions etc.
        while (cur) {
            if (ts.isArrayLiteralExpression(cur))
                return cur;
            // as const / as Type
            if (ts.isAsExpression(cur)) {
                cur = cur.expression;
                continue;
            }
            // satisfies Type (TS 4.9+)
            if (ts.isSatisfiesExpression?.(cur)) {
                cur = cur.expression;
                continue;
            }
            // Parenthesized
            if (ts.isParenthesizedExpression(cur)) {
                cur = cur.expression;
                continue;
            }
            break;
        }
        return null;
    }
    static #getStringProp(obj, key) {
        const prop = obj.properties.find((p) => {
            if (!ts.isPropertyAssignment(p))
                return false;
            const name = p.name;
            return ((ts.isIdentifier(name) && name.text === key) ||
                (ts.isStringLiteral(name) && name.text === key));
        });
        if (!prop || !ts.isPropertyAssignment(prop))
            return null;
        const init = prop.initializer;
        if (ts.isStringLiteral(init))
            return init.text;
        if (ts.isNoSubstitutionTemplateLiteral(init))
            return init.text;
        // We only support string literals here intentionally.
        return null;
    }
    static #getArrayProp(obj, key) {
        const prop = obj.properties.find((p) => {
            if (!ts.isPropertyAssignment(p))
                return false;
            const name = p.name;
            return ((ts.isIdentifier(name) && name.text === key) ||
                (ts.isStringLiteral(name) && name.text === key));
        });
        if (!prop || !ts.isPropertyAssignment(prop))
            return null;
        const init = prop.initializer;
        // Unwrap expressions like "actions: [...] as const"
        const arr = this.#unwrapToArrayLiteral(init);
        return arr ?? null;
    }
    // ──────────────────────────────────────────────────────────────────────────
    // Build PERM tree
    // ──────────────────────────────────────────────────────────────────────────
    /**
     * Output format:
     *   {
     *     TeamManagement: { view: {...}, create: {...}, ... },
     *     UserManagement: { ... }
     *   }
     *
     * Each leaf includes module/action strings for consistent consumption.
     */
    static #buildPermTree(accessOptions) {
        const tree = {};
        for (const entry of accessOptions) {
            const mod = entry.module;
            const actions = Array.isArray(entry.actions) ? entry.actions : [];
            tree[mod] = tree[mod] ?? {};
            for (const action of actions) {
                tree[mod][action] = { module: mod, action };
            }
        }
        return tree;
    }
    // ──────────────────────────────────────────────────────────────────────────
    // Render output TS
    // ──────────────────────────────────────────────────────────────────────────
    static #renderOutputTs(permTree) {
        const header = `/* eslint-disable */
// ============================================================================
// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
// Generated by: tools/gen-permissions.mjs
//
// Purpose:
//   IDE-friendly permission constants for templates/components.
//
// Usage:
//   PERM.TeamManagement.view
//   PERM.TeamManagement.delete
// ============================================================================

export type PermPair = Readonly<{ module: string; action: string }>;

`;
        const body = `export const PERM = ${JSON.stringify(permTree, null, 2)} as const satisfies Record<
  string,
  Record<string, PermPair>
>;

// Convenience helpers (optional):
export type PermModule = keyof typeof PERM;
export type PermAction<M extends PermModule> = keyof (typeof PERM)[M];

// Example:
//   const canDelete: PermPair = PERM.TeamManagement.delete;
`;
        return header + body + "\n";
    }
}
// Run immediately when invoked via node
await PermissionsGenerator.run();
