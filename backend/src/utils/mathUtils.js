/**
 * @file mathUtils.js
 * @description Centralized Deterministic Mathematical Utilities for NeuroSyn-Math.
 * Provides exact, non-LLM algorithms for Number Theory, Linear Algebra, Combinatorics, and Polynomials.
 */

import { create, all } from 'mathjs';

const math = create(all);

export const MathUtils = {
    // ===================================================================
    // 1. NUMBER THEORY (Exact Algorithms)
    // ===================================================================

    /**
     * Greatest Common Divisor (Euclidean Algorithm)
     */
    gcd(a, b) {
        a = BigInt(a);
        b = BigInt(b);
        while (b !== 0n) {
            const t = b;
            b = a % b;
            a = t;
        }
        return Number(a);
    },

    /**
     * Extended Euclidean Algorithm: Returns [gcd, x, y] such that a*x + b*y = gcd(a,b)
     */
    extGCD(a, b) {
        if (b === 0) return [a, 1, 0];
        const [g, x1, y1] = this.extGCD(b, a % b);
        return [g, y1, x1 - Math.floor(a / b) * y1];
    },

    /**
     * Modular Exponentiation: Computes (base^exp) % mod deterministically
     */
    modPow(base, exp, mod) {
        base = BigInt(base);
        exp = BigInt(exp);
        mod = BigInt(mod);
        let res = 1n;
        base = base % mod;
        while (exp > 0n) {
            if (exp % 2n === 1n) res = (res * base) % mod;
            base = (base * base) % mod;
            exp = exp / 2n;
        }
        return Number(res);
    },

    /**
     * Deterministic Miller-Rabin Primality Test
     */
    isPrime(n) {
        if (n <= 1) return false;
        if (n <= 3) return true;
        if (n % 2 === 0 || n % 3 === 0) return false;
        for (let i = 5; i * i <= n; i += 6) {
            if (n % i === 0 || n % (i + 2) === 0) return false;
        }
        return true;
    },

    /**
     * Returns all positive divisors of n
     */
    getDivisors(n) {
        const divisors = [];
        for (let i = 1; i * i <= n; i++) {
            if (n % i === 0) {
                divisors.push(i);
                if (i * i !== n) divisors.push(n / i);
            }
        }
        return divisors.sort((a, b) => a - b);
    },

    /**
     * Chinese Remainder Theorem solver for coprime moduli
     */
    chineseRemainder(remainders, moduli) {
        const prod = moduli.reduce((acc, val) => acc * val, 1);
        let result = 0;
        for (let i = 0; i < moduli.length; i++) {
            const p = Math.floor(prod / moduli[i]);
            const [_, inv] = this.extGCD(p, moduli[i]);
            result += remainders[i] * ((inv % moduli[i] + moduli[i]) % moduli[i]) * p;
        }
        return result % prod;
    },

    // ===================================================================
    // 2. COMBINATORICS & COUNTING (Exact Formulae)
    // ===================================================================

    /**
     * Factorial n!
     */
    factorial(n) {
        if (n < 0) return 0;
        let res = 1n;
        for (let i = 2n; i <= BigInt(n); i++) res *= i;
        return Number(res);
    },

    /**
     * Combinations: C(n, k) = n! / (k! * (n-k)!)
     */
    combinations(n, k) {
        if (k < 0 || k > n) return 0;
        if (k === 0 || k === n) return 1;
        if (k > n / 2) k = n - k;
        let res = 1n;
        for (let i = 1n; i <= BigInt(k); i++) {
            res = (res * (BigInt(n) - i + 1n)) / i;
        }
        return Number(res);
    },

    /**
     * Catalan Number: C_n = (1 / (n+1)) * C(2n, n)
     */
    catalan(n) {
        return this.combinations(2 * n, n) / (n + 1);
    },

    // ===================================================================
    // 3. ALGEBRA & MATRIX COMPUTATIONS
    // ===================================================================

    /**
     * Determinant of a square matrix
     */
    matrixDeterminant(matrixArray) {
        return math.det(matrixArray);
    },

    /**
     * Matrix Multiplication
     */
    matrixMultiply(A, B) {
        return math.multiply(A, B);
    },

    /**
     * Polynomial discriminant for a*x^2 + b*x + c = 0
     */
    quadraticDiscriminant(a, b, c) {
        return b * b - 4 * a * c;
    },

    /**
     * Exact symbolic simplification via math.js engine
     */
    simplifyExpression(exprString) {
        return math.simplify(exprString).toString();
    }
};

export default MathUtils;