import readline from 'readline';

/**
 * Prompt user for confirmation
 * Returns true if user confirms with 'y' or 'Y'
 */
export async function confirm(message: string): Promise<boolean> {
    // If not TTY, cannot prompt - require --yes flag
    if (!process.stdin.isTTY) {
        console.log('Non-interactive mode detected. Use --yes to skip confirmation.');
        return false;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${message} [y/N] `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}
