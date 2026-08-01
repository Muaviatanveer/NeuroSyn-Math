/**
 * @file test_neurosyn_math.js
 * @description End-to-end test script for NeuroSyn-Math.
 * Ingests a mathematical problem and streams the execution through Perception,
 * Strategy Generation, Counterexample Search, Specialists, Symbolic Verification,
 * Lean 4 Formal Verification, Epistemic Confidence, and Multi-Tier Explanations.
 */

import 'dotenv/config'; // Loads OPENAI_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY
import synapseFabric from './backend/src/services/synapseFabric.js';
import logger from './backend/src/utils/logger.js';

async function runTest() {
    console.log('\n===============================================================');
    console.log('🧪 INITIALIZING NEUROSYN-MATH END-TO-END VERIFICATION TEST');
    console.log('===============================================================\n');

    // Test Problem Statement (Classic Group Theory Problem)
    const mathProblem = "Let G be a finite group in which x^2 = e for all x in G, where e is the identity element. Prove that G is abelian.";

    console.log(`📌 Test Problem: "${mathProblem}"\n`);

    // Stream callback function to observe real-time progress across layers
    const sendStreamData = (type, data) => {
        switch (type) {
            case 'status':
                console.log(`\x1b[36m[STATUS]\x1b[0m ${data.message}`);
                break;
            case 'percepts':
                console.log(`\x1b[33m[PERCEPTION]\x1b[0m Type: ${data.type} | Primary Domain: ${data.domains?.[0]} | Goal: ${data.goal}`);
                if (data.leanSignature) console.log(`              Lean Signature: ${data.leanSignature}`);
                break;
            case 'strategies':
                console.log(`\x1b[32m[STRATEGY MATRIX]\x1b[0m Spawning ${data.count} parallel vectors: [${data.strategies.join(', ')}]`);
                break;
            case 'counterexample':
                console.log(`\x1b[35m[COUNTEREXAMPLE SEARCH]\x1b[0m Found: ${data.found} | ${data.message || ''}`);
                break;
            case 'error':
                console.log(`\x1b[31m[ERROR]\x1b[0m ${data.message}`);
                break;
            case 'end':
                console.log(`\x1b[32m[COMPLETE]\x1b[0m Stream finished.`);
                break;
            default:
                // Other events
                break;
        }
    };

    try {
        const startTime = Date.now();

        // Process prompt through SynapseFabric routing
        const result = await synapseFabric.processPrompt(mathProblem, {
            sendStreamData,
            userId: 'test_user_001'
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n===============================================================');
        console.log(`✅ VERIFICATION COMPLETE (${duration} seconds)`);
        console.log('===============================================================\n');

        console.log('📊 EPISODIC CONFIDENCE & CERTIFICATE:');
        console.log(`• Primary Domain: ${result.primaryDomain || 'Algebra'}`);
        console.log(`• Formal Lean 4 Verified: ${result.verifiedInLean ? 'YES ✅' : 'NO (Symbolically Checked) ⚠️'}`);
        console.log(`• Confidence Score: ${((result.confidence || 0) * 100).toFixed(1)}%\n`);

        if (result.formalProof) {
            console.log('🛡️ GENERATED LEAN 4 FORMAL PROOF:');
            console.log('```lean');
            console.log(result.formalProof);
            console.log('```\n');
        }

        if (result.explanation) {
            console.log('✍️ MULTI-TIER HUMAN EXPLANATIONS:\n');

            if (result.explanation.researchPaper) {
                console.log('--- 🎓 RESEARCH PAPER FORMAT ---');
                console.log(result.explanation.researchPaper);
                console.log('');
            }

            if (result.explanation.undergraduate) {
                console.log('--- 📚 UNDERGRADUATE PEDAGOGICAL BREAKDOWN ---');
                console.log(result.explanation.undergraduate);
                console.log('');
            }

            if (result.explanation.eli5) {
                console.log('--- 💡 ELI5 INTUITIVE ANALOGY ---');
                console.log(result.explanation.eli5);
                console.log('');
            }
        }

    } catch (error) {
        console.error('\n❌ TEST FAILED WITH EXCEPTION:', error);
    }
}

runTest();