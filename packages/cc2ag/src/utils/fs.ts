import fs from 'fs-extra';
import path from 'path';

export async function ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
}

export async function copyDir(src: string, dest: string): Promise<void> {
    await fs.copy(src, dest, { overwrite: true });
}

export async function readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
}

export async function exists(filePath: string): Promise<boolean> {
    return fs.pathExists(filePath);
}

export async function listDirs(dirPath: string): Promise<string[]> {
    if (!(await exists(dirPath))) return [];

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
        .filter(e => e.isDirectory())
        .filter(e => !e.name.startsWith('.') && e.name !== '__pycache__' && e.name !== 'node_modules')
        .map(e => e.name);
}

export async function listFiles(dirPath: string, extension?: string): Promise<string[]> {
    if (!(await exists(dirPath))) return [];

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
        .filter(e => e.isFile())
        .filter(e => !extension || e.name.endsWith(extension))
        .map(e => e.name);
}

export async function removeDir(dirPath: string): Promise<void> {
    if (await exists(dirPath)) {
        await fs.remove(dirPath);
    }
}
