# NIPKaart

NIPKaart helps people find accessible parking using community contributions, municipal data and offstreet facility information.

## Language

**ParkingSpace**: A community-contributed accessible parking space, subject to publication, verification and correction.
_Avoid_: ParkingSpot, UserParkingSpot, UserparkingSpot

**ParkingSpaceConfirmation**: A person's dated confirmation or dispute about a community parking space, optionally accompanied by a comment.
_Avoid_: ParkingSpotConfirmation

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
