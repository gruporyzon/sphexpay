let playedDuringThisAppBoot=false

/** A successful login in the current SPA boot is a new authenticated entry. */
export function markAuthEntrancePending(){playedDuringThisAppBoot=false}

/** Module memory resets on a full reload/PWA launch, but survives client-side routing. */
export function shouldPlayAuthEntrance(){return !playedDuringThisAppBoot}

export function consumeAuthEntrance(){playedDuringThisAppBoot=true}

export function clearAuthEntranceState(){playedDuringThisAppBoot=false}

export function resetAuthEntranceForTests(){playedDuringThisAppBoot=false}
