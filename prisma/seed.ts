import prisma from '../src/config/prisma';

// Complete provider map: ID -> real name
const KNOWN_PROVIDERS: Record<string, string> = {
  '1':   'BetSoft',
  '3':   'TomHorn',
  '4':   'PragmaticPlay',
  '6':   'Spinomenal',
  '7':   'Fugaso',
  '8':   'BGaming',
  '12':  'Yggdrasil',
  '25':  'Playson',
  '26':  'Evoplay Entertainment',
  '28':  'Felix',
  '29':  '3Oaks',
  '30':  'Ruby Play',
  '32':  'BetSolutions',
  '33':  'Amusnet',
  '36':  'Ygg-Rabcat',
  '37':  'Ygg-AvatarUX',
  '38':  'Ygg-4ThePlayer',
  '39':  'Ygg-TrueLab',
  '40':  'Ygg-Reflex Gaming',
  '41':  'Ygg-ReelPlay',
  '42':  'Ygg-Bang Bang Games',
  '43':  'Ygg-Peter & Sons',
  '44':  'Ygg-Jade Rabbit',
  '45':  'Ygg-Bad Dingo',
  '46':  'Ygg-Degen',
  '47':  'Ygg-Boomerang',
  '48':  'Ygg-Bulletproof Games',
  '49':  'Ygg-BB Games',
  '50':  'Ygg-Reel Life Gaming',
  '51':  'Ygg-GameVy',
  '52':  'Ygg-Jelly',
  '53':  'Vivo',
  '54':  'Ygg-Darwin Gaming',
  '55':  'InbetGames',
  '56':  'Ygg-Solvited',
  '57':  'Ygg-Ygg',
  '58':  'TurboGames',
  '59':  'Ygg-AceRun',
  '60':  'Ygg-Thunderbolt Gaming',
  '62':  'RedRake',
  '63':  'LuckyMonaco',
  '64':  'PGSoft',
  '65':  'Ygg-Hungry Bear Gaming',
  '66':  'Aviatrix',
  '67':  'Ygg-Spin On',
  '69':  'Playnetic',
  '70':  'Rogue',
  '71':  'Reevo',
  '72':  'Ethereal',
  '74':  'EGT Digital',
  '76':  'AvatarUX',
  '78':  'Spribe',
  '79':  'Ygg-Bitpunch',
  '80':  'Rival',
  '81':  'Eurasian',
  '82':  'Gaming Corps',
  '83':  'TaDa Gaming',
  '85':  'StakeLogic',
  '86':  'Habanero',
  '87':  'Evolution',
  '88':  'Booongo',
  '90':  'Kalamba',
  '91':  'KingMidas',
  '93':  'Peter And Sons',
  '94':  'Amusnet Live',
  '95':  'Ygg-Neotopia',
  '96':  'Ygg-Degen',
  '97':  'Wazdan',
  '98':  'PlayNGo',
  '99':  'PopOk',
  '100': 'Ygg-BlackCat',
  '101': 'InOut Games',
  '102': '77 Gaming',
  '103': 'Ygg-Dreamspin',
  '104': 'Popiplay',
  '105': 'Skywind',
  '107': 'Ygg-Lakkastudios',
  '108': 'Fizzy Bubbly',
  '109': 'PragmaticPlay2',
  '110': 'Aviator LLC',
  '111': 'AccaMax',
};

async function seedProviders() {
  console.log('Seeding providers...');

  for (const [id, name] of Object.entries(KNOWN_PROVIDERS)) {
    await prisma.provider.upsert({
      where: { id },
      update: { name },
      create: { id, name },
    });
    console.log(`  ✔ Provider ${id} -> "${name}"`);
  }

  console.log(`Seed complete. ${Object.keys(KNOWN_PROVIDERS).length} providers processed.`);
}

seedProviders()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
