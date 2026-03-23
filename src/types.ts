export interface ImageInfo {
  filename: string;
  path: string;
  width: number;
  height: number;
  size: number;
  format: string;
  thumbnail_base64: string;
  error?: string | null;
}

export interface ScanProgress {
  current: number;
  total: number;
  filename: string;
  status: "processing" | "done" | "error";
}

export interface ThumbnailHydrationProgress {
  loaded: number;
  failed: number;
  completed: number;
  total: number;
  currentPath: string | null;
}

export interface Preset {
  category: string;
  name: string;
  width: number;
  height: number;
  suffix: string;
}

export interface ConvertJob {
  width: number;
  height: number;
  quality: number;
  format: string;
  resize_mode: string;
  suffix: string;
}

export interface ConvertRequest {
  files: string[];
  jobs: ConvertJob[];
  output_dir: string;
  naming_pattern?: string | null;
  profile_name?: string | null;
}

export interface ConvertProgress {
  current: number;
  total: number;
  filename: string;
  status: "processing" | "done" | "error";
  input_size: number;
  output_size: number;
}

export interface FileResult {
  filename: string;
  source_path: string;
  success: boolean;
  input_size: number;
  output_size: number;
  output_path: string;
  error: string | null;
}

export interface ConvertSummary {
  total_files: number;
  total_operations: number;
  successful: number;
  failed: number;
  total_input_size: number;
  total_output_size: number;
  results: FileResult[];
}

export interface EstimateConvertRequest {
  path: string;
  job: ConvertJob;
}

export interface EstimateConvertResult {
  path: string;
  input_size: number;
  estimated_output_size: number;
  estimated_savings_percent: number;
}

export type OutputFormat = "webp" | "jpeg" | "png" | "avif";
export type ResizeMode = "cover" | "fit";

export interface OptimizeSettings {
  activePresetKeys: string[];
  customWidth: number;
  customHeight: number;
  useCustom: boolean;
  format: OutputFormat;
  quality: number;
  resizeMode: ResizeMode;
  namingPattern: string;
}

export interface OptimizeProfile {
  id: string;
  name: string;
  outputPath: string | null;
  settings: OptimizeSettings;
  updatedAtMs: number;
}

export interface SaveOptimizeProfileRequest {
  id?: string | null;
  name: string;
  outputPath: string | null;
  settings: OptimizeSettings;
}

export interface ExportOptimizeProfilesRequest {
  destinationPath: string;
  profileIds: string[];
}

export interface ImportOptimizeProfilesRequest {
  sourcePaths: string[];
}

export interface OptimizeProfileExportEntry {
  name: string;
  outputPath: string | null;
  settings: OptimizeSettings;
}

export interface OptimizeProfilesExportDocument {
  version: number;
  exportedAt: number;
  profiles: OptimizeProfileExportEntry[];
}

export interface OptimizeProfileImportFailure {
  sourcePath: string;
  error: string;
}

export interface ImportOptimizeProfilesResult {
  profiles: OptimizeProfile[];
  importedProfiles: OptimizeProfile[];
  importedCount: number;
  failedFiles: OptimizeProfileImportFailure[];
}

export interface WordPressComponentPreset {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  suffix: string;
  defaultEnabled?: boolean;
}

export interface WordPressThemeProfile {
  id: string;
  name: string;
  description: string;
  note: string;
  components: WordPressComponentPreset[];
}

export interface WordPressProfile extends WordPressThemeProfile {
  updatedAtMs: number;
}

export interface SaveWordPressProfileRequest {
  id?: string | null;
  name: string;
  description: string;
  note: string;
  components: WordPressComponentPreset[];
}

export interface WordPressProfileExportEntry {
  name: string;
  description: string;
  note: string;
  components: WordPressComponentPreset[];
}

export interface ExportWordPressProfilesRequest {
  destinationPath: string;
  profiles: WordPressProfileExportEntry[];
}

export interface ImportWordPressProfilesRequest {
  sourcePaths: string[];
}

export interface WordPressProfilesExportDocument {
  version: number;
  exportedAt: number;
  profiles: WordPressProfileExportEntry[];
}

export interface WordPressProfileImportFailure {
  sourcePath: string;
  error: string;
}

export interface ImportWordPressProfilesResult {
  profiles: WordPressProfile[];
  importedProfiles: WordPressProfile[];
  importedCount: number;
  failedFiles: WordPressProfileImportFailure[];
}

export interface WordPressModuleSettings {
  selectedProfileId: string | null;
  activeComponentIds: string[];
  projectSlug: string;
  namingPattern: string;
  format: OutputFormat;
  quality: number;
  resizeMode: ResizeMode;
  useFallbackChain?: boolean;
}

export interface SrcsetModuleSettings {
  presetId: string;
  widths: number[];
  sizes: string;
  altText: string;
  namingPattern: string;
  quality: number;
  resizeMode: ResizeMode;
  includeAvif: boolean;
  includeWebp: boolean;
  includeJpeg: boolean;
}

export interface FaviconModuleSettings {
  appName: string;
  shortName: string;
  assetPath: string;
  themeColor: string;
  backgroundColor: string;
  paddingPercent: number;
  transparentBackground: boolean;
  includeManifest: boolean;
  includeAppleTouch: boolean;
  includeIco: boolean;
  includeAndroidIcons: boolean;
  includeSafariPinnedTab?: boolean;
  maskIconColor?: string;
  includeBrowserconfig?: boolean;
}

export interface SocialMediaModuleSettings {
  selectedVariantIds: string[];
  namingPattern: string;
  assetPath: string;
  altText: string;
  format: OutputFormat;
  quality: number;
  resizeMode: ResizeMode;
  selectedBrandKitId?: string | null;
}

export interface AutomationModuleSettings {
  watchPath: string | null;
  outputPath: string | null;
  selectedProfileId: string | null;
  recursive: boolean;
  moveProcessed: boolean;
  processedDirName: string;
}

export interface BatchRenameModuleSettings {
  namingPattern: string;
  startIndex: number;
}

export interface VideoModuleSettings {
  selectedPresetId: string;
  outputPath: string | null;
  muteAudio: boolean;
  extractFrameAt: number;
}

export interface BrandKit {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  logoPath: string;
  iconPath: string;
  fontHeading: string;
  fontBody: string;
  watermarkPath: string;
  updatedAtMs: number;
}

export interface SaveBrandKitRequest {
  id?: string | null;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  logoPath: string | null;
  iconPath: string | null;
  fontHeading: string;
  fontBody: string;
  watermarkPath: string | null;
}

export interface BrandModuleSettings {
  selectedBrandKitId: string | null;
  lastOutputPath?: string | null;
}

export interface BrandKitExportEntry {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  logoPath: string | null;
  iconPath: string | null;
  fontHeading: string;
  fontBody: string;
  watermarkPath: string | null;
}

export interface ExportBrandKitsRequest {
  destinationPath: string;
  kitIds: string[];
}

export interface ImportBrandKitsRequest {
  sourcePaths: string[];
}

export interface BrandKitsExportDocument {
  version: number;
  exportedAt: number;
  kits: BrandKitExportEntry[];
}

export interface BrandKitImportFailure {
  sourcePath: string;
  error: string;
}

export interface ImportBrandKitsResult {
  kits: BrandKit[];
  importedKits: BrandKit[];
  importedCount: number;
  failedFiles: BrandKitImportFailure[];
}

export interface StartWatchFolderRequest {
  watchPath: string;
  outputPath: string;
  selectedProfileId: string | null;
  recursive: boolean;
  moveProcessed: boolean;
  processedDirName: string;
}

export interface WatchFolderJob {
  sourcePath: string;
  outputDir: string;
  status: string;
  processedAt: number;
  outputCount: number;
  error: string | null;
}

export interface WatchFolderStatus {
  active: boolean;
  watchPath: string | null;
  outputPath: string | null;
  selectedProfileId: string | null;
  recursive: boolean;
  moveProcessed: boolean;
  processedDirName: string;
  queueLength: number;
  processing: boolean;
  processedCount: number;
  startedAt: number | null;
  lastError: string | null;
  recentJobs: WatchFolderJob[];
}

export interface PreviewBatchRenameRequest {
  paths: string[];
  namingPattern?: string | null;
  startIndex?: number | null;
}

export interface RenamePlanItem {
  sourcePath: string;
  sourceName: string;
  targetPath: string;
  targetName: string;
  width: number;
  height: number;
  format: string;
  changed: boolean;
  collisionResolved: boolean;
  error: string | null;
}

export interface ApplyBatchRenameRequest {
  items: RenamePlanItem[];
}

export interface RenameResultItem {
  sourcePath: string;
  sourceName: string;
  targetPath: string;
  targetName: string;
  changed: boolean;
  collisionResolved: boolean;
  success: boolean;
  error: string | null;
}

export interface RenameSummary {
  totalFiles: number;
  renamed: number;
  unchanged: number;
  failed: number;
  collisionsResolved: number;
  results: RenameResultItem[];
}

export interface VideoPreset {
  id: string;
  label: string;
  description: string;
  crf: number;
  audioBitrateKbps: number;
}

export interface VideoToolStatus {
  installed: boolean;
  binaryPath: string | null;
  version: string | null;
  message: string | null;
}

export interface CompressVideoRequest {
  inputPath: string;
  outputPath?: string | null;
  outputDir?: string | null;
  preset?: string | null;
  overwrite?: boolean | null;
}

export interface CompressVideoResult {
  inputPath: string;
  outputPath: string;
  preset: string;
  presetLabel: string;
  crf: number;
  ffmpegPreset: string;
  inputSize: number;
  outputSize: number;
  savedBytes: number;
  savingsPercent: number;
  durationMs: number;
}

export interface ExtractVideoFrameRequest {
  inputPath: string;
  outputPath?: string | null;
  outputDir?: string | null;
  timestampSeconds?: number | null;
  imageFormat?: string | null;
  overwrite?: boolean | null;
}

export interface ExtractVideoFrameResult {
  inputPath: string;
  outputPath: string;
  timestampSeconds: number;
  imageFormat: string;
  bytes: number;
  durationMs: number;
}

export interface GenerateFaviconsRequest {
  sourcePath: string;
  outputDir: string;
  appName: string;
  shortName: string;
  assetPath: string;
  themeColor: string;
  backgroundColor: string;
  paddingPercent: number;
  transparentBackground: boolean;
  includeManifest: boolean;
  includeAppleTouch: boolean;
  includeIco: boolean;
  includeAndroidIcons: boolean;
  includeSafariPinnedTab?: boolean;
  maskIconColor?: string;
  includeBrowserconfig?: boolean;
}

export interface FaviconGeneratedFile {
  label: string;
  filename: string;
  path: string;
  bytes: number;
  size: number;
}

export interface GenerateFaviconsResult {
  sourcePath: string;
  outputDir: string;
  sourceSize: number;
  files: FaviconGeneratedFile[];
  htmlSnippet: string;
  manifestPath: string | null;
  browserconfigPath?: string | null;
}

export interface AppSettings {
  lastInputPaths: string[];
  lastOutputPath: string | null;
  defaultModule: string;
  lastOptimizeOptions: OptimizeSettings;
  optimizeProfiles: OptimizeProfile[];
  lastWordPressOptions: WordPressModuleSettings;
  wordpressProfiles: WordPressProfile[];
  lastSrcsetOptions: SrcsetModuleSettings;
  lastFaviconOptions: FaviconModuleSettings;
  lastSocialOptions: SocialMediaModuleSettings;
  lastAutomationOptions: AutomationModuleSettings;
  lastBatchRenameOptions: BatchRenameModuleSettings;
  lastVideoOptions: VideoModuleSettings;
  brandKits?: BrandKit[];
  lastBrandOptions?: BrandModuleSettings;
}
