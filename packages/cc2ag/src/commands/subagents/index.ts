import { Command } from 'commander';

export function createSubAgentsCommand(): Command {
    const program = new Command('subagents');

    program
        .description('Manage subagents configuration (enable/disable/configure)')
        .action(() => {
            console.log('SubAgents extension feature has been deprecated in this version.');
            console.log('Antigravity now manages agents via its native Agent Manager format.');
            console.log('Use cc2ag global/project to generate standard rules and skills.');
        });

    return program;
}
