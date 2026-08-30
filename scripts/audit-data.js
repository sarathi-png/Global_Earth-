const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES = ['disasters.json', 'wars.json', 'mysteries.json', 'historical-events.json'];
const REQUIRED = ['id', 'title', 'type', 'lat', 'lng', 'year', 'severity', 'description', 'source'];

let issues = 0;

function report(file, id, msg) {
    issues++;
    console.log(`  [${file}] ${id}: ${msg}`);
}

FILES.forEach(file => {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        console.log(`\n${file}: INVALID JSON - ${e.message}`);
        issues++;
        return;
    }

    if (!Array.isArray(data)) {
        console.log(`\n${file}: not an array`);
        issues++;
        return;
    }

    console.log(`\n${file}: ${data.length} entries`);

    const ids = new Set();
    data.forEach(item => {
        const id = item.id || '(no id)';

        REQUIRED.forEach(field => {
            if (item[field] === undefined || item[field] === null || item[field] === '') {
                report(file, id, `missing field "${field}"`);
            }
        });

        if (ids.has(item.id)) report(file, id, 'duplicate id');
        ids.add(item.id);

        if (typeof item.lat === 'number' && (item.lat < -90 || item.lat > 90)) {
            report(file, id, `lat out of range: ${item.lat}`);
        }
        if (typeof item.lng === 'number' && (item.lng < -180 || item.lng > 180)) {
            report(file, id, `lng out of range: ${item.lng}`);
        }

        if (item.lat === 0 && item.lng === 0) {
            report(file, id, 'suspicious (0,0) coordinates');
        }

        if (typeof item.year === 'number' && (item.year < -10000 || item.year > 2030)) {
            report(file, id, `year out of range: ${item.year}`);
        }

        if (raw.indexOf('\uFFFD') !== -1 && !raw.includes(item.id)) {
            // placeholder - encoding check handled below
        }
    });

    if (raw.indexOf('\uFFFD') !== -1) {
        console.log(`  [${file}] contains U+FFFD replacement characters (encoding issue)`);
        issues++;
    }
});

console.log(`\n=== Audit complete: ${issues} issue(s) found ===`);
process.exit(issues > 0 ? 1 : 0);