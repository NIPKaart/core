<?php

return [
    'proposal' => [
        'standalone_added' => 'Parking space added.',
        'rejected' => 'Location proposal rejected.',
        'reopened' => 'Location proposal reopened.',
        'existing_required' => 'Select an existing parking space on the map.',
        'duplicates_reopened' => '{0} Nothing reopened.|{1} :count proposal reopened.|[2,*] :count proposals reopened.',
        'duplicate' => 'Place each bay at a different position.',
        'changed' => 'The proposal changed. Open it again and check the source points.',
        'invalid_point' => 'This bay must be near an active source point from this proposal.',
    ],
    'validation' => [
        'orientation_required' => 'Select an orientation for the parking space.',
        'orientation_invalid' => 'The selected orientation is invalid. Please select a valid option.',
    ],
    'contribute' => [
        'unresolved' => 'We could not find a municipality in a supported country here. Move the pin to the parking bay or try again.',
        'updated' => 'Your submission has been updated.',
    ],
    'confirm' => [
        'recorded' => 'Thank you, your confirmation has been recorded.',
        'already_today' => 'You already confirmed this parking space today.',
    ],
    'improve' => [
        'submitted' => 'Thank you. A moderator will review your improvement; the current information stays visible until then.',
        'already_pending' => 'You already proposed an improvement for this parking space. A moderator will look at it.',
        'unchanged' => 'You have not changed anything yet.',
    ],
    'report' => [
        'recorded' => 'Thank you. A moderator will look at your report; the parking space stays on the map until then.',
        'already_open' => 'You already reported this parking space. A moderator will look at it.',
    ],
    'moderation' => [
        'already_decided' => 'This item has already been decided.',
        'submission_approved' => 'The parking space is approved and on the map.',
        'submission_rejected' => 'The submission is rejected.',
        'items_rejected' => '{0} Nothing rejected; these items were already decided.|{1} :count item rejected.|[2,*] :count items rejected.',
        'improvement_approved' => 'The improvement has been applied.',
        'improvement_rejected' => 'The improvement has been rejected.',
        'kept' => 'The parking space stays on the map and its reports are closed.',
        'deleted' => 'The community parking space has been deleted.',
        'hidden' => 'The municipal parking space is hidden from the map.',
    ],
    'flash' => [
        'updated' => 'Parking space updated successfully.',
    ],
];
