import https from 'https';
import chalk from 'chalk';
import { execSync } from 'child_process';

interface NpmPackageInfo {
  version: string;
  'dist-tags': {
    latest: string;
  };
}

/**
 * Fetch latest version from NPM registry
 */
export async function getLatestVersion(packageName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${packageName}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed: NpmPackageInfo = JSON.parse(data);
          resolve(parsed['dist-tags']?.latest || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Compare semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;

    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }

  return 0;
}

/**
 * Check for updates and prompt user
 */
export async function checkAndPromptUpdate(
  currentVersion: string,
  packageName: string = '@huyhoangnhh98/cc2ag'
): Promise<boolean> {
  try {
    const latestVersion = await getLatestVersion(packageName);

    if (!latestVersion) {
      return false;
    }

    const comparison = compareVersions(latestVersion, currentVersion);

    if (comparison > 0) {
      console.log('');
      console.log(chalk.yellow('╔════════════════════════════════════════════════════════════╗'));
      console.log(chalk.yellow('║                    Update Available                        ║'));
      console.log(chalk.yellow('╚════════════════════════════════════════════════════════════╝'));
      console.log('');
      console.log(`Current version: ${chalk.gray(currentVersion)}`);
      console.log(`Latest version:  ${chalk.green(latestVersion)}`);
      console.log('');
      console.log('To update, run:');
      console.log(chalk.cyan(`  npm install -g ${packageName}@latest`));
      console.log('');

      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Auto-update the CLI tool
 */
export async function autoUpdate(
  packageName: string = '@huyhoangnhh98/cc2ag'
): Promise<boolean> {
  try {
    console.log(chalk.cyan('Checking for updates...'));

    const latestVersion = await getLatestVersion(packageName);

    if (!latestVersion) {
      console.log(chalk.red('Failed to check for updates (network issue)'));
      return false;
    }

    console.log(chalk.green(`✓ Found latest version: ${latestVersion}`));
    console.log(chalk.cyan('Installing...'));

    // Use npm to install the latest version
    execSync(`npm install -g ${packageName}@${latestVersion}`, {
      stdio: 'inherit',
    });

    console.log(chalk.green('✓ Update complete!'));
    console.log('');

    return true;
  } catch (error) {
    console.log(chalk.red('✗ Update failed'));
    if (error instanceof Error) {
      console.log(chalk.gray(error.message));
    }
    return false;
  }
}
