import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama'
});

async function run() {
    console.log("Starting stream...");
    const res = await client.chat.completions.create({
        model: 'deepseek-r1:32b',
        messages: [{ role: 'user', content: 'What is 2+2?' }],
        stream: true,
        max_tokens: 5
    });

    for await (const chunk of res) {
        console.log(JSON.stringify(chunk));
    }
}

run().catch(console.error);
