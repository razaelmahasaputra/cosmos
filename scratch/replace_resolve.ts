import fs from 'fs';
import path from 'path';

const toolsDir = './src/tools';
const files = fs.readdirSync(toolsDir).filter((f) => f.endsWith('.ts'));

for (const file of files) {
    const filePath = path.join(toolsDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    let changed = false;
    if (content.includes('resolveId(') && !content.includes('await resolveId(')) {
        content = content.replace(/resolveId\(([^)]+)\)/g, 'await resolveId($1, sock, msg.key.remoteJid)');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file}`);
    }
}
