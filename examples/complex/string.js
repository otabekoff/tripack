// examples/complex/string.js

export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function camelToSnake(str) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function truncate(str, maxLen = 50) {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + "…";
}

export function slugify(str) {
    return str
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, "");
}
