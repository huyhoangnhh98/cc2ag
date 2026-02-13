import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFixturesPath = path.join(__dirname, 'fixtures');

// Import the functions to test
import { convertAllAgents, SubAgentConvertOptions } from '../src/converters/subagent.js';
import { createRoutingFromAgents } from '../src/generators/routing.js';
import { ensureExtensionInstalled } from '../src/utils/extension-installer.js';

describe('subagent-converter', () => {
    beforeEach(async () => {
        // Create test fixtures directory
        await fs.ensureDir(testFixturesPath);

        // Create a sample ClaudeKit agent file for testing
        const sampleAgentContent = `---
name: researcher
model: haiku
tools: Glob, Grep, Read, Bash, WebFetch, WebSearch, TaskCreate, TaskGet, TaskUpdate, TaskList, SendMessage
description: Use this agent when you need to conduct comprehensive research on software development topics
---

You are an expert technology researcher specializing in software development...
`;

        await fs.ensureDir(path.join(testFixturesPath, 'agents'));
        await fs.writeFile(path.join(testFixturesPath, 'agents', 'researcher.md'), sampleAgentContent);
    });

    afterEach(async () => {
        // Clean up test fixtures
        await fs.remove(testFixturesPath);
    });

    it('should convert ClaudeKit agent to SubAgent format', async () => {
        const options: SubAgentConvertOptions = {
            sourcePath: path.join(testFixturesPath, 'agents'),
            targetPath: path.join(testFixturesPath, 'subagents'),
            context: 'project',
            dryRun: false,
            verbose: false
        };

        const count = await convertAllAgents(options);

        expect(count).toBe(1);

        // Check that the subagent directory was created
        const subagentDir = path.join(testFixturesPath, 'subagents', 'researcher');
        expect(await fs.pathExists(subagentDir)).toBe(true);

        // Check that instructions.md was created
        const instructionsPath = path.join(subagentDir, 'instructions.md');
        expect(await fs.pathExists(instructionsPath)).toBe(true);

        // Check that config.json was created
        const configPath = path.join(subagentDir, 'config.json');
        expect(await fs.pathExists(configPath)).toBe(true);

        // Read and verify the config content
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        expect(config.name).toBe('researcher');
        expect(config.vendor).toBe('claude');
        expect(config.model).toBe('haiku');
        expect(Array.isArray(config.tools)).toBe(true);
        expect(config.tools).toContain('Glob');
        expect(config.tools).toContain('WebSearch');
        expect(Array.isArray(config.triggers)).toBe(true);
        expect(config.triggers).toContain('research');
        expect(config.description).toContain('comprehensive research');
    });

    it('should generate routing rules from agents', async () => {
        const agentsPath = path.join(testFixturesPath, 'agents');
        const targetPath = path.join(testFixturesPath, 'routing-test');

        await createRoutingFromAgents(agentsPath, targetPath, { dryRun: false, verbose: false });

        // Check that GEMINI.md was created
        const geminiPath = path.join(targetPath, 'GEMINI.md');
        expect(await fs.pathExists(geminiPath)).toBe(true);

        const content = await fs.readFile(geminiPath, 'utf-8');
        expect(content).toContain('# SubAgent Routing Protocol');
        expect(content).toContain('researcher');
        expect(content).toContain('Keywords');
    });

    it('should handle extension installation check gracefully', async () => {
        // This test just ensures the function doesn't crash
        // Actual extension installation would require VSCode/Antigravity to be installed
        const result = await ensureExtensionInstalled({ verbose: false });

        // Result can be true or false depending on if extension is installed, but shouldn't throw
        expect(typeof result).toBe('boolean');
    });
});