const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EXCLUDED_DIRS = new Set([".git", "node_modules"]);
const PROTECTED_RELATIVE_PATH = "posts/image-to-qr-menu-guide.html";

function walk(dir, relative = "", result = new Map()) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!relative && EXCLUDED_DIRS.has(entry.name)) continue;
        const absolute = path.join(dir, entry.name);
        const rel = path.posix.join(relative, entry.name);
        if (entry.isDirectory()) {
            walk(absolute, rel, result);
        } else if (entry.isFile()) {
            const content = fs.readFileSync(absolute);
            result.set(rel, crypto.createHash("sha256").update(content).digest("hex"));
        }
    }
    return result;
}

function snapshot() {
    return walk(ROOT);
}

function compare(before, after) {
    const paths = new Set([...before.keys(), ...after.keys()]);
    return [...paths].filter(file => before.get(file) !== after.get(file)).sort();
}

function main() {
    const protectedPath = path.join(ROOT, PROTECTED_RELATIVE_PATH);
    if (!fs.existsSync(protectedPath)) {
        throw new Error("Protected article is missing: " + PROTECTED_RELATIVE_PATH);
    }

    const protectedBefore = crypto.createHash("sha256")
        .update(fs.readFileSync(protectedPath))
        .digest("hex");
    const before = snapshot();

    console.log("Running the full build a second time to check output stability...");
    const build = spawnSync("npm", ["run", "build"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: "inherit",
        env: process.env
    });
    if (build.error) throw build.error;
    if (build.status !== 0) {
        throw new Error("Second full build failed with exit code " + build.status);
    }

    const after = snapshot();
    const changed = compare(before, after);
    const protectedAfter = crypto.createHash("sha256")
        .update(fs.readFileSync(protectedPath))
        .digest("hex");

    if (protectedBefore !== protectedAfter) {
        throw new Error("Protected article changed during the second build: " + PROTECTED_RELATIVE_PATH);
    }
    if (changed.length) {
        const preview = changed.slice(0, 40).map(file => " - " + file).join("\n");
        throw new Error(
            "Second build changed " + changed.length + " file(s); build output is not idempotent:\n" +
            preview + (changed.length > 40 ? "\n - ... and " + (changed.length - 40) + " more" : "")
        );
    }

    console.log("PASS: second full build did not change any repository file contents.");
    console.log("PASS: protected article remained byte-identical across the second build.");
}

try {
    main();
} catch (error) {
    console.error("BUILD IDEMPOTENCE CHECK FAILED:", error.message);
    process.exit(1);
}
