import { defineConfig } from 'tsup';

// Bundles the internal workspace packages (types, loader, consent-web-component,
// consent-react) from source into one publishable package. The `@baseel/*`
// imports are resolved through the `paths` in tsconfig.json, so consumers only
// ever install `@baseel/consent-sdk`.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  noExternal: [/^@baseel\//],
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
