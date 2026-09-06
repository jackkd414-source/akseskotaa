import { shell, footer, initShell, initLogout, loadVenues, categories, initAnimations } from './core.js?v=24';
import { fetchBusinesses, registerBusiness as apiRegisterBusiness } from './api.js?v=3';

/* ---------- Shell ---------- */
document.querySelector('#shell').innerHTML = shell('business');
document.querySelector('#footer').innerHTML = footer();
initShell();
initLogout();
initAnimations();

/* ---------- Helpers ---------- */
let SERVER_BUSINESSES = []; // diisi renderAll() dari /api/businesses
const bizNameById = (id) => SERVER_BUSINESSES.find(b => b.locationId === id)?.name || null;
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

const serviceLabels = {
    kursi_roda: 'Ramah kursi roda',
    tuna_netra: 'Layanan tuna netra',
    bahasa_isyarat: 'Bahasa isyarat',
    lansia: 'Nyaman untuk lansia'
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

/* Empty-state CTA: jump to the register tab */
document.addEventListener('click', e => {
    const jump = e.target.closest('[data-jump-register]');
    if (!jump) return;
    e.preventDefault();
    const registerTab = [...tabs].find(t => t.dataset.tab === 'register');
    if (registerTab) registerTab.click();
    $('#tab-register')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ---------- Leaderboard ---------- */
let leaderboardType = 'best';

function renderLeaderboard() {
    const isBest = leaderboardType === 'best';
    const data = SERVER_BUSINESSES; // skor dihitung server, sudah terurut
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
                <strong>${esc(b.name)}</strong>${b.accessible ? ` <span class="biz-accessible-badge">Aksesibel</span>` : ''}
                <small style="display:block;color:var(--muted)">${esc(categoryLabels[b.category] || b.category)}${b.services && b.services.length ? ' · ' + b.services.map(x => serviceLabels[x] || x).join(', ') : ''}</small>
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
    const businesses = SERVER_BUSINESSES.filter(b => (b.reviewCount || 0) > 0);
    const noMsg = $('#no-reviews-message');
    const list = $('#business-reviews-list');

    if (businesses.length === 0) {
        list.innerHTML = '';
        noMsg.style.display = 'block';
        return;
    }

    noMsg.style.display = 'none';

    let html = '';
    for (const biz of businesses) {
        html += `<div class="business-review-card">
            <div class="review-card-header">
                <div>
                    <strong>${esc(biz.name)}</strong>
                    <small style="display:block;color:var(--muted)">${biz.reviewCount} review · Rating rata-rata ${Number(biz.avgRating || 0).toFixed(1)}/5</small>
                </div>
                <span class="business-badge badge-${biz.badgeLevel || 'bronze'}">${badgeIcons[biz.badgeLevel || 'bronze']} ${badgeLabels[biz.badgeLevel || 'bronze']}</span>
            </div>
            <div class="review-card-features">
                <p style="color:var(--muted);font-size:.9rem;margin:0">Skor aksesibilitas ${biz.score}/100 dari audit komunitas yang disetujui.</p>
            </div>
        </div>`;
    }
    list.innerHTML = html;
}

/* ---------- Stats ---------- */
function renderStats() {
    const businesses = SERVER_BUSINESSES;
    const reviews = businesses.reduce((n, b) => n + (b.reviewCount || 0), 0);
    const improving = 0;

    $('#stat-total-businesses').textContent = businesses.length;
    $('#stat-total-reviews').textContent = reviews.length;
    $('#stat-improving').textContent = improving;
}

/* ---------- Render All ---------- */
async function renderAll() {
    try { SERVER_BUSINESSES = await fetchBusinesses(); } catch { SERVER_BUSINESSES = []; }
    renderLeaderboard();
    renderReviews();
    renderStats();
}

/* ---------- Init ---------- */
renderAll();

/* ---------- Isi dropdown lokasi peta ---------- */
(async () => {
    const sel = $('#biz-location');
    if (!sel) return;
    try {
        const venues = await loadVenues();
        const taken = new Set(SERVER_BUSINESSES.filter(b => b.locationId).map(b => b.locationId));
        sel.innerHTML = '<option value="">— Belum dikaitkan —</option>' +
            venues
                .filter(v => !taken.has(v.id))
                .map(v => `<option value="${esc(v.id)}">${esc(v.name)}</option>`)
                .join('');
    } catch {
        sel.innerHTML = '<option value="">Data lokasi gagal dimuat</option>';
    }
})();

/* ---------- Form pendaftaran usaha (server API) ---------- */
const bizForm = $('#business-register-form');
if (bizForm) {
    bizForm.addEventListener('submit', async e => {
        e.preventDefault();
        const msg = $('#biz-form-message');
        const btn = $('#biz-submit-btn');
        const services = [...document.querySelectorAll('input[name="biz-service"]:checked')].map(x => x.value);
        const payload = {
            name: $('#biz-name').value.trim(),
            address: $('#biz-address').value.trim(),
            category: $('#biz-category').value,
            ownerName: $('#biz-owner').value.trim(),
            ownerEmail: $('#biz-email').value.trim(),
            description: $('#biz-desc').value.trim(),
            locationId: $('#biz-location').value || null,
            services
        };
        btn.disabled = true; btn.textContent = 'Mendaftarkan…';
        msg.style.color = 'var(--muted)'; msg.textContent = '';
        try {
            const r = await apiRegisterBusiness(payload);
            if (r && r.ok) {
                msg.style.color = 'var(--green)';
                msg.textContent = services.length ? 'Usaha terdaftar — ditandai Aksesibel.' : 'Usaha terdaftar.';
                bizForm.reset();
                renderAll();
            } else {
                msg.style.color = 'var(--danger)';
                msg.textContent = (r && r.error) || 'Gagal mendaftar.';
            }
        } catch (err) {
            msg.style.color = 'var(--danger)';
            msg.textContent = err.message || 'Gagal menghubungi server.';
        } finally {
            btn.disabled = false; btn.textContent = 'Daftarkan Usaha';
        }
    });
}
