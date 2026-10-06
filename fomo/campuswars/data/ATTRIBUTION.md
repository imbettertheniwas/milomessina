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

The October 2026 catalog expansion uses the same NCES directory for US campuses.
Canadian campus coordinates come from [Western's official map metadata](https://www.uwo.ca/about/visit/maps.html)
and the [Queen's official campus map link](https://www.queensu.ca/visit).
[Zeta Psi's Ontario directory](https://zetapsi.org/about/chapter-location/ontario/)
confirms these Canadian institutions. The feed's “Rowan College” Sigma Alpha Epsilon
entry is reconciled to Rowan University using its [official chapter directory](https://sites.rowan.edu/oslp/greekaffairs/chapters.html).
Each school has one pin at its verified campus coordinate. A pin opens the
campus block directly, without a chapter picker. Pins are not house addresses.

## School autocomplete (October 6, 2026)

`school-search-catalog.json` contains US and Canadian institution names, domains,
and supplied province/state labels from Hipo's University Domains and Names list:
https://github.com/Hipo/university-domains-list

The original license is retained in `school-search-LICENSE.txt`. These entries
expand school search beyond registered chapters. Existing curated campus identities
and aliases take precedence; additional campuses receive the generic starter
campus, without invented locations, logos, members, or chapters.

## Nationwide U.S. college autocomplete

`us-college-catalog.json` includes the 5,994 active (CYACTIVE = 1) institutions
in [NCES IPEDS HD2024](https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip).
It retains institution IDs, names, official IALIAS values, city/state, and public
websites. The source covers participating colleges, universities, and technical
and vocational institutions; the typed-name fallback remains available for
new institutions and those outside the directory. Shared names or web domains
do not collapse distinct federal campus IDs. Existing destination IDs remain
stable when an official name or alias matches. Initials are also derived from
institution names and aliases; ambiguous abbreviations offer multiple schools.
