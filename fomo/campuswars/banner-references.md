# Fraternity banner references

Researched September 9, 2026. These are original Campus Wars compositions inspired by each national fraternity's public identity, not reproductions of its official flag or coat of arms. The school labels identify the registered chapters; no unverified chapter-specific branding is implied. The five membership counts still come from `chapters.json`.

| Chapter | Verified palette | Original banner direction | Primary references |
| --- | --- | --- | --- |
| Sigma Chi / San Diego State | Blue `#009DDC`, gold `#FFD24F`, white from the downloadable official flag; dark blue `#10334D` is an added legibility color | Blue cloth, gold lower band, oversized serif Greek letters, a seven-star accent, double border | [Official branding and flag artwork](https://sigmachi.org/home/resources-3/branding/), [flag SVG](https://sigmachi.org/wp-content/uploads/2019/10/SC_Flag_Full_Color.svg), [Governing Laws: blue/old gold, horizontal flag division, seven-star seal](https://sigmachi.org/home/resources-3/policies/governinglaws/) |
| Kappa Sigma / Coastal Carolina | Scarlet `#BF0D3E`, emerald `#215732`, white, gold accent `#C99700` | Scarlet diagonal sash on emerald, white piping, original star/crescent linework, gold rules | [Official branding guide, page 19](https://www.kappasigma.org/wp-content/uploads/2019/12/Official-Kappa-Sigma-Branding-Guide.pdf), [official logo resources announcement](https://www.kappasigma.org/new-kappa-sigma-logos/) |
| Phi Delta Theta / Tampa | Navy `#0D1433`, blue `#619CC7`, slate-white `#F8FAFC`, silver-gray `#CBD5E1` | Light academic standard with centered serif lettering, six blue stars, narrow side stripes and blue school ribbon | [Current identity color guide](https://brand.phideltatheta.org/color), [typography guide](https://brand.phideltatheta.org/typography), [current badge and six-star design guide](https://brand.phideltatheta.org/logo) |
| Phi Kappa Psi / Virginia Tech | Cardinal `#A6192E`, hunter green `#006341`, gold `#EAAA00`, white | Cardinal wings around a hunter-green center, original embroidered rose drawings, white membership cartouche | [Current brand toolkit](https://www.phikappapsi.com/media/brand-toolkit/), [official manual: colors and Jacqueminot rose](https://www.phikappapsi.com/wp-content/uploads/2021/03/The-Phi-Kappa-Psi-Manual.pdf), [1920–21 Shield archive: vertical red/green/red flag](https://www.phikappapsi.com/wp-content/uploads/2019/06/1920-21_vol41_no1-6.pdf) |
| Tau Kappa Epsilon / Tampa | Cherry `#AD2624`, gray `#919194`, black and white | Athletic houseplate: oversized block letters, clipped gray end, white diagonal piping and racing rules | [Official branding and houseplate resources](https://tke.org/resources/branding-and-standards/?permalink=branding-and-standards), [brand/style guide palette](https://cdn.tke.org/tkeorg/guides/TKE%20Brand%20And%20Style.pdf) |

Phi Kappa Psi's current toolkit says a brand refresh is underway; the colors above are the published palette available at the research date. The lettering uses existing Aeonik and system Georgia; it does not claim to reproduce licensed national brand typefaces.

## FOMO redesign — September 15, 2026

The current house banners use a shared near-black scorecard, the original eyes mark and large Greek letters. Each fraternity’s own colors fill the identity panel, diagonal accent and progress bar. Member counts stay visible alongside the existing $500 paid status after qualification. A progress bar measures the 80% target; roster percentages are omitted. The gallery includes a clearly labeled paid-state preview.

## Implementation and review

`village-banner-art.js` draws all five designs into local canvas textures. The production scene makes no requests to fraternity websites. Cloth geometry, hanging hardware, texture resolution, member totals, selection behavior and banner proportions are preserved. Phi Kappa Psi and TKE show their individual artwork on their construction-site banners as well.

`tests/banner-gallery.html` is a standalone visual review page using the same painter and real chapter data, at the five installed banner aspect ratios. It is not linked from the public landing page. Review it alongside the actual village to check small-text legibility and the effect of scene lighting.
