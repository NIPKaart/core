---
paths:
  - 'app/Models/Parking*.php'
---

# Models

## Keep community parking bays individually identifiable
Each community ParkingSpace represents one physical bay, including adjacent bays. Bulk submission and map clustering must preserve individual identities. Municipal and offstreet aggregate counts retain their source granularity; do not invent individual bay locations from counts. See docs/adr/0001-individual-community-parking-spaces.md.
