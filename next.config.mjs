/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Un onglet déjà visité s'affiche instantanément pendant 30 s (données
    // rechargées ensuite) au lieu d'être recalculé à chaque clic.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
