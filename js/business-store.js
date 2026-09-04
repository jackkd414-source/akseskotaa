/* ================================================
   AksesKota — Business Store Module
   ================================================
   Manages:
   - Business registration & profiles
   - Accessibility review history per business
   - Business accessibility score calculation
   - Business leaderboard data
   ================================================ */

const STORAGE_KEYS = {
    businesses: 'akseskota_businesses',
    businessReviews: 'akseskota_business_reviews',
    businessHistory: 'akseskota_business_history'
};

/* ---------- Internal Helpers ---------- */

function get(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
}

function set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------- Business Management ---------- */

/**
 * Get all registered businesses.
 * @returns {Array<Object>}
 */
export function getBusinesses() {
    return get(STORAGE_KEYS.businesses, []);
}

/**
 * Get a single business by ID.
 * @param {string} id
 * @returns {Object|null}
 */
export function getBusiness(id) {
    const businesses = getBusinesses();
    return businesses.find(b => b.id === id) || null;
}

/**
 * Register a new business.
 * @param {Object} data - { name, address, ownerName, ownerEmail, category, description }
 * @returns {{ ok: boolean, business?: Object, error?: string }}
 */
export function registerBusiness({ name, address, ownerName, ownerEmail, category, description }) {
    const businesses = getBusinesses();

    // Validate
    if (!name || name.trim().length < 2) {
        return { ok: false, error: 'Nama usaha harus minimal 2 karakter.' };
    }
    if (!address || address.trim().length < 5) {
        return { ok: false, error: 'Alamat usaha harus minimal 5 karakter.' };
    }
    if (!ownerEmail || !ownerEmail.includes('@')) {
        return { ok: false, error: 'Email pemilik tidak valid.' };
    }

    const business = {
        id: uid('business'),
        name: name.trim(),
        address: address.trim(),
        ownerName: (ownerName || '').trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        category: category || 'general',
        description: (description || '').trim(),
        isBusiness: true,
        registeredAt: new Date().toISOString(),
        verified: false,
        badgeLevel: 'bronze' // bronze, silver, gold, platinum
    };

    businesses.push(business);
    set(STORAGE_KEYS.businesses, businesses);

    return { ok: true, business };
}

/**
 * Update business profile.
 * @param {string} id
 * @param {Object} updates
 * @returns {Object|null}
 */
export function updateBusiness(id, updates) {
    const businesses = getBusinesses();
    const index = businesses.findIndex(b => b.id === id);
    if (index < 0) return null;

    businesses[index] = { ...businesses[index], ...updates, updatedAt: new Date().toISOString() };
    set(STORAGE_KEYS.businesses, businesses);
    return businesses[index];
}

/**
 * Delete a business registration.
 * @param {string} id
 */
export function deleteBusiness(id) {
    const businesses = getBusinesses();
    set(STORAGE_KEYS.businesses, businesses.filter(b => b.id !== id));
}

/* ---------- Accessibility Reviews ---------- */

/**
 * Get all reviews for a specific business/location.
 * @param {string} locationId
 * @returns {Array<Object>}
 */
export function getBusinessReviews(locationId) {
    const all = get(STORAGE_KEYS.businessReviews, []);
    return all.filter(r => r.locationId === locationId);
}

/**
 * Get all business reviews.
 * @returns {Array<Object>}
 */
export function getAllBusinessReviews() {
    return get(STORAGE_KEYS.businessReviews, []);
}

/**
 * Add an accessibility review for a business.
 * Called automatically when an audit is approved for a business location.
 * @param {Object} review - { locationId, businessId, rating, features, reviewerName, auditId }
 */
export function addBusinessReview(review) {
    const reviews = get(STORAGE_KEYS.businessReviews, []);
    if (review.auditId) {
        const existing = reviews.find(r => r.auditId === review.auditId);
        if (existing) return existing;
    }
    const entry = {
        id: uid('review'),
        locationId: review.locationId,
        businessId: review.businessId || null,
        rating: review.rating,
        features: review.features || [],
        reviewerName: review.reviewerName || 'Anonim',
        auditId: review.auditId || null,
        timestamp: new Date().toISOString()
    };
    reviews.push(entry);
    set(STORAGE_KEYS.businessReviews, reviews);

    // Update business score
    if (entry.businessId) {
        recalculateBusinessScore(entry.businessId);
    }

    return entry;
}

/**
 * Calculate accessibility score for a business based on all its reviews.
 * @param {string} businessId
 * @returns {Object} { score, avgRating, reviewCount, trend, featureScores }
 */
export function calculateBusinessScore(businessId) {
    const business = getBusiness(businessId);
    if (!business) return { score: 0, avgRating: 0, reviewCount: 0, trend: 'stable', featureScores: {} };

    const reviews = business.locationId ? getBusinessReviews(business.locationId) : [];
    if (reviews.length === 0) {
        return { score: 0, avgRating: 0, reviewCount: 0, trend: 'stable', featureScores: {} };
    }

    // Calculate average rating
    const avgRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;

    // Calculate feature availability
    const featureCounts = {};
    const features = ['wheelchair_ramp', 'elevator', 'accessible_restroom', 'tactile_paving', 'signage'];
    features.forEach(f => {
        const available = reviews.filter(r => r.features && r.features.includes(f)).length;
        featureCounts[f] = reviews.length > 0 ? Math.round((available / reviews.length) * 100) : 0;
    });

    // Calculate overall score (0-100)
    // Rating (60% weight) + Feature coverage (40% weight)
    const ratingScore = (avgRating / 5) * 60;
    const featureCoverage = Object.values(featureCounts).reduce((s, v) => s + v, 0) / features.length;
    const featureScore = (featureCoverage / 100) * 40;
    const score = Math.round(ratingScore + featureScore);

    // Calculate trend (compare first half vs second half reviews)
    let trend = 'stable';
    if (reviews.length >= 4) {
        const mid = Math.floor(reviews.length / 2);
        const firstHalf = reviews.slice(0, mid);
        const secondHalf = reviews.slice(mid);
        const avgFirst = firstHalf.reduce((s, r) => s + (r.rating || 0), 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, r) => s + (r.rating || 0), 0) / secondHalf.length;
        const diff = avgSecond - avgFirst;
        if (diff > 0.3) trend = 'improving';
        else if (diff < -0.3) trend = 'declining';
    }

    return { score, avgRating: Math.round(avgRating * 10) / 10, reviewCount: reviews.length, trend, featureScores: featureCounts };
}

/**
 * Recalculate and save business score.
 * @param {string} businessId
 */
function recalculateBusinessScore(businessId) {
    const result = calculateBusinessScore(businessId);
    const businesses = getBusinesses();
    const index = businesses.findIndex(b => b.id === businessId);
    if (index < 0) return;

    // Update badge level based on score
    let badgeLevel = 'bronze';
    if (result.score >= 85) badgeLevel = 'platinum';
    else if (result.score >= 70) badgeLevel = 'gold';
    else if (result.score >= 50) badgeLevel = 'silver';

    businesses[index] = {
        ...businesses[index],
        score: result.score,
        avgRating: result.avgRating,
        reviewCount: result.reviewCount,
        trend: result.trend,
        featureScores: result.featureScores,
        badgeLevel,
        lastReviewedAt: new Date().toISOString()
    };
    set(STORAGE_KEYS.businesses, businesses);

    // Save history snapshot
    saveHistorySnapshot(businessId, result);
}

/**
 * Save a score snapshot for history tracking.
 */
function saveHistorySnapshot(businessId, scoreData) {
    const history = get(STORAGE_KEYS.businessHistory, []);
    history.push({
        businessId,
        score: scoreData.score,
        avgRating: scoreData.avgRating,
        timestamp: new Date().toISOString()
    });
    // Keep last 100 snapshots per business
    const filtered = history.filter(h => h.businessId === businessId).slice(-100);
    const others = history.filter(h => h.businessId !== businessId);
    set(STORAGE_KEYS.businessHistory, [...others, ...filtered]);
}

/* ---------- Leaderboard ---------- */

/**
 * Get business leaderboard sorted by accessibility score.
 * @returns {Array<Object>}
 */
export function getBusinessLeaderboard() {
    const businesses = getBusinesses();
    const leaderboard = businesses
        .filter(b => !b.deleted)
        .map(b => ({
            id: b.id,
            name: b.name,
            category: b.category,
            score: b.score || 0,
            avgRating: b.avgRating || 0,
            reviewCount: b.reviewCount || 0,
            trend: b.trend || 'stable',
            badgeLevel: b.badgeLevel || 'bronze',
            locationId: b.locationId
        }))
        .sort((a, b) => b.score - a.score);
    return leaderboard;
}

/**
 * Get businesses sorted by most improved accessibility.
 * @returns {Array<Object>}
 */
export function getMostImprovedBusinesses() {
    const history = get(STORAGE_KEYS.businessHistory, []);
    const businesses = getBusinesses();

    // Calculate improvement for each business
    const improvements = businesses
        .filter(b => !b.deleted)
        .map(b => {
            const snapshots = history.filter(h => h.businessId === b.id).sort((a, c) => new Date(a.timestamp) - new Date(c.timestamp));
            let improvement = 0;
            let currentScore = b.score || 0;

            if (snapshots.length >= 2) {
                const firstScore = snapshots[0].score;
                improvement = currentScore - firstScore;
            } else if (snapshots.length === 1) {
                improvement = currentScore - snapshots[0].score;
            }

            return {
                id: b.id,
                name: b.name,
                category: b.category,
                score: currentScore,
                avgRating: b.avgRating || 0,
                reviewCount: b.reviewCount || 0,
                trend: b.trend || 'stable',
                badgeLevel: b.badgeLevel || 'bronze',
                improvement,
                locationId: b.locationId
            };
        })
        .sort((a, b) => b.improvement - a.improvement);

    return improvements;
}

/* ---------- Seed Data ---------- */

/**
 * Initialize with seed business data for demo purposes.
 */
/**
 * Legacy migration: earlier builds shipped demo businesses pinned to
 * placeholder IDs (v002, v014, ...) that no longer exist in the OSM dataset.
 * Any leftover record on a visitor's device is unusable, so it is removed.
 */
export function migrateSeedBusinessLocations(){
    const legacyIds=['v002','v014','v019','v025','v033','v035'];
    const businesses=getBusinesses();
    const cleaned=businesses.filter(b=>!String(b.id||'').startsWith('business-seed-')&&!legacyIds.includes(b.locationId));
    if(cleaned.length!==businesses.length){
        const removedIds=businesses.filter(b=>!cleaned.includes(b)).map(b=>b.id);
        set(STORAGE_KEYS.businesses,cleaned);
        const history=get(STORAGE_KEYS.businessHistory,[]).filter(h=>!removedIds.includes(h.businessId));
        set(STORAGE_KEYS.businessHistory,history);
        const reviews=get(STORAGE_KEYS.businessReviews,[]).filter(r=>!removedIds.includes(r.businessId));
        set(STORAGE_KEYS.businessReviews,reviews);
        return true;
    }
    return false;
}

/**
 * No demo businesses are seeded. Every business on the leaderboard must be
 * registered by a real owner and scored from approved community audits.
 * Kept as an exported no-op so existing callers stay valid.
 */
export function seedBusinessData(){
    return false;
}

/* ---------- Utility ---------- */

export function isBusinessLocation(locationId) {
    const businesses = getBusinesses();
    return businesses.some(b => b.locationId === locationId && !b.deleted);
}

export function getBusinessForLocation(locationId) {
    const businesses = getBusinesses();
    return businesses.find(b => b.locationId === locationId && !b.deleted) || null;
}

export function resetBusinessData() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
}
