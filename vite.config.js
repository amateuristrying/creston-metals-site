import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { METALS, metalSlug } from './src/js/data.js';

const products = Object.fromEntries(METALS.flatMap((group) => group.items).map((metal) => {
  const slug = metalSlug(metal);
  return [`metal-${slug}`, fileURLToPath(new URL(`./metals/${slug}/index.html`, import.meta.url))];
}));

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        contact: fileURLToPath(new URL('./contact/index.html', import.meta.url)),
        ...products,
      },
    },
  },
});
