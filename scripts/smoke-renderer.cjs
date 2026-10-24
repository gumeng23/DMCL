/* Renderer smoke test: mounts the production bundle in happy-dom and fails on the error boundary. */
const fs = require('node:fs');
const path = require('node:path');
const { Window } = require('happy-dom');

const page = process.argv[2] || 'home';
const window = new Window({ url: `http://localhost/?page=${page}` });
const root = window.document.createElement('div');
root.id = 'root';
window.document.body.appendChild(root);

global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.location = window.location;
global.HTMLElement = window.HTMLElement;
global.HTMLInputElement = window.HTMLInputElement;
global.Node = window.Node;
global.Element = window.Element;
global.Event = window.Event;
global.CustomEvent = window.CustomEvent;
global.getComputedStyle = window.getComputedStyle.bind(window);
global.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

const noop = async () => {};
const off = () => () => {};
const now = Date.now();
const settings = {
  gameRoot: 'F:\\amcluncher\\.smoke\\minecraft',
  javaPath: '',
  autoJava: true,
  memoryMb: 4096,
  minMemoryMb: 1024,
  jvmArgs: '',
  downloadSource: 'auto',
  downloadThreads: 12,
  closeAfterLaunch: false,
  minimizeOnLaunch: false,
  fullscreen: false,
  resolutionWidth: 1280,
  resolutionHeight: 720,
  msClientId: '',
  authlibInjectorPath: '',
  theme: process.env.SMOKE_THEME || 'dark',
  gameLanguage: 'zh_cn',
  skipAccessibility: true,
  skipMultiplayerWarning: true,
  showSnapshots: true,
  showOldVersions: false,
  checkGameFiles: false
};
const instance = {
  id: 'smoke-instance',
  name: '测试实例',
  versionId: '1.21.1',
  loader: 'vanilla',
  gameDir: 'F:\\amcluncher\\.smoke\\instance',
  memoryMb: null,
  javaPath: '',
  jvmArgs: '',
  theme: 'grass',
  createdAt: now,
  lastPlayed: now,
  totalPlayTime: 3600,
  notes: ''
};
const account = {
  id: 'smoke-account',
  kind: 'offline',
  name: 'Steve',
  uuid: '5627dd98e6be3c21b8a8e92344183641',
  skinModel: 'classic',
  createdAt: now,
  lastUsedAt: now
};
const installed = [
  {
    id: '1.21.1',
    type: 'release',
    loader: 'vanilla',
    baseVersion: '1.21.1',
    installedAt: now,
    hasJar: true,
    size: 0,
    javaMajor: 21
  }
];
const data = {
  settings,
  instances: [instance],
  accounts: [account],
  selectedInstanceId: instance.id,
  selectedAccountId: account.id,
  installedVersions: installed,
  javaRuntimes: [
    {
      path: 'C:\\Java\\bin\\java.exe',
      major: 21,
      version: '21.0.8',
      vendor: 'Eclipse Adoptium',
      arch: 'x86_64',
      source: 'detected',
      managed: false
    }
  ],
  appVersion: '1.0.0',
  platform: 'win32',
  paths: {
    userData: 'F:\\amcluncher\\.smoke',
    gameRoot: settings.gameRoot,
    instancesDir: 'F:\\amcluncher\\.smoke\\instances',
    cacheDir: 'F:\\amcluncher\\.smoke\\cache',
    logsDir: 'F:\\amcluncher\\.smoke\\logs',
    versionsDir: 'F:\\amcluncher\\.smoke\\minecraft\\versions',
    librariesDir: 'F:\\amcluncher\\.smoke\\minecraft\\libraries',
    assetsDir: 'F:\\amcluncher\\.smoke\\minecraft\\assets',
    runtimeDir: 'F:\\amcluncher\\.smoke\\minecraft\\runtime'
  },
  latestRelease: { id: '1.21.1', type: 'release', releaseTime: '2025-08-08T10:00:00Z' },
  latestSnapshot: { id: '25w42a', type: 'snapshot', releaseTime: '2025-10-15T10:00:00Z' },
  online: true,
  news: []
};

window.amc = {
  debugInitialPage: page,
  bootstrap: async () => data,
  refreshNews: async () => [],
  reportError: noop,
  systemInfo: async () => ({
    appVersion: '1.0.0',
    electron: '45.0.0',
    chrome: '142',
    node: '24',
    platform: 'win32',
    arch: 'x64',
    totalMemory: 34359738368,
    freeMemory: 17179869184,
    userData: data.paths.userData,
    gameRoot: settings.gameRoot
  }),
  window: { minimize: noop, toggleMaximize: async () => false, close: noop, isMaximized: async () => false },
  settings: {
    update: async (patch) => Object.assign(settings, patch),
    pickDirectory: async () => null,
    pickFile: async () => null
  },
  instances: {
    create: async () => instance,
    update: async (id, patch) => Object.assign(instance, patch),
    remove: noop,
    select: noop,
    openFolder: noop,
    duplicate: async () => instance
  },
  versions: {
    remote: async () => [
      { id: '1.21.1', type: 'release', releaseTime: '2025-08-08T10:00:00Z' },
      { id: '25w42a', type: 'snapshot', releaseTime: '2025-10-15T10:00:00Z' }
    ],
    installed: async () => installed,
    install: async () => ({ versionId: '1.21.1', loader: 'vanilla' }),
    remove: noop,
    loaders: async () => [],
    installLoader: async () => ({ versionId: '1.21.1' }),
    cancel: noop
  },
  java: {
    detect: async () => data.javaRuntimes,
    download: async () => data.javaRuntimes[0],
    openFolder: noop
  },
  accounts: {
    addOffline: async () => account,
    microsoftStart: async () => ({}),
    microsoftPoll: async () => account,
    authlibLogin: async () => account,
    refresh: async () => account,
    remove: noop,
    select: noop
  },
  mods: {
    list: async () => [],
    toggle: noop,
    remove: noop,
    import: async () => 0,
    openFolder: noop,
    search: async () => ({ hits: [], totalHits: 0, offset: 0, limit: 20 }),
    install: async () => ({ installed: [], skipped: [] }),
    cancel: noop
  },
  resources: {
    list: async () => [],
    toggle: noop,
    remove: noop,
    import: async () => 0,
    openFolder: noop
  },
  worlds: {
    list: async () => [],
    backup: async () => '',
    remove: noop,
    openFolder: noop,
    import: async () => 0
  },
  launch: { start: async () => ({ pid: 1 }), stop: noop, running: async () => [] },
  shell: { openPath: noop, openExternal: noop },
  events: {
    onTask: off,
    onLaunchState: off,
    onLaunchLog: off,
    onToast: off,
    onMaximizeChange: off,
    onAccountsChange: off
  }
};

const errors = [];
const originalError = console.error;
console.error = (...args) => {
  errors.push(args.map(String).join(' '));
  originalError(...args);
};

const assetsDir = path.join(__dirname, '..', 'out', 'renderer', 'assets');
const bundle = fs.readdirSync(assetsDir).find((name) => name.endsWith('.js'));
if (!bundle) throw new Error('renderer bundle not found; run npm run build first');

require(path.join(assetsDir, bundle));

setTimeout(() => {
  const text = document.body.textContent || '';
  const activeTheme = document.documentElement.dataset.theme;
  const crashed = text.includes('界面遇到了问题');
  const loading = text.includes('正在准备你的世界');
  console.log(`page=${page} theme=${activeTheme} crashed=${crashed} loading=${loading} length=${text.length}`);
  if (crashed || loading || errors.length || !activeTheme) {
    console.error('--- renderer smoke test failed ---');
    if (crashed) {
      const index = text.indexOf('界面遇到了问题');
      console.error(text.slice(index, index + 800));
    }
    for (const error of errors) console.error('console.error:', error);
    process.exit(1);
  }
  console.log('renderer smoke test passed');
  process.exit(0);
}, 1800);
