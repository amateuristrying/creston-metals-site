/**
 * Site content. Edit here — the page renders from these lists.
 * Grades shown are the typical market grades for each commodity;
 * confirm against what Creston actually stocks before launch.
 */

export const CONTACT_EMAIL = 'sales@crestonmetals.com';

export const metalSlug = (metal) => metal.name.toLowerCase().replace(/ & /g, ' and ').replace(/\s+/g, '-');
export const metalUrl = (metal) => `/metals/${metalSlug(metal)}/`;
export const metalPhoto = (metal, size) => `/images/metals/${metalSlug(metal)}-${size}.webp`;

export const METALS = [
  {
    family: 'Ferrous',
    items: [
      {
        sym: 'TMT',
        no: 'IS 1786',
        name: 'TMT Bars',
        photoAlt: 'Stacked TMT reinforcing bars with ribbed sides and round cut ends',
        forms: 'Rebar in 8 – 32 mm, straight or coiled',
        grade: 'Fe 500 · 500D · 550D',
        use: 'Foundations, columns, slabs',
      },
      {
        sym: 'HRC',
        no: 'IS 2062',
        name: 'HR & CR Coils',
        photoAlt: 'Dark hot rolled and bright cold rolled steel coils on warehouse cradles',
        forms: 'Hot and cold rolled coil, sheet and plate',
        grade: 'E250 · E350 · CRCA',
        use: 'Fabrication, tubes, auto',
      },
      {
        sym: 'BLT',
        no: 'IS 2830',
        name: 'Billets & Blooms',
        photoAlt: 'Square steel billets and larger blooms stacked on wooden supports',
        forms: 'Semi-finished steel for re-rolling',
        grade: 'Mild steel · Alloy',
        use: 'Rolling mills, forging',
      },
      {
        sym: 'STR',
        no: 'IS 2062',
        name: 'Structural Steel',
        photoAlt: 'Stack of structural steel I-beams viewed from the cut ends',
        forms: 'Beams, columns, angles, channels',
        grade: 'E250 · E350 · E450',
        use: 'Buildings, bridges, sheds',
      },
      {
        sym: 'SS',
        no: 'IS 6911',
        name: 'Stainless Steel',
        photoAlt: 'A stack of brushed stainless steel sheets with parallel edges',
        forms: 'Coil, sheet, plate and long products',
        grade: '304 · 316 · 202',
        use: 'Process plant, kitchens, rail',
      },
    ],
  },
  {
    family: 'Non-ferrous',
    items: [
      {
        sym: 'Cu',
        no: '29',
        name: 'Copper',
        photoAlt: 'Copper cathode plates beside rectangular copper busbars',
        forms: 'Cathodes, wire rod, busbar',
        grade: 'LME Grade A · 99.99%',
        use: 'Power, cabling, EVs',
      },
      {
        sym: 'Al',
        no: '13',
        name: 'Aluminium',
        photoAlt: 'Silver aluminium ingots stacked in alternating rows',
        forms: 'Ingots, billets, wire rod',
        grade: 'P1020 · 99.7%',
        use: 'Extrusions, castings, conductors',
      },
      {
        sym: 'Zn',
        no: '30',
        name: 'Zinc',
        photoAlt: 'Large cast zinc slabs with handling lugs',
        forms: 'Ingots and jumbo slabs',
        grade: 'SHG · 99.995%',
        use: 'Galvanising, die-casting',
      },
      {
        sym: 'Ni',
        no: '28',
        name: 'Nickel',
        photoAlt: 'Silver nickel briquettes in an industrial metal tray',
        forms: 'Cathodes and briquettes',
        grade: '99.8% min',
        use: 'Stainless, alloys, plating',
      },
      {
        sym: 'Pb',
        no: '82',
        name: 'Lead',
        photoAlt: 'Dark gray refined lead ingots stacked in a warehouse',
        forms: 'Refined ingots and alloys',
        grade: '99.97% · 99.99%',
        use: 'Batteries, cable sheathing',
      },
      {
        sym: 'Sn',
        no: '50',
        name: 'Tin',
        photoAlt: 'Bright silver tin ingots with lightly textured cast surfaces',
        forms: 'Ingots',
        grade: '99.9% min',
        use: 'Solder, tinplate, bronze',
      },
    ],
  },
];

export const INDUSTRIES = [
  { name: 'Infrastructure', desc: 'Bridges, flyovers, highways and metro corridors.' },
  { name: 'Construction', desc: 'Residential towers, commercial parks and industrial sheds.' },
  { name: 'Railways', desc: 'Track, rolling stock, stations and electrification.' },
  { name: 'Power & Energy', desc: 'Transmission, transformers, solar structures and wind.' },
  { name: 'Automotive', desc: 'Body, chassis, castings and the copper inside every EV.' },
  { name: 'Manufacturing', desc: 'Fabricators, foundries, re-rollers and OEM supply chains.' },
];
