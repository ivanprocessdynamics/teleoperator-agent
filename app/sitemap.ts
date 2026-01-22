import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://teleoperator-agent.vercel.app';

    // Generate 10 slot URLs
    const slots = Array.from({ length: 10 }, (_, i) => ({
        url: `${baseUrl}/agent-view/${i + 1}`,
        lastModified: new Date(),
        changeFrequency: 'always' as const,
        priority: 1.0,
    }));

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.5,
        },
        ...slots
    ]
}
