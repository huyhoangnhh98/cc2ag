import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, 'fixtures');
const outputPath = path.join(__dirname, 'output');

// Import the functions to test
import { convertAllWorkflows } from '../src/converters/workflow.js';

describe('workflow-converter-with-skills', () => {
    beforeEach(async () => {
        await fs.ensureDir(outputPath);
    });

    afterEach(async () => {
        await fs.remove(outputPath);
    });

    it('should convert commands to workflows', async () => {
        const result = await convertAllWorkflows({
            sourcePath: path.join(fixturesPath, 'commands'),
            targetPath: outputPath,
            skillNames: [],
            agentNames: [],
            context: 'project',
            verbose: false,
        });

        expect(result.count).toBeGreaterThan(0);
        expect(await fs.pathExists(path.join(outputPath, 'test-cmd.md'))).toBe(true);
    });

    it('should convert user-invocable skills to workflows', async () => {
        const result = await convertAllWorkflows({
            sourcePath: path.join(fixturesPath, 'commands'),
            targetPath: outputPath,
            skillNames: ['test-skill'],
            agentNames: [],
            context: 'project',
            skillsPath: path.join(fixturesPath, 'skills'),
            verbose: false,
        });

        // Should include both commands and skills
        expect(result.count).toBeGreaterThanOrEqual(3); // test-cmd, collision, test-skill
        expect(await fs.pathExists(path.join(outputPath, 'test-skill.md'))).toBe(true);
    });

    it('should skip non-user-invocable skills', async () => {
        const result = await convertAllWorkflows({
            sourcePath: path.join(fixturesPath, 'commands'),
            targetPath: outputPath,
            skillNames: ['non-invocable-skill'],
            agentNames: [],
            context: 'project',
            skillsPath: path.join(fixturesPath, 'skills'),
            verbose: false,
        });

        // non-invocable-skill should be in skippedSkills
        expect(result.skippedSkills).toContain('non-invocable-skill');
        expect(await fs.pathExists(path.join(outputPath, 'non-invocable-skill.md'))).toBe(false);
    });

    it('should prioritize skills over commands on name collision', async () => {
        const result = await convertAllWorkflows({
            sourcePath: path.join(fixturesPath, 'commands'),
            targetPath: outputPath,
            skillNames: ['collision'],
            agentNames: [],
            context: 'project',
            skillsPath: path.join(fixturesPath, 'skills'),
            verbose: false,
        });

        // collision.md should exist and contain skill content, not command content
        const collisionContent = await fs.readFile(path.join(outputPath, 'collision.md'), 'utf-8');
        expect(collisionContent).toContain('Collision Skill');
        expect(collisionContent).not.toContain('Debug Command');
    });
});
