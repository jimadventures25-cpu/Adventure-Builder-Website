# Adventure Builder — Trail Points of Interest Notes

## Goal
Connect the website Trail Planner and the mobile app so a planned walking route can include suggested places of interest along the trail.

## Website behaviour
After a trail is calculated, search within a controlled corridor around the route and suggest:
- viewpoints and lookouts
- waterfalls
- historic sites, ruins and monuments
- picnic areas
- cafés and pubs
- toilets
- parking
- campsites
- wildlife spots
- lakes, beaches and woodland

Users can:
- open a POI card for details
- add or remove the POI as a route waypoint
- save selected POIs with the trail
- send the complete trail and POI list to the app

## App behaviour
The app should:
- load the same saved trail
- display the route line and selected POIs
- preserve the waypoint order
- allow the user to start walking guidance
- later provide approach alerts such as “Viewpoint in 300 metres”

## Shared data model
Save through Supabase using one account across website and app.

Recommended trail record:
- route_id
- user_id
- title
- route_geometry (GeoJSON LineString)
- start_point
- end_point
- ordered_waypoints
- distance_m
- duration_s
- activity_type = pedestrian
- created_at / updated_at

Recommended POI selection record:
- route_id
- poi_id or source reference
- name
- category
- latitude
- longitude
- waypoint_order
- selected_by_user
- source
- optional description / image / opening details

## Technical plan
1. Website Trail Planner calculates route with Valhalla pedestrian routing.
2. POI module searches OpenStreetMap-derived data within a limited corridor around the route.
3. User selects which suggestions should become waypoints.
4. Website recalculates the route where needed.
5. Website saves route + selected POIs to Supabase.
6. “Open in Adventure Builder” sends only the route ID through a deep link.
7. App downloads the authoritative route record from Supabase.

## Modular files planned
Website:
- js/trail-planner.js — route planning only
- js/trail-poi-finder.js — search and rank nearby POIs
- js/trail-poi-ui.js — cards, filters and selection
- js/trail-sync.js — Supabase save and app hand-off

App:
- trail-route-loader module
- trail-poi-display module
- trail-approach-alerts module
- trail-off-route module

## Beta access
All Trail Planner and POI features remain free for registered beta testers. Future membership restrictions stay disabled during beta.

## Safety and privacy
- Do not automatically share exact user location publicly.
- Show source and last-updated details where available.
- Warn users to verify access, closures and local signs.
- Do not treat all mapped paths as guaranteed safe or legally accessible.
