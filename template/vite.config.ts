import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Keep exactly one copy of each of these in the bundle.
    //
    // rendiv-kit's components call useFrame(), which reads a React context that
    // @rendiv/core creates. A second copy of @rendiv/core creates a second
    // context, so the kit's components read the default frame 0 while the
    // scenes around them read the real one: the entrance animations stay at
    // opacity 0 and the still comes out as empty background. The render
    // succeeds and nothing warns.
    //
    // A plain `npm i github:...#tag` resolves one copy already. A kit linked
    // from a checkout does not, because the link carries its own node_modules,
    // and a version conflict between any two dependencies can do the same. Two
    // lines are cheaper than diagnosing a blank frame.
    dedupe: ['react', 'react-dom', '@rendiv/core'],
  },
});
