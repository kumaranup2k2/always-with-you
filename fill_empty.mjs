import fs from 'fs';
import path from 'path';

function fillEmpty(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fillEmpty(fullPath);
        } else {
            const stat = fs.statSync(fullPath);
            if (stat.size === 0) {
                if (fullPath.endsWith('.jsx')) {
                    fs.writeFileSync(fullPath, 'export default function Dummy() { return null; }');
                } else if (fullPath.endsWith('.js')) {
                    fs.writeFileSync(fullPath, 'export const dummy = 0;');
                }
            }
        }
    }
}

fillEmpty(path.join(process.cwd(), 'src'));