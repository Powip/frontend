"use strict";

// Test-only preload, inherited by Next workers. Never open repository .env files.
if (process.env.PARTNERS_ADMIN_BROWSER_LOCAL_TEST !== "true") {
  throw new Error("PARTNERS_ADMIN_BROWSER_LOCAL_OPT_IN_REQUIRED");
}
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { syncBuiltinESMExports } = require("node:module");
const isEnv = (value) => {
  if (typeof value === "number") return false;
  const target = value instanceof URL ? fileURLToPath(value) : Buffer.isBuffer(value) ? value.toString() : value;
  return typeof target === "string" && /^\.env(?:\.|$)/.test(path.basename(target));
};
const absent = () => Object.assign(new Error("Test runtime does not load environment files"), { code: "ENOENT" });
const root = path.resolve(__dirname, "../..");
const id = process.env.PARTNERS_ADMIN_BROWSER_DIST_ID;
if (!/^[a-f0-9]{32}$/.test(id ?? "")) throw new Error("Owned Next dist identifier is required");
const ownedDist = path.join(__dirname, `.next-browser-${id}`);
const generatedTarget = (value) => {
  const target = value instanceof URL ? fileURLToPath(value) : Buffer.isBuffer(value) ? value.toString() : value;
  if (typeof target !== "string") return value;
  const absolute = path.resolve(target);
  const defaultDist = path.join(root, ".next");
  // Next devtools uses a default .next cache even with custom distDir: keep it private too.
  if (absolute === defaultDist || absolute.startsWith(`${defaultDist}${path.sep}`)) {
    return path.join(ownedDist, "default-next-cache", path.relative(defaultDist, absolute));
  }
  return value;
};
const writeTarget = (value) => {
  value = generatedTarget(value);
  const target = value instanceof URL ? fileURLToPath(value) : Buffer.isBuffer(value) ? value.toString() : value;
  if (typeof target !== "string") return value;
  const absolute = path.resolve(target);
  if (absolute === path.join(root, "next-env.d.ts") || absolute === path.join(root, "tsconfig.json")) {
    return path.join(ownedDist, path.basename(absolute)); // Generated type configuration only; never mutate source files.
  }
  if (absolute.startsWith(`${root}${path.sep}`) && !absolute.startsWith(`${ownedDist}${path.sep}`)) {
    throw Object.assign(new Error("Local Next fixture cannot write outside its owned dist"), { code: "PARTNERS_TEST_SOURCE_WRITE_DENIED", fixtureFile: path.relative(root, absolute) });
  }
  return value;
};
for (const name of ["statSync", "lstatSync", "readFileSync", "openSync", "accessSync"]) {
  const original = fs[name];
  fs[name] = function (target, ...args) { if (isEnv(target)) throw absent(); return original.call(this, generatedTarget(target), ...args); };
}
const originalExists = fs.existsSync;
fs.existsSync = function (target) { return !isEnv(target) && originalExists.call(this, generatedTarget(target)); };
for (const name of ["stat", "lstat", "readFile", "open", "access"]) {
  const original = fs[name];
  fs[name] = function (target, ...args) {
    if (!isEnv(target)) return original.call(this, generatedTarget(target), ...args);
    const callback = args.at(-1);
    if (typeof callback === "function") { queueMicrotask(() => callback(absent())); return; }
    throw absent();
  };
  const promiseOriginal = fs.promises[name];
  fs.promises[name] = async function (target, ...args) {
    if (isEnv(target)) throw absent();
    return promiseOriginal.call(this, generatedTarget(target), ...args);
  };
}
const mkdirSync = fs.mkdirSync;
fs.mkdirSync = function (target, ...args) { return mkdirSync.call(this, generatedTarget(target), ...args); };
const mkdirPromise = fs.promises.mkdir;
fs.promises.mkdir = async function (target, ...args) { return mkdirPromise.call(this, generatedTarget(target), ...args); };
const writeSync = fs.writeFileSync;
fs.writeFileSync = function (target, ...args) { return writeSync.call(this, writeTarget(target), ...args); };
const writePromise = fs.promises.writeFile;
fs.promises.writeFile = async function (target, ...args) { return writePromise.call(this, writeTarget(target), ...args); };
const writeCallback = fs.writeFile;
fs.writeFile = function (target, ...args) { return writeCallback.call(this, writeTarget(target), ...args); };
syncBuiltinESMExports();
globalThis.__PARTNERS_TEST_ENV_FILE_GUARD = true;
