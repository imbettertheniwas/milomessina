# Geography sources

`us-states.json` is the unprojected `states-10m.json` topology from
[us-atlas 3](https://github.com/topojson/us-atlas), based on the U.S. Census
Bureau's 2017 cartographic boundary files. Alaska and Hawaii are repositioned
as insets when rendered. State geometry is unchanged in the source file.

Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

`schools.json` uses campus coordinates, municipality, state and institutional
identifiers from [NCES IPEDS HD2024](https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip).
Aliases reconcile the public chapter feed with the institution names. These are
campus locations, not chapter-house addresses. Visual themes are authored
campus-inspired interpretations; they are not surveys or replicas of real houses.

New schools remain searchable and visitable even before coordinates are added.
Add a verified institution record and its feed aliases to place it on the map.
Member counts always come from the public aggregate feed, never this catalog.
