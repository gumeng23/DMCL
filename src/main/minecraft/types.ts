export interface DownloadInfo {
  sha1: string
  size: number
  url: string
  path?: string
}

export interface AssetIndexInfo extends DownloadInfo {
  id: string
  totalSize: number
}

export interface VersionDownloads {
  client?: DownloadInfo
  server?: DownloadInfo
  client_mappings?: DownloadInfo
  server_mappings?: DownloadInfo
}

export interface LibraryDownloads {
  artifact?: DownloadInfo
  classifiers?: Record<string, DownloadInfo>
}

export interface OsRule {
  name?: 'windows' | 'osx' | 'linux'
  arch?: string
  version?: string
}

export interface Rule {
  action: 'allow' | 'disallow'
  os?: OsRule
  features?: Record<string, boolean>
}

export interface VersionLibrary {
  name: string
  url?: string
  downloads?: LibraryDownloads
  natives?: Record<string, string>
  rules?: Rule[]
  extract?: { exclude?: string[] }
}

export type ArgumentValue = string | { rules?: Rule[]; value: string | string[] }

export interface VersionArguments {
  game?: ArgumentValue[]
  jvm?: ArgumentValue[]
}

export interface LoggingFile extends DownloadInfo {
  id: string
}

export interface VersionLogging {
  client?: {
    argument?: string
    file?: LoggingFile
    type?: string
  }
}

export interface JavaVersionInfo {
  component?: string
  majorVersion: number
}

export interface VersionJson {
  id: string
  type: string
  inheritsFrom?: string
  mainClass: string
  jar?: string
  assets?: string
  assetIndex?: AssetIndexInfo
  downloads?: VersionDownloads
  libraries?: VersionLibrary[]
  arguments?: VersionArguments
  minecraftArguments?: string
  logging?: VersionLogging
  javaVersion?: JavaVersionInfo
  releaseTime?: string
  time?: string
  minimumLauncherVersion?: number
}

export interface VersionManifestEntry {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  time: string
  releaseTime: string
  sha1: string
  complianceLevel?: number
}

export interface VersionManifest {
  latest: {
    release: string
    snapshot: string
  }
  versions: VersionManifestEntry[]
}

export interface AssetObject {
  hash: string
  size: number
}

export interface AssetIndex {
  id: string
  objects: Record<string, AssetObject>
  virtual?: boolean
  map_to_resources?: boolean
}

export interface ResolvedVersion {
  id: string
  type: string
  mainClass: string
  jar: string
  assets: string
  assetIndex?: AssetIndexInfo
  downloads: VersionDownloads
  libraries: VersionLibrary[]
  arguments: VersionArguments
  minecraftArguments?: string
  logging?: VersionLogging
  javaVersion?: JavaVersionInfo
  inheritsFrom?: string
  chain: string[]
}
