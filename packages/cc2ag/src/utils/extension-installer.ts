import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execPromise = promisify(exec);

export interface ExtensionInstallOptions {
    forceInstall?: boolean;
    skipIfInstalled?: boolean;
    verbose?: boolean;
}

/**
 * Check if Antigravity SubAgents extension is installed
 */
export async function checkExtensionInstalled(): Promise<boolean> {
    try {
        // First try with code command (for VSCode/Antigravity)
        const { stdout } = await execPromise('code --list-extensions');
        const extensions = stdout.toLowerCase();

        // Check for the specific extension
        if (extensions.includes('oleynikaleksandr.antigravity-subagents')) {
            return true;
        }
    } catch (error) {
        // If code command is not available, try alternative checks
        if (error instanceof Error && (error.message.includes('command not found') || error.message.includes('not found'))) {
            // Try checking Antigravity extensions directory
            const antigravityExtensionsPath = path.join(process.env.HOME!, '.antigravity', 'extensions');
            if (await fs.pathExists(antigravityExtensionsPath)) {
                const extensions = await fs.readdir(antigravityExtensionsPath);
                if (extensions.some(ext => ext.toLowerCase().includes('antigravity-subagents'))) {
                    return true;
                }
            }

            // Try checking VSCode extensions directory as backup
            const vscodeExtensionsPath = path.join(process.env.HOME!, '.vscode', 'extensions');
            if (await fs.pathExists(vscodeExtensionsPath)) {
                const extensions = await fs.readdir(vscodeExtensionsPath);
                if (extensions.some(ext => ext.toLowerCase().includes('antigravity-subagents'))) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Download and install the Antigravity SubAgents extension
 */
export async function installExtension(): Promise<boolean> {
    try {
        // First, try to install via code command
        await execPromise('code --install-extension OleynikAleksandr.antigravity-subagents');
        return true;
    } catch (error) {
        console.log('Direct extension installation failed. Attempting alternative method...');

        // Alternative: Download VSIX and install
        try {
            const tempDir = path.join(process.cwd(), 'temp-extension-download');
            await fs.ensureDir(tempDir);

            // Download the latest VSIX from GitHub
            const vsixUrl = 'https://github.com/OleynikAleksandr/antigravity-subagents/releases/latest/download/antigravity-subagents.vsix';
            const vsixPath = path.join(tempDir, 'antigravity-subagents.vsix');

            // Use curl to download (assuming it's available)
            await execPromise(`curl -L -o "${vsixPath}" "${vsixUrl}"`);

            // Install from VSIX file
            await execPromise(`code --install-extension "${vsixPath}"`);

            // Clean up temp directory
            await fs.remove(tempDir);

            return true;
        } catch (downloadError) {
            console.error('Failed to install extension:', downloadError);
            return false;
        }
    }
}

/**
 * Validate that the extension is working properly
 */
export async function validateExtension(): Promise<boolean> {
    try {
        // Check if extension is installed
        const installed = await checkExtensionInstalled();
        if (!installed) {
            return false;
        }

        // Additional validation could go here
        // For now, just verify it's listed as installed
        return true;
    } catch (error) {
        console.error('Extension validation failed:', error);
        return false;
    }
}

/**
 * Main function to ensure extension is installed
 */
export async function ensureExtensionInstalled(options: ExtensionInstallOptions = {}): Promise<boolean> {
    const { forceInstall = false, skipIfInstalled = true, verbose = false } = options;

    if (verbose) {
        console.log('Checking Antigravity SubAgents extension...');
    }

    const isInstalled = await checkExtensionInstalled();

    if (isInstalled && skipIfInstalled && !forceInstall) {
        if (verbose) {
            console.log('Extension is already installed.');
        }
        return true;
    }

    if (!isInstalled || forceInstall) {
        if (verbose) {
            console.log('Installing Antigravity SubAgents extension...');
        }

        const success = await installExtension();

        if (success) {
            if (verbose) {
                console.log('Extension installed successfully!');
            }

            // Validate the installation
            const isValid = await validateExtension();
            if (isValid) {
                if (verbose) {
                    console.log('Extension validation passed.');
                }
                return true;
            } else {
                if (verbose) {
                    console.log('Extension installed but validation failed.');
                }
                return false;
            }
        } else {
            if (verbose) {
                console.log('Extension installation failed.');
            }
            return false;
        }
    }

    return isInstalled;
}