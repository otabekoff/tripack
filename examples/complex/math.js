// examples/complex/math.js

export function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

export function fibonacci(n) {
    if (n <= 1) return n;
    let a = 0,
        b = 1;
    for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b];
    }
    return b;
}

export function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0) return false;
    }
    return true;
}

export const GOLDEN_RATIO = 1.618033988749;
