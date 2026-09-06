import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateBusinessScore} from '../js/business-store.js';
test('public HTML has no lift controls or copy',()=>{for(const f of ['index','about','audit','admin','business','map'])assert.doesNotMatch(readFileSync(new URL('../'+f+'.html',import.meta.url),'utf8'),/\blift\b|elevator/i,f)});
test('four supported facilities alone yield full coverage',()=>{
 const store={akseskota_businesses:[{id:'b',locationId:'v'}],akseskota_business_reviews:[{businessId:'b',locationId:'v',rating:5,features:['wheelchair_ramp','accessible_restroom','tactile_paving','signage']}]};
 globalThis.localStorage={getItem:k=>JSON.stringify(store[k]||[])};
 const score=calculateBusinessScore('b');assert.equal(score.score,100);assert.equal('elevator' in score.featureScores,false);
});
