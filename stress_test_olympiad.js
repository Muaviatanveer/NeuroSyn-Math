/**
 * @file stress_test_olympiad.js
 * @description Olympiad-Level Stress Test Suite for NeuroSyn-Math.
 */

import fs from 'fs';

// 1. Load environment variables FIRST before importing any modules
if (fs.existsSync('.env')) {
    process.loadEnvFile('.env');
}

// Global error traps so silent errors are always logged
process.on('uncaughtException', (err) => {
    console.error('❌ CRITICAL UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ CRITICAL UNHANDLED REJECTION:', reason);
});

// 2. Dynamically import synapseFabric AFTER process.env is populated
const { default: synapseFabric } = await import('./backend/src/services/synapseFabric.js');

const OLYMPIAD_PROBLEMS = [
    {
        id: 'PUTNAM_2024_A1',
        competition: 'William Lowell Putnam Mathematical Competition 2024 (Problem A1)',
        domain: 'Number Theory / Diophantine Equations',
        problem: 'Determine all positive integers n for which there exist positive integers a, b, and c satisfying 2a^n + 3b^n = 4c^n.',
        knownAnswer: 'n = 1 and n = 2'
    },
    {
        id: 'IMO_2024_P2',
        competition: 'International Mathematical Olympiad 2024 (Problem 2)',
        domain: 'Number Theory / Divisibility',
        problem: 'Find all positive integers n with the following property: for all positive divisors d of n, we have that d + 1 divides n or d + 1 is prime.',
        knownAnswer: 'n ∈ {1, 2, 4, 12}'
    }
];

async function runOlympiadStressTest() {
    console.log('\n===================================================================');
    console.log('🏆 NEUROSYN-MATH OLYMPIAD & PUTNAM STRESS TEST SUITE');
    console.log('===================================================================\n');

    const streamLogger = (type, data) => {
        switch (type) {
            case 'status':
                console.log(`  \x1b[36m[PHASE]\x1b[0m ${data.message}`);
                break;
            case 'percepts':
                console.log(`  \x1b[33m[PERCEPTION]\x1b[0m Domain: ${data.domains?.[0]} | Goal: ${data.goal}`);
                break;
            case 'strategies':
                console.log(`  \x1b[32m[STRATEGIES]\x1b[0m ${data.count} proof paths: ${data.strategies.join(' | ')}`);
                break;
            case 'counterexample':
                if (data.found) {
                    console.log(`  \x1b[31m[COUNTEREXAMPLE]\x1b[0m Counterexample detected! Problem disproven.`);
                } else {
                    console.log(`  \x1b[32m[BOUNDARIES]\x1b[0m Boundary scan passed cleanly.`);
                }
                break;
            case 'error':
                console.log(`  \x1b[31m[ERROR]\x1b[0m ${data.message}`);
                break;
        }
    };

    for (let idx = 0; idx < OLYMPIAD_PROBLEMS.length; idx++) {
        const item = OLYMPIAD_PROBLEMS[idx];
        console.log(`\n-------------------------------------------------------------------`);
        console.log(`🎯 PROBLEM ${idx + 1}/${OLYMPIAD_PROBLEMS.length}: ${item.id}`);
        console.log(`🏛️ Competition: ${item.competition}`);
        console.log(`📐 Domain: ${item.domain}`);
        console.log(`❓ Problem Statement:\n   "${item.problem}"`);
        console.log(`💡 Expected Answer: ${item.knownAnswer}`);
        console.log(`-------------------------------------------------------------------\n`);

        const startTime = Date.now();

        try {
            const result = await synapseFabric.processPrompt(item.problem, {
                sendStreamData: streamLogger,
                userId: 'olympiad_tester'
            });

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

            console.log(`\n  =============================================================`);
            console.log(`  ✅ PROOF SEARCH COMPLETE IN ${elapsed}s`);
            console.log(`  =============================================================`);
            console.log(`  • Primary Domain: ${result.primaryDomain}`);
            console.log(`  • Lean 4 Status: ${result.verifiedInLean ? 'VERIFIED ✅' : 'SYMBOLICALLY CHECKED ⚠️'}`);
            console.log(`  • Confidence: ${((result.confidence || 0) * 100).toFixed(1)}%`);

            if (result.formalProof) {
                console.log(`\n  🛡️ GENERATED LEAN 4 FORMAL THEOREM:`);
                console.log(`  \`\`\`lean\n  ${result.formalProof.trim()}\n  \`\`\``);
            }

            if (result.explanation?.undergraduate) {
                console.log(`\n  📚 PEDAGOGICAL PROOF SUMMARY:`);
                console.log(`  ${result.explanation.undergraduate.slice(0, 600)}...`);
            }

        } catch (error) {
            console.error(`  ❌ OLYMPIAD TEST FAILED: ${error.message}`);
        }
    }

    console.log('\n===================================================================');
    console.log('🏁 OLYMPIAD STRESS TEST FINISHED');
    console.log('===================================================================\n');
}

runOlympiadStressTest();