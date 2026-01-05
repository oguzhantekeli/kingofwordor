export const GAME_STATUSES = {
  WELCOME: 'welcome',
  INGAME: 'ingame',
  ENDGAME: 'endgame',
};

export const GAME_TYPES = {
  STANDARD: 'standard',
  LONGEST: 'longest',
  NOMISTAKE: 'nomistake',
};

export const TIMERS = {
  START_COUNTDOWN: 3,
  ONE_MINUTE: 60 * 1,
  THREE_MINUTE: 60 * 3,
  FIVE_MINUTE: 60 * 5,
};

export const HEADER = {
  APP_TITLE: 'King of Wordor',
  DONATE_TEXT: 'DONATE',
  SETTINGS_ICON: {
    WIDTH: 16,
    HEIGHT: 16,
    COLOR: '#bb6736',
    TITLE: 'Settings',
  },
};

export const DEFAULT_SETTINGS = {
  SOUND_ENABLED: true,
  USER_NAME: '',
  AVATAR: '',
  THEME: 'light',
};

export const DICTIONARY_API_BASE_URL =
  'https://api.dictionaryapi.dev/api/v2/entries/en';

export const RULES = {
  CONDITIONS: ['starts with', 'ends with', 'includes'],
  LETTERS: 'abcdefghijklmnopqrstuvwxyz',
  POSSIBLE_STARTS: {
    a: '53000',
    b: '44000',
    c: '67000',
    d: '43000',
    e: '31000',
    f: '27000',
    g: '26000',
    h: '34000',
    i: '25000',
    j: '6300',
    k: '13000',
    l: '23000',
    m: '53000',
    n: '29000',
    o: '23000',
    p: '70000',
    q: '4300',
    r: '36000',
    s: '79000',
    t: '40000',
    u: '25000',
    v: '12000',
    w: '15000',
    x: '1900',
    y: '3500',
    z: '4200',
  },
  POSSIBLE_ENDS: {
    a: '26000',
    b: '1900',
    c: '24000',
    d: '61000',
    e: '98000',
    f: '2000',
    g: '40000',
    h: '12000',
    i: '8500',
    j: '210',
    k: '7300',
    l: '32000',
    m: '16000',
    n: '53000',
    o: '7400',
    p: '4700',
    q: '230',
    r: '35000',
    s: '260000',
    t: '34000',
    u: '2000',
    v: '680',
    w: '1900',
    x: '2200',
    y: '51000',
    z: '1100',
  },
  // Word counts for words containing each letter (approximate from English dictionary)
  POSSIBLE_INCLUDES: {
    a: '180000',
    b: '52000',
    c: '98000',
    d: '78000',
    e: '230000',
    f: '36000',
    g: '58000',
    h: '72000',
    i: '175000',
    j: '8500',
    k: '24000',
    l: '120000',
    m: '68000',
    n: '155000',
    o: '145000',
    p: '85000',
    q: '5200',
    r: '160000',
    s: '195000',
    t: '165000',
    u: '95000',
    v: '28000',
    w: '32000',
    x: '8900',
    y: '62000',
    z: '12000',
  },
};
