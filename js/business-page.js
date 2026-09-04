import { shell, footer, initShell, initLogout, loadVenues, categories, initAnimations } from './core.js';
import {
    getBusinesses,
    getBusinessLeaderboard,
    getMostImprovedBusinesses,
    getAllBusinessReviews,
    registerBusiness,
    seedBusinessData,
    getBusinessReviews,
    getBusinessForLocation,
    migrateSeedBusinessLocations
} from './business-store.js';

/* ---------- Shell ---------- */
document.querySelector('#shell').innerHTML = shell('business');
document.querySelector('#footer').innerHTML = footer();
initShell();
initLogout();
initAnimations();

/* ---------- Seed Data ---------- */
seedBusinessData();
migrateSeedBusinessLocations();

/* ---------- Helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

const badgeIcons = { platinum:'P', gold:'G', silver:'S', bronze:'B' };
const badgeLabels = { platinum: 'Platinum', gold: 'Emas', silver: 'Perak', bronze: 'Perunggu' };
const trendIcons = { improving: 'Naik', declining: 'Turun', stable: 'Stabil' };
const trendLabels = { improving: 'Berkembang', declining: 'Menurun', stable: 'Stabil' };

const categoryLabels = {
    general: 'Umum', cafe: 'Kafe', food: 'Makanan', retail: 'Retail',
    healthcare: 'Kesehatan', services: 'Jasa', automotive: 'Otomotif',
    education: 'Pendidikan', hospitality: 'Hotel'
};

function renderStars(rating) {
    return rating.toFixed(1);
}

/* ---------- Tab Navigation ---------- */
const tabs = document.querySelectorAll('#business-tabs .chip');
const tabContents = document.querySelectorAll('.business-tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        tabContents.forEach(c => c.style.display = 'none');
        $(`#tab-${target}`).style.display = 'block';
    });
});

/* ---------- Leaderboard ---------- */
let leaderboardType = 'best';

function renderLeaderboard() {
    const isBest = leaderboardType === 'best';
    const data = isBest ? getBusinessLeaderboard() : getMostImprovedBusinesses();
    const tbody = $('#business-leaderboard-body');
    const noMsg = $('#no-business-message');

    if (data.length === 0) {
        tbody.innerHTML = '';
        noMsg.style.display = 'block';
        return;
    }

    noMsg.style.display = 'none';
    tbody.innerHTML = data.map((b, i) => {
        const rank = i + 1;
        const badge = badgeIcons[b.badgeLevel] || 'B';
        const improvementStr = !isBest && b.improvement > 0 ? `+${b.improvement}` : '';
        const trendStr = trendIcons[b.trend] || '';
        return `<tr>
            <td class="rank">${rank}</td>
            <td>
                <strong>${esc(b.name)}</strong>
                <small style="display:block;color:var(--muted)">${esc(categoryLabels[b.category] || b.category)}</small>
            </td>
            <td><span class="business-badge badge-${b.badgeLevel}">${badge} ${badgeLabels[b.badgeLevel]}</span></td>
            <td><strong>${b.score}</strong> ${improvementStr ? `<small style="color:var(--green)">${improvementStr}</small>` : ''}</td>
            <td><span style="color:var(--amber)">${renderStars(b.avgRating)}</span></td>
            <td>${b.reviewCount} <small style="color:var(--muted)">${trendStr}</small></td>
        </tr>`;
    }).join('');
}

/* ---------- Leaderboard Type Tabs ---------- */
document.querySelectorAll('#leaderboard-type-tabs .chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('#leaderboard-type-tabs .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        leaderboardType = chip.dataset.type;
        renderLeaderboard();
    });
});

/* ---------- Reviews ---------- */
function renderReviews() {
    const reviews = getAllBusinessReviews().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const businesses = getBusinesses();
    const noMsg = $('#no-reviews-message');
    const list = $('#business-reviews-list');

    if (reviews.length === 0) {
        list.innerHTML = '';
        noMsg.style.display = 'block';
        return;
    }

    noMsg.style.display = 'none';

    // Group reviews by business
    const grouped = {};
    reviews.forEach(r => {
        if (!grouped[r.locationId]) grouped[r.locationId] = [];
        grouped[r.locationId].push(r);
    });

    let html = '';
    for (const [locId, locReviews] of Object.entries(grouped)) {
        const biz = getBusinessForLocation(locId);
        const bizName = biz ? biz.name : locId;
        const avgRating = locReviews.reduce((s, r) => s + (r.rating || 0), 0) / locReviews.length;

        html += `<div class="business-review-card">
            <div class="review-card-header">
                <div>
                    <strong>${esc(bizName)}</strong>
                    <small style="display:block;color:var(--muted)">${locReviews.length} review · Rating rata-rata ${avgRating.toFixed(1)}/5</small>
                </div>
                <span class="business-badge badge-${biz?.badgeLevel || 'bronze'}">${badgeIcons[biz?.badgeLevel || 'bronze']} ${badgeLabels[biz?.badgeLevel || 'bronze']}</span>
            </div>
            <div class="review-card-features">
                ${locReviews.slice(-3).map(r => {
                    const features = (r.features || []).map(f => {
                        const labels = { wheelchair_ramp: 'Rampa', elevator: 'Lift', accessible_restroom: 'Toilet', tactile_paving: 'Taktil', signage: 'Rambu' };
                        return `<span class="feature-tag">${labels[f] || f}</span>`;
                    }).join('');
                    return `<div class="review-mini">
                        <span style="color:var(--amber)">${renderStars(r.rating)}</span>
                        <small style="color:var(--muted)">${new Date(r.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</small>
                        <div class="review-features-row">${features}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    list.innerHTML = html;
}

/* ---------- Register Business ---------- */
$('#business-register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = $('#biz-form-message');

    const result = registerBusiness({
        name: $('#biz-name').value,
        address: $('#biz-address').value,
        category: $('#biz-category').value,
        ownerName: $('#biz-owner').value,
        ownerEmail: $('#biz-email').value,
        description: $('#biz-desc').value
    });

    if (result.ok) {
        msg.textContent = 'Usaha berhasil didaftarkan!';
        msg.style.color = 'var(--green)';
        msg.style.background = 'var(--mint)';
        msg.style.padding = '8px 14px';
        msg.style.borderRadius = '8px';
        $('#business-register-form').reset();
        renderAll();
    } else {
        msg.textContent = `${result.error}`;
        msg.style.color = 'var(--danger)';
        msg.style.background = '#fdf2f1';
        msg.style.padding = '8px 14px';
        msg.style.borderRadius = '8px';
    }
});

/* ---------- Stats ---------- */
function renderStats() {
    const businesses = getBusinesses();
    const reviews = getAllBusinessReviews();
    const improving = businesses.filter(b => b.trend === 'improving').length;

    $('#stat-total-businesses').textContent = businesses.length;
    $('#stat-total-reviews').textContent = reviews.length;
    $('#stat-improving').textContent = improving;
}

/* ---------- Render All ---------- */
function renderAll() {
    renderLeaderboard();
    renderReviews();
    renderStats();
}

/* ---------- Init ---------- */
renderAll();
