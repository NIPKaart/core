<?php

return [
    // Contribution value and correctness evidence are separate inputs, never browser-facing scoring instructions.
    'contribution_values' => [
        'submission.approved' => (int) env('COMMUNITY_POINTS_NEW_SPACE_VALUE', 10),
        'improvement.approved' => (int) env('COMMUNITY_POINTS_IMPROVEMENT_VALUE', 5),
        'report.confirmed' => (int) env('COMMUNITY_POINTS_CONFIRMED_REPORT_VALUE', 3),
    ],

    'negative_evidence' => [
        'incorrect' => (float) env('COMMUNITY_POINTS_INCORRECT_EVIDENCE', 1),
        'spam' => (float) env('COMMUNITY_POINTS_SPAM_EVIDENCE', 5),
    ],

    // Equal positive/negative prior evidence tempers small samples without awarding community points to new accounts.
    'prior_evidence' => (float) env('COMMUNITY_POINTS_PRIOR_EVIDENCE', 2),
];
