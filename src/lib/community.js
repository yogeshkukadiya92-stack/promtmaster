const REVIEW_KEY = "intentos-marketplace-reviews-v1";
const REPORT_KEY = "intentos-marketplace-reports-v1";
const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
export const loadReviews = () => read(REVIEW_KEY);
export const loadReports = () => read(REPORT_KEY);
export const saveReviews = (items) => localStorage.setItem(REVIEW_KEY, JSON.stringify(items));
export const saveReports = (items) => localStorage.setItem(REPORT_KEY, JSON.stringify(items));
export const averageRating = (asset, reviews) => {
  const items = reviews.filter((review) => review.assetId === asset.id);
  if (!items.length) return asset.rating;
  return Number(((asset.rating * 4 + items.reduce((sum, item) => sum + item.rating, 0)) / (4 + items.length)).toFixed(1));
};
