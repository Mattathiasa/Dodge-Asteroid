/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GoatCounter site code. Unset, analytics stay off entirely. */
  readonly VITE_GOATCOUNTER_CODE?: string;
}
