/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_MAP_STYLE_URL?: string;
  readonly VITE_NYC_GEOSEARCH_URL?: string;
  readonly VITE_NJ_GEOCODER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
