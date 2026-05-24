LEARNING_PROGRESS_QUERY = """
SELECT
    t.id,
    score,
    last_revised_at,
    last_learned_at
FROM
    backend_term t
    INNER JOIN backend_userlearningprogress l ON t.id = l.term_id
WHERE
    l.user_id = %s
    AND t.deck_id = %s;
"""
