/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com https://*.office.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;