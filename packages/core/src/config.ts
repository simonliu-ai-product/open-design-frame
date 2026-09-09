export type OpenFrameConfig = {
  base?: string;
  /** Where frames live, relative to the project root. */
  framesDir?: string;
  /** Where shared design systems live, relative to the project root. */
  themesDir?: string;
  assetsDir?: string;
  port?: number;
  allowedHosts?: string[] | true;
};
