<?php

return [
    // Contribution value and correctness evidence are separate inputs, never browser-facing scoring instructions.
    'contribution_values' => [
        'submission.approved' => (int) env('REPUTATION_NEW_SPACE_VALUE', 10),
        'improvement.approved' => (int) env('REPUTATION_IMPROVEMENT_VALUE', 5),
        'report.confirmed' => (int) env('REPUTATION_CONFIRMED_REPORT_VALUE', 3),
    ],

    'negative_evidence' => [
        'incorrect' => (float) env('REPUTATION_INCORRECT_EVIDENCE', 1),
        'spam' => (float) env('REPUTATION_SPAM_EVIDENCE', 5),
    ],

    // Equal positive/negative prior evidence tempers small samples without awarding reputation to new accounts.
    'prior_evidence' => (float) env('REPUTATION_PRIOR_EVIDENCE', 2),
];
