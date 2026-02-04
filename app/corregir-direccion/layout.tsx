
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Confirmar Dirección',
    description: 'Portal de gestión de visitas técnicas.',
};

export default function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="bg-gray-50 min-h-screen">
            {children}
        </div>
    );
}
