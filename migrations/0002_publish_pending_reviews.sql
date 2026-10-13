UPDATE reviews
SET status = 'approved', reviewed_at = NULL
WHERE status = 'pending';
