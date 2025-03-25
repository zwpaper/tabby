/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
