import fs from 'fs';
import path from 'path';

function scan(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scan(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            const imports = lines.filter(l => l.startsWith('import ') && l.includes('from') || l.includes('import(') || (l.startsWith('import ') && l.includes('./')));
            if (imports.length > 0) {
                console.log(`\nFile: ${fullPath}`);
                imports.forEach(i => console.log(i.trim()));
            }
        }
    }
}

scan(path.join(process.cwd(), 'src'));