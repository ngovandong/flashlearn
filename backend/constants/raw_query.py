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
    l.user_id = '{user_id}'
    AND t.deck_id = '{deck_id}';
"""
