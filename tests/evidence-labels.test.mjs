import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('detail distinguishes source claims from field inspection',()=>{
 const s=readFileSync(new URL('../js/map-page.js',import.meta.url),'utf8');
 assert.ok(!s.includes('Data real OSM'),'misleading real-data label');
 assert.ok(s.includes('Tanggal snapshot'));
 assert.ok(s.includes('Belum diverifikasi lapangan'));
 assert.ok(s.includes('panorama terdekat'));
 assert.ok(!s.includes("val===true?'✓'"));
});
