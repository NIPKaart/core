# NIPKaart

NIPKaart helps people find accessible parking using community contributions, municipal data and offstreet facility information.

## Language

**ParkingSpace**: One physical accessible parking bay contributed by the community, subject to publication, verification and correction. Adjacent bays remain individual spaces.
_Avoid_: ParkingSpot, UserParkingSpot, UserparkingSpot

_In the interface_: Dutch copy calls every community or municipal place a "parkeerplaats" (officially "gehandicaptenparkeerplaats"), English copy a "parking space"; "plek" and "place" mean a location only. See `.ai/rules/locales.md`.

**ParkingSpaceConfirmation**: A signed-in person's dated confirmation that a published community or municipal parking place exists. It confirms existence only, not the under-sign, parking time, orientation, rules or availability. Older records may still carry a legacy dispute status or comment; those are not counted as confirmations.
_Avoid_: ParkingSpotConfirmation

**ParkingPlaceReport**: A signed-in person's report that a published community or municipal parking place no longer exists, with an optional note. It is a moderation signal, never a vote: it does not change what the map shows, and several reports only add context. A person has at most one open report per place.
_Avoid_: dispute, vote

**ParkingPlaceRemoval**: A moderator's attributable decision, with a reason from a fixed list and an optional note, to delete a reported community place or hide a reported municipal one. It keeps only the place's source, identity and label, because a removed community place is deleted with its confirmations, reports and favorites.

**Under-sign**: The additional sign (onderbord) below a disabled parking sign that adds conditions, such as a maximum parking duration or the days and times it applies. A ParkingSpace records whether one exists (yes, no, or not known), its literal text and, where known, a structured interpretation. Not knowing is never recorded as no.
_Avoid_: window times

**ParkingSpaceReview**: A moderator's attributable change of a community parking space's review status (pending, approved or rejected), kept as history. A rejection carries a reason from a fixed list and an optional note. It is the community-space form of a PublicationDecision.

**ParkingSpaceImprovement**: A signed-in person's proposed improvement to a published community ParkingSpace: its location, orientation, under-sign or note. The public space stays unchanged until a moderator approves it, possibly after correcting it; a rejection carries a reason from a fixed list. It keeps what was submitted, what was applied and what that replaced. Published community data belongs to the community, so anyone signed in may propose one; a person has one pending proposal per space. It improves NIPKaart's own community data only: a municipality's dataset is the source of truth for its places and is never corrected or overlaid by the community.
_Avoid_: edit, revision

**Moderation queue**: The one queue of community decisions a moderator works through: pending ParkingSpace submissions, pending ParkingSpaceImprovements and places with open ParkingPlaceReports (one item per place). Reports have high priority because they concern information the map already shows; everything else is normal. Within a priority the item that has waited longest comes first. What is known about a contributor is shown as context and never changes the order. Approving happens one item at a time; submissions and improvements may be rejected in bulk with one shared reason. Dataset and import work is not part of it.
_Avoid_: inbox items as a stored entity, moderation dashboard

**ParkingMunicipal**: A municipal/open-data parking record. Its source and meaning remain distinct from a community contribution.

**ParkingOffstreet**: A garage or park-and-ride facility with facility information and potentially live general occupancy. General occupancy does not establish accessible-space availability.

**ParkingRule**: A reference to parking rules for a municipality or an entire country.

**Favorite**: A user's saved reference to a parking option from any of the three sources.

**DatasetSource**: A dataset selected for connection to NIPKaart, with an identified publisher, scope and provenance. It is not a research lead or a contact-management record.

**SourceRecord**: What one dataset says about a parking place or facility, identified within that dataset. Multiple source records can describe the same physical place without becoming the same source.

**ParkingObservation**: A dated statement about particular properties of a parking place, with its method and supporting provenance. Its registration date does not establish when the place was observed.

**CorrectionProposal**: A proposed change to information about an existing community or imported parking record, with a reason and supporting observation.

**LocalCorrection**: An accepted correction whose value and justification remain distinct from the source's current statement.

**PublicationDecision**: An attributable decision about which information NIPKaart presents, including the reason and evidence on which it is based.

**ParkingRecordLink**: An assessed relationship between parking records, distinguishing records that describe the same place from a space located within a facility.
